import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import { publishedSitemapEntries } from './scripts/seo/sitemap.mjs';

const publicEntries = publishedSitemapEntries();

export default defineConfig({
  site: 'https://lucashenry.dev',
  trailingSlash: 'always',
  // Deliver the first paint with the compressed HTML instead of two blocking CSS requests.
  build: { inlineStylesheets: 'always' },
  integrations: [
    react(),
    mdx(),
    {
      name: 'isolated-vite-cache',
      hooks: {
        'astro:config:setup': ({ command, config, updateConfig }) => {
          // Astro 4's content sync also starts a Vite optimizer. Builds, checks,
          // and a second dev server must not replace an active preview's deps.
          const namespace = command === 'dev' ? `dev-${config.server.port}` : command;
          updateConfig({
            vite: {
              cacheDir: fileURLToPath(new URL(`./node_modules/.vite/${namespace}/`, config.root)),
            },
          });
        },
      },
    },
    sitemap({
      filter: (page) => publicEntries.has(new URL(page).pathname),
      serialize: (item) => ({ ...item, ...publicEntries.get(new URL(item.url).pathname) }),
    }),
  ],
  vite: {
    ssr: {
      noExternal: ['framer-motion']
    }
  }
});
