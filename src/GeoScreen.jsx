import { useState } from 'react'
import GeoMapPanel from './GeoMapPanel'
import SankeyPanel from './SankeyPanel'

export default function GeoScreen({ countryData, theme, T }) {
  const [selectedCountry, setSelectedCountry] = useState(null)

  const carrierRows = selectedCountry && countryData[selectedCountry]
    ? countryData[selectedCountry].carriers
    : []

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top row: map */}
      <GeoMapPanel
        selectedCountry={selectedCountry}
        onCountrySelect={setSelectedCountry}
        T={T}
      />

      {/* Bottom row: sankey */}
      <SankeyPanel
        country={selectedCountry || 'Global'}
        carrierRows={carrierRows}
        T={T}
      />
    </div>
  )
}
