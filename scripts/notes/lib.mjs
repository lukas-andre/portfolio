import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const VALIDATION_TIERS = ['structure', 'editorial', 'render', 'release'];

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

function collection(root, name) {
  const directory = join(root, 'src/content', name);
  return walk(directory, '.json').map((file) => {
    const raw = readFileSync(file, 'utf8');
    return {
      id: relative(directory, file).split(sep).join('/').replace(/\.json$/, ''),
      file,
      raw,
      data: JSON.parse(raw),
    };
  });
}

export function loadNotes(root = projectRoot) {
  const directory = join(root, 'src/content/notes');
  return walk(directory, '.mdx').map((file) => {
    const raw = readFileSync(file, 'utf8');
    const parsed = matter(raw);
    return {
      id: relative(directory, file).split(sep).join('/').replace(/\.mdx$/, ''),
      slug: basename(file, '.mdx'),
      file,
      raw,
      body: parsed.content,
      data: parsed.data,
    };
  });
}

export const loadPublications = (root = projectRoot) => collection(root, 'publications');
export const loadDiagrams = (root = projectRoot) => collection(root, 'diagrams');
export const loadSources = (root = projectRoot) => collection(root, 'sources');

export function loadWorkspace(root = projectRoot) {
  const notes = loadNotes(root);
  const publications = loadPublications(root);
  const diagrams = loadDiagrams(root);
  const sources = loadSources(root);
  return {
    root,
    notes,
    publications,
    diagrams,
    sources,
    publicationById: new Map(publications.map((entry) => [entry.id, entry])),
    diagramById: new Map(diagrams.map((entry) => [entry.id, entry])),
    sourceById: new Map(sources.map((entry) => [entry.id, entry])),
  };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function atomicWriteJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  renameSync(temporary, file);
}

export function computeReleaseDigest(root = projectRoot, key) {
  const workspace = loadWorkspace(root);
  const publication = workspace.publicationById.get(key);
  if (!publication) throw new Error(`Unknown publication: ${key}`);
  const work = structuredClone(publication.data);
  delete work.releaseApproval;
  delete work.visibility;
  delete work.publishedAt;
  const notes = workspace.notes
    .filter((note) => note.data.translationKey === key)
    .sort((a, b) => a.data.lang.localeCompare(b.data.lang))
    .map((note) => ({ id: note.id, bytes: note.raw }));
  const diagrams = (publication.data.visuals ?? [])
    .map((id) => workspace.diagramById.get(id))
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((entry) => ({ id: entry.id, data: entry.data }));
  const publicRoot = resolve(root, 'public');
  const artwork = diagrams.flatMap((entry) => ['es', 'en'].flatMap((lang) => {
    const publicPath = entry.data.artwork?.[lang];
    if (!publicPath) return [];
    const file = resolve(publicRoot, publicPath.replace(/^\/+/, ''));
    if (!file.startsWith(`${publicRoot}${sep}`)) throw new Error(`Artwork escapes public/: ${publicPath}`);
    return [{ id: entry.id, lang, path: publicPath, sha256: existsSync(file) ? sha256(readFileSync(file)) : 'missing' }];
  }));
  const sources = (publication.data.sourceRoles ?? [])
    .map(({ ref }) => workspace.sourceById.get(typeof ref === 'string' ? ref : ref?.id))
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((entry) => ({ id: entry.id, data: entry.data }));
  return sha256(stableStringify({ work, notes, diagrams, artwork, sources }));
}

function attrs(tag) {
  return Object.fromEntries([...tag.matchAll(/([A-Za-z][\w-]*)=["']([^"']*)["']/g)].map((match) => [match[1], match[2]]));
}

function refId(ref) {
  if (typeof ref === 'string') return ref;
  return ref && typeof ref.id === 'string' ? ref.id : '';
}

function rank(tier) {
  return VALIDATION_TIERS.indexOf(tier);
}

function diagnostic(code, file, pointer, message, hint) {
  return { severity: 'error', code, file, pointer, message, hint };
}

export function formatDiagnostic(item) {
  const location = [item.file, item.pointer].filter(Boolean).join('#');
  return `[${item.code}] ${location ? `${location}: ` : ''}${item.message}${item.hint ? ` Fix: ${item.hint}` : ''}`;
}

