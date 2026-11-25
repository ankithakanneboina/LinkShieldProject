import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// jsdom lacks these browser APIs; Recharts' ResponsiveContainer and some layout code need them.
globalThis.ResizeObserver =
  globalThis.ResizeObserver ||
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
}

window.scrollTo = window.scrollTo || (() => {});
