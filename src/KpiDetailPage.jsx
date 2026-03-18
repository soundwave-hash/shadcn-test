import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowUpDown, Sun, Download } from 'lucide-react'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// ── Theme tokens ───────────────────────────────────────────────────────────────
const THEME = {
  dark: {
    bg: '#111', navBg: '#161616', panelBg: '#1c1c1c',
    border: '#2a2a2a', borderLight: '#1a1a1a',
    text: '#fff', textMuted: '#aaa', textDim: '#555', textFaint: '#444',
    inputBg: '#252525', inputBorder: '#3a3a3a', inputText: '#ddd',
    dropdownBg: '#1e1e1e', dropdownBorder: '#333',
    rowHover: '#1e2a2a', chartMask: '#1c1c1c', chartGrid: '#1e1e1e',
    cardBg: '#181818', cardBorder: '#222',
    axTick: '#666', tooltipBg: '#1a1a1a', tooltipBorder: '#3a3a3a',
    activeItemBg: '#1a2a2a', sep: '#555',
  },
  light: {
    bg: '#dcdfe3', navBg: '#f9fafb', panelBg: '#f9fafb',
    border: '#dde1e7', borderLight: '#e4e7eb',
    text: '#111', textMuted: '#555', textDim: '#888', textFaint: '#aaa',
    inputBg: '#eef0f3', inputBorder: '#dde1e7', inputText: '#333',
    dropdownBg: '#f9fafb', dropdownBorder: '#dde1e7',
    rowHover: '#e0eff5', chartMask: '#f4f5f7', chartGrid: '#e4e7eb',
    cardBg: '#f9fafb', cardBorder: '#dde1e7',
    axTick: '#888', tooltipBg: '#f9fafb', tooltipBorder: '#dde1e7',
    activeItemBg: '#d8eef4', sep: '#bbb',
  },
}

const PERIODS = ['1D','5D','1M','6M','YTD']

const STATUS_C = { good:'#4caf50', watch:'#ff9800', low:'#f44336' }

// ── Grocery leaderboard data (20 items) ───────────────────────────────────────
// Inventory is sized to give a realistic spread of WoS across the 20 items:
//   Good (≥8 wks): Eggs, Whole Milk, Chicken, Pasta, Ground Beef, Tortillas
//   Watch (4–8 wks): Sourdough, Cheddar, White Rice, Strawberries, Frozen Pizza, Sour Cream, Cream Cheese, Cereal
//   Low  (<4 wks): Bananas, Russet Potatoes, Greek Yogurt, OJ, Butter, Baby Spinach
const BASE_ITEMS = [
  { name:'Bananas (lb)',        dailyAvg:1820, inventory: 38200 }, // ~3.0 wks → Low
  { name:'Eggs (12pk)',         dailyAvg:1560, inventory: 98300 }, // ~9.0 wks → Good
  { name:'Whole Milk (gal)',    dailyAvg:1240, inventory: 69400 }, // ~8.0 wks → Good
  { name:'Russet Potatoes',     dailyAvg: 920, inventory: 22100 }, // ~3.4 wks → Low
  { name:'Chicken Breast',      dailyAvg: 842, inventory: 47200 }, // ~8.0 wks → Good
  { name:'Sourdough Bread',     dailyAvg: 680, inventory: 21400 }, // ~4.5 wks → Watch
  { name:'Greek Yogurt',        dailyAvg: 620, inventory: 15500 }, // ~3.6 wks → Low
  { name:'Pasta (16oz)',        dailyAvg: 440, inventory: 34300 }, // ~11.2 wks → Good
  { name:'Cheddar Cheese',      dailyAvg: 380, inventory: 14900 }, // ~5.6 wks → Watch
  { name:'White Rice (5lb)',    dailyAvg: 290, inventory: 10200 }, // ~5.0 wks → Watch
  { name:'Orange Juice (64oz)', dailyAvg: 760, inventory: 14400 }, // ~2.7 wks → Low
  { name:'Ground Beef (1lb)',   dailyAvg: 510, inventory: 31600 }, // ~8.9 wks → Good
  { name:'Butter (1lb)',        dailyAvg: 340, inventory:  7800 }, // ~3.3 wks → Low
  { name:'Baby Spinach (5oz)',  dailyAvg: 270, inventory:  4600 }, // ~2.4 wks → Low
  { name:'Strawberries (1lb)',  dailyAvg: 890, inventory: 42700 }, // ~6.9 wks → Watch
  { name:'Frozen Pizza',        dailyAvg: 460, inventory: 18200 }, // ~5.6 wks → Watch
  { name:'Sour Cream (16oz)',   dailyAvg: 210, inventory: 11200 }, // ~7.6 wks → Watch
  { name:'Cream Cheese (8oz)',  dailyAvg: 195, inventory:  9400 }, // ~6.9 wks → Watch
  { name:'Tortillas (20ct)',    dailyAvg: 330, inventory: 25400 }, // ~11.0 wks → Good
  { name:'Cereal (18oz)',       dailyAvg: 175, inventory:  6100 }, // ~5.0 wks → Watch
]

const PERIOD_SCALE = { '1D':1.0, '5D':1.02, '1M':0.98, '6M':0.92, 'YTD':0.88 }

// Cumulative days per period — makes leaderboard unit sales match the chart's total
const PERIOD_DAYS = { '1D': 1, '5D': 5, '1M': 30, '6M': 182, 'YTD': 300 }

// Inventory scale factors by country — controls WoS and thus health score
const COUNTRY_INV_SCALE = {
  'United States': 1.5,   // ~55% At Risk
  'Canada':        2.5,   // ~85% Healthy
  'Mexico':        0.8,   // ~10% Critical
  'Germany':       2.0,   // ~70% Healthy
  'Japan':         3.0,   // ~95% Healthy
  'Korea':         1.2,   // ~30% At Risk
  'China':         0.65,  // ~0%  Critical
}

// Country-level unit sales scale relative to US baseline
const COUNTRY_SALES_SCALE = {
  'United States': 1.00,  // baseline
  'Canada':        0.20,  // -80%
  'Mexico':        0.10,  // -110%
  'Germany':       0.10,  // -110%
  'Japan':         0.05,  // -200%
  'Korea':         0.02,  // -300%
  'China':         3.50,  // +250%
}

// City-level fraction of country inventory (values sum to ~1.0 per country)
const CITY_INV_SCALE = {
  'United States': { All:1.0, 'New York':0.20, 'Los Angeles':0.17, 'Chicago':0.16, 'Houston':0.19, 'Phoenix':0.14, 'Philadelphia':0.14 },
  'Canada':        { All:1.0, 'Toronto':0.30,  'Vancouver':0.20,   'Montreal':0.22,'Calgary':0.12,  'Ottawa':0.09,   'Edmonton':0.07  },
  'Mexico':        { All:1.0, 'Mexico City':0.32,'Guadalajara':0.22,'Monterrey':0.16,'Puebla':0.14, 'Tijuana':0.09,  'León':0.07      },
  'Germany':       { All:1.0, 'Berlin':0.20,   'Munich':0.22,      'Hamburg':0.17, 'Frankfurt':0.19,'Cologne':0.12,  'Stuttgart':0.10 },
  'Japan':         { All:1.0, 'Tokyo':0.35,    'Osaka':0.26,       'Nagoya':0.13,  'Sapporo':0.11,  'Fukuoka':0.09,  'Kyoto':0.06    },
  'Korea':         { All:1.0, 'Seoul':0.42,    'Busan':0.22,       'Incheon':0.14, 'Daegu':0.11,    'Gwangju':0.06,  'Daejeon':0.05  },
  'China':         { All:1.0, 'Beijing':0.19,  'Shanghai':0.22,    'Guangzhou':0.18,'Shenzhen':0.15,'Chengdu':0.15,  'Wuhan':0.11    },
}

