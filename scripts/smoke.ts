/**
 * Live check against a real Seedwall: npx tsx scripts/smoke.ts [stdio|http] 
 *   SEEDWALL_URL=http://localhost:3000 for a local Seedwall; MCP_URL for http mode (default http://127.0.0.1:8787/mcp).
 */
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { writeFileSync } from "node:fs";

const mode = process.argv[2] ?? "stdio";
const transport =
  mode === "http"
    ? new StreamableHTTPClientTransport(new URL(process.env.MCP_URL ?? "http://127.0.0.1:8787/mcp"))
    : new StdioClientTransport({ command: "node", args: ["dist/stdio.js"], env: { ...process.env } as Record<string, string> });
const client = new Client({ name: "smoke", version: "0" }, { versionNegotiation: { mode: "auto" } });
await client.connect(transport);

const list = await client.callTool({ name: "list_looks", arguments: {} });
const looks = (list.structuredContent as { looks: { id: string }[] }).looks;
console.log(`list_looks: ${looks.length} looks (${looks.map((l) => l.id).join(", ")})`);

const r = await client.callTool({ name: "render", arguments: { look: "topographic", theme: "nord", width: 1600, height: 900, text_free: true } });
const content = r.content as { type: string; text?: string; data?: string }[];
console.log(content[0]?.text);
const img = content.find((c) => c.type === "image");
if (img?.data) {
  const out = process.env.SMOKE_OUT ?? "smoke-preview.png";
  writeFileSync(out, Buffer.from(img.data, "base64"));
  console.log(`preview: ${out} (${img.data.length} b64 chars)`);
}
const s = await client.callTool({ name: "seed", arguments: { preview: false } });
console.log((s.content as { text: string }[])[0]?.text);
await client.close();
