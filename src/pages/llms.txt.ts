import type { APIRoute } from 'astro';
import { getPublishedNotes, noteMarkdownPath } from '../lib/notes';

export const GET: APIRoute = async ({ site }) => {
  const origin = site ?? new URL('https://lucashenry.dev');
  const notes = await getPublishedNotes();
  const sections = (['es', 'en'] as const).map((lang) => {
    const heading = lang === 'es' ? 'Notas en español' : 'Notes in English';
    const entries = notes
      .filter((note) => note.data.lang === lang)
      .map((note) => `- [${note.data.title}](${new URL(noteMarkdownPath(note), origin)}): ${note.data.description}`)
      .join('\n');
    return `## ${heading}\n\n${entries || '- No published notes yet.'}`;
  });
  const body = [
    '# Lucas Henry',
    '',
    '> Engineering leadership, self-service platforms, harness engineering, and evidence-led notes about agentic systems.',
    '',
    ...sections,
    '',
    '## Machine-readable indexes',
    '',
    `- [Publication manifest](${new URL('/notes/manifest.json', origin)})`,
    `- [Spanish feed](${new URL('/es/notas/feed.xml', origin)})`,
    `- [English feed](${new URL('/en/notes/feed.xml', origin)})`,
    '',
  ].join('\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
};
