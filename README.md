<h1 align="center">PrijsProfeet MCP</h1>

<p align="center">Unofficial MCP server for the PrijsProfeet API.</p>

<p align="center">
  <a href="https://github.com/thijserven/prijsprofeet-mcp/actions/workflows/publish-container.yaml"><img src="https://github.com/thijserven/prijsprofeet-mcp/actions/workflows/publish-container.yaml/badge.svg" alt="Container publish workflow"></a>
  <a href="https://github.com/thijserven/prijsprofeet-mcp/blob/main/package.json"><img src="https://img.shields.io/badge/npm-v1.0.0-CB3837?logo=npm&amp;logoColor=white" alt="npm package version 1.0.0"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript&amp;logoColor=white" alt="TypeScript 5.9.3"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%E2%89%A522-339933?logo=nodedotjs&amp;logoColor=white" alt="Node.js 22 or newer"></a>
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/MCP-2.0.0-5A45FF" alt="Model Context Protocol SDK 2.0.0"></a>
</p>

> [!WARNING]
> This is an independent integration. It is not developed, endorsed, or supported by PrijsProfeet.

PrijsProfeet MCP exposes all 24 operations from the supported PrijsProfeet API contract as validated MCP tools. Use it from a local stdio client or deploy it as an authenticated Streamable HTTP server.

## Contents

