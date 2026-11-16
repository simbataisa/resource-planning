(function(){
"use strict";
/* ---------- i18n core ---------- */
var LANG='en', HOOKS=[];
var DICT=(function(){ try{ return JSON.parse(document.getElementById('i18n-vi').textContent); }catch(e){ return {units:{},texts:{},js:{}}; } })();
function tr(s){ return (LANG==='vi' && DICT.js && DICT.js[s]!==undefined) ? DICT.js[s] : s; }
function trf(s,v){ return tr(s).replace(/\{(\w+)\}/g,function(m,k){ return v[k]!==undefined?v[k]:m; }); }
function onLang(fn){ HOOKS.push(fn); }

var CX=['Simple','Medium','Complex'], SIZES=['S','M','L','XL'];
var ENV=['Dedicated or stubbed','Mostly available','Shared, real downstream','Shared core-banking windows'], ENV_SHORT=['Dedicated','Mostly up','Shared real','Core windows'];
var AI=['None','Pilot','Embedded'];
var CH=[{k:'web2',label:'Second web stack (Angular + React)'},{k:'ios',label:'iOS (Swift)'},{k:'android',label:'Android (Kotlin)'}];
var DRV=[{k:'api',label:'API endpoints'},{k:'screen',label:'Screens'},{k:'integration',label:'Integrations'},{k:'rule',label:'Business rules'},{k:'workflow',label:'Workflows (state machines)'},{k:'batch',label:'Batch jobs and file interfaces'},{k:'event',label:'Events and messages'},{k:'journey',label:'L4 · E2E journeys'}];
var GROUPS=[
  {k:'api',label:'API endpoints'},{k:'screen',label:'Screens'},{k:'integration',label:'Integrations'},
  {k:'rule',label:'Business rules'},{k:'workflow',label:'Workflows (state machines)'},
  {k:'batch',label:'Batch jobs and file interfaces'},{k:'event',label:'Events and messages'},{k:'journey',label:'L4 · E2E journeys'},
  {k:'fieldFE',label:'Field validation · frontend'},{k:'fieldBE',label:'Request / Bean Validation · backend'},{k:'mapping',label:'Mapping and serialization'},
  {k:'role',label:'Roles and authorization'},{k:'sod',label:'Segregation of duties (maker-checker)'},{k:'channel',label:'Second web stack and languages'},{k:'mobile',label:'Mobile channels (iOS, Android)'},{k:'a11y',label:'Accessibility (WCAG)'},
  {k:'dataSource',label:'Data sources and feeds',pf:'data'},{k:'dataPipeline',label:'ETL / ELT pipelines',pf:'data'},{k:'dataModel',label:'Target tables and SCD history',pf:'data'},
  {k:'dataMapping',label:'Source-to-target column mapping',pf:'data'},{k:'dataQuality',label:'Data quality rules',pf:'data'},{k:'dataReport',label:'Reports, marts and dashboards',pf:'data'},
  {k:'dataAccess',label:'Data access controls (row, column, masking)',pf:'data'},{k:'dataPrep',label:'Data preparation and environment refresh',pf:'data'},
  {k:'aiIntent',label:'Chatbot intents (golden set)',pf:'ai'},{k:'aiRag',label:'Knowledge sources (RAG questions)',pf:'ai'},{k:'aiOcr',label:'OCR document types (samples)',pf:'ai'},
  {k:'aiGuard',label:'Guardrails and red teaming',pf:'ai'},{k:'aiTool',label:'Agent tools and actions',pf:'ai'},{k:'aiHitl',label:'Human-in-the-loop steps',pf:'ai'},{k:'aiEval',label:'Evaluation runs and analysis',pf:'ai'},
  {k:'ptDesign',label:'Performance: workload model, scripts and test data',pf:'pt'},{k:'ptEnv',label:'Performance: environment and monitoring',pf:'pt'},{k:'ptRun',label:'Performance: runs, analysis, tuning and report',pf:'pt'}];
var PTT=[['load','Load'],['stress','Stress'],['soak','Soak (endurance)'],['spike','Spike'],['failover','Failover and resilience']];
var APP_KEYS=GROUPS.filter(function(g){ return !g.pf; }).map(function(g){ return g.k; });
var TYPES=[['app','Application'],['data','Data platform'],['ai','AI product']];
var DPK=[['feed','Feeds'],['pipe','Pipelines'],['table','Tables'],['report','Reports'],['columns','Columns'],['dq','DQ rules'],['scd','SCD'],['secured','Secured']];
var APK=[['intent','Intents'],['ocr','OCR types'],['rag','Sources'],['tools','Tools'],['guard','Guardrails'],['hitl','HITL']];
var DDRV=[{k:'feed',label:'Data sources and feeds'},{k:'pipe',label:'ETL / ELT pipelines'},{k:'table',label:'Target tables'},{k:'columns',label:'Mapped columns (source-to-target spec)'},{k:'dq',label:'Data quality rules'},{k:'report',label:'Reports, marts and dashboards'}];
var ADRV=[{k:'intent',label:'Chatbot intents'},{k:'ocr',label:'OCR document types'}];
var FTYPES=[{k:'text',label:'Text'},{k:'integer',label:'Integer'},{k:'decimal',label:'Decimal / Amount'},{k:'percentage',label:'Percentage'},{k:'currency',label:'Currency'},{k:'email',label:'Email'},{k:'phone',label:'Phone'},{k:'date',label:'Date'},{k:'datetime',label:'Datetime'},{k:'boolean',label:'Boolean'},{k:'enum',label:'Enum / Dropdown'},{k:'checkbox',label:'Checkbox'},{k:'radio',label:'Radio button'},{k:'password',label:'Password'},{k:'url',label:'URL'},{k:'account',label:'Account number'},{k:'citizenId',label:'Citizen ID'},{k:'taxCode',label:'Tax code'},{k:'iban',label:'IBAN / Bank account'},{k:'file',label:'File upload'},{k:'image',label:'Image upload'}];
var PROXY_KEYS=[['screen','Screens'],['field','Fields'],['api','APIs'],['integration','Integr.'],['rule','Rules'],['journey','Journeys'],['batch','Batch'],['event','Events'],['workflow','Workflows'],['actions','Action grp']];

var DEFAULTS={
  cases:{api:[4,6,10],screen:[5,8,12],integration:[6,10,16],rule:[2,4,8],journey:[3,5,8],batch:[5,8,12],event:[4,6,9]},
  ftypes:{text:{cases:15,mix:30},integer:{cases:13,mix:5},decimal:{cases:16,mix:15},percentage:{cases:16,mix:0},currency:{cases:18,mix:0},email:{cases:15,mix:2},phone:{cases:16,mix:3},date:{cases:14,mix:10},datetime:{cases:14,mix:0},boolean:{cases:4,mix:3},enum:{cases:3,mix:15},checkbox:{cases:3,mix:4},radio:{cases:3,mix:3},password:{cases:17,mix:0},url:{cases:14,mix:0},account:{cases:16,mix:4},citizenId:{cases:18,mix:3},taxCode:{cases:16,mix:3},iban:{cases:16,mix:0},file:{cases:16,mix:0},image:{cases:16,mix:0}},
  sampleFE:1, sampleBE:1, partialShare:0.5, valDesign:2, valExecUI:3, valExecAPI:2, valCycles:1,
  roleCasesPerPair:2, roleSampling:0.5,
  channelShares:{web2:0.4,ios:0.6,android:0.6}, languageShare:0.2, deviceCombos:3, deviceExtra:0.2, mobileCases:[4,6,9], releaseCases:6, mobileExec:1.3, mobileDesignShare:0.3, a11yCases:2, mobileUnitGate:70, mobileUplift:0.20, envFactor:[1.0,1.1,1.25,1.4],
  mutationGate:70, ruleUplift:0.25, retestWeak:0.30,
  transitions:[3,6,10], invalidShare:0.30, gatedShare:0.50, sodCases:2, roughApprovalShare:0.50,
  criticalShare:0.30, wiringCases:1, variantShare:0.40, variantSampling:0.30,
  reqFields:[5,10,20], respFields:[8,15,30], dtoReuse:0.30, eventFields:12, apiOnlyCases:4, mapPerField:1, formatShare:0.40,
  feUnitGate:80, feLogicUplift:0.20, feMutGate:60, feMutUplift:0.15,
  minutes:[10,20,40], designFSD:15, designNoFSD:25, cycles:2, regression:0.30, retest:0.20, overhead:0.15,
  aiDesignCut:[0,0.20,0.40],
  dproxies:{S:{feed:1,pipe:1,table:3,report:1,columns:40,dq:6,scd:0,secured:1},M:{feed:2,pipe:3,table:8,report:2,columns:120,dq:20,scd:1,secured:3},
    L:{feed:4,pipe:6,table:15,report:4,columns:260,dq:40,scd:3,secured:5},XL:{feed:7,pipe:10,table:28,report:8,columns:480,dq:80,scd:5,secured:8}},
  ptScript:[4,8,16], ptNfrFixed:16, ptNfrPer:2, ptDataFixed:8, ptDataPer:4, ptEnvHours:24, ptEnvApm:8, ptMobileFixed:8,
  ptRuns:{load:3,stress:2,soak:1,spike:1,failover:1}, ptRunHours:{load:4,stress:4,soak:12,spike:2,failover:4},
  ptCycles:3, ptCyclesCI:2, ptAnalysis:0.5, ptReport:16, ptRoughScen:{S:1,M:2,L:3,XL:5}, ptEnvDays:2,
  aproxies:{S:{intent:3,ocr:0,rag:1,tools:1,guard:4,hitl:1},M:{intent:8,ocr:1,rag:3,tools:3,guard:6,hitl:2},L:{intent:15,ocr:2,rag:5,tools:5,guard:6,hitl:3},XL:{intent:25,ocr:4,rag:8,tools:8,guard:8,hitl:4}},
  dFeed:[3,4,6], dPipe:[4,6,9], dTable:[2,3,4], dScd:2, dCol:1.5, dDq:2, dReport:[4,6,8], dAccessSampling:0.5, dataSample:0.1,
  dataDesign:[10,15,25], dataExec:[5,8,12], dataCycles:3, dataPrepHours:[2,3,5], dataDaysPerCycle:2,
  aiUtt:[20,35,50], aiRagQ:15, aiOcrSamples:[50,100,200], aiAdv:40, aiToolCases:8, aiHitlCases:4,
  aiLabelUtt:2, aiLabelRag:6, aiLabelOcr:4, aiLabelAdv:2, aiReviewAuto:0.20, aiReviewManual:0.60, aiReviewMin:2, aiAnalysisHours:6, qeLabelShare:0.5,
  hoursPerDay:6, daysPerWeek:5, capacity:[0.7,1.0,1.2],
  band:{rough:0.40, detailed:0.15},
  proxies:{
    S:{screen:1,field:6,api:2,integration:0,rule:2,journey:1,batch:0,event:0,workflow:0,actions:1},
    M:{screen:2,field:15,api:4,integration:1,rule:5,journey:1,batch:1,event:1,workflow:1,actions:2},
    L:{screen:4,field:30,api:8,integration:2,rule:10,journey:2,batch:1,event:2,workflow:1,actions:3},
    XL:{screen:7,field:55,api:14,integration:3,rule:18,journey:3,batch:2,event:4,workflow:2,actions:5}}
};
var SAMPLE_SCOPE={
  features:[
    {name:'Example · Customer onboarding',size:'L',cx:1,qty:1,pt:true},
    {name:'Example · Account maintenance',size:'M',cx:0,qty:1},
    {name:'Example · Fund transfer',size:'L',cx:2,qty:1,pt:true},
    {name:'Example · Notifications',size:'S',cx:0,qty:1},
    {name:'Example · Back-office approvals',size:'M',cx:1,qty:1},
    {name:'Example · Transaction data mart',type:'data',size:'M',cx:1,qty:1},
    {name:'Example · Customer service chatbot',type:'ai',size:'M',cx:1,qty:1,pt:true}],
  roughRoles:5, roughLanguages:2, roughVariants:2, channels:{web2:false,ios:true,android:true}, a11y:true,
  detail:{api:[8,14,8],screen:[5,8,3],integration:[1,4,4],rule:[10,18,12],journey:[2,4,3],batch:[1,2,1],event:[2,3,1],workflow:[1,2,1],fields:140,data:{feed:[1,1,0],pipe:[1,2,1],table:[3,4,2],report:[1,1,1],columns:[140,0,0],dq:[24,0,0],scd:1,secured:3,accessRoles:4},ai:{intent:[3,4,2],ocr:[0,0,0],rag:3,tools:3,guard:6,hitl:2},pt:{scen:[2,4,2],dataHeavy:2},reqFields:0,respFields:0,fieldTypes:{text:0,integer:0,decimal:0,percentage:0,currency:0,email:0,phone:0,date:0,datetime:0,boolean:0,enum:0,checkbox:0,radio:0,password:0,url:0,account:0,citizenId:0,taxCode:0,iban:0,file:0,image:0},roles:6,actions:14,approvals:2,critical:12,variants:3,languages:2},
  team:{weeks:6,mix:{junior:30,mid:50,senior:20},env:1,automation:0,ai:0,aiIters:4,aiSmes:2},
  evidence:{mutation:62,valBE:100,valFE:80,mapCov:70,jacoco:82,feUnit:75,feMut:55,ruleCov:60,iosUnit:65,androidUnit:72,dqCov:50,contractCov:40,goldenReuse:0,evalCI:true,ptCI:false,ptReuse:0,apm:true},
  includeL4:true,
  ptTypes:{load:true,stress:true,soak:true,spike:true,failover:false}
};
var META=[
  {grp:'Cases per driver',rows:[
    {p:'cases.api',label:'API endpoint',cols:CX,unit:'cases'},
    {p:'cases.screen',label:'Screen',cols:CX,unit:'cases'},
    {p:'cases.integration',label:'Integration (happy, negative, timeout, retry, mismatch, reconciliation)',cols:CX,unit:'cases'},
    {p:'cases.batch',label:'Batch job or file interface (happy, empty, restart, cut-off, rejects, reconciliation)',cols:CX,unit:'cases'},
    {p:'cases.event',label:'Event or message topic (ordering, duplicate, poison / DLQ, replay)',cols:CX,unit:'cases'},
    {p:'cases.journey',label:'L4 E2E journey',cols:CX,unit:'cases'}]},
  {grp:'Business rules',rows:[
    {p:'cases.rule',label:'Decision-table cases per rule',cols:CX,unit:'cases'},
    {p:'criticalShare',label:'Critical-rule share, rough mode (the FSD gives the count)',pct:1},
    {p:'wiringCases',label:'Wiring cases per standard rule proven in L1',unit:'cases'},
    {p:'variantShare',label:'Share of rules that vary by product, segment or currency',pct:1},
    {p:'variantSampling',label:'Variant sampling (pairwise)',pct:1}]},
  {grp:'Roles, authorization and workflows',rows:[
    {p:'transitions',label:'Transitions per workflow',cols:CX,unit:'transitions'},
    {p:'invalidShare',label:'Invalid-transition cases, share of transitions',pct:1},
    {p:'gatedShare',label:'Share of transitions that are role-gated',pct:1},
    {p:'roleCasesPerPair',label:'Cases per role × guarded action (allow + deny)',unit:'cases'},
    {p:'roleSampling',label:'Role sampling, risk-based or pairwise',pct:1},
    {p:'sodCases',label:'Segregation-of-duties cases per approval workflow',unit:'cases'},
    {p:'roughApprovalShare',label:'Share of workflows with maker-checker approval, rough mode',pct:1}]},
  {grp:'Validation and mapping',rows:[
    {p:'sampleFE',label:'Frontend sample cases per screen, gate met',unit:'cases'},
    {p:'sampleBE',label:'Backend sample cases per API, gate met',unit:'cases'},
    {p:'partialShare',label:'Share pulled into SIT at 50–99% coverage',pct:1},
    {p:'valDesign',label:'Validation design minutes per case (templated per field type)',unit:'min'},
    {p:'valExecUI',label:'Frontend validation execution minutes per case (UI)',unit:'min'},
    {p:'valExecAPI',label:'Backend validation execution minutes per case (API, data-driven)',unit:'min'},
    {p:'valCycles',label:'Full validation passes in SIT (then retest only)',unit:'passes'},
    {p:'reqFields',label:'Request fields per API endpoint, when the FSD gives no count',cols:CX,unit:'fields'},
    {p:'respFields',label:'Response fields per API endpoint, when the FSD gives no count',cols:CX,unit:'fields'},
    {p:'dtoReuse',label:'Fields shared between endpoints (reused DTOs), removed from the estimate',pct:1},
    {p:'eventFields',label:'Payload fields per event or message topic',unit:'fields'},
    {p:'apiOnlyCases',label:'API-only cases per endpoint (unknown field, content type, oversized, missing body)',unit:'cases'},
    {p:'mapPerField',label:'Round-trip mapping checks per response or payload field',unit:'cases'},
    {p:'formatShare',label:'Fields that also need a format check (money, dates, enums)',pct:1}]},
  {grp:'Field validation matrix (cases per field, per layer · typical field mix)',rows:FTYPES.map(function(t){ return {p:'ftypes.'+t.k,label:t.label,keys:[['cases','Cases'],['mix','Mix %']]}; })},
  {grp:'Channels, languages and environment',rows:[
    {p:'channelShares',label:'Extra cases per channel, share of web screen and journey cases (0–1)',keys:[['web2','2nd web'],['ios','iOS'],['android','Android']]},
    {p:'languageShare',label:'Extra cases per additional language, share of screen cases',pct:1},
    {p:'envFactor',label:'Execution time multiplier by environment availability',cols:ENV_SHORT,unit:'×'}]},
  {grp:'Mobile channels (native iOS and Android)',rows:[
    {p:'mobileCases',label:'Mobile-only cases per mobile screen, run at Simple effort (interrupts, background, offline, rotation, permissions, biometrics, deep links)',cols:CX,unit:'cases'},
    {p:'deviceCombos',label:'Device and OS combinations tested per mobile channel',unit:'combos'},
    {p:'deviceExtra',label:'Extra cases per additional device or OS, pairwise sampled',pct:1},
    {p:'releaseCases',label:'Install, upgrade and uninstall cases per mobile platform',unit:'cases'},
    {p:'mobileExec',label:'Execution time multiplier on mobile (devices, builds, slower manual runs)',unit:'×'},
    {p:'mobileDesignShare',label:'Share of mobile cases that need new design (the rest re-use web cases)',pct:1},
    {p:'a11yCases',label:'Accessibility cases per screen per channel (WCAG), when enabled',unit:'cases'}]},
  {grp:'Shift-left rules',rows:[
    {p:'mutationGate',label:'Mutation score gate',unit:'%'},
    {p:'ruleUplift',label:'Extra business-rule cases below the gate',pct:1},
    {p:'retestWeak',label:'Defect retest rate below the gate',pct:1},
    {p:'feUnitGate',label:'Frontend unit test coverage gate',unit:'%'},
    {p:'feLogicUplift',label:'Extra screen cases below the frontend unit gate',pct:1},
    {p:'feMutGate',label:'Frontend mutation score gate (Stryker)',unit:'%'},
    {p:'feMutUplift',label:'Extra screen cases below the frontend mutation gate',pct:1},
    {p:'mobileUnitGate',label:'Mobile unit test coverage gate (XCTest, JUnit / Espresso)',unit:'%'},
    {p:'mobileUplift',label:'Extra mobile cases below the mobile unit gate',pct:1}]},
  {grp:'Data platform (Data Lake, Data Warehouse, ETL)',rows:[
    {p:'dFeed',label:'Cases per source feed (completeness, schema drift, late or missing files)',cols:CX,unit:'cases'},
    {p:'dPipe',label:'Cases per pipeline (full and incremental load, restart, duplicates, late data, dependencies)',cols:CX,unit:'cases'},
    {p:'dTable',label:'Cases per target table (row-count reconciliation, keys, nulls)',cols:CX,unit:'cases'},
    {p:'dScd',label:'Extra cases per SCD type 2 dimension (history, effective dates)',unit:'cases'},
    {p:'dCol',label:'Source-to-target checks per mapped column',unit:'cases'},
    {p:'dDq',label:'Cases per data quality rule (pass and fail)',unit:'cases'},
    {p:'dReport',label:'Cases per report, mart or dashboard (totals reconcile, filters, periods)',cols:CX,unit:'cases'},
    {p:'dAccessSampling',label:'Sampling of data access roles × secured datasets',pct:1},
    {p:'dataSample',label:'Share of column and DQ checks repeated in SIT when data tests are proven',pct:1},
    {p:'dataDesign',label:'Design minutes per data test (SQL comparison)',cols:CX,unit:'min'},
    {p:'dataExec',label:'Execution and analysis minutes per data test per load cycle',cols:CX,unit:'min'},
    {p:'dataCycles',label:'Load cycles in SIT (initial, incremental, rerun)',unit:'cycles'},
    {p:'dataPrepHours',label:'Data preparation and environment refresh hours per feed per cycle',cols:CX,unit:'h'},
    {p:'dataDaysPerCycle',label:'Calendar days per load cycle (batch windows)',unit:'days'}]},
  {grp:'AI product (chatbot, OCR, AI workflow)',rows:[
    {p:'aiUtt',label:'Golden-set utterances per intent, per language',cols:CX,unit:'samples'},
    {p:'aiRagQ',label:'Evaluation questions per knowledge source, per language',unit:'samples'},
    {p:'aiOcrSamples',label:'Labelled samples per OCR document type (layouts and image quality)',cols:CX,unit:'samples'},
    {p:'aiAdv',label:'Adversarial prompts per guardrail category',unit:'samples'},
    {p:'aiToolCases',label:'Cases per agent tool (function, wrong tool, over-permission, failure)',unit:'cases'},
    {p:'aiHitlCases',label:'Cases per human-in-the-loop step (low confidence, hand-off, override)',unit:'cases'},
    {p:'aiLabelUtt',label:'Labelling minutes per utterance',unit:'min'},
    {p:'aiLabelRag',label:'Minutes to write a reference answer per RAG question',unit:'min'},
    {p:'aiLabelOcr',label:'Labelling minutes per OCR sample',unit:'min'},
    {p:'aiLabelAdv',label:'Minutes per adversarial prompt',unit:'min'},
    {p:'aiReviewAuto',label:'Outputs reviewed by a person per run, with automated evaluation',pct:1},
    {p:'aiReviewManual',label:'Outputs reviewed by a person per run, without automated evaluation',pct:1},
    {p:'aiReviewMin',label:'Review minutes per output',unit:'min'},
    {p:'aiAnalysisHours',label:'Analysis and reporting hours per evaluation run',unit:'h'},
    {p:'qeLabelShare',label:'Share of labelling done by QE (the rest by business SMEs)',pct:1}]},
  {grp:'Performance testing',rows:[
    {p:'ptScript',label:'Scripting hours per scenario (one API / journey / multi-step with correlation and dynamic data)',cols:CX,unit:'h'},
    {p:'ptNfrFixed',label:'Performance requirements and workload model, fixed hours',unit:'h'},
    {p:'ptNfrPer',label:'Workload model hours per scenario',unit:'h'},
    {p:'ptDataFixed',label:'Test data at volume, fixed hours',unit:'h'},
    {p:'ptDataPer',label:'Extra test data hours per data-heavy scenario',unit:'h'},
    {p:'ptEnvHours',label:'Environment and monitoring setup without APM / OpenTelemetry',unit:'h'},
    {p:'ptEnvApm',label:'Environment and monitoring setup with APM / OpenTelemetry in place',unit:'h'},
    {p:'ptRuns',label:'Runs per cycle by test type',keys:PTT},
    {p:'ptRunHours',label:'Hours per run by test type (including monitoring)',keys:PTT},
    {p:'ptCycles',label:'Test and tune cycles (baseline plus retests)',unit:'cycles'},
    {p:'ptCyclesCI',label:'Cycles when performance smoke tests run in CI',unit:'cycles'},
    {p:'ptAnalysis',label:'Analysis time as a share of execution time',pct:1},
    {p:'ptReport',label:'Reporting and capacity recommendations',unit:'h'},
    {p:'ptMobileFixed',label:'Device-side performance checks per mobile platform (startup, memory)',unit:'h'},
    {p:'ptRoughScen',label:'Scenarios per performance-critical feature, rough mode',keys:[['S','S'],['M','M'],['L','L'],['XL','XL']]},
    {p:'ptEnvDays',label:'Calendar days in the performance environment per cycle',unit:'days'}]},
  {grp:'Effort',rows:[
    {p:'minutes',label:'Execution minutes per case, incl. data setup',cols:CX,unit:'min'},
    {p:'designFSD',label:'Design minutes per case, with FSD',unit:'min'},
    {p:'designNoFSD',label:'Design minutes per case, without FSD',unit:'min'},
    {p:'cycles',label:'Full SIT cycles',unit:'cycles'},
    {p:'regression',label:'Regression pass, share of cases',pct:1},
    {p:'retest',label:'Defect retest rate',pct:1},
    {p:'overhead',label:'Planning, reporting and coordination overhead',pct:1},
    {p:'aiDesignCut',label:'Design time saved by AI-assisted test design',cols:AI,unit:'share'}]},
  {grp:'Capacity',rows:[
    {p:'hoursPerDay',label:'Productive hours per FTE per day',unit:'h'},
    {p:'daysPerWeek',label:'Working days per week',unit:'days'},
    {p:'capacity',label:'Capacity factor by level (mid = 1.0)',cols:['Junior','Mid','Senior'],unit:'×'}]},
  {grp:'Uncertainty',rows:[
    {p:'band.rough',label:'Range, rough mode (±)',pct:1},
    {p:'band.detailed',label:'Range, detailed mode (±)',pct:1}]},
  {grp:'Rough-mode data platform feature proxies (per feature of that size)',rows:SIZES.map(function(s){ return {p:'dproxies.'+s,label:'Size {s}',size:s,keys:DPK}; })},
  {grp:'Rough-mode AI product feature proxies (per feature of that size)',rows:SIZES.map(function(s){ return {p:'aproxies.'+s,label:'Size {s}',size:s,keys:APK}; })},
  {grp:'Rough-mode feature proxies (per feature of that size)',rows:SIZES.map(function(s){ return {p:'proxies.'+s,label:'Size {s}',size:s,keys:PROXY_KEYS}; })}
];
var ROWS=[]; META.forEach(function(g){ g.rows.forEach(function(r){ ROWS.push(r); }); });

function clone(o){ return JSON.parse(JSON.stringify(o)); }
function get(o,p){ return p.split('.').reduce(function(a,k){ return a==null?a:a[k]; },o); }
function setp(o,p,v){ var ks=p.split('.'), last=ks.pop(), t=ks.reduce(function(a,k){ return a[k]; },o); t[last]=v; }
function merge(base,over){ if(over==null||typeof over!==typeof base) return base; if(Array.isArray(base)){ return Array.isArray(over)&&over.length===base.length ? over.map(function(v,i){ return typeof v==='number'&&isFinite(v)?v:base[i]; }) : base; }
  if(typeof base==='object'){ var o={}; Object.keys(base).forEach(function(k){ o[k]=merge(base[k],over[k]); }); return o; }
  return (typeof over==='number'&&isFinite(over))||typeof over==='string'||typeof over==='boolean' ? over : base; }
function esc(s){ return String(s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function fmt(n){ return Math.round(n).toLocaleString('en-US'); }
function f1(n){ return (Math.round(n*10)/10).toFixed(1); }
function $(id){ return document.getElementById(id); }
function rowLabel(r){ return r.size ? trf(r.label,{s:r.size}) : tr(r.label); }

var KEY='sit-sizing-v1';
var A=clone(DEFAULTS), S=clone(SAMPLE_SCOPE), PROFILE='';
try{ var saved=JSON.parse(localStorage.getItem(KEY)||'null'); if(saved){ loadProfile(saved); } }catch(e){}
function save(){ try{ localStorage.setItem(KEY,JSON.stringify({assumptions:A,scope:S,profile:PROFILE})); }catch(e){} }

/* Files saved before data-test minutes and preparation hours were sized: one value becomes the same value for every size; columns and DQ rules count as Simple. */
function expandLegacy(asm,sc){
  ['dataDesign','dataExec','dataPrepHours'].forEach(function(k){ if(typeof asm[k]==='number') asm[k]=[asm[k],asm[k],asm[k]]; });
  var dd=sc&&sc.detail&&sc.detail.data; if(dd) ['columns','dq'].forEach(function(k){ if(typeof dd[k]==='number') dd[k]=[dd[k],0,0]; });
}
function loadProfile(obj){
  if(!obj||typeof obj!=='object') throw new Error(tr('Not a profile.'));
  var asm=obj.assumptions||obj.A; if(!asm) throw new Error(tr('The JSON has no "assumptions" section.'));
  expandLegacy(asm,obj.scope);
  A=merge(DEFAULTS,asm);
  if(obj.scope){
    var sc=obj.scope, base=clone(SAMPLE_SCOPE);
    var ns=merge(base,sc);
    ns.features=Array.isArray(sc.features)?sc.features.filter(function(f){ return f&&typeof f==='object'; }).map(function(f){ return {name:String(f.name||'Feature'),pt:!!f.pt,type:['app','data','ai'].indexOf(f.type)>=0?f.type:'app',size:SIZES.indexOf(f.size)>=0?f.size:'M',cx:[0,1,2].indexOf(+f.cx)>=0?+f.cx:1,qty:Math.max(0,+f.qty||0)}; }):base.features;
    S=ns;
  }
  PROFILE=typeof obj.profile==='string'?obj.profile:'';
}

/* ---------- model ---------- */
function counts(mode,A,S){
  var c={api:[0,0,0],screen:[0,0,0],integration:[0,0,0],rule:[0,0,0],workflow:[0,0,0],batch:[0,0,0],event:[0,0,0],journey:[0,0,0],fields:0,roles:0,actions:0,languages:1,critical:0,variants:1,approvals:0,ch:S.channels||{},a11y:!!S.a11y,
    data:{feed:[0,0,0],pipe:[0,0,0],table:[0,0,0],report:[0,0,0],columns:[0,0,0],dq:[0,0,0],scd:0,secured:0,accessRoles:0},ai:{intent:[0,0,0],ocr:[0,0,0],rag:0,tools:0,guard:0,hitl:0}};
  if(mode==='rough'){
    S.features.forEach(function(f){ var t=f.type||'app', q=+f.qty||0, b=+f.cx||0, p;
      if(t==='data'){ p=A.dproxies[f.size]; if(!p) return; ['feed','pipe','table','report','columns','dq'].forEach(function(k){ c.data[k][b]+=(p[k]||0)*q; }); ['scd','secured'].forEach(function(k){ c.data[k]+=(p[k]||0)*q; }); return; }
      if(t==='ai'){ p=A.aproxies[f.size]; if(!p) return; ['intent','ocr'].forEach(function(k){ c.ai[k][b]+=(p[k]||0)*q; }); ['rag','tools','hitl'].forEach(function(k){ c.ai[k]+=(p[k]||0)*q; }); if(q>0) c.ai.guard=Math.max(c.ai.guard,p.guard||0); return; }
      p=A.proxies[f.size]; if(!p) return;
      DRV.forEach(function(d){ c[d.k][b]+=(p[d.k]||0)*q; }); c.fields+=p.field*q; c.actions+=p.actions*q; });
    c.data.accessRoles=+S.roughRoles||0;
    c.roles=+S.roughRoles||0; c.languages=Math.max(1,+S.roughLanguages||1);
    c.critical=sum3(c.rule)*A.criticalShare; c.variants=Math.max(1,+S.roughVariants||1); c.approvals=Math.round(sum3(c.workflow)*A.roughApprovalShare);
  } else {
    DRV.forEach(function(d){ c[d.k]=(S.detail[d.k]||[0,0,0]).map(function(x){ return +x||0; }); });
    c.fields=+S.detail.fields||0; c.roles=+S.detail.roles||0; c.actions=+S.detail.actions||0; c.languages=Math.max(1,+S.detail.languages||1);
    c.critical=Math.max(0,+S.detail.critical||0); c.variants=Math.max(1,+S.detail.variants||1); c.approvals=Math.max(0,+S.detail.approvals||0);
    if(S.detail.data) c.data=clone(S.detail.data); if(S.detail.ai) c.ai=clone(S.detail.ai);
  }
  return c;
}
function fieldProfile(mode,A,S){
  var ft=mode==='detailed'?(S.detail.fieldTypes||{}):{}, n=0, sum=0, m=0, s2=0;
  FTYPES.forEach(function(t){ var k=+ft[t.k]||0, a=A.ftypes[t.k]; n+=k; sum+=k*a.cases; m+=(+a.mix||0); s2+=(+a.mix||0)*a.cases; });
  return n>0?{typed:true,count:n,per:sum/n}:{typed:false,count:null,per:m>0?s2/m:0};
}
function credit(cov){ return cov>=100?'sample':cov>=50?'partial':'full'; }
function sum3(a){ return a[0]+a[1]+a[2]; }
function compute(mode,A,S,E){
  E=E||S.evidence;
  var c=counts(mode,A,S), mutOK=E.mutation>=A.mutationGate, retest=mutOK?A.retest:A.retestWeak;
  var aiI=Math.min(2,Math.max(0,+S.team.ai||0)), aiCut=A.aiDesignCut[aiI]||0;
  var design=(mode==='rough'?A.designNoFSD:A.designFSD)*(1-aiCut), valDesign=A.valDesign*(1-aiCut);
  var fe=credit(E.valFE), be=credit(E.valBE), mp=credit(+E.mapCov||0), rc=credit(+E.ruleCov||0), g={};
  function by(d,mul){ return c[d].map(function(n,b){ return n*A.cases[d][b]*(mul||1); }); }
  var fp=fieldProfile(mode,A,S); if(fp.typed) c.fields=fp.count;
  var apis=sum3(c.api), estReq=c.api.reduce(function(t,n,b){ return t+n*A.reqFields[b]; },0)*(1-A.dtoReuse);
  var estResp=c.api.reduce(function(t,n,b){ return t+n*A.respFields[b]; },0)*(1-A.dtoReuse)+sum3(c.event)*A.eventFields;
  var reqIn=mode==='detailed'?(+S.detail.reqFields||0):0, respIn=mode==='detailed'?(+S.detail.respFields||0):0;
  var reqF=reqIn>0?reqIn:estReq, respF=respIn>0?respIn:estResp;
  function fld(state,base,each){ return state==='sample'?base*each:state==='partial'?c.fields*fp.per*A.partialShare:c.fields*fp.per; }
  var feUnitOK=(+E.feUnit||0)>=A.feUnitGate, feMutOK=(+E.feMut||0)>=A.feMutGate;
  var feUp=(feUnitOK?0:A.feLogicUplift)+(feMutOK?0:A.feMutUplift);
  g.api=by('api'); g.screen=by('screen',1+feUp); g.integration=by('integration');
  g.batch=by('batch'); g.event=by('event'); g.journey=S.includeL4?by('journey'):[0,0,0];
  /* business rules: critical in full, standard credited by rule unit tests, then mutation and variants */
  var rTot=sum3(c.rule), crit=Math.min(rTot,c.critical), cf=rTot>0?crit/rTot:0;
  var vf=1+(c.variants-1)*A.variantShare*A.variantSampling, mu=mutOK?1:1+A.ruleUplift;
  g.rule=c.rule.map(function(n,b){ var full=A.cases.rule[b], st=n*(1-cf);
    var std=rc==='sample'?st*A.wiringCases:rc==='partial'?st*full*A.partialShare:st*full;
    return (n*cf*full+std)*mu*vf; });
  /* workflows -> transitions; role-gated transitions join the role matrix; approvals add SoD cases */
  var trans=c.workflow.map(function(n,b){ return n*A.transitions[b]; }), trTot=sum3(trans);
  g.workflow=trans.map(function(t){ return t*(1+A.invalidShare); });
  var guarded=c.actions+trTot*A.gatedShare;
  g.role=[guarded*c.roles*A.roleCasesPerPair*A.roleSampling,0,0];
  g.sod=[c.approvals*A.sodCases,0,0];
  var xl=(c.languages-1)*A.languageShare, w2=c.ch.web2?A.channelShares.web2:0;
  g.channel=[0,1,2].map(function(b){ return g.screen[b]*(xl+w2)+g.journey[b]*w2; });
  var mobOn=['ios','android'].filter(function(k){ return c.ch[k]; }), devX=Math.max(0,A.deviceCombos-1)*A.deviceExtra, mobBase=[0,0,0], mobWeak=[];
  mobOn.forEach(function(k){ var sh=A.channelShares[k], ok=(+E[k+'Unit']||0)>=A.mobileUnitGate; if(!ok) mobWeak.push(k);
    [0,1,2].forEach(function(b){ var up=ok?1:1+A.mobileUplift; mobBase[b]+=(g.journey[b]*sh+g.screen[b]*sh*(1+devX))*up; mobBase[0]+=c.screen[b]*sh*A.mobileCases[b]*(1+devX)*up; }); });
  g.mobile=mobBase.slice(); g.mobile[0]+=mobOn.length*A.releaseCases;
  var chOn=1+(c.ch.web2?1:0)+mobOn.length;
  g.a11y=[c.a11y?sum3(c.screen)*A.a11yCases*chOn:0,0,0];
  g.fieldFE=[fld(fe,sum3(c.screen),A.sampleFE),0,0];
  var beFull=reqF*fp.per+apis*A.apiOnlyCases;
  g.fieldBE=[be==='sample'?apis*A.sampleBE:be==='partial'?beFull*A.partialShare:beFull,0,0];
  var mapBase=respF*A.mapPerField*(1+A.formatShare);
  g.mapping=[mp==='sample'?0:mp==='partial'?mapBase*A.partialShare:mapBase,0,0];
  var dd=c.data, da=c.ai, Z=[0,0,0];
  var dOn=sum3(dd.feed)+sum3(dd.pipe)+sum3(dd.table)+sum3(dd.report)+sum3(dd.columns)+sum3(dd.dq)+(+dd.secured||0)>0;
  var aOn=sum3(da.intent)+sum3(da.ocr)+(+da.rag||0)+(+da.tools||0)+(+da.hitl||0)>0;
  function bb(arr,per){ return [0,1,2].map(function(b){ return (+(arr||Z)[b]||0)*per[b]; }); }
  var dqC=credit(+E.dqCov||0), ctC=credit(+E.contractCov||0);
  function cr(st,v,sampleV){ return st==='sample'?sampleV:st==='partial'?v*A.partialShare:v; }
  var feedTot=sum3(dd.feed||Z);
  g.dataSource=dOn?bb(dd.feed,A.dFeed).map(function(v,b){ return cr(ctC,v,(+(dd.feed||Z)[b]||0)); }):Z.slice();
  g.dataPipeline=dOn?bb(dd.pipe,A.dPipe):Z.slice();
  g.dataModel=dOn?bb(dd.table,A.dTable).map(function(v,b){ return v+(b===1?(+dd.scd||0)*A.dScd:0); }):Z.slice();
  g.dataMapping=dOn?bb(dd.columns,[A.dCol,A.dCol,A.dCol]).map(function(v){ return cr(dqC,v,v*A.dataSample); }):Z.slice();
  g.dataQuality=dOn?bb(dd.dq,[A.dDq,A.dDq,A.dDq]).map(function(v){ return cr(dqC,v,v*A.dataSample); }):Z.slice();
  g.dataReport=dOn?bb(dd.report,A.dReport):Z.slice();
  g.dataAccess=dOn?[(+dd.secured||0)*(+dd.accessRoles||0)*2*A.dAccessSampling,0,0]:Z.slice();
  g.dataPrep=Z.slice();
  var langs=c.languages, iters=Math.max(1,+S.team.aiIters||1), reuse=Math.min(100,Math.max(0,+E.goldenReuse||0))/100;
  var evalCI=E.evalCI!==undefined?!!E.evalCI:!!S.evidence.evalCI, reviewShare=evalCI?A.aiReviewAuto:A.aiReviewManual;
  g.aiIntent=aOn?[sum3(bb(da.intent,A.aiUtt))*langs,0,0]:Z.slice();
  g.aiRag=aOn?[(+da.rag||0)*A.aiRagQ*langs,0,0]:Z.slice();
  g.aiOcr=aOn?[sum3(bb(da.ocr,A.aiOcrSamples)),0,0]:Z.slice();
  g.aiGuard=aOn?[(+da.guard||0)*A.aiAdv,0,0]:Z.slice();
  var evalCIv=evalCI;
  g.aiTool=aOn?[0,(+da.tools||0)*A.aiToolCases,0]:Z.slice();
  g.aiHitl=aOn?[0,(+da.hitl||0)*A.aiHitlCases,0]:Z.slice();
  g.aiEval=Z.slice();
  var LABEL={aiIntent:A.aiLabelUtt,aiRag:A.aiLabelRag,aiOcr:A.aiLabelOcr,aiGuard:A.aiLabelAdv}, labelMinTotal=0;
  var ptSc=[0,0,0], ptHeavy=0;
  if(mode==='rough'){ S.features.forEach(function(f){ if(!f.pt) return; var n=(A.ptRoughScen[f.size]||0)*(+f.qty||0); ptSc[+f.cx||0]+=n; if(f.type==='data'||f.type==='ai') ptHeavy+=n; }); }
  else { var dp=S.detail.pt||{}; ptSc=(dp.scen||[0,0,0]).map(function(v){ return +v||0; }); ptHeavy=+dp.dataHeavy||0; }
  var ptN=sum3(ptSc), ptOn=ptN>0, ptCI=E.ptCI!==undefined?!!E.ptCI:!!S.evidence.ptCI, ptReuse=Math.min(100,Math.max(0,+S.evidence.ptReuse||0))/100, apm=!!S.evidence.apm;
  var ptTypes=S.ptTypes||{}, runH=0, runN=0; PTT.forEach(function(t){ if(ptTypes[t[0]]){ runH+=A.ptRuns[t[0]]*A.ptRunHours[t[0]]; runN+=A.ptRuns[t[0]]; } });
  var ptCycles=ptCI?A.ptCyclesCI:A.ptCycles, ptExec=runH*ptCycles;
  var pt=ptOn?{design:ptSc.reduce(function(t,n,b){ return t+n*A.ptScript[b]; },0)*(1-ptReuse)+A.ptNfrFixed+A.ptNfrPer*ptN+A.ptDataFixed+A.ptDataPer*ptHeavy,
    env:(apm?A.ptEnvApm:A.ptEnvHours)+mobOn.length*A.ptMobileFixed, run:ptExec*(1+A.ptAnalysis)+A.ptReport}:{design:0,env:0,run:0};
  g.ptDesign=[ptN,0,0]; g.ptEnv=Z.slice(); g.ptRun=Z.slice();
  var envI=Math.min(3,Math.max(0,+S.team.env||0)), env=A.envFactor[envI], auto=Math.min(100,Math.max(0,+S.team.automation||0))/100;
  var exec=(A.cycles+A.regression*(1-auto))*(1+retest)*env, valExec=A.valCycles*(1+retest)*env, dataExecF=A.dataCycles*(1+retest)*env;
  var out={mode:mode,c:c,groups:{},cases:0,hours:0,mutOK:mutOK,retest:retest,fe:fe,be:be,env:env,envI:envI,auto:auto,mp:mp,rc:rc,feUnitOK:feUnitOK,feMutOK:feMutOK,execF:exec,design:design,aiI:aiI,aiCut:aiCut,
    x:{rTot:rTot,crit:crit,std:rTot-crit,vf:vf,mu:mu,trTot:trTot,wfTot:sum3(c.workflow),guarded:guarded,feUp:feUp,perField:fp.per,typed:fp.typed,reqF:reqF,respF:respF,reqIn:reqIn>0,respIn:respIn>0,apis:apis,mobOn:mobOn,mobWeak:mobWeak,chOn:chOn,devX:devX,w2:w2,xl:xl,dOn:dOn,aOn:aOn,dqC:dqC,ctC:ctC,feedTot:feedTot,iters:iters,reviewShare:reviewShare,evalCI:evalCI,reuse:reuse,ptOn:ptOn,ptN:ptN,ptSc:ptSc,ptHeavy:ptHeavy,ptCI:ptCI,ptReuse:ptReuse,apm:apm,runH:runH,runN:runN,ptCycles:ptCycles,pt:pt,langs:langs,dataExecF:dataExecF}};
  GROUPS.forEach(function(G){
    var arr=g[G.k].map(function(x){ return Math.max(0,Math.round(x)); }), min=0;
    if(G.k==='fieldFE'||G.k==='fieldBE'||G.k==='mapping'){ min=sum3(arr)*(valDesign+(G.k==='fieldFE'?A.valExecUI:A.valExecAPI)*valExec); }
    else if(G.k==='mobile') arr.forEach(function(n,b){ min+=n*(design*A.mobileDesignShare+A.minutes[b]*exec*A.mobileExec); });
    else if(G.k==='dataPrep') min=dOn?bb(dd.feed,A.dataPrepHours).reduce(function(t,v){ return t+v; },0)*A.dataCycles*60:0;
    else if(G.pf==='data'&&G.k!=='dataReport') arr.forEach(function(n,b){ min+=n*(A.dataDesign[b]*(1-aiCut)+A.dataExec[b]*dataExecF); });
    else if(LABEL[G.k]!==undefined){ var lab=sum3(arr)*LABEL[G.k]*(1-reuse); labelMinTotal+=lab; min=lab*A.qeLabelShare+sum3(arr)*iters*reviewShare*A.aiReviewMin; }
    else if(G.k==='aiEval') min=aOn?iters*A.aiAnalysisHours*60:0;
    else if(G.k==='ptDesign') min=pt.design*60; else if(G.k==='ptEnv') min=pt.env*60; else if(G.k==='ptRun') min=pt.run*60;
    else arr.forEach(function(n,b){ min+=n*(design+A.minutes[b]*exec); });
    var h=min/60*(1+A.overhead);
    out.groups[G.k]={cases:sum3(arr),hours:h}; out.cases+=sum3(arr); out.hours+=h;
  });
  out.labelHours=labelMinTotal/60*(1+A.overhead); out.smeLabelHours=labelMinTotal/60*(1-A.qeLabelShare);
  var mix=S.team.mix, tot=(+mix.junior||0)+(+mix.mid||0)+(+mix.senior||0);
  var blended=tot>0?((+mix.junior||0)*A.capacity[0]+(+mix.mid||0)*A.capacity[1]+(+mix.senior||0)*A.capacity[2])/tot:0;
  var hpf=(+S.team.weeks||0)*A.daysPerWeek*A.hoursPerDay;
  out.hpf=hpf; out.blended=blended; out.per=hpf*blended;
  out.fte=out.per>0?out.hours/out.per:0;
  out.band=mode==='rough'?A.band.rough:A.band.detailed;
  out.lo=out.fte*(1-out.band); out.hi=out.fte*(1+out.band);
  out.levels=tot>0?[mix.junior/tot*out.fte,mix.mid/tot*out.fte,mix.senior/tot*out.fte]:[0,0,0];
  return out;
}
function scaleArr(a,k){ return a.map(function(x){ return x*k; }); }
var SENS=[
  {label:'Cases per integration',f:function(A,k){ A.cases.integration=scaleArr(A.cases.integration,k); }},
  {label:'Cases per API endpoint',f:function(A,k){ A.cases.api=scaleArr(A.cases.api,k); }},
  {label:'Cases per screen',f:function(A,k){ A.cases.screen=scaleArr(A.cases.screen,k); }},
  {label:'Cases per business rule',f:function(A,k){ A.cases.rule=scaleArr(A.cases.rule,k); }},
  {label:'Critical-rule share',rough:1,f:function(A,k){ A.criticalShare=Math.min(1,A.criticalShare*k); }},
  {label:'Rule variant sampling',f:function(A,k){ A.variantSampling=Math.min(1,A.variantSampling*k); }},
  {label:'Transitions per workflow',f:function(A,k){ A.transitions=scaleArr(A.transitions,k); }},
  {label:'Role-gated share of transitions',f:function(A,k){ A.gatedShare=Math.min(1,A.gatedShare*k); }},
  {label:'Cases per E2E journey',f:function(A,k){ A.cases.journey=scaleArr(A.cases.journey,k); }},
  {label:'Cases per batch job or file',f:function(A,k){ A.cases.batch=scaleArr(A.cases.batch,k); }},
  {label:'Cases per event or message topic',f:function(A,k){ A.cases.event=scaleArr(A.cases.event,k); }},
  {label:'Mobile channel share of web cases',f:function(A,k){ ['ios','android','web2'].forEach(function(x){ A.channelShares[x]=Math.min(1,A.channelShares[x]*k); }); }},
  {label:'Mobile-only cases per screen',f:function(A,k){ A.mobileCases=scaleArr(A.mobileCases,k); }},
  {label:'Device and OS matrix extra',f:function(A,k){ A.deviceExtra*=k; }},
  {label:'Mobile execution multiplier',f:function(A,k){ A.mobileExec=1+(A.mobileExec-1)*k; }},
  {label:'Extra cases per language',f:function(A,k){ A.languageShare*=k; }},
  {label:'Environment availability factor',f:function(A,k){ A.envFactor=scaleArr(A.envFactor,k); }},
  {label:'Field validation cases per field',f:function(A,k){ FTYPES.forEach(function(t){ A.ftypes[t.k].cases*=k; }); }},
  {label:'Request fields per API endpoint',f:function(A,k){ A.reqFields=scaleArr(A.reqFields,k); }},
  {label:'Response fields per API endpoint',f:function(A,k){ A.respFields=scaleArr(A.respFields,k); }},
  {label:'Validation execution minutes',f:function(A,k){ A.valExecUI*=k; A.valExecAPI*=k; }},
  {label:'Role sampling',f:function(A,k){ A.roleSampling*=k; }},
  {label:'Execution minutes per case',f:function(A,k){ A.minutes=scaleArr(A.minutes,k); }},
  {label:'Design minutes per case',f:function(A,k){ A.designFSD*=k; A.designNoFSD*=k; }},
  {label:'SIT cycles',f:function(A,k){ A.cycles*=k; }},
  {label:'Defect retest rate',f:function(A,k){ A.retest*=k; A.retestWeak*=k; }},
  {label:'Planning and coordination overhead',f:function(A,k){ A.overhead*=k; }},
  {label:'AI design time saving',f:function(A,k){ A.aiDesignCut=A.aiDesignCut.map(function(x){ return Math.min(0.9,x*k); }); }},
  {label:'Productive hours per day',f:function(A,k){ A.hoursPerDay*=k; }},
  {label:'Capacity per FTE level',f:function(A,k){ A.capacity=scaleArr(A.capacity,k); }},
  {label:'Data test minutes',f:function(A,k){ A.dataDesign=scaleArr(A.dataDesign,k); A.dataExec=scaleArr(A.dataExec,k); }},
  {label:'Source-to-target checks per column',f:function(A,k){ A.dCol*=k; }},
  {label:'Data load cycles',f:function(A,k){ A.dataCycles*=k; }},
  {label:'Golden-set utterances per intent',f:function(A,k){ A.aiUtt=scaleArr(A.aiUtt,k); }},
  {label:'OCR samples per document type',f:function(A,k){ A.aiOcrSamples=scaleArr(A.aiOcrSamples,k); }},
  {label:'Labelling minutes per sample',f:function(A,k){ A.aiLabelUtt*=k; A.aiLabelRag*=k; A.aiLabelOcr*=k; A.aiLabelAdv*=k; }},
  {label:'Human review share per run',f:function(A,k){ A.aiReviewAuto=Math.min(1,A.aiReviewAuto*k); A.aiReviewManual=Math.min(1,A.aiReviewManual*k); }},
  {label:'Performance scripting hours',f:function(A,k){ A.ptScript=scaleArr(A.ptScript,k); }},
  {label:'Performance test and tune cycles',f:function(A,k){ A.ptCycles*=k; A.ptCyclesCI*=k; }},
  {label:'Performance run hours',f:function(A,k){ Object.keys(A.ptRunHours).forEach(function(t){ A.ptRunHours[t]*=k; }); }},
  {label:'Performance analysis share',f:function(A,k){ A.ptAnalysis*=k; }},
  {label:'Feature size proxies',rough:1,f:function(A,k){ SIZES.forEach(function(s){ Object.keys(A.proxies[s]).forEach(function(x){ A.proxies[s][x]*=k; }); }); }}
];

/* ---------- rubric and derived rows ---------- */
var RUBRIC={
  api:['Read or basic CRUD, few fields, no downstream call','Business logic, one downstream call or a state change','Orchestrates several systems, moves money, or has compensation or rollback paths'],
  screen:['Display or a simple form with fewer than 10 fields','Form with conditional fields, lookups or several actions','Multi-step wizard, dynamic sections or complex page state'],
  integration:['One-way call to a stable system that has a sandbox','Request and response with mapping and error codes','Asynchronous or two-way, retries, reconciliation, or a core-banking system with test windows'],
  rule:['One or two conditions, one outcome','Three or four conditions, or a tiered value','Five or more conditions, several outcomes, or dates and thresholds combined'],
  workflow:['Up to 3 transitions, linear','4 to 6 transitions with a reject or rework path','7 or more transitions, parallel approvals, timeouts or escalation'],
  batch:['One file or job with no dependencies','Depends on another job, or has rejects to handle','Chain of jobs with cut-off, restart and reconciliation'],
  event:['Fire-and-forget notification','Consumer updates state and must ignore duplicates','Ordering matters, saga or compensation, replay'],
  journey:['One system hop, happy path','Two or three systems','Four or more systems, or money moving end to end']
};
function num1(n){ return Math.abs(n-Math.round(n))<1e-9?String(Math.round(n)):(Math.round(n*10)/10).toFixed(1); }
function pctS(v){ return Math.round(v*100)+'%'; }
function itemHours(k,b,D){
  var cases=k==='workflow'?A.transitions[b]*(1+A.invalidShare):A.cases[k][b];
  return cases*(D.design+A.minutes[b]*D.execF)*(1+A.overhead)/60;
}
function countTable(id,list,obj,prefix){
  $(id).tBodies[0].innerHTML=list.map(function(d){ return '<tr><td>'+tr(d.label)+'</td>'+[0,1,2].map(function(b){ return '<td class="n"><input type="number" min="0" step="1" id="'+prefix+d.k+'-'+b+'" value="'+(+obj[d.k][b]||0)+'" aria-label="'+esc(tr(d.label)+' '+tr(CX[b]))+'"></td>'; }).join('')+'<td class="n" id="'+prefix+d.k+'-t"></td></tr>'; }).join('');
  list.forEach(function(d){ [0,1,2].forEach(function(b){ $(prefix+d.k+'-'+b).addEventListener('input',function(e){ var v=parseFloat(e.target.value); if(isFinite(v)){ obj[d.k][b]=Math.max(0,Math.round(v)); update(); } }); }); });
}
function renderDai(){ countTable('dataTable',DDRV,S.detail.data,'dd-'); countTable('aiTable',ADRV,S.detail.ai,'da-'); countTable('ptTable',[{k:'scen',label:'Performance scenarios (journeys or APIs under load)'}],S.detail.pt,'dp-'); }
var DAI_NUM=[['dd-scd','data','scd'],['dd-secured','data','secured'],['dd-roles','data','accessRoles'],
  ['da-rag','ai','rag'],['da-tools','ai','tools'],['da-guard','ai','guard'],['da-hitl','ai','hitl']];
function bindDai(){
  DAI_NUM.forEach(function(x){ bindNum(x[0],function(){ return S.detail[x[1]][x[2]]; },function(v){ S.detail[x[1]][x[2]]=Math.max(0,Math.round(v)); }); });
  bindNum('t-aiIters',function(){ return S.team.aiIters; },function(v){ S.team.aiIters=Math.max(1,Math.round(v)); });
  bindNum('t-aiSmes',function(){ return S.team.aiSmes; },function(v){ S.team.aiSmes=Math.max(1,Math.round(v)); });
  var ci=$('e-evalci'); ci.checked=!!S.evidence.evalCI; ci.addEventListener('change',function(){ S.evidence.evalCI=ci.checked; update(); });
  bindNum('dp-dataHeavy',function(){ return S.detail.pt.dataHeavy; },function(v){ S.detail.pt.dataHeavy=Math.max(0,Math.round(v)); });
  bindNum('e-ptreuse',function(){ return S.evidence.ptReuse; },function(v){ S.evidence.ptReuse=Math.min(100,Math.max(0,v)); });
  [['e-ptci','ptCI'],['e-apm','apm']].forEach(function(x){ var e=$(x[0]); e.checked=!!S.evidence[x[1]]; e.addEventListener('change',function(){ S.evidence[x[1]]=e.checked; update(); }); });
  PTT.forEach(function(t){ var e=$('pt-'+t[0]); e.checked=!!S.ptTypes[t[0]]; e.addEventListener('change',function(){ S.ptTypes[t[0]]=e.checked; update(); }); });
}
function syncDai(){ DAI_NUM.forEach(function(x){ $(x[0]).value=S.detail[x[1]][x[2]]; }); $('t-aiIters').value=S.team.aiIters; $('t-aiSmes').value=S.team.aiSmes; $('e-evalci').checked=!!S.evidence.evalCI; $('dp-dataHeavy').value=S.detail.pt.dataHeavy; $('e-ptreuse').value=S.evidence.ptReuse; $('e-ptci').checked=!!S.evidence.ptCI; $('e-apm').checked=!!S.evidence.apm; PTT.forEach(function(t){ $('pt-'+t[0]).checked=!!S.ptTypes[t[0]]; }); renderDai(); }
function initCollapsible(){
  ['method','standards'].forEach(function(id){
    var sec=$(id); if(!sec) return; var h=sec.querySelector('.panel-h');
    sec.classList.add('cpanel','collapsed'); h.setAttribute('role','button'); h.tabIndex=0; h.setAttribute('aria-expanded','false');
    function set(open){ sec.classList.toggle('collapsed',!open); h.setAttribute('aria-expanded',open?'true':'false'); }
    h.addEventListener('click',function(e){ if(e.target.closest('a,button,input,select')) return; set(sec.classList.contains('collapsed')); });
    h.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); set(sec.classList.contains('collapsed')); } });
    sec.__open=function(){ set(true); };
  });
  document.addEventListener('click',function(e){ var a=e.target.closest('a[href^="#"]'); if(!a) return; var t=document.getElementById(a.getAttribute('href').slice(1)); var p=t&&t.closest('.cpanel'); if(p&&p.__open) p.__open(); });
  if(location.hash){ var t=document.getElementById(location.hash.slice(1)); var p=t&&t.closest('.cpanel'); if(p&&p.__open){ p.__open(); setTimeout(function(){ t.scrollIntoView(); },0); } }
}
function initDsec(){
  var secs=Array.prototype.slice.call(document.querySelectorAll('#p-detail .dsec')), st={};
  try{ st=JSON.parse(localStorage.getItem('sit-dsec')||'{}'); }catch(e){}
  secs.forEach(function(d){ if(st[d.id]!==undefined) d.open=!!st[d.id]; d.addEventListener('toggle',function(){ st[d.id]=d.open; try{ localStorage.setItem('sit-dsec',JSON.stringify(st)); }catch(e){} }); });
  Array.prototype.forEach.call(document.querySelectorAll('.dnav a'),function(a){ a.addEventListener('click',function(e){ e.preventDefault(); var d=$(a.dataset.sec); d.open=true; d.scrollIntoView({behavior:'smooth',block:'start'}); var sm=d.querySelector('summary'); if(sm) sm.focus({preventScroll:true}); }); });
  $('dsExpand').addEventListener('click',function(){ secs.forEach(function(d){ d.open=true; }); });
  $('dsCollapse').addEventListener('click',function(){ secs.forEach(function(d){ d.open=false; }); });
}
function updateDsec(D){
  var c=D.c, x=D.x, d=S.detail;
  function set(k,txt,empty){ $('dsb-'+k).textContent=txt; $('ds-'+k).classList.toggle('empty',!!empty); var a=document.querySelector('.dnav a[data-sec="ds-'+k+'"]'); if(a) a.classList.toggle('empty',!!empty); }
  set('app',trf('{a} APIs · {s} screens · {i} integrations · {r} rules',{a:fmt(sum3(c.api)),s:fmt(sum3(c.screen)),i:fmt(sum3(c.integration)),r:fmt(sum3(c.rule))}),false);
  set('fields',trf('{f} input · {q} request · {p} response fields',{f:fmt(c.fields),q:fmt(x.reqF)+(x.reqIn?'':' '+tr('est.')),p:fmt(x.respF)+(x.respIn?'':' '+tr('est.'))}),false);
  set('rules',trf('{r} roles · {a} actions · {w} approvals · {k} critical',{r:fmt(c.roles),a:fmt(c.actions),w:fmt(c.approvals),k:fmt(c.critical)}),false);
  set('channels',chNames(c)+' · '+trf('{l} languages',{l:c.languages}),false);
  set('data',x.dOn?trf('{f} feeds · {t} tables · {c} columns',{f:fmt(sum3(c.data.feed)),t:fmt(sum3(c.data.table)),c:fmt(sum3(c.data.columns))}):tr('Not in scope'),!x.dOn);
  set('ai',x.aOn?trf('{i} intents · {o} OCR types · {t} tools',{i:fmt(sum3(c.ai.intent)),o:fmt(sum3(c.ai.ocr)),t:fmt(c.ai.tools)}):tr('Not in scope'),!x.aOn);
  set('pt',x.ptOn?trf('{n} scenarios · {t} test types · {h} h',{n:x.ptN,t:PTT.filter(function(t){ return S.ptTypes[t[0]]; }).length,h:fmt((x.pt.design+x.pt.env+x.pt.run)*(1+A.overhead))}):tr('Not in scope'),!x.ptOn);
  if($('dp-scen-t')) $('dp-scen-t').textContent=fmt(sum3(S.detail.pt.scen));
  set('derived',trf('{n} cases in total',{n:fmt(D.cases)}),false);
  set('guide','',false);
}
function updateDai(D,R){
  var P=(D.x.dOn||D.x.aOn)?D:R, x=P.x;
  DDRV.forEach(function(d){ $('dd-'+d.k+'-t').textContent=fmt(sum3(S.detail.data[d.k])); }); ADRV.forEach(function(d){ $('da-'+d.k+'-t').textContent=fmt(sum3(S.detail.ai[d.k])); });
  var winDays=(+S.team.weeks||0)*A.daysPerWeek, msgs=[];
  if(x.dOn){ var need=A.dataCycles*A.dataDaysPerCycle; msgs.push(need>winDays?trf('Data: {c} load cycles × {d} days = {n} days, longer than the {w}-day SIT window. Plan extra batch runs or a longer window.',{c:A.dataCycles,d:A.dataDaysPerCycle,n:num1(need),w:winDays}):trf('Data: {c} load cycles × {d} days = {n} days fits the {w}-day SIT window.',{c:A.dataCycles,d:A.dataDaysPerCycle,n:num1(need),w:winDays})); }
  if(x.aOn){ var smes=Math.max(1,+S.team.aiSmes||1), days=P.smeLabelHours/(smes*A.hoursPerDay), half=winDays/2;
    msgs.push(trf('AI: the golden set needs about {h} SME labelling hours: {d} working days with {s} SMEs.',{h:fmt(P.smeLabelHours),d:num1(Math.round(days*10)/10),s:smes})+' '+(days>half?trf('That is more than half the window ({w} days); start labelling before SIT or add SMEs.',{w:num1(half)}):tr('It fits in the first half of the window, before evaluation runs start.'))); }
  var Q=(D.x.ptOn?D:R).x; if(Q.ptOn){ var pd=Q.ptCycles*A.ptEnvDays; msgs.push(trf('Performance: {c} test and tune cycles × {d} days = {n} days in a production-like environment, with fixes between cycles. Book the environment slot early; soak runs often need nights or weekends.',{c:Q.ptCycles,d:A.ptEnvDays,n:num1(pd)})+(pd>winDays?' '+tr('This is longer than the SIT window; start performance testing earlier.'):'')); }
  var ptOnAny=D.x.ptOn||R.x.ptOn;
  $('eff-ptci').innerHTML=!ptOnAny?'<span class="chip">'+tr('Not in scope')+'</span> '+tr('Mark features as performance-critical or add scenarios to count it.'):S.evidence.ptCI?'<span class="chip good">'+tr('In place')+'</span> '+trf('{c} test and tune cycles instead of {d}.',{c:A.ptCyclesCI,d:A.ptCycles}):'<span class="chip warn">'+tr('Not in place')+'</span> '+trf('{d} test and tune cycles.',{d:A.ptCycles});
  $('eff-apm').innerHTML=!ptOnAny?'<span class="chip">'+tr('Not in scope')+'</span> '+tr('Mark features as performance-critical or add scenarios to count it.'):S.evidence.apm?'<span class="chip good">'+tr('In place')+'</span> '+trf('Monitoring setup {h} h.',{h:A.ptEnvApm}):'<span class="chip warn">'+tr('Not in place')+'</span> '+trf('Monitoring setup {h} h.',{h:A.ptEnvHours});
  $('eff-ptreuse').innerHTML=!ptOnAny?'<span class="chip">'+tr('Not in scope')+'</span> '+tr('Mark features as performance-critical or add scenarios to count it.'):(+S.evidence.ptReuse>0)?'<span class="chip good">'+trf('{p} reused',{p:pctS(S.evidence.ptReuse/100)})+'</span> '+tr('Scripting effort falls by the same share.'):'<span class="chip warn">'+tr('New scripts')+'</span> '+tr('Every scenario is scripted from scratch.');
  $('calNote').textContent=msgs.length?msgs.join(' '):tr('No data platform, AI product or performance scope in this estimate, so there is nothing to check.');
  var ev=D; function eff(id,on,st,txtS,txtP,txtF){ $(id).innerHTML=!on?'<span class="chip">'+tr('Not in scope')+'</span> '+tr('Add data platform or AI product drivers in the scope tabs to count it.'):st==='sample'?'<span class="chip good">'+tr('100% · credited')+'</span> '+txtS:st==='partial'?'<span class="chip warn">'+tr('50–99% · partial')+'</span> '+txtP:'<span class="chip bad">'+tr('Below 50%')+'</span> '+txtF; }
  eff('eff-dq',x.dOn,x.dqC,trf('SIT repeats {s} of column and data quality checks as a sample.',{s:pctS(A.dataSample)}),trf('{s} of column and data quality checks come back into SIT.',{s:pctS(A.partialShare)}),tr('SIT checks every mapped column and data quality rule.'));
  eff('eff-contract',x.dOn,x.ctC,tr('SIT runs one check per feed.'),trf('{s} of feed cases come back into SIT.',{s:pctS(A.partialShare)}),tr('SIT runs every feed case.'));
  $('eff-evalci').innerHTML=!x.aOn?'<span class="chip">'+tr('Not in scope')+'</span> '+tr('Add data platform or AI product drivers in the scope tabs to count it.'):x.evalCI?'<span class="chip good">'+tr('In place')+'</span> '+trf('A person reviews {p} of outputs per evaluation run.',{p:pctS(A.aiReviewAuto)}):'<span class="chip warn">'+tr('Not in place')+'</span> '+trf('A person reviews {p} of outputs per evaluation run.',{p:pctS(A.aiReviewManual)});
  $('eff-reuse').innerHTML=!x.aOn?'<span class="chip">'+tr('Not in scope')+'</span> '+tr('Add data platform or AI product drivers in the scope tabs to count it.'):x.reuse>0?'<span class="chip good">'+trf('{p} reused',{p:pctS(x.reuse)})+'</span> '+trf('Labelling effort falls by {p}.',{p:pctS(x.reuse)}):'<span class="chip warn">'+tr('New golden set')+'</span> '+tr('Every sample is labelled from scratch.');
}
function renderRubric(D){
  var extra=[];
  [['Data source or feed',['One file or table, stable schema','Several entities or CDC, occasional schema change','Many entities, late or out-of-order data, frequent schema change']],
    ['ETL / ELT pipeline',['Straight copy or simple filter','Joins, lookups and aggregations','Many sources, SCD history, incremental logic and dependencies']],
    ['Target table',['Raw or staging copy','Cleansed table with keys and rules','Curated fact or dimension with history']],
    ['Report, mart or dashboard',['One table, no filters','Several measures, filters and periods','Regulatory or financial totals reconciled to source']]].forEach(function(r){ extra.push(r); });
  [['Chatbot intent',['FAQ answer, one turn','Several turns or slots, one tool call','Multi-step task with tools, authorization and hand-off']],
    ['OCR document type',['One fixed layout, printed text','Several layouts or tables','Handwriting, stamps, poor scans or many versions']]].forEach(function(r){ extra.push(r); });
  $('rubric').innerHTML='<table class="rub"><thead><tr><th>'+tr('Driver')+'</th><th>'+tr('Simple')+'</th><th>'+tr('Medium')+'</th><th>'+tr('Complex')+'</th></tr></thead><tbody>'+
    DRV.map(function(d){ return '<tr><td><b>'+tr(d.label)+'</b></td>'+[0,1,2].map(function(b){
      return '<td>'+esc(tr(RUBRIC[d.k][b]))+'<div class="icost">'+trf('≈ {h} h per item',{h:f1(itemHours(d.k,b,D))})+'</div></td>'; }).join('')+'</tr>'; }).join('')+
    extra.map(function(r){ return '<tr><td><b>'+tr(r[0])+'</b></td>'+r[1].map(function(t){ return '<td>'+esc(tr(t))+'</td>'; }).join('')+'</tr>'; }).join('')+'</tbody></table>';
}
function renderDerived(D){
  var c=D.c, x=D.x, G=D.groups, rows=[];
  var ruleStd=D.rc==='sample'?trf('{w} wiring case each',{w:A.wiringCases}):D.rc==='partial'?trf('{p} of the table',{p:pctS(A.partialShare)}):tr('the full table');
  rows.push(['rule',trf('({k} critical × full table + {s} standard × {std}) × variants {v}× × mutation {m}×',{k:num1(x.crit),s:num1(x.std),std:ruleStd,v:x.vf.toFixed(2),m:x.mu.toFixed(2)})]);
  rows.push(['workflow',trf('{w} workflows → {t} transitions × (1 + {i} invalid)',{w:num1(x.wfTot),t:num1(x.trTot),i:pctS(A.invalidShare)})]);
  function fieldTxt(state,unitTpl,base,each){ return state==='sample'?trf(unitTpl,{n:num1(base),e:each}):trf(x.typed?'{f} fields by type × {p} matrix cases each × {s} back in SIT':'{f} fields × {p} matrix cases each (typical mix) × {s} back in SIT',{f:num1(c.fields),p:x.perField.toFixed(1),s:state==='partial'?pctS(A.partialShare):'100%'}); }
  rows.push(['fieldFE',fieldTxt(D.fe,'{n} screens × {e} sample case (gate met)',sum3(c.screen),A.sampleFE)]);
  var bs=D.be==='partial'?pctS(A.partialShare):'100%';
  rows.push(['fieldBE',D.be==='sample'?trf('{n} APIs × {e} sample case (gate met)',{n:num1(x.apis),e:A.sampleBE}):
    trf('({f} request fields, {src}, × {p} matrix cases + {a} APIs × {o} API-only cases) × {s} back in SIT',{f:fmt(x.reqF),src:tr(x.reqIn?'from the FSD':'estimated'),p:x.perField.toFixed(1),a:num1(x.apis),o:A.apiOnlyCases,s:bs})]);
  rows.push(['mapping',trf('{f} response and payload fields, {src}, × {m} × (1 + {fs} format checks) × {s} back in SIT',{f:fmt(x.respF),src:tr(x.respIn?'from the FSD':'estimated'),m:A.mapPerField,fs:pctS(A.formatShare),s:D.mp==='sample'?'0%':D.mp==='partial'?pctS(A.partialShare):'100%'})]);
  rows.push(['role',trf('({a} actions + {t} transitions × {g} gated) × {r} roles × {pp} × {sm} sampling',{a:num1(c.actions),t:num1(x.trTot),g:pctS(A.gatedShare),r:num1(c.roles),pp:A.roleCasesPerPair,sm:pctS(A.roleSampling)})]);
  rows.push(['sod',trf('{n} approval workflows × {c} cases',{n:num1(c.approvals),c:A.sodCases})]);
  rows.push(['channel',trf('screen and journey cases × {w} (second web stack) + screen cases × ({l} − 1) × {ls}',{w:pctS(x.w2),l:c.languages,ls:pctS(A.languageShare)})]);
  rows.push(['mobile',x.mobOn.length?trf('{n} mobile channel(s): (web journey cases × share + (web screen cases × share + screens × share × mobile-only cases) × (1 + {d} devices)){up} + {r} release cases',{n:x.mobOn.length,d:pctS(x.devX),up:x.mobWeak.length?' × '+(1+A.mobileUplift).toFixed(2)+' ('+x.mobWeak.join(', ')+' '+tr('below unit gate')+')':'',r:x.mobOn.length*A.releaseCases}):tr('no mobile channel selected')]);
  rows.push(['a11y',c.a11y?trf('{s} screens × {a} cases × {c} channels',{s:num1(sum3(c.screen)),a:A.a11yCases,c:x.chOn}):tr('accessibility checks off')]);
  if(x.dOn){ var dd=c.data, dqs=x.dqC==='sample'?pctS(A.dataSample):x.dqC==='partial'?pctS(A.partialShare):'100%';
    rows.push(['dataSource',trf('{n} feeds × {c} cases by complexity × {s} (data contract credit)',{n:num1(x.feedTot),c:A.dFeed.join('/'),s:x.ctC==='sample'?tr('1 case each'):x.ctC==='partial'?pctS(A.partialShare):'100%'})]);
    rows.push(['dataPipeline',trf('{n} pipelines × {c} cases by complexity',{n:num1(sum3(dd.pipe)),c:A.dPipe.join('/')})]);
    rows.push(['dataModel',trf('{n} tables × {c} cases by complexity + {d} SCD dimensions × {e}',{n:num1(sum3(dd.table)),c:A.dTable.join('/'),d:dd.scd,e:A.dScd})]);
    rows.push(['dataMapping',trf('{n} mapped columns × {c} checks × {s} back in SIT',{n:fmt(sum3(dd.columns)),c:A.dCol,s:dqs})]);
    rows.push(['dataQuality',trf('{n} data quality rules × {c} cases × {s} back in SIT',{n:fmt(sum3(dd.dq)),c:A.dDq,s:dqs})]);
    rows.push(['dataReport',trf('{n} reports × {c} cases by complexity',{n:num1(sum3(dd.report)),c:A.dReport.join('/')})]);
    rows.push(['dataAccess',trf('{d} secured datasets × {r} roles × 2 × {s} sampling',{d:dd.secured,r:dd.accessRoles,s:pctS(A.dAccessSampling)})]);
    rows.push(['dataPrep',trf('{n} feeds × {h} h by complexity × {c} load cycles (hours, no cases)',{n:num1(x.feedTot),h:A.dataPrepHours.join('/'),c:A.dataCycles})]); }
  if(x.aOn){ var da=c.ai, rv=pctS(x.reviewShare);
    rows.push(['aiIntent',trf('{n} intents × {u} utterances by complexity × {l} languages; label {m} min, review {r} of outputs × {i} runs',{n:num1(sum3(da.intent)),u:A.aiUtt.join('/'),l:x.langs,m:A.aiLabelUtt,r:rv,i:x.iters})]);
    rows.push(['aiRag',trf('{n} sources × {q} questions × {l} languages; reference answer {m} min',{n:da.rag,q:A.aiRagQ,l:x.langs,m:A.aiLabelRag})]);
    rows.push(['aiOcr',trf('{n} document types × {q} samples by complexity; label {m} min each',{n:num1(sum3(da.ocr)),q:A.aiOcrSamples.join('/'),m:A.aiLabelOcr})]);
    rows.push(['aiGuard',trf('{n} guardrail categories × {q} adversarial prompts',{n:da.guard,q:A.aiAdv})]);
    rows.push(['aiTool',trf('{n} agent tools × {c} cases',{n:da.tools,c:A.aiToolCases})]);
    rows.push(['aiHitl',trf('{n} human-in-the-loop steps × {c} cases',{n:da.hitl,c:A.aiHitlCases})]);
    rows.push(['aiEval',trf('{i} evaluation runs × {h} h analysis (hours, no cases)',{i:x.iters,h:A.aiAnalysisHours})]); }
  if(x.ptOn){
    rows.push(['ptDesign',trf('{n} scenarios × {s} h scripting by complexity × (1 − {r} reused) + workload model {w} h + test data {d} h = {h} h',{n:x.ptN,s:A.ptScript.join('/'),r:pctS(x.ptReuse),w:A.ptNfrFixed+A.ptNfrPer*x.ptN,d:A.ptDataFixed+A.ptDataPer*x.ptHeavy,h:f1(x.pt.design)})]);
    rows.push(['ptEnv',trf('{e} h setup ({m}){mob} = {h} h',{e:x.apm?A.ptEnvApm:A.ptEnvHours,m:tr(x.apm?'APM in place':'no APM'),mob:x.mobOn.length?' + '+x.mobOn.length+' × '+A.ptMobileFixed+' h '+tr('mobile device checks'):'',h:f1(x.pt.env)})]);
    rows.push(['ptRun',trf('{n} runs, {r} h per cycle × {c} cycles × (1 + {a} analysis) + {p} h report = {h} h',{n:x.runN,r:f1(x.runH),c:x.ptCycles,a:pctS(A.ptAnalysis),p:A.ptReport,h:f1(x.pt.run)})]); }
  var lab={}; GROUPS.forEach(function(g){ lab[g.k]=g.label; });
  $('derTable').tBodies[0].innerHTML=rows.map(function(r){ return '<tr><td>'+tr(lab[r[0]])+'</td><td class="formula-cell">'+esc(r[1])+'</td><td class="n">'+fmt(G[r[0]].cases)+'</td></tr>'; }).join('');
}

