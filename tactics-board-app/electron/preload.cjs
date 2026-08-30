// Intentionally minimal: the app only needs localStorage (already sandboxed per
// origin by Chromium) for saved boards, so no privileged IPC bridge is exposed yet.
// Add contextBridge.exposeInMainWorld(...) here if a future feature needs main-process
// access (e.g. saving boards to disk instead of localStorage).
