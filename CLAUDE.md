# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (Astro)
npm run build    # Build for production
npm run preview  # Preview production build locally
npm start        # Serve built site via Node.js (for Railway deployment)
npm run validate:notes # Validate bilingual pairs, citations, and diagram safety
npm run notes:status   # Show every work phase, blockers, and exact next command
npm run notes:context -- --key <key> --format md # Compact evidence + work context
npm run notes:sync-research # Sync Brain ResearchPacket digests when available
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
- `src/content/publications/` - One non-localized PublicationWork manifest per bilingual work
- `src/content/diagrams/` - Typed, localized DiagramSpecs; the semantic visual source of truth
- `src/content/sources/` - Canonical source registry; citations reference these IDs
- `src/components/notes/` - Fixed, audited component vocabulary for long-form notes
- `scripts/notes/` - Scaffolding, validation, and explicit publish-state commands

**Key Patterns:**
- Astro components (`.astro`) are used for static page sections
- React components (`.tsx`) with `client:load` directive are used for interactive/animated elements
- Framer Motion is configured as SSR-external in `astro.config.mjs`
- The entire portfolio uses the shared light/dark tokens in `src/styles/global.css`; light is the deterministic default.
- `ThemeToggle.astro` sets `data-theme` on `<html>` and persists the explicit choice under `lucas-color-theme`.
- The homepage hero queries the newest published English research note at build time and links its Spanish translation when available; never hard-code a featured-note slug.
- New UI must use the shared theme variables for surfaces, text, borders, shadows, and accents instead of hard-coded dark-only colors.

## Agent-native publishing contract

- Spanish is the editorial master. English is an adaptation, not an independently improvised article.
- Every `translationKey` has one `src/content/publications/<translationKey>.json` manifest plus exactly one `es` and one `en` MDX edition.
- Shared identity and lifecycle fields live only in PublicationWork: `kind`, stable `issue`, topics, related works, source roles, edition slugs, visuals, research digest, approvals, visibility, and publication date.
- Localized MDX owns only language-specific title, description, SEO copy, update date, tags, and prose. Never duplicate shared state into MDX frontmatter.
- New work starts with `visibility: draft`. Drafts appear in development and are excluded from production builds unless `INCLUDE_DRAFTS=true` is explicitly set.
- Use `kind: single` for one primary paper, `kind: synthesis` when the answer genuinely depends on several sources, and `kind: essay` when Lucas's thesis supplies the narrative spine and sources support, bound, or challenge it.
- Sources may be papers, datasets, official docs, articles, or talks; register the canonical public object once and keep exact-version or access-date provenance in Lucas Brain.
- Register every source once in `src/content/sources/`; cite claims inline with `<Cite source="source-id" locator="section/page" />`.
- MDX may import only `Cite`, `Callout`, `MyTake`, and `NoteFigure` from `src/components/notes/`. Do not add raw scripts, event handlers, or unreviewed HTML.
- Each work has 2–4 `DiagramSpec` JSON records. Every diagram states a question, takeaway, semantic items/edges, ES/EN copy, accessible alt/caption, and `claimRefs` into its Brain ResearchPacket. Optional localized `artwork` points at a curated SVG presentation of that exact meaning.
- DiagramSpec remains the semantic source; artwork is a digest-bound presentation layer, never a place for unsupported claims. The article displays curated SVG when available and a build-time Mermaid→SVG fallback otherwise. The deterministic 1200×675 PNG and homepage thumbnail rasterize that same SVG.
- Canonical Markdown always includes an editable, themed Mermaid block for every diagram in addition to the PNG fallback. Each figure exposes Copy Mermaid, open-large, SVG, and PNG actions.
- Do not introduce a client diagram renderer. `beautiful-mermaid` is build-time only; reader-side JavaScript is limited to progressive actions such as robust clipboard copy.
- Clearly separate what the source claims, what its evidence establishes, what remains unknown, and Lucas's interpretation.
- Keep the visible AI-assistance disclosure. Lucas retains editorial responsibility.
- Localized public routes are `/es/notas/<slug>/` and `/en/notes/<slug>/`; preserve self-canonicals, reciprocal `hreflang`, and the translated route switch.
- Every published edition also has `/index.md`; `/llms.txt`, `/notes/manifest.json`, and localized RSS list published work only. Markdown must be self-contained, use absolute public URLs, expand diagrams semantically, and contain no private paths or unresolved MDX.

## Lifecycle and authority

The phase is derived, not manually narrated:

```text
awaiting-angle → drafting → review-ready → approved → published
```

- Lucas is required only at the angle gate and release gate. Agents own research, drafting, adaptation, rendering, and mechanical validation inside those decisions.
- `notes:approve-angle` records reader promise, thesis, and counterpoint.
- `notes:approve-release` binds Lucas's review to the exact digest of PublicationWork, both MDX files, DiagramSpecs, curated SVG bytes, and source records. Any semantic or artwork change makes that approval stale.
- `notes:publish` is one atomic manifest transition. It never commits, pushes, deploys, or sends external messages.
- `notes:status` is the control-plane entrypoint. Do not infer state from scattered files; read its phase, blockers, artifact list, and exact next command.
- Brain ResearchPackets are private build-time provenance. Portfolio builds remain portable when Brain is absent; local full validation sets `REQUIRE_RESEARCH_PACKETS=true`.

## Note workflow and safety

1. Archive/ingest the exact source in Brain and generate its ResearchPacket.
2. Scaffold idempotently, sync research, then stop at the angle gate.
3. Write Spanish, adapt English, define DiagramSpecs, and validate progressively: `structure` → `editorial` → `render`.
4. Preview locally and stop at the release gate.
5. Record byte-bound approval, then perform the atomic publish transition only if Lucas explicitly asked.
6. Build, commit, push, deploy, and production smoke are separate steps with separate authority.

The complete architecture, dependency graph, HTTP surface, validation tiers, and recovery rules live in `docs/agent-native-publishing.md`.
