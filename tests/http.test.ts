import { createServer } from "node:http";
import { once } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { createHttpServer } from "../src/http.js";
import type { PrijsProfeetClient } from "../src/api/client.js";

async function startServer() {
  const server = createServer(
    createHttpServer({
      apiClient: { request: vi.fn() } as unknown as PrijsProfeetClient,
      authToken: "test-token",
    }),
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("test server did not listen on a TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    close: async () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

describe("Streamable HTTP server", () => {
  it("keeps health public but rejects unauthenticated MCP requests", async () => {
    const { baseUrl, close } = await startServer();

    try {
      await expect(fetch(`${baseUrl}/health`)).resolves.toMatchObject({
        ok: true,
      });
      await expect(
        fetch(`${baseUrl}/mcp`, { method: "POST" }),
      ).resolves.toMatchObject({
        status: 401,
      });
    } finally {
      await close();
    }
  });

  it("serves the MCP tool catalog to an authenticated client", async () => {
    const { baseUrl, close } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          Authorization: "Bearer test-token",
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            clientInfo: { name: "http-test-client", version: "1.0.0" },
          },
        }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "text/event-stream",
      );
      await expect(response.text()).resolves.toContain("prijsprofeet-mcp");
    } finally {
      await close();
    }
  });
});
