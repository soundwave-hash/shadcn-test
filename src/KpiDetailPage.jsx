import { useState, useMemo, useEffect, useRef } from 'react'
import {
  ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowUpDown, Sun } from 'lucide-react'

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
    bg: '#f0f2f5', navBg: '#ffffff', panelBg: '#ffffff',
    border: '#e0e0e0', borderLight: '#eeeeee',
    text: '#111', textMuted: '#555', textDim: '#888', textFaint: '#aaa',
    inputBg: '#f5f5f5', inputBorder: '#d0d0d0', inputText: '#333',
    dropdownBg: '#ffffff', dropdownBorder: '#e0e0e0',
    rowHover: '#e8f5f5', chartMask: '#f0f2f5', chartGrid: '#e8e8e8',
    cardBg: '#ffffff', cardBorder: '#e0e0e0',
    axTick: '#888', tooltipBg: '#ffffff', tooltipBorder: '#d0d0d0',
    activeItemBg: '#e0f7fa', sep: '#bbb',
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

// City-level multiplier on top of country scale
const CITY_INV_SCALE = {
  'United States': { All:1.0, 'New York':1.30, 'Los Angeles':1.00, 'Chicago':0.70, 'Houston':1.60, 'Phoenix':0.55, 'Philadelphia':0.85 },
  'Canada':        { All:1.0, 'Toronto':0.70,  'Vancouver':1.10,   'Montreal':0.85,'Calgary':1.30,  'Ottawa':0.60,   'Edmonton':1.00  },
  'Mexico':        { All:1.0, 'Mexico City':1.40,'Guadalajara':0.80,'Monterrey':1.10,'Puebla':0.70, 'Tijuana':1.30,  'León':0.90      },
  'Germany':       { All:1.0, 'Berlin':0.75,   'Munich':1.20,      'Hamburg':0.90, 'Frankfurt':1.30,'Cologne':0.65,  'Stuttgart':1.10 },
  'Japan':         { All:1.0, 'Tokyo':0.60,    'Osaka':0.85,       'Nagoya':1.10,  'Sapporo':0.70,  'Fukuoka':1.30,  'Kyoto':0.50    },
  'Korea':         { All:1.0, 'Seoul':1.50,    'Busan':0.70,       'Incheon':1.20, 'Daegu':0.80,    'Gwangju':1.60,  'Daejeon':0.60  },
  'China':         { All:1.0, 'Beijing':1.80,  'Shanghai':1.20,    'Guangzhou':0.85,'Shenzhen':1.50,'Chengdu':0.70,  'Wuhan':1.00    },
}

function getInvScale(country, location) {
  const c = COUNTRY_INV_SCALE[country] ?? 1
  const l = CITY_INV_SCALE[country]?.[location] ?? 1
  return c * l
}

