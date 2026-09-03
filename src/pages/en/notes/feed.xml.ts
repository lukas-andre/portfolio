import type { APIRoute } from 'astro';
import { buildNotesFeed } from '../../../lib/feed';

export const GET: APIRoute = async ({ site }) => new Response(
  await buildNotesFeed('en', site ?? new URL('https://lucashenry.dev')),
  { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' } },
);
