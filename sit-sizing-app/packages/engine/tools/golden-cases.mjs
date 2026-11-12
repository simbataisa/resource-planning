// Golden case definitions (design 6.4 req. 2). Each case starts from the prototype's
// DEFAULTS and SAMPLE_SCOPE and changes one theme. All data is synthetic.
// Regenerate with `pnpm --filter @sit/engine golden:generate` — only with an ADR (AGENTS.md rule 3).

const Z = () => [0, 0, 0];
const allEvidence = (v, ci) => ({
  mutation: v,
  valBE: v,
  valFE: v,
  mapCov: v,
  jacoco: v,
  feUnit: v,
  feMut: v,
  ruleCov: v,
  iosUnit: v,
  androidUnit: v,
  dqCov: v,
  contractCov: v,
  goldenReuse: 0,
  evalCI: ci,
  ptCI: ci,
  ptReuse: 0,
  apm: ci,
});
function emptyDetail(d) {
  for (const k of ['api', 'screen', 'integration', 'rule', 'journey', 'batch', 'event', 'workflow'])
    d[k] = Z();
  d.fields = 0;
  d.reqFields = 0;
  d.respFields = 0;
  d.roles = 0;
  d.actions = 0;
  d.approvals = 0;
  d.critical = 0;
  d.variants = 1;
  d.languages = 1;
  for (const k of Object.keys(d.fieldTypes)) d.fieldTypes[k] = 0;
  d.data = {
    feed: Z(),
    pipe: Z(),
    table: Z(),
    report: Z(),
    columns: 0,
    dq: 0,
    scd: 0,
    secured: 0,
    accessRoles: 0,
  };
  d.ai = { intent: Z(), ocr: Z(), rag: 0, tools: 0, guard: 0, hitl: 0 };
  d.pt = { scen: Z(), dataHeavy: 0 };
}
const noChannels = (S) => {
  S.channels = { web2: false, ios: false, android: false };
  S.a11y = false;
};

