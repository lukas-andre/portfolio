import { OGImageRoute } from 'astro-og-canvas';
import type { APIRoute } from 'astro';
import { getVisibleNotes, localSlug, localeConfig } from '../../lib/notes';

const entries = await getVisibleNotes();
const pages = Object.fromEntries(entries.map((entry) => {
  const segment = localeConfig[entry.data.lang].segment;
  return [`${entry.data.lang}/${segment}/${localSlug(entry)}`, entry.data];
}));

const imageRoute = OGImageRoute({
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

export const getStaticPaths = imageRoute.getStaticPaths;
export const GET: APIRoute = async (context) => {
  const response = await imageRoute.GET(context);
  const headers = new Headers(response.headers);
  if (response.ok) headers.set('Content-Type', 'image/png');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
