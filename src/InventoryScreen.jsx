import { useState, useMemo, useRef, useEffect } from 'react'
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
import { Sun, Download } from 'lucide-react'
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

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'detail',    label: 'Unit Sales' },
  { id: 'geo',       label: 'Geo' },
  { id: 'inventory', label: 'Inventory' },
]

export default function InventoryScreen({
  theme, T, country, selectedCities, countries, cities,
  onCountryChange, onLocationChange, dateRange, onDateRangeChange,
  setView, onThemeToggle,
  activeUser, onUserSwitch,
}) {
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

  function handleScroll(e) {
    const el = e.currentTarget
    const pct = el.scrollTop / (el.scrollHeight - el.clientHeight)
    setShowScrollTop(pct >= 0.9)
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
  const subLabel  = selSubs.size  === 0 ? 'All' : selSubs.size  === 1 ? [...selSubs][0]  : `${selSubs.size} Subs`

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
      : 'Multiple'

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
    backgroundColor: isDark ? '#1c1c1c' : '#f5f5f5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  const hdrCell = (col) => ({
    position:        'sticky',
    top:             0,
    left:            col.sticky ? STICKY_LEFT_MAP[col.key] + 'px' : undefined,
    zIndex:          col.sticky ? 4 : 3,
    backgroundColor: T.navBg,
    borderBottom:    `1.5px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.13)'}`,
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
      <div style={{ backgroundColor: T.navBg, borderBottom: `1px solid ${T.border}`, height: 48, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: '0.02em' }}>WarehouseIQ</span>
        <span style={{ color: T.sep, fontSize: 12 }}>|</span>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setView(tab.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: tab.id === 'inventory' ? 700 : 400,
            color: tab.id === 'inventory' ? '#00bcd4' : T.textMuted,
            borderBottom: tab.id === 'inventory' ? '2px solid #00bcd4' : '2px solid transparent',
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
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

          <Button variant="outline" size="icon" onClick={onThemeToggle} title={isDark ? 'Light mode' : 'Dark mode'} style={{ width:28, height:28, borderRadius:7, border:`1px solid ${T.inputBorder}`, backgroundColor: isDark ? '#1c1c1c' : '#f5f5f5' }}>
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

      {/* ── Table ── */}
      <style>{`
        .inv-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .inv-scroll::-webkit-scrollbar-track { background: ${T.panelBg}; }
        .inv-scroll::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
        .inv-scroll::-webkit-scrollbar-thumb:hover { background: #00bcd4; }
        .inv-scroll::-webkit-scrollbar-corner { background: ${T.panelBg}; }
        .inv-row:hover td { background-color: ${T.rowHover} !important; }
      `}</style>
      <div ref={scrollRef} className="inv-scroll" onScroll={handleScroll} style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'thin', scrollbarColor: `${T.border} ${T.panelBg}` }}>
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
                      fontWeight: active ? 700 : 400,
                      color: active ? '#00bcd4' : isPressed ? T.textDim : T.textMuted,
                      borderBottom: active ? '1px solid #00bcd4' : `1px solid ${T.border}`,
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
              <TableRow key={row.sku} className="inv-row border-0 hover:bg-transparent">
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
                  const hLine   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
                  const vLine   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
                  const stripe  = !cellBg && rowIdx % 2 === 1
                    ? (isDark ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.018)')
                    : null
                  return (
                    <TableCell key={col.key} style={{
                      position:        col.sticky ? 'sticky' : undefined,
                      left:            col.sticky ? STICKY_LEFT_MAP[col.key] + 'px' : undefined,
                      zIndex:          col.sticky ? 2 : 0,
                      backgroundColor: cellBg ?? stripe ?? T.panelBg,
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
    </div>

    {showScrollTop && (
      <button
        onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        style={{
          position: 'fixed', bottom: 28, right: 63, zIndex: 9998,
          width: 44, height: 44, borderRadius: 10,
          background: '#1e2d5a', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
          transition: 'background 0.15s, transform 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#2a3f7a'}
        onMouseLeave={e => e.currentTarget.style.background = '#1e2d5a'}
        title="Back to top"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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
