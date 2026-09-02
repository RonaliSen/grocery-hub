import { defineConfig } from 'vitest/config';

// Angular's unit-test builder defaults Vitest's `test.isolate` to `false`
// (to mimic the old Karma/Jasmine single-context model) for speed. That
// setting shares one module registry across every spec file in a worker,
// so two spec files that `vi.mock()` the same module (e.g. two pages both
// mocking '@ionic/angular/standalone' with different stub factories) can
// corrupt each other's mock registration and crash with an unrelated
// "Cannot read properties of undefined (reading 'trim')" error depending
// on run order. Re-enabling isolation gives each spec file its own module
// registry again, at a small cost to run time.
export default defineConfig({
  test: {
    isolate: true
  }
});
