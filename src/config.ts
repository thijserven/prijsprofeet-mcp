export interface Config {
  apiKey?: string;
  baseUrl: string;
  timeoutMs: number;
  userAgent: string;
}

export interface HttpConfig {
  authToken: string;
  host: string;
  port: number;
}

const DEFAULT_BASE_URL = "https://www.prijsprofeet.nl";
const DEFAULT_USER_AGENT =
  "PrijsProfeetMCP/0.1 (+https://github.com/thijserven/prijsprofeet-mcp)";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const timeoutMs = Number(env.PRIJSPROFEET_TIMEOUT_MS ?? "15000");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("PRIJSPROFEET_TIMEOUT_MS must be a positive integer");
  }

  const baseUrl = env.PRIJSPROFEET_BASE_URL ?? DEFAULT_BASE_URL;
  const url = new URL(baseUrl);
  if (
    url.protocol !== "https:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  ) {
    throw new Error(
      "PRIJSPROFEET_BASE_URL must use HTTPS, except for localhost",
    );
  }

  return {
    ...(env.PRIJSPROFEET_API_KEY ? { apiKey: env.PRIJSPROFEET_API_KEY } : {}),
    baseUrl: url.toString().replace(/\/$/, ""),
    timeoutMs,
    userAgent: env.PRIJSPROFEET_USER_AGENT ?? DEFAULT_USER_AGENT,
  };
}

export function loadHttpConfig(
  env: NodeJS.ProcessEnv = process.env,
): HttpConfig {
  const authToken = env.PRIJSPROFEET_MCP_AUTH_TOKEN;
  if (!authToken) {
    throw new Error("PRIJSPROFEET_MCP_AUTH_TOKEN must be set");
  }

  const port = Number(env.PRIJSPROFEET_MCP_PORT ?? "3000");
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("PRIJSPROFEET_MCP_PORT must be an integer from 1 to 65535");
  }

  const host = env.PRIJSPROFEET_MCP_HOST ?? "0.0.0.0";
  if (!host) {
    throw new Error("PRIJSPROFEET_MCP_HOST must not be empty");
  }

  return { authToken, host, port };
}