export function validateNotes({ root = projectRoot, tier = 'editorial', key, publishedOnly = false } = {}) {
  if (!VALIDATION_TIERS.includes(tier)) throw new Error(`Unknown validation tier: ${tier}`);
  const workspace = loadWorkspace(root);
  const diagnostics = [];
  const add = (code, file, pointer, message, hint) => diagnostics.push(diagnostic(code, file ? relative(root, file) : '', pointer, message, hint));
  const allowedImports = new Set(['Cite', 'Callout', 'MyTake', 'NoteFigure']);

  if (workspace.publications.length === 0) add('PUB000', '', '', 'No publication manifests found.', 'Create src/content/publications/<translationKey>.json.');
  if (key && !workspace.publicationById.has(key)) add('PUB001', '', key, `Unknown publication ${key}.`, 'Run notes:status without --key to list work IDs.');

  const sourceIdentity = new Map();
  for (const source of workspace.sources) {
    const identity = `${source.data.url ?? ''}#${source.data.version ?? source.data.identifier ?? ''}`;
    const previous = sourceIdentity.get(identity);
    if (previous) add('SRC003', source.file, '/url', `Source duplicates ${previous}.`, 'Reuse one canonical source record per exact version.');
    else sourceIdentity.set(identity, source.id);
  }

  const selected = workspace.publications.filter((publication) => (
    (!key || publication.id === key) && (!publishedOnly || publication.data.visibility === 'published')
  ));

  for (const publication of selected) {
    const work = publication.data;
    const workFile = publication.file;
    if (work.schemaVersion !== 1) add('PUB002', workFile, '/schemaVersion', 'schemaVersion must be 1.', 'Migrate the manifest before editing content.');
    if (!['single', 'synthesis', 'essay'].includes(work.kind)) add('PUB003', workFile, '/kind', 'Invalid publication kind.', 'Use single, synthesis, or essay.');
    if (!/^\d{3}$/.test(work.issue ?? '')) add('PUB004', workFile, '/issue', 'Issue must be a stable three-digit ID.', 'Assign an unused issue such as 006.');
    if (!Array.isArray(work.topics) || work.topics.length === 0) add('PUB005', workFile, '/topics', 'At least one stable topic ID is required.', 'Add non-localized topic IDs.');
    if (!/^[a-f0-9]{64}$/.test(work.researchDigest ?? '')) add('PUB006', workFile, '/researchDigest', 'researchDigest must be SHA-256.', 'Sync the approved Brain research packet.');
    const packetPath = brainPacketPath(work.researchPacket, root);
    const packetRequired = process.env.REQUIRE_RESEARCH_PACKETS === 'true';
    let packetClaims;
    if (!packetPath || !existsSync(packetPath)) {
      if (packetRequired) add('PKT001', workFile, '/researchPacket', 'ResearchPacket is unavailable.', 'Set LUCAS_BRAIN_ROOT or generate the referenced packet.');
    } else {
      const packetBytes = readFileSync(packetPath);
      if (sha256(packetBytes) !== work.researchDigest) add('PKT002', workFile, '/researchDigest', 'ResearchPacket digest does not match the exact packet bytes.', 'Run notes:sync-research after regenerating the packet.');
      try {
        const packet = JSON.parse(packetBytes);
        if (packet.schemaVersion !== 1 || packet.id !== publication.id) add('PKT003', workFile, '/researchPacket', 'ResearchPacket identity or schema is invalid.', 'Regenerate a schemaVersion 1 packet with the same work ID.');
        packetClaims = new Set((packet.evidence?.claims ?? []).map((claim) => claim.id));
      } catch (error) {
        add('PKT004', workFile, '/researchPacket', `ResearchPacket is not valid JSON: ${error.message}`, 'Regenerate the packet from the Brain dossier.');
      }
    }
    if (!work.editions?.es?.slug || !work.editions?.en?.slug) add('PUB007', workFile, '/editions', 'Both ES and EN slugs are required.', 'Declare both localized routes.');
    if (!Array.isArray(work.sourceRoles) || work.sourceRoles.length === 0) add('PUB008', workFile, '/sourceRoles', 'At least one source is required.', 'Register a source and its role.');
    if (!Array.isArray(work.visuals) || work.visuals.length < 2 || work.visuals.length > 4) add('PUB009', workFile, '/visuals', 'A work needs 2–4 visual IDs.', 'Add or remove DiagramSpecs.');
    if (!(work.visuals ?? []).includes(work.featuredVisual)) add('PUB010', workFile, '/featuredVisual', 'featuredVisual must be one of visuals.', 'Choose an explicit cover visual.');
    for (const related of work.related ?? []) {
      if (!workspace.publicationById.has(related)) add('PUB011', workFile, '/related', `Unknown related work ${related}.`, 'Use an existing translationKey.');
      if (related === publication.id) add('PUB012', workFile, '/related', 'A work cannot relate to itself.', 'Remove the self-reference.');
    }

    const notes = workspace.notes.filter((note) => note.data.translationKey === publication.id);
    const languages = notes.map((note) => note.data.lang).sort();
    if (notes.length !== 2 || languages.join(',') !== 'en,es') add('PAIR001', workFile, '/editions', 'Exactly one ES and one EN edition are required.', 'Create the missing localized MDX or remove the duplicate.');

    for (const note of notes) {
      const label = note.file;
      for (const field of ['translationKey', 'lang', 'title', 'description']) {
        if (typeof note.data[field] !== 'string' || !note.data[field].trim()) add('NOTE001', label, `/${field}`, `Missing ${field}.`, `Add ${field} to localized frontmatter.`);
      }
      if (!['es', 'en'].includes(note.data.lang)) add('NOTE002', label, '/lang', 'lang must be es or en.', 'Match the locale folder.');
      if (note.data.aiAssisted !== true) add('NOTE003', label, '/aiAssisted', 'AI assistance must remain disclosed.', 'Set aiAssisted: true.');
      const forbiddenShared = ['kind', 'draft', 'publishedAt', 'sources', 'diagrams'];
      for (const field of forbiddenShared) if (field in note.data) add('NOTE004', label, `/${field}`, `${field} belongs in PublicationWork, not localized MDX.`, `Remove ${field} from this frontmatter.`);
      const expectedSlug = work.editions?.[note.data.lang]?.slug;
      if (expectedSlug && note.slug !== expectedSlug) add('PAIR002', label, '/slug', `Filename ${note.slug} does not match manifest slug ${expectedSlug}.`, 'Change the manifest or rename the edition deliberately.');
      const localeFolder = relative(join(root, 'src/content/notes'), note.file).split(sep)[0];
      if (note.data.lang && localeFolder !== note.data.lang) add('PAIR003', label, '/lang', `Folder ${localeFolder} does not match lang=${note.data.lang}.`, 'Move the file to the matching locale.');
    }

    for (const sourceRole of work.sourceRoles ?? []) {
      const id = refId(sourceRole.ref);
      if (!workspace.sourceById.has(id)) add('SRC001', workFile, '/sourceRoles', `Unknown source ${id || '(missing)'}.`, 'Register the source under src/content/sources.');
      if (!['primary', 'supporting', 'context'].includes(sourceRole.role)) add('SRC002', workFile, '/sourceRoles', `Invalid role for ${id}.`, 'Use primary, supporting, or context.');
    }

    for (const visualId of work.visuals ?? []) {
      const diagram = workspace.diagramById.get(visualId);
      if (!diagram) {
        add('VIS001', workFile, '/visuals', `Unknown DiagramSpec ${visualId}.`, 'Create the missing diagram JSON.');
        continue;
      }
      if (diagram.data.schemaVersion !== 1) add('VIS002', diagram.file, '/schemaVersion', 'Diagram schemaVersion must be 1.', 'Migrate the spec.');
      if (diagram.data.translationKey !== publication.id) add('VIS003', diagram.file, '/translationKey', `Diagram belongs to ${diagram.data.translationKey}, expected ${publication.id}.`, 'Fix its ownership.');
      if (!Array.isArray(diagram.data.claimRefs) || diagram.data.claimRefs.length === 0) add('VIS004', diagram.file, '/claimRefs', 'Diagram must reference at least one evidence claim.', 'Link it to the ResearchPacket ledger.');
      for (const claimRef of diagram.data.claimRefs ?? []) {
        if (!/^claim-\d{2}$/.test(claimRef)) add('VIS010', diagram.file, '/claimRefs', `Invalid claim reference ${claimRef}.`, 'Use a stable claim ID such as claim-01.');
        if (packetClaims && !packetClaims.has(claimRef)) add('VIS011', diagram.file, '/claimRefs', `Unknown ResearchPacket claim ${claimRef}.`, 'Reference a claim that exists in the current packet.');
      }
      const items = diagram.data.model?.items ?? [];
      if (items.length < 2 || items.length > 8) add('VIS005', diagram.file, '/model/items', 'Diagram must contain 2–8 semantic items.', 'Split an overloaded visual or add the missing comparison item.');
      for (const lang of ['es', 'en']) {
        const copy = diagram.data.copy?.[lang];
        if (!copy?.title || !copy.question || !copy.takeaway || !copy.alt || !copy.caption) add('VIS006', diagram.file, `/copy/${lang}`, `Incomplete ${lang} diagram copy.`, 'Add title, question, takeaway, alt, and caption.');
        for (const item of items) if (!copy?.labels?.[item.id]?.title) add('VIS007', diagram.file, `/copy/${lang}/labels/${item.id}`, `Missing ${lang} label for ${item.id}.`, 'Localize the semantic item.');
        const artwork = diagram.data.artwork?.[lang];
        if (artwork) {
          const publicRoot = resolve(root, 'public');
          const artworkFile = resolve(publicRoot, artwork.replace(/^\/+/, ''));
          if (!artwork.startsWith('/images/notes/') || !artwork.endsWith('.svg') || !artworkFile.startsWith(`${publicRoot}${sep}`)) {
            add('VIS012', diagram.file, `/artwork/${lang}`, `Invalid ${lang} artwork path ${artwork}.`, 'Use an absolute /images/notes/...svg path inside public/.');
          } else if (!existsSync(artworkFile)) {
            add('VIS013', diagram.file, `/artwork/${lang}`, `Missing ${lang} artwork ${artwork}.`, 'Add the referenced SVG or remove artwork to use the generated Mermaid fallback.');
          }
        }
      }
      const itemIds = new Set(items.map((item) => item.id));
      for (const edge of diagram.data.model?.edges ?? []) {
        if (!itemIds.has(edge.from) || !itemIds.has(edge.to)) add('VIS008', diagram.file, '/model/edges', `Edge ${edge.from}→${edge.to} references an unknown item.`, 'Use item IDs declared in model.items.');
      }
    }

    const shouldValidateEditorial = rank(tier) >= rank('editorial') && (Boolean(work.angleApproval) || Boolean(key) || work.visibility === 'published');
    if (rank(tier) >= rank('editorial') && !work.angleApproval && (key || work.visibility === 'published')) add('GATE001', workFile, '/angleApproval', 'Editorial work cannot proceed without angle approval.', 'Record Lucas’s reader promise, thesis, and counterpoint.');
    if (shouldValidateEditorial) {
      const declaredSources = new Set((work.sourceRoles ?? []).map((item) => refId(item.ref)));
      for (const note of notes) {
        const imports = [...note.body.matchAll(/^import\s+(\w+)\s+from\s+["']([^"']+)["'];?$/gm)];
        for (const [, name, path] of imports) {
          if (!allowedImports.has(name) || path !== `../../../components/notes/${name}.astro`) add('MDX001', note.file, '', `Import outside allowlist: ${name} from ${path}.`, 'Use the four audited note components only.');
        }
        if (imports.length !== allowedImports.size || new Set(imports.map((match) => match[1])).size !== allowedImports.size) add('MDX002', note.file, '', 'Import exactly Cite, Callout, MyTake, and NoteFigure.', 'Restore the standard imports.');
        const citations = [...note.body.matchAll(/<Cite\b[^>]*\/>/g)].map((match) => attrs(match[0]));
        if (citations.length === 0) add('CITE001', note.file, '', 'At least one inline citation is required.', 'Add a Cite with an exact locator.');
        for (const citation of citations) {
          if (!workspace.sourceById.has(citation.source)) add('CITE002', note.file, '', `Citation references unknown source ${citation.source || '(missing)'}.`, 'Register or correct the source ID.');
          if (citation.source && !declaredSources.has(citation.source)) add('CITE003', note.file, '', `Citation ${citation.source} is absent from sourceRoles.`, 'Declare its role in PublicationWork.');
          if (!citation.locator?.trim()) add('CITE004', note.file, '', 'Citation needs an exact locator.', 'Add section, page, figure, table, or timestamp.');
        }
        const figures = [...note.body.matchAll(/<NoteFigure\b[^>]*\/>/g)].map((match) => attrs(match[0]).id).filter(Boolean);
        const expected = [...(work.visuals ?? [])];
        if (stableStringify(figures) !== stableStringify(expected)) add('VIS009', note.file, '', 'Rendered DiagramSpec order differs from PublicationWork.visuals.', 'Render each visual once with <NoteFigure id="…" /> in manifest order.');
        const banned = [[/\/Users\//, 'absolute local path'], [/\b(?:TODO|TBD|POR VALIDAR)\b/, 'unfinished marker'], [/<script\b/i, 'script tag'], [/<foreignObject\b/i, 'foreignObject'], [/\bon[a-z]+\s*=/i, 'inline event handler']];
        for (const [pattern, description] of banned) if (pattern.test(note.raw)) add('MDX003', note.file, '', `Contains banned ${description}.`, 'Remove private, unfinished, or executable content.');
      }
    }

    if (rank(tier) >= rank('release')) {
      if (work.visibility !== 'published' && key) add('GATE002', workFile, '/visibility', 'Release validation requires visibility=published.', 'Approve and run notes:publish.');
      if (work.visibility === 'published' && !work.publishedAt) add('GATE003', workFile, '/publishedAt', 'Published work needs publishedAt.', 'Set it through notes:publish.');
      if (work.visibility === 'published') {
        const digest = computeReleaseDigest(root, publication.id);
        if (!work.releaseApproval) add('GATE004', workFile, '/releaseApproval', 'Published work has no release approval.', 'Run notes:approve-release after Lucas reviews the rendered bytes.');
        else if (work.releaseApproval.digest !== digest) add('GATE005', workFile, '/releaseApproval/digest', 'Release approval is stale.', 'Re-run review and notes:approve-release; do not publish changed bytes silently.');
      }
    }
  }

  const errors = diagnostics.map(formatDiagnostic);
  return { errors, diagnostics, notes: workspace.notes, publications: selected, diagrams: workspace.diagrams, sources: workspace.sources };
}

export function publicationStatus(root = projectRoot, key) {
  const workspace = loadWorkspace(root);
  const publication = workspace.publicationById.get(key);
  if (!publication) throw new Error(`Unknown publication: ${key}`);
  const structure = validateNotes({ root, key, tier: 'structure' });
  const render = validateNotes({ root, key, tier: 'render' });
  const digest = computeReleaseDigest(root, key);
  const approvalCurrent = publication.data.releaseApproval?.digest === digest;
  let phase = 'drafting';
  let blockers = render.diagnostics;
  let nextAction = `npm run notes:validate -- --key ${key} --tier render`;
  if (!publication.data.angleApproval) {
    phase = 'awaiting-angle';
    blockers = structure.diagnostics;
    nextAction = `npm run notes:approve-angle -- --key ${key} --confirm-angle --promise <reader-promise> --thesis <thesis> --counterpoint <counterpoint>`;
  } else if (render.diagnostics.length === 0 && !approvalCurrent) {
    phase = 'review-ready';
    blockers = [];
    nextAction = `npm run notes:approve-release -- --key ${key} --confirm-reviewed`;
  } else if (approvalCurrent && publication.data.visibility === 'draft') {
    phase = 'approved';
    blockers = [];
    nextAction = `npm run notes:publish -- --key ${key} --confirm-reviewed`;
  } else if (approvalCurrent && publication.data.visibility === 'published') {
    phase = 'published';
    blockers = validateNotes({ root, key, tier: 'release' }).diagnostics;
    nextAction = blockers.length === 0 ? `npm run notes:smoke -- --base-url https://lucashenry.dev --key ${key}` : `npm run notes:approve-release -- --key ${key} --confirm-reviewed`;
  }
  return {
    key,
    phase,
    visibility: publication.data.visibility,
    issue: publication.data.issue,
    digest,
    approvedDigest: publication.data.releaseApproval?.digest ?? null,
    approvalCurrent,
    blockers,
    nextAction,
    artifacts: {
      manifest: relative(root, publication.file),
      editions: workspace.notes.filter((note) => note.data.translationKey === key).map((note) => relative(root, note.file)),
      diagrams: (publication.data.visuals ?? []).map((id) => relative(root, workspace.diagramById.get(id)?.file ?? id)),
      sources: (publication.data.sourceRoles ?? []).map(({ ref }) => refId(ref)),
    },
  };
}

export function brainPacketPath(researchPacket, root = projectRoot) {
  if (!researchPacket?.startsWith('brain://')) return null;
  const brainRoot = process.env.LUCAS_BRAIN_ROOT
    ? resolve(process.env.LUCAS_BRAIN_ROOT)
    : resolve(root, '../../Lucas Brain');
  return resolve(brainRoot, researchPacket.slice('brain://'.length));
}
