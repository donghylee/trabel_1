import { useEffect, useState } from 'react'
import { t } from '../i18n'
import type { SessionUser } from '../lib/auth'
import {
  disablePush,
  enablePush,
  loadNotifySettings,
  pushStatus,
  saveNotifySetting,
  type NotifySettings,
  type PushStatus,
} from '../lib/push'

const KINDS: { key: keyof NotifySettings; label: string; desc: string }[] = [
  { key: 'notify_trip', label: '여행 일정 알림', desc: '여행 시작일을 넣은 일정의 방문·식사 10분 전에 알려 드려요.' },
  { key: 'notify_post', label: '좋아요·댓글 알림', desc: '내 글에 좋아요나 댓글이 달리면 알려 드려요.' },
  { key: 'notify_dm', label: '메시지(DM) 알림', desc: '새 메시지가 오면 알려 드려요.' },
]

/** 계정 설정의 알림 — 이 기기로 받기 + 종류별 켜기/끄기 (서버 함수가 보내기 전에 확인) */
export default function NotifySettingsPanel({ user }: { user: SessionUser }) {
  const [device, setDevice] = useState<PushStatus | null>(null)
  const [settings, setSettings] = useState<NotifySettings | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    pushStatus().then((s) => !cancelled && setDevice(s))
    loadNotifySettings(user.id).then((s) => {
      if (cancelled) return
      setSettings(s)
      setLoadFailed(!s)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  async function toggleDevice() {
    setBusy(true)
    if (device === 'on') {
      await disablePush()
      setDevice(await pushStatus())
    } else setDevice(await enablePush())
    setBusy(false)
  }

  async function toggleKind(key: keyof NotifySettings) {
    if (!settings) return
    const on = !settings[key]
    // 화면부터 바꾸고, 저장이 안 되면 되돌림
    setSettings({ ...settings, [key]: on })
    setSaveFailed(false)
    if (!(await saveNotifySetting(user.id, key, on))) {
      setSettings((s) => s && { ...s, [key]: !on })
      setSaveFailed(true)
      return
    }
    // 켰는데 이 기기가 아직 알림을 받지 않으면 같이 켬
    if (on && device === 'off') setDevice(await enablePush())
  }

  return (
    <div className="notify-settings">
      <h3 className="notify-title">{t('알림 설정')}</h3>
      {device === 'needs-install' ? (
        <p className="notice">{t('🔔 아이폰은 홈 화면에 앱을 설치하면 알림을 받을 수 있어요. (iOS 16.4 이상)')}</p>
      ) : device === 'denied' ? (
        <p className="notice">{t('🔕 알림이 막혀 있어요. 휴대폰(브라우저) 설정에서 PLAN:J 알림을 허용해 주세요.')}</p>
      ) : device === 'unsupported' ? (
        <p className="hint">{t('이 브라우저에서는 알림을 받을 수 없어요.')}</p>
      ) : (
        device && (
          <div className="notice notify-device">
            <span>{device === 'on' ? t('🔔 이 기기로 알림을 받고 있어요.') : t('🔔 앱이 꺼져 있어도 알림을 받아 보세요.')}</span>
            <button type="button" className={`btn small ${device === 'on' ? '' : 'primary'}`} disabled={busy} onClick={toggleDevice}>
              {device === 'on' ? t('이 기기 알림 끄기') : t('이 기기 알림 켜기')}
            </button>
          </div>
        )
      )}
      <ul className="notify-list">
        {KINDS.map(({ key, label, desc }) => (
          <li key={key} className="notify-row">
            <div className="notify-text">
              <strong id={`${key}-label`}>{t(label)}</strong>
              <span className="hint">{t(desc)}</span>
            </div>
            <button
              type="button"
              role="switch"
              className="switch"
              aria-checked={!!settings?.[key]}
              aria-labelledby={`${key}-label`}
              disabled={!settings}
              onClick={() => void toggleKind(key)}
            >
              <span className="switch-knob" />
            </button>
          </li>
        ))}
      </ul>
      {loadFailed && <p className="field-error">{t('알림 설정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')}</p>}
      {saveFailed && <p className="field-error">{t('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')}</p>}
    </div>
  )
}
