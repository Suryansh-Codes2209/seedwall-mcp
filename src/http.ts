import { createServer as createHttpServer } from "node:http";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { mcpHandler } from "./handler.js";

/** Local HTTP server for development: http://localhost:8787/mcp */
const port = Number(process.env.PORT ?? 8787);
const handle = toNodeHandler(mcpHandler);

createHttpServer((req, res) => {
  const path = new URL(req.url ?? "/", "http://x").pathname;
  if (path === "/mcp") return void handle(req, res);
  if (path === "/" || path === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" }).end("Seedwall MCP server. Connect to /mcp\n");
    return;
  }
  res.writeHead(404).end();
}).listen(port, "127.0.0.1", () => console.error(`seedwall-mcp listening on http://127.0.0.1:${port}/mcp`));
