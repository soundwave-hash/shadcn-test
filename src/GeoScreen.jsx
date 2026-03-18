import { useState } from 'react'
import GeoMapPanel from './GeoMapPanel'
import SankeyPanel from './SankeyPanel'

export default function GeoScreen({ countryData, theme, T, dateRange = '1M', onDateRangeChange }) {
  const [selectedCountry, setSelectedCountry] = useState(null)

  const carrierRows = selectedCountry && countryData[selectedCountry]
    ? countryData[selectedCountry].carriers
    : []

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'row', gap: 16, alignItems: 'stretch' }}>
      <div style={{ flex: '0 0 40%', minWidth: 0 }}>
        <GeoMapPanel
          selectedCountry={selectedCountry}
          onCountrySelect={setSelectedCountry}
          dateRange={dateRange}
          T={T}
        />
      </div>
      <div style={{ flex: '0 0 calc(60% - 16px)', minWidth: 0 }}>
        <SankeyPanel
          country={selectedCountry || 'Global'}
          carrierRows={carrierRows}
          T={T}
        />
      </div>
    </div>
  )
}
