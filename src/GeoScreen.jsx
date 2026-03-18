import { useState } from 'react'
import GeoMapPanel, { COUNTRY_VOLUMES_BY_RANGE } from './GeoMapPanel'
import SankeyPanel from './SankeyPanel'

const CARRIER_KEYS = ['express','ground','priority','sameDay','standard','freight','returns','unknown']

export default function GeoScreen({ countryData, theme, T, dateRange = '1M', onDateRangeChange }) {
  const [selectedCountry, setSelectedCountry] = useState(null)

  const carrierRows = (() => {
    if (!selectedCountry || !countryData[selectedCountry]) return []
    const base = COUNTRY_VOLUMES_BY_RANGE['1M'][selectedCountry] || 1
    const rangeVol = (COUNTRY_VOLUMES_BY_RANGE[dateRange] || COUNTRY_VOLUMES_BY_RANGE['1M'])[selectedCountry] || base
    const scale = rangeVol / base
    return countryData[selectedCountry].carriers.map(row => {
      const scaled = { carrier: row.carrier }
      CARRIER_KEYS.forEach(k => { scaled[k] = Math.round((row[k] || 0) * scale) })
      return scaled
    })
  })()

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GeoMapPanel
        selectedCountry={selectedCountry}
        onCountrySelect={setSelectedCountry}
        dateRange={dateRange}
        T={T}
      />
      <SankeyPanel
        country={selectedCountry || 'Global'}
        carrierRows={carrierRows}
        T={T}
      />
    </div>
  )
}
