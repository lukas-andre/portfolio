import type { APIRoute } from 'astro';
import { compileNoteMarkdown } from './markdown';
import { getTranslation, getVisibleNotes, localSlug, type NoteEntry, type NoteLanguage } from './notes';

export async function markdownStaticPaths(lang: NoteLanguage) {
  const notes = await getVisibleNotes(lang);
  return notes.map((note) => ({ params: { slug: localSlug(note), asset: 'index.md' }, props: { note } }));
}

export const markdownGET: APIRoute<{ note: NoteEntry }> = async ({ props, site }) => {
  const translation = await getTranslation(props.note);
  const markdown = await compileNoteMarkdown(props.note, translation, site ?? new URL('https://lucashenry.dev'));
  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': props.note.data.draft ? 'no-store' : 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
};
