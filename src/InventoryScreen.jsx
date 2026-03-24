import { useState, useMemo, useRef, useEffect } from 'react'
import NewsTicker from './NewsTicker'
import AccountSwitcher from './AccountSwitcher'
import {
  PRODUCTS,
  CATEGORIES,
  SUBCATEGORIES_BY_CATEGORY,
  COUNTRY_SALES_PROFILES,
  COUNTRY_INV_PROFILES,
  CITY_FRACTIONS,
} from './data/groceryProducts'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Sun, Download, X, Zap } from 'lucide-react'

import { saveAs } from 'file-saver'

// ── Column definitions ─────────────────────────────────────────────────────────
const COLS = [
  { key: 'sku',        label: 'SKU',          width:  72, align: 'left',  sticky: true  },
  { key: 'name',       label: 'Name',          width: 168, align: 'left',  sticky: true  },
  { key: 'category',   label: 'Department',    width: 110, align: 'left',  sticky: true  },
  { key: 'subcategory',label: 'Category',      width: 140, align: 'left',  sticky: true  },
  { key: 'onHand',     label: 'Units on Hand', width: 108, align: 'right', sticky: false },
  { key: 'dailySales', label: 'Daily Sales',   width:  88, align: 'right', sticky: false },
  { key: 'weeklySales',label: 'Weekly Sales',  width:  96, align: 'right', sticky: false },
  { key: 'fourWkAvg',  label: '4-Wk Avg',      width:  88, align: 'right', sticky: false },
  { key: 'wos',        label: 'WOS',           width:  68, align: 'right', sticky: false, tooltip: 'Weeks of Supply\nUnits on Hand ÷ (Daily Sales × 7)' },
  { key: 'onOrder',    label: 'On Order',      width:  88, align: 'right', sticky: false },
  { key: 'inTransit',  label: 'In Transit',    width:  88, align: 'right', sticky: false },
  { key: 'leadTime',   label: 'Lead Time',     width:  84, align: 'right', sticky: false, tooltip: 'Lead Time (days)\nAvg days from purchase order to warehouse receipt, by subcategory' },
  { key: 'retail',     label: 'Retail $',      width:  74, align: 'right', sticky: false },
  { key: 'cost',       label: 'Cost $',        width:  68, align: 'right', sticky: false },
  { key: 'gmDollar',   label: 'GM $',          width:  68, align: 'right', sticky: false, tooltip: 'Gross Margin $\nRetail Price − Cost' },
  { key: 'gmPct',      label: 'GM %',          width:  68, align: 'right', sticky: false, tooltip: 'Gross Margin %\n(Retail − Cost) ÷ Retail' },
  { key: 'fillRate',   label: 'Fill Rate',     width:  78, align: 'right', sticky: false, tooltip: 'Fill Rate %\n% of customer demand fulfilled from available inventory (historical avg)' },
]

const STICKY_COLS     = COLS.filter(c => c.sticky)
const NON_STICKY_COLS = COLS.filter(c => !c.sticky)
const COLS_BY_KEY     = Object.fromEntries(COLS.map(c => [c.key, c]))

// Exchange rates vs USD — hardcoded as of March 2026
const CURRENCY_BY_COUNTRY = {
  'United States': { code: 'USD', symbol: '$',   rate: 1.00,  decimals: 2 },
  'China':         { code: 'CNY', symbol: '¥',   rate: 7.24,  decimals: 2 },
  'Germany':       { code: 'EUR', symbol: '€',   rate: 0.92,  decimals: 2 },
  'Japan':         { code: 'JPY', symbol: '¥',   rate: 149.0, decimals: 0 },
  'Canada':        { code: 'CAD', symbol: 'CA$', rate: 1.38,  decimals: 2 },
  'Korea':   { code: 'KRW', symbol: '₩',   rate: 1340,  decimals: 0 },
  'Mexico':        { code: 'MXN', symbol: 'MX$', rate: 17.2,  decimals: 2 },
}

// Cumulative left offsets for sticky columns (0, 72, 240, 350)
const STICKY_LEFTS = COLS.reduce((acc, col) => {
  const last = acc.length ? acc[acc.length - 1] : null
  if (!col.sticky) return acc
  const prev = last ? last.left + last.width : 0
  acc.push({ key: col.key, left: prev, width: col.width })
  return acc
}, [])
const STICKY_LEFT_MAP = Object.fromEntries(STICKY_LEFTS.map(s => [s.key, s.left]))

// ── Row derivation ─────────────────────────────────────────────────────────────
function getSalesFrac(p, country, cities) {
  if (!country) return 1
  const prof = COUNTRY_SALES_PROFILES[p.profile] ?? COUNTRY_SALES_PROFILES.Balanced
  const cf = prof[country] ?? 0
  if (!cities.length) return cf
  const cityFrac = cities.reduce((s, c) => s + (CITY_FRACTIONS[country]?.[c] ?? 0), 0)
  return cf * cityFrac
}

function getInvFrac(p, country, cities) {
  if (!country) return 1
  const prof = COUNTRY_INV_PROFILES[p.profile] ?? COUNTRY_INV_PROFILES.Balanced
  const cf = prof[country] ?? 0
  if (!cities.length) return cf
  const cityFrac = cities.reduce((s, c) => s + (CITY_FRACTIONS[country]?.[c] ?? 0), 0)
  return cf * cityFrac
}

