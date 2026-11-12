// Writes tokens.css next to package.json. Run: pnpm --filter @sit/tokens build (Node 24 strips types).
import { writeFileSync } from 'node:fs';
import { tokensCss } from './css.ts';

writeFileSync(new URL('../tokens.css', import.meta.url), tokensCss());
process.stdout.write('wrote packages/tokens/tokens.css\n');
