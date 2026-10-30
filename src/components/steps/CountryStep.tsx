import { useEffect, type CSSProperties } from 'react'
import { getCountries } from '../../data/catalog'

type Props = {
  value: string | null
  onChange: (code: string) => void
}

/** 나라별 대표 사진 (public/countries, 출처는 docs/PHOTO_CREDITS.md) — 모든 칸에 옅게, 고른 칸은 선명하게 */
const photoOf = (code: string) => `/countries/${code}.jpg`

export default function CountryStep({ value, onChange }: Props) {
  // 눌렀을 때 바로 보이게 미리 받아 둠
  useEffect(() => {
    for (const c of getCountries()) new Image().src = photoOf(c.code)
  }, [])

  return (
    <div className="choice-grid">
      {getCountries().map((country) => {
        const selected = value === country.code
        return (
          <button
            key={country.code}
            type="button"
            className={`choice-card country-card ${selected ? 'selected' : ''}`}
            style={{ '--photo': `url(${photoOf(country.code)})` } as CSSProperties}
            onClick={() => onChange(country.code)}
          >
            <span className="choice-icon">{country.flag}</span>
            <span className="choice-title">{country.name}</span>
            <span className="choice-sub">{country.regions.map((r) => r.name).join(' · ')}</span>
          </button>
        )
      })}
    </div>
  )
}
