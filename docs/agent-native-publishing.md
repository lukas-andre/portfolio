# Agent-native publishing system

Status: implemented architecture contract · 2026-09-03

## Purpose

This portfolio is a small publication compiler, not a folder of blog posts. Its job is to transform
versioned evidence and two human editorial decisions into one coherent set of human-readable and
machine-readable artifacts. The system should let an agent answer four questions cheaply and exactly:

1. What is true about this work now?
2. What evidence supports each public claim and visual?
3. What is the next valid transition?
4. Which artifacts must change together?

The answer to each question has one canonical surface. Agents should not reconstruct state from prose,
guess from filenames, or keep parallel representations synchronized by hand.

## Tower of abstractions

```text
L0  immutable source objects in Lucas Brain/raw
 │  exact bytes, version, URL, acquisition metadata
 ▼
L1  ResearchPacket in Lucas Brain/library/paper-to-portfolio/works
 │  numbered claims, locators, boundaries, source-object hashes
 ▼
L2  PublicationWork in src/content/publications
 │  stable identity, issue, kind, topics, source roles, routes, gates, visibility
 ├──────────────────────────────┐
 ▼                              ▼
L3 localized MDX editions       L3 DiagramSpecs
   ES master + EN adaptation       semantic model + localized copy + claimRefs
 └───────────────┬──────────────┘
                 ▼
L4 deterministic compiler
   curated/static SVG · canonical Markdown + Mermaid · diagram PNG · OG PNG
                 ▼
L5 discovery and delivery
   HTML routes · /index.md · /llms.txt · manifest.json · ES/EN RSS · sitemap
                 ▼
L6 observation
   validators · browser tests · production smoke · aggregate traffic snapshots
```

Each layer narrows ambiguity. Lower layers preserve evidence; middle layers capture editorial meaning;
upper layers derive representations for different readers. Generated artifacts never become a second
source of truth.

## Canonical objects

### ResearchPacket

Private, evidence-focused, and generated from a Brain dossier. It owns stable `claim-XX` identifiers,
exact locators, epistemic class, safe wording/boundaries, and checksums of immutable source artifacts.
DiagramSpecs refer to these claims. The portfolio stores only a `brain://` pointer and SHA-256 digest,
so a private path never leaks into a public artifact.

Regenerate packets in Brain:

```bash
node library/paper-to-portfolio/build-research-packets.mjs
```

Then synchronize exact bytes in the portfolio:

```bash
npm run notes:sync-research
```

The command is idempotent. A changed packet invalidates release approval because evidence changed.

### PublicationWork

One JSON manifest owns all non-localized state for a bilingual work. Its filename is the stable work ID.
The manifest is the transaction boundary: publishing updates visibility and date once, not two pieces of
frontmatter independently.

Localized MDX intentionally cannot own `kind`, `draft`, `publishedAt`, sources, or diagrams. The content
schema and validator reject that duplication.

### DiagramSpec

A DiagramSpec captures meaning, not drawing instructions:

- visual kind and reading direction;
- semantic items, values, tones, and optional edges;
- localized question, title, takeaway, labels, alt, and caption;
- ResearchPacket claim references;
- density and presentation hints.

An optional localized `artwork` path binds a curated SVG to that meaning. The SVG may choose composition,
curves, spatial metaphor, and typography that an automatic layout cannot recover, but it may not add a
claim absent from the spec. Its exact bytes participate in the release digest.

The article displays curated SVG when available. A DiagramSpec without artwork compiles through
`beautiful-mermaid` to static SVG at build time. Both paths remain JavaScript-free for the reader. Mobile
uses a bounded horizontal viewport for dense wide figures instead of shrinking labels into illegibility.
Every DiagramSpec also serializes to editable Mermaid with the portfolio's `handDrawn` theme in canonical
Markdown. Sharp rasterizes the same displayed SVG for PNG downloads and homepage thumbnails, so the web,
download, and thumbnail cannot silently become three different designs.

## Compiler outputs

For every visible edition the compiler derives:

| Artifact | Consumer | Contract |
|---|---|---|
| Article HTML | Human reader, crawler | SSR, canonical, hreflang, JSON-LD, curated/static SVG figures |
| `index.md` | Agent, reader copying context | Full article, citations, PNG fallback, editable Mermaid, absolute URLs |
| Diagram SVG | Human reader, zoom/download | Curated artwork or build-time Mermaid fallback; no client renderer |
| Diagram PNG | Download, Markdown fallback, thumbnail | Rasterized from the displayed SVG, 1200×675, content-addressed |
| OG PNG | Social preview | 1200×630, content-addressed from note + featured DiagramSpec |
| `manifest.json` | Agents and integrations | Published works, editions, hashes, citations, sources, diagrams |
| `llms.txt` | Agent discovery | Small index pointing at canonical Markdown and machine indexes |
| ES/EN RSS | Feed readers, discovery | Published editions only |
| Sitemap | Search engines | Indexable HTML only; derived formats and drafts are excluded |

