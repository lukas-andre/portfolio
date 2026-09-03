import type { APIRoute, GetStaticPaths } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { diagramDigest, type DiagramLanguage } from '../../../../lib/diagrams';
import { diagramPosterResponse, renderDiagramPoster } from '../../../../lib/diagram-poster';
import { getNoteDiagrams, getVisibleNotes } from '../../../../lib/notes';

type Props = { diagram: CollectionEntry<'diagrams'>; lang: DiagramLanguage };

export const getStaticPaths: GetStaticPaths = async () => {
  const notes = await getVisibleNotes();
  const diagrams = new Map<string, CollectionEntry<'diagrams'>>();
  for (const note of notes) {
    for (const diagram of await getNoteDiagrams(note)) diagrams.set(diagram.id, diagram);
  }
  return [...diagrams.values()].flatMap((diagram) => (['es', 'en'] as const).map((lang) => ({
    params: { route: `${diagram.id}/${lang}-${diagramDigest(diagram, lang)}` },
    props: { diagram, lang },
  })));
};

export const GET: APIRoute<Props> = async ({ props }) => (
  diagramPosterResponse(await renderDiagramPoster(props.diagram, props.lang))
);
