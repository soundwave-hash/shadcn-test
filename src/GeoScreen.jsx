import { useState, useRef } from 'react'
import GeoMapPanel, { COUNTRY_VOLUMES_BY_RANGE } from './GeoMapPanel'
import SankeyPanel from './SankeyPanel'

const CARRIER_KEYS = ['express','ground','priority','sameDay','standard','freight','returns','unknown']

// How each shipment type's mix shifts relative to the 1M baseline.
// Short windows skew toward fast/urgent; longer windows grow ground, freight, and returns.
const CARRIER_TYPE_RANGE_BIAS = {
  '5D':  { express:1.20, ground:0.82, priority:1.14, sameDay:1.30, standard:0.75, freight:0.55, returns:0.65, unknown:0.88 },
  '1M':  { express:1.00, ground:1.00, priority:1.00, sameDay:1.00, standard:1.00, freight:1.00, returns:1.00, unknown:1.00 },
  '6M':  { express:0.90, ground:1.12, priority:0.94, sameDay:0.82, standard:1.18, freight:1.32, returns:1.22, unknown:1.06 },
  'YTD': { express:0.85, ground:1.16, priority:0.88, sameDay:0.76, standard:1.22, freight:1.40, returns:1.30, unknown:1.12 },
}

export default function GeoScreen({ countryData, theme, T, dateRange = '1M', onDateRangeChange }) {
  const [selectedCountry, setSelectedCountry] = useState(null)
  const sankeyRef = useRef(null)

  function scrollToSankey() {
    sankeyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const carrierRows = (() => {
    if (!selectedCountry || !countryData[selectedCountry]) return []
    const base = COUNTRY_VOLUMES_BY_RANGE['1M'][selectedCountry] || 1
    const rangeVol = (COUNTRY_VOLUMES_BY_RANGE[dateRange] || COUNTRY_VOLUMES_BY_RANGE['1M'])[selectedCountry] || base
    const scale = rangeVol / base
    const bias = CARRIER_TYPE_RANGE_BIAS[dateRange] || CARRIER_TYPE_RANGE_BIAS['1M']
    return countryData[selectedCountry].carriers.map(row => {
      const scaled = { carrier: row.carrier }
      CARRIER_KEYS.forEach(k => { scaled[k] = Math.round((row[k] || 0) * scale * (bias[k] || 1)) })
      return scaled
    })
  })()

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GeoMapPanel
        selectedCountry={selectedCountry}
        onCountrySelect={setSelectedCountry}
        onScrollToSankey={scrollToSankey}
        dateRange={dateRange}
        T={T}
      />
      <div ref={sankeyRef}>
        <SankeyPanel
          country={selectedCountry || 'Global'}
          carrierRows={carrierRows}
          T={T}
        />
      </div>
    </div>
  )
}
