import { ReviewNote } from '@sit/schemas';
import { api, ok } from '@/server/http/authed';
import { VersionParams } from '@/server/http/params';
import { readJson } from '@/server/http/parse';
import { reviewVersion } from '@/server/services/review';

export const dynamic = 'force-dynamic';

export const POST = api<{ estimateId: string; number: string }>(
  async (request, { user, params, requestId }) => {
    const p = VersionParams.parse(params);
    return ok(
      await reviewVersion(
        user,
        p.estimateId,
        p.number,
        'submit',
        await readJson(request, ReviewNote),
        {
          requestId,
        },
      ),
    );
  },
);
