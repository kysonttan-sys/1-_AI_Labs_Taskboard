// One-shot: add `export const dynamic = 'force-dynamic';` to the top of
// every API route that doesn't already have a dynamic signal. This stops
// `next build` from trying to prerender those routes against an empty
// DATABASE_URL, which fails the build with "Authentication failed against
// the database server" during static page generation.
//
// A route is considered "already dynamic" if it imports getSession, calls
// cookies(), or has any dynamic config export.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve('src/app/api');
const DYNAMIC_MARKER = "export const dynamic = 'force-dynamic';";

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (name === 'route.ts' || name === 'route.tsx') yield p;
  }
}

const targets = [];
for (const f of walk(ROOT)) {
  const src = readFileSync(f, 'utf-8');
  const hasDynamic =
    src.includes(DYNAMIC_MARKER) ||
    /export const dynamic\s*=\s*['"]force-dynamic['"]/.test(src) ||
    /export const revalidate\s*=/.test(src) ||
    /from\s+['"]next\/headers['"]/.test(src) ||
    /\bgetSession\s*\(/.test(src) ||
    /\bcookies\s*\(/.test(src);
  if (!hasDynamic) targets.push(f);
}

for (const f of targets) {
  const src = readFileSync(f, 'utf-8');
  const lines = src.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\b/.test(lines[i])) lastImport = i;
  }
  const insertAt = lastImport + 1;
  lines.splice(insertAt, 0, '', DYNAMIC_MARKER);
  const out = lines.join('\n');
  writeFileSync(f, out);
  console.log('+', f.replace(resolve('.'), '.'));
}

console.log(`\nUpdated ${targets.length} route(s).`);

