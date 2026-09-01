import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, resolve, sep } from 'node:path';
import type { ReactNode } from 'react';
import satori from 'satori';
import sharp from 'sharp';

export const SOCIAL_CARD_WIDTH = 1200;
export const SOCIAL_CARD_HEIGHT = 630;

type ProfileSocialCard = {
  kind: 'profile';
  name: string;
  role: string;
  domain: string;
  headline: string;
  capabilities: number;
  teams: number;
  people: string;
  portraitPath: string;
};

type NoteSocialCard = {
  kind: 'note';
  title: string;
  lang: 'es' | 'en';
  issue: number;
  dateLabel: string;
  tags: readonly string[];
  diagramPath: string;
};

export type SocialCardInput = ProfileSocialCard | NoteSocialCard;

const colors = {
  paper: '#f3f0e8',
  paperBright: '#fffdf7',
  paperDeep: '#ddd7ca',
  ink: '#171813',
  inkSoft: '#41423b',
  muted: '#68685f',
  faint: '#9b998f',
  amber: '#92551d',
  gold: '#7b5b12',
  sage: '#526149',
  rust: '#8b3d24',
  night: '#11110f',
};

const projectRoot = process.cwd();
const publicRoot = resolve(projectRoot, 'public');
const { Resvg } = createRequire(import.meta.url)('@resvg/resvg-js') as typeof import('@resvg/resvg-js');
const fontFiles = {
  diagramSansRegular: resolve(projectRoot, 'node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf'),
  diagramSansBold: resolve(projectRoot, 'node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf'),
  diagramMonoRegular: resolve(projectRoot, 'node_modules/dejavu-fonts-ttf/ttf/DejaVuSansMono.ttf'),
  jetbrainsMonoMedium: resolve(projectRoot, 'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff'),
  newsreaderSemibold: resolve(projectRoot, 'node_modules/@fontsource/newsreader/files/newsreader-latin-600-normal.woff'),
};

let fontsPromise: Promise<ArrayBuffer[]> | undefined;

function loadFonts() {
  fontsPromise ??= Promise.all([
    readFile(fontFiles.newsreaderSemibold),
    readFile(fontFiles.jetbrainsMonoMedium),
  ]).then((buffers) => buffers.map((buffer) => (
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  )));
  return fontsPromise;
}

function publicAssetPath(assetPath: string) {
  const normalized = assetPath.replace(/^\/+/, '');
  const absolutePath = resolve(publicRoot, normalized);
  if (absolutePath !== publicRoot && !absolutePath.startsWith(`${publicRoot}${sep}`)) {
    throw new Error(`Social card asset must live under public/: ${assetPath}`);
  }
  return absolutePath;
}

function mimeType(filePath: string) {
  switch (extname(filePath).toLowerCase()) {
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    default: throw new Error(`Unsupported social card asset: ${filePath}`);
  }
}

async function assetDataUri(assetPath: string) {
  const absolutePath = publicAssetPath(assetPath);
  const data = await readFile(absolutePath);
  return `data:${mimeType(absolutePath)};base64,${data.toString('base64')}`;
}

async function diagramDataUri(assetPath: string) {
  const absolutePath = publicAssetPath(assetPath);
  if (extname(absolutePath).toLowerCase() !== '.svg') return assetDataUri(assetPath);

  const source = await readFile(absolutePath);
  const diagram = new Resvg(source, {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      fontFiles: [fontFiles.diagramSansRegular, fontFiles.diagramSansBold, fontFiles.diagramMonoRegular],
      loadSystemFonts: false,
      defaultFontFamily: 'DejaVu Sans',
      sansSerifFamily: 'DejaVu Sans',
      monospaceFamily: 'DejaVu Sans Mono',
    },
  });

  return `data:image/png;base64,${Buffer.from(diagram.render().asPng()).toString('base64')}`;
}

function Grid() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', opacity: 0.34 }}>
      {Array.from({ length: 16 }, (_, index) => (
        <div
          key={`v-${index}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: index * 80,
            width: 1,
            backgroundColor: index % 4 === 0 ? '#cfc8b9' : '#dfd9cc',
          }}
        />
      ))}
      {Array.from({ length: 9 }, (_, index) => (
        <div
          key={`h-${index}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: index * 80,
            height: 1,
            backgroundColor: index % 4 === 0 ? '#cfc8b9' : '#dfd9cc',
          }}
        />
      ))}
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        overflow: 'hidden',
        backgroundColor: colors.paper,
        color: colors.ink,
      }}
    >
      <Grid />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 11, backgroundColor: colors.amber }} />
      <div style={{ position: 'absolute', top: 11, left: 0, width: 11, bottom: 0, backgroundColor: colors.ink }} />
      <div style={{ position: 'absolute', top: 36, left: 38, width: 12, height: 12, borderLeft: `3px solid ${colors.amber}`, borderTop: `3px solid ${colors.amber}` }} />
      <div style={{ position: 'absolute', right: 28, bottom: 27, width: 12, height: 12, borderRight: `3px solid ${colors.amber}`, borderBottom: `3px solid ${colors.amber}` }} />
      {children}
    </div>
  );
}