function buildLeaderboard(period, asc, invScale = 1, salesScale = 1) {
  const days = PERIOD_DAYS[period] || 1
  const rows = BASE_ITEMS.map(item => {
    const avgSales = Math.round(item.dailyAvg * days * salesScale)
    const scaledInv = item.inventory * invScale
    // WoS always uses daily rate regardless of selected period
    const wos      = parseFloat((scaledInv / (item.dailyAvg * 7)).toFixed(1))
    const status   = wos >= 8 ? 'good' : wos >= 4 ? 'watch' : 'low'
    return { name:item.name, avgSales, inventory:Math.round(scaledInv), wos, status }
  })
  return asc
    ? [...rows].sort((a,b) => a.avgSales - b.avgSales)
    : [...rows].sort((a,b) => b.avgSales - a.avgSales)
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
const PERIOD_CFG = {
  '1D':  { count:24, lbl: i=>`${String(i).padStart(2,'0')}:00` },
  '5D':  { count: 5, lbl: i=>['Mon','Tue','Wed','Thu','Fri'][i] },
  '1M':  { count:30, lbl: i=>`Day ${i+1}` },
  '6M':  { count:26, lbl: i=>`Wk ${i+1}` },
  'YTD': { count:10, lbl: i=>['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'][i] },
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
    const trend  = Math.max(0.15, 1 + p.trend * i)   // floor at 0.15 prevents negative collapse
    const wave   = 1 + Math.sin(i * p.f1 + p.p1) * p.a1 + Math.cos(i * p.f2 + p.p2) * p.a2
    const tyRaw  = shapeBase * trend * wave
    const lyR    = p.lyBias + Math.sin(i * p.lyF + 1.0) * p.lyAmp
    const lyRaw  = tyRaw * lyR                        // derive LY from float tyRaw, not rounded ty
    const ty     = Math.max(1, Math.round(tyRaw * scale))
    const ly     = Math.max(1, Math.round(lyRaw * scale))
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
    const all = buildLeaderboard(period, false, invScale)
    return checked.size === 0 ? [] : checked.size === BASE_ITEMS.length ? all : all.filter(r => checked.has(r.name))
  }, [period, invScale, checked])
  const goodCount  = rows.filter(r => r.status === 'good').length
  const total      = rows.length
  const targetPct  = total === 0 ? 0.06 : Math.min(0.94, Math.max(0.06, goodCount / total))

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
          {total === 0 ? '—' : `${Math.round(pct*100)}%`}
        </text>
        <text x={cx} y={cy+12} fill="#fff" fontSize={11} textAnchor="middle">Inventory Health</text>
      </svg>
    </div>
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
  const [asc, setAsc]         = useState(false)
  const [hovered, setHovered] = useState(null)

  const rows = useMemo(()=>buildLeaderboard(period, asc, invScale, salesScale), [period, asc, invScale, salesScale])
  const maxSales = Math.max(...rows.map(r=>r.avgSales))

  const allChecked  = rows.length > 0 && rows.every(r => checked.has(r.name))
  const someChecked = !allChecked && rows.some(r => checked.has(r.name))

  const toggle = name => setChecked(prev=>{
    const next=new Set(prev); next.has(name)?next.delete(name):next.add(name); return next
  })
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(rows.map(r=>r.name)))

  return (
    <div style={{ backgroundColor:T.panelBg, border:`1px solid ${T.border}`, borderRadius:8, padding:'12px 10px', display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexShrink:0 }}>
        <span style={{ fontSize:12, fontWeight:700, color: T.text }}>Product Leaderboard</span>
        <button
          onClick={()=>setAsc(a=>!a)}
          title={asc?'Sort descending':'Sort ascending'}
          style={{ background:'none', border:`1px solid ${T.dropdownBorder}`, color: T.textMuted, borderRadius:4, padding:'2px 6px', cursor:'pointer', display:'flex', alignItems:'center', gap:3, fontSize:10 }}
        >
          <ArrowUpDown size={11}/>{asc?'Asc':'Desc'}
        </button>
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
        {['Items','Unit Sales','Inventory','WoS'].map(h=>(
          <span key={h} style={{ fontSize:9, color: T.text, textTransform:'uppercase', letterSpacing:'0.04em', textAlign: h==='Items'?'left':'center', display:'block', position:'relative', left: h==='Items'?0:-30 }}>{h}</span>
        ))}
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
  kpi, country, location, cities, cityScales, countries,
  onBack, onCountryChange, onLocationChange,
  theme = 'dark', onThemeToggle,
}) {
  const T = THEME[theme]
  const panel  = { backgroundColor:T.panelBg, border:`1px solid ${T.border}`, borderRadius:8, padding:'14px 16px' }
  const ttip   = { backgroundColor:T.tooltipBg, border:`1px solid ${T.tooltipBorder}`, color:T.text, fontSize:11, borderRadius:6 }
  const axTick = { fill:T.axTick, fontSize:10 }

  const [period, setPeriod]           = useState('1M')
  const [activeTooltip, setActiveTooltip] = useState(null)
  const [checked, setChecked] = useState(() => new Set(BASE_ITEMS.map(i => i.name)))
  const countrySalesScale = COUNTRY_SALES_SCALE[country] ?? 1
  const citySalesScale    = location === 'All' ? 1 : (cityScales[country]?.[location] ?? 1)
  const cityScale         = countrySalesScale * citySalesScale
  const invScale  = getInvScale(country, location)
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

  const series = useMemo(() =>
    kpi.label === 'Unit Sales'
      ? buildUnitSalesSeries(period, cityScale, selectedDailyTotal, country)
      : buildSeries(baseValue, period),
  [kpi.label, period, cityScale, selectedDailyTotal, baseValue, country])

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

  // Inventory health stats for context panel
  const healthRows = useMemo(() => {
    const all = buildLeaderboard(period, false, invScale)
    return checked.size === 0 ? [] : allItemsChecked ? all : all.filter(r => checked.has(r.name))
  }, [period, invScale, checked, allItemsChecked])
  const goodItems  = healthRows.filter(r => r.status === 'good')
  const lowItems   = healthRows.filter(r => r.status === 'low').sort((a,b) => a.wos - b.wos)
  const healthPct  = Math.round((goodItems.length / healthRows.length) * 100)
  const healthZone = healthPct >= 67 ? 'Healthy' : healthPct >= 34 ? 'At Risk' : 'Critical'
  const healthColor = healthPct >= 67 ? '#4caf50' : healthPct >= 34 ? '#ff9800' : '#f44336'
  const healthTldr = healthPct >= 67
    ? `Stock levels are in good shape. Most products have at least 8 weeks of supply, reducing the risk of stockouts in the near term.`
    : healthPct >= 34
    ? `Stock levels need attention. Several products are running low and may face stockouts within 4 weeks if replenishment isn't actioned soon.`
    : `Stock levels are critically low across a significant portion of the assortment. Immediate replenishment action is recommended to avoid lost sales.`

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
    <div style={{ backgroundColor: T.bg, height:'100vh', display:'flex', flexDirection:'column', fontFamily:'Inter, system-ui, sans-serif', color: T.text, overflow:'hidden' }}>

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button style={dropBtn}>{location}<span style={{ color: T.textDim, fontSize:10 }}>▼</span></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent style={{ backgroundColor: T.dropdownBg, border:`1px solid ${T.dropdownBorder}`, minWidth:160 }}>
              {cities.map(c=>(
                <DropdownMenuItem key={c} onClick={()=>onLocationChange(c)}
                  style={{ color:c===location?'#00bcd4': T.textMuted, fontSize:12, cursor:'pointer', backgroundColor:c===location? T.activeItemBg:'transparent' }}>
                  {c}
                </DropdownMenuItem>
              ))}
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
        </div>
      </div>

      {/* ── Title bar ── */}
      <div style={{ padding:'8px 16px', borderBottom:`1px solid ${T.borderLight}`, flexShrink:0 }}>
        <div style={{ fontSize:11, color: T.textFaint }}>{country} › {location==='All'?'All Locations':location}</div>
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
          <div style={{ ...panel, display:'flex', alignItems:'center', gap:24, flexShrink:0, padding:'12px 20px' }}>
            <div style={{ flex:'0 0 auto' }}>
              <MetricGauge period={period} invScale={invScale} checked={checked} T={T}/>
            </div>
            <div style={{ flex:1, borderLeft:`1px solid ${T.border}`, paddingLeft:24 }}>
              <div style={{ fontSize:10, color: T.textDim, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Inventory Health Context</div>

              {/* Score badge + TL;DR */}
              <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:10 }}>
                <div style={{ flexShrink:0, backgroundColor: healthColor+'22', border:`1px solid ${healthColor}`, borderRadius:6, padding:'4px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:700, color: healthColor }}>{healthPct}%</div>
                  <div style={{ fontSize:9, color: healthColor, fontWeight:600 }}>{healthZone}</div>
                </div>
                <div style={{ fontSize:12, color: T.textMuted, lineHeight:1.7 }}>{healthTldr}</div>
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
                        <span style={{ color:'#f44336', fontWeight:600 }}>{item.wos} wks</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Line Chart */}
          <div style={{ ...panel, flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
            {/* Chart header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, marginBottom:8 }}>
              <div>
                <span style={{ fontSize:12, fontWeight:600 }}>
                  {kpi.label} — Trend {location==='All'?'All Locations':location}
                  {checked.size === 1
                    ? `, ${[...checked][0]}`
                    : !allItemsChecked && checked.size > 1
                      ? ` (${checked.size} items selected)`
                      : ''}
                </span>
              </div>
              <div style={{ display:'flex', gap:14, alignItems:'center' }}>
                <div style={{ display:'flex', gap:12 }}>
                  {[['This Year','#00bcd4','solid'],['Last Year','#ff9800','dashed']].map(([l,c,d])=>(
                    <span key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:c }}>
                      <svg width={22} height={10}>
                        <line x1={0} y1={5} x2={22} y2={5} stroke={c} strokeWidth={d==='dashed'?1.5:2}
                          strokeDasharray={d==='dashed'?'4 3':undefined}/>
                        <circle cx={11} cy={5} r={3} fill={c}/>
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
            <div style={{ flex:1, minHeight:0, position:'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={series}
                  margin={{ top:8, right:16, bottom:8, left:8 }}
                  onMouseMove={e => {
                    if (e?.activePayload?.length) {
                      const ty = e.activePayload.find(p=>p.dataKey==='thisYear')?.value
                      const ly = e.activePayload.find(p=>p.dataKey==='lastYear')?.value
                      setActiveTooltip({ label: e.activeLabel, ty, ly, x: e.activeCoordinate?.x })
                    }
                  }}
                  onMouseLeave={() => setActiveTooltip(null)}
                >
                  <XAxis dataKey="label" stroke={T.border} tick={axTick}/>
                  <YAxis stroke={T.border} tick={axTick} tickFormatter={fmtAxis} width={46} domain={yDomain}/>
                  <Tooltip content={() => null} cursor={{ stroke:'#444', strokeWidth:1, strokeDasharray:'4 3' }}/>
                  {/* Shading band — drawn before grid so grid renders on top */}
                  <Area type="monotone" dataKey="upper" fill="rgba(0,188,212,0.15)" stroke="none" fillOpacity={1} isAnimationActive={false} activeDot={false} dot={false} baseValue={yDomain[0]}/>
                  <Area type="monotone" dataKey="lower" fill={T.chartMask}          stroke="none" fillOpacity={1} isAnimationActive={false} activeDot={false} dot={false} baseValue={yDomain[0]}/>
                  {/* Grid on top of fill so lines show through */}
                  <CartesianGrid strokeDasharray="3 3" stroke={T.chartGrid} vertical={false}/>
                  {/* Lines */}
                  <Line type="monotone" dataKey="thisYear" stroke="#00bcd4" strokeWidth={2}
                    dot={{ r:3, fill:'#00bcd4', strokeWidth:0 }} activeDot={{ r:5 }} name="This Year"
                    animationDuration={700} animationEasing="ease-in-out"/>
                  <Line type="monotone" dataKey="lastYear" stroke="#ff9800" strokeWidth={1.5}
                    dot={{ r:2.5, fill:'#ff9800', strokeWidth:0 }} activeDot={{ r:4 }} name="Last Year"
                    animationDuration={700} animationEasing="ease-in-out"/>
                </ComposedChart>
              </ResponsiveContainer>

              {/* Inline overlay labels — float above cursor line */}
              {activeTooltip?.x != null && (() => {
                const { ty, ly, x } = activeTooltip
                const delta = ty != null && ly != null ? ty - ly : null
                return (
                  <div style={{
                    position:'absolute', top:8, left:x,
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
                  fontSize:11, padding:'4px 12px', borderRadius:4, cursor:'pointer',
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