/* ---------- calibration state ---------- */
function isDefault(r){ return JSON.stringify(get(A,r.p))===JSON.stringify(get(DEFAULTS,r.p)); }
function uncCount(){ return ROWS.filter(isDefault).length; }

/* ---------- inputs ---------- */
function bindNum(id,getter,setter){ var el=$(id); el.value=getter(); el.addEventListener('input',function(){ var v=parseFloat(el.value); if(!isFinite(v)) return; setter(v); update(); }); }

function renderFeatures(){
  var tb=$('featTable').tBodies[0];
  tb.innerHTML=S.features.map(function(f,i){
    return '<tr data-i="'+i+'"><td><input type="text" class="wide" id="f-name-'+i+'" value="'+esc(f.name)+'" aria-label="'+esc(tr('Feature name'))+'"></td>'+
      '<td><select id="f-type-'+i+'" aria-label="'+esc(tr('Type'))+'">'+TYPES.map(function(t){ return '<option value="'+t[0]+'"'+((f.type||'app')===t[0]?' selected':'')+'>'+tr(t[1])+'</option>'; }).join('')+'</select></td>'+
      '<td><select id="f-size-'+i+'" aria-label="'+esc(tr('Size'))+'">'+SIZES.map(function(s){ return '<option'+(s===f.size?' selected':'')+'>'+s+'</option>'; }).join('')+'</select></td>'+
      '<td><select id="f-cx-'+i+'" aria-label="'+esc(tr('Complexity'))+'">'+CX.map(function(s,b){ return '<option value="'+b+'"'+(b===+f.cx?' selected':'')+'>'+tr(s)+'</option>'; }).join('')+'</select></td>'+
      '<td class="n"><input type="number" id="f-qty-'+i+'" min="0" step="1" value="'+f.qty+'" aria-label="'+esc(tr('Quantity'))+'"></td>'+
      '<td class="n"><input type="checkbox" id="f-pt-'+i+'"'+(f.pt?' checked':'')+' aria-label="'+esc(tr('Performance-critical'))+'"></td>'+
      '<td class="expand" id="f-exp-'+i+'"></td>'+
      '<td><button class="icon-btn" data-del="'+i+'" aria-label="'+esc(trf('Remove {n}',{n:f.name}))+'" title="'+esc(tr('Remove'))+'">✕</button></td></tr>';
  }).join('');
  S.features.forEach(function(f,i){
    $('f-name-'+i).addEventListener('input',function(e){ f.name=e.target.value; save(); });
    $('f-size-'+i).addEventListener('change',function(e){ f.size=e.target.value; update(); });
    $('f-cx-'+i).addEventListener('change',function(e){ f.cx=+e.target.value; update(); });
    $('f-type-'+i).addEventListener('change',function(e){ f.type=e.target.value; update(); });
    $('f-pt-'+i).addEventListener('change',function(e){ f.pt=e.target.checked; update(); });
    $('f-qty-'+i).addEventListener('input',function(e){ var v=parseFloat(e.target.value); if(isFinite(v)){ f.qty=Math.max(0,v); update(); } });
  });
  Array.prototype.forEach.call(tb.querySelectorAll('[data-del]'),function(b){ b.addEventListener('click',function(){ S.features.splice(+b.dataset.del,1); renderFeatures(); update(); }); });
}
/* Input fields (total) follows the per-type counts while any are entered; the manual total is kept for when they are cleared */
function syncFieldTotal(){
  var fp=fieldProfile('detailed',A,S), fi=$('d-fields'); if(!fi) return;
  if(fp.typed){ fi.value=fp.count; fi.disabled=true; fi.title=tr('Calculated from Fields by type'); }
  else if(fi.disabled){ fi.disabled=false; fi.value=S.detail.fields; fi.title=''; }
  FTYPES.forEach(function(t){ var c=$('ftc-'+t.k); if(c) c.textContent=A.ftypes[t.k].cases; });
  if($('ftSum')){
    $('ftSum').textContent=fp.typed?fmt(fp.count):'0';
    $('ftAvg').textContent=trf('{p} per field',{p:fp.per.toFixed(1)});
    $('ftNote').textContent=fp.typed?trf('Input fields (total) is now locked to {n}, the sum of the counts above. Set every count back to 0 to type a total again.',{n:fmt(fp.count)}):
      trf('No counts entered, so the model uses Input fields (total), {n}, with the typical field mix: {p} matrix cases per field.',{n:fmt(+S.detail.fields||0),p:fp.per.toFixed(1)});
  }
}
function renderFieldTypes(){
  var ft=S.detail.fieldTypes;
  $('ftBox').innerHTML='<table class="rub"><thead><tr><th>'+tr('Field type')+'</th><th class="n">'+tr('Matrix cases')+'</th><th class="n">'+tr('Fields')+'</th></tr></thead><tbody>'+
    FTYPES.map(function(t){ return '<tr><td>'+tr(t.label)+'</td><td class="n" id="ftc-'+t.k+'">'+A.ftypes[t.k].cases+'</td><td class="n"><input type="number" min="0" step="1" id="ft-'+t.k+'" value="'+(+ft[t.k]||0)+'" aria-label="'+esc(tr(t.label))+'"></td></tr>'; }).join('')+
    '</tbody><tfoot><tr><td>'+tr('Total')+'</td><td class="n" id="ftAvg"></td><td class="n" id="ftSum"></td></tr></tfoot></table><p class="hint" id="ftNote"></p>';
  FTYPES.forEach(function(t){ $('ft-'+t.k).addEventListener('input',function(e){ var v=parseFloat(e.target.value); if(isFinite(v)){ ft[t.k]=Math.max(0,Math.round(v)); update(); } }); });
}
function renderDetail(){
  var tb=$('detTable').tBodies[0];
  tb.innerHTML=DRV.map(function(d){
    return '<tr id="dr-'+d.k+'"><td>'+tr(d.label)+'</td>'+[0,1,2].map(function(b){ return '<td class="n"><input type="number" min="0" step="1" id="d-'+d.k+'-'+b+'" value="'+S.detail[d.k][b]+'" aria-label="'+esc(tr(d.label)+' '+tr(CX[b]))+'"></td>'; }).join('')+
      '<td class="n" id="dt-'+d.k+'"></td><td class="n muted" id="dr-r-'+d.k+'"></td></tr>';
  }).join('');
  DRV.forEach(function(d){ [0,1,2].forEach(function(b){ $('d-'+d.k+'-'+b).addEventListener('input',function(e){ var v=parseFloat(e.target.value); if(isFinite(v)){ S.detail[d.k][b]=Math.max(0,v); update(); } }); }); });
}
function renderAssumptions(){
  var html=META.map(function(g,gi){
    return '<div class="agrp"><h3>'+tr(g.grp)+'</h3><div class="scroll"><table><tbody>'+g.rows.map(function(r,ri){
      var id='a-'+gi+'-'+ri, v=get(A,r.p), ins;
      if(r.cols){ ins=r.cols.map(function(c,b){ return '<label>'+tr(c)+'<input type="number" step="any" min="0" id="'+id+'-'+b+'" value="'+v[b]+'"></label>'; }).join(''); }
      else if(r.keys){ ins=r.keys.map(function(k){ return '<label>'+tr(k[1])+'<input type="number" step="any" min="0" id="'+id+'-'+k[0]+'" value="'+v[k[0]]+'" style="width:4.6em"></label>'; }).join(''); }
      else { ins='<input type="number" step="any" min="0" id="'+id+'" value="'+(r.pct?+(v*100).toFixed(2):v)+'"> <span class="small muted">'+(r.pct?'%':tr(r.unit||''))+'</span>'; }
      if(r.cols) ins+=' <span class="small muted" style="align-self:end;padding-bottom:6px">'+tr(r.unit||'')+'</span>';
      return '<tr class="arow" id="'+id+'-row"><td>'+rowLabel(r)+'</td><td><div class="ins">'+ins+'</div></td><td><span id="'+id+'-chip"></span></td><td><button class="link" id="'+id+'-reset" hidden>'+tr('Reset')+'</button></td></tr>';
    }).join('')+'</tbody></table></div></div>';
  }).join('');
  $('asmBody').innerHTML=html;
  META.forEach(function(g,gi){ g.rows.forEach(function(r,ri){
    var id='a-'+gi+'-'+ri;
    function hook(el,apply){ el.addEventListener('input',function(){ var x=parseFloat(el.value); if(!isFinite(x)||x<0) return; apply(x); update(); }); }
    if(r.cols){ r.cols.forEach(function(c,b){ hook($(id+'-'+b),function(x){ var a=get(A,r.p).slice(); a[b]=x; setp(A,r.p,a); }); }); }
    else if(r.keys){ r.keys.forEach(function(k){ hook($(id+'-'+k[0]),function(x){ var o=clone(get(A,r.p)); o[k[0]]=x; setp(A,r.p,o); }); }); }
    else hook($(id),function(x){ setp(A,r.p,r.pct?x/100:x); });
    $(id+'-reset').addEventListener('click',function(){ setp(A,r.p,clone(get(DEFAULTS,r.p))); renderAssumptions(); update(); });
  }); });
}
function paintAssumptionChips(){
  META.forEach(function(g,gi){ g.rows.forEach(function(r,ri){
    var id='a-'+gi+'-'+ri, d=isDefault(r), chip=$(id+'-chip'); if(!chip) return;
    chip.className='chip '+(d?'unc':'team'); chip.textContent=d?tr('Uncalibrated'):tr('Team value');
    $(id+'-reset').hidden=d; $(id+'-row').classList.toggle('changed',!d);
  }); });
}
var CHK=['web2','ios','android','a11y'];
function chGet(k){ return k==='a11y'?!!S.a11y:!!(S.channels&&S.channels[k]); }
function chSet(k,v){ if(k==='a11y') S.a11y=v; else { S.channels=S.channels||{}; S.channels[k]=v; } }
function syncChannels(){ ['r','d'].forEach(function(p){ CHK.forEach(function(k){ var e=$(p+'-ch-'+k); if(e) e.checked=chGet(k); }); }); }
function bindChannels(){ ['r','d'].forEach(function(p){ CHK.forEach(function(k){ var e=$(p+'-ch-'+k); if(!e) return; e.addEventListener('change',function(){ chSet(k,e.checked); syncChannels(); update(); }); }); }); syncChannels(); }
function chNames(c){ var n=[tr('Web')]; CH.forEach(function(x){ if(c.ch[x.k]) n.push(tr(x.label)); }); return n.join(', '); }
var TIPS={'d-fields':'Count every input control users can type or pick on the screens in scope. Take it from the screen specifications in the FSD.',
 'd-reqFields':'Unique fields across all request DTOs. Count a DTO shared by several endpoints once. Source: OpenAPI spec or the API design document.',
 'd-respFields':'Unique fields in responses and published event payloads. Source: OpenAPI spec and the event schemas (Avro, JSON Schema).',
 'd-roles':'Distinct user roles or permission profiles that reach the system in scope, including back-office roles.',
 'd-actions':'Permission-checked actions that are not workflow transitions: view balance, export, download statement. Transitions are added automatically.',
 'd-approvals':'Workflows with a maker-checker or multi-level approval step. Each adds segregation-of-duties cases.',
 'd-critical':'Rules that move money or are regulatory: AML thresholds, limits, fees, interest. They are always tested in full in SIT.',
 'd-variants':'Products, customer segments or currencies that change a rule outcome. 1 means no variants.',
 'd-languages':'UI languages, for example Vietnamese and English = 2.',
 'roughRoles':'Distinct user roles or permission profiles in scope.',
 'roughVariants':'Products, segments or currencies that change rule outcomes. 1 means no variants.',
 't-weeks':'The SIT execution window. The FTE result is the average team needed across these weeks.',
 't-env':'How often testers wait for environments. Shared core-banking windows is the slowest. Multiplies execution time only.',
 't-auto':'Share of the regression pass already automated. Reduces the manual regression pass only.',
 't-ai':'Design-time saving from AI-assisted test design, off by default. Only synthetic data may be used in prompts.',
 'e-mut':'PIT mutation score from the backend Jenkins stage. Gate 70% overall.',
 'e-be':'Share of Bean Validation constraints with a failing test, from the constraint coverage gate report.',
 'e-rule':'Share of business rules with decision-table unit tests. Ask the tech lead or count the rule test classes.',
 'e-map':'Share of mappers and DTOs with mapping or @JsonTest tests.',
 'e-fe':'Share of UI fields whose validators or Zod schemas have matrix tests, from the frontend gate report.',
 'e-feunit':'Vitest or Jest coverage of UI logic from the frontend pipeline.',
 'e-femut':'Stryker mutation score from the frontend pipeline, if it runs.',
 'e-ios':'XCTest unit coverage of the iOS app logic (view models, services), from the iOS pipeline.',
 'e-android':'JUnit and Espresso unit coverage of the Android app logic, from the Android pipeline.',
 'dd-scd':'Dimensions that keep history (slowly changing dimension type 2).',
 'dd-secured':'Datasets with row-level security, column masking or PII restrictions.',
 'dd-roles':'Distinct data access roles or groups that read the secured datasets.',
 'da-rag':'Document collections or knowledge bases the assistant retrieves from.',
 'da-tools':'APIs or actions the agent can call on its own, such as check balance or create a ticket.',
 'da-guard':'Risk categories to red-team: prompt injection, sensitive data disclosure, system prompt leakage, excessive agency, misinformation, toxicity.',
 'da-hitl':'Steps where a person approves, corrects or takes over from the AI.',
 't-aiIters':'How many times the evaluation set is re-run in SIT, once per model, prompt or retrieval change.',
 't-aiSmes':'Business experts available to label the golden set and write reference answers.',
 'e-dq':'Share of mapped columns and DQ rules covered by pipeline tests (dbt tests, Great Expectations) in CI.',
 'e-contract':'Share of source feeds with data contract or schema tests in CI.',
 'e-reuse':'Share of the golden set reused from an earlier release or another product, already labelled.',
 'dp-dataHeavy':'Scenarios that need production-size data: batch runs, reports, search over large history, AI throughput.',
 'e-ptreuse':'Share of performance scripts that already exist from an earlier release and only need updating.'};
