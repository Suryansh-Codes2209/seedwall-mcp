import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { SeedwallClient, SeedwallError, type Look } from "./seedwall.js";

export const VERSION = "0.1.0";

const INSTRUCTIONS = `Seedwall makes deterministic generative art (wallpapers, hero backgrounds, banners, cover images) as SVG or PNG.
Every image is a pure function of (look, preset, params, size, seed): the same inputs always give the same image, so URLs are stable and safe to embed.
Workflow: list_looks to choose a look → describe_look for its params (colours, density, text) → render to get image URLs and a preview.
For website backgrounds, pass text_free: true (the page puts its own headline on top) and the page's brand colours as params.`;

const READ_ONLY = { readOnlyHint: true, openWorldHint: true, idempotentHint: true } as const;

const paramValue = z.union([z.string(), z.number(), z.boolean()]);

function fail(e: unknown) {
  const msg = e instanceof SeedwallError ? e.message : `Seedwall request failed: ${e instanceof Error ? e.message : String(e)}`;
  return { isError: true, content: [{ type: "text" as const, text: msg }] };
}

function summarizeParam(key: string, d: Look["params"][string]): string {
  const range = d.kind === "range" ? ` ${d.min}–${d.max}` : "";
  const opts = d.options ? ` [${d.options.map((o) => o.value).join(", ")}]` : "";
  const role = d.role ? ` (role: ${d.role})` : "";
  return `- ${key}: ${d.kind}${range}${opts}${role}, default ${JSON.stringify(d.default)} — ${d.label}${d.help ? `. ${d.help}` : ""}`;
}

