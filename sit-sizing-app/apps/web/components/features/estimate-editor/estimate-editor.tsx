'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FilePlus2, RotateCcw } from 'lucide-react';
import type { EstimateDetail, Version } from '@sit/schemas';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/patterns/page-header';
import { QueryState } from '@/components/patterns/query-state';
import { Link } from '@/i18n/navigation';
import { lockTokenFor, rememberLockToken } from '@/lib/lock-tokens';
import { principalFromMe } from '@/lib/me';
import { qk } from '@/lib/query/keys';
import {
  useCreateDraft,
  useEstimate,
  useLockDraft,
  useMe,
  useProject,
  useVersion,
} from '@/lib/query/hooks';
import { can } from '@/lib/rbac';
import { ResultsPanels } from '../results/results-panels';
import { VersionHistory } from '../versions/version-history';
import { useQueryState } from '../shared/use-query-state';
import { ApplyProfile } from './apply-profile';
import { AssumptionsTab } from './assumptions-tab';
import { DetailScopeTab } from './detail-scope-tab';
import { DraftToolbar, lockConflict } from './draft-toolbar';
import { EvidenceTab } from './evidence-tab';
import { ExportPanel, prototypeProfileJson } from './export-panel';
import { RoughScopeTab } from './rough-scope-tab';
import { EngineNotice } from './engine-notice';
import { EditorProvider, useEditor } from './store';
import { SummaryCards } from './summary-cards';
import { TeamTab } from './team-tab';

/** The estimate editor page (design 7, U-05 to U-09): loads the estimate, then its open version. */
export function EstimateEditor({ estimateId }: { estimateId: string }) {
  const estimate = useEstimate(estimateId);
  const state = useQueryState(estimate);
  const current = estimate.data
    ? (estimate.data.versions.find((v) => v.status === 'DRAFT') ?? estimate.data.versions[0])
    : undefined;
  return (
    <QueryState {...state} skeletonRows={6}>
      {estimate.data && current ? (
        <VersionLoader estimate={estimate.data} number={current.number} />
      ) : null}
    </QueryState>
  );
}

function VersionLoader({ estimate, number }: { estimate: EstimateDetail; number: number }) {
  const version = useVersion(estimate.id, number);
  const state = useQueryState(version);
  return (
    <QueryState {...state} skeletonRows={6}>
      {version.data ? <DraftSession estimate={estimate} version={version.data} /> : null}
    </QueryState>
  );
}

/**
 * Who may edit right now (design 8.3, U-09): the user needs the role and the draft's edit lock.
 * - 'mine': this user holds the lock, so inputs are editable and autosave runs.
 * - 'other': someone else holds it; read-only, a QE Lead can take it over.
 * - 'elsewhere': this user's lock is held by another tab or the assistant (lock token); read-only
 *   with "Open here instead".
 * - 'lost': a save hit a 409; the user's unsaved values stay on the page for download.
 * - 'lostElsewhere': a save or heartbeat found the draft open elsewhere; unsaved values stay on
 *   the page and "Open here instead" carries on with them.
 */
type LockState = 'none' | 'mine' | 'other' | 'elsewhere' | 'lost' | 'lostElsewhere';

