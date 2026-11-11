import { createMcpHandler } from "@modelcontextprotocol/server";
import { createServer } from "./server.js";

/** Web-standard `{ fetch }` handler: stateless, one server per request. Serves both 2026 and 2025-era clients. */
export const mcpHandler = createMcpHandler(() => createServer(), {
  onerror: (e) => console.error("[seedwall-mcp]", e.message),
});
