import { useState } from 'react'
import { X, Zap } from 'lucide-react'

// ── Country aware headlines + AI insights ────────────────────────────────────

const TICKER_DATA = {
  'United States': {
    headlines: [
      'Port of LA LB congestion eases   inbound transit times down 1.2 days',
      'UPS driver negotiations resume   labor analysts flag 18% strike risk',
      'FedEx announces 5.9% general rate increase effective February 2026',
      'Cold storage utilization at 91% ahead of holiday frozen food season',
      'Rail intermodal volume up 4.2% YoY as shippers pivot from full truckload',
      'USPS Ground Advantage expands same day to 14 new metro markets',
    ],
    insights: [
      { headline: 'Port of LA LB congestion eases   inbound transit times down 1.2 days', impact: 'Moderate', bullets: ['West Coast inbound orders held >7 days can now be released safely', 'Review California DC replenishment schedule   window to pull orders forward', 'Cold chain still constrained   prioritize frozen SKU transfers first'] },
      { headline: 'UPS driver negotiations resume   labor analysts flag 18% strike risk', impact: 'High', bullets: ['18% strike probability warrants dual carrier contingency planning now', 'Pre position 2 3 weeks of top velocity SKUs at regional distribution centers', 'Activate FedEx and regional carrier rate agreements as fallback immediately'] },
      { headline: 'FedEx announces 5.9% general rate increase effective February 2026', impact: 'High', bullets: ['5.9% GRI adds est. $0.34/unit to current average shipment cost', 'Review carrier mix   GROUND vs PRIORITY allocation may need rebalancing', 'Consider locking Q1 2026 volume commitments before rate effective date'] },
      { headline: 'Cold storage utilization at 91% ahead of holiday frozen food season', impact: 'High', bullets: ['Frozen Foods WOS should be reviewed   demand spike risk in 3 4 weeks', 'Identify overflow cold storage partners in LA and Chicago markets now', 'Accelerate outbound velocity on slow moving frozen SKUs to free capacity'] },
      { headline: 'Rail intermodal volume up 4.2% YoY as shippers pivot from full truckload', impact: 'Low', bullets: ['Intermodal shift signals trucker capacity loosening   rate opportunity', 'Review lane economics for Chicago West Coast corridor this quarter', 'No immediate action needed   monitor for Q2 carrier rate renegotiation'] },
      { headline: 'USPS Ground Advantage expands same day to 14 new metro markets', impact: 'Low', bullets: ['New USPS coverage may offer 15 20% cost reduction on last mile in new markets', 'Evaluate for DTC shipments under 1 lb in newly covered zones', 'Update carrier routing rules if operating in newly covered metros'] },
    ],
  },
  'Canada': {
    headlines: [
      'CN Rail reports 3 day delays on Vancouver Toronto corridor due to weather',
      'Canada Post resumes full operations following contract settlement',
      'Purolator expands same day coverage to Calgary and Edmonton suburbs',
      'US CA cross border duties under review   USMCA compliance audit wave',
      'Canadian cold chain operators warn of capacity squeeze ahead of winter',
    ],
    insights: [
      { headline: 'CN Rail reports 3 day delays on Vancouver Toronto corridor due to weather', impact: 'High', bullets: ['Eastbound replenishment from Vancouver DC delayed 3+ days minimum', 'Activate Toronto safety stock protocols for top 20 SKUs immediately', 'Consider air freight for critical frozen or refrigerated items this week'] },
      { headline: 'Canada Post resumes full operations following contract settlement', impact: 'Low', bullets: ['DTC backlog from the stoppage should clear within 5 7 business days', 'Review customer SLA credits owed from the delay period', 'No volume rerouting needed   resume normal Canada Post allocation'] },
      { headline: 'Purolator expands same day coverage to Calgary and Edmonton suburbs', impact: 'Low', bullets: ['New same day zones align with your Alberta distribution footprint', 'Evaluate Purolator rate card vs current SAME_DAY carrier for AB lanes', 'Opportunity to improve Alberta NPS scores with faster last mile offering'] },
      { headline: 'US CA cross border duties under review   USMCA compliance audit wave', impact: 'Moderate', bullets: ['Ensure all US origin SKUs have current USMCA certificates of origin on file', 'Flag any products with tariff classification changes in the past 12 months', 'Brief customs broker on audit wave   schedule compliance review this week'] },
      { headline: 'Canadian cold chain operators warn of capacity squeeze ahead of winter', impact: 'High', bullets: ['Book Q4 cold storage capacity now   historically tightens by Oct 15', 'Identify 2 backup cold chain providers per region as contingency', 'Accelerate slow moving frozen SKU promotions to reduce current footprint'] },
    ],
  },
  'Germany': {
    headlines: [
      'EU carbon border adjustment mechanism adds complexity to imports from Asia',
      'DHL reports 98.2% on time delivery rate in German domestic network',
      'Duisburg inland port volumes up 8% as Rhine water levels normalize',
      'German customs authority issues new HS code guidance for electronics',
      'DB Schenker rail volumes recover following Q3 infrastructure maintenance',
    ],
    insights: [
      { headline: 'EU carbon border adjustment mechanism adds complexity to imports from Asia', impact: 'High', bullets: ['CBAM reporting obligation begins Jan 2026 for all affected product categories', 'Audit your Asia origin SKUs for carbon intensity documentation requirements', 'Engage customs broker for CBAM compliance roadmap before year end'] },
      { headline: 'DHL reports 98.2% on time delivery rate in German domestic network', impact: 'Low', bullets: ['DHL domestic performance is at a 3 year high   favorable for SLA commitments', 'Consider shifting additional GROUND volume to DHL on German lanes', 'Use performance data in carrier review to negotiate improved rate terms'] },
      { headline: 'Duisburg inland port volumes up 8% as Rhine water levels normalize', impact: 'Moderate', bullets: ['Rhine corridor capacity returning   barge rates expected to soften 5 8%', 'Review Q4 container positioning via Duisburg for Asia Europe lanes', 'Good window to pre position seasonal inventory via inland waterway'] },
      { headline: 'German customs authority issues new HS code guidance for electronics', impact: 'Moderate', bullets: ['Review all electronics SKUs against updated HS code classifications now', 'Reclassification errors can trigger retroactive duty assessments', 'Coordinate with freight forwarder to update customs declarations proactively'] },
      { headline: 'DB Schenker rail volumes recover following Q3 infrastructure maintenance', impact: 'Low', bullets: ['Rail capacity returning to normal on Frankfurt Hamburg corridor', 'Intermodal window opening   evaluate for Q4 holiday replenishment flows', 'DB Schenker rate card may be negotiable with volume commitment offer'] },
    ],
  },
  'Japan': {
    headlines: [
      'Yamato Transport raises residential delivery fees amid labor shortage',
      'Port of Yokohama expanding container terminal capacity through 2027',
      'Japan Post implements new parcel weight tier restructuring in April',
      'Sagawa Express and FedEx expand joint last mile partnership in 3 cities',
      'Cold chain disruption reported in Tohoku region following seismic activity',
    ],
    insights: [
      { headline: 'Yamato Transport raises residential delivery fees amid labor shortage', impact: 'Moderate', bullets: ['Residential surcharge increase of ~¥180/parcel effective next quarter', 'Shift non urgent residential deliveries to Japan Post where cost effective', 'Review DTC shipment carrier mix for residential heavy postal codes'] },
      { headline: 'Port of Yokohama expanding container terminal capacity through 2027', impact: 'Low', bullets: ['Expansion signals long term improvement for inbound Asia Pacific flows', 'Near term construction may cause minor berth delays   monitor weekly', 'No immediate operational changes needed   positive 24 month outlook'] },
      { headline: 'Cold chain disruption reported in Tohoku region following seismic activity', impact: 'High', bullets: ['Immediately audit frozen and chilled inventory exposure in Tohoku facilities', 'Activate contingency routing via Sendai air freight for critical SKUs', 'Check cold storage partner status in affected zones before next replenishment'] },
      { headline: 'Japan Post implements new parcel weight tier restructuring in April', impact: 'Moderate', bullets: ['Re run carrier cost analysis against new Japan Post weight tiers now', 'SKUs in the 500g 1kg range may see the most significant rate changes', 'Update logistics cost models before the April implementation date'] },
      { headline: 'Sagawa Express and FedEx expand joint last mile partnership in 3 cities', impact: 'Low', bullets: ['New partnership may improve FedEx last mile performance in Osaka, Nagoya, Fukuoka', 'Evaluate for international e commerce fulfillment in these three metros', 'Request updated SLA guarantees from FedEx for newly covered service zones'] },
    ],
  },
  'Korea': {
    headlines: [
      'CJ Logistics reports record Q3 throughput at Incheon fulfillment hub',
      'Korea EU FTA utilization rate rises to 78%   compliance teams on alert',
      'Coupang Rocket Delivery expands same day to 8 additional regional cities',
      'Busan Port dwell times improve to 1.8 days as congestion clears',
      'Cold chain pharma food co storage regulations tighten under new MOF rules',
    ],
    insights: [
      { headline: 'CJ Logistics reports record Q3 throughput at Incheon fulfillment hub', impact: 'Low', bullets: ['CJ capacity is healthy   good window for Q4 holiday peak planning now', 'Consider pre positioning seasonal SKUs at Incheon for faster fulfillment', 'Leverage CJ performance data in upcoming carrier contract renewal'] },
      { headline: 'Korea EU FTA utilization rate rises to 78%   compliance teams on alert', impact: 'Moderate', bullets: ['Audit EU origin SKUs for rules of origin documentation currency', 'FTA compliance audits typically follow utilization rate spikes   prepare now', 'Confirm certificate of origin processes are current with your customs broker'] },
      { headline: 'Coupang Rocket Delivery expands same day to 8 additional regional cities', impact: 'Low', bullets: ['New Coupang zones increase same day reach for DTC and marketplace orders', 'Evaluate Fulfillment by Coupang for top 20 SKUs in newly covered cities', 'Speed improvement may lift conversion rates in affected regions'] },
      { headline: 'Busan Port dwell times improve to 1.8 days as congestion clears', impact: 'Moderate', bullets: ['Busan clearance improvement reduces Asia Pacific inbound buffer need', 'Consider pulling in Q4 replenishment orders by 3 5 days', 'Monitor for 2 3 weeks before permanently reducing safety stock buffers'] },
      { headline: 'Cold chain pharma food co storage regulations tighten under new MOF rules', impact: 'High', bullets: ['Audit all co located cold storage facilities for new MOF compliance', 'Food pharma co storage prohibition may require facility restructuring', 'Engage Korean customs counsel   penalties for violations are substantial'] },
    ],
  },
  'China': {
    headlines: [
      'COSCO expands Pacific route capacity 12% amid rising cross border e commerce',
      'CNY holiday logistics blackout window confirmed Jan 28   Feb 11',
      'Shanghai bonded warehouse utilization reaches 94%   space constraints likely',
      'SF Express launches AI powered dynamic routing across 156 domestic cities',
      'Shenzhen customs clearance delays reported due to new inspection protocols',
    ],
    insights: [
      { headline: 'COSCO expands Pacific route capacity 12% amid rising cross border e commerce', impact: 'Low', bullets: ['12% capacity increase may soften Pacific lane rates in Q1 2026', 'Good window to negotiate trans Pacific spot rates for H1 2026', 'Monitor for blank sailings that could offset the capacity announcement'] },
      { headline: 'CNY holiday logistics blackout window confirmed Jan 28   Feb 11', impact: 'High', bullets: ['All outbound China shipments must be dispatched before January 25', 'Pre position 3 4 weeks of China origin SKUs at regional DCs now', 'Alert procurement to accelerate any pending China purchase orders immediately'] },
      { headline: 'Shanghai bonded warehouse utilization reaches 94%   space constraints likely', impact: 'High', bullets: ['Book additional bonded warehouse space before utilization hits 98%', 'Identify Ningbo and Tianjin as overflow alternatives for Shanghai flows', 'Review slow moving SKUs in Shanghai bonded zones for early outbound clearing'] },
      { headline: 'SF Express launches AI powered dynamic routing across 156 domestic cities', impact: 'Low', bullets: ["SF's routing upgrade may improve domestic China delivery times by 8 12%", 'Evaluate SF Express for time sensitive domestic China replenishment lanes', 'Request updated SLA commitments from your SF account manager'] },
      { headline: 'Shenzhen customs clearance delays reported due to new inspection protocols', impact: 'High', bullets: ['Add 2 3 day buffer to all Shenzhen origin shipment lead times immediately', 'Pre advise inspection documentation to your customs broker before goods arrive', 'Consider routing urgent shipments via Guangzhou or Hong Kong temporarily'] },
    ],
  },
  'Mexico': {
    headlines: [
      'AIFA cargo terminal expansion boosts nearshore logistics capacity near Mexico City',
      'Nearshoring wave drives 22% YoY growth in Monterrey industrial parks',
      'Customs authority implements new IMMEX program digital submission requirements',
      'DHL Mexico reports transit time improvement on US MX cross border lanes',
      'Veracruz port productivity rises 15% following labor agreement finalization',
    ],
    insights: [
      { headline: 'AIFA cargo terminal expansion boosts nearshore logistics capacity near Mexico City', impact: 'Low', bullets: ['AIFA expansion improves CDMX air cargo capacity   favorable for time sensitive inbound', 'Evaluate AIFA routing for US origin air freight replacing AICM where feasible', 'New capacity expected to reduce air cargo rates in CDMX metro by Q2 2026'] },
      { headline: 'Nearshoring wave drives 22% YoY growth in Monterrey industrial parks', impact: 'Moderate', bullets: ['Monterrey DC capacity is tightening   secure lease options now if expansion planned', 'Nearshoring growth signals improving Monterrey labor market for warehouse staff', 'Consider Saltillo as overflow DC option as Monterrey industrial space tightens'] },
      { headline: 'Customs authority implements new IMMEX program digital submission requirements', impact: 'High', bullets: ['IMMEX digital filing mandatory for all maquiladora operations by Q1 2026', 'Audit current customs broker for digital filing readiness and certification status', 'Non compliance risk: temporary import program suspension   review immediately'] },
      { headline: 'DHL Mexico reports transit time improvement on US MX cross border lanes', impact: 'Low', bullets: ['Cross border improvement means US replenishment lead times may compress by 1 day', 'Review safety stock levels on US origin SKUs for Monterrey and Guadalajara DCs', 'Verify with DHL account manager which specific lanes and modes are included'] },
      { headline: 'Veracruz port productivity rises 15% following labor agreement finalization', impact: 'Moderate', bullets: ['Veracruz clearance improvements benefit Asia Mexico inbound lane performance', 'Consider shifting some Shanghai Los Angeles Truck Mexico volume to direct Veracruz', '15% productivity gain should reduce average dwell time by approximately 0.6 days'] },
    ],
  },
}

