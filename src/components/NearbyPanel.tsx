import { nearbyKindIcons, nearbyKindLabels } from '../lib/recommend'
import { googleEnabled } from '../services/google'
import { formatDistance } from '../lib/travel'
import type { NearbyKind, Place, Recommendation } from '../types'

export type KindFilter = 'all' | NearbyKind
/** 'all' = 동선 전체, 그 밖에는 방문지 id */
export type ScopeFilter = string

type Props = {
  stops: { place: Place; order: number }[]
  kind: KindFilter
  scope: ScopeFilter
  onKindChange: (kind: KindFilter) => void
  onScopeChange: (scope: ScopeFilter) => void
  recommendations: Recommendation[]
  loading: boolean
  highlightedId: string | null
  onFocus: (poiId: string) => void
  /** 없으면 [+ 일정에 추가] 버튼을 숨김 */
  onAdd?: (rec: Recommendation) => void
}

const kindTabs: KindFilter[] = ['all', 'restaurant', 'cafe', 'attraction']

export function Stars({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  return (
    <span className="stars">
      ⭐ <strong>{rating.toFixed(1)}</strong> <span className="muted">({reviewCount.toLocaleString()})</span>
    </span>
  )
}

export default function NearbyPanel({
  stops,
  kind,
  scope,
  onKindChange,
  onScopeChange,
  recommendations,
  loading,
  highlightedId,
  onFocus,
  onAdd,
}: Props) {
  const orderOf = (placeId: string) => stops.find((s) => s.place.id === placeId)?.order

  return (
    <section className="nearby">
      <div className="nearby-head">
        <h3>주변 추천</h3>
        <span className="hint">별점·리뷰 수·동선 거리 기준</span>
      </div>

      <div className="tabs" role="tablist">
        {kindTabs.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            className={`tab ${kind === k ? 'active' : ''}`}
            onClick={() => onKindChange(k)}
          >
            {k === 'all' ? '전체' : `${nearbyKindIcons[k]} ${nearbyKindLabels[k]}`}
          </button>
        ))}
      </div>

      <div className="chips">
        <button
          type="button"
          className={`chip ${scope === 'all' ? 'active' : ''}`}
          onClick={() => onScopeChange('all')}
        >
          동선 전체
        </button>
        {stops.map((s) => (
          <button
            key={s.place.id}
            type="button"
            className={`chip ${scope === s.place.id ? 'active' : ''}`}
            onClick={() => onScopeChange(s.place.id)}
          >
            {s.order}. {s.place.name}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="hint">주변 장소를 찾는 중…</p>
      ) : recommendations.length === 0 ? (
        <p className="hint">조건에 맞는 추천 장소가 없습니다.</p>
      ) : (
        <ol className="rec-list">
          {recommendations.map((rec, i) => (
            <li key={rec.poi.id} id={`stop-${rec.poi.id}`} className={`rec-card ${highlightedId === rec.poi.id ? 'highlighted' : ''}`}>
              <span className="rec-rank">{i + 1}</span>
              <button type="button" className="rec-body as-link" onClick={() => onFocus(rec.poi.id)}>
                <div className="rec-name">
                  {nearbyKindIcons[rec.poi.kind]} {rec.poi.name}
                </div>
                <div className="rec-meta">
                  <Stars rating={rec.poi.rating} reviewCount={rec.poi.reviewCount} />
                  <span className="muted">
                    · {orderOf(rec.anchor.id)}. {rec.anchor.name}에서 도보 {rec.walkMinutes}분 ({formatDistance(rec.meters)})
                  </span>
                </div>
              </button>
              {onAdd && (
                <button type="button" className="btn small" onClick={() => onAdd(rec)}>
                  + 일정에 추가
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="hint">
        {googleEnabled ? 'Google 지도의 별점·리뷰 수 기준입니다.' : '지금은 가짜 데이터입니다. Google 키를 넣으면 실제 별점으로 바뀝니다.'}
      </p>
    </section>
  )
}
