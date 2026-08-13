import { chmod } from "node:fs/promises";

await chmod(new URL("../dist/index.js", import.meta.url), 0o755);
await chmod(new URL("../dist/http-entry.js", import.meta.url), 0o755);
