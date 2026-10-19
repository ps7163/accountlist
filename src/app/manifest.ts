import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '账号簿',
    short_name: '账号簿',
    description: '管理邮箱、订阅和到期提醒',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F2F3F5',
    theme_color: '#3370FF',
    lang: 'zh-CN',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: '新建订阅', url: '/subscriptions?new=1' },
      { name: '订阅体检', url: '/review' },
    ],
  };
}
