/** A small client for Seedwall's public API. All rendering happens on seedwall.suryansh.work. */

export const DEFAULT_BASE_URL = "https://seedwall.suryansh.work";

export type ParamValue = string | number | boolean;

export interface ParamDef {
  kind: "color" | "select" | "text" | "range" | "seed" | "toggle";
  label: string;
  group?: string;
  help?: string;
  default: ParamValue;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  role?: "bg" | "fg" | "accent";
  maxLength?: number;
}

export interface Look {
  id: string;
  name: string;
  description: string;
  presets: { id: string; title: string; params: Record<string, ParamValue> }[];
  params: Record<string, ParamDef>;
}

export interface Catalogue {
  generators: Look[];
  themes: { id: string; name: string; bg: string; fg: string }[];
  devices: { id: string; label: string; w: number; h: number; kind: string }[];
}

export interface Rendered {
  gen: string;
  preset: string;
  size: { w: number; h: number };
  params: Record<string, ParamValue>;
  svg: string;
  png: string;
  studio: string;
}

export interface RenderRequest {
  generator: string;
  preset?: string;
  theme?: string;
  params?: Record<string, ParamValue>;
  width?: number;
  height?: number;
  device?: string;
}

/** base64url without padding — the encoding Seedwall's studio uses for the `x` param. */
export function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The /api/render query for a request (same keys as a /studio link, plus t for theme). */
export function renderQuery(r: RenderRequest): URLSearchParams {
  const q = new URLSearchParams({ g: r.generator });
  if (r.preset) q.set("p", r.preset);
  if (r.device) q.set("d", r.device);
  else if (r.width && r.height) {
    q.set("w", String(Math.round(r.width)));
    q.set("h", String(Math.round(r.height)));
  }
  if (r.params && Object.keys(r.params).length) q.set("x", b64url(JSON.stringify(r.params)));
  if (r.theme) q.set("t", r.theme);
  return q;
}

export class SeedwallError extends Error {}

export class SeedwallClient {
  private catalogue?: { at: number; data: Promise<Catalogue> };

  constructor(
    readonly baseUrl: string = process.env.SEEDWALL_URL ?? DEFAULT_BASE_URL,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private url(path: string): string {
    return new URL(path, this.baseUrl).toString();
  }

  private async get(path: string): Promise<Response> {
    const res = await this.fetchImpl(this.url(path), { headers: { "User-Agent": "seedwall-mcp" } });
    if (!res.ok) throw new SeedwallError((await res.text().catch(() => "")) || `Seedwall returned ${res.status} for ${path}`);
    return res;
  }

  /** The generator catalogue, cached for an hour. */
  catalog(): Promise<Catalogue> {
    if (!this.catalogue || Date.now() - this.catalogue.at > 3_600_000) {
      const data = this.get("/api/generators").then((r) => r.json() as Promise<Catalogue>);
      data.catch(() => (this.catalogue = undefined));
      this.catalogue = { at: Date.now(), data };
    }
    return this.catalogue.data;
  }

  async render(r: RenderRequest): Promise<Rendered> {
    const q = renderQuery(r);
    q.set("format", "json");
    return (await this.get(`/api/render?${q}`)).json() as Promise<Rendered>;
  }

  /** A seed wallpaper (or today's when seed is omitted), with image URLs at the requested size. */
  async seed(seed: number | undefined, size: { w: number; h: number }): Promise<{ seed: number; gen: string; preset: string; page: string; png: string; svg: string }> {
    const wh = `w=${size.w}&h=${size.h}`;
    let s = seed;
    if (s === undefined) s = ((await (await this.get("/api/daily?format=json")).json()) as { seed: number }).seed;
    const info = (await (await this.get(`/api/s/${s}?format=json`)).json()) as { gen: string; preset: string };
    return {
      seed: s,
      gen: info.gen,
      preset: info.preset,
      page: this.url(`/s/${s}`),
      png: this.url(`/api/s/${s}?${wh}`),
      svg: this.url(`/api/s/${s}?${wh}&format=svg`),
    };
  }

  /** A small PNG of any image URL on the API, base64-encoded, for the model to look at. */
  async preview(imageUrl: string, maxSide = 640): Promise<string> {
    const u = new URL(imageUrl);
    const w = Number(u.searchParams.get("w")) || 1600;
    const h = Number(u.searchParams.get("h")) || 900;
    const k = Math.min(1, maxSide / Math.max(w, h));
    u.searchParams.delete("d");
    u.searchParams.set("w", String(Math.max(16, Math.round(w * k))));
    u.searchParams.set("h", String(Math.max(16, Math.round(h * k))));
    u.searchParams.delete("format");
    const res = await this.get(u.pathname + u.search);
    return Buffer.from(await res.arrayBuffer()).toString("base64");
  }
}
