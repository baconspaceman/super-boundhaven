/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WAITLIST_URL?: string;
  readonly VITE_PLAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
