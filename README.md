<img src="public/icon.svg" width="64" height="64" alt="Seedwall MCP icon">

# Seedwall MCP

Docs: **https://mcp.seedwall.suryansh.work**

[Seedwall](https://seedwall.suryansh.work) generative art inside Claude: hero and section backgrounds, OG images, banners, blog covers and wallpapers. Every image is a pure function of (look, preset, params, size, seed), so URLs are stable and safe to embed.

The repo has two parts, and both use the same MCP server:

- **A claude.ai connector**: a remote MCP server (Streamable HTTP) at `https://mcp.seedwall.suryansh.work/mcp`.
- **A Claude Code plugin** (`plugin/`): connects to that server and adds a `seedwall` skill. The skill reads your project's brand colours, picks a look, renders it, downloads the file into `public/` and wires it into your hero with responsive CSS, dark mode and a contrast check.

## Tools

| Tool | What |
| --- | --- |
| `list_looks` | Every look (generator) with its presets, plus themes and device sizes |
| `describe_look` | One look's params (colours with bg/fg/accent roles, density, text layer) and presets |
| `render` | Any look at any size. Returns SVG and PNG URLs, a studio link for editing, and a PNG preview the model can see |
| `seed` | A numbered seed (1–999999), or today's wallpaper |

All of them are read-only. The server is stateless and holds no data; rendering happens on Seedwall's public API (`/api/generators`, `/api/render`).

## Use it

**claude.ai**: Settings → Connectors → Add custom connector → `https://mcp.seedwall.suryansh.work/mcp`.

**Claude Code**:

```bash
claude plugin marketplace add Suryansh-Codes2209/seedwall-mcp
claude plugin install seedwall@seedwall
```

Then ask something like *"add a topographic hero background in our brand colours"*.

To use only the MCP server, without the skill: `claude mcp add --transport http seedwall https://mcp.seedwall.suryansh.work/mcp`.

## Develop

```bash
npm install
npm test                 # unit + in-process MCP protocol tests (2025 and 2026 protocol eras), Seedwall faked
npm run dev              # HTTP server on http://127.0.0.1:8787/mcp
npm run stdio            # stdio transport

# Live smoke test against a running Seedwall (e.g. `npm run dev` in ../Seedwall):
npm run build && SEEDWALL_URL=http://localhost:3000 npx tsx scripts/smoke.ts stdio
```

To point the plugin at a local server: `SEEDWALL_MCP_URL=http://127.0.0.1:8787/mcp claude --plugin-dir ./plugin`.

Environment:

- `SEEDWALL_URL`: the Seedwall instance to call (default `https://seedwall.suryansh.work`).
- `SEEDWALL_MCP_URL`: overrides the plugin's server URL.

## Deploy

The server deploys to Vercel as is: `api/mcp.ts` is the function, and `vercel.json` rewrites `/mcp` to it. Point the `mcp.seedwall.suryansh.work` domain at the project. It needs Seedwall's `/api/generators` and `/api/render` endpoints to be live.

## Privacy

The server stores nothing and has no accounts. Tool arguments (look, colours, size and so on) are forwarded to seedwall.suryansh.work to render the image, and standard hosting request logs apply. No personal data is collected.

## Licence

MIT
