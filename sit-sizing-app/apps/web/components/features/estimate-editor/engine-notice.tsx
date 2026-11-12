'use client';

import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import { ENGINE_VERSION } from '@sit/engine';
import type { EstimateDetail, Version } from '@sit/schemas';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { useCreateDraft } from '@/lib/query/hooks';

/**
 * Engine change policy (design 6.6; release 3 E-08): a saved version keeps the result its
 * engine computed. When that engine is older than this app's, say so and offer to recompute
 * as a new draft, then show what the engine change did in the comparison. The saved
 * version never changes.
 */
export function EngineNotice({
  estimate,
  version,
  canCreateDraft,
}: {
  estimate: EstimateDetail;
  version: Version;
  canCreateDraft: boolean;
}) {
  const t = useTranslations('engine');
  const router = useRouter();
  const createDraft = useCreateDraft(estimate.id);
  if (version.status === 'DRAFT' || version.engineVersion === ENGINE_VERSION) return null;
  const hasDraft = estimate.versions.some((v) => v.status === 'DRAFT');
  return (
    <Alert>
      <AlertTitle>{t('title', { old: version.engineVersion })}</AlertTitle>
      <AlertDescription className="grid gap-2">
        <p>{t('body', { old: version.engineVersion, current: ENGINE_VERSION })}</p>
        {canCreateDraft && !estimate.archived ? (
          hasDraft ? (
            <p className="text-sm text-muted-foreground">{t('draftExists')}</p>
          ) : (
            <div>
              <Button
                size="sm"
                disabled={createDraft.isPending}
                onClick={() =>
                  createDraft.mutate(version.number, {
                    onSuccess: (v) =>
                      router.push(
                        `/estimates/${estimate.id}/compare?a=${version.number}&b=${v.number}`,
                      ),
                  })
                }
              >
                <RefreshCw aria-hidden="true" />
                {createDraft.isPending ? t('recomputing') : t('recompute')}
              </Button>
            </div>
          )
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/** True when a version was computed by an older (or different) engine than this app's. */
export const staleEngine = (engineVersion: string) => engineVersion !== ENGINE_VERSION;
