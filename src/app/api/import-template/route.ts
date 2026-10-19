import { apiGuard, download } from '@/lib/api';
import { templateXlsx } from '@/lib/io';

export const dynamic = 'force-dynamic';

export async function GET() {
  const deny = await apiGuard();
  if (deny) return deny;
  return download(new Uint8Array(await templateXlsx()), '账号簿导入模板.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
