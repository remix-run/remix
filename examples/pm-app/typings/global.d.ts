declare namespace NodeJS {
  export interface ProcessEnv {
    NODE_ENV: "production" | "development";
    DATABASE_URL: string;
    PORT: string;
    SITE_URL: string;
    SESSION_SECRET: string;
  }
}

interface Window
  extends EventTarget,
    AnimationFrameProvider,
    GlobalEventHandlers,
    WindowEventHandlers,
    WindowLocalStorage,
    WindowOrWorkerGlobalScope,
    WindowSessionStorage {
  ENV?: {
    SITE_URL: string;
  };
}
