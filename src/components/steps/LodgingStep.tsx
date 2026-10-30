import { t } from '../../i18n'
import { isSamePlace } from '../../lib/place'
import type { Country, LatLng, Place } from '../../types'
import PlaceSearch from '../PlaceSearch'

type Props = {
  country: Country
  /** 고른 방문지들의 가운데 — 숙소 검색 시 이 근처를 우선 */
  near: LatLng | null
  lodging: Place | null
  startFromLodging: boolean
  returnToLodging: boolean
  onChange: (lodging: Place | null, startFromLodging: boolean, returnToLodging: boolean) => void
}

export default function LodgingStep({ country, near, lodging, startFromLodging, returnToLodging, onChange }: Props) {
  return (
    <div className="place-step">
      <p className="hint">
        {t('숙소를 넣으면 숙소 → 첫 장소, 마지막 장소 → 숙소 이동까지 일정에 포함됩니다. 숙소가 없으면 건너뛰어도 됩니다.')}
      </p>

      {lodging ? (
        <div className="lodging-card">
          <span className="lodging-icon">🏨</span>
          <div className="lodging-body">
            <div className="place-option-name">{lodging.name}</div>
            {lodging.address && <div className="hint">{lodging.address}</div>}
          </div>
          <button
            type="button"
            className="btn small"
            onClick={() => onChange(null, startFromLodging, returnToLodging)}
          >
            {t('숙소 지우기')}
          </button>
        </div>
      ) : (
        <PlaceSearch
          country={country}
          near={near}
          placeholder={t('숙소 이름이나 주소를 검색하세요 (예: 신라호텔, 명동 게스트하우스)')}
          isPicked={(place) => !!lodging && isSamePlace(lodging, place)}
          onPick={(place) => onChange({ ...place, category: 'lodging' }, startFromLodging, returnToLodging)}
          pickLabel={t('숙소로 선택')}
          pickedLabel={t('선택됨')}
          clearOnPick
          autoFocus
        />
      )}

      <div className="lodging-options">
        <label>
          <input
            type="checkbox"
            checked={startFromLodging}
            disabled={!lodging}
            onChange={(e) => onChange(lodging, e.target.checked, returnToLodging)}
          />
          {t('출발 시각에 숙소에서 출발')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={returnToLodging}
            disabled={!lodging}
            onChange={(e) => onChange(lodging, startFromLodging, e.target.checked)}
          />
          {t('마지막에 숙소로 돌아오기 (종료 시각 안에 포함)')}
        </label>
      </div>
    </div>
  )
}