The page-level **Copy Markdown** action preloads the canonical public `index.md`; it does not scrape DOM.
It first uses the Clipboard API and falls back to a synchronous textarea copy if browser policy rejects
that API, without navigating away. Each figure has **Copy Mermaid**, **Open large**, **SVG**, and **PNG**.
The visible `View .md` link remains the explicit navigation path.

## Lifecycle as a state machine

`notes:status` derives phase from files and hashes:

```text
awaiting-angle
  └─ Lucas approves promise + thesis + counterpoint
drafting
  └─ agent completes ES, EN, evidence, and DiagramSpecs
review-ready
  └─ Lucas reviews the actual local render
approved
  └─ exact release digest recorded
published
  └─ atomic visibility/date transition
```

There are only two human gates because those decisions cannot be recovered mechanically: what Lucas
wants to say, and whether the exact result represents him. Everything between them should be agent-owned
and validator-backed.

Approval is content-addressed. The release digest covers the PublicationWork semantics, exact MDX bytes,
DiagramSpecs, curated SVG bytes, and public source records. Editing any of them makes approval stale. Git,
push, deploy, and external communication are explicitly outside this state machine.

## Control plane

Start every publishing session here:

```bash
npm run notes:status
npm run notes:context -- --key <work-id> --format md
```

`status` returns phase, blockers, artifacts, digest, and one exact next command. `context` joins the work,
both editions, canonical source records, ResearchPacket claims, and visual questions without loading the
whole Brain or repository. Use `--json` when another agent will consume the result.

Progressive validation keeps feedback proportional to the stage:

- `structure`: object identity, bilingual shape, stable routes;
- `editorial`: gate, sources, citations, MDX allowlist, claims;
- `render`: complete visual semantics and edition parity;
- `release`: publication date and current byte-bound approval.

Diagnostics have stable codes, file paths, JSON pointers, and a repair hint. A draft that has not passed
the angle gate is allowed to be structurally incomplete; a review-ready or published work is not.

## Public and private boundary

Brain owns immutable sources, dossiers, raw artifact paths, and ResearchPackets. The portfolio owns only
public source metadata, approved prose, semantic visuals, and the digest of the private packet. A clean
portfolio checkout must build without Brain; a full local editorial audit uses:

```bash
REQUIRE_RESEARCH_PACKETS=true npm run notes:validate -- --tier render
```

No `/Users/...`, `brain://`, raw path, unpublished work, angle notes, or private metrics may appear in
HTML, Markdown, `llms.txt`, feeds, or the public manifest.

## Observation and accretion

Correctness and discovery are separate feedback loops. The validator, unit tests, Playwright desktop and
mobile tests, and production smoke protect correctness. Search Console and Cloudflare aggregate exports
can be normalized with `notes:metrics`; optional snapshots belong in private Brain, never in public MDX.
Metrics can suggest a new title, related link, or explainer, but may not silently rewrite an approved post.

`notes:metrics` accepts an intentionally provider-neutral aggregate export:

```json
{
  "searchConsole": [
    { "url": "https://lucashenry.dev/es/notas/example/", "impressions": 120, "clicks": 9 }
  ],
  "webAnalytics": [
    { "path": "/es/notas/example/", "pageViews": 31 }
  ],
  "machineRequests": [
    { "path": "/es/notas/example/index.md", "requests": 4 }
  ]
}
```

Run `npm run notes:metrics -- --period 28d --input <aggregate.json>`. Add `--save` only when the
result should become a private Brain snapshot. The input contract contains no cookies, IP addresses,
queries, session replay, or user-level rows; API credentials and provider-specific extraction remain
outside the repository.

The system accretes through stable objects:

- a new source enriches the registry;
- a new claim extends a ResearchPacket;
- a new DiagramSpec kind improves every future representation;
- a compiler improvement updates SVG fallbacks, Markdown, PNG, and cards together;
- a validation rule turns one discovered failure into a permanent invariant.

## Recovery rules

- Digest mismatch: regenerate/sync research, review the effect, and approve release again.
- Stale release approval: never repair the hash manually; re-render and re-review.
- Broken edition pair: fix the manifest or missing locale before prose work continues.
- Diagram too dense: split its semantic question; do not shrink text until it fits.
- Browser and Markdown disagree: fix the shared DiagramSpec/compiler, never patch both outputs.
- Draft leaks into a public index: fail the build; do not hide it only with robots metadata.
- Compatibility OG URL is stale: keep the alias revalidatable; canonical pages point to the immutable URL.

## Verification

```bash
npm run notes:validate -- --tier render
npm run check
npm run test:unit
npm run build:drafts
npm run test:e2e
npm run build
npm run notes:smoke -- --base-url https://lucashenry.dev
```

After a draft-inclusive build, always run the normal production build again so `dist/` ends in the same
state that deployment will use.
