import Link from 'next/link';
import { listEmails, listSubs } from '@/lib/queries';
import { securityRisks, type RiskLevel } from '@/lib/security';
import { brandColor, Icon, Logo } from '@/components/icons';
import { Tag } from '@/components/ui/Tag';
import { maskPhone } from '@/lib/constants';
import type { Email } from '@/lib/db/schema';

const LV: Record<RiskLevel, [string, string]> = { high: ['高风险', 'red'], mid: ['中风险', 'orange'], low: ['建议', 'blue'] };

/** 找回关系图：邮箱之间的辅助邮箱箭头 + 绑定的手机号 */
function RecoveryGraph({ emails }: { emails: Email[] }) {
  const W = 900, H = 270, EY = 110, PY = 236;
  const n = emails.length;
  const ex = (i: number) => (n === 1 ? W / 2 : 120 + (i * (W - 240)) / (n - 1));
  const avg = (ph: string) => {
    const ix = emails.map((e, i) => (e.phone === ph ? i : -1)).filter((i) => i >= 0);
    return ix.reduce((a, b) => a + b, 0) / ix.length;
  };
  const phones = [...new Set(emails.map((e) => e.phone).filter(Boolean))].sort((a, b) => avg(a) - avg(b));
  const px = (i: number) => (phones.length === 1 ? W / 2 : 200 + (i * (W - 400)) / (phones.length - 1));
  const arcs: { i: number; j: number; mutual: boolean }[] = [];
  const seen = new Set<string>();
  emails.forEach((a, i) => {
    const j = emails.findIndex((x) => x.address === a.recovery);
    if (j < 0 || seen.has(`${i}:${j}`)) return;
    const mutual = emails[j].recovery === a.address;
    seen.add(`${j}:${i}`);
    arcs.push({ i, j, mutual });
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="邮箱与手机号的找回关系图">
      <defs>
        {(['b', 'r'] as const).map((k) => (
          <marker key={k} id={`ar-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" style={{ fill: k === 'b' ? 'var(--primary)' : 'var(--red)' }} />
          </marker>
        ))}
      </defs>
      {emails.map((e, i) => e.phone && <line key={`l${e.id}`} x1={ex(i)} y1={EY + 24} x2={px(phones.indexOf(e.phone))} y2={PY - 16} style={{ stroke: 'var(--text-4)' }} strokeWidth={1.5} />)}
      {arcs.map(({ i, j, mutual }) => {
        const x1 = ex(i), x2 = ex(j), lift = 40 + Math.abs(x2 - x1) * 0.12;
        return (
          <path key={`a${i}-${j}`} d={`M${x1} ${EY - 24} Q${(x1 + x2) / 2} ${EY - 24 - lift} ${x2} ${EY - 24}`} fill="none" style={{ stroke: mutual ? 'var(--red)' : 'var(--primary)' }} strokeWidth={1.8}
            markerEnd={`url(#ar-${mutual ? 'r' : 'b'})`} markerStart={mutual ? 'url(#ar-r)' : undefined} />
        );
      })}
      {emails.map((e, i) => {
        const x = ex(i), warn = !e.recovery;
        return (
          <g key={e.id} data-tip={`${e.address}｜辅助邮箱：${e.recovery || '未设置'}｜手机：${e.phone ? maskPhone(e.phone) : '未填写'}`}>
            <rect x={x - 78} y={EY - 24} width={156} height={48} rx={10} style={{ fill: 'var(--panel)', stroke: warn ? 'var(--orange)' : 'var(--border)' }} strokeWidth={1.5} strokeDasharray={warn ? '5 4' : undefined} />
            <circle cx={x - 54} cy={EY} r={12} style={{ fill: brandColor(e.provider) }} />
            <text x={x - 54} y={EY + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#fff">{e.provider[0]}</text>
            <text x={x - 35} y={EY - 2} fontSize={13} fontWeight={600} style={{ fill: 'var(--text)' }}>{e.address.split('@')[0].slice(0, 13)}</text>
            <text x={x - 35} y={EY + 14} fontSize={11.5} style={{ fill: 'var(--text-3)' }}>{e.provider}{warn ? ' · 无辅助' : ''}</text>
          </g>
        );
      })}
      {phones.map((p, i) => {
        const x = px(i), cnt = emails.filter((e) => e.phone === p).length;
        return (
          <g key={p} data-tip={`${maskPhone(p)}｜绑定 ${cnt} 个邮箱`}>
            <rect x={x - 80} y={PY - 16} width={160} height={32} rx={16} style={{ fill: 'var(--fill)', stroke: cnt > 1 ? 'var(--orange)' : 'var(--border)' }} strokeWidth={1.2} />
            <text x={x} y={PY + 4} textAnchor="middle" fontSize={12.5} style={{ fill: 'var(--text-2)' }}>{maskPhone(p)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default async function SecurityPage() {
  const emails = listEmails();
  const subs = listSubs();
  const risks = securityRisks(emails, subs);
  const cnt = (k: RiskLevel) => risks.filter((r) => r.level === k).length;
  if (!emails.length) return <section className="card"><div className="empty">添加邮箱后，这里会自动检查找回方式、手机号和两步验证等风险。</div></section>;
  return (
    <>
      <section className="card sec-sum">
        <span className="shield-big" style={risks.length ? undefined : { background: 'var(--green-soft)', color: 'var(--green)' }}><Icon name="shield" /></span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{risks.length ? `发现 ${risks.length} 个需要关注的问题` : '没有发现风险'}</div>
          <div className="t3">根据邮箱、手机号、登录方式和支付方式自动检查</div>
        </div>
        <div className="sum-n"><b className="num" style={{ color: 'var(--red)' }}>{cnt('high')}</b><span>高风险</span></div>
        <div className="sum-n"><b className="num" style={{ color: 'var(--orange)' }}>{cnt('mid')}</b><span>中风险</span></div>
        <div className="sum-n"><b className="num" style={{ color: 'var(--primary)' }}>{cnt('low')}</b><span>建议</span></div>
      </section>
      <section className="card">
        <div className="card-h"><h2>找回关系图</h2><span className="ex">箭头指向辅助邮箱，悬停节点查看详情</span></div>
        <div className="card-b graph">
          <RecoveryGraph emails={emails} />
          <div className="legend-s" style={{ flexWrap: 'wrap', marginTop: 8 }}>
            <span><i style={{ background: 'var(--primary)' }} />辅助邮箱</span><span><i style={{ background: 'var(--red)' }} />互为辅助</span><span><i style={{ background: 'var(--text-4)' }} />绑定手机</span><span><i style={{ background: 'var(--orange)' }} />需要处理</span>
          </div>
        </div>
      </section>
      {risks.length > 0 && (
        <section className="card">
          <div className="card-h"><h2>检查结果</h2></div>
          <div className="card-b">
            {risks.map((r, i) => (
              <div className="risk" key={i}>
                <span className="risk-ic" style={{ background: `var(--${LV[r.level][1]}-soft)`, color: `var(--${LV[r.level][1]})` }}><Icon name={r.level === 'low' ? 'shield' : 'warn'} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="nm" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontWeight: 500 }}>{r.title} <Tag tone={LV[r.level][1]}>{LV[r.level][0]}</Tag></div>
                  <div className="t2" style={{ fontSize: 13, marginTop: 2 }}>{r.detail}</div>
                </div>
                {r.href ? <Link className="btn btn-sm" href={r.href}>去处理</Link> : <span />}
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="card">
        <div className="card-h"><h2>邮箱影响面</h2><span className="ex">某个邮箱丢失时，会影响哪些服务</span></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>邮箱</th><th className="r">注册的服务</th><th className="r">一键登录依赖</th><th className="r">未开两步验证</th><th>辅助邮箱</th><th>绑定手机</th></tr></thead>
            <tbody>
              {emails.map((e) => {
                const mine = subs.filter((s) => s.emailId === e.id);
                const sso = mine.filter((s) => s.login === 'google' || s.login === 'apple').length;
                const nm = mine.filter((s) => s.mfa === 'none').length;
                return (
                  <tr key={e.id}>
                    <td><Link href={`/subscriptions?email=${e.id}`} className="svc lnk"><Logo name={e.provider} />{e.address}</Link></td>
                    <td className="r num">{mine.length}</td>
                    <td className="r num">{sso}</td>
                    <td className="r num">{nm ? <Tag tone="orange">{nm} 个</Tag> : 0}</td>
                    <td>{e.recovery || <Tag tone="red">未设置</Tag>}</td>
                    <td className="num t2">{e.phone ? maskPhone(e.phone) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