const DEFAULT_HEADLINES = [
  'Global freight rates stabilize after Q3 volatility   analysts project flat Q4',
  'Air cargo demand up 6.1% YoY driven by electronics and pharmaceutical sectors',
  'Ocean carrier blank sailing rate rises to 18%   capacity management in effect',
  'Last mile delivery costs reach record $10.10 per parcel average globally',
  'Blockchain based freight tracking adoption accelerates among top 20 3PLs',
]

const DEFAULT_INSIGHTS = [
  { headline: 'Global freight rates stabilize after Q3 volatility', impact: 'Low', bullets: ['Rate stability creates a window for carrier contract renegotiations', 'Lock in favorable spot rates for Q1 before seasonal demand picks up', 'Benchmark current carrier rates against published indices this week'] },
  { headline: 'Air cargo demand up 6.1% YoY', impact: 'Moderate', bullets: ['Rising air demand may pressure express carrier capacity in Q4', 'Pre book air freight capacity now for critical holiday season replenishment', 'Review airfreight threshold SKUs   economy air may offer cost savings'] },
  { headline: 'Ocean carrier blank sailing rate rises to 18%', impact: 'High', bullets: ['18% blank sailing rate signals effective capacity cut of ~1.8M TEUs', 'Add 5 7 day buffer to all ocean lead times for the next 6 weeks', 'Expedite any ocean shipments currently at risk of missing holiday windows'] },
]

