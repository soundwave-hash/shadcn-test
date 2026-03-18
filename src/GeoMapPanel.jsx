import { useState, useEffect } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

const COUNTRY_COORDS = {
  'United States': { lat: 41.0,  lng: -98.35  },
  'Canada':        { lat: 56.1,  lng: -106.3  },
  'Mexico':        { lat: 19.5,  lng: -102.5  },
  'Germany':       { lat: 51.2,  lng: 10.4    },
  'Japan':         { lat: 38.5,  lng: 143.0   },
  'South Korea':   { lat: 33.0,  lng: 126.5   },
  'China':         { lat: 35.9,  lng: 104.2   },
}

const COUNTRY_VOLUMES_BY_RANGE = {
  '5D': {
    'United States': 16200,
    'Canada':         7100,
    'Mexico':         4300,
    'Germany':        9700,
    'Japan':         12100,
    'South Korea':   10900,
    'China':         33200,
  },
  '1M': {
    'United States': 95760,
    'Canada':        42300,
    'Mexico':        25800,
    'Germany':       58200,
    'Japan':         72400,
    'South Korea':   65200,
    'China':        198400,
  },
  '6M': {
    'United States': 574600,
    'Canada':        253800,
    'Mexico':        154800,
    'Germany':       349200,
    'Japan':         434400,
    'South Korea':   391200,
    'China':        1190400,
  },
  'YTD': {
    'United States': 239400,
    'Canada':        105750,
    'Mexico':         64500,
    'Germany':        145500,
    'Japan':          181000,
    'South Korea':    163000,
    'China':          496000,
  },
}

const TIER_COLORS = [
  { label: 'High', color: '#e91e63' },
  { label: 'Mid',  color: '#00bcd4' },
  { label: 'Low',  color: '#ff9800' },
]

// Compute tiers dynamically so Low/Mid/High always distribute across the current range's volumes
function computeTiers(volumes) {
  const vals = Object.values(volumes).sort((a, b) => a - b)
  const low  = vals[Math.floor(vals.length * 0.33)]
  const high = vals[Math.floor(vals.length * 0.66)]
  return [
    { ...TIER_COLORS[0], min: high },
    { ...TIER_COLORS[1], min: low  },
    { ...TIER_COLORS[2], min: 0    },
  ]
}

function getTier(country, tiers, volumes) {
  const vol = volumes[country] ?? 0
  return tiers.find(t => vol >= t.min) ?? tiers[tiers.length - 1]
}

const DEFAULT_VIEW = { zoom: 1, center: [15, 20] }

// Zoom config for every country — max 3x
const COUNTRY_VIEW = {
  'United States': { zoom: 3, center: [-98.35,  39.5]  },
  'Canada':        { zoom: 3, center: [-106.3,  56.1]  },
  'Mexico':        { zoom: 3, center: [-102.5,  23.6]  },
  'Germany':       { zoom: 3, center: [10.4,    51.2]  },
  'Japan':         { zoom: 3, center: [138.2,   36.2]  },
  'South Korea':   { zoom: 3, center: [127.8,   35.9]  },
  'China':         { zoom: 3, center: [104.2,   35.9]  },
}

// ISO 3166-1 numeric codes used by world-atlas topojson
const COUNTRY_ISO = {
  'United States': '840',
  'Canada':        '124',
  'Mexico':        '484',
  'Germany':       '276',
  'Japan':         '392',
  'South Korea':   '410',
  'China':         '156',
}

// Per-range radius bounds — min/max both increase progressively across ranges
// 5D floor of 14 keeps numbers readable; each longer range is visibly larger overall
// Follows UI button order left→right: 5D → 1M → 6M → YTD (largest)
const RADIUS_BY_RANGE = {
  '5D':  { min: 14, max: 20 },
  '1M':  { min: 16, max: 26 },
  '6M':  { min: 18, max: 30 },
  'YTD': { min: 20, max: 36 },
}

function getBubbleRadius(country, volumes, dateRange) {
  const { min: minR, max: maxR } = RADIUS_BY_RANGE[dateRange] ?? RADIUS_BY_RANGE['1M']
  const vals = Object.values(volumes)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const vol = volumes[country] ?? minV
  const t = maxV === minV ? 0.5 : (vol - minV) / (maxV - minV)
  return minR + t * (maxR - minR)
}