function getInvScale(country, location) {
  const c = COUNTRY_INV_SCALE[country] ?? 1
  const l = CITY_INV_SCALE[country]?.[location] ?? 1
  return c * l
}

function buildLeaderboard(period, sortField, sortAsc, invScale = 1, salesScale = 1) {
  const days = PERIOD_DAYS[period] || 1
  const rows = BASE_ITEMS.map(item => {
    const avgSales  = Math.round(item.dailyAvg * days * salesScale)
    const scaledInv = item.inventory * invScale
    const wos       = parseFloat((scaledInv / (item.dailyAvg * 7)).toFixed(1))
    const status    = wos >= 8 ? 'good' : wos >= 4 ? 'watch' : 'low'
    return { name:item.name, avgSales, inventory:Math.round(scaledInv), wos, status }
  })
  const key = sortField === 'wos' ? 'wos' : sortField === 'inventory' ? 'inventory' : 'avgSales'
  return [...rows].sort((a, b) => sortAsc ? a[key] - b[key] : b[key] - a[key])
}

// ── Number helpers ─────────────────────────────────────────────────────────────
function parseNum(str) {
  if (!str) return 0
  const s = String(str).replace(/,/g,'').trim()
  if (s.endsWith('M')) return parseFloat(s)*1e6
  if (s.endsWith('K')) return parseFloat(s)*1e3
  return parseFloat(s)||0
}
function fmtNum(n, template) {
  const t = String(template||n).replace(/,/g,'').trim()
  if (t.endsWith('M')) return `${(n/1e6).toFixed(2)}M`
  if (t.endsWith('K')) return `${(n/1e3).toFixed(2)}K`
  const dec = t.includes('.') ? t.split('.')[1].length : 0
  return n.toFixed(dec)
}
function fmtWhole(n) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
function scaleStr(str, scale) {
  if (!str || scale===1) return str
  return fmtNum(parseNum(str)*scale, str)
}

// ── Time-series data ───────────────────────────────────────────────────────────
const _MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const _TODAY  = new Date()
function _daysBack(n) { const d = new Date(_TODAY); d.setDate(d.getDate() - n); return d }
function _fmtDate(d)  { return `${_MONTHS[d.getMonth()]} ${d.getDate()}` }
function _fmt12h(i)   { if (i === 0) return '12 AM'; if (i < 12) return `${i} AM`; if (i === 12) return '12 PM'; return `${i - 12} PM` }

// Current-position labels used for axis highlight
const CURRENT_LABEL_1D  = _fmt12h(_TODAY.getHours())
const CURRENT_LABEL_YTD = _MONTHS[_TODAY.getMonth()]

