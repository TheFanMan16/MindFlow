// Vitest setup - runs before every test file.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom does not implement matchMedia. Framer Motion calls it through
// useReducedMotion, so any component using the motion primitives would throw on
// mount without this. Defaults to "no preference" - the animated path - so
// tests exercise the same code real users get.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom has no IntersectionObserver, which Framer Motion's whileInView needs.
// The stub reports every observed element as visible immediately: jsdom has no
// layout, so nothing would ever intersect and scroll-revealed content would
// stay hidden from tests even though it renders fine in a browser.
if (!window.IntersectionObserver) {
  class IntersectionObserverStub {
    constructor(callback) {
      this.callback = callback;
    }
    observe(target) {
      this.callback([{ target, isIntersecting: true, intersectionRatio: 1 }], this);
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  window.IntersectionObserver = IntersectionObserverStub;
  globalThis.IntersectionObserver = IntersectionObserverStub;
}

// Unmount anything rendered in a test so state cannot leak between tests.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
