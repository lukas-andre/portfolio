import { getPublishedNotes, notePath, type NoteLanguage } from './notes';

function xml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
export async function buildNotesFeed(lang: NoteLanguage, site = new URL('https://lucashenry.dev')) {
  const notes = await getPublishedNotes(lang);
  const indexPath = lang === 'es' ? '/es/notas/' : '/en/notes/';
  const feedPath = `${indexPath}feed.xml`;
  const title = lang === 'es' ? 'Notas de Lucas Henry' : 'Lucas Henry’s Notes';
  const description = lang === 'es'
    ? 'Ensayos y notas visuales sobre software, agentes, tecnología y evidencia.'
    : 'Visual essays and notes about software, agents, technology, and evidence.';
  const items = notes.map((note) => {
    const url = new URL(notePath(note), site).toString();
    const date = note.data.publishedAt ?? note.data.updatedAt ?? new Date('2026-01-01');
    return [
      '<item>',
      `<title>${xml(note.data.title)}</title>`,
      `<link>${xml(url)}</link>`,
      `<guid isPermaLink="true">${xml(url)}</guid>`,
      `<description>${xml(note.data.description)}</description>`,
      `<pubDate>${date.toUTCString()}</pubDate>`,
      '</item>',
    ].join('');
  }).join('');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    `<title>${xml(title)}</title>`,
    `<link>${xml(new URL(indexPath, site).toString())}</link>`,
    `<description>${xml(description)}</description>`,
    `<language>${lang}</language>`,
    `<atom:link href="${xml(new URL(feedPath, site).toString())}" rel="self" type="application/rss+xml" />`,
    items,
    '</channel>',
    '</rss>',
  ].join('');
}
