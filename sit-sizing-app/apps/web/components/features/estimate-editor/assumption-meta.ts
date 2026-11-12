/**
 * The Assumptions tab layout (prototype META): groups, rows and how each value is edited.
 * Generated from one transcription of the prototype; labels are message keys. 142 rows,
 * the same paths as the engine's ASSUMPTION_PATHS (checked by assumption-meta.test.ts).
 */
export interface MetaLabel {
  key: string;
  values?: Record<string, string>;
}
export type MetaRow =
  | { path: string; label: MetaLabel; kind: 'cols'; cols: string[]; unit: string }
  | { path: string; label: MetaLabel; kind: 'keys'; keys: [string, string][] }
  | { path: string; label: MetaLabel; kind: 'pct' }
  | { path: string; label: MetaLabel; kind: 'scalar'; unit: string };
export interface MetaGroup {
  group: string;
  rows: MetaRow[];
}

/** Key labels starting with "=" are shown as is (sizes S, M, L, XL). */
export const ASSUMPTION_META: MetaGroup[] = [
  {
    group: 'cases',
    rows: [
      {
        path: 'cases.api',
        label: {
          key: 'assumptionsTab.rows.cases_api',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'cases',
      },
      {
        path: 'cases.screen',
        label: {
          key: 'assumptionsTab.rows.cases_screen',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'cases',
      },
      {
        path: 'cases.integration',
        label: {
          key: 'assumptionsTab.rows.cases_integration',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'cases',
      },
      {
        path: 'cases.batch',
        label: {
          key: 'assumptionsTab.rows.cases_batch',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'cases',
      },
      {
        path: 'cases.event',
        label: {
          key: 'assumptionsTab.rows.cases_event',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'cases',
      },
      {
        path: 'cases.journey',
        label: {
          key: 'assumptionsTab.rows.cases_journey',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'cases',
      },
    ],
  },
  {
    group: 'rules',
    rows: [
      {
        path: 'cases.rule',
        label: {
          key: 'assumptionsTab.rows.cases_rule',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'cases',
      },
      {
        path: 'criticalShare',
        label: {
          key: 'assumptionsTab.rows.criticalShare',
        },
        kind: 'pct',
      },
      {
        path: 'wiringCases',
        label: {
          key: 'assumptionsTab.rows.wiringCases',
        },
        kind: 'scalar',
        unit: 'cases',
      },
      {
        path: 'variantShare',
        label: {
          key: 'assumptionsTab.rows.variantShare',
        },
        kind: 'pct',
      },
      {
        path: 'variantSampling',
        label: {
          key: 'assumptionsTab.rows.variantSampling',
        },
        kind: 'pct',
      },
    ],
  },
  {
    group: 'roles',
    rows: [
      {
        path: 'transitions',
        label: {
          key: 'assumptionsTab.rows.transitions',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'transitions',
      },
      {
        path: 'invalidShare',
        label: {
          key: 'assumptionsTab.rows.invalidShare',
        },
        kind: 'pct',
      },
      {
        path: 'gatedShare',
        label: {
          key: 'assumptionsTab.rows.gatedShare',
        },
        kind: 'pct',
      },
      {
        path: 'roleCasesPerPair',
        label: {
          key: 'assumptionsTab.rows.roleCasesPerPair',
        },
        kind: 'scalar',
        unit: 'cases',
      },
      {
        path: 'roleSampling',
        label: {
          key: 'assumptionsTab.rows.roleSampling',
        },
        kind: 'pct',
      },
      {
        path: 'sodCases',
        label: {
          key: 'assumptionsTab.rows.sodCases',
        },
        kind: 'scalar',
        unit: 'cases',
      },
      {
        path: 'roughApprovalShare',
        label: {
          key: 'assumptionsTab.rows.roughApprovalShare',
        },
        kind: 'pct',
      },
    ],
  },
  {
    group: 'validation',
    rows: [
      {
        path: 'sampleFE',
        label: {
          key: 'assumptionsTab.rows.sampleFE',
        },
        kind: 'scalar',
        unit: 'cases',
      },
      {
        path: 'sampleBE',
        label: {
          key: 'assumptionsTab.rows.sampleBE',
        },
        kind: 'scalar',
        unit: 'cases',
      },
      {
        path: 'partialShare',
        label: {
          key: 'assumptionsTab.rows.partialShare',
        },
        kind: 'pct',
      },
      {
        path: 'valDesign',
        label: {
          key: 'assumptionsTab.rows.valDesign',
        },
        kind: 'scalar',
        unit: 'min',
      },
      {
        path: 'valExecUI',
        label: {
          key: 'assumptionsTab.rows.valExecUI',
        },
        kind: 'scalar',
        unit: 'min',
      },
      {
        path: 'valExecAPI',
        label: {
          key: 'assumptionsTab.rows.valExecAPI',
        },
        kind: 'scalar',
        unit: 'min',
      },
      {
        path: 'valCycles',
        label: {
          key: 'assumptionsTab.rows.valCycles',
        },
        kind: 'scalar',
        unit: 'passes',
      },
      {
        path: 'reqFields',
        label: {
          key: 'assumptionsTab.rows.reqFields',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'fields',
      },
      {
        path: 'respFields',
        label: {
          key: 'assumptionsTab.rows.respFields',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'fields',
      },
      {
        path: 'dtoReuse',
        label: {
          key: 'assumptionsTab.rows.dtoReuse',
        },
        kind: 'pct',
      },
      {
        path: 'eventFields',
        label: {
          key: 'assumptionsTab.rows.eventFields',
        },
        kind: 'scalar',
        unit: 'fields',
      },
      {
        path: 'apiOnlyCases',
        label: {
          key: 'assumptionsTab.rows.apiOnlyCases',
        },
        kind: 'scalar',
        unit: 'cases',
      },
      {
        path: 'mapPerField',
        label: {
          key: 'assumptionsTab.rows.mapPerField',
        },
        kind: 'scalar',
        unit: 'cases',
      },
      {
        path: 'formatShare',
        label: {
          key: 'assumptionsTab.rows.formatShare',
        },
        kind: 'pct',
      },
    ],
  },
  {
    group: 'ftypes',
    rows: [
      {
        path: 'ftypes.text',
        label: {
          key: 'catalogue.fieldTypes.text',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.integer',
        label: {
          key: 'catalogue.fieldTypes.integer',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.decimal',
        label: {
          key: 'catalogue.fieldTypes.decimal',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.percentage',
        label: {
          key: 'catalogue.fieldTypes.percentage',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.currency',
        label: {
          key: 'catalogue.fieldTypes.currency',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.email',
        label: {
          key: 'catalogue.fieldTypes.email',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.phone',
        label: {
          key: 'catalogue.fieldTypes.phone',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.date',
        label: {
          key: 'catalogue.fieldTypes.date',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.datetime',
        label: {
          key: 'catalogue.fieldTypes.datetime',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.boolean',
        label: {
          key: 'catalogue.fieldTypes.boolean',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.enum',
        label: {
          key: 'catalogue.fieldTypes.enum',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.checkbox',
        label: {
          key: 'catalogue.fieldTypes.checkbox',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.radio',
        label: {
          key: 'catalogue.fieldTypes.radio',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.password',
        label: {
          key: 'catalogue.fieldTypes.password',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.url',
        label: {
          key: 'catalogue.fieldTypes.url',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.account',
        label: {
          key: 'catalogue.fieldTypes.account',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.citizenId',
        label: {
          key: 'catalogue.fieldTypes.citizenId',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.taxCode',
        label: {
          key: 'catalogue.fieldTypes.taxCode',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.iban',
        label: {
          key: 'catalogue.fieldTypes.iban',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.file',
        label: {
          key: 'catalogue.fieldTypes.file',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
      {
        path: 'ftypes.image',
        label: {
          key: 'catalogue.fieldTypes.image',
        },
        kind: 'keys',
        keys: [
          ['cases', 'assumptionsTab.keys.cases'],
          ['mix', 'assumptionsTab.keys.mix'],
        ],
      },
    ],
  },
  {
    group: 'channels',
    rows: [
      {
        path: 'channelShares',
        label: {
          key: 'assumptionsTab.rows.channelShares',
        },
        kind: 'keys',
        keys: [
          ['web2', 'assumptionsTab.keys.web2'],
          ['ios', 'assumptionsTab.keys.ios'],
          ['android', 'assumptionsTab.keys.android'],
        ],
      },
      {
        path: 'languageShare',
        label: {
          key: 'assumptionsTab.rows.languageShare',
        },
        kind: 'pct',
      },
      {
        path: 'envFactor',
        label: {
          key: 'assumptionsTab.rows.envFactor',
        },
        kind: 'cols',
        cols: [
          'assumptionsTab.envShort.0',
          'assumptionsTab.envShort.1',
          'assumptionsTab.envShort.2',
          'assumptionsTab.envShort.3',
        ],
        unit: 'x',
      },
    ],
  },
  {
    group: 'mobile',
    rows: [
      {
        path: 'mobileCases',
        label: {
          key: 'assumptionsTab.rows.mobileCases',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'cases',
      },
      {
        path: 'deviceCombos',
        label: {
          key: 'assumptionsTab.rows.deviceCombos',
        },
        kind: 'scalar',
        unit: 'combos',
      },
      {
        path: 'deviceExtra',
        label: {
          key: 'assumptionsTab.rows.deviceExtra',
        },
        kind: 'pct',
      },
      {
        path: 'releaseCases',
        label: {
          key: 'assumptionsTab.rows.releaseCases',
        },
        kind: 'scalar',
        unit: 'cases',
      },
      {
        path: 'mobileExec',
        label: {
          key: 'assumptionsTab.rows.mobileExec',
        },
        kind: 'scalar',
        unit: 'x',
      },
      {
        path: 'mobileDesignShare',
        label: {
          key: 'assumptionsTab.rows.mobileDesignShare',
        },
        kind: 'pct',
      },
      {
        path: 'a11yCases',
        label: {
          key: 'assumptionsTab.rows.a11yCases',
        },
        kind: 'scalar',
        unit: 'cases',
      },
    ],
  },
  {
    group: 'shiftLeft',
    rows: [
      {
        path: 'mutationGate',
        label: {
          key: 'assumptionsTab.rows.mutationGate',
        },
        kind: 'scalar',
        unit: 'percent',
      },
      {
        path: 'ruleUplift',
        label: {
          key: 'assumptionsTab.rows.ruleUplift',
        },
        kind: 'pct',
      },
      {
        path: 'retestWeak',
        label: {
          key: 'assumptionsTab.rows.retestWeak',
        },
        kind: 'pct',
      },
      {
        path: 'feUnitGate',
        label: {
          key: 'assumptionsTab.rows.feUnitGate',
        },
        kind: 'scalar',
        unit: 'percent',
      },
      {
        path: 'feLogicUplift',
        label: {
          key: 'assumptionsTab.rows.feLogicUplift',
        },
        kind: 'pct',
      },
      {
        path: 'feMutGate',
        label: {
          key: 'assumptionsTab.rows.feMutGate',
        },
        kind: 'scalar',
        unit: 'percent',
      },
      {
        path: 'feMutUplift',
        label: {
          key: 'assumptionsTab.rows.feMutUplift',
        },
        kind: 'pct',
      },
      {
        path: 'mobileUnitGate',
        label: {
          key: 'assumptionsTab.rows.mobileUnitGate',
        },
        kind: 'scalar',
        unit: 'percent',
      },
      {
        path: 'mobileUplift',
        label: {
          key: 'assumptionsTab.rows.mobileUplift',
        },
        kind: 'pct',
      },
    ],
  },
  {
    group: 'data',
    rows: [
      {
        path: 'dFeed',
        label: {
          key: 'assumptionsTab.rows.dFeed',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'cases',
      },
      {
        path: 'dPipe',
        label: {
          key: 'assumptionsTab.rows.dPipe',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'cases',
      },
      {
        path: 'dTable',
        label: {
          key: 'assumptionsTab.rows.dTable',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'cases',
      },
      {
        path: 'dScd',
        label: {
          key: 'assumptionsTab.rows.dScd',
        },
        kind: 'scalar',
        unit: 'cases',
      },
      {
        path: 'dCol',
        label: {
          key: 'assumptionsTab.rows.dCol',
        },
        kind: 'scalar',
        unit: 'cases',
      },
      {
        path: 'dDq',
        label: {
          key: 'assumptionsTab.rows.dDq',
        },
        kind: 'scalar',
        unit: 'cases',
      },
      {
        path: 'dReport',
        label: {
          key: 'assumptionsTab.rows.dReport',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'cases',
      },
      {
        path: 'dAccessSampling',
        label: {
          key: 'assumptionsTab.rows.dAccessSampling',
        },
        kind: 'pct',
      },
      {
        path: 'dataSample',
        label: {
          key: 'assumptionsTab.rows.dataSample',
        },
        kind: 'pct',
      },
      {
        path: 'dataDesign',
        label: {
          key: 'assumptionsTab.rows.dataDesign',
        },
        kind: 'scalar',
        unit: 'min',
      },
      {
        path: 'dataExec',
        label: {
          key: 'assumptionsTab.rows.dataExec',
        },
        kind: 'scalar',
        unit: 'min',
      },
      {
        path: 'dataCycles',
        label: {
          key: 'assumptionsTab.rows.dataCycles',
        },
        kind: 'scalar',
        unit: 'cycles',
      },
      {
        path: 'dataPrepHours',
        label: {
          key: 'assumptionsTab.rows.dataPrepHours',
        },
        kind: 'scalar',
        unit: 'h',
      },
      {
        path: 'dataDaysPerCycle',
        label: {
          key: 'assumptionsTab.rows.dataDaysPerCycle',
        },
        kind: 'scalar',
        unit: 'days',
      },
    ],
  },
  {
    group: 'ai',
    rows: [
      {
        path: 'aiUtt',
        label: {
          key: 'assumptionsTab.rows.aiUtt',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'samples',
      },
      {
        path: 'aiRagQ',
        label: {
          key: 'assumptionsTab.rows.aiRagQ',
        },
        kind: 'scalar',
        unit: 'samples',
      },
      {
        path: 'aiOcrSamples',
        label: {
          key: 'assumptionsTab.rows.aiOcrSamples',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'samples',
      },
      {
        path: 'aiAdv',
        label: {
          key: 'assumptionsTab.rows.aiAdv',
        },
        kind: 'scalar',
        unit: 'samples',
      },
      {
        path: 'aiToolCases',
        label: {
          key: 'assumptionsTab.rows.aiToolCases',
        },
        kind: 'scalar',
        unit: 'cases',
      },
      {
        path: 'aiHitlCases',
        label: {
          key: 'assumptionsTab.rows.aiHitlCases',
        },
        kind: 'scalar',
        unit: 'cases',
      },
      {
        path: 'aiLabelUtt',
        label: {
          key: 'assumptionsTab.rows.aiLabelUtt',
        },
        kind: 'scalar',
        unit: 'min',
      },
      {
        path: 'aiLabelRag',
        label: {
          key: 'assumptionsTab.rows.aiLabelRag',
        },
        kind: 'scalar',
        unit: 'min',
      },
      {
        path: 'aiLabelOcr',
        label: {
          key: 'assumptionsTab.rows.aiLabelOcr',
        },
        kind: 'scalar',
        unit: 'min',
      },
      {
        path: 'aiLabelAdv',
        label: {
          key: 'assumptionsTab.rows.aiLabelAdv',
        },
        kind: 'scalar',
        unit: 'min',
      },
      {
        path: 'aiReviewAuto',
        label: {
          key: 'assumptionsTab.rows.aiReviewAuto',
        },
        kind: 'pct',
      },
      {
        path: 'aiReviewManual',
        label: {
          key: 'assumptionsTab.rows.aiReviewManual',
        },
        kind: 'pct',
      },
      {
        path: 'aiReviewMin',
        label: {
          key: 'assumptionsTab.rows.aiReviewMin',
        },
        kind: 'scalar',
        unit: 'min',
      },
      {
        path: 'aiAnalysisHours',
        label: {
          key: 'assumptionsTab.rows.aiAnalysisHours',
        },
        kind: 'scalar',
        unit: 'h',
      },
      {
        path: 'qeLabelShare',
        label: {
          key: 'assumptionsTab.rows.qeLabelShare',
        },
        kind: 'pct',
      },
    ],
  },
  {
    group: 'pt',
    rows: [
      {
        path: 'ptScript',
        label: {
          key: 'assumptionsTab.rows.ptScript',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'h',
      },
      {
        path: 'ptNfrFixed',
        label: {
          key: 'assumptionsTab.rows.ptNfrFixed',
        },
        kind: 'scalar',
        unit: 'h',
      },
      {
        path: 'ptNfrPer',
        label: {
          key: 'assumptionsTab.rows.ptNfrPer',
        },
        kind: 'scalar',
        unit: 'h',
      },
      {
        path: 'ptDataFixed',
        label: {
          key: 'assumptionsTab.rows.ptDataFixed',
        },
        kind: 'scalar',
        unit: 'h',
      },
      {
        path: 'ptDataPer',
        label: {
          key: 'assumptionsTab.rows.ptDataPer',
        },
        kind: 'scalar',
        unit: 'h',
      },
      {
        path: 'ptEnvHours',
        label: {
          key: 'assumptionsTab.rows.ptEnvHours',
        },
        kind: 'scalar',
        unit: 'h',
      },
      {
        path: 'ptEnvApm',
        label: {
          key: 'assumptionsTab.rows.ptEnvApm',
        },
        kind: 'scalar',
        unit: 'h',
      },
      {
        path: 'ptRuns',
        label: {
          key: 'assumptionsTab.rows.ptRuns',
        },
        kind: 'keys',
        keys: [
          ['load', 'catalogue.ptTypes.load'],
          ['stress', 'catalogue.ptTypes.stress'],
          ['soak', 'catalogue.ptTypes.soak'],
          ['spike', 'catalogue.ptTypes.spike'],
          ['failover', 'catalogue.ptTypes.failover'],
        ],
      },
      {
        path: 'ptRunHours',
        label: {
          key: 'assumptionsTab.rows.ptRunHours',
        },
        kind: 'keys',
        keys: [
          ['load', 'catalogue.ptTypes.load'],
          ['stress', 'catalogue.ptTypes.stress'],
          ['soak', 'catalogue.ptTypes.soak'],
          ['spike', 'catalogue.ptTypes.spike'],
          ['failover', 'catalogue.ptTypes.failover'],
        ],
      },
      {
        path: 'ptCycles',
        label: {
          key: 'assumptionsTab.rows.ptCycles',
        },
        kind: 'scalar',
        unit: 'cycles',
      },
      {
        path: 'ptCyclesCI',
        label: {
          key: 'assumptionsTab.rows.ptCyclesCI',
        },
        kind: 'scalar',
        unit: 'cycles',
      },
      {
        path: 'ptAnalysis',
        label: {
          key: 'assumptionsTab.rows.ptAnalysis',
        },
        kind: 'pct',
      },
      {
        path: 'ptReport',
        label: {
          key: 'assumptionsTab.rows.ptReport',
        },
        kind: 'scalar',
        unit: 'h',
      },
      {
        path: 'ptMobileFixed',
        label: {
          key: 'assumptionsTab.rows.ptMobileFixed',
        },
        kind: 'scalar',
        unit: 'h',
      },
      {
        path: 'ptRoughScen',
        label: {
          key: 'assumptionsTab.rows.ptRoughScen',
        },
        kind: 'keys',
        keys: [
          ['S', '=S'],
          ['M', '=M'],
          ['L', '=L'],
          ['XL', '=XL'],
        ],
      },
      {
        path: 'ptEnvDays',
        label: {
          key: 'assumptionsTab.rows.ptEnvDays',
        },
        kind: 'scalar',
        unit: 'days',
      },
    ],
  },
  {
    group: 'effort',
    rows: [
      {
        path: 'minutes',
        label: {
          key: 'assumptionsTab.rows.minutes',
        },
        kind: 'cols',
        cols: ['catalogue.complexity.0', 'catalogue.complexity.1', 'catalogue.complexity.2'],
        unit: 'min',
      },
      {
        path: 'designFSD',
        label: {
          key: 'assumptionsTab.rows.designFSD',
        },
        kind: 'scalar',
        unit: 'min',
      },
      {
        path: 'designNoFSD',
        label: {
          key: 'assumptionsTab.rows.designNoFSD',
        },
        kind: 'scalar',
        unit: 'min',
      },
      {
        path: 'cycles',
        label: {
          key: 'assumptionsTab.rows.cycles',
        },
        kind: 'scalar',
        unit: 'cycles',
      },
      {
        path: 'regression',
        label: {
          key: 'assumptionsTab.rows.regression',
        },
        kind: 'pct',
      },
      {
        path: 'retest',
        label: {
          key: 'assumptionsTab.rows.retest',
        },
        kind: 'pct',
      },
      {
        path: 'overhead',
        label: {
          key: 'assumptionsTab.rows.overhead',
        },
        kind: 'pct',
      },
      {
        path: 'aiDesignCut',
        label: {
          key: 'assumptionsTab.rows.aiDesignCut',
        },
        kind: 'cols',
        cols: ['catalogue.aiLevels.0', 'catalogue.aiLevels.1', 'catalogue.aiLevels.2'],
        unit: 'share',
      },
    ],
  },
  {
    group: 'capacity',
    rows: [
      {
        path: 'hoursPerDay',
        label: {
          key: 'assumptionsTab.rows.hoursPerDay',
        },
        kind: 'scalar',
        unit: 'h',
      },
      {
        path: 'daysPerWeek',
        label: {
          key: 'assumptionsTab.rows.daysPerWeek',
        },
        kind: 'scalar',
        unit: 'days',
      },
      {
        path: 'capacity',
        label: {
          key: 'assumptionsTab.rows.capacity',
        },
        kind: 'cols',
        cols: ['catalogue.levels.0', 'catalogue.levels.1', 'catalogue.levels.2'],
        unit: 'x',
      },
    ],
  },
  {
    group: 'uncertainty',
    rows: [
      {
        path: 'band.rough',
        label: {
          key: 'assumptionsTab.rows.band_rough',
        },
        kind: 'pct',
      },
      {
        path: 'band.detailed',
        label: {
          key: 'assumptionsTab.rows.band_detailed',
        },
        kind: 'pct',
      },
    ],
  },
  {
    group: 'dproxies',
    rows: [
      {
        path: 'dproxies.S',
        label: {
          key: 'assumptionsTab.size',
          values: {
            s: 'S',
          },
        },
        kind: 'keys',
        keys: [
          ['feed', 'assumptionsTab.keys.feed'],
          ['pipe', 'assumptionsTab.keys.pipe'],
          ['table', 'assumptionsTab.keys.table'],
          ['report', 'assumptionsTab.keys.report'],
          ['columns', 'assumptionsTab.keys.columns'],
          ['dq', 'assumptionsTab.keys.dq'],
          ['scd', 'assumptionsTab.keys.scd'],
          ['secured', 'assumptionsTab.keys.secured'],
        ],
      },
      {
        path: 'dproxies.M',
        label: {
          key: 'assumptionsTab.size',
          values: {
            s: 'M',
          },
        },
        kind: 'keys',
        keys: [
          ['feed', 'assumptionsTab.keys.feed'],
          ['pipe', 'assumptionsTab.keys.pipe'],
          ['table', 'assumptionsTab.keys.table'],
          ['report', 'assumptionsTab.keys.report'],
          ['columns', 'assumptionsTab.keys.columns'],
          ['dq', 'assumptionsTab.keys.dq'],
          ['scd', 'assumptionsTab.keys.scd'],
          ['secured', 'assumptionsTab.keys.secured'],
        ],
      },
      {
        path: 'dproxies.L',
        label: {
          key: 'assumptionsTab.size',
          values: {
            s: 'L',
          },
        },
        kind: 'keys',
        keys: [
          ['feed', 'assumptionsTab.keys.feed'],
          ['pipe', 'assumptionsTab.keys.pipe'],
          ['table', 'assumptionsTab.keys.table'],
          ['report', 'assumptionsTab.keys.report'],
          ['columns', 'assumptionsTab.keys.columns'],
          ['dq', 'assumptionsTab.keys.dq'],
          ['scd', 'assumptionsTab.keys.scd'],
          ['secured', 'assumptionsTab.keys.secured'],
        ],
      },
      {
        path: 'dproxies.XL',
        label: {
          key: 'assumptionsTab.size',
          values: {
            s: 'XL',
          },
        },
        kind: 'keys',
        keys: [
          ['feed', 'assumptionsTab.keys.feed'],
          ['pipe', 'assumptionsTab.keys.pipe'],
          ['table', 'assumptionsTab.keys.table'],
          ['report', 'assumptionsTab.keys.report'],
          ['columns', 'assumptionsTab.keys.columns'],
          ['dq', 'assumptionsTab.keys.dq'],
          ['scd', 'assumptionsTab.keys.scd'],
          ['secured', 'assumptionsTab.keys.secured'],
        ],
      },
    ],
  },
  {
    group: 'aproxies',
    rows: [
      {
        path: 'aproxies.S',
        label: {
          key: 'assumptionsTab.size',
          values: {
            s: 'S',
          },
        },
        kind: 'keys',
        keys: [
          ['intent', 'assumptionsTab.keys.intent'],
          ['ocr', 'assumptionsTab.keys.ocr'],
          ['rag', 'assumptionsTab.keys.rag'],
          ['tools', 'assumptionsTab.keys.tools'],
          ['guard', 'assumptionsTab.keys.guard'],
          ['hitl', 'assumptionsTab.keys.hitl'],
        ],
      },
      {
        path: 'aproxies.M',
        label: {
          key: 'assumptionsTab.size',
          values: {
            s: 'M',
          },
        },
        kind: 'keys',
        keys: [
          ['intent', 'assumptionsTab.keys.intent'],
          ['ocr', 'assumptionsTab.keys.ocr'],
          ['rag', 'assumptionsTab.keys.rag'],
          ['tools', 'assumptionsTab.keys.tools'],
          ['guard', 'assumptionsTab.keys.guard'],
          ['hitl', 'assumptionsTab.keys.hitl'],
        ],
      },
      {
        path: 'aproxies.L',
        label: {
          key: 'assumptionsTab.size',
          values: {
            s: 'L',
          },
        },
        kind: 'keys',
        keys: [
          ['intent', 'assumptionsTab.keys.intent'],
          ['ocr', 'assumptionsTab.keys.ocr'],
          ['rag', 'assumptionsTab.keys.rag'],
          ['tools', 'assumptionsTab.keys.tools'],
          ['guard', 'assumptionsTab.keys.guard'],
          ['hitl', 'assumptionsTab.keys.hitl'],
        ],
      },
      {
        path: 'aproxies.XL',
        label: {
          key: 'assumptionsTab.size',
          values: {
            s: 'XL',
          },
        },
        kind: 'keys',
        keys: [
          ['intent', 'assumptionsTab.keys.intent'],
          ['ocr', 'assumptionsTab.keys.ocr'],
          ['rag', 'assumptionsTab.keys.rag'],
          ['tools', 'assumptionsTab.keys.tools'],
          ['guard', 'assumptionsTab.keys.guard'],
          ['hitl', 'assumptionsTab.keys.hitl'],
        ],
      },
    ],
  },
  {
    group: 'proxies',
    rows: [
      {
        path: 'proxies.S',
        label: {
          key: 'assumptionsTab.size',
          values: {
            s: 'S',
          },
        },
        kind: 'keys',
        keys: [
          ['screen', 'assumptionsTab.proxyKeys.screen'],
          ['field', 'assumptionsTab.proxyKeys.field'],
          ['api', 'assumptionsTab.proxyKeys.api'],
          ['integration', 'assumptionsTab.proxyKeys.integration'],
          ['rule', 'assumptionsTab.proxyKeys.rule'],
          ['journey', 'assumptionsTab.proxyKeys.journey'],
          ['batch', 'assumptionsTab.proxyKeys.batch'],
          ['event', 'assumptionsTab.proxyKeys.event'],
          ['workflow', 'assumptionsTab.proxyKeys.workflow'],
          ['actions', 'assumptionsTab.proxyKeys.actions'],
        ],
      },
      {
        path: 'proxies.M',
        label: {
          key: 'assumptionsTab.size',
          values: {
            s: 'M',
          },
        },
        kind: 'keys',
        keys: [
          ['screen', 'assumptionsTab.proxyKeys.screen'],
          ['field', 'assumptionsTab.proxyKeys.field'],
          ['api', 'assumptionsTab.proxyKeys.api'],
          ['integration', 'assumptionsTab.proxyKeys.integration'],
          ['rule', 'assumptionsTab.proxyKeys.rule'],
          ['journey', 'assumptionsTab.proxyKeys.journey'],
          ['batch', 'assumptionsTab.proxyKeys.batch'],
          ['event', 'assumptionsTab.proxyKeys.event'],
          ['workflow', 'assumptionsTab.proxyKeys.workflow'],
          ['actions', 'assumptionsTab.proxyKeys.actions'],
        ],
      },
      {
        path: 'proxies.L',
        label: {
          key: 'assumptionsTab.size',
          values: {
            s: 'L',
          },
        },
        kind: 'keys',
        keys: [
          ['screen', 'assumptionsTab.proxyKeys.screen'],
          ['field', 'assumptionsTab.proxyKeys.field'],
          ['api', 'assumptionsTab.proxyKeys.api'],
          ['integration', 'assumptionsTab.proxyKeys.integration'],
          ['rule', 'assumptionsTab.proxyKeys.rule'],
          ['journey', 'assumptionsTab.proxyKeys.journey'],
          ['batch', 'assumptionsTab.proxyKeys.batch'],
          ['event', 'assumptionsTab.proxyKeys.event'],
          ['workflow', 'assumptionsTab.proxyKeys.workflow'],
          ['actions', 'assumptionsTab.proxyKeys.actions'],
        ],
      },
      {
        path: 'proxies.XL',
        label: {
          key: 'assumptionsTab.size',
          values: {
            s: 'XL',
          },
        },
        kind: 'keys',
        keys: [
          ['screen', 'assumptionsTab.proxyKeys.screen'],
          ['field', 'assumptionsTab.proxyKeys.field'],
          ['api', 'assumptionsTab.proxyKeys.api'],
          ['integration', 'assumptionsTab.proxyKeys.integration'],
          ['rule', 'assumptionsTab.proxyKeys.rule'],
          ['journey', 'assumptionsTab.proxyKeys.journey'],
          ['batch', 'assumptionsTab.proxyKeys.batch'],
          ['event', 'assumptionsTab.proxyKeys.event'],
          ['workflow', 'assumptionsTab.proxyKeys.workflow'],
          ['actions', 'assumptionsTab.proxyKeys.actions'],
        ],
      },
    ],
  },
];
