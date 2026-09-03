import type { APIRoute, GetStaticPaths } from 'astro';
import { getEntry } from 'astro:content';
import { profile } from '../../data/profile';
import { noteSocialCardPath } from '../../lib/diagrams';
import { getVisibleNotes, localSlug, localeConfig } from '../../lib/notes';
import {
  renderSocialCard,
  socialCardResponse,
  type SocialCardInput,
} from '../../lib/social-card';

type SocialCardRouteProps = { card: SocialCardInput; immutable: boolean };

function profileCard(): SocialCardInput {
  return {
    kind: 'profile',
    name: profile.name,
    role: profile.role,
    domain: profile.domain,
    headline: profile.headline,
    capabilities: profile.scope.capabilities,
    teams: profile.scope.teams,
    people: profile.scope.people,
    portraitPath: '/images/profile.jpeg',
  };
}

function noteDate(entry: Awaited<ReturnType<typeof getVisibleNotes>>[number]) {
  return entry.data.publishedAt ?? entry.data.updatedAt ?? new Date('2026-01-01');
}

export const getStaticPaths: GetStaticPaths = async () => {
  const entries = await getVisibleNotes();
  const profileInput = profileCard();
  const paths: Array<{ params: { route: string }; props: SocialCardRouteProps }> = [
    { params: { route: 'v2/home.png' }, props: { card: profileInput, immutable: false } },
    { params: { route: 'v3/home.png' }, props: { card: profileInput, immutable: false } },
    { params: { route: 'v4/home.png' }, props: { card: profileInput, immutable: false } },
  ];

  for (const entry of entries) {
    const featured = await getEntry('diagrams', entry.data.featuredVisual);
    if (!featured) throw new Error(`Missing featured visual ${entry.data.featuredVisual}`);
    const copy = featured.data.copy[entry.data.lang];
    const card: SocialCardInput = {
      kind: 'note',
      noteKind: entry.data.kind,
      title: entry.data.title,
      lang: entry.data.lang,
      issue: Number(entry.data.issue),
      dateLabel: new Intl.DateTimeFormat(entry.data.lang, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(noteDate(entry)),
      tags: entry.data.tags,
      visual: {
        title: copy.title,
        takeaway: copy.takeaway,
        items: featured.data.model.items.map((item) => ({
          title: copy.labels[item.id]?.title ?? item.id,
          tone: item.tone,
        })),
      },
    };

    const segment = localeConfig[entry.data.lang].segment;
    const localPath = `${entry.data.lang}/${segment}/${localSlug(entry)}`;
    const immutableRoute = noteSocialCardPath(entry, featured).replace(/^\/open-graph\//, '');
    paths.push(
      { params: { route: immutableRoute }, props: { card, immutable: true } },
      { params: { route: `${localPath}.png` }, props: { card, immutable: false } },
      { params: { route: `v2/${localPath}.png` }, props: { card, immutable: false } },
      { params: { route: `v3/${localPath}.png` }, props: { card, immutable: false } },
      { params: { route: `v4/${localPath}.png` }, props: { card, immutable: false } },
    );
  }

  return paths;
};

export const GET: APIRoute<SocialCardRouteProps> = async ({ props }) => (
  socialCardResponse(await renderSocialCard(props.card), props.immutable)
);
