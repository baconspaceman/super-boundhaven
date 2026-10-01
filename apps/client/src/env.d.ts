/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** WebSocket URL of the game server (e.g. wss://example.com). Unset in production builds = offline mode. */
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
