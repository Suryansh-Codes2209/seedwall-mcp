import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it } from "vitest";
import { SeedwallClient } from "../src/seedwall.js";
import { createServer } from "../src/server.js";
import { fakeSeedwall } from "./fakeSeedwall.js";

type Content = { type: string; text?: string; data?: string; mimeType?: string }[];

const clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});

/** A real MCP client talking to the real HTTP handler in-process, with Seedwall faked. */
async function connect(mode: "legacy" | "auto" = "auto") {
  const sw = fakeSeedwall();
  const handler = createMcpHandler(() => createServer(new SeedwallClient("https://seedwall.test", sw.fetchImpl)));
  const transport = new StreamableHTTPClientTransport(new URL("http://mcp.test/mcp"), { fetch: (input, init) => handler.fetch(new Request(input, init)) });
  const client = new Client({ name: "test", version: "0" }, { versionNegotiation: { mode } });
  await client.connect(transport);
  clients.push(client);
  return { client, seen: sw.seen };
}

describe.each(["auto", "legacy"] as const)("MCP server (%s protocol)", (mode) => {
  it("lists the four read-only tools", async () => {
    const { client } = await connect(mode);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["describe_look", "list_looks", "render", "seed"]);
    expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
  });

  it("render returns URLs, a studio link and a PNG preview", async () => {
    const { client, seen } = await connect(mode);
    const r = await client.callTool({ name: "render", arguments: { look: "topographic", theme: "nord", width: 1600, height: 900, text_free: true, seed: 7, params: { bg: "#0b1020" } } });
    expect(r.isError).toBeFalsy();
    const content = r.content as Content;
    expect(content[0]?.text).toMatch(/SVG: https:\/\/seedwall\.suryansh\.work\/api\/render\?.*format=svg/);
    expect(content[0]?.text).toMatch(/Edit in studio: /);
    expect(content[1]).toMatchObject({ type: "image", mimeType: "image/png" });
    const req = seen.find((u) => u.pathname === "/api/render" && u.searchParams.get("format") === "json")!;
    expect(req.searchParams.get("t")).toBe("nord");
    expect(JSON.parse(Buffer.from(req.searchParams.get("x")!, "base64url").toString())).toEqual({ bg: "#0b1020", "text.none": true, seed: 7 });
  });

  it("render reports unknown looks as a tool error, not a crash", async () => {
    const { client } = await connect(mode);
    const r = await client.callTool({ name: "render", arguments: { look: "nope", preview: false } });
    expect(r.isError).toBe(true);
    expect((r.content as Content)[0]?.text).toMatch(/Unknown or missing generator/);
  });

  it("describe_look lists params and presets", async () => {
    const { client } = await connect(mode);
    const r = await client.callTool({ name: "describe_look", arguments: { look: "topographic" } });
    const text = (r.content as Content)[0]?.text ?? "";
    expect(text).toMatch(/levels: range 4–60/);
    expect(text).toMatch(/survey \(Survey\)/);
  });

  it("seed without a number uses today's seed", async () => {
    const { client } = await connect(mode);
    const r = await client.callTool({ name: "seed", arguments: { preview: false } });
    expect((r.content as Content)[0]?.text).toMatch(/^Seed 4242: topographic/);
  });
});
