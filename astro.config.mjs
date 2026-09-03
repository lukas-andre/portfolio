import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://lucashenry.dev',
  integrations: [
    react(),
    mdx(),
    sitemap({
      filter: (page) => !(
        page.endsWith('.md')
        || page.endsWith('.xml')
        || page.endsWith('.json')
        || page.endsWith('.txt')
        || page.includes('/open-graph/')
        || page.includes('/images/notes/diagrams/')
      ),
    }),
  ],
  vite: {
    ssr: {
      noExternal: ['framer-motion']
    }
  }
});
