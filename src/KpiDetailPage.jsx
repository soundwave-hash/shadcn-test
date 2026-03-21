import React, { useState, useMemo, useEffect, useRef } from 'react'
import AccountSwitcher from './AccountSwitcher'
import SlackPanel from './SlackPanel'
import VoiceAssistant from './VoiceAssistant'
import { PRODUCTS as BASE_ITEMS, CATEGORIES, SUBCATEGORIES_BY_CATEGORY, COUNTRY_SALES_PROFILES, COUNTRY_INV_PROFILES, CITY_FRACTIONS } from './data/groceryProducts'
import {
  ComposedChart, Area, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowUpDown, Sun, Download, Mic } from 'lucide-react'
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
    bg: '#cfd3d8', navBg: '#e2e5e8', panelBg: '#e2e5e8',
    border: 'rgba(0,0,0,0.09)', borderLight: 'rgba(0,0,0,0.05)',
    text: '#111', textMuted: '#555', textDim: '#888', textFaint: '#aaa',
    inputBg: '#d7dadd', inputBorder: 'rgba(0,0,0,0.09)', inputText: '#333',
    dropdownBg: '#e2e5e8', dropdownBorder: 'rgba(0,0,0,0.09)',
    rowHover: '#cee6f0', chartMask: '#dadde0', chartGrid: 'rgba(0,0,0,0.07)',
    cardBg: '#e2e5e8', cardBorder: 'rgba(0,0,0,0.09)',
    axTick: '#6c6c6c', tooltipBg: '#e2e5e8', tooltipBorder: 'rgba(0,0,0,0.09)',
    activeItemBg: '#c4dfea', sep: '#aaaaaa',
  },
}

const PERIODS = ['1D','5D','1M','6M','YTD']

const STATUS_C = { good:'#4caf50', watch:'#ff9800', low:'#f44336' }

// BASE_ITEMS imported from ./data/groceryProducts — full catalog with per-product
// country distribution profiles. Total dailyAvg/inventory are global figures;
// country and city level values are derived from COUNTRY_SALES_PROFILES / COUNTRY_INV_PROFILES.

const PERIOD_SCALE = { '1D':1.0, '5D':1.02, '1M':0.98, '6M':0.92, 'YTD':0.88 }

// Cumulative days per period
const PERIOD_DAYS = { '1D': 1, '5D': 5, '1M': 30, '6M': 182, 'YTD': 300 }
// Daily-rate scale per period (longer periods smooth out spikes → lower avg rate)
const WOS_PERIOD_SCALE = { '1D': 1.0, '5D': 0.97, '1M': 1.04, '6M': 0.93, 'YTD': 0.90 }

// Simplified country scale used ONLY for non-Unit-Sales KPI card baseValue scaling.
// Unit sales leaderboard and chart use per-product COUNTRY_SALES_PROFILES instead.
const KPI_COUNTRY_SCALE = {
  'United States': 1.00, 'Canada': 0.20, 'Mexico': 0.10,
  'Germany': 0.10, 'Japan': 0.05, 'Korea': 0.02, 'China': 3.50,
}

// ── Per-product regional helpers ───────────────────────────────────────────────

function getProductSalesFrac(item, country, cities = []) {
  if (!country || country === 'All') return 1
  const prof = COUNTRY_SALES_PROFILES[item.profile] ?? COUNTRY_SALES_PROFILES.Balanced
  const countryFrac = prof[country] ?? 0
  if (cities.length === 0) return countryFrac
  const cityFrac = cities.reduce((s, c) => s + (CITY_FRACTIONS[country]?.[c] ?? 0), 0)
  return countryFrac * cityFrac
}

function getProductInvFrac(item, country, cities = []) {
  if (!country || country === 'All') return 1
  const prof = COUNTRY_INV_PROFILES[item.profile] ?? COUNTRY_INV_PROFILES.Balanced
  const countryFrac = prof[country] ?? 0
  if (cities.length === 0) return countryFrac
  const cityFrac = cities.reduce((s, c) => s + (CITY_FRACTIONS[country]?.[c] ?? 0), 0)
  return countryFrac * cityFrac
}

function buildLeaderboard(period, sortField, sortAsc, country = 'All', cities = []) {
  const days       = PERIOD_DAYS[period] || 1
  const rateScale  = WOS_PERIOD_SCALE[period] ?? 1
  const rows = BASE_ITEMS.map(item => {
    const salesFrac = getProductSalesFrac(item, country, cities)
    const invFrac   = getProductInvFrac(item, country, cities)
    const avgSales  = Math.round(item.dailyAvg * days * salesFrac)
    const scaledInv = Math.round(item.inventory * invFrac)
    const localAvg  = item.dailyAvg * salesFrac * rateScale
    const wos       = localAvg > 0 ? parseFloat((scaledInv / (localAvg * 7)).toFixed(1)) : 0
    const status    = wos >= 8 ? 'good' : wos >= 4 ? 'watch' : 'low'
    return { name:item.name, category:item.category, subcategory:item.subcategory, avgSales, inventory:scaledInv, wos, status }
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

// Get current hour in Pacific time (America/Los_Angeles handles PST/PDT automatically)
const _pacificHour = () => {
  const h = parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    hour12: false,
  }).format(new Date()), 10)
  return h === 24 ? 0 : h
}
const _TODAY_HOUR_PT = _pacificHour()

// Current-position labels used for axis highlight
const CURRENT_LABEL_1D  = _fmt12h(_TODAY_HOUR_PT)
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

// ── Forecast tick tooltip content ──────────────────────────────────────────────
const YTD_FORECAST_TIPS = {
  Jan: { headline:'January: Forecast Rationale', body:'Model anchors to a trailing 3 year January average with a +1.4% CAGR adjustment. Post holiday demand contraction is a structurally consistent pattern across this assortment — the forecast reflects a controlled velocity reset rather than a structural decline. Consumer panel data shows basket size compressing but trip frequency holding, supporting the flattish unit volume projection.', confidence:'Model confidence: High · 3 yr comp basis' },
  Feb: { headline:'February: Forecast Rationale', body:'Valentine\'s Day creates a predictable 4 day demand concentration that the model weights at 1.8x the daily baseline for Feb 12–15. The short calendar month introduces a timing risk — the forecast assumes normal carrier availability. If inbound lead times extend beyond 3 days, the model flags a 6–9% downside scenario on confection and snack categories.', confidence:'Model confidence: High · Event driven signal' },
  Mar: { headline:'March: Current Month in Progress', body:'Actuals through today are tracking 2.3% above the March forecast. The model originally projected a modest spring lift driven by seasonal produce resets and St. Patrick\'s Day pull. Easter\'s early positioning this year introduces incremental upside not fully captured in the base case — revised estimate carries a +4% adjustment flag.', confidence:'Model confidence: Medium · Revision pending' },
  Apr: { headline:'April: Forecast Rationale', body:'Easter weekend is the primary demand lever for this forecast, contributing an estimated 11% of monthly unit volume in a compressed 4 day window. The model uses a day of week adjusted Easter demand curve calibrated on 4 prior years. Post Easter normalization is modeled at 6 days — any extension beyond 8 days would pressure the monthly total by approximately 3%.', confidence:'Model confidence: High · Event calendar anchored' },
  May: { headline:'May: Forecast Rationale', body:'The Memorial Day demand signal accounts for roughly 18% of projected May volume. The model identifies a consistent front loading pattern in this assortment — consumers begin stocking grilling, snack, and beverage categories 9–12 days before the holiday. The forecast carries a +2.1% upside adjustment reflecting above average consumer confidence indices for Q2.', confidence:'Model confidence: High · Holiday curve applied' },
  Jun: { headline:'June: Forecast Rationale', body:'Summer onset triggers a sustained velocity uplift that the model projects at +9% above the May run rate. The forecast is anchored to a seasonality index built on 5 years of June POS data, weighted toward the back half of the month when outdoor entertaining behavior peaks. Weather scenario analysis adds a ±4% band around the base case.', confidence:'Model confidence: Medium · Weather sensitive' },
  Jul: { headline:'July: Forecast Rationale', body:'4th of July creates the highest single event demand concentration in the annual forecast. The model applies a 3 day spike multiplier of 2.4x on beverages, proteins, and snacks, then models a 10 day normalization tail. This forecast assumes no supply disruption — a 1 day carrier delay during the pre holiday build window historically results in a 7–12% fulfillment shortfall.', confidence:'Model confidence: High · Event multiplier applied' },
  Aug: { headline:'August: Forecast Rationale', body:'Back to school is the primary demand driver, with the model projecting peak pull in weeks 2 and 3. The forecast reflects a modest sequential deceleration from July\'s peak as summer beverage velocity normalizes. Consumer sentiment data for this cohort shows strong pantry stocking intent, supporting the breakfast and lunch category uplift embedded in the August projection.', confidence:'Model confidence: High · Category level signal' },
  Sep: { headline:'September: Forecast Rationale', body:'Labor Day provides a positive demand opening, but the model accounts for a mid month lull that is statistically consistent across 4 of the last 5 Septembers. The net forecast reflects this offset. The fall category transition — soups, warm beverages, and root produce — begins contributing incremental volume in week 3, which the model captures via a seasonal index crossover applied at the SKU level.', confidence:'Model confidence: Medium · Transition month volatility' },
  Oct: { headline:'October: Forecast Rationale', body:'Halloween driven demand is modeled as a 2 week acceleration window (Oct 18–31) calibrated on confection, snack, and seasonal produce velocity from prior years. The model also embeds an early holiday pantry stocking signal that typically emerges in week 3, representing roughly 4% of monthly volume. Freight tightening in late October is factored into the inventory positioning assumptions, not the demand forecast itself.', confidence:'Model confidence: High · Seasonal index + event overlay' },
}

