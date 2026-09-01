import type { APIRoute, GetStaticPaths } from 'astro';
import { profile } from '../../data/profile';
import { getVisibleNotes, localSlug, localeConfig } from '../../lib/notes';
import {
  renderSocialCard,
  socialCardResponse,
  type SocialCardInput,
} from '../../lib/social-card';

type SocialCardRouteProps = { card: SocialCardInput };

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
  const translationDates = new Map<string, number>();

  for (const entry of entries) {
    const timestamp = noteDate(entry).getTime();
    const existing = translationDates.get(entry.data.translationKey);
    translationDates.set(entry.data.translationKey, existing === undefined ? timestamp : Math.min(existing, timestamp));
  }

  const issueByTranslation = new Map(
    [...translationDates.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([translationKey], index) => [translationKey, index + 1]),
  );

  const paths: Array<{ params: { route: string }; props: SocialCardRouteProps }> = [
    {
      params: { route: 'v2/home.png' },
      props: { card: profileCard() },
    },
    {
      params: { route: 'v3/home.png' },
      props: { card: profileCard() },
    },
    {
      params: { route: 'v4/home.png' },
      props: { card: profileCard() },
    },
  ];

  for (const entry of entries) {
    const segment = localeConfig[entry.data.lang].segment;
    const localPath = `${entry.data.lang}/${segment}/${localSlug(entry)}`;
    const date = noteDate(entry);
    const card: SocialCardInput = {
      kind: 'note',
      title: entry.data.title,
      lang: entry.data.lang,
      issue: issueByTranslation.get(entry.data.translationKey) ?? 1,
      dateLabel: new Intl.DateTimeFormat(entry.data.lang, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date),
      tags: entry.data.tags,
      diagramPath: entry.data.diagrams[0].src,
    };

    paths.push(
      { params: { route: `${localPath}.png` }, props: { card } },
      { params: { route: `v2/${localPath}.png` }, props: { card } },
      { params: { route: `v3/${localPath}.png` }, props: { card } },
      { params: { route: `v4/${localPath}.png` }, props: { card } },
    );
  }

  return paths;
};

export const GET: APIRoute<SocialCardRouteProps> = async ({ props }) => (
  socialCardResponse(await renderSocialCard(props.card))
);