- [Quick start: Docker + GHCR](#quick-start-docker--ghcr)
- [Manual build](#manual-build)
- [Development mode](#development-mode)
- [Connect an MCP client](#connect-an-mcp-client)
- [Capabilities](#capabilities)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Quality checks](#quality-checks)
- [Operational notes](#operational-notes)

## Quick start: Docker + GHCR

Prerequisites: Docker Engine with Docker Compose v2. The GitHub Actions workflow publishes `ghcr.io/thijserven/prijsprofeet-mcp:latest` on pushes to `main` and also publishes immutable `sha-<commit>` tags.

```bash
git clone https://github.com/thijserven/prijsprofeet-mcp.git
cd prijsprofeet-mcp

# Required: protect the remote MCP endpoint.
export PRIJSPROFEET_MCP_AUTH_TOKEN="$(openssl rand -base64 32)"
export PRIJSPROFEET_MCP_BIND_ADDRESS="127.0.0.1:3000"
export PRIJSPROFEET_MCP_IMAGE="ghcr.io/thijserven/prijsprofeet-mcp:latest"

# Optional: required for PrijsProfeet Pro endpoints.
export PRIJSPROFEET_API_KEY=""

docker compose up --detach
curl --fail http://127.0.0.1:3000/health
```

The server is now available at `http://127.0.0.1:3000/mcp`. Authenticate every MCP request with `Authorization: Bearer <PRIJSPROFEET_MCP_AUTH_TOKEN>`.

For a production deployment, replace `:latest` with a reviewed immutable digest (or an immutable `sha-<commit>` tag). Do not expose the endpoint directly to the public internet; bind to loopback or a specific LAN address and put an access-controlled reverse proxy in front of it when remote access is required.

To stop it:

```bash
docker compose down
```

## Manual build

Use this path to build the image from the checked-out source rather than pulling GHCR.

```bash
git clone https://github.com/thijserven/prijsprofeet-mcp.git
cd prijsprofeet-mcp

export PRIJSPROFEET_MCP_AUTH_TOKEN="$(openssl rand -base64 32)"
export PRIJSPROFEET_MCP_BIND_ADDRESS="127.0.0.1:3000"
export PRIJSPROFEET_API_KEY="" # Optional; needed for Pro endpoints.

docker compose -f docker-compose.local.yaml up --build --detach
curl --fail http://127.0.0.1:3000/health
```

The local image is named `prijsprofeet-mcp:local`. Stop it with:

```bash
docker compose -f docker-compose.local.yaml down
```

## Development mode

Prerequisites: Node.js 22+ and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run dev` starts the **stdio** transport directly from TypeScript. stdout is reserved for the MCP protocol, so use an MCP client or the Inspector to interact with it. Add `PRIJSPROFEET_API_KEY` to `.env` only when you need Pro endpoints.

For the built stdio executable:

```bash
npm run build
node dist/index.js
```

## Connect an MCP client

### Streamable HTTP (Docker)

Configure an MCP client with:

```text
URL:     http://127.0.0.1:3000/mcp
Header:  Authorization: Bearer <your PRIJSPROFEET_MCP_AUTH_TOKEN>
```

`GET /health` is public; `/mcp` always requires the bearer token.

### stdio (local development or manual build)

Use the built entrypoint. The server reads `.env` from its current working directory, so set the client's working directory to the repository root or pass the environment explicitly.

```json
{
  "mcpServers": {
    "prijsprofeet": {
      "command": "node",
      "args": ["/absolute/path/to/prijsprofeet-mcp/dist/index.js"],
      "cwd": "/absolute/path/to/prijsprofeet-mcp"
    }
  }
}
```

## Capabilities

Every tool validates its input with Zod before an upstream request. Object responses are returned both as readable JSON text and as MCP `structuredContent`. Upstream HTTP errors and timeouts are returned as MCP tool errors.

| Area     | Tools                                                                                                                                                                            |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health   | `health_check`                                                                                                                                                                   |
| Products | `list_products`, `get_product`, `get_price_history`, `get_forecast`, `search_products_by_name`, `get_products_by_folder`, `get_products_by_retailer`, `get_promotional_products` |
| Search   | `search_products`, `get_categories`, `get_filter_stats`                                                                                                                          |
| Matching | `match_by_ean`, `match_product`, `compare_prices`, `get_ean_stats`                                                                                                               |
| Deals    | `get_top_deals`, `get_brand_deals`, `get_deals_summary`, `get_popular_deals`, `get_deals_by_type`, `get_new_deals`                                                               |
| Partner  | `get_partner_usage`                                                                                                                                                              |

### API-key requirements

Public product, search, deal, and category operations can run without an API key. A PrijsProfeet Pro key is required for `get_price_history`, `match_by_ean`, `match_product`, `compare_prices`, and `get_ean_stats`. `get_partner_usage` also requires a key.

The MCP tool metadata includes `_meta["nl.prijsprofeet/requiresProPlan"]` so compatible clients can identify Pro-only tools before calling them. Request a free key through the [PrijsProfeet API page](https://www.prijsprofeet.nl/api).

## Configuration

### API client

Set these variables in `.env` for local stdio use, or in the deployment environment for Docker. Never commit `.env`.

| Variable                  | Default                       | Purpose                                                 |
| ------------------------- | ----------------------------- | ------------------------------------------------------- |
| `PRIJSPROFEET_API_KEY`    | unset                         | Sent as `X-API-Key`; needed for Pro endpoints and usage |
| `PRIJSPROFEET_BASE_URL`   | `https://www.prijsprofeet.nl` | API origin; non-HTTPS is allowed only for localhost     |
| `PRIJSPROFEET_TIMEOUT_MS` | `15000`                       | Positive upstream request timeout in milliseconds       |
| `PRIJSPROFEET_USER_AGENT` | project default               | Identifies this integration to PrijsProfeet             |

### HTTP server (Docker)

| Variable                        | Required               | Purpose                                                                   |
| ------------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| `PRIJSPROFEET_MCP_AUTH_TOKEN`   | Yes                    | Bearer token required for `/mcp`                                          |
| `PRIJSPROFEET_MCP_BIND_ADDRESS` | Yes                    | Host address and port, for example `127.0.0.1:3000`                       |
| `PRIJSPROFEET_MCP_IMAGE`        | GHCR compose file only | Image reference, for example `ghcr.io/thijserven/prijsprofeet-mcp:latest` |
| `PRIJSPROFEET_MCP_HOST`         | No                     | Container bind host; defaults to `0.0.0.0`                                |
| `PRIJSPROFEET_MCP_PORT`         | No                     | Container port; defaults to `3000`                                        |

## Architecture

```text
stdio: src/index.ts ──────────────┐
                                   ├─ src/server.ts ─ src/tools/definitions.ts ─ PrijsProfeet API
HTTP:  src/http-entry.ts ─ src/http.ts ┘                    │
                                                             └─ Zod input schemas
```

- `src/tools/definitions.ts` is the deterministic tool catalog: endpoint paths, HTTP methods, argument mapping, metadata, and validation.
- `src/api/client.ts` owns URL construction, headers, JSON encoding, timeouts, and upstream-error translation. `src/config.ts` is the only environment-reading boundary.
- `src/server.ts` is transport-independent. `src/index.ts` hosts stdio; `src/http-entry.ts` hosts authenticated Streamable HTTP.

`dist/` is generated by `npm run build`; do not edit it directly.

## Quality checks

```bash
npm run check
npm pack --dry-run
```

`npm run check` formats-checks, lints, type-checks, runs unit/in-memory MCP/stdio handshake tests, and builds the project. Tests do not call the live PrijsProfeet API.

For interactive local inspection:

```bash
npm run inspect
```

The Inspector launches the built stdio server. Tool calls made there are live upstream calls and count toward PrijsProfeet rate limits.

## Operational notes

- Respect the [PrijsProfeet API terms](https://www.prijsprofeet.nl/api-voorwaarden), upstream rate limits, and anti-bot controls. This server does not bypass those controls and does not automatically retry requests, including `429` responses.
- Pricing matches are not automatically current offers. Before presenting a cheapest current price, check `is_current_deal`, `promotion_status`, `valid_from`, and `valid_until`; use `current_only: true` where a matching tool supports it.
- EAN matching is exact when an EAN exists. Name/brand/category matching is indicative, not proof of product identity. Dietary labels are indicative and not allergen information.

## References

- [Model Context Protocol documentation](https://modelcontextprotocol.io/)
- [PrijsProfeet API documentation](https://www.prijsprofeet.nl/docs)
- [PrijsProfeet API overview](https://www.prijsprofeet.nl/api)
- [PrijsProfeet API terms](https://www.prijsprofeet.nl/api-voorwaarden)
