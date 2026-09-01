import type { APIRoute } from 'astro';
import { profile } from '../data/profile';
import { renderSocialCard, socialCardResponse } from '../lib/social-card';

export const prerender = true;

export const GET: APIRoute = async () => {
  const image = await renderSocialCard({
    kind: 'profile',
    name: profile.name,
    role: profile.role,
    domain: profile.domain,
    headline: profile.headline,
    capabilities: profile.scope.capabilities,
    teams: profile.scope.teams,
    people: profile.scope.people,
    portraitPath: '/images/profile.jpeg',
  });

  return socialCardResponse(image);
};
