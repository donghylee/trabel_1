import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 휴대폰 홈 화면에 앱처럼 설치 (PWA). 아이콘은 pwa-assets.config.ts로 만든 public/ 파일
    VitePWA({
      // 새로 배포하면 뒤에서 새 버전을 받아 두고, 다음에 앱을 열 때 적용 (쓰는 중에 화면이 갑자기 바뀌지 않게)
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'PLAN:J — 여행 동선 플래너',
        short_name: 'PLAN:J',
        description: '계획하는 순간, 여행이 시작된다. 가고 싶은 곳만 고르면 동선과 시간표를 짜 주는 여행 플래너',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        // 시그니처 컬러 — 안드로이드 상단 바·작업 전환 화면 색
        theme_color: '#F86A07',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 앱 화면 파일은 미리 받아 두어 빠르게 열림
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,ico}'],
        // config.js는 API 키 설정(Docker에서 컨테이너를 켤 때 만듦) — 옛 값이 남지 않게 캐시하지 않음
        globIgnores: ['config.js'],
        navigateFallbackDenylist: [/^\/config\.js$/],
        // 앱 코드 파일이 2MB를 넘어도 미리 받기
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          { urlPattern: /^https?:\/\/[^/]+\/config\.js(\?.*)?$/, handler: 'NetworkOnly' },
          // Pretendard 글꼴 — 한 번 받으면 오프라인에서도 같은 글꼴
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard@/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pretendard',
              expiration: { maxEntries: 300, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // 지도·장소(Google), 로그인·저장(Supabase), 길찾기 요청은 캐시하지 않고 항상 서버에서 (기본 동작)
      },
    }),
  ],
})
