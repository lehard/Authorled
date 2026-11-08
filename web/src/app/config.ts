// Required settings of the app (openspec/specs/web/workspace, «Обязательные настройки»).
// Every value is checked at start; a missing or wrong one stops the app with its name.

export const DATA_SOURCES = ["api", "fixtures"] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export type AppConfig = {
  issuer: string;
  clientId: string;
  redirectUri: string;
  logoutUri: string;
  dataSource: DataSource;
  siteOrigin: string;
};

export class ConfigError extends Error {
  readonly setting: string;

  constructor(setting: string, message: string) {
    super(message);
    this.name = "ConfigError";
    this.setting = setting;
  }
}

function required(name: string, value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === "") {
    throw new ConfigError(
      name,
      `Не задана настройка ${name} в .env в корне репозитория.`,
    );
  }
  return value.trim();
}

function url(name: string, value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new ConfigError(name, `${name} — не адрес: «${value}».`);
  }
}

function isDataSource(value: string): value is DataSource {
  return (DATA_SOURCES as readonly string[]).includes(value);
}

let loaded: AppConfig | null = null;

/** Settings checked at start by loadConfig. */
export function appConfig(): AppConfig {
  if (loaded === null)
    throw new Error(
      "Настройки ещё не загружены: вызовите loadConfig при старте.",
    );
  return loaded;
}

export function loadConfig(): AppConfig {
  const issuer = required("AUTH_ISSUER", __AUTH_CONFIG__.AUTH_ISSUER);
  url("AUTH_ISSUER", issuer);
  const clientId = required(
    "AUTH_FRONTEND_CLIENT_ID",
    __AUTH_CONFIG__.AUTH_FRONTEND_CLIENT_ID,
  );
  const redirectUri = required(
    "AUTH_FRONTEND_REDIRECT_URI",
    __AUTH_CONFIG__.AUTH_FRONTEND_REDIRECT_URI,
  );
  const redirect = url("AUTH_FRONTEND_REDIRECT_URI", redirectUri);
  const logoutUri = required(
    "AUTH_FRONTEND_LOGOUT_URI",
    __AUTH_CONFIG__.AUTH_FRONTEND_LOGOUT_URI,
  );
  if (url("AUTH_FRONTEND_LOGOUT_URI", logoutUri).origin !== redirect.origin) {
    throw new ConfigError(
      "AUTH_FRONTEND_LOGOUT_URI",
      `AUTH_FRONTEND_LOGOUT_URI (${logoutUri}) должен быть на том же адресе, что и AUTH_FRONTEND_REDIRECT_URI (${redirect.origin}).`,
    );
  }
  const dataSource = required(
    "VITE_DATA_SOURCE",
    import.meta.env.VITE_DATA_SOURCE,
  );
  if (!isDataSource(dataSource)) {
    throw new ConfigError(
      "VITE_DATA_SOURCE",
      `Источник данных «${dataSource}» не поддерживается. Допустимые значения: ${DATA_SOURCES.join(", ")}.`,
    );
  }
  const siteOrigin = required("SITE_ORIGIN", __SITE_ORIGIN__);
  const site = url("SITE_ORIGIN", siteOrigin);
  if (site.protocol !== "http:" && site.protocol !== "https:") {
    throw new ConfigError(
      "SITE_ORIGIN",
      `SITE_ORIGIN (${siteOrigin}) должен быть адресом http или https.`,
    );
  }
  // OIDC state lives in sessionStorage of one origin, so sign-in only works on the redirect origin.
  if (window.location.origin !== redirect.origin) {
    throw new ConfigError(
      "AUTH_FRONTEND_REDIRECT_URI",
      `Приложение открыто по адресу ${window.location.origin}, а вход возвращает на ${redirect.origin}. Откройте ${redirect.origin}.`,
    );
  }
  loaded = {
    issuer,
    clientId,
    redirectUri,
    logoutUri,
    dataSource,
    siteOrigin,
  };
  return loaded;
}
