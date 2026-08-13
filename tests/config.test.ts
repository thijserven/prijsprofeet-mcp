import { describe, expect, it } from "vitest";

import { loadHttpConfig } from "../src/config.js";

describe("HTTP configuration", () => {
  it("requires a bearer token and validates the bind address and port", () => {
    expect(() => loadHttpConfig({})).toThrow("PRIJSPROFEET_MCP_AUTH_TOKEN");
    expect(() =>
      loadHttpConfig({
        PRIJSPROFEET_MCP_AUTH_TOKEN: "token",
        PRIJSPROFEET_MCP_PORT: "0",
      }),
    ).toThrow("PRIJSPROFEET_MCP_PORT");
    expect(() =>
      loadHttpConfig({
        PRIJSPROFEET_MCP_AUTH_TOKEN: "token",
        PRIJSPROFEET_MCP_HOST: "0.0.0.0",
      }),
    ).not.toThrow();
  });
});
