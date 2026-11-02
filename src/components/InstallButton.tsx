import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { t } from '../i18n'

/** 헤더의 [앱 설치] — 설치할 수 있을 때만 보임 (안드로이드·PC: 설치창, 아이폰: 방법 안내) */
export default function InstallButton() {
  const state = useInstallPrompt()
  const [guideOpen, setGuideOpen] = useState(false)

  if (state.kind === 'hidden') return null

  return (
    <>
      <button
        type="button"
        className="install-btn"
        onClick={() => (state.kind === 'prompt' ? void state.install() : setGuideOpen(true))}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
        </svg>
        <span className="install-label">{t('앱 설치')}</span>
      </button>

      {/* 안내창은 헤더 밖(body)에 그림 — 헤더 버튼 모양이 섞이거나 Safari에서 가려지지 않게 */}
      {guideOpen &&
        createPortal(
          <div className="dialog-backdrop" onClick={() => setGuideOpen(false)}>
            <div
              className="dialog install-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="install-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="install-title" className="wizard-title">
                {t('홈 화면에 PLAN:J 추가하기')}
              </h2>
              <ol className="install-steps">
                {/* Safari 화면 배치가 iOS 버전마다 달라서 (iOS 26부터는 공유가 ⋯ 메뉴 안) 두 경우를 모두 안내 */}
                <li>
                  {t('Safari 주소창 옆의 ⋯ 버튼을 누른 뒤 [공유]를 누르세요.')}
                  <span className="install-alt">
                    {t('⋯ 버튼이 없으면 화면 아래쪽(아이패드는 위쪽)의 공유 버튼 □↑ 을 누르세요.')}
                  </span>
                </li>
                <li>{t('목록을 위로 올려 [홈 화면에 추가]를 누르세요. 안 보이면 맨 아래 [더 보기]에서 찾을 수 있어요.')}</li>
                <li>{t('오른쪽 위 [추가]를 누르면 홈 화면에 PLAN:J 아이콘이 생깁니다.')}</li>
              </ol>
              <p className="hint">{t('Safari가 아닌 앱(카카오톡 등)에서 열었다면, Safari로 다시 열어 주세요.')}</p>
              <div className="welcome-actions">
                <button type="button" className="btn primary" onClick={() => setGuideOpen(false)} autoFocus>
                  {t('확인')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
