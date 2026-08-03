# My Grocery

Mobile-first grocery tracking MVP built with Angular, Ionic, and Capacitor. V1 is frontend-only and stores data locally on-device.

## Stack
- Angular standalone app
- Ionic UI and routing
- Capacitor for Android packaging
- `@ionic/storage-angular` for local persistence
- Capacitor Local Notifications for expiry and low-stock reminders

## Prerequisites
- Node.js 22.x
- npm 11+
- Android Studio for Android builds

The repo includes [.nvmrc](/Users/ronalisenapati/Ronali/My%20Grocery/.nvmrc) set to `22`. The current local machine was using Node 25, which Angular 21 does not support.

## Initial Setup
Install the right Node version, then install dependencies:

```bash
nvm use
npm install
```

If you do not use `nvm`, make sure `node -v` reports a supported Node 22 release before running Angular commands.

## Run The App In A Browser
Start the Angular dev server:

```bash
npm start
```

Open:

```text
http://localhost:4200
```

For Ionic’s dev server instead:

```bash
npm run ionic:serve
```

## Build The Web App
Create a production build:

```bash
npm run build
```

Build output is generated under:

```text
dist/grocery-tracker/browser
```

## Run Tests
Execute unit tests:

```bash
npm test
```

## Android Setup With Capacitor
After dependencies are installed, add the Android platform once:

```bash
npm run android:add
```

Whenever web code changes and you want to refresh the native shell:

```bash
npm run build
npm run cap:sync
```

Open the Android project in Android Studio:

```bash
npm run android:open
```

From Android Studio:
- Select an emulator or connected Android device
- Click Run
- Accept notification permissions on first launch if prompted

## Typical Development Flow
For web-only UI work:

```bash
npm start
```

For Android testing:

```bash
npm run build
npm run cap:sync
npm run android:open
```

Then run the app from Android Studio.

## Build An APK From The Command Line
Use the included script to build the Angular app, sync Capacitor, and assemble an Android APK:

```bash
npm run android:apk
```

That generates a debug APK at:

```text
dist/android-apk/my-grocery-debug.apk
```

For a release APK:

```bash
npm run android:apk:release
```

That generates:

```text
dist/android-apk/my-grocery-release.apk
```

Notes:
- The script creates the `android/` project automatically the first time if it is missing.
- The script expects the Node version from [.nvmrc](/Users/ronalisenapati/Ronali/My%20Grocery/.nvmrc) and will try `nvm use` automatically when `nvm` is available.
- You still need Android Studio or a configured Android SDK (`ANDROID_SDK_ROOT` or `ANDROID_HOME`) plus Java installed.
- Release APKs are unsigned by default until Android signing config is added.

## Local Data Notes
- Pantry items, shopping list items, and app settings are stored locally through Ionic Storage.
- Clearing app storage or uninstalling the app removes V1 data.
- Notifications are local notifications, not push notifications.

## Project Structure
Main app code lives in:

- [src/app/core](/Users/ronalisenapati/Ronali/My%20Grocery/src/app/core)
- [src/app/shared](/Users/ronalisenapati/Ronali/My%20Grocery/src/app/shared)
- [src/app/features](/Users/ronalisenapati/Ronali/My%20Grocery/src/app/features)

The architecture and implementation plan are documented in [docs/grocery-mvp-implementation-plan.md](/Users/ronalisenapati/Ronali/My%20Grocery/docs/grocery-mvp-implementation-plan.md).

## Current Limitation
Dependency installation and a real build validation have not been completed yet in this session because `npm install` still needs approval to run. Once dependencies are installed, the next step is:

```bash
npm run build
```

If the build reports issues, fix those before adding or opening the Android target.
