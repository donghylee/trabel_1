import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// 앱 아이콘 만들기: npx pwa-assets-generator
// 원본 public/favicon.png(PLAN:J 'J' 마크) → public/ 에 192·512·maskable·apple-touch-icon 등
// 원본 로고를 더 큰 해상도로 바꾸면 다시 실행해 주세요.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // 흰 바탕 위에 로고 — 안드로이드가 동그랗게 잘라도 로고가 잘리지 않게 maskable은 여백을 더 크게
    transparent: { ...minimal2023Preset.transparent, padding: 0.1 },
    maskable: { ...minimal2023Preset.maskable, padding: 0.3, resizeOptions: { background: '#ffffff' } },
    apple: { ...minimal2023Preset.apple, padding: 0.2, resizeOptions: { background: '#ffffff' } },
  },
  images: ['public/favicon.png'],
})