function applyTips(){
  Object.keys(TIPS).forEach(function(id){
    var e=$(id); if(!e) return; var lab=e.closest('label'); if(!lab) return;
    var tip=lab.querySelector('.tip');
    if(!tip){
      var t=lab.firstChild; if(!t||t.nodeType!==3) return;
      var wrap=document.createElement('span'); wrap.className='lt'; wrap.textContent=t.nodeValue.trim();
      tip=document.createElement('button'); tip.type='button'; tip.className='tip'; tip.textContent='?'; tip.tabIndex=0;
      tip.addEventListener('click',function(ev){ ev.preventDefault(); ev.stopPropagation(); var on=tip.classList.contains('open'); closeTips(); if(!on) tip.classList.add('open'); });
      wrap.appendChild(tip); lab.replaceChild(wrap,t);
    }
    tip.setAttribute('data-tip',tr(TIPS[id])); tip.setAttribute('aria-label',tr(TIPS[id]));
  });
}
function closeTips(){ Array.prototype.forEach.call(document.querySelectorAll('.tip.open'),function(t){ t.classList.remove('open'); }); }
document.addEventListener('click',closeTips); document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeTips(); });
function grpH(D,pf){ var h=0; GROUPS.forEach(function(g){ if(g.pf===pf) h+=D.groups[g.k].hours; }); return h; }
function renderGuide(D){
  var c=D.c, x=D.x, steps=[
    trf('Scope: {a} APIs, {s} screens, {i} integrations, {r} rules, {w} workflows, {b} batch jobs, {e} event topics, {j} journeys on {ch}.',{a:num1(x.apis),s:num1(sum3(c.screen)),i:num1(sum3(c.integration)),r:num1(x.rTot),w:num1(x.wfTot),b:num1(sum3(c.batch)),e:num1(sum3(c.event)),j:num1(sum3(c.journey)),ch:chNames(c)}),
    trf('Cases: counted drivers × cases per driver by complexity, plus the derived rows (validation, mapping, roles, mobile, accessibility), after shift-left credit = {n} cases and samples.',{n:fmt(D.cases)}),
    trf('Application hours: each case gets {d} design minutes plus its execution minutes × (cycles {cy} + regression {rg} × (1 − automated {au})) × (1 + retest {rt}) × environment {env}.',{d:num1(D.design),cy:A.cycles,rg:pctS(A.regression),au:pctS(D.auto),rt:pctS(D.retest),env:D.env.toFixed(2)}),
    x.dOn?trf('Data platform: {f} feeds, {p} pipelines, {t} tables, {c} mapped columns and {q} DQ rules over {l} load cycles = {h} h.',{f:fmt(sum3(c.data.feed)),p:fmt(sum3(c.data.pipe)),t:fmt(sum3(c.data.table)),c:fmt(sum3(c.data.columns)),q:fmt(sum3(c.data.dq)),l:A.dataCycles,h:fmt(grpH(D,'data'))}):tr('Data platform: not in scope.'),
    x.aOn?trf('AI product: {i} intents, {s} knowledge sources, {o} OCR document types and {g} guardrail categories, {r} evaluation runs = {h} h of QE time, plus {m} h of SME labelling.',{i:fmt(sum3(c.ai.intent)),s:fmt(c.ai.rag),o:fmt(sum3(c.ai.ocr)),g:fmt(c.ai.guard),r:x.iters,h:fmt(grpH(D,'ai')),m:fmt(D.smeLabelHours)}):tr('AI product: not in scope.'),
    x.ptOn?trf('Performance testing: {n} scenarios, {r} runs per cycle × {c} cycles = {h} h.',{n:x.ptN,r:x.runN,c:x.ptCycles,h:fmt(grpH(D,'pt'))}):tr('Performance testing: not in scope.'),
    trf('All hours, each including {oh} overhead: application + data + AI + performance = {h} h.',{oh:pctS(A.overhead),h:fmt(D.hours)}),
    trf('Capacity: one FTE gives {w} weeks × {dw} days × {ph} productive hours = {hpf} h, × blended capacity {bl} for the team mix = {per} h.',{w:S.team.weeks,dw:A.daysPerWeek,ph:A.hoursPerDay,hpf:fmt(D.hpf),bl:D.blended.toFixed(2),per:fmt(D.per)}),
    trf('FTE: {h} h ÷ {per} h = {f} FTE, shown as a range of {lo} – {hi} (±{b}%).',{h:fmt(D.hours),per:fmt(D.per),f:f1(D.fte),lo:f1(D.lo),hi:f1(D.hi),b:Math.round(D.band*100)})];
  $('guideTrace').innerHTML=steps.map(function(t){ return '<li>'+esc(t)+'</li>'; }).join('');
}
function renderAiSelect(){ var ta=$('t-ai'); ta.innerHTML=AI.map(function(e,i){ return '<option value="'+i+'">'+tr(e)+'</option>'; }).join(''); ta.value=String(S.team.ai||0); }
function renderEnvSelect(){ var te=$('t-env'); te.innerHTML=ENV.map(function(e,i){ return '<option value="'+i+'">'+tr(e)+'</option>'; }).join(''); te.value=String(S.team.env); }
function placeholders(){ $('profName').placeholder=tr('Uncalibrated defaults'); $('io').placeholder=tr('Paste an exported profile here, then Import.'); }
function bindStatic(){
  bindNum('roughRoles',function(){ return S.roughRoles; },function(v){ S.roughRoles=Math.max(0,v); });
  bindNum('d-fields',function(){ return S.detail.fields; },function(v){ S.detail.fields=Math.max(0,v); });
  bindNum('d-reqFields',function(){ return S.detail.reqFields; },function(v){ S.detail.reqFields=Math.max(0,Math.round(v)); });
  bindNum('d-respFields',function(){ return S.detail.respFields; },function(v){ S.detail.respFields=Math.max(0,Math.round(v)); });
  bindNum('d-roles',function(){ return S.detail.roles; },function(v){ S.detail.roles=Math.max(0,v); });
  bindNum('d-actions',function(){ return S.detail.actions; },function(v){ S.detail.actions=Math.max(0,v); });
  bindNum('roughLanguages',function(){ return S.roughLanguages; },function(v){ S.roughLanguages=Math.max(1,Math.round(v)); });
  bindChannels(); bindDai();
  bindNum('d-languages',function(){ return S.detail.languages; },function(v){ S.detail.languages=Math.max(1,Math.round(v)); });
  bindNum('d-approvals',function(){ return S.detail.approvals; },function(v){ S.detail.approvals=Math.max(0,Math.round(v)); });
  bindNum('d-critical',function(){ return S.detail.critical; },function(v){ S.detail.critical=Math.max(0,Math.round(v)); });
  bindNum('d-variants',function(){ return S.detail.variants; },function(v){ S.detail.variants=Math.max(1,Math.round(v)); });
  bindNum('roughVariants',function(){ return S.roughVariants; },function(v){ S.roughVariants=Math.max(1,Math.round(v)); });
  bindNum('t-auto',function(){ return S.team.automation; },function(v){ S.team.automation=Math.min(100,Math.max(0,v)); });
  renderEnvSelect(); $('t-env').addEventListener('change',function(e){ S.team.env=+e.target.value; update(); });
  renderAiSelect(); applyTips(); $('t-ai').addEventListener('change',function(e){ S.team.ai=+e.target.value; update(); });
  bindNum('t-weeks',function(){ return S.team.weeks; },function(v){ S.team.weeks=Math.max(0,v); });
  ['junior','mid','senior'].forEach(function(l){ bindNum('t-'+l,function(){ return S.team.mix[l]; },function(v){ S.team.mix[l]=Math.max(0,v); }); });
  bindNum('e-mut',function(){ return S.evidence.mutation; },function(v){ S.evidence.mutation=Math.min(100,Math.max(0,v)); });
  bindNum('e-be',function(){ return S.evidence.valBE; },function(v){ S.evidence.valBE=Math.min(100,Math.max(0,v)); });
  bindNum('e-fe',function(){ return S.evidence.valFE; },function(v){ S.evidence.valFE=Math.min(100,Math.max(0,v)); });
  ['mapCov:e-map','jacoco:e-jacoco','feUnit:e-feunit','feMut:e-femut','ruleCov:e-rule','iosUnit:e-ios','androidUnit:e-android','dqCov:e-dq','contractCov:e-contract','goldenReuse:e-reuse'].forEach(function(x){ var p=x.split(':'); bindNum(p[1],function(){ return S.evidence[p[0]]; },function(v){ S.evidence[p[0]]=Math.min(100,Math.max(0,v)); }); });
  var l4=$('e-l4'); l4.checked=!!S.includeL4; l4.addEventListener('change',function(){ S.includeL4=l4.checked; update(); });
  $('profName').value=PROFILE; $('profName').addEventListener('input',function(e){ PROFILE=e.target.value; update(); });
  placeholders();
}
function syncStaticValues(){
  $('roughRoles').value=S.roughRoles; $('d-fields').value=S.detail.fields; $('d-reqFields').value=S.detail.reqFields; $('d-respFields').value=S.detail.respFields; $('d-roles').value=S.detail.roles; $('d-actions').value=S.detail.actions;
  $('t-weeks').value=S.team.weeks; ['junior','mid','senior'].forEach(function(l){ $('t-'+l).value=S.team.mix[l]; });
  $('e-mut').value=S.evidence.mutation; $('e-be').value=S.evidence.valBE; $('e-fe').value=S.evidence.valFE; $('e-l4').checked=!!S.includeL4; $('profName').value=PROFILE;
  $('roughLanguages').value=S.roughLanguages; $('d-languages').value=S.detail.languages; syncChannels(); syncDai();
  $('t-env').value=String(S.team.env); $('t-auto').value=S.team.automation; $('t-ai').value=String(S.team.ai||0);
  $('e-map').value=S.evidence.mapCov; $('e-jacoco').value=S.evidence.jacoco; $('e-feunit').value=S.evidence.feUnit; $('e-femut').value=S.evidence.feMut; $('e-rule').value=S.evidence.ruleCov; $('e-ios').value=S.evidence.iosUnit; $('e-android').value=S.evidence.androidUnit; $('e-dq').value=S.evidence.dqCov; $('e-contract').value=S.evidence.contractCov; $('e-reuse').value=S.evidence.goldenReuse;
  $('d-approvals').value=S.detail.approvals; $('d-critical').value=S.detail.critical; $('d-variants').value=S.detail.variants; $('roughVariants').value=S.roughVariants;
}

