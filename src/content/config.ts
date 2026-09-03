import { defineCollection, reference, z } from 'astro:content';

const sources = defineCollection({
  type: 'data',
  schema: z.object({
    type: z.enum(['paper', 'dataset', 'official-doc', 'article', 'talk']),
    title: z.string(),
    authors: z.array(z.string()).min(1),
    url: z.string().url(),
    identifier: z.string(),
    version: z.string().optional(),
    license: z.string().optional(),
    acquisitionMethod: z.string().optional(),
    publishedAt: z.coerce.date().optional(),
    accessedAt: z.coerce.date(),
  }),
});

const approval = z.object({
  approvedAt: z.coerce.date(),
  approvedBy: z.literal('Lucas'),
});

const publications = defineCollection({
  type: 'data',
  schema: z.object({
    schemaVersion: z.literal(1),
    kind: z.enum(['single', 'synthesis', 'essay']),
    issue: z.string().regex(/^\d{3}$/),
    topics: z.array(z.string()).min(1),
    related: z.array(z.string()).default([]),
    sourceRoles: z.array(z.object({
      ref: reference('sources'),
      role: z.enum(['primary', 'supporting', 'context']),
    })).min(1),
    editions: z.object({
      es: z.object({ slug: z.string() }),
      en: z.object({ slug: z.string() }),
    }),
    visuals: z.array(z.string()).max(4).default([]),
    featuredVisual: z.string().optional(),
    researchPacket: z.string().optional(),
    researchDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    angleApproval: approval.extend({
      readerPromise: z.string().min(20),
      thesis: z.string().min(20),
      counterpoint: z.string().min(20),
    }).optional(),
    releaseApproval: approval.extend({
      digest: z.string().regex(/^[a-f0-9]{64}$/),
      migratedFromPublishedState: z.boolean().optional(),
    }).optional(),
    visibility: z.enum(['draft', 'published']).default('draft'),
    publishedAt: z.coerce.date().optional(),
  }),
});

const diagramLabel = z.object({
  eyebrow: z.string().optional(),
  title: z.string().min(1),
  detail: z.string().optional(),
  valueLabel: z.string().optional(),
});

const diagramCopy = z.object({
  title: z.string().min(3),
  question: z.string().min(8),
  takeaway: z.string().min(12),
  alt: z.string().min(12),
  caption: z.string().min(12),
  labels: z.record(diagramLabel),
  note: z.string().optional(),
});

const diagrams = defineCollection({
  type: 'data',
  schema: z.object({
    schemaVersion: z.literal(1),
    translationKey: z.string(),
    kind: z.enum(['comparison', 'layers', 'steps', 'loop', 'matrix', 'timeline', 'graph', 'chart']),
    claimRefs: z.array(z.string()).min(1),
    model: z.object({
      items: z.array(z.object({
        id: z.string(),
        tone: z.enum(['ink', 'amber', 'sage', 'rust', 'muted']).optional(),
        value: z.number().optional(),
        group: z.string().optional(),
      })).min(2).max(8),
      edges: z.array(z.object({
        from: z.string(),
        to: z.string(),
        kind: z.enum(['solid', 'dashed']).optional(),
      })).optional(),
      maxValue: z.number().positive().optional(),
    }),
    copy: z.object({ es: diagramCopy, en: diagramCopy }),
    presentation: z.object({
      direction: z.enum(['auto', 'horizontal', 'vertical']).default('auto'),
      density: z.enum(['compact', 'normal']).default('normal'),
      emphasis: z.array(z.string()).optional(),
    }),
    artwork: z.object({
      es: z.string(),
      en: z.string(),
    }).optional(),
  }),
});

const notes = defineCollection({
  type: 'content',
  schema: z.object({
    translationKey: z.string(),
    lang: z.enum(['es', 'en']),
    title: z.string(),
    description: z.string(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string()).min(1),
    aiAssisted: z.boolean(),
  }),
});

export const collections = { notes, sources, publications, diagrams };
