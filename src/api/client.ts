import type { Config } from "../config.js";

export type QueryValue =
  | boolean
  | number
  | string
  | readonly string[]
  | null
  | undefined;

export interface ApiRequest {
  body?: unknown;
  method: "GET" | "POST";
  path: string;
  query?: Readonly<Record<string, QueryValue>>;
}

export class PrijsProfeetApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PrijsProfeetApiError";
  }
}

export class PrijsProfeetClient {
  constructor(private readonly config: Config) {}

  async request(request: ApiRequest): Promise<unknown> {
    const url = new URL(request.path, `${this.config.baseUrl}/`);
    appendQuery(url, request.query);

    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": this.config.userAgent,
    };
    if (this.config.apiKey) headers["X-API-Key"] = this.config.apiKey;
    if (request.body !== undefined)
      headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await fetch(url, {
        method: request.method,
        headers,
        ...(request.body !== undefined
          ? { body: JSON.stringify(request.body) }
          : {}),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new PrijsProfeetApiError(
        `PrijsProfeet API request failed: ${message}`,
      );
    }

    const text = await response.text();
    const payload = parseResponse(text, response.headers.get("content-type"));
    if (!response.ok) {
      throw new PrijsProfeetApiError(
        `PrijsProfeet API returned ${String(response.status)}: ${extractErrorMessage(payload, text)}`,
        response.status,
      );
    }

    return payload;
  }
}

function appendQuery(url: URL, query: ApiRequest["query"]): void {
  if (!query) return;

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) url.searchParams.append(key, String(item));
  }
}

function parseResponse(text: string, contentType: string | null): unknown {
  if (text === "") return null;
  if (!contentType?.includes("application/json")) return text;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new PrijsProfeetApiError("PrijsProfeet API returned malformed JSON");
  }
}

function extractErrorMessage(payload: unknown, rawText: string): string {
  if (isRecord(payload) && typeof payload.detail === "string")
    return payload.detail.slice(0, 500);
  if (typeof payload === "string") return payload.slice(0, 500);
  return rawText.slice(0, 500) || "Unknown error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
