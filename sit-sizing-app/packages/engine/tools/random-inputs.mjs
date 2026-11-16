// Deterministic random estimates for the parity cross-check (seeded, no Math.random).
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomCase(P, seed) {
  const r = rng(seed);
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const pick = (xs) => xs[int(0, xs.length - 1)];
  const chance = (p) => r() < p;
  const tri = (hi) => [int(0, hi), int(0, hi), int(0, hi)];
  const pct = () => pick([0, 10, 49, 50, 51, 59, 60, 69, 70, 75, 79, 80, 99, 100, int(0, 100)]);
  const A = P.clone(P.DEFAULTS);
  const S = P.clone(P.SAMPLE_SCOPE);

  // Assumptions: mostly default, sometimes perturbed.
  if (chance(0.5)) {
    // The data-test sizes (ADR-0019) were single values: perturb them with one factor so the
    // random sequence, and every seeded case, stays as it was.
    const sized = new Set(['dataDesign', 'dataExec', 'dataPrepHours']);
    for (const k of Object.keys(A)) {
      if (sized.has(k)) {
        if (chance(0.15)) {
          const f = 0.5 + r();
          A[k] = A[k].map((v) => Math.round(v * f * 1000) / 1000);
        }
      } else if (typeof A[k] === 'number' && chance(0.15))
        A[k] = Math.round(A[k] * (0.5 + r()) * 1000) / 1000;
      else if (Array.isArray(A[k]) && chance(0.1))
        A[k] = A[k].map((v) => Math.round(v * (0.5 + r()) * 1000) / 1000);
    }
  }

  S.features = Array.from({ length: int(0, 8) }, (_, i) => {
    const f = {
      name: `Synthetic ${i}`,
      size: pick(['S', 'M', 'L', 'XL']),
      cx: int(0, 2),
      qty: int(0, 3),
    };
    const t = pick(['app', 'app', 'app', 'data', 'ai', undefined]);
    if (t) f.type = t;
    if (chance(0.4)) f.pt = chance(0.8);
    return f;
  });
  S.roughRoles = int(0, 8);
  S.roughLanguages = int(0, 4);
  S.roughVariants = int(0, 5);
  S.channels = { web2: chance(0.3), ios: chance(0.5), android: chance(0.5) };
  S.a11y = chance(0.6);
  const d = S.detail;
  for (const k of ['api', 'screen', 'integration', 'rule', 'journey', 'batch', 'event', 'workflow'])
    d[k] = chance(0.2) ? [0, 0, 0] : tri(20);
  d.fields = int(0, 300);
  d.roles = int(0, 10);
  d.actions = int(0, 30);
  d.approvals = int(0, 5);
  d.critical = int(0, 40);
  d.variants = int(0, 6);
  d.languages = int(0, 4);
  d.reqFields = chance(0.3) ? int(1, 400) : 0;
  d.respFields = chance(0.3) ? int(1, 600) : 0;
  for (const k of Object.keys(d.fieldTypes)) d.fieldTypes[k] = chance(0.25) ? int(0, 30) : 0;
  // Columns and DQ rules by complexity (ADR-0019) reuse the one draw each had before, so the
  // random sequence, and every seeded case after it, stays the same.
  const spread = (n, m1, m2) => [n, (n * 7) % m1, (n * 3) % m2];
  d.data = chance(0.4)
    ? {
        feed: tri(4),
        pipe: tri(5),
        table: tri(8),
        report: tri(3),
        columns: spread(int(0, 400), 151, 97),
        dq: spread(int(0, 60), 23, 11),
        scd: int(0, 4),
        secured: int(0, 6),
        accessRoles: int(0, 6),
      }
    : {
        feed: [0, 0, 0],
        pipe: [0, 0, 0],
        table: [0, 0, 0],
        report: [0, 0, 0],
        columns: [0, 0, 0],
        dq: [0, 0, 0],
        scd: int(0, 2),
        secured: 0,
        accessRoles: int(0, 3),
      };
  d.ai = chance(0.4)
    ? {
        intent: tri(8),
        ocr: tri(3),
        rag: int(0, 6),
        tools: int(0, 6),
        guard: int(0, 8),
        hitl: int(0, 4),
      }
    : { intent: [0, 0, 0], ocr: [0, 0, 0], rag: 0, tools: 0, guard: int(0, 3), hitl: 0 };
  d.pt = { scen: chance(0.5) ? tri(5) : [0, 0, 0], dataHeavy: int(0, 3) };
  S.team = {
    weeks: pick([0, 2, 4, 6, 8, 12]),
    mix: chance(0.1)
      ? { junior: 0, mid: 0, senior: 0 }
      : { junior: int(0, 60), mid: int(0, 60), senior: int(0, 60) },
    env: int(0, 3),
    automation: pick([0, 25, 60, 100]),
    ai: int(0, 2),
    aiIters: int(1, 6),
    aiSmes: int(1, 4),
  };
  S.evidence = {
    mutation: pct(),
    valBE: pct(),
    valFE: pct(),
    mapCov: pct(),
    jacoco: pct(),
    feUnit: pct(),
    feMut: pct(),
    ruleCov: pct(),
    iosUnit: pct(),
    androidUnit: pct(),
    dqCov: pct(),
    contractCov: pct(),
    goldenReuse: pick([0, 0, 30, 100]),
    evalCI: chance(0.5),
    ptCI: chance(0.5),
    ptReuse: pick([0, 0, 50, 100]),
    apm: chance(0.5),
  };
  S.includeL4 = chance(0.7);
  for (const t of Object.keys(S.ptTypes)) S.ptTypes[t] = chance(0.6);
  return { A, S };
}