function Metric({ value, label, last = false }: { value: string | number; label: string; last?: boolean }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', padding: '12px 18px', borderRight: last ? 'none' : `1px solid ${colors.paperDeep}` }}>
      <span style={{ fontFamily: 'Newsreader', fontSize: 35, fontWeight: 600, lineHeight: 1, color: colors.ink }}>{value}</span>
      <span style={{ marginLeft: 9, fontFamily: 'JetBrains Mono', fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.1 }}>{label}</span>
    </div>
  );
}

function ProfileCard({ card, portrait }: { card: ProfileSocialCard; portrait: string }) {
  return (
    <Frame>
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', padding: '62px 66px 54px 76px' }}>
        <div style={{ width: 696, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', fontFamily: 'JetBrains Mono', fontSize: 13, color: colors.amber, letterSpacing: 2.1, textTransform: 'uppercase' }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: colors.amber, marginRight: 12 }} />
            LH / PORTFOLIO / 2026
          </div>

          <div style={{ marginTop: 54, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 25, color: colors.amber, marginRight: 13 }}>[</span>
              <h1 style={{ margin: 0, fontFamily: 'Newsreader', fontSize: 91, fontWeight: 600, lineHeight: 0.9, letterSpacing: -4.5, color: colors.ink }}>{card.name}</h1>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 25, color: colors.amber, marginLeft: 13 }}>]</span>
            </div>
            <p style={{ margin: '24px 0 0', maxWidth: 650, fontFamily: 'JetBrains Mono', fontSize: 20, lineHeight: 1.4, color: colors.inkSoft }}>
              {card.role} · {card.domain} · Agentic Systems
            </p>
          </div>

          <div style={{ marginTop: 43, display: 'flex', width: 600, border: `1px solid ${colors.paperDeep}`, backgroundColor: 'rgba(255,253,247,.76)' }}>
            <Metric value={card.capabilities} label="capabilities" />
            <Metric value={card.teams} label="teams" />
            <Metric value={card.people} label="people" last />
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', fontFamily: 'JetBrains Mono', fontSize: 12, color: colors.muted }}>
            <span style={{ display: 'flex', alignItems: 'center', color: colors.sage }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: colors.sage, marginRight: 8 }} />
              ONLINE
            </span>
            <span style={{ margin: '0 12px', color: colors.faint }}>·</span>
            <span>lucashenry.dev</span>
            <span style={{ margin: '0 12px', color: colors.faint }}>·</span>
            <span>Santiago, Chile</span>
          </div>
        </div>

        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', width: 325, height: 405, right: 5, top: 64, border: `2px solid ${colors.amber}`, backgroundColor: '#d6b37f' }} />
          <div style={{ position: 'absolute', width: 325, height: 405, right: 22, top: 46, display: 'flex', overflow: 'hidden', border: `8px solid ${colors.paperBright}`, backgroundColor: colors.night, boxShadow: '0 22px 42px rgba(42,33,21,.22)' }}>
            <img src={portrait} width="325" height="405" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ position: 'absolute', top: 29, right: 0, display: 'flex', alignItems: 'center', padding: '8px 12px', border: `1px solid ${colors.paperDeep}`, backgroundColor: colors.paperBright, fontFamily: 'JetBrains Mono', fontSize: 11, color: colors.amber }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: colors.sage, marginRight: 8 }} />
            HUMAN IN THE LOOP
          </div>
          <div style={{ position: 'absolute', right: 294, bottom: 43, width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, color: colors.paperBright, fontFamily: 'JetBrains Mono', fontSize: 17 }}>
            LH
          </div>
        </div>
      </div>
    </Frame>
  );
}

function titleFontSize(title: string) {
  if (title.length > 70) return 52;
  if (title.length > 52) return 58;
  return 66;
}

