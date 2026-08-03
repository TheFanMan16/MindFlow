// Vitest setup - runs before every test file.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmount anything rendered in a test so state cannot leak between tests.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
