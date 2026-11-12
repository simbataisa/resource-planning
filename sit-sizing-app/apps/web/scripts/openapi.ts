// Writes or checks the committed OpenAPI document (design 9.4, A-05).
//   pnpm openapi:generate   → writes docs/api/openapi.json
//   pnpm openapi:check      → exits 1 if the committed copy is missing or out of date
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openApiText } from '../server/openapi/build';

const target = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'docs',
  'api',
  'openapi.json',
);
const text = openApiText();

if (process.argv.includes('--check')) {
  const committed = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (committed !== text) {
    console.error(
      'docs/api/openapi.json is missing or out of date. Run `pnpm openapi:generate` and commit the result.',
    );
    process.exit(1);
  }
  console.log('docs/api/openapi.json is up to date');
} else {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
  console.log(`wrote ${target}`);
}