/* ---------- render results ---------- */
var LAST={};
function sign(n){ return n>0?'+':n<0?'−':''; }
function driveText(top,tpl1,tpl2){ return trf(/s$/.test(top.label)?tpl1:tpl2,{label:tr(top.label),p:top.share}); }
function update(){
  var R=compute('rough',A,S), D=compute('detailed',A,S); LAST={R:R,D:D};
  var unc=uncCount(), total=ROWS.length;
  var gapF=D.fte-R.fte, gapC=D.cases-R.cases, top=topGap(R,D);
  $('summary').innerHTML=
    card('rough',tr('Rough · no FSD'),'var(--rough)',R)+
    card('detail',tr('Detailed · with FSD'),'var(--detail)',D)+
    '<div class="card gap"><div class="k">'+tr('Gap, detailed − rough')+'</div><div class="big">'+(gapF>=0?'+':'−')+f1(Math.abs(gapF))+'<small>FTE</small></div>'+
      '<div class="rng">'+trf('{s}{c} cases · {p}',{s:gapC>=0?'+':'−',c:fmt(Math.abs(gapC)),p:R.cases?((gapC>=0?'+':'−')+Math.round(Math.abs(gapC)/R.cases*100)+'%'):''})+'</div>'+
      '<div class="sub">'+(top?esc(driveText(top,'{label} drive {p}% of the gap','{label} drives {p}% of the gap')):tr('Rough and detailed agree'))+'</div></div>'+
    '<div class="card cal"><div class="k">'+tr('Calibration')+'</div><div class="big">'+unc+'<small>'+trf('of {n}',{n:total})+'</small></div>'+
      '<div class="meter" aria-hidden="true"><span style="width:'+(unc/total*100)+'%"></span></div>'+
      '<div class="sub">'+tr('assumptions are still uncalibrated defaults')+(PROFILE?esc(trf(' · profile “{p}”',{p:PROFILE})):'')+'</div></div>';
  $('tabUnc').textContent=trf('{n} uncalibrated',{n:unc});
  S.features.forEach(function(f,i){ var el=$('f-exp-'+i); if(el&&f.pt) el.setAttribute('data-pt',trf('+ {n} PT scenarios',{n:(A.ptRoughScen[f.size]||0)*(+f.qty||0)})); else if(el) el.removeAttribute('data-pt'); });
  S.features.forEach(function(f,i){ var t=f.type||'app', q=+f.qty||0, el=$('f-exp-'+i), p; if(!el) return;
    if(t==='data'){ p=A.dproxies[f.size]; if(p) el.textContent=trf('{a} feeds · {b} pipelines · {c} tables · {d} columns · {e} DQ rules · {f} reports',{a:p.feed*q,b:p.pipe*q,c:p.table*q,d:p.columns*q,e:p.dq*q,f:p.report*q}); return; }
    if(t==='ai'){ p=A.aproxies[f.size]; if(p) el.textContent=trf('{a} intents · {b} OCR types · {c} sources · {d} tools · {e} guardrails · {f} HITL',{a:p.intent*q,b:p.ocr*q,c:p.rag*q,d:p.tools*q,e:p.guard,f:p.hitl*q}); return; }
    p=A.proxies[f.size]; if(p) el.textContent=trf('{a} scr · {b} fld · {c} API · {d} int · {e} rules · {f} batch · {g} evt · {h} wf',{a:p.screen*q,b:p.field*q,c:p.api*q,d:p.integration*q,e:p.rule*q,f:p.batch*q,g:p.event*q,h:p.workflow*q}); });
  DRV.forEach(function(d){ $('dt-'+d.k).textContent=fmt(sum3(D.c[d.k])); $('dr-r-'+d.k).textContent=fmt(sum3(R.c[d.k])); $('dr-'+d.k).style.opacity=(d.k==='journey'&&!S.includeL4)?.45:1; });
  syncFieldTotal();
  $('apiFieldsNote').textContent=trf('Estimated if left at 0: {r} request fields and {p} response and payload fields from {a} APIs and {t} topics, after {u} DTO reuse.',{r:fmt(D.x.reqIn?0:D.x.reqF),p:fmt(D.x.respIn?0:D.x.respF),a:num1(D.x.apis),t:num1(sum3(D.c.event)),u:pctS(A.dtoReuse)});
  $('detRoughCmp').textContent=trf('Rough said {f} fields, {r} roles, {a} protected actions, {w} approval workflows, {k} critical rules, {v} variants and {l} languages.',{f:fmt(R.c.fields),r:fmt(R.c.roles),a:fmt(R.c.actions),w:fmt(R.c.approvals),k:fmt(R.c.critical),v:R.c.variants,l:R.c.languages});
  $('t-hpf').textContent=trf('{h} h  ({w} wk × {d} d × {p} h)',{h:fmt(D.hpf),w:S.team.weeks,d:A.daysPerWeek,p:A.hoursPerDay});
  $('t-blend').textContent=D.blended.toFixed(2)+' ×';
  var mixTot=(+S.team.mix.junior||0)+(+S.team.mix.mid||0)+(+S.team.mix.senior||0);
  $('mixNote').textContent=mixTot===100?tr('Mix adds up to 100%.'):trf('Mix adds up to {n}%. The model normalises it to 100%.',{n:mixTot});
  $('envNote').textContent=trf('{env}: execution time × {f}.',{env:tr(ENV[D.envI]),f:D.env.toFixed(2)})+' '+(D.auto>0?trf('{a}% of the regression pass is automated, so manual regression covers {m}% of cases instead of {r}%.',{a:Math.round(D.auto*100),m:Math.round(A.regression*(1-D.auto)*100),r:Math.round(A.regression*100)}):tr('The regression pass is fully manual.'));
  $('aiNote').textContent=D.aiI>0?trf('{lvl}: test design time −{p}%, including validation design. Use only synthetic data in prompts and generated test data, never real customer data or PII.',{lvl:tr(AI[D.aiI]),p:Math.round(D.aiCut*100)}):tr('No AI assistance assumed. Turn it on only after a pilot has measured the saving on your own work.');
  $('lvlTable').tBodies[0].innerHTML=['Junior','Mid','Senior'].map(function(l,i){ var k=['junior','mid','senior'][i]; return '<tr><td>'+tr(l)+' <span class="small muted">('+A.capacity[i]+'×)</span></td><td class="n">'+(mixTot?Math.round(S.team.mix[k]/mixTot*100):0)+'%</td><td class="n">'+f1(R.levels[i])+'</td><td class="n">'+f1(D.levels[i])+'</td></tr>'; }).join('')+
    '<tr><td><b>'+tr('Total')+'</b></td><td></td><td class="n"><b>'+f1(R.fte)+'</b></td><td class="n"><b>'+f1(D.fte)+'</b></td></tr>';
  $('eff-mut').innerHTML=D.mutOK?'<span class="chip good">'+tr('Gate met')+'</span> '+tr('Business-rule cases and retest rate stay at base.'):
    '<span class="chip bad">'+trf('Below {g}% gate',{g:A.mutationGate})+'</span> '+trf('Business-rule cases +{u}%, retest rate {w}% instead of {r}%.',{u:Math.round(A.ruleUplift*100),w:Math.round(A.retestWeak*100),r:Math.round(A.retest*100)});
  $('eff-be').innerHTML=creditText(D.be,'API',A.sampleBE,D.x.perField.toFixed(1));
  $('eff-fe').innerHTML=creditText(D.fe,'screen',A.sampleFE,D.x.perField.toFixed(1));
  $('eff-l4').innerHTML=S.includeL4?'<span class="chip warn">'+tr('Counted')+'</span> '+trf('{n} journey cases in the detailed estimate.',{n:fmt(D.groups.journey.cases)}):'<span class="chip good">'+tr('Not counted')+'</span> '+tr('Journeys are excluded from SIT sizing.');
  var mc=fmt(D.groups.mapping.cases);
  $('eff-map').innerHTML=D.mp==='sample'?'<span class="chip good">'+tr('100% · credited')+'</span> '+tr('SIT does not re-check field mapping or JSON formats.'):
    D.mp==='partial'?'<span class="chip warn">'+tr('50–99% · partial')+'</span> '+trf('{p}% of mapping checks come back into SIT: {n} cases.',{p:Math.round(A.partialShare*100),n:mc}):
    '<span class="chip bad">'+tr('Below 50%')+'</span> '+trf('SIT checks every API response and event payload by hand: {n} cases.',{n:mc});
  var jc=+S.evidence.jacoco||0;
  $('eff-jacoco').innerHTML='<span class="chip '+(jc>=80?'good':'warn')+'">'+tr(jc>=80?'Meets 80%':'Below 80%')+'</span> '+tr('Informational, not credited. Coverage shows the code ran; the mutation score shows the tests catch bugs, so only mutation changes the estimate.');
  $('eff-feunit').innerHTML=D.feUnitOK?'<span class="chip good">'+tr('Gate met')+'</span> '+tr('Screen cases stay at base.'):
    '<span class="chip bad">'+trf('Below {g}% gate',{g:A.feUnitGate})+'</span> '+trf('Screen cases +{u}%: UI logic defects reach SIT.',{u:Math.round(A.feLogicUplift*100)});
  $('eff-femut').innerHTML=D.feMutOK?'<span class="chip good">'+tr('Gate met')+'</span> '+tr('No extra screen cases.'):
    '<span class="chip bad">'+trf('Below {g}% gate',{g:A.feMutGate})+'</span> '+trf('Screen cases +{u}%: weak frontend tests let defects through.',{u:Math.round(A.feMutUplift*100)});
  $('eff-rule').innerHTML=D.rc==='sample'?'<span class="chip good">'+tr('100% · credited')+'</span> '+trf('Standard rules: SIT runs {n} wiring case per rule. Critical rules are always tested in full.',{n:A.wiringCases}):
    D.rc==='partial'?'<span class="chip warn">'+tr('50–99% · partial')+'</span> '+trf('{p}% of standard-rule cases come back into SIT. Critical rules are always tested in full.',{p:Math.round(A.partialShare*100)}):
    '<span class="chip bad">'+tr('Below 50%')+'</span> '+tr('SIT runs every decision-table case for every rule.');
  renderDerived(D); renderRubric(D); renderGuide(D); updateDai(D,R); updateDsec(D);
  ['ios','android'].forEach(function(k){ var on=D.c.ch[k], ok=(+S.evidence[k+'Unit']||0)>=A.mobileUnitGate; $('eff-'+k).innerHTML=!on?'<span class="chip">'+tr('Channel off')+'</span> '+tr('Select the channel in the scope tabs to count it.'):ok?'<span class="chip good">'+tr('Gate met')+'</span> '+tr('Mobile cases stay at base.'):'<span class="chip bad">'+trf('Below {g}% gate',{g:A.mobileUnitGate})+'</span> '+trf('Mobile cases for this platform +{u}%.',{u:Math.round(A.mobileUplift*100)}); });
  renderGap(R,D); renderTornado(); renderScen(D); paintAssumptionChips(); cone();
  var cs=$('calStatus'); cs.className='chip '+(unc===total?'unc':'team'); cs.textContent=unc===total?tr('Uncalibrated defaults'):trf('{n} of {t} values calibrated',{n:total-unc,t:total});
  save();
}
function card(cls,label,color,o){
  return '<div class="card '+cls+'"><div class="k"><i style="background:'+color+'"></i>'+label+'</div>'+
    '<div class="big">'+f1(o.fte)+'<small>FTE</small></div>'+
    '<div class="rng">'+trf('range {lo} – {hi} FTE (±{b}%)',{lo:f1(o.lo),hi:f1(o.hi),b:Math.round(o.band*100)})+'</div>'+
    '<div class="sub">'+trf('{c} cases · {h} h · <span style="white-space:nowrap">{w} weeks</span>',{c:fmt(o.cases),h:fmt(o.hours),w:S.team.weeks})+'</div></div>';
}
function creditText(state,unit,sample,per){
  if(state==='sample') return '<span class="chip good">'+tr('100% · credited')+'</span> '+trf(unit==='API'?'SIT runs {n} sample case per API.':'SIT runs {n} sample case per screen.',{n:sample});
  if(state==='partial') return '<span class="chip warn">'+tr('50–99% · partial')+'</span> '+trf('{p}% of field cases come back into SIT.',{p:Math.round(A.partialShare*100)});
  return '<span class="chip bad">'+tr('Below 50%')+'</span> '+trf('SIT repeats the full field-type matrix by hand: about {n} cases per field.',{n:per});
}
function topGap(R,D){
  var tot=D.hours-R.hours; if(Math.abs(tot)<1e-6) return null;
  var best=null; GROUPS.forEach(function(G){ var d=D.groups[G.k].hours-R.groups[G.k].hours; if(!best||Math.abs(d)>Math.abs(best.d)) best={label:G.label,d:d}; });
  best.share=Math.round(best.d/tot*100); return best;
}
function renderGap(R,D){
  var max=1; GROUPS.forEach(function(G){ max=Math.max(max,R.groups[G.k].cases,D.groups[G.k].cases); });
  var totH=D.hours-R.hours, per=D.per||1;
  var rows=GROUPS.filter(function(G){ var r=R.groups[G.k], d=D.groups[G.k]; return r.cases||d.cases||r.hours>0.01||d.hours>0.01; }).map(function(G){
    var r=R.groups[G.k], d=D.groups[G.k], dc=d.cases-r.cases, dh=d.hours-r.hours;
    var share=Math.abs(totH)>1e-6?Math.round(dh/totH*100):0;
    return {G:G,r:r,d:d,dc:dc,dh:dh,share:share};
  });
  $('gapTable').tBodies[0].innerHTML=rows.map(function(x){
    return '<tr><td>'+tr(x.G.label)+'</td><td class="n">'+fmt(x.r.cases)+'</td><td class="n">'+fmt(x.d.cases)+'</td>'+
      '<td><div class="bars"><div class="bar r" style="width:'+(x.r.cases/max*100)+'%"></div><div class="bar d" style="width:'+(x.d.cases/max*100)+'%"></div></div></td>'+
      '<td class="n '+(x.dc>0?'pos':x.dc<0?'neg':'')+'">'+sign(x.dc)+fmt(Math.abs(x.dc))+'</td>'+
      '<td class="n '+(x.dh>0?'pos':x.dh<0?'neg':'')+'">'+(x.dh>=0?'+':'−')+f1(Math.abs(x.dh/per))+'</td>'+
      '<td class="n">'+x.share+'%</td></tr>';
  }).join('');
  $('gapTable').tFoot.innerHTML='<tr><td>'+tr('Total')+'</td><td class="n">'+fmt(R.cases)+'</td><td class="n">'+fmt(D.cases)+'</td><td></td><td class="n">'+(D.cases>=R.cases?'+':'−')+fmt(Math.abs(D.cases-R.cases))+'</td><td class="n">'+(D.fte>=R.fte?'+':'−')+f1(Math.abs(D.fte-R.fte))+'</td><td class="n">100%</td></tr>';
  var sorted=rows.slice().sort(function(a,b){ return Math.abs(b.dh)-Math.abs(a.dh); });
  var t1=sorted[0], t2=sorted[1];
  $('gapCallout').innerHTML=Math.abs(totH)<1e-6?tr('Rough and detailed estimates match.'):
    trf(D.fte>=R.fte?'The detailed estimate is <b>{n} FTE higher</b> than rough.':'The detailed estimate is <b>{n} FTE lower</b> than rough.',{n:f1(Math.abs(D.fte-R.fte))})+' '+
    trf('{a} ({ap}%) and {b} ({bp}%) explain most of it.',{a:esc(tr(t1.G.label)),ap:t1.share,b:esc(tr(t2.G.label)),bp:t2.share})+' '+
    trf('Rough uses {r} design minutes per case against {d} with an FSD, so the same scope costs more per case before the FSD exists.',{r:A.designNoFSD,d:A.designFSD});
}
function renderTornado(){
  var mode=$('sMode').value, sw=+$('sSwing').value, base=compute(mode,A,S).fte;
  var list=SENS.filter(function(s){ return !(s.rough&&mode!=='rough'); }).map(function(s){
    var a1=clone(A), a2=clone(A); s.f(a1,1-sw); s.f(a2,1+sw);
    var v1=compute(mode,a1,S).fte, v2=compute(mode,a2,S).fte;
    return {label:s.label,lo:Math.min(v1,v2),hi:Math.max(v1,v2),span:Math.abs(v2-v1)};
  }).filter(function(x){ return x.span>1e-6; }).sort(function(a,b){ return b.span-a.span; });
  var maxDev=1e-9; list.forEach(function(x){ maxDev=Math.max(maxDev,Math.abs(x.lo-base),Math.abs(x.hi-base)); });
  function pos(v){ return 50+(v-base)/maxDev*48; }
  $('torn').innerHTML=list.map(function(x){
    var lo=pos(x.lo), hi=pos(x.hi);
    return '<div class="trow"><div>'+tr(x.label)+'</div><div class="track" aria-hidden="true">'+
      '<span class="lo" style="left:'+Math.min(lo,50)+'%;width:'+Math.max(0,50-lo)+'%"></span>'+
      '<span class="hi" style="left:50%;width:'+Math.max(0,hi-50)+'%"></span><span class="mid"></span></div>'+
      '<div class="tval">'+trf('{lo} – {hi} FTE',{lo:f1(x.lo),hi:f1(x.hi)})+'</div></div>';
  }).join('');
  var t=list[0];
  $('tornHint').innerHTML=trf('Each assumption is moved {s}% up and down while everything else stays fixed. Current {mode} estimate: <b class="mono">{f} FTE</b>. Calibrate the top rows first: <b>{t}</b> alone swings the answer between {lo} and {hi} FTE.',
    {s:Math.round(sw*100),mode:tr(mode),f:f1(base),t:esc(tr(t.label).toLowerCase()),lo:f1(t.lo),hi:f1(t.hi)});
}
function renderScen(D){
  var gate=A.mutationGate;
  var sc=[
    {label:tr('All gates met'),sub:tr('Every backend and frontend L1 gate passes'),E:{mutation:Math.max(gate,80),valBE:100,valFE:100,mapCov:100,jacoco:90,feUnit:Math.max(A.feUnitGate,90),feMut:Math.max(A.feMutGate,80),ruleCov:100,iosUnit:Math.max(A.mobileUnitGate,90),androidUnit:Math.max(A.mobileUnitGate,90),dqCov:100,contractCov:100,goldenReuse:S.evidence.goldenReuse,evalCI:true,ptCI:true}},
    {label:tr('Current evidence'),sub:trf('Mutation {m}%, rules {r}%, BE {b}%, FE {f}%, mapping {p}%, FE unit {u}%, Stryker {s}%',{r:S.evidence.ruleCov,m:S.evidence.mutation,b:S.evidence.valBE,f:S.evidence.valFE,p:S.evidence.mapCov,u:S.evidence.feUnit,s:S.evidence.feMut}),E:S.evidence,cur:1},
    {label:tr('No gates'),sub:tr('Nothing proven before SIT'),E:{mutation:0,valBE:0,valFE:0,mapCov:0,jacoco:0,feUnit:0,feMut:0,ruleCov:0,iosUnit:0,androidUnit:0,dqCov:0,contractCov:0,goldenReuse:S.evidence.goldenReuse,evalCI:false,ptCI:false}}
  ].map(function(s){ s.o=compute('detailed',A,S,s.E); return s; });
  var max=Math.max.apply(null,sc.map(function(s){ return s.o.fte; }))||1;
  $('scen').innerHTML=sc.map(function(s){
    return '<div class="srow'+(s.cur?' cur':'')+'"><div><div class="lbl">'+s.label+'</div><div class="small muted">'+s.sub+'</div></div>'+
      '<div class="strack" aria-hidden="true"><span style="width:'+(s.o.fte/max*100)+'%"></span></div>'+
      '<div class="tval"><b style="color:var(--ink)">'+f1(s.o.fte)+' FTE</b><br>'+trf('{n} cases',{n:fmt(s.o.cases)})+'</div></div>';
  }).join('');
  var save1=sc[1].o.fte-sc[0].o.fte, save2=sc[2].o.fte-sc[0].o.fte;
  $('scenCallout').innerHTML=save1>0.05?
    trf('Closing the remaining gates would free about <b>{a} FTE</b> ({c} fewer manual cases) for this scope. Against no gates at all, the shift-left investment is worth <b>{b} FTE</b>.',{a:f1(save1),c:fmt(sc[1].o.cases-sc[0].o.cases),b:f1(save2)}):
    trf('All gates are met. Compared with no gates, the shift-left work saves about <b>{b} FTE</b> ({c} fewer manual cases) for this scope.',{b:f1(save2),c:fmt(sc[2].o.cases-sc[0].o.cases)});
}
function cone(){
  var r=Math.round(A.band.rough*100), d=Math.round(A.band.detailed*100);
  $('coneRough').textContent='±'+r+'%'; $('coneDet').textContent='±'+d+'%';
  var tight=[]; if(r<100) tight.push(tr('rough')); if(d<50) tight.push(tr('detailed'));
  $('coneNote').textContent=tight.length?
    trf(tight.length>1?'The {w} ranges are narrower than the cone suggests.':'The {w} range is narrower than the cone suggests.',{w:tight.join(tr(' and '))})+' '+
    tr('The model uses symmetric ranges, so for a conservative upper bound set Range, rough to 100% and Range, detailed to 50% under Assumptions. Estimates tend to overrun more than underrun, so read the upper bound as the planning risk.'):
    tr('Both ranges are at least as wide as the cone suggests on the upside.');
}

