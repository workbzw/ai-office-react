/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OFFICE_ACTION_SOURCE?: 'demo' | 'websocket'
  readonly VITE_OFFICE_WS_URL?: string
  readonly VITE_OFFICE_DISPATCH_MODE?: 'queue' | 'skip' | 'hybrid'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.css' {}
