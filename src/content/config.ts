import { defineCollection, reference, z } from 'astro:content';

const sources = defineCollection({
  type: 'data',
  schema: z.object({
    type: z.enum(['paper', 'dataset', 'official-doc', 'article']),
    title: z.string(),
    authors: z.array(z.string()).min(1),
    url: z.string().url(),
    identifier: z.string(),
    version: z.string().optional(),
    publishedAt: z.coerce.date().optional(),
    accessedAt: z.coerce.date(),
  }),
});

const notes = defineCollection({
  type: 'content',
  schema: z.object({
    translationKey: z.string(),
    lang: z.enum(['es', 'en']),
    kind: z.enum(['single', 'synthesis']),
    title: z.string(),
    description: z.string(),
    draft: z.boolean().default(true),
    publishedAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string()).min(1),
    sources: z.array(z.object({
      ref: reference('sources'),
      role: z.enum(['primary', 'supporting', 'context']),
    })).min(1),
    aiAssisted: z.boolean(),
    diagrams: z.array(z.object({
      src: z.string(),
      alt: z.string().min(12),
      caption: z.string().min(12),
    })).min(2).max(4),
  }),
});

export const collections = { notes, sources };
