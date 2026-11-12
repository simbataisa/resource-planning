// Licence policy for production dependencies (design 11 "Dependencies").
// Fails on copyleft or unknown licences unless the package is on the reviewed allowlist.
import { execFileSync } from 'node:child_process';

const DENY = [
  /^AGPL/i,
  /^GPL/i,
  /^LGPL/i,
  /^SSPL/i,
  /^EUPL/i,
  /^CC-BY-NC/i,
  /^BUSL/i,
  /^UNLICENSED$/i,
  /^Unknown$/i,
];
/** Packages reviewed and accepted despite matching DENY. Add with an ADR or security sign-off reference. */
const ALLOW = new Map([
  // ['package-name', 'reason and approval reference'],
]);

const raw = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
/** @type {Record<string, Array<{ name: string, versions?: string[] }>>} */
const byLicense = JSON.parse(raw);

const violations = [];
for (const [license, pkgs] of Object.entries(byLicense)) {
  if (!DENY.some((re) => re.test(license))) continue;
  for (const p of pkgs) if (!ALLOW.has(p.name)) violations.push(`${p.name} (${license})`);
}

const total = Object.values(byLicense).reduce((n, pkgs) => n + pkgs.length, 0);
if (violations.length) {
  console.error(
    `Licence policy failed for ${violations.length} package(s):\n  ${violations.join('\n  ')}`,
  );
  process.exit(1);
}
console.log(`Licence policy passed for ${total} production packages.`);
