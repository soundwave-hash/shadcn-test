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
  'United States': { lat: 39.5,  lng: -98.35  },
  'Canada':        { lat: 56.1,  lng: -106.3  },
  'Mexico':        { lat: 23.6,  lng: -102.5  },
  'Germany':       { lat: 51.2,  lng: 10.4    },
  'Japan':         { lat: 36.2,  lng: 138.2   },
  'South Korea':   { lat: 35.9,  lng: 127.8   },
  'China':         { lat: 35.9,  lng: 104.2   },
}

const COUNTRY_VOLUMES = {
  'United States': 95760,
  'Canada':        42300,
  'Mexico':        25800,
  'Germany':       58200,
  'Japan':         72400,
  'South Korea':   65200,
  'China':         198400,
}

// 3-tier thresholds
const TIERS = [
  { label: 'High',   min: 100000, color: '#e91e63' },
  { label: 'Mid',    min: 50000,  color: '#00bcd4' },
  { label: 'Low',    min: 0,      color: '#ff9800' },
]

function getTier(country) {
  const vol = COUNTRY_VOLUMES[country] ?? 0
  return TIERS.find(t => vol >= t.min) ?? TIERS[TIERS.length - 1]
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

const MIN_RADIUS = 8
const MAX_RADIUS = 28

function getBubbleRadius(country) {
  const volumes = Object.values(COUNTRY_VOLUMES)
  const min = Math.min(...volumes)
  const max = Math.max(...volumes)
  const vol = COUNTRY_VOLUMES[country]
  const t = (vol - min) / (max - min)
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS)
}

export default function GeoMapPanel({ selectedCountry, onCountrySelect, T }) {
  const [hoveredCountry, setHoveredCountry] = useState(null)
  const [mapView, setMapView] = useState(DEFAULT_VIEW)

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
            Global Shipment Volume
          </div>
          <div style={{ fontSize: 11, color: selectedCountry ? '#00bcd4' : T.textMuted, marginTop: 2, minHeight: 16 }}>
            {selectedCountry
              ? `${selectedCountry} — ${COUNTRY_VOLUMES[selectedCountry]?.toLocaleString()} shipments`
              : 'Select a country'}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {TIERS.map(tier => (
            <div key={tier.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width={12} height={12}>
                <circle cx={6} cy={6} r={5} fill={tier.color} fillOpacity={0.8} />
              </svg>
              <span style={{ fontSize: 10, color: T.textMuted, whiteSpace: 'nowrap' }}>
                {tier.label === 'High' ? '> 100K' : tier.label === 'Mid' ? '50K – 100K' : '< 50K'}
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
                const selectedTierColor = selectedCountry ? getTier(selectedCountry).color : null
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

            {Object.entries(COUNTRY_COORDS).map(([country, { lat, lng }]) => {
              const isSelected  = country === selectedCountry
              const isHovered   = country === hoveredCountry
              const radius      = getBubbleRadius(country)
              const scaledR     = isSelected ? radius * 1.18 : radius
              const tier        = getTier(country)
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
                      fontSize: scaledR >= 16 ? 8 : 6,
                      fontWeight: 700,
                      fill: isSelected ? tier.color : (isDark ? '#111' : '#fff'),
                      fontFamily: 'inherit',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    {(COUNTRY_VOLUMES[country] / 1000).toFixed(0)}K
                  </text>
                  <text
                    textAnchor="middle"
                    dy={scaledR + 12}
                    style={{
                      fontSize: 9,
                      fontWeight: isSelected ? 700 : 400,
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
