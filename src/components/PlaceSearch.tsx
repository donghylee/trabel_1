import { useEffect, useState } from 'react'
import { categoryLabel } from '../data/catalog'
import { t } from '../i18n'
import { searchPlaces } from '../services/geocode'
import type { Country, LatLng, Place } from '../types'

/** 입력을 멈추고 이만큼 지나면 검색 */
const SEARCH_DELAY_MS = 400
const MIN_QUERY_LENGTH = 2

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; results: Place[] }
  | { status: 'error'; message: string }

type Props = {
  country: Country
  /** 이 근처 결과를 위로 (없으면 유명한 곳 순) */
  near: LatLng | null
  placeholder: string
  /** 이미 고른 장소면 버튼을 비활성화 */
  isPicked: (place: Place) => boolean
  onPick: (place: Place) => void
  pickLabel?: string
  pickedLabel?: string
  /** 고르면 검색어를 지움 */
  clearOnPick?: boolean
  autoFocus?: boolean
  /** 결과 이름을 누르면 (지도에서 미리 보기) */
  onPreview?: (place: Place) => void
  /** 지금 미리 보고 있는 결과 — 목록에서 강조 */
  previewId?: string | null
  /** 검색 결과가 새로 나왔을 때 */
  onResults?: (results: Place[]) => void
}

/** 장소 이름 검색창 + 결과 목록 */
export default function PlaceSearch({
  country,
  near,
  placeholder,
  isPicked,
  onPick,
  pickLabel = t('+ 추가'),
  pickedLabel = t('추가됨'),
  clearOnPick = false,
  autoFocus = false,
  onPreview,
  previewId = null,
  onResults,
}: Props) {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<SearchState>({ status: 'idle' })

  useEffect(() => {
    const q = query.trim()
    if (q.length < MIN_QUERY_LENGTH) {
      setSearch({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setSearch({ status: 'loading' })
      searchPlaces(q, country, near, controller.signal)
        .then((results) => {
          setSearch({ status: 'done', results })
          onResults?.(results)
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return
          setSearch({ status: 'error', message: err instanceof Error ? err.message : t('검색 중 오류가 났습니다.') })
        })
    }, SEARCH_DELAY_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // 장소를 고를 때마다 다시 검색하지 않도록 near·onResults는 의존성에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, country])

  return (
    <div className="search-box">
      <input
        type="search"
        className="search-input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus={autoFocus}
      />
      {search.status !== 'idle' && (
        <div className="search-results">
          {search.status === 'loading' && <p className="hint">{t('검색 중…')}</p>}
          {search.status === 'error' && <p className="hint error">{search.message}</p>}
          {search.status === 'done' && search.results.length === 0 && (
            <p className="hint">
              {t('"{query}"에 해당하는 장소를 {country}에서 찾지 못했습니다.', { query: query.trim(), country: country.name })}
            </p>
          )}
          {search.status === 'done' && search.results.length > 0 && (
            <ul>
              {search.results.map((place) => {
                const picked = isPicked(place)
                return (
                  <li key={place.id} className={previewId === place.id ? 'previewing' : ''}>
                    <button
                      type="button"
                      className="search-result-main as-link"
                      disabled={!onPreview}
                      onClick={() => onPreview?.(place)}
                    >
                      <span className="place-option-name">{place.name}</span>
                      <span className="tag">{categoryLabel(place.category)}</span>
                      {place.address && <div className="hint">{place.address}</div>}
                    </button>
                    <button
                      type="button"
                      className="btn small"
                      disabled={picked}
                      onClick={() => {
                        onPick(place)
                        if (clearOnPick) setQuery('')
                      }}
                    >
                      {picked ? pickedLabel : pickLabel}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