const PERIOD_CFG = {
  '1D':  { count:24, lbl: i => _fmt12h(i) },
  '5D':  { count: 5, lbl: i => _fmtDate(_daysBack(4 - i)) },
  '1M':  { count:30, lbl: i => i % 2 === 0 ? _fmtDate(_daysBack(29 - i)) : '' },
  '6M':  {
    count: 26,
    lbl: i => {
      const d    = _daysBack((25 - i) * 7)
      const prev = _daysBack((26 - i) * 7)
      return (i === 0 || prev.getMonth() !== d.getMonth()) ? _MONTHS[d.getMonth()] : ''
    },
  },
  'YTD': { count:10, lbl: i => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'][i] },
}

function buildSeries(baseValue, period) {
  const { count, lbl } = PERIOD_CFG[period] || PERIOD_CFG['1D']
  return Array.from({ length:count }, (_,i) => {
    const ty = baseValue * (1 + Math.sin(i*0.6)*0.12 + Math.cos(i*0.4)*0.06)
    const ly = baseValue * (0.88 + Math.sin(i*0.5+1.2)*0.10 + Math.cos(i*0.35+0.5)*0.05)
    const thisYear = Math.round(ty*100)/100
    const lastYear = Math.round(ly*100)/100
    return { label:lbl(i), thisYear, lastYear, upper:Math.max(ty,ly), lower:Math.min(ty,ly) }
  })
}

// ── Unit Sales chart — derived from leaderboard totals ────────────────────────
// Total daily units across all 20 leaderboard products
const LEADERBOARD_DAILY_TOTAL = BASE_ITEMS.reduce((s, item) => s + item.dailyAvg, 0)

// Per-period base: scale daily total to the unit of each period bucket
const PERIOD_BUCKET = { '1D': 1/24, '5D': 1, '1M': 1, '6M': 7, 'YTD': 30 }

// Realistic hourly sales shape — low overnight, peak midday, wind-down evening
// Values normalized so their sum = 24 (daily total is preserved)
const _HOURLY_RAW = [
  0.05, 0.03, 0.02, 0.02, 0.04, 0.10,  // 12 AM – 5 AM  (near-zero)
  0.28, 0.55, 0.78, 0.90, 0.97, 1.00,  // 6 AM – 11 AM  (ramp up)
  1.00, 0.98, 0.94, 0.88, 0.84, 0.80,  // 12 PM – 5 PM  (peak, gentle decline)
  0.72, 0.62, 0.48, 0.34, 0.20, 0.11,  // 6 PM – 11 PM  (evening wind-down)
]
const _HOURLY_SUM = _HOURLY_RAW.reduce((s, v) => s + v, 0)
const HOURLY_SHAPE = _HOURLY_RAW.map(v => v / _HOURLY_SUM * 24)

// Per-country wave parameters — each country gets a distinct TY shape and LY relationship
// trend: linear slope per step | f1/f2: wave frequencies | p1/p2: phases | a1/a2: amplitudes
// lyBias: LY multiplier base (>1 = LY > TY = declining; <1 = TY > LY = growing)
const COUNTRY_WAVE_PARAMS = {
  'United States': { trend: 0.000, f1:0.50, p1:0.0, a1:0.08, f2:1.30, p2:0.8, a2:0.04, lyBias:1.03, lyAmp:0.05, lyF:0.70 },
  'China':         { trend: 0.055, f1:0.20, p1:2.0, a1:0.35, f2:0.60, p2:1.5, a2:0.18, lyBias:0.68, lyAmp:0.12, lyF:0.35 },
  'Japan':         { trend:-0.045, f1:1.40, p1:0.5, a1:0.18, f2:2.80, p2:1.2, a2:0.10, lyBias:1.22, lyAmp:0.08, lyF:1.20 },
  'Korea':         { trend: 0.015, f1:2.20, p1:1.0, a1:0.28, f2:3.80, p2:0.3, a2:0.16, lyBias:0.92, lyAmp:0.22, lyF:2.00 },
  'Germany':       { trend:-0.025, f1:0.90, p1:3.2, a1:0.13, f2:1.80, p2:0.6, a2:0.07, lyBias:1.14, lyAmp:0.04, lyF:0.85 },
  'Canada':        { trend: 0.008, f1:0.65, p1:1.5, a1:0.11, f2:1.90, p2:2.8, a2:0.06, lyBias:1.06, lyAmp:0.09, lyF:0.55 },
  'Mexico':        { trend:-0.035, f1:1.60, p1:0.8, a1:0.22, f2:3.20, p2:2.1, a2:0.14, lyBias:1.28, lyAmp:0.17, lyF:1.50 },
}

function buildUnitSalesSeries(period, cityScale, dailyTotal = LEADERBOARD_DAILY_TOTAL, country = 'United States') {
  const { count, lbl } = PERIOD_CFG[period] || PERIOD_CFG['1D']
  if (!dailyTotal) {
    return Array.from({ length:count }, (_, i) => ({ label:lbl(i), thisYear:0, lastYear:0, upper:0, lower:0 }))
  }
  // Keep shapeBase as float (no early rounding) so LY precision is preserved at small scales
  const shapeBase = dailyTotal * (PERIOD_BUCKET[period] ?? 1)
  const scale = cityScale || 1
  const p = COUNTRY_WAVE_PARAMS[country] || COUNTRY_WAVE_PARAMS['United States']
  return Array.from({ length:count }, (_, i) => {
    const trend   = Math.max(0.15, 1 + p.trend * i)   // floor at 0.15 prevents negative collapse
    const wave    = 1 + Math.sin(i * p.f1 + p.p1) * p.a1 + Math.cos(i * p.f2 + p.p2) * p.a2
    const diurnal = period === '1D' ? HOURLY_SHAPE[i] : 1  // realistic hourly shape for 1D
    const tyRaw   = shapeBase * trend * wave * diurnal
    const lyR     = p.lyBias + Math.sin(i * p.lyF + 1.0) * p.lyAmp
    const lyRaw   = tyRaw * lyR                        // derive LY from float tyRaw, not rounded ty
    const ty      = Math.max(0, Math.round(tyRaw * scale))
    const ly      = Math.max(0, Math.round(lyRaw * scale))
    return { label:lbl(i), thisYear:ty, lastYear:ly, upper:Math.max(ty,ly), lower:Math.min(ty,ly) }
  })
}

// ── Gradient helpers ──────────────────────────────────────────────────────────
// Low (0) = soft green #69f0ae  →  High (1) = soft magenta #ea80fc
function lerp(a, b, t) { return a + (b - a) * t }
function gradientColor(pct) {
  const p = Math.max(0, Math.min(1, pct))
  const r = Math.round(lerp(105, 234, p))
  const g = Math.round(lerp(240, 128, p))
  const b = Math.round(lerp(174, 252, p))
  const a = (0.15 + p * 0.30).toFixed(2)
  return `rgba(${r},${g},${b},${a})`
}

const MAX_SALES = Math.max(...BASE_ITEMS.map(i=>i.dailyAvg))
const MAX_INV   = Math.max(...BASE_ITEMS.map(i=>i.inventory))
const MAX_WOS   = Math.max(...BASE_ITEMS.map(i => i.inventory / (i.dailyAvg * 7)))

// ── SVG Gauge ─────────────────────────────────────────────────────────────────
// Slight metric variation per period (longer periods smooth out spikes)
const METRIC_PERIOD_SCALE = { '1D':1.0, '5D':0.97, '1M':1.04, '6M':0.93, 'YTD':0.90 }

function MetricGauge({ period, invScale, checked, T }) {
  const cx=130, cy=130, r=90, sw=22

  const rows = useMemo(() => {
    const all = buildLeaderboard(period, 'wos', true, invScale)
    return checked.size === 0 ? [] : checked.size === BASE_ITEMS.length ? all : all.filter(r => checked.has(r.name))
  }, [period, invScale, checked])
  const totalSales = rows.reduce((s, r) => s + r.avgSales, 0)
  const goodSales  = rows.filter(r => r.status === 'good').reduce((s, r) => s + r.avgSales, 0)
  const weightedPct = totalSales === 0 ? 0 : goodSales / totalSales
  const targetPct  = rows.length === 0 ? 0.06 : Math.min(0.94, Math.max(0.06, weightedPct))

  // Arc color: red → amber → green based on health score
  const arcColor = targetPct >= 0.67 ? '#4caf50' : targetPct >= 0.34 ? '#ff9800' : '#f44336'

  // Animate needle
  const animRef    = useRef(null)
  const currentRef = useRef(targetPct)
  const [pct, setPct] = useState(targetPct)

  useEffect(() => {
    const startVal = currentRef.current
    const endVal   = targetPct
    const duration = 700
    const startTime = performance.now()
    if (animRef.current) cancelAnimationFrame(animRef.current)
    function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t }
    function step(now) {
      const t = Math.min(1, (now - startTime) / duration)
      const curr = startVal + (endVal - startVal) * easeInOut(t)
      currentRef.current = curr
      setPct(curr)
      if (t < 1) animRef.current = requestAnimationFrame(step)
    }
    animRef.current = requestAnimationFrame(step)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [targetPct])

  function pt(p) {
    const a = p * Math.PI
    return { x: +(cx - r*Math.cos(a)).toFixed(2), y: +(cy - r*Math.sin(a)).toFixed(2) }
  }
  function arc(p1, p2) {
    const f=pt(p1), t=pt(p2)
    const span=(p2-p1)*180
    return `M ${f.x} ${f.y} A ${r} ${r} 0 ${span>180?1:0} 1 ${t.x} ${t.y}`
  }

  const tickAngle = pct * Math.PI
  const tx1 = +(cx - r*0.80*Math.cos(tickAngle)).toFixed(2)
  const ty1 = +(cy - r*0.80*Math.sin(tickAngle)).toFixed(2)
  const tx2 = +(cx - r*1.08*Math.cos(tickAngle)).toFixed(2)
  const ty2 = +(cy - r*1.08*Math.sin(tickAngle)).toFixed(2)

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%' }}>
      <svg width="100%" viewBox="0 0 260 148" style={{ maxWidth:320 }}>
        {/* Track */}
        <path d={arc(0,1)} fill="none" stroke={T.border} strokeWidth={sw+4} strokeLinecap="round"/>
        {/* Filled */}
        <path d={arc(0,pct)} fill="none" stroke={arcColor} strokeWidth={sw} strokeLinecap="round"/>
        {/* Min / Max labels */}
        <text x={cx-r-2} y={cy+18} fill="#fff" fontSize={10} textAnchor="middle">0%</text>
        <text x={cx+r+2} y={cy+18} fill="#fff" fontSize={10} textAnchor="middle">100%</text>
        {/* Score */}
        <text x={cx} y={cy-14} fill={arcColor} fontSize={34} fontWeight={700} textAnchor="middle" dominantBaseline="middle">
          {rows.length === 0 ? '—' : `${Math.round(pct*100)}%`}
        </text>
        <text x={cx} y={cy+12} fill="#fff" fontSize={11} textAnchor="middle">Inventory Health</text>
      </svg>
    </div>
  )
}

