import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMcpServer } from "../src/server.js";
import { TOOL_DEFINITIONS } from "../src/tools/definitions.js";
import type { PrijsProfeetClient } from "../src/api/client.js";

const packageMetadata = createRequire(import.meta.url)("../package.json") as {
  name: string;
  version: string;
};

const EXPECTED_TOOLS = [
  "health_check",
  "list_products",
  "get_product",
  "get_price_history",
  "get_forecast",
  "search_products_by_name",
  "get_products_by_folder",
  "get_products_by_retailer",
  "get_promotional_products",
  "search_products",
  "get_categories",
  "get_filter_stats",
  "match_by_ean",
  "match_product",
  "compare_prices",
  "get_ean_stats",
  "get_top_deals",
  "get_brand_deals",
  "get_deals_summary",
  "get_popular_deals",
  "get_deals_by_type",
  "get_new_deals",
  "request_free_api_key",
  "get_partner_usage",
] as const;

describe("PrijsProfeet MCP server", () => {
  const closers: (() => Promise<void>)[] = [];

  afterEach(async () => {
    await Promise.all(closers.splice(0).map((close) => close()));
  });

  it("exposes exactly one tool for every OpenAPI operation", () => {
    expect(TOOL_DEFINITIONS.map(({ name }) => name)).toEqual(EXPECTED_TOOLS);
    expect(new Set(EXPECTED_TOOLS).size).toBe(EXPECTED_TOOLS.length);
  });

  it("advertises the package manifest identity", async () => {
    const server = createMcpServer({
      apiClient: { request: vi.fn() } as unknown as PrijsProfeetClient,
    });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    closers.push(
      () => client.close(),
      () => server.close(),
    );

    expect(client.getServerVersion()).toMatchObject({
      name: packageMetadata.name,
      version: packageMetadata.version,
    });
  });

  it("lists tools and calls a tool through the official MCP client", async () => {
    const request = vi.fn(() => Promise.resolve({ status: "ok" }));
    const apiClient = { request } as unknown as PrijsProfeetClient;
    const server = createMcpServer({ apiClient });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    closers.push(
      () => client.close(),
      () => server.close(),
    );

    const listed = await client.listTools();
    expect(listed.tools.map(({ name }) => name)).toEqual(EXPECTED_TOOLS);

    const result = await client.callTool({
      name: "health_check",
      arguments: {},
    });
    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/api/v1/health",
    });
    expect(result).toMatchObject({
      structuredContent: { status: "ok" },
      content: [{ type: "text", text: '{\n  "status": "ok"\n}' }],
    });
  });

  it("marks Pro-plan tools with namespaced MCP metadata", async () => {
    const server = createMcpServer({
      apiClient: { request: vi.fn() } as unknown as PrijsProfeetClient,
    });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    closers.push(
      () => client.close(),
      () => server.close(),
    );

    const toolsByName = new Map(
      (await client.listTools()).tools.map((tool) => [tool.name, tool]),
    );

    for (const name of [
      "get_price_history",
      "match_by_ean",
      "match_product",
      "compare_prices",
      "get_ean_stats",
    ]) {
      expect(toolsByName.get(name)?._meta).toMatchObject({
        "nl.prijsprofeet/requiresProPlan": true,
      });
    }

    expect(toolsByName.get("get_forecast")?._meta).toMatchObject({
      "nl.prijsprofeet/requiresProPlan": false,
    });
    expect(toolsByName.get("get_partner_usage")?._meta).toMatchObject({
      "nl.prijsprofeet/requiresProPlan": false,
    });
  });

  it("exposes the supported retailer slugs as enums in every retailer schema", async () => {
    const server = createMcpServer({
      apiClient: { request: vi.fn() } as unknown as PrijsProfeetClient,
    });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    closers.push(
      () => client.close(),
      () => server.close(),
    );

    const retailerEnum = [
      "albert_heijn",
      "aldi",
      "dekamarkt",
      "dirk",
      "ekoplaza",
      "hoogvliet",
      "jumbo",
      "lidl",
      "plus",
      "vomar",
    ];
    const { tools } = await client.listTools();

    for (const { name, inputSchema } of tools) {
      const retailer = inputSchema.properties?.retailer as
        | { enum?: string[]; items?: { enum?: string[] } }
        | undefined;
      if (!retailer) continue;
      expect(name).toBeTruthy();
      expect(retailer.enum ?? retailer.items?.enum).toEqual(retailerEnum);
    }
  });

  it("accepts repeatable retailer filters only for top deals", () => {
    const topDeals = TOOL_DEFINITIONS.find(
      ({ name }) => name === "get_top_deals",
    );
    const productList = TOOL_DEFINITIONS.find(
      ({ name }) => name === "list_products",
    );

    expect(topDeals).toBeDefined();
    expect(productList).toBeDefined();
    expect(
      topDeals?.inputSchema.parse({ retailer: ["lidl", "vomar"] }),
    ).toMatchObject({ retailer: ["lidl", "vomar"] });
    expect(
      topDeals?.request({
        limit: 10,
        min_savings: 10,
        retailer: ["lidl", "vomar"],
      }),
    ).toEqual({
      method: "GET",
      path: "/api/v1/deals/top",
      query: { limit: 10, min_savings: 10, retailer: ["lidl", "vomar"] },
    });
    expect(() => topDeals?.inputSchema.parse({ retailer: [] })).toThrow();
    expect(() =>
      productList?.inputSchema.parse({ retailer: ["lidl", "vomar"] }),
    ).toThrow();
  });

  it("validates endpoint arguments before invoking the API", async () => {
    const request = vi.fn();
    const server = createMcpServer({
      apiClient: { request } as unknown as PrijsProfeetClient,
    });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    closers.push(
      () => client.close(),
      () => server.close(),
    );

    const result = await client.callTool({
      name: "match_by_ean",
      arguments: { ean: "123" },
    });

    expect(result.isError).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
});
