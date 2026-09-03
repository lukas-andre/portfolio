import type { GetStaticPaths } from 'astro';
import { markdownGET, markdownStaticPaths } from '../../../../lib/note-markdown-route';

export const getStaticPaths: GetStaticPaths = () => markdownStaticPaths('en');
export const GET = markdownGET;