/** Builds a fresh server. Stateless, so the HTTP handler can make one per request. */
export function createServer(client = new SeedwallClient()): McpServer {
  const server = new McpServer({ name: "seedwall", title: "Seedwall", version: VERSION }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "list_looks",
    {
      title: "List Seedwall looks",
      description: "Lists every Seedwall look (generator) with its presets, plus the colour themes and device sizes you can render with. Call this first to pick a look.",
      inputSchema: z.object({}),
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const c = await client.catalog();
        const looks = c.generators.map((g) => `- ${g.id} (${g.name}): ${g.description}\n  presets: ${g.presets.map((p) => p.id).join(", ")}`).join("\n");
        const themes = c.themes.map((t) => `${t.id} (bg ${t.bg}, fg ${t.fg})`).join(", ");
        const devices = c.devices.map((d) => `${d.id} ${d.w}×${d.h}`).join(", ");
        return {
          content: [{ type: "text", text: `Looks:\n${looks}\n\nThemes (recolour any look): ${themes}\n\nDevices: ${devices}` }],
          structuredContent: {
            looks: c.generators.map((g) => ({ id: g.id, name: g.name, description: g.description, presets: g.presets.map((p) => ({ id: p.id, title: p.title })) })),
            themes: c.themes,
            devices: c.devices,
          },
        };
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "describe_look",
    {
      title: "Describe a Seedwall look",
      description: "Shows one look's parameters (colours, shapes, density, text layer) and its presets, so you can set params when rendering.",
      inputSchema: z.object({ look: z.string().describe("Look id from list_looks, e.g. topographic") }),
      annotations: READ_ONLY,
    },
    async ({ look }) => {
      try {
        const c = await client.catalog();
        const g = c.generators.find((x) => x.id === look);
        if (!g) return fail(new SeedwallError(`No look called "${look}". Options: ${c.generators.map((x) => x.id).join(", ")}`));
        const params = Object.entries(g.params).map(([k, d]) => summarizeParam(k, d)).join("\n");
        const presets = g.presets.map((p) => `- ${p.id} (${p.title}): ${JSON.stringify(p.params)}`).join("\n");
        return {
          content: [{ type: "text", text: `${g.name} (${g.id}): ${g.description}\n\nParams:\n${params}\n\nPresets (overrides on the defaults):\n${presets}\n\nColours are #rrggbb. Set text.none: true for no text. Wrap words in *stars* for italics.` }],
          structuredContent: { look: g },
        };
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "render",
    {
      title: "Render a Seedwall image",
      description:
        "Renders a look at any size and returns stable SVG and PNG URLs, a link to keep editing it in the Seedwall studio, and a small preview image. " +
        "Use it for website heroes, section backgrounds, OG/social images, banners, blog covers, or wallpapers.",
      inputSchema: z.object({
        look: z.string().describe("Look id from list_looks"),
        preset: z.string().optional().describe("Preset id; defaults to the look's first preset"),
        theme: z.string().optional().describe("Recolour with a syntax theme id from list_looks (e.g. nord, dracula, github-light)"),
        params: z.record(z.string(), paramValue).optional().describe("Param overrides from describe_look, e.g. {\"bg\":\"#0b1020\",\"levels\":30}. Invalid values are ignored."),
        width: z.number().int().min(16).max(6144).optional().describe("Pixels; default 1920"),
        height: z.number().int().min(16).max(6144).optional().describe("Pixels; default 1080"),
        device: z.string().optional().describe("Device id from list_looks instead of width/height"),
        text_free: z.boolean().optional().describe("Hide the look's built-in text. Use true for backgrounds that sit behind your own content."),
        seed: z.number().int().min(0).max(999999).optional().describe("Varies the random layout while keeping the look; same seed = same image"),
        preview: z.boolean().default(true).describe("Include a small PNG preview in the result"),
      }),
      annotations: READ_ONLY,
    },
    async (a) => {
      try {
        const params = { ...a.params };
        if (a.text_free !== undefined) params["text.none"] = a.text_free;
        if (a.seed !== undefined) params.seed = a.seed;
        const r = await client.render({
          generator: a.look,
          preset: a.preset,
          theme: a.theme,
          params,
          device: a.device,
          width: a.device ? undefined : (a.width ?? 1920),
          height: a.device ? undefined : (a.height ?? 1080),
        });
        const text = [
          `Rendered ${r.gen} / ${r.preset} at ${r.size.w}×${r.size.h}.`,
          `SVG: ${r.svg}`,
          `PNG: ${r.png}`,
          `Edit in studio: ${r.studio}`,
          `Resolved params: ${JSON.stringify(r.params)}`,
        ].join("\n");
        const content: ({ type: "text"; text: string } | { type: "image"; data: string; mimeType: string })[] = [{ type: "text", text }];
        if (a.preview) content.push({ type: "image", data: await client.preview(r.png), mimeType: "image/png" });
        return { content, structuredContent: { ...r } };
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "seed",
    {
      title: "Seedwall by seed (or today's)",
      description: "Every number from 1 to 999999 is one fixed Seedwall image, the same for everyone. Omit seed for today's daily wallpaper. Good for 'surprise me'.",
      inputSchema: z.object({
        seed: z.number().int().min(1).max(999999).optional().describe("Omit for today's seed"),
        width: z.number().int().min(16).max(6144).default(1920),
        height: z.number().int().min(16).max(6144).default(1080),
        preview: z.boolean().default(true),
      }),
      annotations: READ_ONLY,
    },
    async ({ seed, width, height, preview }) => {
      try {
        const s = await client.seed(seed, { w: width, h: height });
        const text = `Seed ${s.seed}: ${s.gen} / ${s.preset}\nPage: ${s.page}\nSVG: ${s.svg}\nPNG: ${s.png}`;
        const content: ({ type: "text"; text: string } | { type: "image"; data: string; mimeType: string })[] = [{ type: "text", text }];
        if (preview) content.push({ type: "image", data: await client.preview(s.png), mimeType: "image/png" });
        return { content, structuredContent: { ...s } };
      } catch (e) {
        return fail(e);
      }
    },
  );

  return server;
}
