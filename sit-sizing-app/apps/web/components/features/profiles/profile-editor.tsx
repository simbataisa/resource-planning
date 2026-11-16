'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Save } from 'lucide-react';
import { DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS, isDefaultRow } from '@sit/engine';
import type { Assumptions, EstimateInputs, ProfileDetail } from '@sit/schemas';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/patterns/field';
import { PageHeader } from '@/components/patterns/page-header';
import { QueryState } from '@/components/patterns/query-state';
import { Link } from '@/i18n/navigation';
import { formatDateTime } from '@/lib/format';
import { principalFromMe } from '@/lib/me';
import { useMe, useProfile, useProjects, useUpdateProfile } from '@/lib/query/hooks';
import { can } from '@/lib/rbac';
import { AssumptionsTab } from '../estimate-editor/assumptions-tab';
import { EditorProvider, useEditor } from '../estimate-editor/store';
import { useQueryState } from '../shared/use-query-state';
import { NewProfileDialog } from './new-profile-dialog';
import { PROFILE_TONE } from './profile-list';
import { SizeEditor } from './size-editor';

type Calibration = ProfileDetail['calibration'];
const DEFAULTS = DEFAULT_ASSUMPTIONS as Assumptions;

/** One assumption profile (P-01): values, calibration notes, publish, retire and clone. */
export function ProfileEditor({ profileId }: { profileId: string }) {
  const profile = useProfile(profileId);
  const state = useQueryState(profile);
  const me = useMe();
  const principal = me.data ? principalFromMe(me.data) : null;
  const p = profile.data;
  const manage =
    principal && p
      ? p.scope === 'GLOBAL'
        ? can(principal, 'profile.global.manage')
        : can(principal, 'profile.project.manage', p.projectId ?? undefined)
      : false;
  return (
    <QueryState {...state} skeletonRows={6}>
      {profile.data ? (
        // Remount after every server change so the local copy starts from the saved values.
        <EditorProvider
          key={profile.dataUpdatedAt}
          initial={{
            inputs: EXAMPLE_INPUTS as EstimateInputs,
            assumptions: profile.data.values,
            rowVersion: 1,
          }}
          editable={manage && profile.data.status === 'DRAFT'}
        >
          <ProfileBody profile={profile.data} manage={manage} />
        </EditorProvider>
      ) : null}
    </QueryState>
  );
}

