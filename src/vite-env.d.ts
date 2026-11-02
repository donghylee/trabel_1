/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="google.maps" />

interface ImportMetaEnv {
  /** Google Maps Platform API 키 (.env.local에 넣음). 없으면 무료 지도·데이터로 동작 */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  /** Google 지도 스타일 ID (없으면 개발용 DEMO_MAP_ID) */
  readonly VITE_GOOGLE_MAP_ID?: string
  /** ODsay 대중교통 길찾기 키 (한국 대중교통) */
  readonly VITE_ODSAY_API_KEY?: string
  /** TMAP 앱 키 (한국 도보 길찾기) */
  readonly VITE_TMAP_APP_KEY?: string
  /** Supabase 프로젝트 주소 (https://xxxx.supabase.co) — 없으면 이 브라우저에만 저장 */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon(공개) 키 — service_role 키는 넣으면 안 됨 */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
