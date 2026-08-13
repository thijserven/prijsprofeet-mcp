import { afterEach, describe, expect, it, vi } from "vitest";

import { PrijsProfeetApiError, PrijsProfeetClient } from "../src/api/client.js";

describe("PrijsProfeetClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("adds query parameters, API key, and compliant user agent", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ total: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new PrijsProfeetClient({
      baseUrl: "https://www.prijsprofeet.nl",
      apiKey: "secret",
      userAgent:
        "PrijsProfeetMCP/0.1 (+https://github.com/example/prijsprofeet-mcp)",
      timeoutMs: 1_000,
    });

    await client.request({
      method: "GET",
      path: "/api/v1/deals/top",
      query: { limit: 5, retailer: ["aldi", "jumbo"], current_only: false },
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.toString()).toBe(
      "https://www.prijsprofeet.nl/api/v1/deals/top?limit=5&retailer=aldi&retailer=jumbo&current_only=false",
    );
    expect(init.headers).toMatchObject({
      Accept: "application/json",
      "User-Agent":
        "PrijsProfeetMCP/0.1 (+https://github.com/example/prijsprofeet-mcp)",
      "X-API-Key": "secret",
    });
  });

  it("sends JSON request bodies", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response("{}", { status: 202 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new PrijsProfeetClient({
      baseUrl: "https://www.prijsprofeet.nl",
      userAgent: "PrijsProfeetMCP/0.1",
      timeoutMs: 1_000,
    });

    await client.request({
      method: "POST",
      path: "/api/v1/partner/signup",
      body: { email: "dev@example.com", project_name: "Example" },
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(init.body).toBe(
      '{"email":"dev@example.com","project_name":"Example"}',
    );
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
  });

  it("surfaces status and a bounded upstream error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ detail: "Rate limit exceeded" }), {
            status: 429,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    );
    const client = new PrijsProfeetClient({
      baseUrl: "https://www.prijsprofeet.nl",
      userAgent: "PrijsProfeetMCP/0.1",
      timeoutMs: 1_000,
    });

    await expect(
      client.request({ method: "GET", path: "/api/v1/products" }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PrijsProfeetApiError>>({
        name: "PrijsProfeetApiError",
        status: 429,
        message: "PrijsProfeet API returned 429: Rate limit exceeded",
      }),
    );
  });
});
