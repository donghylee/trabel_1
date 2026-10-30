import { en } from './en'

// 한/영 전환. 화면 글자는 한국어 문장을 그대로 키로 쓰고 t('…')로 감싼다.
// 영어는 en.ts의 { 한국어: English } 표에서 찾고, 없으면 한국어를 그대로 보여 준다.
// {이름} 자리는 t('{n}일차', { n: 2 })처럼 값으로 채운다.

export type Lang = 'ko' | 'en'

const STORAGE_KEY = 'trip-route-planner:lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'ko' || saved === 'en') return saved
  } catch {
    // 저장소를 못 쓰면 브라우저 언어로
  }
  return navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

// React 밖(시간 표시·공유 이미지·검색 요청 등)에서도 쓰도록 현재 언어를 모듈에 둔다.
// 언어를 바꾸면 LangProvider가 App부터 다시 그리므로 t()를 부른 곳도 새 언어로 바뀐다.
let current: Lang = initialLang()
applyToDocument(current)

/** <html lang>과 브라우저 탭 제목 */
function applyToDocument(lang: Lang) {
  document.documentElement.lang = lang
  document.title = lang === 'en' ? 'Your trip starts the moment you plan it. PLAN:J' : '계획하는 순간, 여행이 시작된다. PLAN:J'
}

export function getLang(): Lang {
  return current
}

/** LangProvider만 부름 — 화면을 다시 그리기 전에 바꿔 둔다 */
export function setCurrentLang(next: Lang) {
  current = next
  applyToDocument(next)
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // 저장 못 하면 이번 방문 동안만
  }
}

export function t(text: string, values?: Record<string, string | number>): string {
  const template = current === 'en' ? (en[text] ?? text) : text
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))
}

// en 표를 거꾸로 (English → 한국어) — 영어로 저장된 앱 문장을 한국어 화면에서 되돌릴 때
let koOf: Map<string, string> | null = null

/** 앱이 아는 문장이면 지금 언어로 (어느 언어로 저장됐든), 모르는 글(사용자가 쓴 글)은 그대로 */
export function translateKnown(text: string): string {
  if (current === 'en') return en[text] ?? text
  koOf ??= new Map(Object.entries(en).map(([ko, english]) => [english, ko]))
  return koOf.get(text) ?? text
}

/** Google 지도·장소 검색 등에 넘길 언어 코드 */
export function apiLanguage(): string {
  return current === 'en' ? 'en' : 'ko'
}

export { useI18n } from './context'
