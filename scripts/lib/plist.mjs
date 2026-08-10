/** Cocos2d `.plist` texture-atlas reader shared by the catalog/atlas scripts. */
import { readFileSync } from 'fs';

function parseRect(s) {
    const m = s.match(/\{\{(-?\d+),(-?\d+)\},\{(\d+),(\d+)\}\}/);
    return { x: +m[1], y: +m[2], w: +m[3], h: +m[4] };
}

function parseSize(s) {
    const m = s.match(/\{(\d+),(\d+)\}/);
    return { w: +m[1], h: +m[2] };
}

/** → `{ frames: { [name]: {x,y,w,h} }, size }`, frames ordered by their `_000` suffix. */
export function readPlist(path) {
    const xml = readFileSync(path, 'utf8');
    const block = xml.match(/<key>frames<\/key>\s*<dict>([\s\S]*?)<\/dict>\s*<key>metadata/)?.[1];
    if (!block) throw new Error(`frames block not found in ${path}`);

    const entries = [];
    const frameRe = /<key>([^<]+)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g;
    let m;
    while ((m = frameRe.exec(block)) !== null) {
        const name = m[1].trim().replace(/\.png$/, '');
        const rect = m[2].match(/<key>frame<\/key>\s*<string>([^<]+)<\/string>/);
        if (rect) entries.push([name, parseRect(rect[1])]);
    }
    entries.sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));

    const sm = xml.match(/<key>size<\/key>\s*<string>(\{\d+,\d+\})<\/string>/);
    return { frames: Object.fromEntries(entries), size: sm ? parseSize(sm[1]) : null };
}
