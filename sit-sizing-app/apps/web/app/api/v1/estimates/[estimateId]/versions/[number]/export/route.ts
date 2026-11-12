import { ExportQuery } from '@sit/schemas';
import { api } from '@/server/http/authed';
import { VersionParams } from '@/server/http/params';
import { readQuery } from '@/server/http/parse';
import { exportVersion } from '@/server/services/export';

export const dynamic = 'force-dynamic';

/** Excel workbook, or one table as CSV (X-02). */
export const GET = api<{ estimateId: string; number: string }>(
  async (request, { user, params, requestId }) => {
    const p = VersionParams.parse(params);
    const file = await exportVersion(
      user,
      p.estimateId,
      p.number,
      readQuery(request, ExportQuery),
      {
        requestId,
      },
    );
    return new Response(file.body, {
      headers: {
        'content-type': file.contentType,
        'content-disposition': `attachment; filename="${file.filename}"`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  },
);
