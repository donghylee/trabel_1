import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { setConfirmHost, type ConfirmRequest } from '../lib/confirm'

/** 확인 창 (lib/confirm의 askConfirm으로 띄움) — App 맨 아래에 한 번 둠 */
export default function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)

  useEffect(() => {
    setConfirmHost((next) =>
      setRequest((prev) => {
        // 이미 떠 있는 창이 있으면 그 질문은 취소로 끝냄
        prev?.resolve(false)
        return next
      }),
    )
    return () => setConfirmHost(null)
  }, [])

  function answer(ok: boolean) {
    request?.resolve(ok)
    setRequest(null)
  }

  useEffect(() => {
    if (!request) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      request.resolve(false)
      setRequest(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [request])

  if (!request) return null
  return (
    <div className="dialog-backdrop confirm-backdrop" onClick={() => answer(false)}>
      <div
        className="dialog confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="confirm-message" className="confirm-message">
          {request.message}
        </p>
        <div className="confirm-actions">
          <button type="button" className="btn" onClick={() => answer(false)} autoFocus>
            {t('취소')}
          </button>
          <button type="button" className="btn primary" onClick={() => answer(true)}>
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
