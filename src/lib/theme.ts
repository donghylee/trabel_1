// 화면 모드: 기기 설정 따라가기(기본) / 밝게 / 어둡게 — 계정 설정에서 고름, 이 기기에만 기억.
// index.html의 작은 스크립트가 첫 화면을 그리기 전에 같은 규칙으로 <html data-theme>을 먼저 붙임 (하얀 화면 번쩍임 방지)

export type ThemeChoice = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'trip-route-planner:theme:v1'
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

export function themeChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

function applyTheme() {
  const choice = themeChoice()
  document.documentElement.dataset.theme = choice === 'system' ? (systemDark.matches ? 'dark' : 'light') : choice
}

export function chooseTheme(choice: ThemeChoice) {
  try {
    if (choice === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // 기억하지 못해도 지금 화면은 바꿈
  }
  applyTheme()
}

/** 앱 시작 때 한 번 — 기기 설정을 따르는 중이면 기기 설정이 바뀔 때 함께 바뀜 */
export function followSystemTheme() {
  systemDark.addEventListener('change', applyTheme)
}
