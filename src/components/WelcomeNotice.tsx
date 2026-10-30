import { useState } from 'react'
import { t } from '../i18n'

// "다시 보지 않기"는 탭(창)을 닫기 전까지만 유지 — sessionStorage에 기억
const HIDE_KEY = 'trip-route-planner:welcome-hidden'

function isHidden(): boolean {
  try {
    return sessionStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

/** 처음 들어왔을 때 보여 주는 안내 */
export default function WelcomeNotice() {
  const [open, setOpen] = useState(() => !isHidden())
  const [hide, setHide] = useState(false)
  if (!open) return null

  function close() {
    if (hide) {
      try {
        sessionStorage.setItem(HIDE_KEY, '1')
      } catch {
        // 저장 못 하면 다음 새로고침 때 다시 보임
      }
    }
    setOpen(false)
  }

  return (
    <div className="dialog-backdrop" onClick={close}>
      <div
        className="dialog welcome-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="welcome-title" className="wizard-title">
          {t('안내')}
        </h2>
        <p className="welcome-text">
          {t('현재 제작중에 있는 페이지 입니다.')}
          <br />
          {t('추가로 기능은 계속해서 추가 될 예정입니다.')}
          <br />
          {t('더 추가 되었으면 하는 기능이 있을 경우에는')}
          <br />
          {t('카카오톡으로 연락 주시면 답변 드리겠습니다.')}
        </p>
        <label className="welcome-hide">
          <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />
          {t('창을 닫기 전까지 다시 보지 않기')}
        </label>
        <div className="welcome-actions">
          <button type="button" className="btn primary" onClick={close} autoFocus>
            {t('확인')}
          </button>
        </div>
      </div>
    </div>
  )
}