// ── Impact palette   semi transparent so it works on any bg ─────────────────

const IMPACT = {
  High:     { color: '#e53935', bg: 'rgba(229,57,53,0.10)',  border: 'rgba(229,57,53,0.30)'  },
  Moderate: { color: '#f57c00', bg: 'rgba(245,124,0,0.10)',  border: 'rgba(245,124,0,0.30)'  },
  Low:      { color: '#00897b', bg: 'rgba(0,137,123,0.10)',  border: 'rgba(0,137,123,0.30)'  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewsTicker({ country, T }) {
  const [insightIdx, setInsightIdx] = useState(0)
  const [showPanel, setShowPanel]   = useState(false)

  const data     = TICKER_DATA[country] ?? { headlines: DEFAULT_HEADLINES, insights: DEFAULT_INSIGHTS }
  const insights = data.insights.length ? data.insights : DEFAULT_INSIGHTS

  // Double the headlines so the CSS loop is seamless
  const doubled = [...data.headlines, ...data.headlines]

  function openInsight() {
    setInsightIdx(prev => (prev + 1) % insights.length)
    setShowPanel(true)
  }

  const insight = insights[insightIdx]
  const imp     = IMPACT[insight?.impact] ?? IMPACT.Low

  return (
    <>
      {/* ── Inline ticker (lives inside the nav flex row) ── */}
      <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:8, overflow:'hidden' }}>

        {/* LIVE badge */}
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(229,57,53,0.10)',
          border: '1px solid rgba(229,57,53,0.30)',
          borderRadius: 4, padding: '2px 7px',
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            backgroundColor: '#e53935',
            animation: 'wiq-live-pulse 1.5s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: '#e53935' }}>LIVE</span>
        </div>

        {/* Scrolling headline text */}
        <div
          style={{ flex: 1, overflow: 'hidden', cursor: 'pointer', minWidth: 0 }}
          title="Click for AI analysis"
          onClick={openInsight}
        >
          <div style={{
            display: 'inline-block',
            width: 'max-content',
            whiteSpace: 'nowrap',
            fontSize: 11,
            animation: showPanel ? 'none' : 'wiq-ticker 70s linear infinite',
          }}>
            {doubled.map((h, i) => (
              <span key={i}>
                <span style={{ color: T.textMuted }}>{h}</span>
                <span style={{ color: T.text, margin: '0 10px' }}>|</span>
              </span>
            ))}
          </div>
        </div>

        {/* AI badge */}
        <div
          onClick={openInsight}
          title="Get AI analysis"
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3,
            background: T.activeItemBg,
            border: `1px solid ${T.border}`,
            borderRadius: 4, padding: '2px 7px', cursor: 'pointer',
          }}
        >
          <Zap size={9} color={T.tabActive} />
          <span style={{ fontSize: 9, fontWeight: 700, color: T.tabActive, letterSpacing: '0.06em' }}>AI</span>
        </div>
      </div>

      {/* ── AI Insight panel   fixed below nav, centered ── */}
      {showPanel && insight && (
        <div style={{
          position: 'fixed', top: 49, left: '50%', transform: 'translateX(-50%)',
          width: 680, maxWidth: '90vw', zIndex: 200,
          backgroundColor: T.cardBg,
          border: `1px solid ${T.border}`,
          borderTop: `2px solid ${imp.color}`,
          borderRadius: '0 0 10px 10px',
          padding: '14px 18px 16px',
          boxShadow: T.cardShadow ?? '0 12px 40px rgba(0,0,0,0.35)',
        }}>

          {/* Close button — absolute top right */}
          <button
            onClick={() => setShowPanel(false)}
            style={{
              position: 'absolute', top: 8, right: 10,
              background: 'none', border: 'none', cursor: 'pointer',
              color: T.textMuted, padding: '2px 4px', borderRadius: 4, lineHeight: 1,
            }}
          >
            <X size={13} />
          </button>

          {/* Header row */}
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 10 }}>
            <Zap size={12} color={T.tabActive} />
            <span style={{ fontSize: 10, fontWeight: 800, color: T.tabActive, letterSpacing: '0.08em' }}>AI ANALYSIS</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: imp.color, background: imp.bg, border: `1px solid ${imp.border}`, borderRadius: 3, padding: '1px 7px' }}>
              {insight.impact.toUpperCase()} IMPACT
            </span>
          </div>

          {/* Headline quote */}
          <div style={{ fontSize: 11, color: T.textDim, fontStyle: 'italic', marginBottom: 12, lineHeight: 1.5 }}>
            "{insight.headline}"
          </div>

          {/* Action bullets */}
          <div style={{ display:'flex', flexDirection:'column', gap: 7 }}>
            {insight.bullets.map((b, i) => (
              <div key={i} style={{ display:'flex', gap: 9, alignItems:'flex-start' }}>
                <span style={{ color: T.tabActive, fontSize: 11, flexShrink: 0, marginTop: 1 }}>▸</span>
                <span style={{ fontSize: 11, color: T.text, lineHeight: 1.55 }}>{b}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ marginTop: 12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <button
              onClick={openInsight}
              style={{
                fontSize: 10, color: T.tabActive,
                background: T.activeItemBg,
                border: `1px solid ${T.border}`,
                borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
              }}
            >
              Next insight →
            </button>
          </div>
        </div>
      )}
    </>
  )
}
