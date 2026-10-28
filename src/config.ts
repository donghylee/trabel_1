// API 키 설정을 읽는 곳.
// - 개발(npm run dev): .env.local 의 VITE_... 값
// - Docker 컨테이너: 컨테이너를 켤 때 환경변수로 받은 값을 /config.js 가 window.__APP_CONFIG__ 로 넣어 줌
//   (키를 이미지 안에 굽지 않기 위해 — docker/40-app-config.sh 참고)

type RuntimeConfig = Partial<Record<'GOOGLE_MAPS_API_KEY' | 'GOOGLE_MAP_ID' | 'TMAP_APP_KEY' | 'ODSAY_API_KEY', string>>

declare global {
  interface Window {
    __APP_CONFIG__?: RuntimeConfig
  }
}

const runtime: RuntimeConfig = (typeof window !== 'undefined' && window.__APP_CONFIG__) || {}

function pick(runtimeValue: string | undefined, buildValue: string | undefined): string | undefined {
  return runtimeValue?.trim() || buildValue?.trim() || undefined
}

export const config = {
  googleMapsApiKey: pick(runtime.GOOGLE_MAPS_API_KEY, import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
  googleMapId: pick(runtime.GOOGLE_MAP_ID, import.meta.env.VITE_GOOGLE_MAP_ID),
  tmapAppKey: pick(runtime.TMAP_APP_KEY, import.meta.env.VITE_TMAP_APP_KEY),
  odsayApiKey: pick(runtime.ODSAY_API_KEY, import.meta.env.VITE_ODSAY_API_KEY),
}
