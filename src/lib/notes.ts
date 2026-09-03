import { getCollection, getEntries, getEntry, type CollectionEntry } from 'astro:content';

type LocalizedNoteEntry = CollectionEntry<'notes'>;
export type PublicationEntry = CollectionEntry<'publications'>;
export type DiagramEntry = CollectionEntry<'diagrams'>;
export type NoteLanguage = 'es' | 'en';

type ResolvedFields = {
  kind: PublicationEntry['data']['kind'];
  draft: boolean;
  publishedAt?: Date;
  sources: PublicationEntry['data']['sourceRoles'];
  diagrams: string[];
  issue: string;
  featuredVisual: string;
  topics: string[];
  related: string[];
};

export type NoteEntry = Omit<LocalizedNoteEntry, 'data'> & {
  data: LocalizedNoteEntry['data'] & ResolvedFields;
  publication: PublicationEntry;
};

export const localeConfig = {
  es: { index: '/es/notas/', segment: 'notas', label: 'Español' },
  en: { index: '/en/notes/', segment: 'notes', label: 'English' },
} as const;

const includeDrafts = !import.meta.env.PROD || process.env.INCLUDE_DRAFTS === 'true';

function resolveNote(entry: LocalizedNoteEntry, publication: PublicationEntry): NoteEntry {
  return {
    ...entry,
    data: {
      ...entry.data,
      kind: publication.data.kind,
      draft: publication.data.visibility === 'draft',
      publishedAt: publication.data.publishedAt,
      sources: publication.data.sourceRoles,
      diagrams: publication.data.visuals,
      issue: publication.data.issue,
      featuredVisual: publication.data.featuredVisual ?? '',
      topics: publication.data.topics,
      related: publication.data.related,
    },
    publication,
  };
}

async function allResolvedNotes() {
  const [notes, publications] = await Promise.all([
    getCollection('notes'),
    getCollection('publications'),
  ]);
  const byKey = new Map<string, PublicationEntry>(
    publications.map((publication) => [publication.id, publication]),
  );
  return notes.map((note) => {
    const publication = byKey.get(note.data.translationKey);
    if (!publication) throw new Error(`Missing publication manifest for ${note.data.translationKey}`);
    return resolveNote(note, publication);
  });
}

export function localSlug(entry: NoteEntry) {
  return entry.publication.data.editions[entry.data.lang].slug;
}

export function notePath(entry: NoteEntry) {
  const locale = localeConfig[entry.data.lang];
  return `/${entry.data.lang}/${locale.segment}/${localSlug(entry)}/`;
}

export function noteMarkdownPath(entry: NoteEntry) {
  return `${notePath(entry)}index.md`;
}

function sortNotes(entries: NoteEntry[]) {
  return entries.sort((a, b) => {
    const aDate = a.data.publishedAt?.getTime() ?? a.data.updatedAt?.getTime() ?? 0;
    const bDate = b.data.publishedAt?.getTime() ?? b.data.updatedAt?.getTime() ?? 0;
    return bDate - aDate || a.data.issue.localeCompare(b.data.issue);
  });
}

export async function getVisibleNotes(lang?: NoteLanguage) {
  const entries = (await allResolvedNotes()).filter((entry) => (
    (includeDrafts || !entry.data.draft) && (!lang || entry.data.lang === lang)
    && entry.data.diagrams.length >= 2 && Boolean(entry.data.featuredVisual)
  ));
  return sortNotes(entries);
}

export async function getPublishedNotes(lang?: NoteLanguage) {
  const entries = (await allResolvedNotes()).filter((entry) => (
    !entry.data.draft && (!lang || entry.data.lang === lang)
  ));
  return sortNotes(entries);
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

export async function getNoteDiagrams(entry: NoteEntry) {
  const diagrams = await Promise.all(entry.data.diagrams.map((id) => getEntry('diagrams', id)));
  return diagrams.filter((diagram): diagram is DiagramEntry => Boolean(diagram));
}

export async function getRelatedNotes(entry: NoteEntry) {
  const all = await getVisibleNotes(entry.data.lang);
  const direct = new Set(entry.data.related);
  for (const candidate of all) {
    if (candidate.data.related.includes(entry.data.translationKey)) direct.add(candidate.data.translationKey);
  }
  return all.filter((candidate) => direct.has(candidate.data.translationKey));
}

export function readingMinutes(entry: NoteEntry) {
  const words = entry.body.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}
