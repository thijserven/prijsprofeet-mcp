import { McpServer } from "@modelcontextprotocol/server";
import { createRequire } from "node:module";

import { PrijsProfeetClient } from "./api/client.js";
import { loadConfig } from "./config.js";
import { TOOL_DEFINITIONS } from "./tools/definitions.js";

const { name, version } = createRequire(import.meta.url)("../package.json") as {
  name: string;
  version: string;
};

export interface ServerDependencies {
  apiClient?: PrijsProfeetClient;
}

export function createMcpServer(
  dependencies: ServerDependencies = {},
): McpServer {
  const apiClient =
    dependencies.apiClient ?? new PrijsProfeetClient(loadConfig());
  const server = new McpServer(
    { name, version },
    {
      capabilities: { tools: {} },
      instructions:
        "Unofficial PriceProfeet API bridge. Respect PriceProfeet rate limits and terms. Matching data can be active, upcoming, or historical; inspect promotion_status, is_current_deal, valid_from, and valid_until before describing a current cheapest price.",
    },
  );

  for (const definition of TOOL_DEFINITIONS) {
    server.registerTool(
      definition.name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: definition.inputSchema,
        _meta: {
          "nl.prijsprofeet/requiresProPlan": definition.requiresProPlan,
        },
        annotations: {
          readOnlyHint: definition.request({}).method === "GET",
          destructiveHint: false,
          idempotentHint: definition.request({}).method === "GET",
          openWorldHint: true,
        },
      },
      async (input) => {
        const data = await apiClient.request(definition.request(input));
        const text = JSON.stringify(data, null, 2);
        return {
          content: [{ type: "text", text }],
          ...(isStructuredContent(data) ? { structuredContent: data } : {}),
        };
      },
    );
  }

  return server;
}

function isStructuredContent(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
