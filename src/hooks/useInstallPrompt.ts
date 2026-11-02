import { useEffect, useState } from 'react'

// 홈 화면에 앱으로 설치 (PWA).
// - 안드로이드·PC 크롬/엣지: 설치할 수 있게 되면 브라우저가 beforeinstallprompt를 보냄 → 그걸 붙잡아 두었다가 버튼을 누르면 설치창
// - 아이폰·아이패드: 설치창을 띄우는 기능이 없어서 "공유 → 홈 화면에 추가" 안내를 보여 줌
// - 이미 설치한 앱으로 열었으면 아무것도 보이지 않음

/** 크롬이 보내는 설치 요청 (표준 타입에 아직 없음) */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** 지금 설치한 앱(홈 화면 아이콘)으로 열려 있는지 */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** 아이폰·아이패드 (아이패드는 PC처럼 보이는 경우가 있어 터치로도 구분) */
export function isIos(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

export type InstallState =
  | { kind: 'hidden' }
  /** 버튼을 누르면 브라우저 설치창 */
  | { kind: 'prompt'; install: () => Promise<void> }
  /** 아이폰: 직접 홈 화면에 추가하는 방법 안내 */
  | { kind: 'ios' }

export function useInstallPrompt(): InstallState {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // 브라우저가 알아서 띄우는 배너 대신 우리 버튼으로
      e.preventDefault()
      setEvent(e as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return { kind: 'hidden' }
  if (event) {
    return {
      kind: 'prompt',
      install: async () => {
        await event.prompt()
        const { outcome } = await event.userChoice
        // 설치창은 한 번만 쓸 수 있음 — 설치했으면 appinstalled가 오고, 취소했으면 다음 기회까지 숨김
        if (outcome === 'accepted') setInstalled(true)
        setEvent(null)
      },
    }
  }
  return isIos() ? { kind: 'ios' } : { kind: 'hidden' }
}
