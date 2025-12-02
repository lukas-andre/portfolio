# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (Astro)
npm run build    # Build for production
npm run preview  # Preview production build locally
npm start        # Serve built site via Node.js (for Railway deployment)
```

## Architecture

This is a personal portfolio built with Astro and React.

**Tech Stack:**
- Astro 4.x as static site generator
- React 18 for interactive components
- Framer Motion for animations
- TypeScript

**Project Structure:**
- `src/pages/index.astro` - Single-page layout composing all sections
- `src/layouts/Layout.astro` - Base HTML layout with boot screen, scroll progress, and visual overlays
- `src/components/*.astro` - Page sections (Hero, About, Skills, Experience, Demos, AISection, Contact, Footer, Navigation)
- `src/components/ui/*.tsx` - React UI components with animations (GlitchText, TypeWriter, BootScreen, NeuralCanvas, etc.)
- `src/styles/global.css` - Global styles
- `server.js` - Simple Node.js static file server for Railway deployment

**Key Patterns:**
- Astro components (`.astro`) are used for static page sections
- React components (`.tsx`) with `client:load` directive are used for interactive/animated elements
- Framer Motion is configured as SSR-external in `astro.config.mjs`
