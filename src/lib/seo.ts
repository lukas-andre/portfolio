import { profile } from '../data/profile';

export const publicSite = new URL('https://lucashenry.dev/');

export function personSchema(site = publicSite) {
  return {
    '@type': 'Person',
    '@id': new URL('/#lucas', site).toString(),
    name: profile.fullName,
    alternateName: profile.name,
    jobTitle: `${profile.role} — ${profile.domain}`,
    url: site.toString(),
    image: new URL('/images/profile.jpeg', site).toString(),
    sameAs: [profile.links.linkedin, profile.links.github],
    worksFor: { '@type': 'Organization', name: profile.company },
    knowsAbout: ['Self Service', 'Engineering Leadership', 'Harness Engineering', 'Multi-Agent Orchestration', 'TypeScript', 'Go', 'React', 'E-commerce'],
  };
}

export function websiteSchema(site = publicSite) {
  return {
    '@type': 'WebSite',
    '@id': new URL('/#website', site).toString(),
    name: profile.name,
    url: site.toString(),
    inLanguage: ['en', 'es'],
    publisher: { '@id': new URL('/#lucas', site).toString() },
  };
}

export function blogSchema(lang: 'es' | 'en', site = publicSite) {
  const url = new URL(lang === 'es' ? '/es/notas/' : '/en/notes/', site).toString();
  return {
    '@type': 'Blog',
    '@id': `${url}#blog`,
    url,
    name: lang === 'es' ? 'Notas de Lucas Henry' : 'Lucas Henry’s Notes',
    inLanguage: lang,
    publisher: { '@id': new URL('/#lucas', site).toString() },
    isPartOf: websiteSchema(site),
  };
}

/** Keep JSON-LD data inside its script element even when a title contains HTML. */
export function serializeJsonLd(value: Record<string, unknown>) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
