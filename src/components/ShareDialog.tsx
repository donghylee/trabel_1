import { useEffect, useState } from 'react'
import { renderTripImage } from '../lib/shareImage'
import type { Country, SavedTrip } from '../types'

type Props = { trip: SavedTrip; country: Country | undefined; onClose: () => void }

/** 여행 일정 요약 이미지를 만들어 보여 주고, 공유·저장·복사할 수 있게 함 */
export default function ShareDialog({ trip, country, onClose }: Props) {
  const countryName = country?.name ?? trip.countryCode
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    renderTripImage(trip, country).then(
      (blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setImage({ blob, url })
      },
      () => !cancelled && setFailed(true),
    )
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [trip, country])

  const fileName = `${trip.name.replace(/[\\/:*?"<>|]/g, '_')}_일정.png`
  const file = image && new File([image.blob], fileName, { type: 'image/png' })
  // 휴대폰 등 파일 공유를 지원하는 브라우저에서만 [공유하기]
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  async function share() {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: trip.name, text: `${trip.name} · ${countryName} ${trip.days.length}일 일정` })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMessage('공유하지 못했습니다. 이미지 저장을 이용해 주세요.')
    }
  }

  function download() {
    if (!image) return
    const a = document.createElement('a')
    a.href = image.url
    a.download = fileName
    a.click()
    setMessage('이미지를 저장했습니다.')
  }

  async function copy() {
    if (!image) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image.blob })])
      setMessage('이미지를 복사했습니다. 메신저 등에 붙여 넣으세요.')
    } catch {
      setMessage('이 브라우저에서는 이미지 복사를 할 수 없습니다. 이미지 저장을 이용해 주세요.')
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="share-dialog-title" className="wizard-title">
          일정 공유
        </h2>
        <div className="share-preview">
          {image ? (
            <img src={image.url} alt={`${trip.name} 일정 요약`} />
          ) : failed ? (
            <p className="hint error">이미지를 만들지 못했습니다.</p>
          ) : (
            <p className="hint">이미지 만드는 중…</p>
          )}
        </div>
        {message && <p className="hint">{message}</p>}
        <div className="share-actions">
          {canShare && (
            <button type="button" className="btn primary" onClick={share}>
              공유하기
            </button>
          )}
          <button type="button" className={`btn ${canShare ? '' : 'primary'}`} disabled={!image} onClick={download}>
            이미지 저장
          </button>
          <button type="button" className="btn" disabled={!image} onClick={copy}>
            이미지 복사
          </button>
          <button type="button" className="btn share-close" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
