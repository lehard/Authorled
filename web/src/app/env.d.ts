// Injected by vite.config.ts from the repository .env; null when the variable is unset.
declare const __AUTH_CONFIG__: {
  AUTH_ISSUER: string | null;
  AUTH_FRONTEND_CLIENT_ID: string | null;
  AUTH_FRONTEND_REDIRECT_URI: string | null;
  AUTH_FRONTEND_LOGOUT_URI: string | null;
};

// Password of the development users in `vite serve`; null in production builds.
declare const __DEV_USER_PASSWORD__: string | null;

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: string;
}
