import { getCollection, getEntries, type CollectionEntry } from 'astro:content';

export type NoteEntry = CollectionEntry<'notes'>;
export type NoteLanguage = 'es' | 'en';

export const localeConfig = {
  es: { index: '/es/notas/', segment: 'notas', label: 'Español' },
  en: { index: '/en/notes/', segment: 'notes', label: 'English' },
} as const;

const includeDrafts = !import.meta.env.PROD || process.env.INCLUDE_DRAFTS === 'true';

export function localSlug(entry: NoteEntry) {
  return entry.slug.split('/').slice(1).join('/');
}

export function notePath(entry: NoteEntry) {
  const locale = localeConfig[entry.data.lang];
  return `/${entry.data.lang}/${locale.segment}/${localSlug(entry)}/`;
}

export async function getVisibleNotes(lang?: NoteLanguage) {
  const entries = await getCollection('notes', ({ data }) => (
    (includeDrafts || !data.draft) && (!lang || data.lang === lang)
  ));

  return entries.sort((a, b) => {
    const aDate = a.data.publishedAt?.getTime() ?? a.data.updatedAt?.getTime() ?? 0;
    const bDate = b.data.publishedAt?.getTime() ?? b.data.updatedAt?.getTime() ?? 0;
    return bDate - aDate;
  });
}

export async function getTranslation(entry: NoteEntry) {
  const entries = await getVisibleNotes();
  return entries.find((candidate) => (
    candidate.data.translationKey === entry.data.translationKey && candidate.data.lang !== entry.data.lang
  ));
}

export async function getNoteSources(entry: NoteEntry) {
  return getEntries(entry.data.sources.map(({ ref }) => ref));
}

export function readingMinutes(entry: NoteEntry) {
  const words = entry.body.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}