/** @type {Array<{name: string, description: string, edit: (A: any, S: any) => void}>} */
export const GOLDEN_CASES = [
  {
    name: 'zero-scope',
    description: 'Nothing in scope in either mode',
    edit: (A, S) => {
      S.features = [];
      emptyDetail(S.detail);
      noChannels(S);
      S.includeL4 = false;
      for (const t of Object.keys(S.ptTypes)) S.ptTypes[t] = false;
    },
  },
  {
    name: 'evidence-all-gates',
    description: 'Every coverage gate met, CI evaluation and PT CI on',
    edit: (A, S) => {
      S.evidence = allEvidence(100, true);
    },
  },
  {
    name: 'evidence-no-gates',
    description: 'Nothing proven before SIT',
    edit: (A, S) => {
      S.evidence = allEvidence(0, false);
    },
  },
  {
    name: 'mutation-at-gate',
    description: 'Mutation score exactly at the gate',
    edit: (A, S) => {
      S.evidence.mutation = A.mutationGate;
    },
  },
  {
    name: 'mutation-below-gate',
    description: 'Mutation score one point below the gate',
    edit: (A, S) => {
      S.evidence.mutation = A.mutationGate - 1;
    },
  },
  {
    name: 'validation-partial',
    description: 'Backend validation at 50%, frontend at 99%, mapping at 50%',
    edit: (A, S) => {
      S.evidence.valBE = 50;
      S.evidence.valFE = 99;
      S.evidence.mapCov = 50;
    },
  },
  {
    name: 'validation-sample',
    description: 'Validation and mapping fully proven in L1',
    edit: (A, S) => {
      S.evidence.valBE = 100;
      S.evidence.valFE = 100;
      S.evidence.mapCov = 100;
    },
  },
  {
    name: 'rule-coverage-sample',
    description: 'Rule unit tests at 100%: standard rules get wiring cases',
    edit: (A, S) => {
      S.evidence.ruleCov = 100;
    },
  },
  {
    name: 'frontend-gates-missed',
    description: 'Frontend unit and mutation gates both at zero',
    edit: (A, S) => {
      S.evidence.feUnit = 0;
      S.evidence.feMut = 0;
    },
  },
  {
    name: 'frontend-gates-met',
    description: 'Frontend unit and mutation gates both met (the example misses both)',
    edit: (A, S) => {
      S.evidence.feUnit = A.feUnitGate;
      S.evidence.feMut = A.feMutGate;
    },
  },
  {
    name: 'channels-web-only',
    description: 'Web only, no accessibility',
    edit: (A, S) => {
      noChannels(S);
    },
  },
  {
    name: 'channels-web2',
    description: 'Second web stack only',
    edit: (A, S) => {
      noChannels(S);
      S.channels.web2 = true;
    },
  },
  {
    name: 'channels-ios-weak',
    description: 'iOS only, iOS unit tests below the gate',
    edit: (A, S) => {
      noChannels(S);
      S.channels.ios = true;
      S.evidence.iosUnit = A.mobileUnitGate - 1;
    },
  },
  {
    name: 'channels-android-ok',
    description: 'Android only, unit gate met, accessibility on',
    edit: (A, S) => {
      noChannels(S);
      S.channels.android = true;
      S.a11y = true;
      S.evidence.androidUnit = A.mobileUnitGate;
    },
  },
  {
    name: 'channels-all-languages',
    description: 'All channels, accessibility, three languages',
    edit: (A, S) => {
      S.channels = { web2: true, ios: true, android: true };
      S.a11y = true;
      S.roughLanguages = 3;
      S.detail.languages = 3;
    },
  },
  {
    name: 'data-only',
    description: 'Only data platform scope',
    edit: (A, S) => {
      S.features = [
        { name: 'Synthetic · Finance mart', type: 'data', size: 'L', cx: 2, qty: 1 },
        { name: 'Synthetic · Staging feed', type: 'data', size: 'S', cx: 0, qty: 2 },
      ];
      const data = S.detail.data;
      emptyDetail(S.detail);
      S.detail.data = {
        ...data,
        feed: [2, 1, 1],
        pipe: [1, 2, 2],
        table: [4, 3, 2],
        report: [0, 2, 1],
        columns: 260,
        dq: 40,
        scd: 2,
        secured: 4,
        accessRoles: 3,
      };
      noChannels(S);
    },
  },
  {
    name: 'ai-only',
    description: 'Only AI product scope',
    edit: (A, S) => {
      S.features = [
        { name: 'Synthetic · Service assistant', type: 'ai', size: 'L', cx: 2, qty: 1 },
      ];
      emptyDetail(S.detail);
      S.detail.ai = { intent: [4, 6, 3], ocr: [1, 1, 0], rag: 4, tools: 3, guard: 6, hitl: 2 };
      noChannels(S);
    },
  },
  {
    name: 'performance-only',
    description: 'Only performance scenarios (detailed)',
    edit: (A, S) => {
      S.features = [];
      emptyDetail(S.detail);
      S.detail.pt = { scen: [3, 4, 2], dataHeavy: 1 };
      noChannels(S);
      S.includeL4 = false;
    },
  },
  {
    name: 'performance-ci-reuse',
    description: 'Performance in CI, no APM, half the scripts reused, all test types',
    edit: (A, S) => {
      S.evidence.ptCI = true;
      S.evidence.apm = false;
      S.evidence.ptReuse = 50;
      for (const t of Object.keys(S.ptTypes)) S.ptTypes[t] = true;
    },
  },
  {
    name: 'typed-fields',
    description: 'Fields typed and request/response fields taken from the FSD',
    edit: (A, S) => {
      Object.assign(S.detail.fieldTypes, {
        text: 40,
        integer: 10,
        decimal: 12,
        currency: 6,
        email: 4,
        phone: 4,
        date: 10,
        enum: 20,
        checkbox: 6,
        account: 8,
        citizenId: 2,
        file: 3,
      });
      S.detail.reqFields = 180;
      S.detail.respFields = 320;
    },
  },
  {
    name: 'typed-fields-partial-credit',
    description: 'Some field types, backend validation partially credited',
    edit: (A, S) => {
      Object.assign(S.detail.fieldTypes, { text: 5, password: 2, url: 1, iban: 3 });
      S.evidence.valBE = 75;
      S.evidence.valFE = 60;
    },
  },
  {
    name: 'team-ai-env-automation',
    description: 'Embedded AI assistance, core-banking windows, 60% regression automated',
    edit: (A, S) => {
      S.team.ai = 2;
      S.team.env = 3;
      S.team.automation = 60;
    },
  },
  {
    name: 'team-zero-weeks',
    description: 'SIT window of zero weeks: FTE falls back to 0',
    edit: (A, S) => {
      S.team.weeks = 0;
    },
  },
  {
    name: 'team-mix-zero',
    description: 'Team mix all zero: blended capacity 0',
    edit: (A, S) => {
      S.team.mix = { junior: 0, mid: 0, senior: 0 };
    },
  },
  {
    name: 'team-mix-not-100',
    description: 'Team mix adds up to 60%, normalised by the model',
    edit: (A, S) => {
      S.team.mix = { junior: 20, mid: 20, senior: 20 };
    },
  },
  {
    name: 'extreme-scope',
    description: 'Very large scope in both modes',
    edit: (A, S) => {
      S.features = S.features.map((f) => ({ ...f, size: 'XL', qty: 20 }));
      for (const k of [
        'api',
        'screen',
        'integration',
        'rule',
        'journey',
        'batch',
        'event',
        'workflow',
      ])
        S.detail[k] = S.detail[k].map((n) => n * 100);
      S.detail.fields *= 100;
      S.detail.actions *= 100;
      S.detail.roles = 40;
      S.detail.critical *= 100;
    },
  },
  {
    name: 'extreme-assumptions',
    description: 'Overhead 100%, partial share 100%, execution minutes tripled',
    edit: (A, _S) => {
      A.overhead = 1;
      A.partialShare = 1;
      A.minutes = A.minutes.map((m) => m * 3);
    },
  },
  {
    name: 'l4-excluded',
    description: 'L4 journeys excluded from SIT',
    edit: (A, S) => {
      S.includeL4 = false;
    },
  },
  {
    name: 'ai-reuse-no-eval-ci',
    description: 'Half the golden set reused, no CI evaluation',
    edit: (A, S) => {
      S.evidence.goldenReuse = 50;
      S.evidence.evalCI = false;
      S.team.aiIters = 6;
      S.team.aiSmes = 1;
    },
  },
  {
    name: 'ai-guardrail-max',
    description: 'Several AI features: guardrail categories take the maximum (prototype behaviour)',
    edit: (A, S) => {
      S.features = [
        { name: 'Synthetic · FAQ bot', type: 'ai', size: 'S', cx: 0, qty: 3 },
        { name: 'Synthetic · Claims OCR', type: 'ai', size: 'XL', cx: 2, qty: 1, pt: true },
        { name: 'Synthetic · Agent tools', type: 'ai', size: 'M', cx: 1, qty: 0 },
      ];
    },
  },
  {
    name: 'data-credits',
    description: 'Data quality proven in L1, data contracts partially',
    edit: (A, S) => {
      S.evidence.dqCov = 100;
      S.evidence.contractCov = 60;
    },
  },
  {
    name: 'rough-roles-variants',
    description: 'Rough: no roles, five variants, three languages',
    edit: (A, S) => {
      S.roughRoles = 0;
      S.roughVariants = 5;
      S.roughLanguages = 3;
    },
  },
  {
    name: 'sizes-matrix',
    description: 'Every size at every complexity, two of each',
    edit: (A, S) => {
      S.features = [];
      for (const size of ['S', 'M', 'L', 'XL'])
        for (const cx of [0, 1, 2])
          S.features.push({ name: `Synthetic · ${size}${cx}`, size, cx, qty: 2, pt: cx === 2 });
    },
  },
];