function buildRows(products, country, cities, periodScale) {
  return products.map(p => {
    const sf      = getSalesFrac(p, country, cities)
    const inf     = getInvFrac(p, country, cities)
    const onHand  = Math.round(p.inventory * inf)
    const daily   = p.dailyAvg * sf * periodScale
    const weekly  = daily * 7
    const fourWk  = daily * 28
    const wos     = daily > 0 ? +(onHand / weekly).toFixed(1) : 0
    const gm$     = p.retail - p.cost
    const gm_pct  = p.retail > 0 ? gm$ / p.retail : 0
    return {
      sku:         p.sku,
      name:        p.name,
      category:    p.category,
      subcategory: p.subcategory,
      onHand,
      dailySales:  Math.round(daily),
      weeklySales: Math.round(weekly),
      fourWkAvg:   Math.round(fourWk),
      wos,
      retail:      p.retail,
      cost:        p.cost,
      gmDollar:    gm$,
      gmPct:       gm_pct,
      onOrder:     Math.round(p.onOrder * inf),
      inTransit:   Math.round(p.inTransit * inf),
      leadTime:    p.leadTime,
      fillRate:    p.fillRate,
    }
  })
}

// ── Color helpers ──────────────────────────────────────────────────────────────
function wosBg(wos, isDark) {
  if (wos >= 8) return isDark ? '#1b3320' : '#d4edda'
  if (wos >= 4) return isDark ? '#3d2c00' : '#fff3cd'
  return isDark ? '#3d1010' : '#f8d7da'
}
function wosColor(wos) {
  if (wos >= 8) return '#4caf50'
  if (wos >= 4) return '#ff9800'
  return '#f44336'
}
function gmColor(pct) {
  if (pct >= 0.40) return '#4caf50'
  if (pct < 0.25)  return '#ff9800'
  return null
}
function fillColor(fr) {
  if (fr >= 98) return '#4caf50'
  if (fr >= 95) return '#ff9800'
  return '#f44336'
}
function fmt(v, key, cur, showUSD) {
  if (key === 'gmPct')    return (v * 100).toFixed(1) + '%'
  if (key === 'fillRate') return v.toFixed(1) + '%'
  if (key === 'wos')      return v.toFixed(1)
  if (key === 'leadTime') return v + 'd'
  if (['retail','cost','gmDollar'].includes(key)) {
    if (!cur || showUSD) return '$' + v.toFixed(2)
    const converted = v * cur.rate
    return cur.symbol + (cur.decimals === 0
      ? Math.round(converted).toLocaleString()
      : converted.toFixed(cur.decimals))
  }
  return v.toLocaleString()
}

const PERIOD_SCALE = { '5D':1.02, '1M':0.98, '6M':0.92, 'YTD':0.88 }

// ── AI Insight Drawer ─────────────────────────────────────────────────────────

