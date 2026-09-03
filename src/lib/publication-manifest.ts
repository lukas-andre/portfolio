import { diagramMermaidSource, diagramPngPath, diagramSvgPath } from './diagrams';
import { compileNoteMarkdown, markdownSha256 } from './markdown';
import { getNoteDiagrams, getNoteSources, getPublishedNotes, noteMarkdownPath, notePath, type NoteEntry } from './notes';

function iso(date?: Date) {
  return date?.toISOString();
}

function citationLocators(note: NoteEntry) {
  const citations = [...note.body.matchAll(/<Cite\b[^>]*source=["']([^"']+)["'][^>]*locator=["']([^"']+)["'][^>]*\/>/g)];
  return citations.map(([, source, locator]) => ({ source, locator }));
}

export async function buildPublicManifest(site = new URL('https://lucashenry.dev')) {
  const notes = await getPublishedNotes();
  const publishedKeys = new Set(notes.map((note) => note.data.translationKey));
  const byKey = new Map<string, Partial<Record<'es' | 'en', NoteEntry>>>();
  for (const note of notes) {
    const pair = byKey.get(note.data.translationKey) ?? {};
    pair[note.data.lang] = note;
    byKey.set(note.data.translationKey, pair);
  }

  const publicSources = new Map<string, Record<string, unknown>>();
  const works = [];
  for (const [id, pair] of [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (!pair.es || !pair.en) continue;
    const publication = pair.es.publication;
    const editions: Record<string, unknown> = {};
    for (const lang of ['es', 'en'] as const) {
      const note = pair[lang]!;
      const translation = pair[lang === 'es' ? 'en' : 'es'];
      const markdown = await compileNoteMarkdown(note, translation, site);
      editions[lang] = {
        title: note.data.title,
        description: note.data.description,
        html: new URL(notePath(note), site).toString(),
        markdown: new URL(noteMarkdownPath(note), site).toString(),
        updatedAt: iso(note.data.updatedAt),
        publishedAt: iso(note.data.publishedAt),
        wordCount: markdown.trim().split(/\s+/).length,
        contentSha256: markdownSha256(markdown),
        tags: note.data.tags,
        citations: citationLocators(note),
      };
    }

    const [sources, diagrams] = await Promise.all([getNoteSources(pair.es), getNoteDiagrams(pair.es)]);
    for (const source of sources) {
      publicSources.set(source.id, {
        type: source.data.type,
        title: source.data.title,
        authors: source.data.authors,
        url: source.data.url,
        identifier: source.data.identifier,
        version: source.data.version,
        license: source.data.license,
        acquisitionMethod: source.data.acquisitionMethod,
        publishedAt: iso(source.data.publishedAt),
        accessedAt: iso(source.data.accessedAt),
      });
    }

    works.push({
      id,
      issue: publication.data.issue,
      kind: publication.data.kind,
      topics: publication.data.topics,
      related: publication.data.related.filter((related) => publishedKeys.has(related)),
      editions,
      sourceRoles: publication.data.sourceRoles.map(({ ref, role }) => ({ source: ref.id, role })),
      featuredVisual: publication.data.featuredVisual,
      diagrams: diagrams.map((diagram) => ({
        id: diagram.id,
        kind: diagram.data.kind,
        claimRefs: diagram.data.claimRefs,
        es: {
          question: diagram.data.copy.es.question,
          takeaway: diagram.data.copy.es.takeaway,
          image: new URL(diagramPngPath(diagram, 'es'), site).toString(),
          svg: new URL(diagramSvgPath(diagram, 'es'), site).toString(),
          mermaid: diagramMermaidSource(diagram, 'es'),
        },
        en: {
          question: diagram.data.copy.en.question,
          takeaway: diagram.data.copy.en.takeaway,
          image: new URL(diagramPngPath(diagram, 'en'), site).toString(),
          svg: new URL(diagramSvgPath(diagram, 'en'), site).toString(),
          mermaid: diagramMermaidSource(diagram, 'en'),
        },
      })),
    });
  }

  return {
    schemaVersion: 1,
    identity: {
      name: 'Lucas Henry',
      url: site.toString(),
      notes: new URL('/en/notes/', site).toString(),
    },
    works,
    sources: Object.fromEntries([...publicSources.entries()].sort(([a], [b]) => a.localeCompare(b))),
  };
}
