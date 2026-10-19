/* 图标与品牌色。图标路径为 24×24 描边图形 */
const PATHS = {
  note: '<path d="M5 4.5h14v10l-5 5H5z"/><path d="M14 19.5v-5h5M8.5 9h7M8.5 12.5h4"/>',
  pin: '<path d="M9 4h6l-1 5 3 3H7l3-3z"/><path d="M12 12v8"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/>',
  shield: '<path d="M12 3.5 19 6v5.5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  ext: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  wallet: '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 9.5h17M15.5 14h2"/>',
  trend: '<path d="M4 19h16"/><path d="m5 15 4.5-4.5 3.5 3 6-6"/><path d="M15 7.5h4v4"/>',
  layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/>',
  skin: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 1.9-1 1.4-2.1-.6-1.3.3-2.4 1.7-2.4H17a3.5 3.5 0 0 0 3.5-3.5c0-5-3.8-9-8.5-9z"/><circle cx="7.8" cy="11" r="1.1"/><circle cx="10.5" cy="7.6" r="1.1"/><circle cx="14.8" cy="7.8" r="1.1"/>',
  home: '<path d="M4 10.5 12 4l8 6.5V20H15v-6H9v6H4z"/>',
  list: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  bill: '<path d="M6 3.5h12V20l-3-1.8-3 1.8-3-1.8L6 20z"/><path d="M9.5 8h5M9.5 12h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  warn: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.2v.3"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  left: '<path d="m14.5 6-6 6 6 6"/>',
  right: '<path d="m9.5 6 6 6-6 6"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  up: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"/>',
  down: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"/>',
  file: '<path d="M6 3.5h8l4 4V20.5H6z"/><path d="M14 3.5v4h4M9 13l2 2 4-4"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className = 'i' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: PATHS[name] }} />
  );
}

const BRAND: Record<string, string> = { Claude:'#C96442', ChatGPT:'#10A37F', Perplexity:'#1F7F8A', Midjourney:'#3B3C42', 'iCloud+':'#2F84E8', Cursor:'#2B2D33', 'GitHub Copilot':'#33393F', 'YouTube Premium':'#E0251B', Spotify:'#1AA34A', '1Password':'#1366D6', '网易云音乐':'#C7242C', '爱奇艺':'#0BA33B', 'Affinity Photo 2':'#7351C9', Notion:'#3D3B36', Figma:'#E4572E', Duolingo:'#4FA802', Gmail:'#D93F33', Outlook:'#0F6CBD', iCloud:'#2F84E8', 'QQ 邮箱':'#1A9FE0' };

export function brandColor(name: string): string {
  if (BRAND[name]) return BRAND[name];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 45%)`;
}

export function Logo({ name, size = '' }: { name: string; size?: '' | 'xs' | 'md' | 'lg' }) {
  return (
    <span className={`blogo ${size}`} style={{ background: brandColor(name) }} aria-hidden="true">
      {[...name.trim()][0]?.toUpperCase() ?? '?'}
    </span>
  );
}
