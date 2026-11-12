// Copies the Scalar API Reference browser bundle into public/vendor/scalar so the
// docs page loads nothing from a CDN (design 9.4). Runs before `next dev` and `next build`.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '..', 'package.json'));

// Walk up from the package entry to its root (the folder whose package.json is @scalar/api-reference).
let dir = dirname(require.resolve('@scalar/api-reference'));
while (
  !existsSync(join(dir, 'package.json')) ||
  JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name !== '@scalar/api-reference'
) {
  const up = dirname(dir);
  if (up === dir) throw new Error('Could not find the @scalar/api-reference package root');
  dir = up;
}
const src = join(dir, 'dist', 'browser', 'standalone.js');
if (!existsSync(src))
  throw new Error(
    `Scalar bundle not found at ${src}. Check the @scalar/api-reference version (ADR-0003 spike).`,
  );
const outDir = join(here, '..', 'public', 'vendor', 'scalar');
mkdirSync(outDir, { recursive: true });
copyFileSync(src, join(outDir, 'standalone.js'));
console.log('vendored Scalar bundle → public/vendor/scalar/standalone.js');
