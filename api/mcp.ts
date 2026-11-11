import { mcpHandler } from "../src/handler.js";

/** Vercel function. vercel.json rewrites /mcp here, so the connector URL is https://<host>/mcp */
export const GET = (req: Request) => mcpHandler.fetch(req);
export const POST = (req: Request) => mcpHandler.fetch(req);
export const DELETE = (req: Request) => mcpHandler.fetch(req);