function AiInsightDrawer({ row, country, T, isDark, onClose }) {
  if (!row) return null

  const velocityPct    = row.fourWkAvg > 0 ? Math.round((row.weeklySales - row.fourWkAvg) / row.fourWkAvg * 100) : 0
  const daysToStockout = Math.round(row.wos * 7)
  const canReorderInTime = daysToStockout > row.leadTime
  const reorderQty     = Math.max(0, Math.round((row.leadTime / 7 * row.weeklySales * 1.5) - row.onHand - row.onOrder - row.inTransit))

  const velocityColor = velocityPct > 5 ? '#4caf50' : velocityPct < -5 ? '#f44336' : '#ff9800'
  const velocityArrow = velocityPct > 5 ? '↑' : velocityPct < -5 ? '↓' : '→'
  const velocityLabel = velocityPct > 5 ? 'Trending Up' : velocityPct < -5 ? 'Trending Down' : 'Stable'

  const wosStatus = row.wos >= 8 ? { label: 'Healthy', color: '#4caf50' }
    : row.wos >= 4              ? { label: 'Monitor', color: '#ff9800' }
    :                             { label: 'Critical', color: '#f44336' }

  const stockoutRisk      = !canReorderInTime ? 'HIGH' : row.wos < 4 ? 'MEDIUM' : 'LOW'
  const stockoutRiskColor = stockoutRisk === 'HIGH' ? '#f44336' : stockoutRisk === 'MEDIUM' ? '#ff9800' : '#4caf50'

  const actions = []
  if (!canReorderInTime || row.wos < 2) {
    actions.push(`Place an emergency order for ${reorderQty.toLocaleString()} units immediately — stockout projected in ${daysToStockout} days, lead time is ${row.leadTime} days.`)
  } else if (row.wos < row.leadTime / 7 + 1.5) {
    actions.push(`Reorder window is closing — place a PO for ${reorderQty.toLocaleString()} units within the next 48 hours to avoid a stockout.`)
  } else if (row.wos < 4) {
    actions.push(`Initiate replenishment now. Recommend ordering ${reorderQty.toLocaleString()} units to restore a 6-week supply buffer.`)
  }
  if (velocityPct > 10) {
    actions.push(`Demand is running ${velocityPct}% above the 4-week average — review standing PO quantities to avoid underbuying into this trend.`)
  } else if (velocityPct < -10) {
    actions.push(`Demand has softened ${Math.abs(velocityPct)}% vs the 4-week average — consider reducing the next PO to avoid building excess inventory.`)
  }
  if (row.fillRate < 95) {
    actions.push(`Fill rate at ${row.fillRate.toFixed(1)}% is below the 95% threshold. Review inventory allocation and SKU availability.`)
  }
  if (row.onOrder > 0) {
    actions.push(`${row.onOrder.toLocaleString()} units already on order with a ${row.leadTime}-day lead time. Confirm PO status with your supplier to ensure on-time receipt.`)
  }
  if (row.gmPct < 0.25) {
    actions.push(`Gross margin at ${(row.gmPct * 100).toFixed(1)}% is below the 25% floor — review cost structure or retail price for this SKU.`)
  }
  const topActions = actions.slice(0, 3)
  if (topActions.length === 0) {
    topActions.push(`${row.name} is performing within normal parameters. Monitor weekly velocity and WOS. No immediate action required.`)
  }

  const tile = (extra = {}) => ({
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: 7,
    padding: '10px 12px',
    ...extra,
  })

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 360, zIndex: 10,
      backgroundColor: T.cardBg,
      borderLeft: `1px solid ${T.border}`,
      boxShadow: isDark ? '-4px 0 24px rgba(0,0,0,0.5)' : '-4px 0 24px rgba(0,0,0,0.10)',
      display: 'flex', flexDirection: 'column',
      animation: 'wiq-slide-in-right 0.22s ease',
    }}>

      {/* Header */}
      <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <Zap size={10} color={T.tabActive} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: T.tabActive }}>AI ANALYSIS</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, lineHeight: 1.3, marginBottom: 6 }}>
              {row.name}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: T.textDim, background: T.activeItemBg, border: `1px solid ${T.border}`, borderRadius: 3, padding: '1px 6px' }}>{row.category}</span>
              <span style={{ fontSize: 10, color: T.textDim, background: T.activeItemBg, border: `1px solid ${T.border}`, borderRadius: 3, padding: '1px 6px' }}>{row.subcategory}</span>
              <span style={{ fontSize: 10, color: T.textDim }}>{row.sku}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: '2px 4px', borderRadius: 4, lineHeight: 1, flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px' }}>

        {/* Demand Signal */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: T.textDim, marginBottom: 10 }}>DEMAND SIGNAL</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, ...tile() }}>
              <div style={{ fontSize: 9, color: T.textDim, marginBottom: 4 }}>vs 4-Wk Avg</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: velocityColor }}>{velocityArrow} {velocityPct > 0 ? '+' : ''}{velocityPct}%</div>
              <div style={{ fontSize: 10, color: velocityColor, marginTop: 2 }}>{velocityLabel}</div>
            </div>
            <div style={{ flex: 1, ...tile() }}>
              <div style={{ fontSize: 9, color: T.textDim, marginBottom: 4 }}>Weekly Sales</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: T.text }}>{row.weeklySales.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>units / week</div>
            </div>
          </div>
        </div>

        {/* Supply Health */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: T.textDim, marginBottom: 10 }}>SUPPLY HEALTH</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, ...tile({ borderLeft: `3px solid ${wosStatus.color}` }) }}>
              <div style={{ fontSize: 9, color: T.textDim, marginBottom: 4 }}>Weeks of Supply</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: wosStatus.color }}>{row.wos.toFixed(1)}</div>
              <div style={{ fontSize: 10, color: wosStatus.color, marginTop: 2 }}>{wosStatus.label}</div>
            </div>
            <div style={{ flex: 1, ...tile({ borderLeft: `3px solid ${stockoutRiskColor}` }) }}>
              <div style={{ fontSize: 9, color: T.textDim, marginBottom: 4 }}>Stockout Risk</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: stockoutRiskColor }}>{stockoutRisk}</div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{daysToStockout}d remaining</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, ...tile() }}>
              <div style={{ fontSize: 9, color: T.textDim, marginBottom: 4 }}>On Order</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{row.onOrder.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>Lead time: {row.leadTime}d</div>
            </div>
            <div style={{ flex: 1, ...tile() }}>
              <div style={{ fontSize: 9, color: T.textDim, marginBottom: 4 }}>In Transit</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{row.inTransit.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>Fill rate: {row.fillRate.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: T.border, marginBottom: 18 }} />

        {/* Recommended Actions */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
            <Zap size={10} color={T.tabActive} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: T.tabActive }}>RECOMMENDED ACTIONS</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topActions.map((action, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', ...tile({ borderLeft: `3px solid ${T.tabActive}` }) }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.tabActive, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 11, color: T.text, lineHeight: 1.55 }}>{action}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Footer */}
      <div style={{ padding: '10px 18px', borderTop: `1px solid ${T.border}`, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: T.textDim }}>WarehouseIQ AI · {country}</span>
        <button onClick={onClose} style={{ fontSize: 10, color: T.textMuted, background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>
          Close
        </button>
      </div>

    </div>
  )
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'detail',    label: 'Unit Sales' },
  { id: 'geo',       label: 'Geo' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'trends',    label: 'Trends' },
]

export default function InventoryScreen({
  theme, T, country, selectedCities, countries, cities,
  onCountryChange, onLocationChange, dateRange, onDateRangeChange,
  setView, onThemeToggle,
  activeUser, onUserSwitch,
  voiceOpen: voiceOpenProp, setVoiceOpen: setVoiceOpenProp,
  slackOpen: slackOpenProp, setSlackOpen: setSlackOpenProp,
}) {
  const [voiceOpenLocal, setVoiceOpenLocal] = useState(false)
  const [slackOpenLocal, setSlackOpenLocal] = useState(false)
  const voiceOpen    = voiceOpenProp    ?? voiceOpenLocal
  const setVoiceOpen = setVoiceOpenProp ?? setVoiceOpenLocal
  const slackOpen    = slackOpenProp    ?? slackOpenLocal
  const setSlackOpen = setSlackOpenProp ?? setSlackOpenLocal
  const [selDepts, setSelDepts]           = useState(new Set())  // empty = All
  const [selSubs,  setSelSubs]            = useState(new Set())  // empty = All
  const [sortCol, setSortCol]             = useState('weeklySales')
  const [sortAsc, setSortAsc]             = useState(false)
  const [locMenuOpen, setLocMenuOpen]     = useState(false)
  const [colOrder, setColOrder]           = useState(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem(`warehouseiq_prefs_${activeUser?.id}`)) ?? {}
      return prefs.colOrder ?? NON_STICKY_COLS.map(c => c.key)
    } catch { return NON_STICKY_COLS.map(c => c.key) }
  })
  const [dragColIdx, setDragColIdx]       = useState(null)
  const [overColIdx, setOverColIdx]       = useState(null)
  const [pressedColIdx, setPressedColIdx] = useState(null)
  const [tooltip, setTooltip]             = useState(null) // { text, x, y }
  const dragColRef                        = useRef(null)
  const scrollRef                         = useRef(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [selectedSku, setSelectedSku]     = useState(null)

  function handleScroll(e) {
    const el = e.currentTarget
    const visibleRows    = Math.floor((window.innerHeight - 144) / 33)
    const triggerScrollTop = (visibleRows + 10) * 33
    setShowScrollTop(el.scrollTop >= triggerScrollTop)
  }

  const isDark = theme === 'dark'
  const [showUSD, setShowUSD] = useState(false)
  const currency = CURRENCY_BY_COUNTRY[country] ?? CURRENCY_BY_COUNTRY['United States']
  const isLocalUSD = currency.code === 'USD'

  useEffect(() => { setShowUSD(false) }, [country])

  function colLabel(col) {
    if (!showUSD && !isLocalUSD && ['retail','cost','gmDollar'].includes(col.key))
      return col.label.replace('$', currency.symbol)
    return col.label
  }

  // Restore column order when active account switches
  useEffect(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem(`warehouseiq_prefs_${activeUser?.id}`)) ?? {}
      setColOrder(prefs.colOrder ?? NON_STICKY_COLS.map(c => c.key))
    } catch { setColOrder(NON_STICKY_COLS.map(c => c.key)) }
  }, [activeUser])


  const subcats = selDepts.size === 0 ? [] : [...selDepts].flatMap(d => SUBCATEGORIES_BY_CATEGORY[d] ?? [])

  const deptLabel = selDepts.size === 0 ? 'All' : selDepts.size === 1 ? [...selDepts][0] : `${selDepts.size} Depts`
  const subLabel  = selSubs.size  === 0 ? 'All' : selSubs.size  === 1 ? [...selSubs][0]  : `${selSubs.size} Cats`

  const filtered = useMemo(() => PRODUCTS.filter(p => {
    if (selDepts.size > 0 && !selDepts.has(p.category))    return false
    if (selSubs.size  > 0 && !selSubs.has(p.subcategory))  return false
    return true
  }), [selDepts, selSubs])

  const rows = useMemo(() => {
    const scale = PERIOD_SCALE[dateRange] ?? 1
    const built = buildRows(filtered, country, selectedCities, scale)
    return [...built].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol]
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortAsc ? av - bv : bv - av
    })
  }, [filtered, country, selectedCities, dateRange, sortCol, sortAsc])

  const selectedRow = selectedSku ? (rows.find(r => r.sku === selectedSku) ?? null) : null

  function handleSort(key) {
    if (sortCol === key) setSortAsc(a => !a)
    else { setSortCol(key); setSortAsc(true) }
  }

  function handleColDragStart(e, i) {
    dragColRef.current = i
    setDragColIdx(i)
    e.dataTransfer.effectAllowed = 'move'
  }
  function handleColDragOver(e, i) {
    e.preventDefault()
    if (i !== overColIdx) setOverColIdx(i)
  }
  function handleColDrop(e, i) {
    e.preventDefault()
    const from = dragColRef.current
    if (from === i) return
    setColOrder(prev => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(i, 0, item)
      try {
        const prefs = JSON.parse(localStorage.getItem(`warehouseiq_prefs_${activeUser?.id}`)) ?? {}
        localStorage.setItem(`warehouseiq_prefs_${activeUser?.id}`, JSON.stringify({ ...prefs, colOrder: next }))
      } catch {}
      return next
    })
    setDragColIdx(null)
    setOverColIdx(null)
  }
  function handleColDragEnd() {
    setDragColIdx(null)
    setOverColIdx(null)
    setPressedColIdx(null)
  }

  const displayCols = useMemo(
    () => [...STICKY_COLS, ...colOrder.map(k => COLS_BY_KEY[k])],
    [colOrder]
  )

  const locationLabel = selectedCities.length === 0
    ? 'All'
    : selectedCities.length === 1
      ? selectedCities[0]
      : `${selectedCities.length} Cities`

  function handleReset() {
    setSelDepts(new Set())
    setSelSubs(new Set())
    setSortCol('weeklySales')
    setSortAsc(false)
    const defaultOrder = NON_STICKY_COLS.map(c => c.key)
    setColOrder(defaultOrder)
    try {
      const prefs = JSON.parse(localStorage.getItem(`warehouseiq_prefs_${activeUser?.id}`)) ?? {}
      localStorage.setItem(`warehouseiq_prefs_${activeUser?.id}`, JSON.stringify({ ...prefs, colOrder: defaultOrder }))
    } catch {}
  }

  function exportCSV() {
    const header = COLS.map(c => c.label).join(',')
    const body = rows.map(r =>
      COLS.map(c => {
        const v = r[c.key]
        if (typeof v === 'string') return `"${v}"`
        return fmt(v, c.key, currency, showUSD)
      }).join(',')
    )
    saveAs(new Blob([[header, ...body].join('\n')], { type: 'text/csv;charset=utf-8;' }), 'inventory.csv')
  }

  // ── Styles ────────────────────────────────────────────────────────────────────
  const dropBtn = {
    backgroundColor: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.inputText,
    fontSize: 12, padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6, height: 28,
  }
  const filterDropBtn = {
    ...dropBtn,
    padding: '3px 9px',
  }
  const iconBtn = {
    width: 28, height: 28, borderRadius: 7, cursor: 'pointer', border: `1px solid ${T.inputBorder}`,
    backgroundColor: isDark ? '#1c1c1c' : T.inputBg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  const hdrCell = (col) => ({
    position:        'sticky',
    top:             0,
    left:            col.sticky ? STICKY_LEFT_MAP[col.key] + 'px' : undefined,
    zIndex:          col.sticky ? 4 : 3,
    // Light mode: distinct muted bg (#E4E4E7) with strong border for visual weight
    backgroundColor: isDark ? T.navBg : '#E4E4E7',
    // Light mode: 2px solid border for clear section separator
    borderBottom:    isDark ? '1.5px solid rgba(255,255,255,0.14)' : '2px solid #C4C4C8',
    borderRight:     `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
    padding:         '0 6px 2px',
    height:          35,
    textAlign:       col.align,
    fontSize:        11,
    fontWeight:      400,
    color:           'inherit',
    cursor:          'pointer',
    userSelect:      'none',
    whiteSpace:      'nowrap',
    minWidth:        col.width,
    width:           col.sticky ? col.width : undefined,
    boxSizing:       'border-box',
  })

  return (
    <>
    <div style={{ backgroundColor: T.bg, height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif', color: T.text, overflow: 'hidden' }}>

      {/* ── Nav bar ── */}
      <div style={{ backgroundColor: T.navBg, borderBottom: `1px solid ${T.border}`, boxShadow: T.navShadow, height: 48, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: '0.02em' }}>WarehouseIQ</span>
        <span style={{ color: T.sep, fontSize: 12 }}>|</span>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setView(tab.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: tab.id === 'inventory' ? 700 : 400,
            color: tab.id === 'inventory' ? T.tabActive : T.textMuted,
            borderBottom: tab.id === 'inventory' ? `2px solid ${T.tabActive}` : '2px solid transparent',
            padding: '0 4px', height: 48,
          }}>{tab.label}</button>
        ))}
        <span style={{ color: T.sep, fontSize: 12 }}>|</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {['5D','1M','6M','YTD'].map(r => (
            <button key={r} onClick={() => onDateRangeChange(r)} style={{
              background: r === dateRange ? '#00bcd4' : 'transparent',
              color: r === dateRange ? '#111' : T.textDim,
              border: `1px solid #00bcd4`, fontSize: 12, padding: '3px 0', width: 42, textAlign: 'center',
              borderRadius: 4, cursor: 'pointer', fontWeight: r === dateRange ? 700 : 400,
            }}>{r}</button>
          ))}
        </div>
        <span style={{ color: T.sep, fontSize: 12 }}>|</span>
        <NewsTicker country={country} T={T} />
        <span style={{ color: T.sep, fontSize: 12 }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: T.textDim }}>Country:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button style={dropBtn}>{country}<span style={{ color: T.textDim, fontSize: 10 }}>▼</span></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent style={{ backgroundColor: T.dropdownBg, border: `1px solid ${T.dropdownBorder}`, minWidth: 160 }}>
              {countries.map(c => (
                <DropdownMenuItem key={c} onClick={() => onCountryChange(c)}
                  style={{ color: c === country ? '#00bcd4' : T.textMuted, fontSize: 12, cursor: 'pointer', backgroundColor: c === country ? T.activeItemBg : 'transparent' }}>
                  {c}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span style={{ fontSize: 11, color: T.textDim }}>Location:</span>
          <DropdownMenu open={locMenuOpen} onOpenChange={setLocMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button style={dropBtn}>{locationLabel}<span style={{ color: T.textDim, fontSize: 10 }}>▼</span></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent style={{ backgroundColor: T.dropdownBg, border: `1px solid ${T.dropdownBorder}`, minWidth: 160 }}>
              <DropdownMenuItem closeOnClick={false}
                onClick={() => { onLocationChange([]); setLocMenuOpen(false) }}
                style={{ color: selectedCities.length === 0 ? '#00bcd4' : T.textMuted, fontSize: 12, cursor: 'pointer', backgroundColor: selectedCities.length === 0 ? T.activeItemBg : 'transparent' }}>
                All
              </DropdownMenuItem>
              {(cities || []).filter(c => c !== 'All').map(c => {
                const isSel = selectedCities.includes(c)
                return (
                  <DropdownMenuItem key={c} closeOnClick={false}
                    onClick={() => {
                      const next = isSel ? selectedCities.filter(x => x !== c) : [...selectedCities, c]
                      onLocationChange(next)
                    }}
                    style={{ color: isSel ? '#00bcd4' : T.textMuted, fontSize: 12, cursor: 'pointer', backgroundColor: isSel ? T.activeItemBg : 'transparent' }}>
                    {isSel ? '✓ ' : ''}{c}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => setVoiceOpen(o => !o)}
            title="WarehouseIQ Agent"
            style={{ width:28, height:28, borderRadius:7, cursor:'pointer', border: voiceOpen ? '1px solid #c96a4a' : `1px solid ${isDark ? T.inputBorder : 'hsl(220, 13%, 80%)'}`, background: voiceOpen ? 'rgba(201,106,74,0.12)' : (isDark ? '#1c1c1c' : 'hsl(220, 8%, 91%)'), display:'flex', alignItems:'center', justifyContent:'center', marginLeft:4 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: voiceOpen ? '#c96a4a' : (isDark ? '#fff' : '#3F3F46'), display:'block' }}>
              <line x1="12" y1="5" x2="12" y2="2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <circle cx="12" cy="1.5" r="1" fill="currentColor" stroke="none"/>
              <path d="M4 5 L20 5 Q22 5 22 7 L22 17 Q22 19 20 19 L14 19 L12 22 L10 19 L4 19 Q2 19 2 17 L2 7 Q2 5 4 5 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
              <rect x="7" y="8.5" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
              <rect x="14" y="8.5" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
              <path d="M8.5 14 Q12 16.5 15.5 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
            </svg>
          </button>
          <button
            onClick={() => setSlackOpen(o => !o)}
            title="Slack — #warehouse-ops"
            style={{ width:28, height:28, borderRadius:7, cursor:'pointer', border: slackOpen ? '1px solid #00bcd4' : `1px solid ${isDark ? T.inputBorder : 'hsl(220, 13%, 80%)'}`, background: slackOpen ? 'rgba(0,188,212,0.1)' : (isDark ? '#1c1c1c' : 'hsl(220, 8%, 91%)'), display:'flex', alignItems:'center', justifyContent:'center', marginLeft:4 }}
          >
            <svg width="15" height="15" viewBox="73 73 125 125" xmlns="http://www.w3.org/2000/svg" style={{ opacity: slackOpen ? 1 : (isDark ? 0.85 : 1.0) }}>
              <path d="M99.4 151.2c0 7.1-5.8 12.9-12.9 12.9-7.1 0-12.9-5.8-12.9-12.9 0-7.1 5.8-12.9 12.9-12.9h12.9v12.9z" fill="#E01E5A"/>
              <path d="M105.9 151.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9v-32.3z" fill="#E01E5A"/>
              <path d="M118.8 99.4c-7.1 0-12.9-5.8-12.9-12.9 0-7.1 5.8-12.9 12.9-12.9 7.1 0 12.9 5.8 12.9 12.9v12.9h-12.9z" fill="#36C5F0"/>
              <path d="M118.8 105.9c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H86.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3z" fill="#36C5F0"/>
              <path d="M170.6 118.8c0-7.1 5.8-12.9 12.9-12.9 7.1 0 12.9 5.8 12.9 12.9 0 7.1-5.8 12.9-12.9 12.9h-12.9v-12.9z" fill="#2EB67D"/>
              <path d="M164.1 118.8c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V86.5c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3z" fill="#2EB67D"/>
              <path d="M151.2 170.6c7.1 0 12.9 5.8 12.9 12.9 0 7.1-5.8 12.9-12.9 12.9-7.1 0-12.9-5.8-12.9-12.9v-12.9h12.9z" fill="#ECB22E"/>
              <path d="M151.2 164.1c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9h-32.3z" fill="#ECB22E"/>
            </svg>
          </button>
          <Button variant="outline" size="icon" onClick={onThemeToggle} title={isDark ? 'Light mode' : 'Dark mode'} style={{ width:28, height:28, borderRadius:7, border:`1px solid ${T.inputBorder}`, backgroundColor: isDark ? '#1c1c1c' : T.inputBg, marginLeft:4 }}>
            <Sun size={15} color={isDark ? '#fff' : '#333'} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button title="Export data" style={iconBtn}>
                <Download size={15} color={isDark ? '#fff' : '#333'} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ backgroundColor: T.dropdownBg, border: `1px solid ${T.dropdownBorder}`, minWidth: 160 }}>
              <DropdownMenuItem onClick={exportCSV} style={{ fontSize: 12, cursor: 'pointer', color: T.textMuted, gap: 8 }}>
                <Download size={12} /> Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {activeUser && <AccountSwitcher activeUser={activeUser} onSwitch={onUserSwitch} T={T} />}
        </div>
      </div>

      {/* ── Filters bar ── */}
      <div style={{ backgroundColor: T.navBg, borderBottom: `1px solid ${T.border}`, height: 48, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
        {/* Department multi-select */}
        <span style={{ fontSize: 11, color: T.textDim }}>Dept:</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button style={{ ...filterDropBtn, border: `1px solid ${selDepts.size > 0 ? '#00bcd4' : T.inputBorder}`, color: selDepts.size > 0 ? '#00bcd4' : T.inputText }}>
              {deptLabel}<span style={{ color: T.textDim, fontSize: 10 }}>▼</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent style={{ backgroundColor: T.dropdownBg, border: `1px solid ${T.dropdownBorder}`, minWidth: 160 }}>
            <DropdownMenuItem closeOnClick={false} onClick={() => { setSelDepts(new Set()); setSelSubs(new Set()) }}
              style={{ color: selDepts.size === 0 ? '#00bcd4' : T.textMuted, fontSize: 12, cursor: 'pointer', backgroundColor: selDepts.size === 0 ? T.activeItemBg : 'transparent' }}>
              All
            </DropdownMenuItem>
            {CATEGORIES.map(c => (
              <DropdownMenuItem key={c} closeOnClick={false}
                onClick={() => {
                  setSelDepts(prev => { const next = new Set(prev); next.has(c) ? next.delete(c) : next.add(c); return next })
                  setSelSubs(new Set())
                }}
                style={{ color: selDepts.has(c) ? '#00bcd4' : T.textMuted, fontSize: 12, cursor: 'pointer', backgroundColor: selDepts.has(c) ? T.activeItemBg : 'transparent' }}>
                {selDepts.has(c) ? '✓ ' : ''}{c}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Subcategory multi-select */}
        <span style={{ fontSize: 11, color: T.textDim }}>Category:</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button style={{ ...filterDropBtn, opacity: selDepts.size === 0 ? 0.5 : 1, border: `1px solid ${selSubs.size > 0 ? '#00bcd4' : T.inputBorder}`, color: selSubs.size > 0 ? '#00bcd4' : T.inputText }} disabled={selDepts.size === 0}>
              {subLabel}<span style={{ color: T.textDim, fontSize: 10 }}>▼</span>
            </button>
          </DropdownMenuTrigger>
          {selDepts.size > 0 && (
            <DropdownMenuContent style={{ backgroundColor: T.dropdownBg, border: `1px solid ${T.dropdownBorder}`, minWidth: 180 }}>
              <DropdownMenuItem closeOnClick={false} onClick={() => setSelSubs(new Set())}
                style={{ color: selSubs.size === 0 ? '#00bcd4' : T.textMuted, fontSize: 12, cursor: 'pointer', backgroundColor: selSubs.size === 0 ? T.activeItemBg : 'transparent' }}>
                All
              </DropdownMenuItem>
              {subcats.map(s => (
                <DropdownMenuItem key={s} closeOnClick={false}
                  onClick={() => setSelSubs(prev => { const next = new Set(prev); next.has(s) ? next.delete(s) : next.add(s); return next })}
                  style={{ color: selSubs.has(s) ? '#00bcd4' : T.textMuted, fontSize: 12, cursor: 'pointer', backgroundColor: selSubs.has(s) ? T.activeItemBg : 'transparent' }}>
                  {selSubs.has(s) ? '✓ ' : ''}{s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          )}
        </DropdownMenu>

        {/* Reset */}
        <button onClick={handleReset} style={{
          background: 'none', border: `1px solid ${T.inputBorder}`, color: T.textMuted,
          fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
        }}>Reset</button>

        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textDim }}>
          {rows.length} products
        </span>

        {!isLocalUSD && (
          <button
            onClick={() => setShowUSD(s => !s)}
            title={showUSD ? `Switch to ${currency.code}` : 'Switch to USD'}
            style={{
              background: 'none', border: `1px solid ${showUSD ? '#00bcd4' : T.inputBorder}`,
              color: showUSD ? '#00bcd4' : T.textMuted,
              fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
              flexShrink: 0, transition: 'all 0.15s',
            }}
          >
            {showUSD ? `${currency.symbol} ${currency.code}` : '$ USD'}
          </button>
        )}
      </div>

      {/* ── Table + Drawer ── */}
      <style>{`
        .inv-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .inv-scroll::-webkit-scrollbar-track { background: ${T.panelBg}; }
        .inv-scroll::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
        .inv-scroll::-webkit-scrollbar-thumb:hover { background: #00bcd4; }
        .inv-scroll::-webkit-scrollbar-corner { background: ${T.panelBg}; }
        .inv-row:hover td { background-color: ${T.rowHover} !important; }
      `}</style>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <div ref={scrollRef} className="inv-scroll" onScroll={handleScroll} style={{ position: 'absolute', inset: 0, overflow: 'auto', scrollbarWidth: 'thin', scrollbarColor: `${T.border} ${T.panelBg}` }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', width: '100%' }}>
          <TableHeader className="[&_tr]:border-0">
            <TableRow className="border-0 hover:bg-transparent">
              {displayCols.map(col => {
                const active        = sortCol === col.key
                const nsIdx         = col.sticky ? null : colOrder.indexOf(col.key)
                const isDragging    = nsIdx !== null && dragColIdx === nsIdx
                const isOver        = nsIdx !== null && overColIdx === nsIdx && dragColIdx !== nsIdx
                const isPressed     = nsIdx !== null && pressedColIdx === nsIdx
                const dragProps     = col.sticky ? {} : {
                  draggable: true,
                  onMouseDown: () => setPressedColIdx(nsIdx),
                  onMouseUp:   () => setPressedColIdx(null),
                  onDragStart: e => handleColDragStart(e, nsIdx),
                  onDragOver:  e => handleColDragOver(e, nsIdx),
                  onDrop:      e => handleColDrop(e, nsIdx),
                  onDragEnd:   handleColDragEnd,
                }
                return (
                  <TableHead key={col.key} onClick={() => handleSort(col.key)}
                    style={{
                      ...hdrCell(col),
                      cursor:  col.sticky ? 'pointer' : 'grab',
                      opacity: isDragging ? 0.35 : 1,
                      boxShadow: isOver ? 'inset 0 0 0 2px #00bcd4' : 'none',
                      transition: 'opacity 0.15s, box-shadow 0.1s',
                    }}
                    onMouseEnter={col.tooltip ? e => setTooltip({ text: col.tooltip, x: e.clientX, y: e.clientY }) : undefined}
                    onMouseMove={col.tooltip ? e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : t) : undefined}
                    onMouseLeave={col.tooltip ? () => setTooltip(null) : undefined}
                    {...dragProps}
                  >
                    <span style={{
                      display: 'inline-block',
                      padding: '0 0 2px 0',
                      fontSize: 11,
                      // was: active ? 700 : 400 — light mode gets 600 base for readable headers
                      fontWeight: active ? 700 : isDark ? 400 : 600,
                      color: active ? T.tabActive : isPressed ? T.textDim : T.textMuted,
                      borderBottom: active ? `1px solid ${T.tabActive}` : `1px solid ${T.border}`,
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap',
                    }}>
                      {colLabel(col)}{col.tooltip && <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.5 }}>ⓘ</span>}
                    </span>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr:last-child]:border-0">
            {rows.map((row, rowIdx) => (
              <TableRow key={row.sku} className="inv-row border-0 hover:bg-transparent"
                onClick={() => setSelectedSku(s => s === row.sku ? null : row.sku)}
                style={{ cursor: 'pointer' }}
              >
                {displayCols.map(col => {
                  const v = row[col.key]
                  let cellColor = null
                  let cellBg    = null
                  if (col.key === 'wos') {
                    cellColor = wosColor(v)
                    cellBg    = wosBg(v, isDark)
                  } else if (col.key === 'gmPct') {
                    cellColor = gmColor(v)
                  } else if (col.key === 'fillRate') {
                    cellColor = fillColor(v)
                  }
                  const hLine     = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
                  const vLine     = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
                  const isSelected = selectedSku === row.sku
                  const stripe    = !cellBg && !isSelected && rowIdx % 2 === 1
                    ? (isDark ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.018)')
                    : null
                  const selectedBg = isSelected ? (isDark ? 'rgba(0,188,212,0.12)' : 'rgba(0,188,212,0.09)') : null
                  return (
                    <TableCell key={col.key} style={{
                      position:        col.sticky ? 'sticky' : undefined,
                      left:            col.sticky ? STICKY_LEFT_MAP[col.key] + 'px' : undefined,
                      zIndex:          col.sticky ? 2 : 0,
                      backgroundColor: selectedBg ?? cellBg ?? stripe ?? T.panelBg,
                      borderBottom:    `1px solid ${hLine}`,
                      borderRight:     `1px solid ${vLine}`,
                      padding:         '0 6px',
                      height:          33,
                      textAlign:       col.align,
                      fontSize:        11,
                      color:           cellColor ?? (col.sticky ? T.text : T.textMuted),
                      whiteSpace:      'nowrap',
                      minWidth:        col.width,
                      width:           col.sticky ? col.width : undefined,
                      boxSizing:       'border-box',
                      verticalAlign:   'middle',
                    }}>
                      {fmt(v, col.key, currency, showUSD)}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
            }
          </TableBody>
        </table>
      </div>
      <AiInsightDrawer row={selectedRow} country={country} T={T} isDark={isDark} onClose={() => setSelectedSku(null)} />
      </div>
    </div>

    {showScrollTop && (
      <button
        onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        style={{
          position: 'fixed', bottom: 28, right: 63, zIndex: 9998,
          width: 31, height: 31, borderRadius: 7,
          background: '#0d2f3f', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)', opacity: 0.8,
          transition: 'background 0.15s, transform 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#164055'; e.currentTarget.style.opacity = '1' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#0d2f3f'; e.currentTarget.style.opacity = '0.8' }}
        title="Back to top"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
          <polyline points="4,13 10,7 16,13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    )}


    {tooltip && (
      <div style={{
        position:     'fixed',
        left:         tooltip.x > window.innerWidth * 0.6 ? undefined : tooltip.x + 12,
        right:        tooltip.x > window.innerWidth * 0.6 ? window.innerWidth - tooltip.x + 12 : undefined,
        top:          tooltip.y + 16,
        zIndex:       9999,
        background:   isDark ? '#2a2a2a' : '#fff',
        border:       `1px solid ${T.border}`,
        borderRadius: 6,
        padding:      '7px 10px',
        pointerEvents:'none',
        boxShadow:    '0 4px 12px rgba(0,0,0,0.25)',
        maxWidth:     240,
      }}>
        {tooltip.text.split('\n').map((line, i) => (
          <div key={i} style={{
            fontSize:   i === 0 ? 12 : 11,
            fontWeight: i === 0 ? 600 : 400,
            color:      i === 0 ? T.text : T.textMuted,
            lineHeight: '1.5',
          }}>{line}</div>
        ))}
      </div>
    )}
    </>
  )
}