function ProfileBody({ profile, manage }: { profile: ProfileDetail; manage: boolean }) {
  const t = useTranslations('profiles');
  const tc = useTranslations('common');
  const locale = useLocale();
  const me = useMe();
  const projects = useProjects();
  const principal = me.data ? principalFromMe(me.data) : null;
  const { state, editable, editAssumptions } = useEditor();
  const { assumptions, dirty } = state;
  const isDraft = profile.status === 'DRAFT';
  const { save, setStatus } = useUpdateProfile(profile.id);
  const [name, setName] = useState(profile.name);
  const [calibration, setCalibration] = useState<Calibration>(profile.calibration);
  const [calDirty, setCalDirty] = useState(false);
  const [confirm, setConfirm] = useState<'publish' | 'retire' | null>(null);
  const projectName = projects.data?.items.find((p) => p.id === profile.projectId)?.name;
  const error = save.error ?? setStatus.error;
  const manageableProjects = principal
    ? (projects.data?.items ?? []).filter((p) => can(principal, 'profile.project.manage', p.id))
    : [];
  const canGlobal = principal ? can(principal, 'profile.global.manage') : false;
  const changed = dirty || calDirty || name.trim() !== profile.name;
  const onSave = () => {
    // Keep notes only for rows that differ from the default and have a source.
    const kept = Object.fromEntries(
      Object.entries(calibration).filter(
        ([path, e]) => e.source.trim() && !isDefaultRow(assumptions, DEFAULTS, path),
      ),
    );
    save.mutate(
      { name: name.trim() || profile.name, values: assumptions, calibration: kept },
      { onSuccess: () => setCalDirty(false) },
    );
  };
  return (
    <div className="grid gap-6">
      <Link
        href="/profiles"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('back')}
      </Link>
      <PageHeader
        title={profile.name}
        description={
          profile.scope === 'GLOBAL'
            ? t('scopes.GLOBAL')
            : t('projectScope', { project: projectName ?? '…' })
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={PROFILE_TONE[profile.status]}>{t(`status.${profile.status}`)}</Badge>
            {editable ? (
              <>
                <Button variant="outline" disabled={!changed || save.isPending} onClick={onSave}>
                  <Save aria-hidden="true" />
                  {save.isPending ? t('saving') : t('save')}
                </Button>
                <Button
                  disabled={changed || setStatus.isPending}
                  title={changed ? t('saveFirst') : undefined}
                  onClick={() => setConfirm('publish')}
                >
                  {t('publish')}
                </Button>
              </>
            ) : null}
            {manage && profile.status === 'PUBLISHED' ? (
              <Button variant="outline" onClick={() => setConfirm('retire')}>
                {t('retire')}
              </Button>
            ) : null}
            {canGlobal || manageableProjects.length ? (
              <NewProfileDialog
                canGlobal={canGlobal}
                projects={manageableProjects}
                clone={{ id: profile.id, name: profile.name, projectId: profile.projectId }}
              />
            ) : null}
          </div>
        }
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      <Alert>
        <AlertDescription>
          {isDraft
            ? t('draftNotice')
            : t('readOnlyNotice', {
                when: profile.publishedAt ? formatDateTime(profile.publishedAt, locale) : '—',
              })}
        </AlertDescription>
      </Alert>
      {editable ? (
        <div className="max-w-md">
          <Field label={t('name')}>
            {(c) => (
              <Input
                {...c}
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
        </div>
      ) : null}
      <section className="grid gap-4 rounded-lg border bg-card p-5 shadow-card">
        <h2 className="text-[1.6rem] font-light">{t('valuesTitle')}</h2>
        <SizeEditor
          values={assumptions}
          calibration={calibration}
          editable={editable}
          onChange={(next) => {
            // Sizes move their notes with them (ADR-0021).
            editAssumptions((d) => void Object.assign(d, next.values));
            setCalibration(next.calibration as Calibration);
            setCalDirty(true);
          }}
        />
        <AssumptionsTab
          notes={calibration}
          // The source column only takes space when it can hold something.
          calibrationCell={
            editable || Object.keys(calibration).length
              ? (path, label, isDefault) =>
                  isDefault ? null : (
                    <CalibrationInputs
                      label={label}
                      value={calibration[path]}
                      disabled={!editable}
                      onChange={(entry) => {
                        setCalDirty(true);
                        setCalibration((c) => ({ ...c, [path]: entry }));
                      }}
                    />
                  )
              : undefined
          }
        />
      </section>
      {confirm ? (
        <Dialog open onOpenChange={(o) => !o && setConfirm(null)}>
          <DialogContent closeLabel={tc('close')}>
            <DialogHeader>
              <DialogTitle>{t(`${confirm}Title`)}</DialogTitle>
              <DialogDescription>{t(`${confirm}Body`)}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirm(null)}>
                {tc('cancel')}
              </Button>
              <Button
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate(confirm, { onSettled: () => setConfirm(null) })}
              >
                {t(confirm)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function CalibrationInputs({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: Calibration[string] | undefined;
  disabled: boolean;
  onChange: (v: Calibration[string]) => void;
}) {
  const t = useTranslations('profiles');
  const v = value ?? { source: '' };
  return (
    <div className="grid gap-1.5">
      <Input
        aria-label={t('sourceFor', { label })}
        placeholder={t('sourcePlaceholder')}
        value={v.source}
        maxLength={200}
        disabled={disabled}
        onChange={(e) => onChange({ ...v, source: e.target.value })}
      />
      <Input
        type="date"
        aria-label={t('measuredFor', { label })}
        value={v.measuredAt ?? ''}
        disabled={disabled}
        onChange={(e) => onChange({ ...v, measuredAt: e.target.value || undefined })}
      />
    </div>
  );
}
