import { revalidatePath } from 'next/cache';
import { apiGuard } from '@/lib/api';
import { restoreJson } from '@/lib/io';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const deny = await apiGuard(true);
  if (deny) return deny;
  const fd = await req.formData();
  const file = fd.get('file');
  if (!(file instanceof File)) return Response.json({ error: '请选择备份文件' }, { status: 400 });
  if (file.size > 50 * 1024 * 1024) return Response.json({ error: '文件过大' }, { status: 400 });
  const r = await restoreJson(await file.text());
  if (r.ok) revalidatePath('/', 'layout');
  return Response.json(r, { status: r.ok ? 200 : 400 });
}