function DraftSession({ estimate, version }: { estimate: EstimateDetail; version: Version }) {
  const me = useMe();
  const principal = me.data ? principalFromMe(me.data) : null;
  const pid = estimate.projectId;
  const mayEdit = principal ? can(principal, 'draft.edit', pid) : false;
  const isDraft = version.status === 'DRAFT';
  const lock = useLockDraft(estimate.id);
  const qc = useQueryClient();
  const [lockState, setLockState] = useState<LockState>('none');
  const [session, setSession] = useState(0);
  const asked = useRef(false);

  /**
   * Takes, renews or takes over the lock with this tab's token (memory only). With `keep`, the
   * values on screen stay (recovery's "Open here instead"); otherwise editing restarts from the
   * server's copy.
   */
  const acquire = (takeover: boolean, keep?: (v: Version) => void) => {
    lock.mutate(
      { takeover, lockToken: lockTokenFor(estimate.id) },
      {
        onSuccess: (v) => {
          rememberLockToken(estimate.id, v.lockToken);
          qc.setQueryData(qk.version(estimate.id, v.number), v);
          if (keep) keep(v);
          // Start editing from the server's copy: after a takeover or an expired lock it may be
          // newer than what this page loaded. Inputs were read-only until now, so nothing is lost.
          else setSession((n) => n + 1);
          setLockState('mine');
        },
        onError: (e) => {
          const reason = lockConflict(e);
          if (keep) setLockState('lost');
          else setLockState(reason === 'elsewhere' ? 'elsewhere' : reason ? 'other' : 'none');
          void qc.invalidateQueries({ queryKey: qk.version(estimate.id, version.number) });
        },
      },
    );
  };

  // Someone else holds an unexpired lock: read-only until they finish (or a QE Lead takes over).
  const heldByOther = Boolean(
    version.lock && !version.lock.mine && new Date(version.lock.expiresAt) > new Date(),
  );
  // Take (or renew) the lock once per editing session: on opening a draft and after a reload.
  useEffect(() => {
    if (!isDraft || !mayEdit || asked.current || heldByOther) return;
    asked.current = true;
    acquire(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `asked` guards repeat runs
  }, [isDraft, mayEdit, heldByOther, session]);
  const effective: LockState = lockState === 'none' && heldByOther ? 'other' : lockState;

  const reload = async () => {
    await qc.invalidateQueries({ queryKey: qk.estimate(estimate.id) });
    await qc.invalidateQueries({ queryKey: qk.version(estimate.id, version.number) });
    asked.current = false;
    setLockState('none');
    setSession((s) => s + 1);
  };

  return (
    <EditorProvider
      key={`${version.id}:${session}`}
      initial={{
        inputs: version.inputs,
        assumptions: version.assumptions,
        rowVersion: version.rowVersion,
      }}
      editable={isDraft && mayEdit && effective === 'mine'}
    >
      <EditorLayout
        estimate={estimate}
        version={version}
        notice={
          <>
            <SessionNotice
              estimate={estimate}
              version={version}
              mayEdit={mayEdit}
              lockState={effective}
              canCreateDraft={principal ? can(principal, 'draft.create', pid) : false}
              canTakeover={principal ? can(principal, 'draft.lock.takeover', pid) : false}
              onTakeover={() => acquire(true)}
              onOpenHere={(keep) => acquire(true, keep)}
              onReload={() => void reload()}
            />
            <EngineNotice
              estimate={estimate}
              version={version}
              canCreateDraft={principal ? can(principal, 'draft.create', pid) : false}
            />
          </>
        }
        toolbar={
          effective === 'mine' ? (
            <DraftToolbar
              estimateId={estimate.id}
              versionNumber={version.number}
              onLost={(reason) => setLockState(reason === 'elsewhere' ? 'lostElsewhere' : 'lost')}
            />
          ) : null
        }
      />
    </EditorProvider>
  );
}

function SessionNotice({
  estimate,
  version,
  mayEdit,
  lockState,
  canCreateDraft,
  canTakeover,
  onTakeover,
  onOpenHere,
  onReload,
}: {
  estimate: EstimateDetail;
  version: Version;
  mayEdit: boolean;
  lockState: LockState;
  canCreateDraft: boolean;
  canTakeover: boolean;
  onTakeover: () => void;
  /** Takes this user's lock back from another tab or the assistant, keeping the values shown. */
  onOpenHere: (keep?: (v: Version) => void) => void;
  onReload: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const createDraft = useCreateDraft(estimate.id);
  const { state, uncalibrated, dispatch } = useEditor();

  const downloadUnsaved = () => {
    const text = prototypeProfileJson(
      estimate.name,
      state.inputs,
      state.assumptions,
      uncalibrated,
      new Date(),
    );
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sit-sizing-unsaved-v${version.number}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const downloadButton = (
    <Button size="sm" variant="outline" onClick={downloadUnsaved}>
      {t('draft.downloadUnsaved')}
    </Button>
  );

  if (version.status !== 'DRAFT') {
    return (
      <Alert>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{t('draft.savedVersion', { n: version.number })}</span>
          {canCreateDraft && !estimate.archived ? (
            <Button size="sm" onClick={() => createDraft.mutate()} disabled={createDraft.isPending}>
              <FilePlus2 aria-hidden="true" />
              {createDraft.isPending ? t('draft.creatingDraft') : t('draft.newDraft')}
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }
  if (!mayEdit) {
    return (
      <Alert>
        <AlertDescription>{t('editor.page.readOnly')}</AlertDescription>
      </Alert>
    );
  }
  if (lockState === 'other' && version.lock) {
    const time = new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
      timeStyle: 'short',
    }).format(new Date(version.lock.expiresAt));
    return (
      <Alert>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{t('draft.lockedBy', { name: version.lock.holder.displayName, time })}</span>
          {canTakeover ? (
            <Button size="sm" variant="outline" onClick={onTakeover}>
              {t('draft.takeOver')}
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }
  if (lockState === 'elsewhere') {
    return (
      <Alert>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{t('draft.openElsewhere')}</span>
          <Button size="sm" variant="outline" onClick={() => onOpenHere()}>
            {t('draft.openHere')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (lockState === 'lostElsewhere') {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('draft.lockLostTitle')}</AlertTitle>
        <AlertDescription>
          <p>{t('draft.openElsewhereLost')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                onOpenHere((v) => dispatch({ type: 'relocked', rowVersion: v.rowVersion }))
              }
            >
              {t('draft.openHere')}
            </Button>
            {downloadButton}
          </div>
        </AlertDescription>
      </Alert>
    );
  }
  if (lockState === 'lost') {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('draft.lockLostTitle')}</AlertTitle>
        <AlertDescription>
          <p>{t('draft.lockLostBody')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {downloadButton}
            <Button size="sm" onClick={onReload}>
              <RotateCcw aria-hidden="true" />
              {t('draft.reload')}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}

function EditorLayout({
  estimate,
  version,
  notice,
  toolbar,
}: {
  estimate: EstimateDetail;
  version: Version;
  notice: ReactNode;
  toolbar: ReactNode;
}) {
  const t = useTranslations();
  const { uncalibrated } = useEditor();
  const project = useProject(estimate.projectId);
  return (
    <div className="grid gap-6">
      <Link
        href={`/projects/${estimate.projectId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('editor.page.back', { project: project.data?.name ?? '…' })}
      </Link>
      <PageHeader
        title={estimate.name}
        description={t('editor.page.version', {
          number: version.number,
          status: t(`status.${version.status}`),
        })}
        actions={toolbar}
      />
      {notice}
      <SummaryCards />
      <section aria-label={t('editor.inputs')} className="rounded-lg border bg-card shadow-card">
        <Tabs defaultValue="rough" className="gap-0">
          <TabsList className="px-3.5 pt-3.5">
            <TabsTrigger value="rough" data-tour="tab-rough">
              <Dot className="bg-rough" />
              {t('editor.tabs.rough')}
            </TabsTrigger>
            <TabsTrigger value="detail">
              <Dot className="bg-detailed" />
              {t('editor.tabs.detail')}
            </TabsTrigger>
            <TabsTrigger value="team" data-tour="tab-team">
              {t('editor.tabs.team')}
            </TabsTrigger>
            <TabsTrigger value="evidence">{t('editor.tabs.evidence')}</TabsTrigger>
            <TabsTrigger value="assumptions">
              {t('editor.tabs.assumptions')}
              <Badge variant="unc" className="ml-1.5">
                {t('editor.tabs.uncalibrated', { n: uncalibrated })}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <Panel value="rough">
            <RoughScopeTab />
          </Panel>
          <Panel value="detail">
            <DetailScopeTab />
          </Panel>
          <Panel value="team">
            <TeamTab />
          </Panel>
          <Panel value="evidence">
            <EvidenceTab />
          </Panel>
          <Panel value="assumptions">
            <AssumptionsTab
              header={
                <ApplyProfile
                  estimateId={estimate.id}
                  projectId={estimate.projectId}
                  profileId={version.profileId}
                />
              }
            />
          </Panel>
        </Tabs>
      </section>
      <ResultsPanels />
      <VersionHistory estimate={estimate} open={version} />
      <ExportPanel
        estimateId={estimate.id}
        estimateName={estimate.name}
        versionNumber={version.number}
      />
    </div>
  );
}

const Dot = ({ className }: { className: string }) => (
  <span aria-hidden="true" className={`inline-block size-2 rounded-[2px] ${className}`} />
);

const Panel = ({ value, children }: { value: string; children: ReactNode }) => (
  <TabsContent value={value} className="px-5 pt-4 pb-5">
    {children}
  </TabsContent>
);
