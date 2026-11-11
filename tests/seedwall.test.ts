import { describe, expect, it } from "vitest";
import { SeedwallClient, b64url, renderQuery } from "../src/seedwall.js";
import { fakeSeedwall } from "./fakeSeedwall.js";

describe("renderQuery", () => {
  it("uses the studio's keys and base64url JSON for params", () => {
    const q = renderQuery({ generator: "topographic", preset: "survey", theme: "nord", width: 1600, height: 900, params: { "text.none": true, bg: "#000000" } });
    expect(q.get("g")).toBe("topographic");
    expect(q.get("p")).toBe("survey");
    expect(q.get("t")).toBe("nord");
    expect([q.get("w"), q.get("h")]).toEqual(["1600", "900"]);
    expect(JSON.parse(Buffer.from(q.get("x")!, "base64url").toString())).toEqual({ "text.none": true, bg: "#000000" });
  });
  it("prefers a device over width/height and omits empty params", () => {
    const q = renderQuery({ generator: "aurora", device: "iphone", width: 10, height: 10, params: {} });
    expect(q.get("d")).toBe("iphone");
    expect(q.has("w") || q.has("x")).toBe(false);
  });
  it("encodes unicode the way the studio decodes it (no padding, url-safe)", () => {
    const s = b64url(JSON.stringify({ "text.line1": "Rosé *ünïcode* ✓??>>" }));
    expect(s).not.toMatch(/[+/=]/);
    expect(JSON.parse(Buffer.from(s, "base64url").toString("utf8"))["text.line1"]).toBe("Rosé *ünïcode* ✓??>>");
  });
});

describe("SeedwallClient", () => {
  it("caches the catalogue", async () => {
    const { fetchImpl, seen } = fakeSeedwall();
    const c = new SeedwallClient("https://example.test", fetchImpl);
    await c.catalog();
    await c.catalog();
    expect(seen.filter((u) => u.pathname === "/api/generators")).toHaveLength(1);
  });
  it("previews against its own base URL at a small size, keeping the aspect ratio", async () => {
    const { fetchImpl, seen } = fakeSeedwall();
    const c = new SeedwallClient("http://localhost:3000", fetchImpl);
    await c.preview("https://seedwall.suryansh.work/api/render?g=x&w=3200&h=1600&format=svg");
    const u = seen.at(-1)!;
    expect(u.host).toBe("localhost:3000");
    expect([u.searchParams.get("w"), u.searchParams.get("h"), u.searchParams.get("format")]).toEqual(["640", "320", null]);
  });
  it("surfaces Seedwall's error text", async () => {
    const { fetchImpl } = fakeSeedwall();
    await expect(new SeedwallClient("https://example.test", fetchImpl).render({ generator: "nope" })).rejects.toThrow(/Unknown or missing generator/);
  });
});
