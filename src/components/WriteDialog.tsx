import { useEffect, useState } from 'react'
import { findCountry, tripTitle } from '../data/catalog'
import { t } from '../i18n'
import { resizeImage } from '../lib/image'
import { parseTags } from '../lib/posts'
import { renderTripImage } from '../lib/shareImage'
import type { SavedTrip } from '../types'

type Props = {
  trips: SavedTrip[]
  onCancel: () => void
  /** 올리지 못했으면 이유를 돌려줌 */
  /** 실패하면 안내 문구, 성공하면 null */
  onSubmit: (post: { trip: SavedTrip; caption: string; tags: string[]; photos: string[]; cover?: string }) => Promise<string | null>
  onNewPlan: () => void
}

const MAX_PHOTOS = 4

/** 일정 이미지 배경: 기본(주황 머리글) / 나라 대표 사진 / 직접 올린 사진 */
type CoverKind = 'none' | 'country' | 'upload'
const countryPhoto = (code: string) => `/countries/${code}.jpg`

/** 커뮤니티 글쓰기 — 내 여행 하나를 골라 소개글·태그와 함께 올림 */
export default function WriteDialog({ trips, onCancel, onSubmit, onNewPlan }: Props) {
  const shareable = trips.filter((trip) => trip.days.length > 0)
  const [tripId, setTripId] = useState(shareable[0]?.id ?? '')
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [coverKind, setCoverKind] = useState<CoverKind>('none')
  const [uploadedCover, setUploadedCover] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const trip = shareable.find((item) => item.id === tripId)
  const cover =
    coverKind === 'country' && trip ? countryPhoto(trip.countryCode) : coverKind === 'upload' ? uploadedCover ?? undefined : undefined

  // 고른 배경으로 일정 이미지 미리보기 (피드에 보일 모습 그대로)
  useEffect(() => {
    if (!trip) return
    let made: string | null = null
    let cancelled = false
    renderTripImage(trip, findCountry(trip.countryCode), cover).then(
      (blob) => {
        if (cancelled) return
        made = URL.createObjectURL(blob)
        setPreview(made)
      },
      () => {},
    )
    return () => {
      cancelled = true
      if (made) URL.revokeObjectURL(made)
    }
  }, [trip, cover])

  async function chooseCoverFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError(t('이미지 파일만 올릴 수 있습니다.'))
      return
    }
    try {
      setUploadedCover(await resizeImage(file))
      setCoverKind('upload')
      setError(null)
    } catch {
      setError(t('읽지 못한 사진이 있습니다. 다른 파일로 시도해 주세요.'))
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return
    const images = [...files].filter((f) => f.type.startsWith('image/'))
    const room = MAX_PHOTOS - photos.length
    if (images.length < files.length) setError(t('이미지 파일만 올릴 수 있습니다.'))
    else if (images.length > room) setError(t('사진은 최대 {n}장까지 넣을 수 있습니다.', { n: MAX_PHOTOS }))
    else setError(null)
    setLoadingPhotos(true)
    const added: string[] = []
    for (const file of images.slice(0, room)) {
      try {
        added.push(await resizeImage(file))
      } catch {
        setError(t('읽지 못한 사진이 있습니다. 다른 파일로 시도해 주세요.'))
      }
    }
    setPhotos((prev) => [...prev, ...added].slice(0, MAX_PHOTOS))
    setLoadingPhotos(false)
  }

  async function submit() {
    if (!trip) {
      setError(t('올릴 여행을 골라 주세요.'))
      return
    }
    if (!caption.trim()) {
      setError(t('소개글을 입력해 주세요.'))
      return
    }
    setSubmitting(true)
    const failure = await onSubmit({ trip, caption: caption.trim(), tags: parseTags(tags), photos, cover })
    setSubmitting(false)
    if (failure) setError(failure)
  }

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog write-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="write-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="write-dialog-title" className="wizard-title">
          {t('글쓰기')}
        </h2>

        {shareable.length === 0 ? (
          <>
            <p className="hint">
              {t('올릴 수 있는 여행이 없습니다. [일정 만들기]에서 일정을 만들어 저장하면 커뮤니티에 올릴 수 있습니다.')}
            </p>
            <div className="wizard-nav">
              <button type="button" className="btn" onClick={onCancel}>
                {t('닫기')}
              </button>
              <button type="button" className="btn primary" onClick={onNewPlan}>
                {t('일정 만들러 가기')}
              </button>
            </div>
          </>
        ) : (
          <>
            <fieldset className="dialog-field">
              <legend>{t('어떤 여행을 올릴까요?')}</legend>
              <div className="write-trips">
                {shareable.map((item) => {
                  const c = findCountry(item.countryCode)
                  return (
                    <label key={item.id} className={`write-trip ${tripId === item.id ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="write-trip"
                        checked={tripId === item.id}
                        onChange={() => {
                          setTripId(item.id)
                          setError(null)
                        }}
                      />
                      <span>
                        <strong>{tripTitle(item)}</strong>
                        <span className="hint">
                          {' '}
                          · {c?.name ?? item.countryCode} {t('{n}일', { n: item.days.length })}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <fieldset className="dialog-field">
              <legend>{t('일정 이미지 배경')}</legend>
              <div className="cover-choices" role="radiogroup" aria-label={t('일정 이미지 배경')}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={coverKind === 'none'}
                  className={`cover-choice plain ${coverKind === 'none' ? 'selected' : ''}`}
                  onClick={() => setCoverKind('none')}
                >
                  <span>{t('기본')}</span>
                </button>
                {trip && (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={coverKind === 'country'}
                    className={`cover-choice ${coverKind === 'country' ? 'selected' : ''}`}
                    style={{ backgroundImage: `url(${countryPhoto(trip.countryCode)})` }}
                    onClick={() => setCoverKind('country')}
                  >
                    <span>{t('나라 사진')}</span>
                  </button>
                )}
                <label
                  className={`cover-choice upload ${coverKind === 'upload' ? 'selected' : ''}`}
                  style={uploadedCover ? { backgroundImage: `url(${uploadedCover})` } : undefined}
                  onClick={(e) => {
                    // 이미 올린 사진이 있으면 누를 때 그 사진으로 고르기만 (바꾸려면 다시 누르면 파일 창)
                    if (uploadedCover && coverKind !== 'upload') {
                      e.preventDefault()
                      setCoverKind('upload')
                    }
                  }}
                >
                  <span>{uploadedCover ? t('내 사진') : t('+ 사진 올리기')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      chooseCoverFile(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
              <div className="cover-preview">
                {preview ? <img src={preview} alt={t('일정 이미지 미리보기')} /> : <p className="hint">{t('일정 불러오는 중…')}</p>}
              </div>
            </fieldset>

            <label className="dialog-field">
              <span className="dialog-label">{t('소개글')}</span>
              <textarea
                className="text-input write-caption"
                rows={4}
                maxLength={500}
                placeholder={t('이 여행의 팁이나 소감을 적어 주세요.')}
                value={caption}
                onChange={(e) => {
                  setCaption(e.target.value)
                  setError(null)
                }}
              />
            </label>

            <div className="dialog-field">
              <span className="dialog-label">
                {t('사진 (선택, 최대 {n}장)', { n: MAX_PHOTOS })}
              </span>
              <div className="write-photos">
                {photos.map((src, i) => (
                  <div key={i} className="write-photo">
                    <img src={src} alt={t('첨부 사진 {n}', { n: i + 1 })} />
                    <button
                      type="button"
                      className="write-photo-remove"
                      aria-label={t('사진 {n} 빼기', { n: i + 1 })}
                      onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label className={`write-photo add ${loadingPhotos ? 'loading' : ''}`}>
                    {loadingPhotos ? t('불러오는 중…') : t('+ 사진 추가')}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      disabled={loadingPhotos}
                      onChange={(e) => {
                        addPhotos(e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
              </div>
              <span className="hint">{t('피드에서는 일정 이미지 다음에 옆으로 넘겨 볼 수 있습니다.')}</span>
            </div>

            <label className="dialog-field">
              <span className="dialog-label">{t('태그 (선택)')}</span>
              <input
                className="text-input"
                placeholder={t('#도쿄 #2박3일 #맛집')}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </label>

            {error && <p className="field-error">{error}</p>}

            <div className="wizard-nav">
              <button type="button" className="btn" onClick={onCancel}>
                {t('취소')}
              </button>
              <button type="button" className="btn primary" disabled={loadingPhotos || submitting} onClick={submit}>
                {t('올리기')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