function NoteCard({ card, diagram }: { card: NoteSocialCard; diagram: string }) {
  const isSpanish = card.lang === 'es';
  const issue = String(card.issue).padStart(3, '0');
  return (
    <Frame>
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', padding: '54px 58px 50px 76px' }}>
        <div style={{ width: 645, display: 'flex', flexDirection: 'column', paddingRight: 38 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'JetBrains Mono', fontSize: 12, color: colors.amber, letterSpacing: 1.8, textTransform: 'uppercase' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: colors.amber, marginRight: 11 }} />
              {isSpanish ? 'NOTA DE INVESTIGACIÓN' : 'RESEARCH NOTE'}
            </div>
            <span style={{ color: colors.muted }}>Nº {issue}</span>
          </div>

          <div style={{ marginTop: 47, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: colors.sage, letterSpacing: 1.3, textTransform: 'uppercase' }}>
              PAPER / {isSpanish ? 'EXPLICADO' : 'EXPLAINED'}
            </span>
            <h1 style={{ margin: '18px 0 0', fontFamily: 'Newsreader', fontSize: titleFontSize(card.title), fontWeight: 600, lineHeight: 0.94, letterSpacing: -2.5, color: colors.ink }}>
              {card.title}
            </h1>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: '100%', height: 1, backgroundColor: colors.paperDeep }} />
            <div style={{ marginTop: 15, display: 'flex', alignItems: 'center', fontFamily: 'JetBrains Mono', fontSize: 11, color: colors.muted, textTransform: 'uppercase' }}>
              <span style={{ color: colors.inkSoft }}>Lucas Henry</span>
              <span style={{ margin: '0 10px', color: colors.faint }}>·</span>
              <span>{card.dateLabel}</span>
              <span style={{ margin: '0 10px', color: colors.faint }}>·</span>
              <span>{card.lang.toUpperCase()}</span>
            </div>
            <div style={{ marginTop: 10, display: 'flex', fontFamily: 'JetBrains Mono', fontSize: 10, color: colors.sage }}>
              {card.tags.slice(0, 3).map((tag) => <span key={tag} style={{ marginRight: 13 }}>#{tag}</span>)}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', right: 0, top: 44, width: 430, height: 396, backgroundColor: '#cfb287', border: `2px solid ${colors.amber}` }} />
          <div style={{ position: 'absolute', right: 17, top: 27, width: 430, height: 396, display: 'flex', flexDirection: 'column', padding: 15, backgroundColor: colors.night, border: `7px solid ${colors.paperBright}`, boxShadow: '0 24px 45px rgba(42,33,21,.25)' }}>
            <div style={{ width: '100%', height: 223, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.night }}>
              <img src={diagram} width="400" height="214" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 15, paddingTop: 12, borderTop: '1px solid #3c3a34', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#d4a574', letterSpacing: 1.2 }}>
              <span>FIG. 01</span>
              <span>{isSpanish ? 'DENTRO DE LA NOTA ->' : 'INSIDE THE NOTE ->'}</span>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 58, height: 58, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #d4a574', color: '#f5f2eb', fontFamily: 'Newsreader', fontSize: 25 }}>{issue}</div>
              <div style={{ marginLeft: 15, display: 'flex', flexDirection: 'column', fontFamily: 'JetBrains Mono' }}>
                <span style={{ fontSize: 10, color: '#7a756a', letterSpacing: 1 }}>FIELD NOTES</span>
                <span style={{ marginTop: 5, fontSize: 12, color: '#c9c4b8' }}>software · agents · evidence</span>
              </div>
            </div>
          </div>
          <div style={{ position: 'absolute', right: 398, bottom: 29, display: 'flex', padding: '8px 10px', backgroundColor: colors.paperBright, border: `1px solid ${colors.paperDeep}`, color: colors.amber, fontFamily: 'JetBrains Mono', fontSize: 10 }}>LH / NOTES</div>
        </div>
      </div>
    </Frame>
  );
}

export async function renderSocialCard(card: SocialCardInput) {
  const [newsreader, jetbrainsMono] = await loadFonts();
  const element = card.kind === 'profile'
    ? <ProfileCard card={card} portrait={await assetDataUri(card.portraitPath)} />
    : <NoteCard card={card} diagram={await diagramDataUri(card.diagramPath)} />;

  const svg = await satori(element, {
    width: SOCIAL_CARD_WIDTH,
    height: SOCIAL_CARD_HEIGHT,
    fonts: [
      { name: 'Newsreader', data: newsreader, weight: 600, style: 'normal' },
      { name: 'JetBrains Mono', data: jetbrainsMono, weight: 500, style: 'normal' },
    ],
  });

  return sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, quality: 100 })
    .toBuffer();
}

export function socialCardResponse(image: Buffer) {
  return new Response(new Uint8Array(image), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
