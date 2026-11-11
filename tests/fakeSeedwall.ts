import type { Catalogue } from "../src/seedwall.js";

export const CATALOGUE: Catalogue = {
  generators: [
    {
      id: "topographic",
      name: "Topographic",
      description: "Contour lines.",
      presets: [{ id: "survey", title: "Survey", params: { levels: 22 } }],
      params: {
        bg: { kind: "color", label: "Background", default: "#101820", role: "bg" },
        levels: { kind: "range", label: "Levels", default: 18, min: 4, max: 60, step: 1 },
        "text.none": { kind: "toggle", label: "No text", default: false },
      },
    },
  ],
  themes: [{ id: "nord", name: "Nord", bg: "#2e3440", fg: "#eceff4" }],
  devices: [{ id: "1080p", label: "1080p", w: 1920, h: 1080, kind: "desktop" }],
};

/** 1×1 transparent PNG. */
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

/** A fetch that answers like seedwall.suryansh.work, and records every URL it saw. */
export function fakeSeedwall() {
  const seen: URL[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const u = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    seen.push(u);
    const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { "Content-Type": "application/json" } });
    if (u.pathname === "/api/generators") return json(CATALOGUE);
    if (u.pathname === "/api/daily") return json({ seed: 4242 });
    if (u.pathname.startsWith("/api/s/") && u.searchParams.get("format") === "json") return json({ gen: "topographic", preset: "survey" });
    if (u.pathname === "/api/render" && u.searchParams.get("format") === "json") {
      if (u.searchParams.get("g") !== "topographic") return new Response("Unknown or missing generator (?g=)", { status: 404 });
      const x = u.searchParams.get("x");
      const params = x ? JSON.parse(Buffer.from(x, "base64url").toString("utf8")) : {};
      const w = Number(u.searchParams.get("w") || 1920), h = Number(u.searchParams.get("h") || 1080);
      const q = `g=topographic&p=survey&w=${w}&h=${h}`;
      return json({ gen: "topographic", preset: "survey", size: { w, h }, params, svg: `https://seedwall.suryansh.work/api/render?${q}&format=svg`, png: `https://seedwall.suryansh.work/api/render?${q}`, studio: `https://seedwall.suryansh.work/studio?${q}` });
    }
    return new Response(new Uint8Array(PNG), { headers: { "Content-Type": "image/png" } });
  }) as typeof fetch;
  return { fetchImpl, seen };
}
