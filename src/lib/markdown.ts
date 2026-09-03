import { createHash } from 'node:crypto';
import { unified } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { diagramMarkdown } from './diagrams';
import { getNoteDiagrams, getNoteSources, noteMarkdownPath, notePath, type NoteEntry } from './notes';

type MdNode = {
  type: string;
  name?: string;
  value?: string;
  url?: string;
  title?: string | null;
  attributes?: Array<{ type: string; name: string; value?: unknown }>;
  children?: MdNode[];
  [key: string]: unknown;
};

const processor = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).use(remarkStringify, {
  bullet: '-',
  fences: true,
  listItemIndent: 'one',
});

function attribute(node: MdNode, name: string) {
  const found = node.attributes?.find((item) => item.name === name);
  return typeof found?.value === 'string' ? found.value : '';
}

function parseFragment(markdown: string) {
  return (processor.parse(markdown) as MdNode).children ?? [];
}

function labeledQuote(label: string, children: MdNode[]) {
  return {
    type: 'blockquote',
    children: [
      { type: 'paragraph', children: [{ type: 'strong', children: [{ type: 'text', value: label }] }] },
      ...children,
    ],
  } satisfies MdNode;
}

function transformTree(
  root: MdNode,
  sourceMap: Map<string, Awaited<ReturnType<typeof getNoteSources>>[number]>,
  diagramMap: Map<string, Awaited<ReturnType<typeof getNoteDiagrams>>[number]>,
  note: NoteEntry,
  site: URL,
) {
  const transformChildren = (parent: MdNode) => {
    const next: MdNode[] = [];
    for (const child of parent.children ?? []) {
      if (child.children) transformChildren(child);

      if (child.type === 'mdxjsEsm') continue;

      if ((child.type === 'mdxJsxTextElement' || child.type === 'mdxJsxFlowElement') && child.name === 'Cite') {
        const sourceId = attribute(child, 'source');
        const locator = attribute(child, 'locator');
        const source = sourceMap.get(sourceId);
        if (!source) throw new Error(`Unknown source ${sourceId} while compiling ${note.data.translationKey}`);
        next.push({
          type: 'link',
          url: source.data.url,
          title: `${source.data.title} — ${locator}`,
          children: [{ type: 'text', value: `${source.data.identifier}, ${locator}` }],
        });
        continue;
      }

      if (child.type === 'mdxJsxFlowElement' && child.name === 'NoteFigure') {
        const id = attribute(child, 'id');
        const diagram = diagramMap.get(id);
        if (!diagram) throw new Error(`Unknown diagram ${id} while compiling ${note.data.translationKey}`);
        next.push(...parseFragment(diagramMarkdown(diagram, note.data.lang, site)));
        continue;
      }

      if (child.type === 'mdxJsxFlowElement' && child.name === 'Callout') {
        const label = attribute(child, 'label') || (note.data.lang === 'es' ? 'Nota' : 'Note');
        next.push(labeledQuote(label, child.children ?? []));
        continue;
      }

      if (child.type === 'mdxJsxFlowElement' && child.name === 'MyTake') {
        const label = attribute(child, 'title') || (note.data.lang === 'es' ? 'Mi lectura' : 'My take');
        next.push(labeledQuote(label, child.children ?? []));
        continue;
      }

      if (child.type.startsWith('mdxJsx')) {
        next.push(...(child.children ?? []));
        continue;
      }

      next.push(child);
    }
    parent.children = next;
  };

  transformChildren(root);
}

function yamlString(value: string) {
  return JSON.stringify(value);
}

function isoDate(date?: Date) {
  return date?.toISOString().slice(0, 10);
}

export async function compileNoteMarkdown(note: NoteEntry, translation?: NoteEntry, site = new URL('https://lucashenry.dev')) {
  const [sources, diagrams] = await Promise.all([getNoteSources(note), getNoteDiagrams(note)]);
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const diagramMap = new Map(diagrams.map((diagram) => [diagram.id, diagram]));
  const root = processor.parse(note.body) as MdNode;
  transformTree(root, sourceMap, diagramMap, note, site);

  const sourceHeading = note.data.lang === 'es' ? 'Fuentes completas' : 'Complete sources';
  const disclosureHeading = note.data.lang === 'es' ? 'Transparencia editorial' : 'Editorial transparency';
  const disclosure = note.data.lang === 'es'
    ? 'Este artículo fue investigado y redactado con asistencia de IA. Lucas definió el ángulo, verificó las fuentes y conserva la responsabilidad editorial.'
    : 'This article was researched and drafted with AI assistance. Lucas set the angle, verified the sources, and retains editorial responsibility.';
  const ledger = note.data.sources.map(({ ref, role }, index) => {
    const source = sourceMap.get(ref.id);
    if (!source) throw new Error(`Missing source ${ref.id}`);
    const authors = source.data.authors.join(', ');
    const revision = source.data.version ? ` · ${source.data.version}` : '';
    return `${index + 1}. **${source.data.title}** — ${authors}. [${source.data.identifier}${revision}](${source.data.url}). Role: \`${role}\`.`;
  }).join('\n');

  root.children ??= [];
  root.children.push(...parseFragment([
    `## ${sourceHeading}`,
    '',
    ledger,
    '',
    `## ${disclosureHeading}`,
    '',
    `> ${disclosure}`,
  ].join('\n')));

  const body = String(processor.stringify(root as Parameters<typeof processor.stringify>[0])).trim();
  const canonical = new URL(notePath(note), site).toString();
  const markdownUrl = new URL(noteMarkdownPath(note), site).toString();
  const alternate = translation ? new URL(notePath(translation), site).toString() : undefined;
  const alternateMarkdown = translation ? new URL(noteMarkdownPath(translation), site).toString() : undefined;
  const frontmatter = [
    '---',
    `title: ${yamlString(note.data.title)}`,
    `description: ${yamlString(note.data.description)}`,
    `language: ${note.data.lang}`,
    `translationKey: ${note.data.translationKey}`,
    `kind: ${note.data.kind}`,
    `canonical: ${yamlString(canonical)}`,
    `markdown: ${yamlString(markdownUrl)}`,
    ...(alternate ? [`alternate: ${yamlString(alternate)}`, `alternateMarkdown: ${yamlString(alternateMarkdown!)}`] : []),
    ...(isoDate(note.data.publishedAt) ? [`publishedAt: ${isoDate(note.data.publishedAt)}`] : []),
    ...(isoDate(note.data.updatedAt) ? [`updatedAt: ${isoDate(note.data.updatedAt)}`] : []),
    `topics: ${JSON.stringify(note.data.topics)}`,
    `tags: ${JSON.stringify(note.data.tags)}`,
    'aiAssisted: true',
    '---',
  ].join('\n');

  return `${frontmatter}\n\n# ${note.data.title}\n\n> ${note.data.description}\n\n${body}\n`;
}

export function markdownSha256(markdown: string) {
  return createHash('sha256').update(markdown, 'utf8').digest('hex');
}
