import "dotenv/config";

import { createServer } from "node:http";

import { loadHttpConfig } from "./config.js";
import { createHttpServer } from "./http.js";

const config = loadHttpConfig();
const server = createServer(createHttpServer({ authToken: config.authToken }));

server.on("error", (error) => {
  console.error("MCP HTTP server failed", error);
  process.exitCode = 1;
});

server.listen(config.port, config.host, () => {
  console.error(
    `MCP HTTP server listening on ${config.host}:${String(config.port)}`,
  );
});
