import * as z from "zod/v4";

import type { ApiRequest, QueryValue } from "../api/client.js";

const page = z.int().min(1).default(1).describe("Page number");
const pageSize100 = z
  .int()
  .min(1)
  .max(100)
  .default(20)
  .describe("Results per page");
const limit30 = z.int().min(1).max(30).default(10);
const productId = z.string().min(1).describe("PrijsProfeet product ID");
const ean = z.string().regex(/^\d{8,13}$/, "EAN must contain 8-13 digits");
export const RETAILERS = [
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
] as const;
const retailer = z.enum(RETAILERS);

export interface ToolDefinition {
  description: string;
  inputSchema: z.ZodType<Record<string, unknown>>;
  name: string;
  request: (input: Record<string, unknown>) => ApiRequest;
  requiresProPlan: boolean;
  title: string;
}

function tool(
  name: string,
  title: string,
  description: string,
  inputSchema: z.ZodType<Record<string, unknown>>,
  request: ToolDefinition["request"],
  requiresProPlan = false,
): ToolDefinition {
  return { name, title, description, inputSchema, request, requiresProPlan };
}

function get(path: string, query?: Record<string, QueryValue>): ApiRequest {
  return { method: "GET", path, ...(query ? { query } : {}) };
}

function query(
  input: Record<string, unknown>,
  ...keys: string[]
): Record<string, QueryValue> {
  return Object.fromEntries(keys.map((key) => [key, input[key] as QueryValue]));
}

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  tool(
    "health_check",
    "Health check",
    "Verify that PriceProfeet services are operational.",
    z.object({}),
    () => get("/api/v1/health"),
  ),
  tool(
    "list_products",
    "List products",
    "List products with filters, sorting, and pagination.",
    z.object({
      retailer: retailer.optional(),
      folder_id: z.string().optional(),
      is_promotional: z.boolean().optional(),
      min_price: z.number().min(0).optional(),
      max_price: z.number().min(0).optional(),
      sort_by: z
        .enum(["extracted_at", "price", "name"])
        .default("extracted_at"),
      sort_order: z.enum(["asc", "desc"]).default("desc"),
      page,
      page_size: pageSize100,
    }),
    (input) => get("/api/v1/products", input as Record<string, QueryValue>),
  ),
  tool(
    "get_product",
    "Get product",
    "Get one product by its unique ID.",
    z.object({ product_id: productId }),
    (input) =>
      get(`/api/v1/products/${encodeURIComponent(String(input.product_id))}`),
  ),
  tool(
    "get_price_history",
    "Get price history",
    "Get Pro price history for a product. Requires PRIJSPROFEET_API_KEY with Pro access.",
    z.object({ product_id: productId }),
    (input) =>
      get(
        `/api/v1/products/${encodeURIComponent(String(input.product_id))}/price-history`,
      ),
    true,
  ),
  tool(
    "get_forecast",
    "Get forecast",
    "Get the backtested price forecast for a product, if enough history exists.",
    z.object({ product_id: productId }),
    (input) =>
      get(
        `/api/v1/products/${encodeURIComponent(String(input.product_id))}/forecast`,
      ),
  ),
  tool(
    "search_products_by_name",
    "Search products by name",
    "Search the product collection by name with an optional retailer filter.",
    z.object({
      query: z.string().min(1),
      retailer: retailer.optional(),
      page,
      page_size: pageSize100,
    }),
    (input) =>
      get(
        `/api/v1/products/search/${encodeURIComponent(String(input.query))}`,
        query(input, "retailer", "page", "page_size"),
      ),
  ),
  tool(
    "get_products_by_folder",
    "Get products by folder",
    "Get products from a folder with pagination.",
    z.object({
      folder_id: z.string().min(1),
      page,
      page_size: z.int().min(1).max(1000).default(100),
    }),
    (input) =>
      get(
        `/api/v1/products/folder/${encodeURIComponent(String(input.folder_id))}`,
        query(input, "page", "page_size"),
      ),
  ),
  tool(
    "get_products_by_retailer",
    "Get products by retailer",
    "Get products for one retailer with pagination.",
    z.object({ retailer, page, page_size: pageSize100 }),
    (input) =>
      get(
        `/api/v1/products/retailer/${encodeURIComponent(String(input.retailer))}`,
        query(input, "page", "page_size"),
      ),
  ),
  tool(
    "get_promotional_products",
    "Get promotional products",
    "Get promotional products, optionally filtered by retailer.",
    z.object({
      retailer: retailer.optional(),
      page,
      page_size: z.int().min(1).max(100).default(50),
    }),
    (input) =>
      get(
        "/api/v1/products/promotional/all",
        input as Record<string, QueryValue>,
      ),
  ),
  tool(
    "search_products",
    "Advanced product search",
    "Fuzzy search and browse promotions with retailer, category, status, type, dietary, price, savings, sorting, and pagination filters.",
    z.object({
      q: z.string().min(1).optional(),
      retailer: retailer.optional(),
      category: z.string().optional(),
      promotion_status: z.enum(["active", "upcoming", "expired"]).optional(),
      promotion_type: z.string().optional(),
      dietary: z
        .string()
        .optional()
        .describe("Comma-separated tags: bio, glutenvrij, lactosevrij, vegan"),
      min_price: z.number().min(0).optional(),
      max_price: z.number().min(0).optional(),
      min_savings: z.number().min(0).max(100).optional(),
      sort_by: z.string().optional(),
      page,
      page_size: pageSize100,
    }),
    (input) => get("/api/v1/search", input as Record<string, QueryValue>),
  ),
  tool(
    "get_categories",
    "Get categories",
    "Get unified product categories and product counts.",
    z.object({}),
    () => get("/api/v1/categories"),
  ),
  tool(
    "get_filter_stats",
    "Get filter statistics",
    "Get faceted counts for matching retailers, statuses, categories, and dietary tags.",
    z.object({
      q: z.string().optional(),
      retailer: retailer.optional(),
      category: z.string().optional(),
      promotion_status: z.string().optional(),
      dietary: z.string().optional(),
    }),
    (input) => get("/api/v1/filter-stats", input as Record<string, QueryValue>),
  ),
  tool(
    "match_by_ean",
    "Match by EAN",
    "Find products with the same EAN across retailers. Pro API key required. Non-current matches may be upcoming or historical unless current_only is true.",
    z.object({
      ean,
      exclude_retailer: retailer.optional(),
      current_only: z.boolean().default(false),
    }),
    (input) =>
      get(
        `/api/v1/match/ean/${encodeURIComponent(String(input.ean))}`,
        query(input, "exclude_retailer", "current_only"),
      ),
    true,
  ),
  tool(
    "match_product",
    "Match product",
    "Find a product at other retailers. Pro API key required. Non-current matches may be upcoming or historical unless current_only is true.",
    z.object({
      product_id: productId,
      include_same_retailer: z.boolean().default(false),
      current_only: z.boolean().default(false),
    }),
    (input) =>
      get(
        `/api/v1/match/product/${encodeURIComponent(String(input.product_id))}`,
        query(input, "include_same_retailer", "current_only"),
      ),
    true,
  ),
  tool(
    "compare_prices",
    "Compare prices",
    "Compare an EAN across retailers. Pro API key required; inspect promotion status and validity before presenting a current cheapest price.",
    z.object({ ean }),
    (input) =>
      get(`/api/v1/match/compare/${encodeURIComponent(String(input.ean))}`),
    true,
  ),
  tool(
    "get_ean_stats",
    "Get EAN statistics",
    "Get EAN coverage statistics across retailers. Pro API key required.",
    z.object({}),
    () => get("/api/v1/match/stats"),
    true,
  ),
  tool(
    "get_top_deals",
    "Get top deals",
    "Get top deals by savings percentage and amount, optionally scoped to repeatable retailer slugs.",
    z.object({
      limit: z.int().min(1).max(50).default(10),
      min_savings: z.number().min(0).max(100).default(10),
      retailer: z.array(retailer).min(1).optional(),
    }),
    (input) => get("/api/v1/deals/top", input as Record<string, QueryValue>),
  ),
  tool(
    "get_brand_deals",
    "Get brand deals",
    "Get current deal variants for a brand.",
    z.object({
      brand: z.string().min(1),
      promotion_type: z.string().optional(),
      limit: z.int().min(1).max(200).default(50),
    }),
    (input) =>
      get(
        `/api/v1/deals/brand/${encodeURIComponent(String(input.brand))}`,
        query(input, "promotion_type", "limit"),
      ),
  ),
  tool(
    "get_deals_summary",
    "Get deals summary",
    "Get aggregate deal and retailer statistics.",
    z.object({}),
    () => get("/api/v1/deals/summary"),
  ),
  tool(
    "get_popular_deals",
    "Get popular deals",
    "Get the most-clicked products from the last seven days.",
    z.object({ limit: limit30 }),
    (input) => get("/api/v1/deals/popular", query(input, "limit")),
  ),
  tool(
    "get_deals_by_type",
    "Get deals by type",
    "Get products matching a promotion keyword such as 1+1.",
    z.object({ type: z.string().min(1), limit: limit30 }),
    (input) =>
      get("/api/v1/deals/by-type", input as Record<string, QueryValue>),
  ),
  tool(
    "get_new_deals",
    "Get new deals",
    "Get products scraped this week, newest first.",
    z.object({ limit: limit30 }),
    (input) => get("/api/v1/deals/new", query(input, "limit")),
  ),
  tool(
    "request_free_api_key",
    "Request free API key",
    "Ask PriceProfeet to email a free API-key link. Rate limited to five requests per hour per IP.",
    z.object({
      email: z.email(),
      project_name: z.string().min(2).max(80),
      site_url: z.string().max(200).optional(),
    }),
    (input) => ({
      method: "POST",
      path: "/api/v1/partner/signup",
      body: input,
    }),
  ),
  tool(
    "get_partner_usage",
    "Get partner usage",
    "Get API-key account and rate-limit usage. Requires PRIJSPROFEET_API_KEY.",
    z.object({}),
    () => get("/api/v1/partner/usage"),
  ),
];