const HOUR_FORECAST_TIPS = {
  '12 AM':{ headline:'12 AM: Forecast Rationale', body:'The model projects near floor demand for this hour based on a 5 year hourly POS curve. Transactions at midnight account for less than 0.3% of daily volume and are structurally driven by automated subscription fulfillment and digital orders, not in store traffic. Forecast variance at this hour is minimal — the confidence interval is the tightest of any hour in the 1D model.', confidence:'Model confidence: Very High · Structural floor' },
  '1 AM': { headline:'1 AM: Forecast Rationale', body:'Demand at 1 AM is almost entirely composed of e-commerce auto replenishment and late night convenience channel activity. The model applies a flat multiplier derived from 90 day rolling actuals at this hour. Forecast deviation from actuals at 1 AM historically averages less than 1.2%, making this one of the most stable hours in the intraday curve.', confidence:'Model confidence: Very High · Low variance hour' },
  '2 AM': { headline:'2 AM: Forecast Rationale', body:'Projected velocity reflects minimum baseline demand with no meaningful consumer initiated transaction signal. The model isolates this hour as a DC throughput window rather than a consumer demand window — any units forecasted here represent scheduled auto fulfillment orders processed during the overnight batch cycle.', confidence:'Model confidence: Very High · Batch fulfillment driven' },
  '3 AM': { headline:'3 AM: Forecast Rationale', body:'The 3 AM forecast is anchored almost entirely to pre scheduled replenishment orders and cross dock activity. Consumer demand contribution is statistically indistinguishable from zero. The model flags this hour as a leading indicator for shelf availability at open — any forecast miss here propagates into a morning OOS risk signal.', confidence:'Model confidence: Very High · Pre open indicator' },
  '4 AM': { headline:'4 AM: Forecast Rationale', body:'Early open consumer traffic begins contributing a measurable signal at 4 AM, primarily from 24 hour format locations. The model projects a +40% step up from the 3 AM floor based on format mix in this region. The forecast for this hour is the first in the day where consumer behavior — rather than automated systems — becomes a meaningful demand driver.', confidence:'Model confidence: High · Format mix adjusted' },
  '5 AM': { headline:'5 AM: Forecast Rationale', body:'Commuter and early open traffic produces a sharp velocity inflection that the model captures via a ramp coefficient derived from foot traffic data. The 5 AM hour is the first with meaningful cross category breadth — grab and go, coffee, and fresh beverages all registering above minimum threshold simultaneously. The model projects a 3.2x step up from the 4 AM level.', confidence:'Model confidence: High · Foot traffic anchored' },
  '6 AM': { headline:'6 AM: Forecast Rationale', body:'The model projects significant acceleration at 6 AM, driven by the breakfast commuter cohort. POS velocity data from comparable dayparts across 3 years shows a consistent 55–65% above baseline signal for this hour. The forecast embeds a weather sensitivity coefficient — precipitation events historically compress 6 AM velocity by 8–14% as commuter footfall drops.', confidence:'Model confidence: High · Weather adjusted' },
  '7 AM': { headline:'7 AM: Forecast Rationale', body:'7 AM represents the morning demand apex in the 1D model. The forecast is built on a 90th percentile intraday velocity curve, reflecting the highest sustained transaction rate of the morning window. Consumer basket data shows the broadest category mix at this hour — the model weights 14 of 20 tracked SKUs as active velocity contributors, the highest cross SKU engagement of any morning hour.', confidence:'Model confidence: Very High · Peak hour calibration' },
  '8 AM': { headline:'8 AM: Forecast Rationale', body:'The model sustains a near peak forecast for 8 AM based on the pre work shopping segment, which shows strong dwell time and basket depth signals in panel data. While absolute transaction count begins declining from the 7 AM peak, revenue per transaction reaches its morning high at 8 AM as consumers add planned pantry items to commuter driven purchases.', confidence:'Model confidence: High · Basket depth signal' },
  '9 AM': { headline:'9 AM: Forecast Rationale', body:'Post commute traffic shifts the demand profile toward planned household shopping. The model projects continued strength anchored by the caregiver and household manager cohort, which drives above average basket sizes and strong fresh category pull. Historical 9 AM actuals have tracked within 3.5% of forecast for 11 of the last 12 comparable periods.', confidence:'Model confidence: High · Cohort behavioral signal' },
  '10 AM':{ headline:'10 AM: Forecast Rationale', body:'The model identifies 10 AM as a transition hour between the commuter led morning peak and the lunch driven midday surge. Two demand waves overlap here — trailing morning shoppers and early lunch planners — producing a velocity floor that is structurally above the pre 9 AM run rate. The forecast reflects this overlap with a composite demand signal weighted 60/40 between the two cohorts.', confidence:'Model confidence: High · Dual cohort model' },
  '11 AM':{ headline:'11 AM: Forecast Rationale', body:'11 AM carries one of the highest forecast confidence scores in the 1D model. The lunch demand signal is fully established by this hour and historical actuals show very low variance against the seasonal baseline. The model projects sustained near peak velocity driven by fresh, deli, and prepared categories, with a secondary snack and beverage contribution from early lunch break shoppers.', confidence:'Model confidence: Very High · Low historical variance' },
  '12 PM':{ headline:'12 PM: Forecast Rationale', body:'Noon is the single highest confidence hour in the 1D demand model. Five years of POS data produce a tight confidence interval of ±2.1% around the midday baseline. The forecast reflects peak transaction density across the broadest category spread of any hour — all 20 tracked SKUs register active velocity simultaneously at noon. Revenue concentration per hour is at its daily maximum.', confidence:'Model confidence: Very High · Tightest CI in model' },
  '1 PM': { headline:'1 PM: Forecast Rationale', body:'The model projects a modest post noon step down anchored to a consistent 1 PM taper observed across 48 of the last 52 comparable weeks. Snack and convenience categories maintain elevated velocity as the afternoon snacking occasion layer begins. The forecast assumes the lunch demand tail runs approximately 45 minutes past noon before the velocity curve begins its sustained afternoon decline.', confidence:'Model confidence: High · Taper curve applied' },
  '2 PM': { headline:'2 PM: Forecast Rationale', body:'Afternoon demand at 2 PM is modeled with a dual channel lens — in store traffic moderating while BOPIS and delivery order volume holds steady. The model embeds a school pickup demand pulse at 2:30 PM for regions with high family segment penetration, contributing an estimated 4–6% incremental unit lift in fresh and snack categories relative to the 1 PM baseline.', confidence:'Model confidence: Medium · Channel mix sensitivity' },
  '3 PM': { headline:'3 PM: Forecast Rationale', body:'The model identifies 3 PM as the trough of the mid afternoon demand valley before the commuter driven evening rebuild begins. Historical actuals cluster tightly around the forecast at this hour — in store traffic is structurally lower than both the morning and evening peaks, creating a stable and predictable demand signal that the model captures with high accuracy.', confidence:'Model confidence: High · Midday trough calibration' },
  '4 PM': { headline:'4 PM: Forecast Rationale', body:'The commuter demand signal activates sharply at 4 PM in the model. Trip mission data shows a clear shift from convenience led to meal planning led shopping behavior starting at this hour — basket size increases 22% on average vs 3 PM and protein, produce, and dairy velocity accelerates disproportionately. The forecast embeds a day of week modifier — Friday 4 PM runs 14% above the weekly average.', confidence:'Model confidence: High · Mission shift signal' },
  '5 PM': { headline:'5 PM: Forecast Rationale', body:'5 PM is the second daily demand peak and carries the highest revenue per hour forecast of the evening window. The model weights this hour using a commuter density index calibrated to regional transit and office occupancy patterns. Consumer intent data shows peak meal planning confidence at this hour — the broadest dinner category basket composition of any evening hour is projected at 5 PM.', confidence:'Model confidence: Very High · Commuter density indexed' },
  '6 PM': { headline:'6 PM: Forecast Rationale', body:'The model projects sustained elevated demand at 6 PM, driven by post work shoppers who index heavily on prepared foods, grab and go, and convenience categories. The velocity curve flattens rather than declines sharply — the forecast reflects a 7% sequential softening from 5 PM, consistent with the average observed across 3 years of comparable evening periods.', confidence:'Model confidence: High · Convenience cohort signal' },
  '7 PM': { headline:'7 PM: Forecast Rationale', body:'7 PM marks the inflection point in the evening wind down. The model forecasts a steeper velocity decline than prior hours, driven by a structural drop in new trip initiations after 7 PM. Late mission shoppers — predominantly top up and convenience — sustain the floor. The forecast holds above the seasonal mean due to above average regional consumer confidence scores embedded in this month\'s model inputs.', confidence:'Model confidence: Medium · Wind down inflection point' },
  '8 PM': { headline:'8 PM: Forecast Rationale', body:'The model projects continued deceleration at 8 PM, with velocity settling toward the lower quartile of the daily range. Remaining transaction volume is concentrated in convenience, snack, and beverage — the model applies a late evening category mix adjustment that narrows the active SKU set from 20 to approximately 9 high velocity convenience items.', confidence:'Model confidence: High · Category mix narrowing' },
  '9 PM': { headline:'9 PM: Forecast Rationale', body:'The 9 PM forecast reflects the transition from consumer led to fulfillment led demand. Remaining in store transactions are structurally predictable — the model captures them via a closing hour behavioral curve with a historical fit of 94.2%. Any forecast beat at this hour typically signals an unplanned demand event such as a local promotion or competitor OOS driving incremental trip migration.', confidence:'Model confidence: High · Closing curve applied' },
  '10 PM':{ headline:'10 PM: Forecast Rationale', body:'Demand at 10 PM is structurally bounded by store format and operating hours. The model applies a hard ceiling based on historical maximum transaction counts at this hour across the active store base. Forecast variance is almost entirely explained by format mix — 24 hour stores contribute disproportionately and any change in format weighting shifts the 10 PM total materially.', confidence:'Model confidence: High · Format ceiling bound' },
  '11 PM':{ headline:'11 PM: Forecast Rationale', body:'The model projects near floor demand for 11 PM, consistent with closing hour transaction patterns. The forecast is largely invariant to macroeconomic inputs at this hour — demand is structurally constrained by shopper access and store hours. The primary forecast risk is a positive surprise from digital/BOPIS order cutoff windows that route last minute orders into this hour\'s fulfillment queue.', confidence:'Model confidence: Very High · Structurally constrained' },
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

function MetricGauge({ period, country, selectedCities, checked, T }) {
  const cx=130, cy=130, r=90, sw=22

  const rows = useMemo(() => {
    const all = buildLeaderboard(period, 'wos', true, country, selectedCities)
    return checked.size === 0 ? [] : checked.size === BASE_ITEMS.length ? all : all.filter(r => checked.has(r.name))
  }, [period, country, selectedCities, checked])
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
    if (startVal === endVal) return
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
      <svg width="100%" viewBox="0 0 260 158" style={{ maxWidth:286 }}>
        {/* Track */}
        <path d={arc(0,1)} fill="none" stroke={T.border} strokeWidth={sw+4} strokeLinecap="round"/>
        {/* Filled */}
        <path d={arc(0,pct)} fill="none" stroke={arcColor} strokeWidth={sw} strokeLinecap="round"/>
        {/* Min / Max labels */}
        <text x={cx-r-2} y={cy+25} fill="#fff" fontSize={10} textAnchor="middle">0%</text>
        <text x={cx+r+2} y={cy+25} fill="#fff" fontSize={10} textAnchor="middle">100%</text>
        {/* Score — use unclamped weightedPct so text matches the TL;DR badge */}
        <text x={cx} y={cy-14} fill={arcColor} fontSize={34} fontWeight={700} textAnchor="middle" dominantBaseline="middle">
          {rows.length === 0 ? '—' : `${Math.round(weightedPct*100)}%`}
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
    <line x1={x} y1={y} x2={x} y2={y + height}
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
function Leaderboard({ period, country, selectedCities, checked, onCheckedChange, T }) {
  const setChecked = onCheckedChange
  const [sortField, setSortField] = useState('wos')
  const [sortAsc, setSortAsc]     = useState(true)   // WOS asc = lowest WoS (critical) first
  const [hovered, setHovered]     = useState(null)   // row hover
  const [hovCol, setHovCol]       = useState(null)   // column header hover
  const [selCats, setSelCats] = useState(new Set())  // empty = All
  const [selSubs, setSelSubs] = useState(new Set())  // empty = All

  const allRows = useMemo(() => buildLeaderboard(period, sortField, sortAsc, country, selectedCities), [period, sortField, sortAsc, country, selectedCities])

  const rows = useMemo(() => {
    let r = allRows
    if (selCats.size > 0) r = r.filter(row => selCats.has(row.category))
    if (selSubs.size > 0) r = r.filter(row => selSubs.has(row.subcategory))
    return r
  }, [allRows, selCats, selSubs])

  const subcats = selCats.size === 0
    ? Object.values(SUBCATEGORIES_BY_CATEGORY).flat()
    : [...selCats].flatMap(cat => SUBCATEGORIES_BY_CATEGORY[cat] ?? [])

  const catLabel = selCats.size === 0 ? 'All' : selCats.size === 1 ? [...selCats][0] : `${selCats.size} Depts`
  const subLabel = selSubs.size === 0 ? 'All' : selSubs.size === 1 ? [...selSubs][0] : `${selSubs.size} Subs`

  function handleCatToggle(cat) {
    if (cat === 'All') { setSelCats(new Set()); setSelSubs(new Set()); return }
    setSelCats(prev => { const next = new Set(prev); next.has(cat) ? next.delete(cat) : next.add(cat); return next })
    setSelSubs(new Set())
  }

  function handleSubToggle(sub) {
    if (sub === 'All') { setSelSubs(new Set()); return }
    setSelSubs(prev => { const next = new Set(prev); next.has(sub) ? next.delete(sub) : next.add(sub); return next })
  }

  const maxSales = Math.max(...rows.map(r => r.avgSales), 1)

  const allChecked  = rows.length > 0 && rows.every(r => checked.has(r.name))
  const someChecked = !allChecked && rows.some(r => checked.has(r.name))

  const toggle    = name => setChecked(prev => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next })
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(rows.map(r => r.name)))

  function handleColSort(field) {
    if (sortField === field) setSortAsc(a => !a)
    else { setSortField(field); setSortAsc(field === 'wos') } // WoS → ascending, others → descending
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
      <div style={{ marginBottom:8, flexShrink:0 }}>
        <span style={{ fontSize:12, fontWeight:700, color: T.text }}>Product Leaderboard</span>
      </div>

      {/* Department / Subcategory filters */}
      <div style={{ display:'flex', gap:6, marginBottom:8, flexShrink:0, flexWrap:'wrap' }}>
        {/* Department multi-select */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button style={{
              backgroundColor: T.inputBg, border:`1px solid ${selCats.size > 0 ? '#00bcd4' : T.inputBorder}`,
              color: selCats.size > 0 ? '#00bcd4' : T.inputText,
              fontSize:10, padding:'3px 8px', borderRadius:4, cursor:'pointer',
              display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap',
            }}>
              <span style={{ opacity:0.6, fontSize:9, textTransform:'uppercase', letterSpacing:'0.04em' }}>Dept</span>
              {catLabel} ▾
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent style={{ backgroundColor:T.dropdownBg, border:`1px solid ${T.dropdownBorder}`, borderRadius:6, padding:'4px 0', minWidth:160, zIndex:100 }}>
            <DropdownMenuItem closeOnClick={false} onClick={() => handleCatToggle('All')}
              style={{ fontSize:11, padding:'5px 12px', cursor:'pointer', color: selCats.size === 0 ? '#00bcd4' : T.text, backgroundColor: selCats.size === 0 ? T.activeItemBg : 'transparent' }}>
              All
            </DropdownMenuItem>
            {CATEGORIES.map(cat => (
              <DropdownMenuItem key={cat} closeOnClick={false} onClick={() => handleCatToggle(cat)}
                style={{ fontSize:11, padding:'5px 12px', cursor:'pointer', color: selCats.has(cat) ? '#00bcd4' : T.text, backgroundColor: selCats.has(cat) ? T.activeItemBg : 'transparent' }}>
                {selCats.has(cat) ? '✓ ' : ''}{cat}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Subcategory multi-select — always visible */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button style={{
              backgroundColor: T.inputBg, border:`1px solid ${selSubs.size > 0 ? '#00bcd4' : T.inputBorder}`,
              color: selSubs.size > 0 ? '#00bcd4' : T.inputText,
              fontSize:10, padding:'3px 8px', borderRadius:4, cursor:'pointer',
              display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap',
            }}>
              <span style={{ opacity:0.6, fontSize:9, textTransform:'uppercase', letterSpacing:'0.04em' }}>Cat</span>
              {subLabel} ▾
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent style={{ backgroundColor:T.dropdownBg, border:`1px solid ${T.dropdownBorder}`, borderRadius:6, padding:'4px 0', minWidth:180, zIndex:100 }}>
            <DropdownMenuItem closeOnClick={false} onClick={() => handleSubToggle('All')}
              style={{ fontSize:11, padding:'5px 12px', cursor:'pointer', color: selSubs.size === 0 ? '#00bcd4' : T.text, backgroundColor: selSubs.size === 0 ? T.activeItemBg : 'transparent' }}>
              All
            </DropdownMenuItem>
            {subcats.map(sub => (
              <DropdownMenuItem key={sub} closeOnClick={false} onClick={() => handleSubToggle(sub)}
                style={{ fontSize:11, padding:'5px 12px', cursor:'pointer', color: selSubs.has(sub) ? '#00bcd4' : T.text, backgroundColor: selSubs.has(sub) ? T.activeItemBg : 'transparent' }}>
                {selSubs.has(sub) ? '✓ ' : ''}{sub}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Reset pill */}
        {(selCats.size > 0 || selSubs.size > 0) && (
          <button
            onClick={() => { setSelCats(new Set()); setSelSubs(new Set()) }}
            style={{
              backgroundColor:'transparent', border:`1px solid ${T.border}`,
              color: T.textMuted, fontSize:10, padding:'3px 8px', borderRadius:4, cursor:'pointer',
            }}
          >
            ✕ Reset
          </button>
        )}
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
                textAlign:'center', display:'block', position:'relative', left:-14,
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
              <span style={{ fontSize:11, color: T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {row.name}
              </span>
              {/* Unit Sales */}
              <div style={{ textAlign:'center', border:`1px solid ${T.border}`, borderRadius:3, padding:'1px 0' }}>
                <span style={{ fontSize:11, color: T.text, fontVariantNumeric:'tabular-nums' }}>
                  {row.avgSales.toLocaleString()}
                </span>
              </div>
              {/* Inventory */}
              <div style={{ textAlign:'center', border:`1px solid ${T.border}`, borderRadius:3, padding:'1px 0' }}>
                <span style={{ fontSize:11, color: T.text, fontVariantNumeric:'tabular-nums' }}>
                  {row.inventory.toLocaleString()}
                </span>
              </div>
              {/* WoS */}
              {(() => {
                return (
                  <div style={{ textAlign:'center', border:`1px solid ${T.border}`, borderRadius:3, padding:'1px 0' }}>
                    <span style={{ fontSize:11, color: STATUS_C[row.status], fontWeight:600, fontVariantNumeric:'tabular-nums' }}>
                      {row.wos.toFixed(1)}
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

// ── TL;DR panel (isolated so typing state never re-renders the chart) ─────────
const TLDR_HEIGHT = 256  // fixed px height — chart never moves

function TldrPanel({ body, rec, healthColor, T, triggerKey, onPhaseChange }) {
  const [phase, setPhase]       = useState('thinking')
  const [bodyLen, setBodyLen]   = useState(0)
  const [recLen, setRecLen]     = useState(0)
  const [dots, setDots]         = useState(0)
  const bodyRef    = useRef(body)
  const recRef     = useRef(rec)
  const scrollRef  = useRef(null)
  bodyRef.current  = body
  recRef.current   = rec

  const changePhase = (p) => { setPhase(p); onPhaseChange?.(p) }

  // Reset on each new trigger
  useEffect(() => {
    changePhase('thinking')
    setBodyLen(0)
    setRecLen(0)
    setDots(0)
  }, [triggerKey])

  // Thinking → typing-body
  useEffect(() => {
    if (phase !== 'thinking') return
    const dotInt = setInterval(() => setDots(d => (d + 1) % 4), 400)
    const timer  = setTimeout(() => { clearInterval(dotInt); changePhase('typing-body'); setBodyLen(0) }, 5000)
    return () => { clearInterval(dotInt); clearTimeout(timer) }
  }, [phase])

  // Type body
  useEffect(() => {
    if (phase !== 'typing-body') return
    if (bodyLen >= bodyRef.current.length) { changePhase(recRef.current ? 'typing-rec' : 'done'); return }
    const t = setTimeout(() => setBodyLen(l => l + 1), 22)
    return () => clearTimeout(t)
  }, [phase, bodyLen])

  // Type rec
  useEffect(() => {
    if (phase !== 'typing-rec') return
    const r = recRef.current ?? ''
    if (recLen >= r.length) { changePhase('done'); return }
    const t = setTimeout(() => setRecLen(l => l + 1), 22)
    return () => clearTimeout(t)
  }, [phase, recLen])

  // Auto-scroll to bottom as text types
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [bodyLen, recLen])

  return (
    <div style={{
      maxWidth: 'calc(30vw + 30px)',
      height: TLDR_HEIGHT,
      overflow: 'hidden',
      marginTop: '-0.35em',
    }}>
      <style>{`
        @keyframes tldr-dot-pulse {
          0%, 100% { opacity: 0.2; transform: translateY(0); }
          50%       { opacity: 1;   transform: translateY(-2px); }
        }
        @keyframes tldr-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .tldr-scroll::-webkit-scrollbar { width: 4px; }
        .tldr-scroll::-webkit-scrollbar-track { background: transparent; }
        .tldr-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
        .tldr-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      `}</style>
      <div
        ref={scrollRef}
        className="tldr-scroll"
        style={{ height:'100%', overflowY:'auto', fontSize:14, color: T.textMuted, lineHeight:1.7, paddingRight:12, boxSizing:'border-box' }}
      >
        {phase === 'thinking' ? (
          <span style={{ color:'#ffffff', fontWeight:700, display:'inline-flex', alignItems:'baseline', gap:1, animation:'tldr-fade-in 2s ease forwards' }}>
            Thinking
            {[0,1,2].map(i => (
              <span key={i} style={{
                display:'inline-block',
                animation:`tldr-dot-pulse 1s ease-in-out ${i * 0.2}s infinite`,
                opacity: dots > i ? 1 : 0.2,
              }}>.</span>
            ))}
          </span>
        ) : (
          <>
            {(() => {
              const LABELS = ['SIGNAL', 'RISK']
              const renderBodyText = (text) => {
                const lines = text.split('\n')
                const out = []
                let i = 0
                let paraSection = -1
                let prevEmpty = true
                while (i < lines.length) {
                  const line = lines[i]
                  if (line === '') {
                    out.push(<div key={i} style={{ height:'1.1em' }} />)
                    prevEmpty = true
                    i++
                  } else {
                    if (prevEmpty) {
                      paraSection++
                      if (paraSection < LABELS.length) {
                        out.push(
                          <div key={`lbl${paraSection}`} style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', color: T.textDim, marginBottom:2 }}>
                            {LABELS[paraSection]}
                          </div>
                        )
                      }
                    }
                    prevEmpty = false
                    out.push(<div key={i}>{line}</div>)
                    i++
                  }
                }
                return out
              }
              return renderBodyText(phase === 'typing-body' ? body.slice(0, bodyLen) : body)
            })()}
            {(phase === 'typing-rec' || phase === 'done') && rec && (
              <>
                <div style={{ height:'1.1em' }} />
                <span style={{ fontWeight:700, color: healthColor, animation: phase === 'typing-rec' ? 'tldr-fade-in 0.5s ease forwards' : 'none' }}>
                  Action Plan
                </span>
                <br />
                {phase === 'typing-rec' ? rec.slice(0, recLen) : rec}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function KpiDetailPage({
  kpi, country, selectedCities = [], cities, cityScales, countries,
  onBack, onCountryChange, onLocationChange,
  theme = 'dark', onThemeToggle,
  dateRange = '1M', onDateRangeChange,
  activeUser, onUserSwitch,
}) {
  const T = THEME[theme]
  const panel  = { backgroundColor:T.panelBg, border:`1px solid ${T.border}`, borderRadius:8, padding:'14px 16px' }
  const ttip   = { backgroundColor:T.tooltipBg, border:`1px solid ${T.tooltipBorder}`, color:T.text, fontSize:11, borderRadius:6 }
  const axTick = { fill:T.axTick, fontSize:11 }

  const period    = dateRange
  const setPeriod = onDateRangeChange ?? (() => {})
  const [slackOpen, setSlackOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [activeTooltip, setActiveTooltip] = useState(null)
  const chartContainerRef = useRef(null)
  const pageRef = useRef(null)

  // ── Export helpers ──
  function exportCSV() {
    const s = buildUnitSalesSeries(period, 1, selectedDailyTotal, country)
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
  const [linesVisible, setLinesVisible] = useState(false)
  const [lineAnimKey,  setLineAnimKey]  = useState(0)
  const [maxVarHovered, setMaxVarHovered] = useState(false)
  const maxVarDotPos = useRef({ cx: 0, cy: 0 })
  const prevCheckedSizeRef = useRef(checked.size)
  const [badgeAnimKey, setBadgeAnimKey] = useState(0)
  const [tldrReady, setTldrReady] = useState(checked.size > 0)
  const [tldrPhase, setTldrPhase] = useState('thinking')
  const BADGE_FADE_MS = 2200
  const [forecastTipHovered, setForecastTipHovered] = useState(null)

  const locationLabel = selectedCities.length === 0
    ? 'All'
    : selectedCities.length === 1 ? selectedCities[0] : `${selectedCities.length} Cities`

  // kpiCityScale: used only for non-Unit-Sales KPI card baseValue
  const kpiCountrySc = KPI_COUNTRY_SCALE[country] ?? 1
  const kpiCitySc = selectedCities.length === 0
    ? 1
    : selectedCities.reduce((sum, city) => sum + (cityScales[country]?.[city] ?? 0), 0)
  const kpiCityScale = kpiCountrySc * kpiCitySc
  const baseValue = parseNum(kpi.primary) * kpiCityScale

  // selectedDailyTotal: sum of country/city-adjusted dailyAvg for checked items
  const allItemsChecked = checked.size === BASE_ITEMS.length
  const selectedDailyTotal = useMemo(() => {
    if (checked.size === 0) return 0
    const items = allItemsChecked ? BASE_ITEMS : BASE_ITEMS.filter(i => checked.has(i.name))
    return items.reduce((s, item) => s + item.dailyAvg * getProductSalesFrac(item, country, selectedCities), 0)
  }, [checked, allItemsChecked, country, selectedCities])

  const checkedLabel = !allItemsChecked && checked.size === 1
    ? [...checked][0]
    : !allItemsChecked && checked.size > 1 ? `${checked.size} items selected` : null

  const series = useMemo(() => {
    const s = kpi.label.startsWith('Unit Sales')
      ? buildUnitSalesSeries(period, 1, selectedDailyTotal, country)
      : buildSeries(baseValue, period)
    if (period === '1D') console.log('1D series[0..3]:', s.slice(0,4).map(p => ({label:p.label, ty:p.thisYear, ly:p.lastYear})), '...noon:', {label:s[12]?.label, ty:s[12]?.thisYear})
    return s
  }, [kpi.label, period, selectedDailyTotal, baseValue, country])

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
      const cutIdx = _TODAY_HOUR_PT
      return series.map((pt, i) => ({
        ...pt,
        actual:   i <= cutIdx ? pt.thisYear : null,
        forecast: i >= cutIdx ? pt.thisYear : null,
      }))
    }
    // For other periods, include null actual/forecast so recharts data shape stays consistent
    return series.map(pt => ({ ...pt, actual: null, forecast: null }))
  }, [period, series])

  // Labels that have forecast data — used to identify which ticks get tooltips
  const forecastLabels = useMemo(
    () => new Set(seriesDisplay.filter(p => p.forecast != null).map(p => p.label)),
    [seriesDisplay]
  )

  // Max variance callout — find the data point where |thisYear - lastYear| is largest
  const maxVariancePt = useMemo(() => {
    if (checked.size === 0) return null
    let best = null
    for (const pt of seriesDisplay) {
      const ty = pt.actual ?? pt.thisYear
      const ly = pt.lastYear
      if (ty == null || ly == null) continue
      const diff = ty - ly
      if (!best || Math.abs(diff) > Math.abs(best.diff)) best = { label: pt.label, diff, ty, ly }
    }
    return best
  }, [checked, seriesDisplay])

  const varColor = !maxVariancePt || maxVariancePt.diff >= 0 ? '#4caf50' : '#f44336'

  const MAX_VAR_TIPS_POS = [
    "A regional promo on dairy and produce pulled 3 weeks of demand into this window, spiking units well above the prior year baseline.",
    "Early seasonal stocking ahead of a holiday weekend inflated velocity significantly above what was ordered in the same period last year.",
    "A key competitor ran out of stock across multiple retail locations, redirecting demand to this assortment for several consecutive weeks.",
    "New DC capacity added mid-period introduced incremental order flow that had no prior year equivalent in this region.",
  ]
  const MAX_VAR_TIPS_NEG = [
    "Port congestion at the primary inbound hub delayed 4 loads, pulling available units well below the prior year fulfillment level.",
    "A cold front disrupted ground freight across the region, extending inbound lead times by 3 to 4 days and compressing fill rates.",
    "A supplier quality hold on two high-velocity SKUs reduced fill rates for 10 consecutive days vs the same window last year.",
    "Carrier capacity tightened ahead of peak season, pushing allocation below contracted volumes and limiting units available this period.",
  ]

  // Custom dot renderer — normal dot for every point, pulsing ring + chip at max variance point
  const renderMaxVarDot = (dotProps, baseR, baseFill) => {
    const { cx, cy, payload } = dotProps
    if (!linesVisible || !maxVariancePt || payload.label !== maxVariancePt.label)
      return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={baseR} fill={baseFill} />
    maxVarDotPos.current = { cx, cy }
    const diff = maxVariancePt.diff
    const absDiff = Math.abs(diff)
    const num = absDiff >= 1e6
      ? `${(absDiff / 1e6).toFixed(1)}M`
      : absDiff >= 1e3
        ? `${(absDiff / 1e3).toFixed(1)}K`
        : String(Math.round(absDiff))
    const chip = `${diff >= 0 ? '▲ +' : '▼ '}${num} vs LY`
    const chipW = 92, chipH = 18, chipX = cx - chipW / 2, chipY = cy - 38
    return (
      <g key={`maxvar-${cx}-${cy}`} className="maxvar-callout"
        onMouseEnter={() => setMaxVarHovered(true)}
        onMouseLeave={() => setMaxVarHovered(false)}
        style={{ cursor: 'default' }}
      >
        <circle cx={cx} cy={cy} r={13} fill="none" stroke={varColor} strokeWidth={2} className="maxvar-ring" />
        <circle cx={cx} cy={cy} r={baseR + 1} fill={varColor} />
        <rect x={chipX} y={chipY} width={chipW} height={chipH} rx={4} fill={varColor} fillOpacity={0.92} />
        <text x={cx} y={chipY + 13} textAnchor="middle" fontSize={10} fontWeight="700" fill="#fff">{chip}</text>
      </g>
    )
  }

  // Inventory health stats for context panel
  const healthRows = useMemo(() => {
    const all = buildLeaderboard(period, 'wos', true, country, selectedCities)
    return checked.size === 0 ? [] : allItemsChecked ? all : all.filter(r => checked.has(r.name))
  }, [period, country, selectedCities, checked, allItemsChecked])
  const goodItems   = healthRows.filter(r => r.status === 'good')
  const lowItems    = healthRows.filter(r => r.status === 'low').sort((a,b) => a.wos - b.wos)
  const totalSales  = healthRows.reduce((s, r) => s + r.avgSales, 0)
  const _rawPct     = totalSales === 0 ? 0 : goodItems.reduce((s, r) => s + r.avgSales, 0) / totalSales * 100
  const healthPct   = isNaN(_rawPct) ? 0 : Math.round(_rawPct)
  const healthZone = healthPct >= 67 ? 'Healthy' : healthPct >= 34 ? 'At Risk' : 'Critical'
  const healthColor = healthPct >= 67 ? '#4caf50' : healthPct >= 34 ? '#ff9800' : '#f44336'
  const HEALTH_MESSAGES = {
    Healthy: [
      `Global freight conditions are stable following a period of OPEC-driven oil price movement, with no active weather systems or infrastructure disruptions affecting major shipping corridors.\n\nOpen carrier capacity across primary lanes creates a window to improve forward inventory positioning before seasonal demand tightens availability.\n\nAction Plan: Lock in forward freight commitments on the top-performing SKUs now to secure capacity and cost before Q3 peak narrows the window.\n\n• Carrier on-time at 94%+, fill rates above 98%\n• Lead times shortened 0.4 days on average\n• Freight rates stable across all primary lanes`,
      `Carrier economics are improving across the network as fuel markets soften and port throughput reaches multi-year highs, reducing inbound lead time pressure.\n\nFreight savings generated this period are available for reinvestment but will be absorbed by rising seasonal demand if not deployed before the summer pickup begins.\n\nAction Plan: Redirect this period's freight savings into safety stock builds for high-velocity perishables before summer demand absorbs the available budget.\n\n• Fuel surcharges dropped 14.2% → 12.5%\n• Perishable coverage at 9.2 weeks (FY high)\n• Port dwell at 2-year low of 2.1 days`,
      `Agricultural supply chains are operating on normal seasonal schedules, with strong growing conditions supporting well-stocked pipelines across all major commodity categories.\n\nAll tracked items are in a healthy coverage position and open lane capacity is available now, creating a brief window to pull orders forward without adding freight cost.\n\nAction Plan: Pull next week's replenishment orders forward by two days to use open lane capacity and reduce weekend stockout risk on dairy and produce.\n\n• All 20 SKUs above 8 weeks WoS\n• Transport cost per case down 2.1% YoY\n• Inbound receipt accuracy at 99.1%`,
      `Freight labor availability has improved and distribution infrastructure is operating comfortably within capacity, with no bottlenecks at key warehouse nodes in the ${country} region.\n\nThe portfolio is healthy across all but two items, which are trending toward Watch status and will need replenishment action before the next order cycle.\n\nAction Plan: Use available dock capacity to pull forward inbound receipts for Eggs and Whole Milk before they cross into Watch territory within the next ten days.\n\n• Eggs & Whole Milk trending to Watch in 10 days\n• Warehouse throughput at 78%, dock capacity available\n• Year-over-year unit sales up 6.2%`,
    ],
    'At Risk': [
      `Atlantic hurricane season activity above historical norms and rising fuel surcharges are tightening freight capacity across Gulf Coast and East Coast corridors serving ${country}, with no near-term relief expected.\n\nSix items have dropped below safe coverage levels and continued carrier delays will push additional SKUs into the critical zone before the next order cycle completes.\n\nAction Plan: Expedite replenishment for the four lowest-coverage items through a secondary carrier and alert store operations to a likely shelf gap on Bananas and Baby Spinach.\n\n• 6 SKUs below 6 weeks WoS\n• Store OOS complaints up 18% week over week\n• Spot freight rates up 11% over 3 weeks`,
      `A Gulf Coast weather event disrupted refinery operations last week, triggering fuel surcharge increases from two major carriers that take effect this billing cycle across routes into ${country}.\n\nFreight costs for this region are above budget threshold and three high-velocity items have no confirmed inbound receipts this week, creating simultaneous margin and shelf availability risk.\n\nAction Plan: Consolidate the next three replenishment runs into two loads to offset surcharge exposure and activate secondary sourcing review for the three at-risk SKUs.\n\n• Region shipping cost up $0.43 per unit\n• Margin impact at 4.2%, above 3% review threshold\n• Consolidation estimated to save $2,100 per cycle`,
      `A cold front system moving across interior freight corridors is creating weather holds on inbound shipments to ${country}, with historical data pointing to multi-day transit extensions before lanes clear.\n\nTwo of the most exposed items have no buffer stock staged locally and would cross into the critical zone if inbound receipts slip even a few days beyond their estimated arrival.\n\nAction Plan: Move buffer stock for OJ and Butter to the regional DC now, before carrier recovery timelines determine whether a stockout is avoidable.\n\n• OJ and Butter both under 4 weeks WoS, no buffer staged\n• 3 to 5% of shipments currently on weather hold\n• Similar events have added 1.5 to 2 days to transit`,
      `Pull-forward import activity ahead of anticipated tariff increases has overwhelmed port and distribution capacity, adding days to inbound supply chains across all import-dependent categories serving ${country}.\n\nOn-shelf availability has already declined and the receiving backlog is growing each shift, leaving the three lowest-coverage items at immediate risk if dock throughput does not improve.\n\nAction Plan: Secure dock priority for Russet Potatoes, Greek Yogurt, and OJ before additional backlog growth pushes their delayed receipts past the point of recovery.\n\n• On-shelf availability dropped 97.8% → 94.3% in one period\n• Receiving backlog at 14 hours, adding 1.5 hours per shift\n• 5 SKUs moved from Healthy to Watch status`,
    ],
    Critical: [
      `A carrier force majeure declaration has removed primary freight capacity from two key lanes serving ${country}, with spot market rates rising sharply and alternative capacity limited globally.\n\nSix items have already reached zero stock and revenue losses are compounding daily, with two SKUs in the highest-value categories accounting for the majority of forward exposure.\n\nAction Plan: Activate emergency replenishment for all items below two weeks of coverage and approve air freight for Butter and Baby Spinach without delay.\n\n• 6 SKUs at zero stock, on-shelf availability at 87%\n• Stockout losses running at $28K per day\n• Butter & Baby Spinach carry $340K in 7-day revenue exposure`,
      `A convergence of labor disruption, equipment shortfalls, and drought-driven rail capacity loss has triggered emergency surcharges and restricted freight options across most carrier tiers reaching ${country}.\n\nStockout losses are accelerating and active promotions are amplifying demand well beyond what remaining supply can absorb, with standard-cost replenishment no longer available.\n\nAction Plan: Suspend all promotional activity on low-coverage items this week to slow sell-through while procurement secures a standard-cost supply path.\n\n• Stockout losses $62K last week, $85K at risk this weekend\n• OOS complaints up 41% week over week\n• Spot supply available in 48 hrs at 28% above standard cost`,
      `Severe weather has suspended ground freight across multiple corridors into ${country} with no carrier recovery timeline confirmed, and conditions may extend closures through the end of the week.\n\nNine items have less than two weeks of supply remaining and store managers have already begun informal rationing, creating customer experience and consistency risk at the network level.\n\nAction Plan: Issue a formal sixty-percent allocation cap on Bananas, Butter, and Baby Spinach immediately to distribute remaining stock evenly before individual locations sell out.\n\n• 9 of 20 SKUs under 2 weeks of supply\n• Ground freight recovery estimated at 4 to 7 business days\n• Air freight running at 3.1x the standard ground rate`,
      `A surge in import pull-forward activity has overwhelmed warehouse and distribution capacity across the network, compressing storage and labor resources in ${country} with no relief expected near term.\n\nEight SKUs are already in the critical coverage range and operational performance is degrading as congestion builds, with the three most exposed items days away from zero stock.\n\nAction Plan: Escalate to supply chain leadership immediately to authorize emergency sourcing or demand reduction before multiple SKUs hit zero stock within the week.\n\n• 8 of 20 SKUs in the critical coverage range\n• Three worst-positioned items at approximately 4 days to zero\n• Warehouse at 97% capacity, pick accuracy down to 96.1%`,
    ],
  }
  const msgIdx = (country.length + period.length) % 4
  const healthTldr = (HEALTH_MESSAGES[healthZone] ?? HEALTH_MESSAGES.Healthy)[msgIdx]

  // Compute body / rec / bullets split
  const _apIdx = healthTldr.indexOf('Action Plan:')
  const tldrBody = (_apIdx >= 0 ? healthTldr.slice(0, _apIdx) : healthTldr).trim()
  const _recFull = _apIdx >= 0 ? healthTldr.slice(_apIdx + 'Action Plan:'.length).trim() : null
  const _bulletSplit = _recFull ? _recFull.split(/\n\n(?=•)/) : []
  const tldrRec     = _bulletSplit[0]?.trim() ?? null
  const tldrBullets = _bulletSplit[1]
    ? _bulletSplit[1].split('\n').filter(l => l.startsWith('• ')).map(l => l.slice(2))
    : []

  // Clear forecast tooltip when all items are deselected
  useEffect(() => {
    if (checked.size === 0) setForecastTipHovered(null)
  }, [checked.size])

  // Badge fade-in sequence: when transitioning from 0 → >0 selections, fade badge in first,
  // then reveal TldrPanel after badge animation completes
  useEffect(() => {
    const prev = prevCheckedSizeRef.current
    prevCheckedSizeRef.current = checked.size
    if (prev === 0 && checked.size > 0) {
      setBadgeAnimKey(k => k + 1)
      setTldrReady(false)
      const t = setTimeout(() => setTldrReady(true), BADGE_FADE_MS)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked.size])

  // Show variance bands first, then draw lines in after a short delay
  const selectedCitiesKey = selectedCities.join(',')
  useEffect(() => {
    setLinesVisible(false)
    setForecastTipHovered(null)
    const timer = setTimeout(() => {
      setLinesVisible(true)
      setLineAnimKey(k => k + 1)
    }, 600)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, country, selectedCitiesKey])

  const fmtAxis = v => {
    if (v>=1e6) return `${(v/1e6).toFixed(1)}M`
    if (v>=1e3) return `${(v/1e3).toFixed(1)}K`
    return String(Math.round(v))
  }

  const dropBtn = {
    backgroundColor: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.inputText,
    fontSize:12, padding:'4px 10px', borderRadius:4, cursor:'pointer',
    display:'flex', alignItems:'center', gap:6, height:28,
  }

  return (
    <div ref={pageRef} style={{ backgroundColor: T.bg, height:'100vh', display:'flex', flexDirection:'column', fontFamily:'Inter, system-ui, sans-serif', color: T.text, overflow:'hidden' }}>

      {/* ── Nav bar ── */}
      <div style={{ backgroundColor: T.navBg, borderBottom:`1px solid ${T.border}`, height:48, display:'flex', alignItems:'center', padding:'0 16px', gap:16, flexShrink:0 }}>
        <span style={{ fontSize:13, fontWeight:700, color: T.text, letterSpacing:'0.02em' }}>WarehouseIQ</span>
        <span style={{ color: T.sep }}>|</span>
        {[{id:'dashboard', label:'Dashboard'}, {id:'detail', label:'Unit Sales'}, {id:'geo', label:'Geo'}, {id:'inventory', label:'Inventory'}].map(tab => (
          <button key={tab.id} onClick={() => tab.id === 'dashboard' ? onBack() : onBack(tab.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize:12, fontWeight: tab.id === 'detail' ? 700 : 400,
            color: tab.id === 'detail' ? '#00bcd4' : T.textMuted,
            borderBottom: tab.id === 'detail' ? '2px solid #00bcd4' : '2px solid transparent',
            padding: '0 4px', height:48,
          }}>{tab.label}</button>
        ))}
        <span style={{ color: T.sep }}>|</span>
        <div style={{ display:'flex', gap:4 }}>
          {['1D','5D','1M','6M','YTD'].map(r => (
            <button key={r} onClick={() => onDateRangeChange(r)} style={{
              background: r === dateRange ? '#00bcd4' : 'transparent',
              color:      r === dateRange ? '#111' : T.textDim,
              border: `1px solid #00bcd4`, fontSize:12, padding:'3px 0', width:42, textAlign:'center',
              borderRadius:4, cursor:'pointer', fontWeight: r === dateRange ? 700 : 400,
              transition:'all 0.15s',
            }}>{r}</button>
          ))}
        </div>
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
          <Button
            variant="outline"
            size="icon"
            onClick={onThemeToggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ width:28, height:28, borderRadius:7, border:`1px solid ${T.inputBorder}`, backgroundColor: theme === 'dark' ? '#1c1c1c' : '#f5f5f5', marginLeft:4 }}
          >
            <Sun size={15} color={theme === 'dark' ? '#fff' : '#333'} />
          </Button>

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

          <button
            onClick={() => setVoiceOpen(o => !o)}
            title="WarehouseIQ Assistant"
            style={{
              width: 28, height: 28, borderRadius: 7, cursor: 'pointer', marginLeft: 4,
              border: voiceOpen ? '1px solid rgba(0,188,212,0.5)' : `1px solid ${T.inputBorder}`,
              background: voiceOpen ? 'rgba(0,188,212,0.12)' : (theme === 'dark' ? '#1c1c1c' : '#f5f5f5'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Mic size={15} color={voiceOpen ? '#00bcd4' : (theme === 'dark' ? '#fff' : '#333')} />
          </button>
          <button
            onClick={() => setSlackOpen(o => !o)}
            title="Slack — #warehouse-ops"
            style={{
              width: 28, height: 28, borderRadius: 7, cursor: 'pointer', marginLeft: 4,
              border: slackOpen ? '1px solid #00bcd4' : `1px solid ${T.inputBorder}`,
              background: slackOpen ? 'rgba(0,188,212,0.1)' : (theme === 'dark' ? '#1c1c1c' : '#f5f5f5'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="15" height="15" viewBox="73 73 125 125" xmlns="http://www.w3.org/2000/svg" style={{ opacity: slackOpen ? 1 : (theme === 'dark' ? 0.85 : 0.7) }}>
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
          {activeUser && <AccountSwitcher activeUser={activeUser} onSwitch={onUserSwitch} T={T} marginLeft={8} />}
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
          <Leaderboard period={period} country={country} selectedCities={selectedCities} checked={checked} onCheckedChange={setChecked} T={T}/>
        </div>

        {/* RIGHT: Meter + Chart */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10, minWidth:0 }}>

          {/* Meter + TL;DR row */}
          <div style={{ display:'flex', gap:10, flexShrink:0 }}>

            {/* Health Meter module */}
            <div style={{ ...panel, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:'2px 20px 22px', flexShrink:0, width:450, height:313, overflow:'hidden' }}>
              <MetricGauge period={period} country={country} selectedCities={selectedCities} checked={checked} T={T}/>
              {/* Health range legend */}
              <div style={{ width:'100%', display:'flex', flexDirection:'column', alignItems:'center' }}>
                <div style={{ fontSize:10, color: T.textDim, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6, textAlign:'center' }}>Health Ranges</div>
                <div style={{ display:'grid', gridTemplateColumns:'60px auto auto', gap:'4px 8px', alignItems:'center', width:'fit-content' }}>
                  {[
                    ['#4caf50', 'Healthy',  '≥ 67%', 'Most items adequately stocked'],
                    ['#ff9800', 'At Risk',  '34–66%', 'Multiple items running low'],
                    ['#f44336', 'Critical', '< 34%',  'Immediate restocking required'],
                  ].map(([color, label, range, desc]) => (
                    <React.Fragment key={label}>
                      <div style={{ width:60, backgroundColor: label === healthZone ? color+'66' : color+'22', border:`1px solid ${color}`, borderRadius:6, padding:'4px 10px', textAlign:'left' }}>
                        <div style={{ fontSize:10, fontWeight:700, color, lineHeight:1.2 }}>{range}</div>
                      </div>
                      <span style={{ fontSize:10, color, fontWeight:600 }}>{label}</span>
                      <span style={{ fontSize:10, color: T.textFaint }}>{desc}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            {/* TL;DR module — panel always rendered; content gated on selections */}
            <div style={{ ...panel, flex:1, padding:'27px 20px 12px', height:313, overflow:'hidden' }}>
              <style>{`@keyframes tldr-badge-fadein { from { opacity:0; transform:scale(0.88); } to { opacity:1; transform:scale(1); } }`}</style>
              {checked.size > 0 && (
              <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                {/* Badge */}
                <div key={badgeAnimKey} style={{ flexShrink:0, width:80, backgroundColor: healthColor+'22', border:`1px solid ${healthColor}`, borderRadius:8, padding:'8px 10px', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', animation:`tldr-badge-fadein ${BADGE_FADE_MS}ms cubic-bezier(0.34,1.56,0.64,1) forwards` }}>
                  <div style={{ fontSize:26, fontWeight:700, color: healthColor, lineHeight:1.1 }}>{isNaN(healthPct) ? 0 : healthPct}%</div>
                  <div style={{ fontSize:10, color: healthColor, fontWeight:600, marginTop:3 }}>{healthZone}</div>
                </div>
                {/* TL;DR — only renders after badge fade-in completes */}
                {tldrReady && (
                <TldrPanel
                  body={tldrBody}
                  rec={tldrRec}
                  healthColor={healthColor}
                  T={T}
                  triggerKey={`${period}-${country}-${selectedCitiesKey}`}
                  onPhaseChange={setTldrPhase}
                />
                )}
                {/* Bullets column */}
                {tldrBullets.length > 0 && (
                  <div style={{ width:1, alignSelf:'stretch', backgroundColor: T.border, flexShrink:0, margin:'0 8px' }} />
                )}
                {tldrBullets.length > 0 && (tldrPhase === 'typing-rec' || tldrPhase === 'done') && (
                  <div style={{ flexShrink:0, marginTop:'-0.1em', animation:'tldr-badge-fadein 400ms ease forwards' }}>
                    {tldrBullets.map((b, idx) => (
                      <div key={idx} style={{ fontSize:12, color: T.textMuted, lineHeight:1.6, marginBottom:6 }}>{b}</div>
                    ))}
                  </div>
                )}
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
                  {kpi.label} — Trend {locationLabel}
                  {checked.size === 1
                    ? `, ${[...checked][0]}`
                    : !allItemsChecked && checked.size > 1
                      ? ` (${checked.size} items selected)`
                      : ''}
                </span>
              </div>
              <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:2 }}>
                <div style={{ display:'flex', gap:12 }}>
                  {[
                    ['This Year','#00bcd4','solid'],
                    ['Last Year','#ff9800','dashed'],
                    ...(['YTD','1D'].includes(period) ? [['Forecast','#00bcd4','dotted']] : []),
                  ].map(([l,c,d])=>(
                    <span key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:c }}>
                      <svg width={22} height={10}>
                        <line x1={0} y1={5} x2={22} y2={5} stroke={c} strokeWidth={d==='solid'?2:1.5}
                          strokeDasharray={d==='dashed'?'4 3':d==='dotted'?'3 3':undefined} strokeOpacity={d==='dotted'?0.6:1}/>
                        {d !== 'dotted' && <circle cx={11} cy={5} r={3} fill={c}/>}
                      </svg>
                      {l}
                    </span>
                  ))}
                  <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#fff' }}>
                    <span style={{ width:18, height:8, backgroundColor:'rgba(0,188,212,0.18)', borderRadius:2, display:'inline-block' }}/>
                    Variance
                  </span>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div ref={chartContainerRef} style={{ flex:1, minHeight:0, position:'relative' }}>
              <style>{`
                @keyframes maxvar-pulse {
                  0%   { transform: scale(1);   opacity: 0.75; }
                  70%  { transform: scale(2.0); opacity: 0;    }
                  100% { transform: scale(2.0); opacity: 0;    }
                }
                @keyframes maxvar-fadein {
                  0%   { opacity: 0; }
                  100% { opacity: 1; }
                }
                .maxvar-ring    { transform-box: fill-box; transform-origin: center; animation: maxvar-pulse 1.8s ease-out infinite; }
                .maxvar-callout { animation: maxvar-fadein 0.5s ease-in forwards; }
              `}</style>
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
                  <XAxis dataKey="label" stroke={T.border} interval={0} tickLine={false} tick={({ x, y, payload }) => {
                    const isNow = (period === '1D'  && payload.value === CURRENT_LABEL_1D)
                               || (period === 'YTD' && payload.value === CURRENT_LABEL_YTD)
                    const isForecast = ['YTD','1D'].includes(period) && forecastLabels.has(payload.value)
                    const shouldAngle = period === '1D' || (period === 'YTD' && isForecast)
                    const textEl = (
                      <text
                        x={x} y={y + 4}
                        textAnchor={shouldAngle ? 'end' : 'middle'}
                        fontSize={11}
                        fill={isNow ? '#00bcd4' : isForecast ? 'rgba(0,188,212,0.65)' : T.axTick}
                        fontWeight={isNow ? 700 : 400}
                        transform={shouldAngle ? `rotate(-35, ${x}, ${y + 4})` : undefined}
                      >
                        {payload.value}
                      </text>
                    )
                    return textEl
                  }}/>
                  <YAxis stroke={T.border} tick={axTick} tickFormatter={fmtAxis} width={46} domain={yDomain}/>
                  <Tooltip content={() => null} cursor={<ExtendedCursor />}/>
                  {/* Shading band — drawn before grid so grid renders on top */}
                  <Area type="monotone" dataKey="upper" fill="rgba(0,188,212,0.15)" stroke="none" fillOpacity={1} isAnimationActive={false} activeDot={false} dot={false} baseValue={yDomain[0]}/>
                  <Area type="monotone" dataKey="lower" fill={T.chartMask}          stroke="none" fillOpacity={1} isAnimationActive={false} activeDot={false} dot={false} baseValue={yDomain[0]}/>
                  {/* Grid on top of fill so lines show through */}
                  <CartesianGrid strokeDasharray="3 3" stroke={T.chartGrid} vertical={false}/>
                  {/* Lines — always render all three; use hide to toggle so recharts doesn't lose track */}
                  <Line key={`ly-${lineAnimKey}`} type="monotone" dataKey="lastYear" stroke="#ff9800" strokeWidth={1.5}
                    dot={{ r:2.5, fill:'#ff9800', strokeWidth:0 }} activeDot={{ r:4 }} name="Last Year"
                    animationDuration={3800} animationEasing="ease-in-out"
                    hide={!linesVisible}/>
                  <Line key={`ty-${lineAnimKey}`} type="monotone" dataKey="thisYear" stroke="#00bcd4" strokeWidth={2}
                    dot={(p) => renderMaxVarDot(p, 3, '#00bcd4')} activeDot={{ r:5 }} name="This Year"
                    animationDuration={3800} animationEasing="ease-in-out"
                    hide={!linesVisible || ['YTD','1D'].includes(period)}/>
                  <Line key={`ac-${lineAnimKey}`} type="monotone" dataKey="actual" stroke="#00bcd4" strokeWidth={2}
                    dot={(p) => renderMaxVarDot(p, 3, '#00bcd4')} activeDot={{ r:5 }} name="This Year"
                    connectNulls={false} animationDuration={3800} animationEasing="ease-in-out"
                    hide={!linesVisible || !['YTD','1D'].includes(period)}/>
                  <Line key={`fc-${lineAnimKey}`} type="monotone" dataKey="forecast" stroke="#00bcd4" strokeWidth={1.5}
                    strokeDasharray="4 4" strokeOpacity={0.55}
                    dot={{ r:2.5, fill:'#00bcd4', strokeWidth:0, fillOpacity:0.5 }} activeDot={{ r:4 }} name="Forecast"
                    connectNulls={false} animationDuration={3800} animationEasing="ease-in-out"
                    hide={!linesVisible || !['YTD','1D'].includes(period)}/>
                </ComposedChart>
              </ResponsiveContainer>

              {/* Inline overlay labels — float above the highest line at the hovered point */}
              {activeTooltip?.x != null && checked.size > 0 && !forecastTipHovered && (() => {
                const { ty, ly, x } = activeTooltip
                const delta      = ty != null && ly != null ? ty - ly : null
                const containerH = chartContainerRef.current?.clientHeight ?? 200
                const plotH      = containerH - 8 - 8
                const maxVal     = Math.max(ty ?? 0, ly ?? 0)
                const yFrac      = (maxVal - yDomain[0]) / (yDomain[1] - yDomain[0])
                const yPx        = 8 + plotH * (1 - yFrac)
                const topPx      = Math.max(2, yPx - 73)
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

              {/* Max variance hover tooltip — expands above the chip on dot hover */}
              {maxVarHovered && maxVariancePt && (() => {
                const { cx, cy } = maxVarDotPos.current
                const tipIdx = (country.length + period.length) % 4
                const tip = maxVariancePt.diff >= 0 ? MAX_VAR_TIPS_POS[tipIdx] : MAX_VAR_TIPS_NEG[tipIdx]
                const title = maxVariancePt.diff >= 0 ? 'Why the gap is up' : 'Why the gap is down'
                return (
                  <div style={{
                    position: 'absolute',
                    top: Math.max(4, cy - 38 - 96),
                    left: cx,
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                    backgroundColor: T.panelBg,
                    border: `1px solid ${varColor}88`,
                    borderRadius: 7,
                    padding: '8px 12px',
                    width: 210,
                    boxShadow: `0 4px 16px rgba(0,0,0,0.4)`,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: varColor, marginBottom: 5, letterSpacing: '0.03em' }}>
                      {title}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.55 }}>
                      {tip}
                    </div>
                  </div>
                )
              })()}

              {/* Forecast tick hit areas — HTML divs avoid recharts SVG pointer-events:none */}
              {linesVisible && checked.size > 0 && ['YTD','1D'].includes(period) && (() => {
                const containerW = chartContainerRef.current?.clientWidth ?? 0
                if (!containerW) return null
                const leftOffset = 8 + 46   // margin.left + yAxisWidth
                const rightMargin = 16
                const plotW = containerW - leftOffset - rightMargin
                const count = period === 'YTD' ? 10 : 24
                const bottomH = period === '1D' ? 80 : 60
                return seriesDisplay.map((pt, idx) => {
                  if (!forecastLabels.has(pt.label)) return null
                  const cx = leftOffset + (idx + 0.5) * (plotW / count)
                  return (
                    <div
                      key={`fchit-${pt.label}`}
                      onMouseEnter={() => { setForecastTipHovered({ label: pt.label, x: cx }); setActiveTooltip(null) }}
                      onMouseLeave={() => setForecastTipHovered(null)}
                      style={{
                        position: 'absolute', bottom: 0,
                        left: cx - 36, width: 72, height: bottomH,
                        cursor: 'default', zIndex: 10,
                      }}
                    />
                  )
                })
              })()}

              {/* Forecast tick tooltip */}
              {forecastTipHovered && checked.size > 0 && (() => {
                const tip = period === 'YTD'
                  ? YTD_FORECAST_TIPS[forecastTipHovered.label]
                  : HOUR_FORECAST_TIPS[forecastTipHovered.label]
                if (!tip) return null
                const containerW = chartContainerRef.current?.clientWidth ?? 600
                const leftPx = Math.min(Math.max(forecastTipHovered.x, 140), containerW - 140)
                return (
                  <div style={{
                    position: 'absolute',
                    // chart bottom margin + label height + 15px gap above label
                    bottom: (period === '1D' ? 40 : 8) + 11 + 30,
                    left: leftPx,
                    transform: 'translateX(-50%)',
                    width: 'max-content',
                    minWidth: 280,
                    maxWidth: 420,
                    pointerEvents: 'none',
                    backgroundColor: T.tooltipBg,
                    border: '1px solid rgba(0,188,212,0.4)',
                    borderRadius: 8,
                    padding: '11px 14px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    zIndex: 20,
                  }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#00bcd4', marginBottom:6, letterSpacing:'0.03em' }}>
                      {tip.headline}
                    </div>
                    <div style={{ fontSize:11, color:T.textMuted, lineHeight:1.65 }}>
                      {tip.body}
                    </div>
                    <div style={{ fontSize:9, fontWeight:600, color:'rgba(0,188,212,0.55)', marginTop:8, paddingTop:6, borderTop:`1px solid ${T.border}`, letterSpacing:'0.04em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                      {tip.confidence}
                    </div>
                  </div>
                )
              })()}
            </div>

          </div>

        </div>
      </div>

      <SlackPanel open={slackOpen} onClose={() => setSlackOpen(false)} theme={theme} activeUser={activeUser} />
      <VoiceAssistant open={voiceOpen} onClose={() => setVoiceOpen(false)} theme={theme} country={country} activeUser={activeUser} />
    </div>
  )
}
