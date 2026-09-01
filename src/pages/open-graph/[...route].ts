import { OGImageRoute } from 'astro-og-canvas';
import { getVisibleNotes, localSlug, localeConfig } from '../../lib/notes';

const entries = await getVisibleNotes();
const pages = Object.fromEntries(entries.map((entry) => {
  const segment = localeConfig[entry.data.lang].segment;
  return [`${entry.data.lang}/${segment}/${localSlug(entry)}`, entry.data];
}));

export const { getStaticPaths, GET } = OGImageRoute({
  param: 'route',
  pages,
  getImageOptions: (_path, page) => ({
    title: page.title,
    description: page.description,
    bgGradient: [[13, 13, 11], [30, 30, 26]],
    border: { color: [212, 165, 116], width: 12, side: 'inline-start' },
    padding: 72,
    font: {
      title: { color: [245, 242, 235], weight: 'SemiBold', size: 64, lineHeight: 1.05 },
      description: { color: [201, 196, 184], weight: 'Normal', size: 28, lineHeight: 1.35 },
    },
  }),
});
