import { apiGuard, download } from '@/lib/api';
import { log } from '@/lib/activity';
import { today } from '@/lib/billing';
import { exportCsv, exportJson, exportXlsx } from '@/lib/io';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const deny = await apiGuard();
  if (deny) return deny;
  const format = new URL(req.url).searchParams.get('format');
  const name = `账号簿-${today()}`;
  log('导出数据', format || 'xlsx');
  if (format === 'csv') return download(exportCsv(), `${name}.csv`, 'text/csv; charset=utf-8');
  if (format === 'json') return download(exportJson(), `${name}-备份.json`, 'application/json; charset=utf-8');
  return download(new Uint8Array(await exportXlsx()), `${name}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
