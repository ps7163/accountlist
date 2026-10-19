import type { SubState } from '@/lib/billing';

export function Tag({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`tag tg-${tone}`}>{children}</span>;
}

export function StateTag({ state }: { state: SubState }) {
  return <Tag tone={state.tone}>{state.label}</Tag>;
}
