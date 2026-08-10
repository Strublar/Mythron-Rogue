/**
 * Builds docs/spells/ and docs/artifacts/: one markdown catalog per faction.
 *
 * A spell is listed only when it ships BOTH halves of what the game needs:
 *   - an animated icon  (public/resources/icons/{id}.plist + .png)
 *   - a cast VFX        (public/resources/fx/{id}.plist + .png)
 * Artifacts have no per-artifact VFX in the source assets (they share
 * fx_artifacthit / fx_artifactbreak), so they are listed on their animated icon.
 *
 * Usage: npm run spell-catalog
 */
import { readdirSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { readPlist } from './lib/plist.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RES = join(__dirname, '..', 'public', 'resources');
const ICONS_DIR = join(RES, 'icons');
const FX_DIR = join(RES, 'fx');
const DOCS = join(__dirname, '..', 'docs');
const THUMB_SIZE = 80;

/** Duelyst faction prefixes → display names. */
const FACTIONS = [
    { key: 'f1', slug: 'lyonar', label: 'Lyonar Kingdoms' },
    { key: 'f2', slug: 'songhai', label: 'Songhai Empire' },
    { key: 'f3', slug: 'vetruvian', label: 'Vetruvian Imperium' },
    { key: 'f4', slug: 'abyssian', label: 'Abyssian Host' },
    { key: 'f5', slug: 'magmar', label: 'Magmar Aspects' },
    { key: 'f6', slug: 'vanar', label: 'Vanar Kindred' },
    { key: 'neutral', slug: 'neutral', label: 'Neutral' },
    { key: 'boss', slug: 'boss', label: 'Bosses' },
];

/** Icon ids the source assets misspell relative to their VFX. Keyed by fx id. */
const FX_ALIASES = {
    fx_f1_inmolation: 'icon_f1_holyimmolation',
    fx_f4_riteundervault: 'icon_f4_riteoftheundervault',
    fx_f4_darkfiretransformation: 'icon_f4_darktransformation',
    fx_f5_kinectequilibrium: 'icon_f5_kineticequilibrium',
};

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function levenshtein(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        for (let j = 1; j <= b.length; j++) {
            row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = row;
    }
    return prev[b.length];
}

function ids(dir) {
    return readdirSync(dir)
        .filter((f) => f.endsWith('.plist'))
        .map((f) => f.slice(0, -'.plist'.length))
        .sort();
}

/** icons/ holds three kinds of art: spell icons, bloodbound spells, artifacts. */
function parseIcon(id) {
    const f = '(f[1-6]|neutral|boss)';
    let m;
    if ((m = id.match(new RegExp(`^artifact_${f}_(.+)$`)))) return { id, faction: m[1], name: m[2], kind: 'artifact' };
    if ((m = id.match(new RegExp(`^icon_${f}_(.+)$`)))) return { id, faction: m[1], name: m[2], kind: 'spell' };
    if ((m = id.match(/^generalspell_(f[1-6])_(.+)$/))) return { id, faction: m[1], name: m[2], kind: 'bloodbound' };
    if ((m = id.match(/^bossspell_(.+)$/))) return { id, faction: 'boss', name: m[1], kind: 'spell' };
    if ((m = id.match(/^boss_(.+)$/))) return { id, faction: 'boss', name: m[1], kind: 'spell' };
    if ((m = id.match(/^(f[1-6])_(.+)$/))) return { id, faction: m[1], name: m[2], kind: 'spell' };
    return null;
}

/** fx/ mixes `fx_f1_x`, `f3_fx_x` and bare `f6_x`; `bbs_` marks a bloodbound spell. */
function parseFx(id) {
    const m = id.match(/^fx_(f[1-6]|neutral)_(.+)$/) || id.match(/^(f[1-6]|neutral)_(?:fx_)?(.+)$/);
    if (!m) return null;
    return { id, faction: m[1], name: m[2].replace(/^bbs_/, '') };
}

/** Same spell, several VFX variants (`fx_f5_earthsphere_blue`), so containment counts. */
function matchIcon(fx, pool) {
    if (FX_ALIASES[fx.id]) return pool.find((i) => i.id === FX_ALIASES[fx.id]);
    const n = norm(fx.name);
    const exact = pool.find((i) => norm(i.name) === n);
    if (exact) return exact;
    const partial = pool.filter((i) => n.includes(norm(i.name)) || norm(i.name).includes(n));
    if (partial.length) return partial.sort((a, b) => norm(b.name).length - norm(a.name).length)[0];
    const best = pool
        .map((i) => ({ i, d: levenshtein(n, norm(i.name)) }))
        .sort((a, b) => a.d - b.d)[0];
    return best && best.d <= 2 ? best.i : null;
}

/** Frames to probe when hunting an effect's peak — enough coverage, bounded cost. */
const PEAK_SAMPLES = 12;

/** `trim()` throws on a fully transparent frame — that is our blank-frame filter. */
async function trimmed(src, f) {
    return src
        .clone()
        .extract({ left: f.x, top: f.y, width: f.w, height: f.h })
        .trim()
        .toBuffer({ resolveWithObject: true });
}

/**
 * Total opaque mass, sampled every 4th pixel. Bounding-box area picks the sparse
 * particle spray at the tail of an effect; alpha mass picks its bright peak.
 */
function alphaMass({ data, info }) {
    const stride = info.channels * 4;
    let sum = 0;
    for (let i = info.channels - 1; i < data.length; i += stride) sum += data[i];
    return sum;
}

/**
 * Writes one 80px preview. VFX fade in and out, so the densest frame is the
 * readable one; icons are uniform and take the first that renders.
 */
async function writeThumb(sheetPath, frames, outPath, { peak = false } = {}) {
    // Decode the sheet once: re-reading the PNG per frame dominates the runtime.
    const { data, info } = await sharp(sheetPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const src = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
    const step = peak ? Math.max(1, Math.ceil(frames.length / PEAK_SAMPLES)) : 1;
    let best = null;
    for (let i = 0; i < frames.length; i += step) {
        try {
            const cut = await trimmed(src, frames[i]);
            const score = peak ? alphaMass(cut) : 1;
            if (!best || score > best.score) best = { cut, score };
            if (!peak) break;
        } catch {
            // blank or out-of-bounds frame — try the next one
        }
    }
    if (!best) return false;
    const { width, height, channels } = best.cut.info;
    await sharp(best.cut.data, { raw: { width, height, channels } })
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(outPath);
    return true;
}

function prettyName(name) {
    return name.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function spellMarkdown(faction, rows) {
    const lines = [
        `# ${faction.label} — Spells`,
        '',
        `${rows.length} ${rows.length === 1 ? 'spell' : 'spells'} shipping both an animated icon and a cast VFX.`,
        '',
        'Icons: `public/resources/icons/{id}.png` + `{id}.plist`.',
        'VFX: `public/resources/fx/{id}.png` + `{id}.plist`. (CC0, open-duelyst.)',
        '',
        '| Icon | VFX | Name | Icon id | Icon frames | VFX id (frames) |',
        '| --- | --- | --- | --- | --- | --- |',
    ];
    for (const r of rows) {
        const fx = r.fx
            .map((f) => `\`${f.id}\` (${f.frames})`)
            .join('<br>');
        const preview = r.fxThumb ? `![${r.fx[0].id}](thumbs/${r.fx[0].id}.png)` : '—';
        const tag = r.kind === 'bloodbound' ? ' *(bloodbound)*' : '';
        lines.push(
            `| ![${r.id}](thumbs/${r.id}.png) | ${preview} | ${r.name}${tag} | \`${r.id}\` | ${r.frames} | ${fx} |`
        );
    }
    lines.push('');
    return lines.join('\n');
}

function artifactMarkdown(faction, rows) {
    const lines = [
        `# ${faction.label} — Artifacts`,
        '',
        `${rows.length} ${rows.length === 1 ? 'artifact' : 'artifacts'} with an animated icon.`,
        '',
        'Icons: `public/resources/icons/{id}.png` + `{id}.plist` (CC0, open-duelyst).',
        'Artifacts have no per-artifact VFX — they share `fx_artifacthit` and `fx_artifactbreak`.',
        '',
        '| Icon | Name | Id | Frames |',
        '| --- | --- | --- | --- |',
    ];
    for (const r of rows) {
        lines.push(`| ![${r.id}](thumbs/${r.id}.png) | ${r.name} | \`${r.id}\` | ${r.frames} |`);
    }
    lines.push('');
    return lines.join('\n');
}

function indexMarkdown(title, intro, groups, extra = []) {
    const lines = [`# ${title}`, '', ...intro, '', '| Faction | Count | Catalog |', '| --- | --- | --- |'];
    let total = 0;
    for (const [faction, rows] of groups) {
        total += rows.length;
        lines.push(`| ${faction.label} | ${rows.length} | [${faction.slug}.md](${faction.slug}.md) |`);
    }
    lines.push(`| **Total** | **${total}** | |`, '', ...extra);
    return lines.join('\n');
}

// ---------------------------------------------------------------------------

const icons = ids(ICONS_DIR).map(parseIcon).filter(Boolean);
const fxs = ids(FX_DIR).map(parseFx).filter(Boolean);

const spellPool = icons.filter((i) => i.kind !== 'artifact');
const byIcon = new Map();
const orphanFx = [];

for (const fx of fxs) {
    const icon = matchIcon(fx, spellPool.filter((i) => i.faction === fx.faction));
    if (!icon) {
        orphanFx.push(fx.id);
        continue;
    }
    if (!byIcon.has(icon)) byIcon.set(icon, []);
    byIcon.get(icon).push(fx);
}

rmSync(join(DOCS, 'spells'), { recursive: true, force: true });
rmSync(join(DOCS, 'artifacts'), { recursive: true, force: true });
mkdirSync(join(DOCS, 'spells', 'thumbs'), { recursive: true });
mkdirSync(join(DOCS, 'artifacts', 'thumbs'), { recursive: true });

const frameList = (dir, id) => Object.values(readPlist(join(dir, `${id}.plist`)).frames);

const spellGroups = new Map(FACTIONS.map((f) => [f, []]));
const skippedIcons = [];

for (const [icon, fx] of byIcon) {
    const faction = FACTIONS.find((f) => f.key === icon.faction);
    const iconFrames = frameList(ICONS_DIR, icon.id);
    const thumbs = join(DOCS, 'spells', 'thumbs');
    if (!(await writeThumb(join(ICONS_DIR, `${icon.id}.png`), iconFrames, join(thumbs, `${icon.id}.png`)))) {
        skippedIcons.push(icon.id);
        continue;
    }
    fx.sort((a, b) => a.id.localeCompare(b.id));
    const fxThumb = await writeThumb(
        join(FX_DIR, `${fx[0].id}.png`),
        frameList(FX_DIR, fx[0].id),
        join(thumbs, `${fx[0].id}.png`),
        { peak: true }
    );
    spellGroups.get(faction).push({
        id: icon.id,
        name: prettyName(icon.name),
        kind: icon.kind,
        frames: iconFrames.length,
        fxThumb,
        fx: fx.map((f) => ({ id: f.id, frames: frameList(FX_DIR, f.id).length })),
    });
}

const artifactGroups = new Map(FACTIONS.map((f) => [f, []]));
for (const icon of icons.filter((i) => i.kind === 'artifact')) {
    const frames = frameList(ICONS_DIR, icon.id);
    const out = join(DOCS, 'artifacts', 'thumbs', `${icon.id}.png`);
    if (!(await writeThumb(join(ICONS_DIR, `${icon.id}.png`), frames, out))) {
        skippedIcons.push(icon.id);
        continue;
    }
    const faction = FACTIONS.find((f) => f.key === icon.faction);
    artifactGroups.get(faction).push({ id: icon.id, name: prettyName(icon.name), frames: frames.length });
}

for (const [faction, rows] of spellGroups) {
    if (!rows.length) continue;
    rows.sort((a, b) => a.name.localeCompare(b.name));
    writeFileSync(join(DOCS, 'spells', `${faction.slug}.md`), spellMarkdown(faction, rows));
}
for (const [faction, rows] of artifactGroups) {
    if (!rows.length) continue;
    rows.sort((a, b) => a.name.localeCompare(b.name));
    writeFileSync(join(DOCS, 'artifacts', `${faction.slug}.md`), artifactMarkdown(faction, rows));
}

const spellIndex = indexMarkdown(
    'Spell Catalog',
    [
        'Generated by `npm run spell-catalog`. Do not edit by hand.',
        '',
        'Only spells exposing **both** an animated icon (`resources/icons/`) and a cast VFX',
        '(`resources/fx/`) are listed — those are the ones a hero ability can be wired to today.',
    ],
    [...spellGroups].filter(([, r]) => r.length),
    orphanFx.length
        ? [
              '## VFX without an icon',
              '',
              `${orphanFx.length} faction VFX have no matching icon and are therefore not listed:`,
              '',
              ...orphanFx.map((id) => `- \`${id}\``),
              '',
          ]
        : []
);
writeFileSync(join(DOCS, 'spells', 'README.md'), spellIndex);

writeFileSync(
    join(DOCS, 'artifacts', 'README.md'),
    indexMarkdown(
        'Artifact Catalog',
        [
            'Generated by `npm run spell-catalog`. Do not edit by hand.',
            '',
            'Every artifact icon is an animation. The source assets ship no per-artifact VFX —',
            'artifacts reuse `fx_artifacthit` and `fx_artifactbreak`.',
        ],
        [...artifactGroups].filter(([, r]) => r.length)
    )
);

const spellCount = [...spellGroups.values()].reduce((n, r) => n + r.length, 0);
const artifactCount = [...artifactGroups.values()].reduce((n, r) => n + r.length, 0);
console.log(
    `${spellCount} spells and ${artifactCount} artifacts catalogued, ` +
        `${orphanFx.length} VFX without an icon, ` +
        `${skippedIcons.length} icons without a renderable frame${skippedIcons.length ? ` (${skippedIcons.join(', ')})` : ''}.`
);
