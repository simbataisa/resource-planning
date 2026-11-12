// Placeholder for commands whose implementation arrives in a later delivery step.
// Exits 0 so `pnpm check` stays green; prints where the work is planned.
const [, , command = 'command', step = '?'] = process.argv;
console.log(
  `[sit-sizing] "${command}" is not available yet. It is delivered in step ${step} (design section 14).`,
);
