import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const site = 'https://lucashenry.dev';
const content = new URL('../../src/content/', import.meta.url);

/** Only editorially published editions enter discovery, including draft-inclusive previews. */
export function publishedSitemapEntries() {
  const entries = new Map([['/', {}], ['/resume/', {}]]);
  const indexes = [{ lang: 'es', url: `${site}/es/notas/` }, { lang: 'en', url: `${site}/en/notes/` }];
  for (const index of indexes) entries.set(new URL(index.url).pathname, { links: [...indexes, { lang: 'x-default', url: indexes[0].url }] });
  for (const file of readdirSync(new URL('publications/', content)).filter((file) => file.endsWith('.json'))) {
    const work = JSON.parse(readFileSync(new URL(`publications/${file}`, content), 'utf8'));
    if (work.visibility !== 'published') continue;
    const links = ['es', 'en'].map((lang) => ({ lang, url: `${site}/${lang}/${lang === 'es' ? 'notas' : 'notes'}/${work.editions[lang].slug}/` }));
    links.push({ lang: 'x-default', url: links[0].url });
    for (const { lang, url } of links.filter((entry) => entry.lang !== 'x-default')) {
      const source = fileURLToPath(new URL(`notes/${lang}/${work.editions[lang].slug}.mdx`, content));
      const { data } = matter(readFileSync(source, 'utf8'));
      const dates = [work.publishedAt, data.updatedAt].filter(Boolean).map((value) => new Date(value).getTime()).filter(Number.isFinite);
      entries.set(new URL(url).pathname, { links, ...(dates.length ? { lastmod: new Date(Math.max(...dates)).toISOString() } : {}) });
    }
  }
  return entries;
}
