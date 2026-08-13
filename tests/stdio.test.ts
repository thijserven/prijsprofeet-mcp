import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vitest";

const EXPECTED_TOOL_COUNT = 24;

describe("built stdio server", () => {
  it("negotiates MCP and lists tools through a spawned process", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["dist/index.js"],
      cwd: process.cwd(),
      stderr: "pipe",
    });
    const client = new Client({ name: "stdio-test-client", version: "1.0.0" });

    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(EXPECTED_TOOL_COUNT);
      expect(tools.map(({ name }) => name)).toContain(
        "get_products_by_retailer",
      );
    } finally {
      await client.close();
    }
  });
});
