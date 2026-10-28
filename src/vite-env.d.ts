/// <reference types="vite/client" />
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
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
