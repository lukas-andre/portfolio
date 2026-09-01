import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function parseCliArgs(values = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < values.length; index += 1) {
    const argument = values[index];
    if (!argument.startsWith('--')) continue;
    const separator = argument.indexOf('=');
    if (separator > 2) {
      args[argument.slice(2, separator)] = argument.slice(separator + 1);
      continue;
    }
    const key = argument.slice(2);
    const next = values[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function walk(directory, extension) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath, extension) : (extname(entry.name) === extension ? [fullPath] : []);
  });
}

function valueOfRef(ref) {
  if (typeof ref === 'string') return ref;
  if (ref && typeof ref === 'object' && typeof ref.id === 'string') return ref.id;
  return '';
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([A-Za-z][\w-]*)=["']([^"']*)["']/g)].map((match) => [match[1], match[2]]));
}

function validateSvg(svgPath, errors, label) {
  if (!existsSync(svgPath)) {
    errors.push(`${label}: diagram asset does not exist: ${relative(projectRoot, svgPath)}`);
    return;
  }
  const svg = readFileSync(svgPath, 'utf8');
  const unsafe = [/<script\b/i, /<foreignObject\b/i, /\bon[a-z]+\s*=/i, /javascript:/i, /(?:href|src)=["']https?:/i];
  if (unsafe.some((pattern) => pattern.test(svg))) errors.push(`${label}: unsafe SVG content in ${relative(projectRoot, svgPath)}`);
  if (!/<title\b/i.test(svg) || !/<desc\b/i.test(svg)) errors.push(`${label}: SVG needs both <title> and <desc>: ${relative(projectRoot, svgPath)}`);
}

export function loadNotes(root = projectRoot) {
  const notesDirectory = join(root, 'src/content/notes');
  return walk(notesDirectory, '.mdx').map((file) => {
    const raw = readFileSync(file, 'utf8');
    const parsed = matter(raw);
    return { file, raw, body: parsed.content, data: parsed.data };
  });
}

export function validateNotes({ root = projectRoot } = {}) {
  const errors = [];
  const notes = loadNotes(root);
  const sourcesDirectory = join(root, 'src/content/sources');
  const sourceIds = new Set(walk(sourcesDirectory, '.json').map((file) => relative(sourcesDirectory, file).replace(/\.json$/, '')));
  const groups = new Map();
  const allowedImports = new Set(['Cite', 'Callout', 'MyTake', 'NoteFigure']);

  for (const note of notes) {
    const label = relative(root, note.file);
    const { data, body, raw } = note;
    const requiredStrings = ['translationKey', 'lang', 'kind', 'title', 'description'];
    for (const field of requiredStrings) if (typeof data[field] !== 'string' || !data[field].trim()) errors.push(`${label}: missing ${field}`);
    if (!['es', 'en'].includes(data.lang)) errors.push(`${label}: lang must be es or en`);
    if (!['single', 'synthesis'].includes(data.kind)) errors.push(`${label}: kind must be single or synthesis`);
    if (typeof data.draft !== 'boolean') errors.push(`${label}: draft must be boolean`);
    if (data.aiAssisted !== true) errors.push(`${label}: aiAssisted must be true and disclosed`);
    if (data.draft === false && !data.publishedAt) errors.push(`${label}: a published note needs publishedAt`);
    const noteSegments = relative(join(root, 'src/content/notes'), note.file).split(sep);
    if (data.lang && noteSegments[0] !== data.lang) {
      errors.push(`${label}: folder does not match lang=${data.lang}`);
    }

    if (typeof data.translationKey === 'string') {
      const group = groups.get(data.translationKey) ?? [];
      group.push(note);
      groups.set(data.translationKey, group);
    }

    if (!Array.isArray(data.sources) || data.sources.length === 0) errors.push(`${label}: at least one source is required`);
    const declaredSources = new Set();
    for (const item of data.sources ?? []) {
      const id = valueOfRef(item?.ref);
      if (!id) errors.push(`${label}: invalid source ref`);
      else {
        declaredSources.add(id);
        if (!sourceIds.has(id)) errors.push(`${label}: unknown source ref ${id}`);
      }
      if (!['primary', 'supporting', 'context'].includes(item?.role)) errors.push(`${label}: invalid source role for ${id || 'unknown source'}`);
    }

    const citeTags = [...body.matchAll(/<Cite\b[^>]*\/>/g)].map((match) => match[0]);
    if (citeTags.length === 0) errors.push(`${label}: at least one inline <Cite /> is required`);
    for (const tag of citeTags) {
      const attrs = attributes(tag);
      if (!attrs.source || !sourceIds.has(attrs.source)) errors.push(`${label}: citation references unknown source ${attrs.source || '(missing)'}`);
      if (attrs.source && !declaredSources.has(attrs.source)) errors.push(`${label}: citation source ${attrs.source} is not declared in frontmatter`);
      if (!attrs.locator?.trim()) errors.push(`${label}: citation needs a locator`);
    }

    const imports = [...body.matchAll(/^import\s+(\w+)\s+from\s+["']([^"']+)["'];?$/gm)];
    for (const [, name, path] of imports) {
      if (!allowedImports.has(name) || path !== `../../../components/notes/${name}.astro`) errors.push(`${label}: import is outside the MDX component allowlist: ${name} from ${path}`);
    }
    if (imports.length !== allowedImports.size) errors.push(`${label}: import exactly Cite, Callout, MyTake, and NoteFigure`);

    const banned = [
      [/\/Users\//, 'absolute local path'],
      [/\b(?:TODO|TBD|POR VALIDAR)\b/i, 'unfinished editorial marker'],
      [/<script\b/i, 'script tag'],
      [/<foreignObject\b/i, 'foreignObject'],
      [/\bon[a-z]+\s*=/i, 'inline event handler'],
    ];
    for (const [pattern, description] of banned) if (pattern.test(raw)) errors.push(`${label}: contains banned ${description}`);

    if (!Array.isArray(data.diagrams) || data.diagrams.length < 2 || data.diagrams.length > 4) errors.push(`${label}: diagrams must contain 2–4 items`);
    for (const diagram of data.diagrams ?? []) {
      if (typeof diagram?.src !== 'string' || !diagram.src.startsWith('/images/notes/')) {
        errors.push(`${label}: diagram src must live under /images/notes/`);
        continue;
      }
      if (typeof diagram.alt !== 'string' || diagram.alt.trim().length < 12) errors.push(`${label}: diagram alt is too short for ${diagram.src}`);
      if (typeof diagram.caption !== 'string' || diagram.caption.trim().length < 12) errors.push(`${label}: diagram caption is too short for ${diagram.src}`);
      if (!body.includes(`src="${diagram.src}"`)) errors.push(`${label}: diagram is declared but not rendered: ${diagram.src}`);
      const asset = resolve(join(root, 'public'), `.${diagram.src}`);
      const publicRoot = resolve(join(root, 'public'));
      if (!asset.startsWith(`${publicRoot}/`)) errors.push(`${label}: diagram path escapes public/`);
      else validateSvg(asset, errors, label);
    }
  }

  for (const [translationKey, group] of groups) {
    const languages = group.map((note) => note.data.lang).sort();
    if (group.length !== 2 || languages.join(',') !== 'en,es') errors.push(`${translationKey}: requires exactly one ES and one EN note`);
    if (new Set(group.map((note) => note.data.draft)).size > 1) errors.push(`${translationKey}: translations must share draft status`);
    if (new Set(group.map((note) => note.data.kind)).size > 1) errors.push(`${translationKey}: translations must share kind`);
    const sourceSets = group.map((note) => JSON.stringify((note.data.sources ?? []).map((item) => valueOfRef(item.ref)).sort()));
    if (new Set(sourceSets).size > 1) errors.push(`${translationKey}: translations must declare the same sources`);
  }

  if (notes.length === 0) errors.push('No notes found');
  return { errors, notes };
}
