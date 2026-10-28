import { countries } from '../../data/catalog'

type Props = {
  value: string | null
  onChange: (code: string) => void
}

export default function CountryStep({ value, onChange }: Props) {
  return (
    <div className="choice-grid">
      {countries.map((country) => (
        <button
          key={country.code}
          type="button"
          className={`choice-card ${value === country.code ? 'selected' : ''}`}
          onClick={() => onChange(country.code)}
        >
          <span className="choice-icon">{country.flag}</span>
          <span className="choice-title">{country.name}</span>
          <span className="choice-sub">{country.regions.map((r) => r.name).join(' · ')}</span>
        </button>
      ))}
    </div>
  )
}
