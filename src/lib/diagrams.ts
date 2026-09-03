import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import type { CollectionEntry } from 'astro:content';
import type { NoteEntry } from './notes';

export type DiagramEntry = CollectionEntry<'diagrams'>;
export type DiagramLanguage = 'es' | 'en';

const PUBLIC_ROOT = resolve(process.cwd(), 'public');

export function diagramLocalId(entry: DiagramEntry) {
  return entry.id.split('/').at(-1) ?? entry.id;
}

export function diagramArtworkPath(entry: DiagramEntry, lang: DiagramLanguage) {
  return entry.data.artwork?.[lang];
}

export function diagramArtworkFile(entry: DiagramEntry, lang: DiagramLanguage) {
  const publicPath = diagramArtworkPath(entry, lang);
  if (!publicPath) return undefined;
  const file = resolve(PUBLIC_ROOT, publicPath.replace(/^\/+/, ''));
  if (!file.startsWith(`${PUBLIC_ROOT}${sep}`)) {
    throw new Error(`Diagram artwork escapes public/: ${publicPath}`);
  }
  return file;
}

export function diagramDimensions(entry: DiagramEntry, lang: DiagramLanguage) {
  const artworkFile = diagramArtworkFile(entry, lang);
  if (!artworkFile || !existsSync(artworkFile)) return { width: 1200, height: 675 };
  const svg = readFileSync(artworkFile, 'utf8');
  const viewBox = svg.match(/<svg\b[^>]*\bviewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)["']/i);
  const width = Number(viewBox?.[1]);
  const height = Number(viewBox?.[2]);
  return width > 0 && height > 0 ? { width, height } : { width: 1200, height: 675 };
}

export function diagramDigest(entry: DiagramEntry, lang: DiagramLanguage) {
  const artworkFile = diagramArtworkFile(entry, lang);
  const artworkSha256 = artworkFile && existsSync(artworkFile)
    ? createHash('sha256').update(readFileSync(artworkFile)).digest('hex')
    : undefined;
  return createHash('sha256')
    .update(JSON.stringify({ id: entry.id, data: entry.data, lang, artworkSha256 }))
    .digest('hex')
    .slice(0, 12);
}

export function diagramGeneratedSvgPath(entry: DiagramEntry, lang: DiagramLanguage) {
  return `/images/notes/diagrams/${entry.id}/${lang}-${diagramDigest(entry, lang)}.svg`;
}

export function diagramSvgPath(entry: DiagramEntry, lang: DiagramLanguage) {
  return diagramArtworkPath(entry, lang) ?? diagramGeneratedSvgPath(entry, lang);
}

export function diagramPngPath(entry: DiagramEntry, lang: DiagramLanguage) {
  return `/images/notes/diagrams/${entry.id}/${lang}-${diagramDigest(entry, lang)}.png`;
}

export function noteSocialCardPath(note: NoteEntry, featured: DiagramEntry) {
  const digest = createHash('sha256').update(JSON.stringify({
    key: note.data.translationKey,
    lang: note.data.lang,
    title: note.data.title,
    description: note.data.description,
    issue: note.data.issue,
    updatedAt: note.data.updatedAt?.toISOString(),
    diagram: diagramDigest(featured, note.data.lang),
  })).digest('hex').slice(0, 12);
  return `/open-graph/notes/${note.data.translationKey}/${note.data.lang}-${digest}.png`;
}

function mermaidId(value: string) {
  const id = value.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[a-zA-Z_]/.test(id) ? id : `node_${id}`;
}

function mermaidText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function mermaidLabel(entry: DiagramEntry, lang: DiagramLanguage, itemId: string) {
  const label = entry.data.copy[lang].labels[itemId];
  const title = mermaidText(label?.title ?? itemId);
  return label?.detail ? `${title}<br/>${mermaidText(label.detail)}` : title;
}

function node(entry: DiagramEntry, lang: DiagramLanguage, item: DiagramEntry['data']['model']['items'][number]) {
  const id = mermaidId(item.id);
  const label = mermaidLabel(entry, lang, item.id);
  const shape = entry.data.kind === 'layers'
    ? `${id}{{"${label}"}}`
    : entry.data.kind === 'matrix'
      ? `${id}[["${label}"]]`
      : entry.data.kind === 'steps' || entry.data.kind === 'timeline'
        ? `${id}("${label}")`
        : `${id}(["${label}"])`;
  return `${shape}:::${item.tone ?? 'ink'}`;
}

function flowDirection(entry: DiagramEntry) {
  if (entry.data.presentation.direction === 'horizontal') return 'LR';
  if (entry.data.presentation.direction === 'vertical') return 'TB';
  return entry.data.kind === 'layers' ? 'TB' : 'LR';
}

function diagramFlowchart(entry: DiagramEntry, lang: DiagramLanguage) {
  const copy = entry.data.copy[lang];
  const items = entry.data.model.items;
  const ids = items.map((item) => mermaidId(item.id));
  const lines = [
    `flowchart ${flowDirection(entry)}`,
    `  %% ${mermaidText(copy.question)}`,
    ...items.map((item) => `  ${node(entry, lang, item)}`),
  ];

  if ((entry.data.model.edges?.length ?? 0) > 0) {
    for (const edge of entry.data.model.edges ?? []) {
      lines.push(`  ${mermaidId(edge.from)} ${edge.kind === 'dashed' ? '-.->' : '-->'} ${mermaidId(edge.to)}`);
    }
  } else if (entry.data.kind === 'steps' || entry.data.kind === 'timeline') {
    for (let index = 0; index < ids.length - 1; index += 1) lines.push(`  ${ids[index]} --> ${ids[index + 1]}`);
  } else if (entry.data.kind === 'loop') {
    for (let index = 0; index < ids.length - 1; index += 1) lines.push(`  ${ids[index]} --> ${ids[index + 1]}`);
    if (ids.length > 1) lines.push(`  ${ids.at(-1)} -.-> ${ids[0]}`);
  } else if (entry.data.kind === 'layers') {
    for (let index = 0; index < ids.length - 1; index += 1) lines.push(`  ${ids[index]} ==> ${ids[index + 1]}`);
  } else {
    for (let index = 0; index < ids.length - 1; index += 1) lines.push(`  ${ids[index]} ~~~ ${ids[index + 1]}`);
  }

  lines.push(
    '  classDef ink fill:#171813,stroke:#d6a36e,color:#f7f2e8,stroke-width:2px',
    '  classDef amber fill:#f0dcc2,stroke:#92551d,color:#171813,stroke-width:2px',
    '  classDef sage fill:#dce5d3,stroke:#526149,color:#171813,stroke-width:2px',
    '  classDef rust fill:#ecd0c6,stroke:#8b3d24,color:#171813,stroke-width:2px',
    '  classDef muted fill:#ebe7dd,stroke:#75756c,color:#34352f,stroke-width:2px',
    '  linkStyle default stroke:#9a7654,stroke-width:2px',
  );
  return lines.join('\n');
}

function diagramChart(entry: DiagramEntry, lang: DiagramLanguage) {
  const copy = entry.data.copy[lang];
  const items = entry.data.model.items;
  const maximum = entry.data.model.maxValue ?? Math.max(...items.map((item) => item.value ?? 0), 1);
  return [
    'xychart-beta',
    `  %% ${mermaidText(copy.question)}`,
    `  title "${mermaidText(copy.title)}"`,
    `  x-axis [${items.map((item) => `"${mermaidText(copy.labels[item.id]?.title ?? item.id)}"`).join(', ')}]`,
    `  y-axis 0 --> ${maximum}`,
    `  bar [${items.map((item) => item.value ?? 0).join(', ')}]`,
  ].join('\n');
}

export function diagramMermaidDefinition(entry: DiagramEntry, lang: DiagramLanguage) {
  return entry.data.kind === 'chart' ? diagramChart(entry, lang) : diagramFlowchart(entry, lang);
}

export function diagramMermaidSource(entry: DiagramEntry, lang: DiagramLanguage) {
  const seed = Number.parseInt(diagramDigest(entry, lang).slice(0, 6), 16);
  return [
    '---',
    'config:',
    '  look: handDrawn',
    `  handDrawnSeed: ${seed}`,
    '  theme: base',
    '  markdownAutoWrap: true',
    '  themeVariables:',
    '    background: "#f3f0e8"',
    '    primaryColor: "#fffdf7"',
    '    primaryTextColor: "#171813"',
    '    primaryBorderColor: "#92551d"',
    '    secondaryColor: "#dce5d3"',
    '    tertiaryColor: "#f0dcc2"',
    '    lineColor: "#73583f"',
    '    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"',
    '---',
    diagramMermaidDefinition(entry, lang),
  ].join('\n');
}

export function diagramMermaidBlock(entry: DiagramEntry, lang: DiagramLanguage) {
  return `\`\`\`mermaid\n${diagramMermaidSource(entry, lang)}\n\`\`\``;
}

export function diagramSemanticMarkdown(entry: DiagramEntry, lang: DiagramLanguage) {
  return diagramMermaidBlock(entry, lang);
}

export function diagramMarkdown(
  entry: DiagramEntry,
  lang: DiagramLanguage,
  site = new URL('https://lucashenry.dev'),
) {
  const copy = entry.data.copy[lang];
  const image = new URL(diagramPngPath(entry, lang), site).toString();
  const sourceLabel = lang === 'es' ? 'Claims relacionados' : 'Related claims';
  return [
    `### ${copy.title}`,
    '',
    `**${copy.question}**`,
    '',
    `![${copy.alt}](${image})`,
    '',
    `> **${lang === 'es' ? 'Conclusión' : 'Takeaway'}:** ${copy.takeaway}`,
    '',
    diagramMermaidBlock(entry, lang),
    '',
    `_${copy.caption}_`,
    '',
    `${sourceLabel}: ${entry.data.claimRefs.map((claim) => `\`${claim}\``).join(', ')}`,
  ].join('\n');
}
