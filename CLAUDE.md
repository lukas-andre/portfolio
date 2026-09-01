# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (Astro)
npm run build    # Build for production
npm run preview  # Preview production build locally
npm start        # Serve built site via Node.js (for Railway deployment)
npm run validate:notes # Validate bilingual pairs, citations, and diagram safety
npm run check    # Astro + TypeScript diagnostics
npm run test:unit # Validator and static-server tests
npm run test:e2e # Desktop + mobile Chromium smoke tests
npm run verify   # Editorial validation, types, unit tests, and production build
```

## Architecture

This is a personal portfolio built with Astro and React.

**Tech Stack:**
- Astro 4.x as static site generator
- React 18 for interactive components
- Framer Motion for animations
- TypeScript

**Project Structure:**
- `src/pages/index.astro` - Single-page layout composing all sections
- `src/layouts/Layout.astro` - Base HTML layout with boot screen, scroll progress, and visual overlays
- `src/components/*.astro` - Page sections (Hero, About, Skills, Experience, Demos, AISection, Contact, Footer, Navigation)
- `src/components/ui/*.tsx` - React UI components with animations (GlitchText, TypeWriter, BootScreen, NeuralCanvas, etc.)
- `src/styles/global.css` - Global styles
- `server.js` - Simple Node.js static file server for Railway deployment
- `src/content/notes/{es,en}/` - Bilingual MDX research notes
- `src/content/sources/` - Canonical source registry; citations reference these IDs
- `src/components/notes/` - Fixed, audited component vocabulary for long-form notes
- `scripts/notes/` - Scaffolding, validation, and explicit publish-state commands

**Key Patterns:**
- Astro components (`.astro`) are used for static page sections
- React components (`.tsx`) with `client:load` directive are used for interactive/animated elements
- Framer Motion is configured as SSR-external in `astro.config.mjs`

## Research notes contract

- Spanish is the editorial master. English is an adaptation, not an independently improvised article.
- Every `translationKey` has exactly one `es` and one `en` entry with matching `kind`, sources, and draft state.
- New work stays `draft: true`. Drafts appear in local development and are excluded from production builds unless `INCLUDE_DRAFTS=true` is explicitly set.
- Use `kind: single` for one primary paper and `kind: synthesis` when the argument genuinely depends on several sources.
- Register every source once in `src/content/sources/`; cite claims inline with `<Cite source="source-id" locator="section/page" />`.
- MDX may import only `Cite`, `Callout`, `MyTake`, and `NoteFigure` from `src/components/notes/`. Do not add raw scripts, event handlers, or unreviewed HTML.
- Each localized entry must render 2–4 localized, static SVG diagrams from `public/images/notes/`. SVGs need `<title>` and `<desc>` and must not contain scripts, `foreignObject`, inline handlers, or external resources.
- Clearly separate what the source claims, what its evidence establishes, what remains unknown, and Lucas's interpretation.
- Keep the visible AI-assistance disclosure. Lucas retains editorial responsibility.
- Localized public routes are `/es/notas/<slug>/` and `/en/notes/<slug>/`; preserve self-canonicals, reciprocal `hreflang`, and the translated route switch.

## Note workflow and safety

1. Archive the exact source/version outside this repository and agree on the editorial angle.
2. Register sources and create the bilingual draft pair (`npm run notes:new -- ...` is optional scaffolding).
3. Write Spanish first, adapt to English, create localized diagrams, and run `npm run verify` plus `npm run test:e2e`.
4. Preview locally and stop for Lucas's final editorial approval.
5. Only after explicit approval, run `npm run notes:publish -- --key <translation-key> --confirm-reviewed`.

The workflow never commits, pushes, deploys, or changes a draft to published without a separate explicit instruction. The publish command only changes frontmatter; deployment remains an independent action.