/* ---------- tabs ---------- */
var tabs=Array.prototype.slice.call(document.querySelectorAll('.tab'));
tabs.forEach(function(t){ t.addEventListener('click',function(){ select(t); });
  t.addEventListener('keydown',function(e){ var i=tabs.indexOf(t); if(e.key==='ArrowRight'||e.key==='ArrowLeft'){ e.preventDefault(); var n=tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length]; select(n); n.focus(); } }); });
function select(t){ tabs.forEach(function(x){ var on=x===t; x.setAttribute('aria-selected',on?'true':'false'); x.tabIndex=on?0:-1; $(x.getAttribute('aria-controls')).hidden=!on; }); try{ localStorage.setItem(KEY+'-tab',t.id); }catch(e){} }
try{ var st=localStorage.getItem(KEY+'-tab'); if(st&&$(st)) select($(st)); else select(tabs[0]); }catch(e){ select(tabs[0]); }

/* ---------- calibration I/O ---------- */
function toast(msg,bad){ var t=$('toast'); t.textContent=msg; t.style.color=bad?'var(--bad)':''; clearTimeout(toast._t); toast._t=setTimeout(function(){ t.textContent=''; t.style.color=''; },4500); }
function copy(text,ok){
  var io=$('io');
  function fallback(){ io.value=text; io.focus(); io.select(); toast(tr('Selected in the box. Press Ctrl/Cmd + C to copy.')); }
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(function(){ toast(ok); },fallback); } else fallback();
}
$('exportBtn').addEventListener('click',function(){
  var obj={tool:'sit-sizing-model',version:1,profile:PROFILE||'Uncalibrated defaults',savedAt:new Date().toISOString(),calibrated:ROWS.length-uncCount()+' of '+ROWS.length,assumptions:A,scope:S};
  var txt=JSON.stringify(obj,null,2); $('io').value=txt; copy(txt,tr('Profile copied and shown in the box. Save it as a .json file.'));
});
function doImport(text){
  try{ var obj=JSON.parse(text); loadProfile(obj); renderFeatures(); renderDetail(); renderFieldTypes(); renderDai(); renderAssumptions(); syncStaticValues(); update(); toast(PROFILE?trf('Profile imported: {p}.',{p:PROFILE}):tr('Profile imported.')); }
  catch(e){ toast(trf('Could not import: {e} Check that you pasted the whole exported profile.',{e:(e instanceof SyntaxError)?tr('The text is not valid JSON.'):(e.message||tr('The text is not valid JSON.'))}),true); }
}
$('importBtn').addEventListener('click',function(){ var t=$('io').value.trim(); if(!t){ toast(tr('Paste a profile into the box first.')); return; } doImport(t); });
$('fileIn').addEventListener('change',function(e){ var f=e.target.files&&e.target.files[0]; if(!f) return; var r=new FileReader(); r.onload=function(){ $('io').value=r.result; doImport(String(r.result)); }; r.readAsText(f); e.target.value=''; });
var armed=null;
function resetLabel(){ var b=$('resetBtn'); b.classList.remove('armed'); b.textContent=tr('Reset to defaults'); }
$('resetBtn').addEventListener('click',function(){
  var b=$('resetBtn');
  if(!armed){ b.classList.add('armed'); b.textContent=tr('Click again to reset everything'); armed=setTimeout(function(){ armed=null; resetLabel(); },3500); return; }
  clearTimeout(armed); armed=null; resetLabel();
  A=clone(DEFAULTS); S=clone(SAMPLE_SCOPE); PROFILE=''; renderFeatures(); renderDetail(); renderFieldTypes(); renderDai(); renderAssumptions(); syncStaticValues(); update(); toast(tr('Reset to uncalibrated defaults and the example scope.'));
});
$('copySummary').addEventListener('click',function(){
  var R=LAST.R, D=LAST.D, u=uncCount(), top=topGap(R,D);
  var lines=[
    tr('SIT sizing (planning range, not a commitment)')+(PROFILE?trf(' · profile: {p}',{p:PROFILE}):''),
    trf('• Rough, no FSD: {lo}–{hi} FTE (mid {m}), ~{c} cases, {h} h',{lo:f1(R.lo),hi:f1(R.hi),m:f1(R.fte),c:fmt(R.cases),h:fmt(R.hours)}),
    trf('• Detailed, with FSD: {lo}–{hi} FTE (mid {m}), ~{c} cases, {h} h',{lo:f1(D.lo),hi:f1(D.hi),m:f1(D.fte),c:fmt(D.cases),h:fmt(D.hours)}),
    trf('• Gap: {s}{n} FTE',{s:D.fte>=R.fte?'+':'−',n:f1(Math.abs(D.fte-R.fte))})+(top?driveText(top,'; {label} drive {p}% of it','; {label} drives {p}% of it'):''),
    trf('• SIT window {w} weeks; team mix {j}/{m}/{s} junior/mid/senior',{w:S.team.weeks,j:S.team.mix.junior,m:S.team.mix.mid,s:S.team.mix.senior}),
    trf('• Environment: {e}; regression automated {a}%; channels: {c}; {l} languages',{e:tr(ENV[D.envI]),a:Math.round(D.auto*100),c:chNames(D.c),l:D.c.languages}),
    trf('• AI-assisted test design: {a} (design time −{p}%)',{a:tr(AI[D.aiI]),p:Math.round(D.aiCut*100)}),
    trf('• Scope includes: {p}',{p:[tr('Application')].concat(D.x.dOn||R.x.dOn?[tr('Data platform')]:[]).concat(D.x.aOn||R.x.aOn?[tr('AI product')]:[]).concat(D.x.ptOn||R.x.ptOn?[tr('Performance testing')]:[]).join(', ')})+($('calNote')&&(D.x.dOn||D.x.aOn||R.x.dOn||R.x.aOn||D.x.ptOn||R.x.ptOn)?' · '+$('calNote').textContent:''),
    trf('• Shift-left evidence: mutation {m}%, rule tests {r}%, BE validation {b}%, FE validation {f}%, mapping tests {p}%, FE unit {u}%, FE mutation {s}%',{r:S.evidence.ruleCov,m:S.evidence.mutation,b:S.evidence.valBE,f:S.evidence.valFE,p:S.evidence.mapCov,u:S.evidence.feUnit,s:S.evidence.feMut}),
    trf('• {u} of {t} assumptions are uncalibrated defaults. Confirm with the delivery owner before committing.',{u:u,t:ROWS.length})];
  copy(lines.join('\n'),tr('QBR summary copied.'));
});
$('copyWording').addEventListener('click',function(){
  var w=$('bizWording'), t=w.textContent, toastEl=$('wordToast');
  function done(m){ toastEl.textContent=m; setTimeout(function(){ toastEl.textContent=''; },3000); }
  function fb(){ var r=document.createRange(); r.selectNodeContents(w); var s=getSelection(); s.removeAllRanges(); s.addRange(r); done(tr('Selected. Press Ctrl/Cmd + C to copy.')); }
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function(){ done(tr('Copied.')); },fb); else fb();
});
$('sMode').addEventListener('change',renderTornado); $('sSwing').addEventListener('change',renderTornado);
$('addFeat').addEventListener('click',function(){ S.features.push({name:tr('New feature'),type:'app',size:'M',cx:1,qty:1}); renderFeatures(); update(); var i=S.features.length-1; $('f-name-'+i).focus(); $('f-name-'+i).select(); });

