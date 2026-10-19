import { revalidatePath } from 'next/cache';
import { apiGuard } from '@/lib/api';
import { log } from '@/lib/activity';
import { importFile } from '@/lib/io';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const deny = await apiGuard(true);
  if (deny) return deny;
  const fd = await req.formData();
  const file = fd.get('file');
  if (!(file instanceof File)) return Response.json({ error: '请选择文件' }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return Response.json({ error: '文件不能超过 5MB' }, { status: 400 });
  if (!/\.(xlsx|csv)$/i.test(file.name)) return Response.json({ error: '只支持 .xlsx 和 .csv 文件' }, { status: 400 });
  try {
    const result = await importFile(Buffer.from(await file.arrayBuffer()), file.name, fd.get('commit') === '1');
    if (result.imported !== undefined) {
      log('导入数据', file.name, `导入 ${result.imported} 个订阅`);
      revalidatePath('/', 'layout');
    }
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: `无法读取文件：${(e as Error).message}` }, { status: 400 });
  }
}
