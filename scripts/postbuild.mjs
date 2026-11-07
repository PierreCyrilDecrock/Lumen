// After `vite build`: writes the service worker (versioned cache of every file
// of the game) and checks that the site uses no absolute path, so that it works
// from a sub-folder such as https://<user>.github.io/<repo>/.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;

/** Every file under `dir`, relative to dist, with forward slashes. */
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [relative(dist, path).split(sep).join('/')];
  });
}

const files = walk(dist)
  .filter((f) => f !== 'sw.js' && !f.endsWith('.zip'))
  .sort();

// 1. No absolute URL in the built HTML, CSS and JS.
const absolute = /(?:src|href)=["']\/(?!\/)|url\(\s*["']?\/(?!\/)/;
const offenders = files.filter(
  (f) => /\.(html|css|js)$/.test(f) && absolute.test(readFileSync(join(dist, f), 'utf8')),
);
if (offenders.length > 0) {
  console.error(`Chemins absolus trouvés dans : ${offenders.join(', ')}`);
  process.exit(1);
}

// 2. Service worker with a cache name derived from the content.
const template = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8');
const hash = createHash('sha256').update(template);
for (const f of files) hash.update(f).update(readFileSync(join(dist, f)));
const version = hash.digest('hex').slice(0, 12);
const precache = ['./', ...files.filter((f) => f !== '.nojekyll').map((f) => `./${f}`)];
const sw = template
  .replace('__CACHE_NAME__', `lumen-${version}`)
  .replace('/* __PRECACHE__ */ []', JSON.stringify(precache, null, 2));
writeFileSync(join(dist, 'sw.js'), sw);
console.log(
  `Service worker : cache lumen-${version}, ${precache.length} fichiers. Aucun chemin absolu.`,
);