renderFeatures(); renderDetail(); renderFieldTypes(); renderDai(); renderAssumptions(); bindStatic(); initDsec(); initCollapsible(); update();
onLang(function(){ renderFeatures(); renderDetail(); renderFieldTypes(); renderDai(); renderAssumptions(); renderEnvSelect(); renderAiSelect(); applyTips(); placeholders(); if(!armed) resetLabel(); update(); });

/* ---------- static page translation + EN/VI toggle ---------- */
(function(){
  var EXCL={script:1,style:1,textarea:1,head:1,title:1};
  var PHR={b:1,strong:1,em:1,i:1,a:1,span:1,small:1,sup:1,sub:1,br:1,code:1,abbr:1,u:1,mark:1};
  var SKIP={summary:1,tabUnc:1,asmBody:1,gapCallout:1,tornHint:1,torn:1,scen:1,scenCallout:1,calStatus:1,mixNote:1,envNote:1,'t-hpf':1,'t-blend':1,'eff-mut':1,'eff-be':1,'eff-fe':1,'eff-l4':1,'eff-map':1,'eff-jacoco':1,'eff-feunit':1,'eff-femut':1,'eff-rule':1,rubric:1,ftBox:1,apiFieldsNote:1,guideTrace:1,'eff-ios':1,'eff-android':1,'eff-dq':1,'eff-contract':1,'eff-reuse':1,calNote:1,'eff-evalci':1,'dsb-app':1,'dsb-fields':1,'dsb-rules':1,'dsb-channels':1,'dsb-data':1,'dsb-ai':1,'dsb-derived':1,'dsb-guide':1,'dsb-pt':1,'eff-ptci':1,'eff-apm':1,'eff-ptreuse':1,'dp-scen-t':1,detRoughCmp:1,toast:1,coneRough:1,coneDet:1,coneNote:1,wordToast:1,'t-env':1,'t-ai':1,aiNote:1};
  var DYN_TABLES={featTable:1,detTable:1,lvlTable:1,gapTable:1,derTable:1,dataTable:1,aiTable:1,ptTable:1};
  function norm(s){ return s.replace(/\s+/g,' ').trim(); }
  function skip(c){
    if(SKIP[c.id]) return true;
    if(c.classList && c.classList.contains('lang-switch')) return true;
    if((c.localName==='tbody'||c.localName==='tfoot') && c.parentNode && DYN_TABLES[c.parentNode.id]) return true;
    return false;
  }
  function isUnit(el){
    var all=el.querySelectorAll('*');
    for(var i=0;i<all.length;i++){ if(!PHR[all[i].localName] || all[i].id) return false; }
    return /[A-Za-z]/.test(el.textContent);
  }
  function sig(el){ return Array.prototype.map.call(el.querySelectorAll('*'),function(d){ return d.localName; }).join(','); }
  var units=null, texts=null;
  function walk(el){
    for(var c=el.firstChild;c;c=c.nextSibling){
      if(c.nodeType===3){ if(/[A-Za-z]/.test(c.nodeValue)) texts.push(c); continue; }
      if(c.nodeType!==1 || EXCL[c.localName] || skip(c)) continue;
      if(isUnit(c)){ c.__i18nKey=sig(c)+'\u0001'+norm(c.textContent); units.push(c); continue; }
      walk(c);
    }
  }
  function index(){ units=[]; texts=[]; walk(document.body); texts.forEach(function(n){ n.__i18nKey=norm(n.nodeValue); }); }
  function toVi(){
    if(!units) index();
    units.forEach(function(el){ var vi=DICT.units&&DICT.units[el.__i18nKey]; if(!vi||el.__i18nEn!==undefined) return; el.__i18nEn=el.innerHTML; el.innerHTML=vi; });
    texts.forEach(function(n){ var vi=DICT.texts&&DICT.texts[n.__i18nKey]; if(!vi||n.__i18nEn!==undefined) return; var v=n.nodeValue; n.__i18nEn=v; n.nodeValue=v.match(/^\s*/)[0]+vi+v.match(/\s*$/)[0]; });
  }
  function toEn(){
    if(!units) return;
    units.forEach(function(el){ if(el.__i18nEn!==undefined){ el.innerHTML=el.__i18nEn; el.__i18nEn=undefined; } });
    texts.forEach(function(n){ if(n.__i18nEn!==undefined){ n.nodeValue=n.__i18nEn; n.__i18nEn=undefined; } });
  }
  function setLang(lang){
    if(lang!=='vi') lang='en'; if(lang===LANG) return;
    if(lang==='vi') toVi(); else toEn();
    LANG=lang; document.documentElement.lang=lang; document.title=lang==='vi'?(DICT.title||document.title):'SIT Sizing Model';
    HOOKS.forEach(function(fn){ try{ fn(); }catch(e){} });
    Array.prototype.forEach.call(document.querySelectorAll('.lang-switch button'),function(b){ b.setAttribute('aria-pressed',b.dataset.lang===lang?'true':'false'); });
    try{ localStorage.setItem('sit-lang',lang); }catch(e){}
  }
  Array.prototype.forEach.call(document.querySelectorAll('.lang-switch button'),function(b){ b.addEventListener('click',function(){ setLang(b.dataset.lang); }); });
  try{ if(localStorage.getItem('sit-lang')==='vi') setLang('vi'); }catch(e){}
  window.__sitLang=setLang;
})();
window.__sit={compute:compute,A:function(){ return A; },S:function(){ return S; }};
})();
