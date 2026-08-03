#!/bin/zsh

set -euo pipefail

ROOT_DIR="${0:A:h:h}"
ANDROID_DIR="$ROOT_DIR/android"
APK_OUTPUT_DIR="$ROOT_DIR/dist/android-apk"
EXPECTED_NODE_VERSION_FILE="$ROOT_DIR/.nvmrc"
DEFAULT_ANDROID_SDK_DIR="$HOME/Library/Android/sdk"

variant="${1:-debug}"

if [[ "$variant" != "debug" && "$variant" != "release" ]]; then
  echo "Usage: ${0:t} [debug|release]" >&2
  exit 1
fi

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

ensure_supported_node() {
  if [[ ! -f "$EXPECTED_NODE_VERSION_FILE" ]]; then
    return
  fi

  local expected_major current_major
  expected_major="$(tr -d '[:space:]' < "$EXPECTED_NODE_VERSION_FILE")"
  current_major="$(node -p "process.versions.node.split('.')[0]")"

  if [[ "$current_major" == "$expected_major" ]]; then
    return
  fi

  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    local nvm_status
    source "$HOME/.nvm/nvm.sh" --no-use

    if command -v nvm >/dev/null 2>&1; then
      set +e
      nvm use >/dev/null 2>&1
      nvm_status=$?
      set -e
    else
      nvm_status=127
    fi

    if [[ "$nvm_status" -eq 0 ]]; then
      current_major="$(node -p "process.versions.node.split('.')[0]")"

      if [[ "$current_major" == "$expected_major" ]]; then
        return
      fi
    else
      echo "Node $expected_major.x is required by .nvmrc, but it is not installed in nvm." >&2
      echo "Install it with: nvm install $expected_major" >&2
      exit 1
    fi
  fi

  echo "Node $expected_major.x is required by .nvmrc. Current Node is $(node -v)." >&2
  echo "Install or switch to the expected version and rerun this script." >&2
  exit 1
}

ensure_android_sdk_config() {
  local local_properties_file="$ANDROID_DIR/local.properties"
  local sdk_dir="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$DEFAULT_ANDROID_SDK_DIR}}"

  if [[ -f "$local_properties_file" ]]; then
    return
  fi

  if [[ ! -d "$sdk_dir" ]]; then
    echo "Android SDK not configured. Set ANDROID_SDK_ROOT or ANDROID_HOME, or install it at $DEFAULT_ANDROID_SDK_DIR." >&2
    exit 1
  fi

  sdk_dir="${sdk_dir//\\/\\\\}"
  sdk_dir="${sdk_dir//:/\\:}"

  printf 'sdk.dir=%s\n' "$sdk_dir" > "$local_properties_file"
}

run_step() {
  local description="$1"
  shift

  echo "$description"
  "$@"
}

require_command node
require_command npm
require_command npx
require_command java

cd "$ROOT_DIR"

ensure_supported_node

if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
  echo "Dependencies are missing. Run 'npm install' first." >&2
  exit 1
fi

if [[ ! -d "$ANDROID_DIR" ]]; then
  run_step "Android platform missing. Creating it with Capacitor..." npx cap add android
fi

run_step "Building Angular app..." npm run build
run_step "Syncing Capacitor Android project..." npx cap sync android

ensure_android_sdk_config

chmod +x "$ANDROID_DIR/gradlew"

run_step "Assembling $variant APK..." "$ANDROID_DIR/gradlew" "assemble${(C)variant}"

mkdir -p "$APK_OUTPUT_DIR"

apk_path="$(find "$ANDROID_DIR/app/build/outputs/apk/$variant" -type f -name '*.apk' | head -n 1)"

if [[ -z "$apk_path" ]]; then
  echo "Gradle finished without producing an APK in android/app/build/outputs/apk/$variant." >&2
  exit 1
fi

final_apk_path="$APK_OUTPUT_DIR/my-grocery-$variant.apk"
cp "$apk_path" "$final_apk_path"

echo "APK ready: $final_apk_path"

if [[ "$variant" == "release" ]]; then
  echo "Note: release builds are unsigned unless you add Android signing config."
fi
