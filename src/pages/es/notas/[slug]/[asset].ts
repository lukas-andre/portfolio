import type { GetStaticPaths } from 'astro';
import { markdownGET, markdownStaticPaths } from '../../../../lib/note-markdown-route';

export const getStaticPaths: GetStaticPaths = () => markdownStaticPaths('es');
export const GET = markdownGET;
