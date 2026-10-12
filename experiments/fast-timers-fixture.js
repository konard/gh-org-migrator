// Preloaded with `node --import` so CLI tests skip the 30 second rate-limit pause.
const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (callback, delay, ...args) =>
  originalSetTimeout(callback, delay >= 1000 ? 0 : delay, ...args);
