import { readFile } from 'node:fs/promises';
import { renderMermaidSVG } from 'beautiful-mermaid';
import sharp from 'sharp';
import {
  diagramArtworkFile,
  diagramMermaidDefinition,
  type DiagramEntry,
  type DiagramLanguage,
} from './diagrams';

export const DIAGRAM_POSTER_WIDTH = 1200;
export const DIAGRAM_POSTER_HEIGHT = 675;

const generatedTheme = {
  bg: '#10110f',
  fg: '#eee8dc',
  line: '#75624d',
  accent: '#d4a574',
  muted: '#8f897e',
  surface: '#1d1e1a',
  border: '#615b50',
  font: 'JetBrains Mono',
  padding: 54,
  nodeSpacing: 34,
  layerSpacing: 58,
  componentSpacing: 34,
} as const;

function withoutRemoteFonts(svg: string) {
  return svg.replace(/@import\s+url\([^;]+;\s*/g, '');
}

export async function renderDiagramSvg(entry: DiagramEntry, lang: DiagramLanguage) {
  const artworkFile = diagramArtworkFile(entry, lang);
  if (artworkFile) return readFile(artworkFile);
  const svg = renderMermaidSVG(diagramMermaidDefinition(entry, lang), generatedTheme);
  return Buffer.from(withoutRemoteFonts(svg));
}

export async function renderDiagramPoster(entry: DiagramEntry, lang: DiagramLanguage) {
  const svg = await renderDiagramSvg(entry, lang);
  return sharp(svg, { density: 180 })
    .resize(DIAGRAM_POSTER_WIDTH, DIAGRAM_POSTER_HEIGHT, {
      fit: 'contain',
      background: '#10110f',
    })
    .png({ compressionLevel: 9, quality: 100 })
    .toBuffer();
}

export function diagramPosterResponse(image: Buffer) {
  return new Response(new Uint8Array(image), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export function diagramSvgResponse(svg: Buffer) {
  return new Response(new Uint8Array(svg), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    },
  });
}
