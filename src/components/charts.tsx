import { formatYuan } from '@/lib/billing';

export interface MonthTotal {
  y: number;
  m: number;
  paid: number;
  due: number;
}

/** 近 12 个月支出柱状图；本月待扣部分以浅色叠加 */
export function TrendChart({ data }: { data: MonthTotal[] }) {
  const W = 640, H = 220, L = 48, R = 8, T = 12, B = 28;
  const max = Math.max(1, ...data.map((d) => (d.paid + d.due) / 100));
  const step = [10, 20, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000].find((s) => max / s <= 4) ?? 100000;
  const top = Math.ceil(max / step) * step;
  const y = (cents: number) => T + (H - T - B) * (1 - cents / 100 / top);
  const band = (W - L - R) / data.length, bw = Math.min(26, band * 0.5);
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  const bar = (key: string, x: number, y0: number, y1: number, fill: string, round: boolean) => {
    const h = y0 - y1;
    if (h <= 0) return null;
    if (!round || h <= 4) return <rect key={key} x={x} y={y1} width={bw} height={h} fill={fill} />;
    return (
      <g key={key}>
        <rect x={x} y={y1} width={bw} height={h} rx={4} fill={fill} />
        <rect x={x} y={y0 - 4} width={bw} height={4} fill={fill} />
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="近 12 个月支出柱状图">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v * 100)} y2={y(v * 100)} stroke="var(--divider)" strokeDasharray={v ? '3 4' : undefined} />
          <text x={L - 8} y={y(v * 100) + 4} textAnchor="end" fontSize={11} fill="var(--text-3)">{v >= 1000 ? `${v / 1000}k` : v}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = L + band * i + (band - bw) / 2;
        const cur = i === data.length - 1;
        const yp = y(d.paid), yd = y(d.paid + d.due);
        return (
          <g key={`${d.y}-${d.m}`}>
            {bar('p', x, y(0), yp, 'var(--c1)', !d.due)}
            {d.due > 0 && bar('d', x, yp - (d.paid ? 2 : 0), yd, 'var(--c1-soft)', true)}
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={11} fill={cur ? 'var(--text)' : 'var(--text-3)'} fontWeight={cur ? 600 : undefined}>{d.m}月</text>
            <rect x={L + band * i} y={T} width={band} height={H - T - B} fill="transparent" data-tip={`${d.y}年${d.m}月｜已支出 ${formatYuan(d.paid)}${d.due ? `｜待扣费 ${formatYuan(d.due)}` : ''}`} />
          </g>
        );
      })}
    </svg>
  );
}

/** 月支出构成环形图；分段间留 2px 间隙 */
export function Donut({ cats, total }: { cats: [string, number][]; total: number }) {
  const r = 58, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg viewBox="0 0 160 160" width={150} height={150} role="img" aria-label="月支出构成环形图">
      <circle r={r} cx={80} cy={80} fill="none" stroke="var(--fill)" strokeWidth={18} />
      {total > 0 && cats.map(([n, v], i) => {
        const len = (v / total) * c;
        const el = (
          <circle key={n} r={r} cx={80} cy={80} fill="none" stroke={`var(--c${Math.min(i + 1, 6)})`} strokeWidth={18}
            strokeDasharray={`${Math.max(len - 2, 0.5)} ${c}`} strokeDashoffset={-off} transform="rotate(-90 80 80)"
            data-tip={`${n}｜${formatYuan(v, 0)}/月｜${((v / total) * 100).toFixed(0)}%`} />
        );
        off += len;
        return el;
      })}
      <text x={80} y={76} textAnchor="middle" fontSize={11} fill="var(--text-3)">每月合计</text>
      <text x={80} y={96} textAnchor="middle" fontSize={18} fontWeight={600} fill="var(--text)">{formatYuan(total, 0)}</text>
    </svg>
  );
}
