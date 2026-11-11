---
name: seedwall
description: Add Seedwall generative art to a project — a hero or section background, an OG/social image, a README or email banner, a 404 illustration, a blog cover, or a wallpaper. Use when the user asks for a generative, patterned, topographic, gradient, grid, circuit or similar background or cover image, or mentions Seedwall.
---

# Seedwall in a project

Seedwall renders generative art as SVG or PNG through the `seedwall` MCP tools. Every image is a pure function of (look, preset, params, size, seed), so a URL always gives the same image.

Tools: `list_looks`, `describe_look`, `render`, `seed`.

## 1. Read the project before choosing anything

- Find the framework and the component that owns the target section (hero, header, card, 404 page…). Find where static assets live (`public/` for Next.js, Vite and Astro; `static/` for SvelteKit and Hugo).
- Find the brand colours: Tailwind config or `@theme` tokens, CSS custom properties (`:root { --… }`), or the design-system file. Note the background colour and one or two accents, plus the dark-mode values if the site has a dark mode.
- Note what sits on top of the art (headline, buttons) and where it sits, so the art stays calm there.

## 2. Pick a look and render it

1. Call `list_looks`. Match the look to the site's tone. Quiet and textured: `topographic`, `wave-lines`, `mesh-gradient`, `aurora`, `marble`. Technical: `blueprint`, `circuit`, `cutting-mat`, `truchet`. Playful: `geometric`, `halftone`, `pixel-dither`, `spirograph`, `seed-head`. Showpieces that carry a hero on their own: `event-horizon` (a black hole), `attractor` (a strange attractor), `cymatics` (sand patterns from sound), `quasicrystal`, `op-art`. Showpieces draw the eye, so keep headlines beside or below the subject rather than over it.
2. Call `describe_look` to see the colour params and their roles (`bg`, `fg`, `accent`).
3. Call `render` with:
   - `text_free: true` for anything that sits behind the page's own content. Text is only for wallpapers and standalone covers.
   - The brand colours as `params` (map `bg`-role params to the page background, `accent`-role params to brand accents). Use `theme` only when the user asks for an editor theme.
   - A size matching the slot: 1920×1080 for a full-width hero, 2400×1000 for a wide banner, 1200×630 for OG images, 1280×640 for a GitHub social preview, 1500×500 for a README banner.
   - Lower density or contrast than you would for a wallpaper, since headlines need to stay readable on top.
4. Look at the preview the tool returns. If the art is busy where the headline goes, or the contrast is wrong, adjust params and render again. Two or three rounds is normal. Show the user the final preview and the studio link so they can fine-tune it themselves.

## 3. Put it in the project

Download the file into the repo rather than hotlinking, so the site doesn't depend on Seedwall being up:

```bash
mkdir -p public/seedwall
curl -fsSL "<svg url from render>" -o public/seedwall/hero.svg
wc -c public/seedwall/hero.svg
```

- **SVG** is the default: it scales cleanly. If it is over ~300 KB (dense looks like `flow-field`, `halftone` or `code-city` can be), use the PNG URL instead, and convert it to WebP/AVIF if the project already has an image pipeline (`next/image`, `astro:assets`, sharp).
- Write a comment above the background rule with the studio link, so anyone can regenerate or tweak the art later.

### Wiring a background

Decorative art goes in CSS, or as an `<img alt="" aria-hidden="true">`, never as content. Make it cover the section at any width:

```css
.hero {
  position: relative;
  isolation: isolate;
  /* Seedwall: <studio link> */
  background: var(--hero-bg, #0b1020) url("/seedwall/hero.svg") center / cover no-repeat;
}
/* Optional: a scrim for headline contrast */
.hero::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(to bottom, rgb(0 0 0 / 0.35), transparent 70%);
}
```

Tailwind: `bg-[url('/seedwall/hero.svg')] bg-cover bg-center`. For Next.js with `next/image`, use `fill`, `className="object-cover -z-10"`, `alt=""` and `priority` for an above-the-fold hero.

- **Dark mode**: render a second variant with the dark palette (same look and seed, so it matches) and switch on `prefers-color-scheme` or the site's theme class.
- **Mobile**: `cover` crops the sides on narrow screens. If the composition matters, render a portrait 1080×1920 variant and swap it in with a media query or `<picture>`.
- **Contrast**: check that the headline over the art still meets WCAG AA (4.5:1 for body text, 3:1 for large text). Add a scrim or lower the art's contrast if it doesn't.

## Other uses

| Use | How |
| --- | --- |
| OG / social image per page | One render per page at 1200×630, with the page slug hashed to a seed so every page gets its own stable image. For dynamic generation, point `og:image` at the PNG URL. |
| README or docs banner | Render 1500×500, download it into the repo, and reference it with a relative path. |
| Section dividers, cards, empty states | Small renders with `text_free: true`, low-contrast params, and the same look across the site for consistency. |
| 404 / error page | A full-bleed render, with text on if a quote fits the tone. |
| Wallpapers for the user | Use a `device` id, or `seed` for "surprise me" / today's wallpaper. |

## Don'ts

- Don't paste a large SVG inline into a component. Reference the file.
- Don't hotlink the API URL in production unless the user asks to (for example, for a daily-changing image).
- Don't put the art behind text without checking contrast.
