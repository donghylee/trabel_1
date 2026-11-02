import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import LangProvider from './i18n/LangProvider'

// 홈 화면 앱(PWA): 새 버전이 배포돼 있으면 앱을 열자마자 받아서 한 번 새로고침해 바로 적용.
// (아이폰은 예전 화면을 오래 들고 있어서, 다음에 열 때까지 기다리면 고친 내용이 한참 안 보임)
// 앱을 오래 켜 두는 경우를 위해 1시간마다 새 버전이 있는지도 확인
const UPDATE_CHECK_MS = 60 * 60 * 1000
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_MS)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </StrictMode>,
)