// ── Custom cursor — extends 20px above the plot area ───────────────────────────
function ExtendedCursor({ x, y, height }) {
  if (x == null) return null
  return (
    <line x1={x} y1={y - 20} x2={x} y2={y + height}
      stroke="#444" strokeWidth={1} strokeDasharray="4 3" />
  )
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, template, ttipStyle }) {
  if (!active || !payload?.length) return null
  const ty = payload.find(p=>p.dataKey==='thisYear')?.value
  const ly = payload.find(p=>p.dataKey==='lastYear')?.value
  if (ty==null) return null
  const delta = ly!=null ? ty-ly : null
  return (
    <div style={{ ...(ttipStyle||{}), padding:'8px 12px', minWidth:148 }}>
      <div style={{ fontSize:10, marginBottom:6, opacity:0.7 }}>{label}</div>
      <div style={{ color:'#00bcd4', fontSize:12 }}>This Year: <strong>{fmtNum(ty, template)}</strong></div>
      {ly!=null && <>
        <div style={{ color:'#ff9800', fontSize:12 }}>Last Year: <strong>{fmtNum(ly, template)}</strong></div>
        {delta!=null && (
          <div style={{ color:delta>=0?'#f44336':'#4caf50', fontSize:11, fontWeight:600, marginTop:4 }}>
            {delta>=0?'+':''}{fmtNum(delta, template)} vs LY
          </div>
        )}
      </>}
    </div>
  )
}

