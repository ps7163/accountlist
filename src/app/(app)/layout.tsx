import { requireAuth } from '@/lib/auth';
import { formatYuan } from '@/lib/billing';
import { listEmails, listPayMethods, listSubs, syncRenewals } from '@/lib/queries';
import { securityRisks } from '@/lib/security';
import { dailyBackup } from '@/lib/io';
import { getPrefs } from '@/lib/settings';
import { listNotes } from '@/lib/queries';
import { AppProvider } from '@/components/app/AppProvider';
import { Shell, type BellItem } from '@/components/app/Shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  syncRenewals();
  await dailyBackup().catch((e) => console.error('自动备份失败', e));
  const prefs = getPrefs();
  const subs = listSubs();
  const emails = listEmails();
  const payMethods = listPayMethods();
  const bell: BellItem[] = subs
    .filter((s) => s.state.alert)
    .sort((a, b) => (a.state.days ?? 0) - (b.state.days ?? 0))
    .map((s) => ({ id: s.id, name: s.name, plan: s.plan, date: s.trialEnd ?? s.nextDate ?? '', price: formatYuan(s.priceCents), label: s.state.label, tone: s.state.tone }));
  const riskCount = securityRisks().filter((r) => r.level !== 'low').length;

  return (
    <AppProvider
      data={{
        emails: emails.map((e) => ({ id: e.id, address: e.address, provider: e.provider })),
        payMethods: payMethods.map((p) => ({ id: p.id, name: p.name, type: p.type })),
        subOptions: subs.map((s) => ({ id: s.id, name: s.name, plan: s.plan, emailAddress: s.emailAddress })),
        remindDays: prefs.remindDays,
        monthlyCents: subs.reduce((a, s) => a + s.monthlyCents, 0),
        budgetCents: prefs.budgetCents,
      }}
    >
      <Shell
        skin={prefs.skin}
        displayName={prefs.displayName}
        bell={bell}
        riskCount={riskCount}
        search={{
          subs: subs.map((s) => ({ id: s.id, name: s.name, plan: s.plan, email: s.emailAddress, category: s.category, price: s.kind === 'free' ? '免费' : formatYuan(s.priceCents) })),
          emails: emails.map((e) => ({ id: e.id, address: e.address, provider: e.provider, note: e.note })),
          pays: payMethods.map((p) => ({ id: p.id, name: p.name, type: p.type })),
          notes: listNotes().map((n) => ({ id: n.id, title: n.title, body: n.body.slice(0, 200) })),
        }}
      >
        {children}
      </Shell>
    </AppProvider>
  );
}
