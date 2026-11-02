import { t } from '../i18n'

// "정말 삭제할까요?" 같은 확인 — 화면은 components/ConfirmDialog.tsx의 <ConfirmHost />가 그린다.
// 브라우저 기본 window.confirm은 앱 안 브라우저(카카오톡·미리보기 창 등)나 PWA에서 뜨지 않고
// 바로 '취소'로 처리되는 경우가 있어 앱이 직접 그린다.
// 사용: if (await askConfirm(t('이 글을 삭제할까요?'))) { … }

export type ConfirmRequest = { message: string; confirmLabel: string; resolve: (ok: boolean) => void }

let show: ((request: ConfirmRequest) => void) | null = null

/** ConfirmHost만 부름 — 확인 창을 그릴 함수를 등록 (null이면 해제) */
export function setConfirmHost(host: ((request: ConfirmRequest) => void) | null) {
  show = host
}

/** 확인 창을 띄우고, [확인]이면 true · [취소]·바깥 누르기·Esc면 false */
export function askConfirm(message: string, confirmLabel = t('삭제')): Promise<boolean> {
  return new Promise((resolve) => {
    if (show) show({ message, confirmLabel, resolve })
    // 창을 그릴 곳이 없으면 안전하게 취소
    else resolve(false)
  })
}
