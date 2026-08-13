import { timingSafeEqual } from "node:crypto";
import type { RequestListener } from "node:http";

import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";

import { createMcpServer } from "./server.js";
import type { PrijsProfeetClient } from "./api/client.js";

const MCP_PATH = "/mcp";
const HEALTH_PATH = "/health";

export interface HttpServerOptions {
  authToken: string;
  apiClient?: PrijsProfeetClient;
}

function hasBearerToken(
  authorization: string | undefined,
  token: string,
): boolean {
  const expected = Buffer.from(`Bearer ${token}`);
  const received = Buffer.from(authorization ?? "");
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

function sendJson(
  response: Parameters<RequestListener>[1],
  statusCode: number,
  body: Record<string, string>,
): void {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

export function createHttpServer({
  authToken,
  apiClient,
}: HttpServerOptions): RequestListener {
  return (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

    if (pathname === HEALTH_PATH && request.method === "GET") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (pathname !== MCP_PATH) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    if (!hasBearerToken(request.headers.authorization, authToken)) {
      response.writeHead(401, { "WWW-Authenticate": "Bearer" });
      response.end();
      return;
    }

    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const server = createMcpServer(
      apiClient === undefined ? {} : { apiClient },
    );

    void server
      .connect(transport)
      .then(() => transport.handleRequest(request, response))
      .catch((error: unknown) => {
        console.error("MCP HTTP request failed", error);
        if (!response.headersSent) {
          sendJson(response, 500, { error: "Internal server error" });
        } else {
          response.end();
        }
      });
  };
}
