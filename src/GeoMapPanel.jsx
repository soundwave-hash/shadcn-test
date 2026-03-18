import { useState } from 'react'
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

  return (
    <div
      style={{
        backgroundColor: T.panelBg,
        border: '1px solid ' + T.border,
        borderRadius: 8,
        padding: '14px 16px',
      }}
    >
      {/* Panel header */}
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: T.text,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}
        >
          Global Shipment Volume
        </div>
        <div
          style={{
            fontSize: 11,
            color: selectedCountry ? '#00bcd4' : T.textMuted,
            marginTop: 2,
            minHeight: 16,
          }}
        >
          {selectedCountry ? selectedCountry : 'Select a country'}
        </div>
      </div>

      {/* Map */}
      <div style={{ width: '100%' }}>
        <ComposableMap
          width={800}
          height={420}
          projection="geoMercator"
          projectionConfig={{
            scale: 130,
            center: [15, 20],
          }}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          <ZoomableGroup>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    style={{
                      default: {
                        fill: '#222',
                        stroke: T.border,
                        strokeWidth: 0.4,
                        outline: 'none',
                      },
                      hover: {
                        fill: '#2a2a2a',
                        stroke: T.border,
                        strokeWidth: 0.4,
                        outline: 'none',
                      },
                      pressed: {
                        fill: '#222',
                        stroke: T.border,
                        strokeWidth: 0.4,
                        outline: 'none',
                      },
                    }}
                  />
                ))
              }
            </Geographies>

            {Object.entries(COUNTRY_COORDS).map(([country, { lat, lng }]) => {
              const isSelected = country === selectedCountry
              const isHovered = country === hoveredCountry
              const radius = getBubbleRadius(country)
              const scaledRadius = isSelected ? radius * 1.15 : radius
              const opacity = isSelected ? 0.9 : isHovered ? 0.75 : 0.5

              return (
                <Marker
                  key={country}
                  coordinates={[lng, lat]}
                  onClick={() => onCountrySelect && onCountrySelect(country)}
                  onMouseEnter={() => setHoveredCountry(country)}
                  onMouseLeave={() => setHoveredCountry(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    r={scaledRadius}
                    fill="#00bcd4"
                    fillOpacity={opacity}
                    stroke={isSelected ? '#fff' : '#00bcd4'}
                    strokeWidth={isSelected ? 1.5 : 0.5}
                    strokeOpacity={isSelected ? 0.8 : 0.4}
                    style={{
                      cursor: 'pointer',
                      transition: 'r 0.15s ease, fill-opacity 0.15s ease',
                    }}
                  />
                  <text
                    textAnchor="middle"
                    dy={scaledRadius + 11}
                    style={{
                      fontSize: 9,
                      fill: isSelected ? '#fff' : T.textMuted,
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
