import type { APIRoute } from 'astro';
import { buildPublicManifest } from '../../lib/publication-manifest';

export const GET: APIRoute = async ({ site }) => {
  const manifest = await buildPublicManifest(site ?? new URL('https://lucashenry.dev'));
  return new Response(`${JSON.stringify(manifest, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
};