// ── Leaderboard ────────────────────────────────────────────────────────────────
function Leaderboard({ period, invScale, salesScale, checked, onCheckedChange, T }) {
  const setChecked = onCheckedChange
  const [sortField, setSortField] = useState('wos')
  const [sortAsc, setSortAsc]     = useState(true)   // WOS asc = worst first by default
  const [hovered, setHovered]     = useState(null)   // row hover
  const [hovCol, setHovCol]       = useState(null)   // column header hover

  const rows     = useMemo(() => buildLeaderboard(period, sortField, sortAsc, invScale, salesScale), [period, sortField, sortAsc, invScale, salesScale])
  const maxSales = Math.max(...rows.map(r => r.avgSales))

  const allChecked  = rows.length > 0 && rows.every(r => checked.has(r.name))
  const someChecked = !allChecked && rows.some(r => checked.has(r.name))

  const toggle    = name => setChecked(prev => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next })
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(rows.map(r => r.name)))

  function handleColSort(field) {
    if (sortField === field) setSortAsc(a => !a)
    else { setSortField(field); setSortAsc(field === 'wos') } // WOS defaults asc, others desc
  }

  const colHeaders = [
    { label:'Items',      field: null },
    { label:'Unit Sales', field:'sales' },
    { label:'Inventory',  field:'inventory' },
    { label:'WoS',        field:'wos' },
  ]

  return (
    <div style={{ backgroundColor:T.panelBg, border:`1px solid ${T.border}`, borderRadius:8, padding:'12px 10px', display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ marginBottom:10, flexShrink:0 }}>
        <span style={{ fontSize:12, fontWeight:700, color: T.text }}>Product Leaderboard</span>
      </div>

      {/* Column headers */}
      <div style={{ display:'grid', gridTemplateColumns:'14px 1fr 60px 60px 44px', gap:'0 6px', padding:'3px 2px 5px', borderBottom:`1px solid ${T.border}`, flexShrink:0, alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center' }}>
          <input
            type="checkbox"
            checked={allChecked}
            ref={el => { if (el) el.indeterminate = someChecked }}
            onChange={toggleAll}
            style={{ cursor:'pointer', width:12, height:12 }}
          />
        </div>
        {colHeaders.map(({ label, field }) => {
          const active  = field && sortField === field
          const isHov   = field && hovCol === field
          const color   = active ? '#00bcd4' : isHov ? '#80cbc4' : T.textDim
          return field ? (
            <button
              key={label}
              onClick={() => handleColSort(field)}
              onMouseEnter={() => setHovCol(field)}
              onMouseLeave={() => setHovCol(null)}
              style={{
                background:'none', border:'none', cursor:'pointer', padding:'0 0 2px 0',
                fontSize:9, color,
                textTransform:'uppercase', letterSpacing:'0.04em',
                textAlign:'center', display:'block', position:'relative', left:-30,
                fontWeight: active ? 700 : 400,
                borderBottom: active ? '1px solid #00bcd4' : '1px solid transparent',
                transition:'color 0.15s',
              }}
            >
              {label}
            </button>
          ) : (
            <span key={label} style={{ fontSize:9, color: T.textDim, textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</span>
          )
        })}
      </div>

      {/* Scrollable rows — paddingRight reserves space so scrollbar never overlaps content */}
      <div style={{ overflowY:'auto', flex:1, marginTop:2, paddingRight:14 }}>
        {rows.map((row,i) => {
          const isChecked = checked.has(row.name)
          const isHovered = hovered===i
          const barW = `${Math.round((row.avgSales/maxSales)*100)}%`
          return (
            <div
              key={row.name}
              onMouseEnter={()=>setHovered(i)}
              onMouseLeave={()=>setHovered(null)}
              style={{
                display:'grid', gridTemplateColumns:'14px 1fr 60px 60px 44px', gap:'0 6px',
                padding:'5px 2px', borderBottom:`1px solid ${T.borderLight}`, alignItems:'center',
                backgroundColor: isHovered ? T.rowHover : 'transparent',
                transition:'background 0.1s',
              }}
            >
              <input
                type="checkbox" checked={isChecked} onChange={()=>toggle(row.name)}
                style={{ cursor:'pointer', width:12, height:12 }}
              />
              {/* Name */}
              <span style={{ fontSize:10, color: T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {row.name}
              </span>
              {/* Unit Sales */}
              <div style={{ textAlign:'center', border:`1px solid ${T.border}`, borderRadius:3, padding:'1px 0' }}>
                <span style={{ fontSize:10, color: T.text, fontVariantNumeric:'tabular-nums' }}>
                  {row.avgSales.toLocaleString()}
                </span>
              </div>
              {/* Inventory */}
              <div style={{ textAlign:'center', border:`1px solid ${T.border}`, borderRadius:3, padding:'1px 0' }}>
                <span style={{ fontSize:10, color: T.text, fontVariantNumeric:'tabular-nums' }}>
                  {row.inventory.toLocaleString()}
                </span>
              </div>
              {/* WoS */}
              {(() => {
                return (
                  <div style={{ textAlign:'center', border:`1px solid ${T.border}`, borderRadius:3, padding:'1px 0' }}>
                    <span style={{ fontSize:10, color: STATUS_C[row.status], fontWeight:600, fontVariantNumeric:'tabular-nums' }}>
                      {row.wos}
                    </span>
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      {/* WoS legend */}
      <div style={{ flexShrink:0, marginTop:8, paddingTop:8, borderTop:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        {[['≥8 wks — Good','good'],['4–8 wks — Watch','watch'],['<4 wks — Low','low']].map(([l,s])=>(
          <span key={l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color: T.text }}>
            <span style={{ width:8, height:8, borderRadius:'50%', backgroundColor:STATUS_C[s], flexShrink:0 }}/>
            {l}
          </span>
        ))}
        <span style={{ fontSize:10, color: T.textDim, marginLeft:'auto' }}>WoS = Weeks of Supply</span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function KpiDetailPage({
  kpi, country, selectedCities = [], cities, cityScales, countries,
  onBack, onCountryChange, onLocationChange,
  theme = 'dark', onThemeToggle,
}) {
  const T = THEME[theme]
  const panel  = { backgroundColor:T.panelBg, border:`1px solid ${T.border}`, borderRadius:8, padding:'14px 16px' }
  const ttip   = { backgroundColor:T.tooltipBg, border:`1px solid ${T.tooltipBorder}`, color:T.text, fontSize:11, borderRadius:6 }
  const axTick = { fill:T.axTick, fontSize:10 }

  const [period, setPeriod]           = useState('1M')
  const [activeTooltip, setActiveTooltip] = useState(null)
  const chartContainerRef = useRef(null)
  const pageRef = useRef(null)

  // ── Export helpers ──
  function exportCSV() {
    const s = buildUnitSalesSeries(period, cityScale, selectedDailyTotal, country)
    const rows = [
      ['Unit Sales Export', `${kpi.label} | ${country} | ${period} | ${new Date().toLocaleString()}`],
      [],
      ['Label', 'This Year', 'Last Year'],
      ...s.map(pt => [pt.label, pt.thisYear ?? '', pt.lastYear ?? '']),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, `warehouseiq-unitsales-${country.replace(/\s+/g, '-').toLowerCase()}-${period}.csv`)
  }

  async function exportPDF() {
    if (!pageRef.current) return
    const canvas = await html2canvas(pageRef.current, { scale: 2, backgroundColor: T.bg, useCORS: true })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 2, canvas.height / 2] })
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
    pdf.save(`warehouseiq-unitsales-${country.replace(/\s+/g, '-').toLowerCase()}-${period}.pdf`)
  }

  async function exportChartPNG() {
    if (!chartContainerRef.current) return
    const canvas = await html2canvas(chartContainerRef.current, { scale: 2, backgroundColor: T.panelBg, useCORS: true })
    canvas.toBlob(blob => saveAs(blob, `warehouseiq-unitsales-chart-${country.replace(/\s+/g, '-').toLowerCase()}-${period}.png`))
  }
  const [checked, setChecked] = useState(() => new Set(BASE_ITEMS.map(i => i.name)))
  const [locationMenuOpen, setLocationMenuOpen] = useState(false)

  const locationLabel = selectedCities.length === 0
    ? 'All'
    : selectedCities.length === 1 ? selectedCities[0] : 'Multiple'

  const countrySalesScale = COUNTRY_SALES_SCALE[country] ?? 1
  const citySalesScale = selectedCities.length === 0
    ? 1
    : selectedCities.reduce((sum, city) => sum + (cityScales[country]?.[city] ?? 0), 0)
  const cityScale = countrySalesScale * citySalesScale
  const invScale = selectedCities.length === 0
    ? getInvScale(country, 'All')
    : selectedCities.reduce((sum, city) => sum + getInvScale(country, city), 0)
  const baseValue = parseNum(kpi.primary) * cityScale

  // When items are checked, sum only those items' daily averages
  const allItemsChecked = checked.size === BASE_ITEMS.length
  const selectedDailyTotal = checked.size === 0
    ? 0
    : allItemsChecked
      ? LEADERBOARD_DAILY_TOTAL
      : BASE_ITEMS.filter(item => checked.has(item.name)).reduce((s, item) => s + item.dailyAvg, 0)

  const checkedLabel = !allItemsChecked && checked.size === 1
    ? [...checked][0]
    : !allItemsChecked && checked.size > 1 ? `${checked.size} items selected` : null

  const series = useMemo(() => {
    const s = kpi.label === 'Unit Sales'
      ? buildUnitSalesSeries(period, cityScale, selectedDailyTotal, country)
      : buildSeries(baseValue, period)
    if (period === '1D') console.log('1D series[0..3]:', s.slice(0,4).map(p => ({label:p.label, ty:p.thisYear, ly:p.lastYear})), '...noon:', {label:s[12]?.label, ty:s[12]?.thisYear})
    return s
  }, [kpi.label, period, cityScale, selectedDailyTotal, baseValue, country])

  // Tight Y-axis domain so line separation is always visible
  const yDomain = useMemo(() => {
    if (!series.length) return [0, 100]
    const vals = series.flatMap(d => [d.thisYear, d.lastYear].filter(v => v != null))
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    if (hi === 0) return [0, 10]   // nothing selected — flat zero line
    const pad = (hi - lo) * 0.4
    return [Math.max(0, Math.floor(lo - pad)), Math.ceil(hi + pad)]
  }, [series])

  // Split thisYear into actual (solid) and forecast (dashed) for periods with a meaningful "now" cutoff
  const seriesDisplay = useMemo(() => {
    if (period === 'YTD') {
      const cutIdx = _TODAY.getMonth()
      return series.map((pt, i) => ({
        ...pt,
        actual:   i <= cutIdx ? pt.thisYear : null,
        forecast: i >= cutIdx ? pt.thisYear : null,
      }))
    }
    if (period === '1D') {
      const cutIdx = _TODAY.getHours()
      return series.map((pt, i) => ({
        ...pt,
        actual:   i <= cutIdx ? pt.thisYear : null,
        forecast: i >= cutIdx ? pt.thisYear : null,
      }))
    }
    // For other periods, include null actual/forecast so recharts data shape stays consistent
    return series.map(pt => ({ ...pt, actual: null, forecast: null }))
  }, [period, series])

  // Inventory health stats for context panel
  const healthRows = useMemo(() => {
    const all = buildLeaderboard(period, 'wos', true, invScale)
    return checked.size === 0 ? [] : allItemsChecked ? all : all.filter(r => checked.has(r.name))
  }, [period, invScale, checked, allItemsChecked])
  const goodItems   = healthRows.filter(r => r.status === 'good')
  const lowItems    = healthRows.filter(r => r.status === 'low').sort((a,b) => a.wos - b.wos)
  const totalSales  = healthRows.reduce((s, r) => s + r.avgSales, 0)
  const _rawPct     = totalSales === 0 ? 0 : goodItems.reduce((s, r) => s + r.avgSales, 0) / totalSales * 100
  const healthPct   = isNaN(_rawPct) ? 0 : Math.round(_rawPct)
  const healthZone = healthPct >= 67 ? 'Healthy' : healthPct >= 34 ? 'At Risk' : 'Critical'
  const healthColor = healthPct >= 67 ? '#4caf50' : healthPct >= 34 ? '#ff9800' : '#f44336'
  const HEALTH_MESSAGES = {
    Healthy: [
      `Carrier on-time performance is tracking at 94%+ this period. Express and ground routes are running on schedule with no significant delay events across the network. Recommendation: Maintain current replenishment cadence and consider opportunistic forward-buying on top 5 SKUs to lock in favorable freight rates before Q3 peak season.`,
      `Fuel surcharges have stabilized at 12.5%, down from 14.2% last quarter. Unit shipping costs are within budget and no carrier rate increases are expected this period. Recommendation: Reallocate $18K in freight savings toward safety stock builds for high-velocity perishables ahead of the summer demand surge.`,
      `No active weather advisories affecting distribution lanes. All major corridors are operating normally with seasonal conditions well within standard parameters. Recommendation: Advance next week's replenishment orders by 2 days to take advantage of open lane capacity and reduce weekend stockout risk on dairy and produce.`,
      `Warehouse throughput is running at 78% utilization — well within optimal range. Dock scheduling is clear and pick-pack cycle times are meeting SLA targets across all active SKUs. Recommendation: Use available dock capacity to pull forward inbound receipts for Eggs and Whole Milk, both trending toward Watch status within 10 days at current velocity.`,
    ],
    'At Risk': [
      `Express carrier capacity is tightening due to elevated regional demand. 12% of shipments are experiencing 1–2 day delays; ground routes are absorbing overflow but slowing last-mile delivery. Recommendation: Expedite replenishment for the 4 lowest WoS items via secondary carrier and notify store ops of likely 48-hour shelf gap on Bananas and Baby Spinach.`,
      `Diesel prices spiked 8% this month, triggering fuel surcharge adjustments from two major carriers. Average shipping cost per unit is up $0.43 versus the prior period. Recommendation: Consolidate the next 3 replenishment runs into 2 combined loads to offset surcharge impact — estimated savings of $2,100 per cycle at current volume.`,
      `A cold front moving through the region is causing intermittent delays on key distribution corridors. 3–5% of shipments are flagged for weather holds; monitoring in progress. Recommendation: Pre-position 3-day buffer stock for OJ and Butter at the regional DC now — both items have less than 4 weeks of supply and are most exposed to delay-driven stockouts.`,
      `Inbound freight volumes are running 18% above forecast, stressing dock scheduling. Overtime has been authorized but throughput delays of 6–12 hours are expected during peak windows. Recommendation: Prioritize dock slots for Russet Potatoes, Greek Yogurt, and OJ — all three are below 4 WoS and cannot absorb further receipt delays without hitting zero stock.`,
    ],
    Critical: [
      `Major carrier disruptions across two primary lanes are resulting in 24–48 hour delays. Priority rerouting has been activated but backlog is growing — 22% of orders are past SLA. Recommendation: Activate emergency replenishment protocol for the 6 items below 2 WoS. Approve air freight for Butter and Baby Spinach immediately — combined SKU revenue at risk exceeds $340K over the next 7 days.`,
      `Emergency freight surcharges are in effect due to capacity shortfalls. Air freight has been authorized for critical SKUs, increasing shipping costs by an estimated 34% above budget. Recommendation: Restrict promotional activity on all low-WoS items this week to slow velocity and extend runway. Coordinate with merchandising to pull circular features on OJ and Greek Yogurt until supply stabilizes.`,
      `Severe weather conditions have suspended ground delivery across key corridors. Recovery is estimated at 4–7 business days pending clearance — expedited routing is strongly advised. Recommendation: Issue a store-level allocation cap of 60% on Bananas, Butter, and Baby Spinach effective immediately to distribute remaining inventory across locations and prevent single-store sellouts.`,
      `Warehouse is operating at 97% capacity with inbound receipts exceeding available storage. Replenishment shipments are staged in overflow facilities, adding 1–2 days to put-away lead times. Recommendation: Escalate to supply chain leadership — current capacity constraints will cause 8 of 20 tracked SKUs to breach zero stock within 5 days without emergency sourcing or demand-side intervention.`,
    ],
  }
  const msgIdx = (country.length + period.length) % 4
  const healthTldr = (HEALTH_MESSAGES[healthZone] ?? HEALTH_MESSAGES.Healthy)[msgIdx]

  const fmtAxis = v => {
    if (v>=1e6) return `${(v/1e6).toFixed(1)}M`
    if (v>=1e3) return `${(v/1e3).toFixed(1)}K`
    return String(Math.round(v))
  }

  const dropBtn = {
    backgroundColor: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.inputText,
    fontSize:12, padding:'4px 10px', borderRadius:4, cursor:'pointer',
    display:'flex', alignItems:'center', gap:6,
  }

  return (
    <div ref={pageRef} style={{ backgroundColor: T.bg, height:'100vh', display:'flex', flexDirection:'column', fontFamily:'Inter, system-ui, sans-serif', color: T.text, overflow:'hidden' }}>

      {/* ── Nav bar ── */}
      <div style={{ backgroundColor: T.navBg, borderBottom:`1px solid ${T.border}`, height:40, display:'flex', alignItems:'center', padding:'0 16px', gap:16, flexShrink:0 }}>
        <span style={{ fontSize:13, fontWeight:700, color: T.text, letterSpacing:'0.02em' }}>WarehouseIQ</span>
        <span style={{ color: T.sep }}>|</span>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'#00bcd4', fontSize:12, cursor:'pointer', padding:0 }}>
          ← Dashboard
        </button>
        <span style={{ color: T.sep }}>|</span>
        <span style={{ fontSize:12, color: T.textMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:300 }}>
          {kpi.label}
        </span>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color: T.textDim }}>Country:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button style={dropBtn}>{country}<span style={{ color: T.textDim, fontSize:10 }}>▼</span></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent style={{ backgroundColor: T.dropdownBg, border:`1px solid ${T.dropdownBorder}`, minWidth:160 }}>
              {countries.map(c=>(
                <DropdownMenuItem key={c} onClick={()=>onCountryChange(c)}
                  style={{ color:c===country?'#00bcd4': T.textMuted, fontSize:12, cursor:'pointer', backgroundColor:c===country? T.activeItemBg:'transparent' }}>
                  {c}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span style={{ fontSize:11, color: T.textDim }}>Location:</span>
          <DropdownMenu open={locationMenuOpen} onOpenChange={setLocationMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button style={dropBtn}>{locationLabel}<span style={{ color: T.textDim, fontSize:10 }}>▼</span></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent style={{ backgroundColor: T.dropdownBg, border:`1px solid ${T.dropdownBorder}`, minWidth:160 }}>
              <DropdownMenuItem
                key="All"
                closeOnClick={false}
                onClick={() => { onLocationChange([]); setLocationMenuOpen(false) }}
                style={{ color: selectedCities.length === 0 ? '#00bcd4' : T.textMuted, fontSize:12, cursor:'pointer', backgroundColor: selectedCities.length === 0 ? T.activeItemBg : 'transparent' }}
              >
                All
              </DropdownMenuItem>
              {cities.filter(c => c !== 'All').map(c => {
                const isSelected = selectedCities.includes(c)
                return (
                  <DropdownMenuItem
                    key={c}
                    closeOnClick={false}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey) {
                        onLocationChange(prev => {
                          const next = prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
                          const allCities = cities.filter(x => x !== 'All')
                          return next.length === allCities.length ? [] : next
                        })
                      } else {
                        onLocationChange([c])
                        setLocationMenuOpen(false)
                      }
                    }}
                    style={{ color: isSelected ? '#00bcd4' : T.textMuted, fontSize:12, cursor:'pointer', backgroundColor: isSelected ? T.activeItemBg : 'transparent' }}
                  >
                    {c}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={onThemeToggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width:28, height:28, borderRadius:7, cursor:'pointer', border:`1px solid ${T.inputBorder}`,
              backgroundColor: theme === 'dark' ? '#1c1c1c' : '#f5f5f5',
              display:'flex', alignItems:'center', justifyContent:'center',
              marginLeft:4,
            }}
          >
            <Sun size={15} color={theme === 'dark' ? '#fff' : '#333'} />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                title="Export data"
                style={{
                  width:28, height:28, borderRadius:7, cursor:'pointer', border:`1px solid ${T.inputBorder}`,
                  backgroundColor: theme === 'dark' ? '#1c1c1c' : '#f5f5f5',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}
              >
                <Download size={15} color={theme === 'dark' ? '#fff' : '#333'} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ backgroundColor: T.dropdownBg, border: `1px solid ${T.dropdownBorder}`, minWidth:180 }}>
              <DropdownMenuItem onClick={exportCSV} style={{ fontSize:12, cursor:'pointer', color: T.textMuted, gap:8 }}>
                <Download size={12} /> Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF} style={{ fontSize:12, cursor:'pointer', color: T.textMuted, gap:8 }}>
                <Download size={12} /> Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportChartPNG} style={{ fontSize:12, cursor:'pointer', color: T.textMuted, gap:8 }}>
                <Download size={12} /> Save Chart as PNG
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <img
            src="/avatar.jpg"
            alt="User account"
            style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', marginLeft:8, border:`1px solid ${T.inputBorder}`, flexShrink:0 }}
          />
        </div>
      </div>

      {/* ── Title bar ── */}
      <div style={{ padding:'8px 16px', borderBottom:`1px solid ${T.borderLight}`, flexShrink:0 }}>
        <div style={{ fontSize:11, color: T.textFaint }}>{selectedCities.length === 0 ? country : selectedCities.length === 1 ? `${country} › ${selectedCities[0]}` : `${country} +${selectedCities.length}`}</div>
        <div style={{ fontSize:16, fontWeight:700, marginTop:1 }}>{kpi.label}</div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex:1, display:'flex', gap:10, padding:'10px 12px', minHeight:0, overflow:'hidden' }}>

        {/* LEFT: Leaderboard */}
        <div style={{ width:340, flexShrink:0, display:'flex', flexDirection:'column' }}>
          <Leaderboard period={period} invScale={invScale} salesScale={cityScale} checked={checked} onCheckedChange={setChecked} T={T}/>
        </div>

        {/* RIGHT: Meter + Chart */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10, minWidth:0 }}>

          {/* Metric Meter */}
          <div style={{ ...panel, display:'flex', alignItems:'flex-start', gap:24, flexShrink:0, padding:'12px 20px' }}>
            <div style={{ flex:'0 0 auto' }}>
              <MetricGauge period={period} invScale={invScale} checked={checked} T={T}/>
            </div>
            <div style={{ flex:1, borderLeft:`1px solid ${T.border}`, paddingLeft:24 }}>
              <div style={{ fontSize:10, color: T.textDim, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Inventory Health Context</div>

              {/* Score badge + TL;DR */}
              <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:10 }}>
                <div style={{ flexShrink:0, width:60, backgroundColor: healthColor+'22', border:`1px solid ${healthColor}`, borderRadius:6, padding:'4px 10px', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:700, color: healthColor }}>{isNaN(healthPct) ? 0 : healthPct}%</div>
                  <div style={{ fontSize:9, color: healthColor, fontWeight:600 }}>{healthZone}</div>
                </div>
                <div style={{ fontSize:12, color: T.textMuted, lineHeight:1.7 }}>
                  {healthTldr.includes('Recommendation:') ? (
                    <>
                      {healthTldr.split('Recommendation:')[0]}
                      <span style={{ fontWeight:700, color: healthColor }}>Recommendation:</span>
                      {healthTldr.split('Recommendation:')[1]}
                    </>
                  ) : healthTldr}
                </div>
              </div>

              {/* At-risk items */}
              {lowItems.length > 0 && (
                <div>
                  <div style={{ fontSize:10, color: T.textDim, marginBottom:4 }}>
                    Lowest supply — action needed
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    {lowItems.slice(0,3).map(item => (
                      <div key={item.name} style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                        <span style={{ color: T.textMuted }}>{item.name}</span>
                        <span style={{ color:'#f44336', fontWeight:600 }}>{item.wos} WOS</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Health range legend */}
              <div style={{ marginTop:12, paddingTop:10, borderTop:`1px solid ${T.border}` }}>
                <div style={{ fontSize:10, color: T.textDim, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Health Ranges</div>
                <div style={{ display:'grid', gridTemplateColumns:'60px auto 1fr', gap:'4px 8px', alignItems:'center' }}>
                  {[
                    ['#4caf50', 'Healthy',  '≥ 67%', 'Most items adequately stocked'],
                    ['#ff9800', 'At Risk',  '34–66%', 'Multiple items running low'],
                    ['#f44336', 'Critical', '< 34%',  'Immediate restocking required'],
                  ].map(([color, label, range, desc]) => (
                    <React.Fragment key={label}>
                      <div style={{ width:60, backgroundColor: label === healthZone ? color+'66' : color+'22', border:`1px solid ${color}`, borderRadius:6, padding:'4px 10px', textAlign:'left' }}>
                        <div style={{ fontSize:9, fontWeight:700, color, lineHeight:1.2 }}>{range}</div>
                      </div>
                      <span style={{ fontSize:10, color, fontWeight:600 }}>{label}</span>
                      <span style={{ fontSize:10, color: T.textFaint }}>{desc}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Line Chart */}
          <div style={{ ...panel, flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
            {/* Chart header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, marginBottom:8 }}>
              <div>
                <span style={{ fontSize:12, fontWeight:600 }}>
                  {kpi.label} — Trend {locationLabel}
                  {checked.size === 1
                    ? `, ${[...checked][0]}`
                    : !allItemsChecked && checked.size > 1
                      ? ` (${checked.size} items selected)`
                      : ''}
                </span>
              </div>
              <div style={{ display:'flex', gap:14, alignItems:'center' }}>
                <div style={{ display:'flex', gap:12 }}>
                  {[
                    ['This Year','#00bcd4','solid'],
                    ['Last Year','#ff9800','dashed'],
                    ...(['YTD','1D'].includes(period) ? [['Forecast','#00bcd4','dotted']] : []),
                  ].map(([l,c,d])=>(
                    <span key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:c }}>
                      <svg width={22} height={10}>
                        <line x1={0} y1={5} x2={22} y2={5} stroke={c} strokeWidth={d==='solid'?2:1.5}
                          strokeDasharray={d==='dashed'?'4 3':d==='dotted'?'3 3':undefined} strokeOpacity={d==='dotted'?0.6:1}/>
                        {d !== 'dotted' && <circle cx={11} cy={5} r={3} fill={c}/>}
                      </svg>
                      {l}
                    </span>
                  ))}
                  <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'#fff' }}>
                    <span style={{ width:18, height:8, backgroundColor:'rgba(0,188,212,0.18)', borderRadius:2, display:'inline-block' }}/>
                    Variance
                  </span>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div ref={chartContainerRef} style={{ flex:1, minHeight:0, position:'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={seriesDisplay}
                  margin={{ top:18, right:16, bottom: period === '1D' ? 40 : 8, left:8 }}
                  onMouseMove={e => {
                    if (e?.activePayload?.length) {
                      const ty = e.activePayload.find(p => ['thisYear','actual','forecast'].includes(p.dataKey))?.value
                      const ly = e.activePayload.find(p=>p.dataKey==='lastYear')?.value
                      setActiveTooltip({ label: e.activeLabel, ty, ly, x: e.activeCoordinate?.x })
                    }
                  }}
                  onMouseLeave={() => setActiveTooltip(null)}
                >
                  <XAxis dataKey="label" stroke={T.border} interval={0} tick={({ x, y, payload }) => {
                    const isNow = (period === '1D'  && payload.value === CURRENT_LABEL_1D)
                               || (period === 'YTD' && payload.value === CURRENT_LABEL_YTD)
                    const angled = period === '1D'
                    return (
                      <text
                        x={x} y={y + 4}
                        textAnchor={angled ? 'end' : 'middle'}
                        fontSize={9}
                        fill={isNow ? '#00bcd4' : T.axTick}
                        fontWeight={isNow ? 700 : 400}
                        transform={angled ? `rotate(-35, ${x}, ${y + 4})` : undefined}
                      >
                        {payload.value}
                      </text>
                    )
                  }}/>
                  <YAxis stroke={T.border} tick={axTick} tickFormatter={fmtAxis} width={46} domain={yDomain}/>
                  <Tooltip content={() => null} cursor={<ExtendedCursor />}/>
                  {/* Shading band — drawn before grid so grid renders on top */}
                  <Area type="monotone" dataKey="upper" fill="rgba(0,188,212,0.15)" stroke="none" fillOpacity={1} isAnimationActive={false} activeDot={false} dot={false} baseValue={yDomain[0]}/>
                  <Area type="monotone" dataKey="lower" fill={T.chartMask}          stroke="none" fillOpacity={1} isAnimationActive={false} activeDot={false} dot={false} baseValue={yDomain[0]}/>
                  {/* Grid on top of fill so lines show through */}
                  <CartesianGrid strokeDasharray="3 3" stroke={T.chartGrid} vertical={false}/>
                  {/* Lines — always render all three; use hide to toggle so recharts doesn't lose track */}
                  <Line type="monotone" dataKey="thisYear" stroke="#00bcd4" strokeWidth={2}
                    dot={{ r:3, fill:'#00bcd4', strokeWidth:0 }} activeDot={{ r:5 }} name="This Year"
                    animationDuration={700} animationEasing="ease-in-out"
                    hide={['YTD','1D'].includes(period)}/>
                  <Line type="monotone" dataKey="actual" stroke="#00bcd4" strokeWidth={2}
                    dot={{ r:3, fill:'#00bcd4', strokeWidth:0 }} activeDot={{ r:5 }} name="This Year"
                    connectNulls={false} animationDuration={700} animationEasing="ease-in-out"
                    hide={!['YTD','1D'].includes(period)}/>
                  <Line type="monotone" dataKey="forecast" stroke="#00bcd4" strokeWidth={1.5}
                    strokeDasharray="4 4" strokeOpacity={0.55}
                    dot={{ r:2.5, fill:'#00bcd4', strokeWidth:0, fillOpacity:0.5 }} activeDot={{ r:4 }} name="Forecast"
                    connectNulls={false} animationDuration={700} animationEasing="ease-in-out"
                    hide={!['YTD','1D'].includes(period)}/>
                  <Line type="monotone" dataKey="lastYear" stroke="#ff9800" strokeWidth={1.5}
                    dot={{ r:2.5, fill:'#ff9800', strokeWidth:0 }} activeDot={{ r:4 }} name="Last Year"
                    animationDuration={700} animationEasing="ease-in-out"/>
                </ComposedChart>
              </ResponsiveContainer>

              {/* Inline overlay labels — float above the highest line at the hovered point */}
              {activeTooltip?.x != null && (() => {
                const { ty, ly, x } = activeTooltip
                const delta = ty != null && ly != null ? ty - ly : null
                const containerH = chartContainerRef.current?.clientHeight ?? 200
                const plotH      = containerH - 8 - 8        // top + bottom margin
                const maxVal     = Math.max(ty ?? 0, ly ?? 0)
                const yFrac      = (maxVal - yDomain[0]) / (yDomain[1] - yDomain[0])
                const yPx        = 8 + plotH * (1 - yFrac)  // pixel Y of the highest line
                const topPx      = Math.max(2, yPx - 73)    // 73px above it; clamp to top
                return (
                  <div style={{
                    position:'absolute', top: topPx, left:x,
                    transform:'translateX(-50%)',
                    pointerEvents:'none',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:1,
                  }}>
                    {ty != null && (
                      <span style={{ fontSize:11, fontWeight:700, color:'#00bcd4', lineHeight:1.3 }}>
                        {fmtWhole(ty)}
                      </span>
                    )}
                    {ly != null && (
                      <span style={{ fontSize:11, fontWeight:600, color:'#ff9800', lineHeight:1.3 }}>
                        {fmtWhole(ly)}
                      </span>
                    )}
                    {delta != null && (
                      <span style={{ fontSize:10, fontWeight:700, lineHeight:1.3, color: delta >= 0 ? '#4caf50' : '#f44336' }}>
                        {delta >= 0 ? '+' : ''}{fmtWhole(delta)}
                      </span>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Period selector */}
            <div style={{ display:'flex', gap:4, justifyContent:'center', paddingTop:10, flexShrink:0 }}>
              {PERIODS.map(p=>(
                <button key={p} onClick={()=>setPeriod(p)} style={{
                  background: p===period ? '#00bcd4' : 'transparent',
                  color:       p===period ? '#111'    : T.textDim,
                  border:     `1px solid #00bcd4`,
                  fontSize:11, padding:'1.5px 0', width:42, textAlign:'center', borderRadius:4, cursor:'pointer',
                  fontWeight:  p===period ? 700 : 400, transition:'all 0.15s',
                }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