export default function GeoMapPanel({ selectedCountry, onCountrySelect, dateRange = '1M', T }) {
  const [hoveredCountry, setHoveredCountry] = useState(null)
  const [mapView, setMapView] = useState(DEFAULT_VIEW)

  const volumes = COUNTRY_VOLUMES_BY_RANGE[dateRange] ?? COUNTRY_VOLUMES_BY_RANGE['1M']
  const tiers   = computeTiers(volumes)

  useEffect(() => {
    setMapView(selectedCountry && COUNTRY_VIEW[selectedCountry]
      ? COUNTRY_VIEW[selectedCountry]
      : DEFAULT_VIEW
    )
  }, [selectedCountry])

  const isDark = T.bg === '#111'

  // Country land fill — subtle blue-grey tint for visibility
  const landFill        = isDark ? '#1e2b3a' : '#dce8f0'
  const landFillHover   = isDark ? '#263748' : '#c8dcea'
  const borderColor     = isDark ? '#334455' : '#aabdcc'

  return (
    <div
      style={{
        backgroundColor: T.panelBg,
        border: '1px solid ' + T.border,
        borderRadius: 8,
        padding: '14px 16px',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            Global Shipment Volume - {dateRange}
          </div>
          <div style={{ fontSize: 11, color: selectedCountry ? '#00bcd4' : T.textMuted, marginTop: 2, minHeight: 16 }}>
            {selectedCountry
              ? `${selectedCountry} — ${volumes[selectedCountry]?.toLocaleString()} shipments`
              : 'Select a country'}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {tiers.map(tier => (
            <div key={tier.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width={12} height={12}>
                <circle cx={6} cy={6} r={5} fill={tier.color} fillOpacity={0.8} />
              </svg>
              <span style={{ fontSize: 10, color: T.textMuted, whiteSpace: 'nowrap' }}>
                {tier.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div style={{ width: '100%' }}>
        <ComposableMap
          width={800}
          height={420}
          projection="geoMercator"
          projectionConfig={{ scale: 130, center: [15, 20] }}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          <ZoomableGroup center={mapView.center} zoom={mapView.zoom}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) => {
                const selectedIso = selectedCountry ? COUNTRY_ISO[selectedCountry] : null
                const selectedTierColor = selectedCountry ? getTier(selectedCountry, tiers, volumes).color : null
                return geographies.map((geo) => {
                  const isActiveCountry = geo.id === selectedIso
                  const activeFill = isDark
                    ? `${selectedTierColor}18`   // ~9% opacity tint of the tier color
                    : `${selectedTierColor}22`
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      style={{
                        default: { fill: isActiveCountry ? activeFill : landFill,     stroke: isActiveCountry ? `${selectedTierColor}55` : borderColor, strokeWidth: isActiveCountry ? 1 : 0.6, outline: 'none' },
                        hover:   { fill: isActiveCountry ? activeFill : landFillHover, stroke: isActiveCountry ? `${selectedTierColor}55` : borderColor, strokeWidth: isActiveCountry ? 1 : 0.6, outline: 'none' },
                        pressed: { fill: isActiveCountry ? activeFill : landFill,     stroke: isActiveCountry ? `${selectedTierColor}55` : borderColor, strokeWidth: isActiveCountry ? 1 : 0.6, outline: 'none' },
                      }}
                    />
                  )
                })
              }}
            </Geographies>

            {Object.entries(COUNTRY_COORDS)
              // Render hovered/selected last so they sit on top of nearby bubbles
              .sort(([a], [b]) => {
                const aScore = a === selectedCountry ? 2 : a === hoveredCountry ? 1 : 0
                const bScore = b === selectedCountry ? 2 : b === hoveredCountry ? 1 : 0
                return aScore - bScore
              })
              .map(([country, { lat, lng }]) => {
              const isSelected  = country === selectedCountry
              const isHovered   = country === hoveredCountry
              const radius      = getBubbleRadius(country, volumes, dateRange)
              const scaledR     = isSelected ? radius * 1.18 : isHovered ? radius * 1.15 : radius
              const tier        = getTier(country, tiers, volumes)
              const fillColor   = isSelected ? '#fff' : tier.color
              const fillOpacity = isSelected ? 0.95 : isHovered ? 0.85 : 0.65
              const strokeColor = isSelected ? '#fff' : tier.color
              const strokeW     = isSelected ? 2 : isHovered ? 1.5 : 1

              return (
                <Marker
                  key={country}
                  coordinates={[lng, lat]}
                  onClick={() => {
                    if (!onCountrySelect) return
                    // clicking the already-selected country reverts to world view
                    onCountrySelect(country === selectedCountry ? null : country)
                  }}
                  onMouseEnter={() => setHoveredCountry(country)}
                  onMouseLeave={() => setHoveredCountry(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Outer glow ring on hover/select */}
                  {(isSelected || isHovered) && (
                    <circle
                      r={scaledR + 5}
                      fill="none"
                      stroke={tier.color}
                      strokeWidth={1}
                      strokeOpacity={isSelected ? 0.5 : 0.3}
                    />
                  )}
                  <circle
                    r={scaledR}
                    fill={fillColor}
                    fillOpacity={fillOpacity}
                    stroke={strokeColor}
                    strokeWidth={strokeW}
                    strokeOpacity={0.9}
                    style={{ cursor: 'pointer', transition: 'r 0.15s ease, fill-opacity 0.15s ease' }}
                  />
                  {/* Volume label inside every bubble */}
                  <text
                    textAnchor="middle"
                    dy="0.35em"
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      fill: isSelected ? tier.color : (isDark ? '#111' : '#fff'),
                      fontFamily: 'inherit',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    {volumes[country] >= 1000000
                      ? (volumes[country] / 1000000).toFixed(1) + 'M'
                      : (volumes[country] / 1000).toFixed(0) + 'K'}
                  </text>
                  <text
                    textAnchor="middle"
                    dy={scaledR + 12}
                    style={{
                      fontSize: 9,
                      fontWeight: isSelected || isHovered ? 700 : 400,
                      fill: isSelected ? tier.color : T.textMuted,
                      fontFamily: 'inherit',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    {country}
                  </text>
                </Marker>
              )
            })}
          </ZoomableGroup>
        </ComposableMap>
      </div>
    </div>
  )
}
