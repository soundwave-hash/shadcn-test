import { useState } from 'react'

// ── Severity palette ──────────────────────────────────────────────────────────

const SEV = {
  critical: { color: '#dc2626', bg: 'rgba(220,38,38,0.10)', border: 'rgba(220,38,38,0.28)', label: 'CRITICAL' },
  warning:  { color: '#d97706', bg: 'rgba(217,119,6,0.10)', border: 'rgba(217,119,6,0.28)', label: 'WARNING'  },
  monitor:  { color: '#0891b2', bg: 'rgba(8,145,178,0.10)', border: 'rgba(8,145,178,0.28)', label: 'MONITOR'  },
}

// ── Country-aware watchlist data ──────────────────────────────────────────────
// First 3 = SLA Alerts · Last 3 = Anomalies

const WATCHLIST = {
  'United States': [
    {
      type: 'alert', severity: 'critical', label: 'SLA Breach Risk',
      entity: 'FedEx Express · 14 orders', context: '46 hrs against 48 hr SLA threshold', time: 'live',
      tldr: '14 FedEx Express orders are 2 hours from breaching your 48-hour SLA commitment.',
      action: 'Flag affected orders with your FedEx account rep for priority handling. Upgrade at-risk shipments to SAME DAY if margin allows.',
    },
    {
      type: 'alert', severity: 'warning', label: 'Stockout Risk',
      entity: 'Frozen Foods · Chicago DC', context: '1.6 WOS below 2 week reorder threshold', time: '8 min ago',
      tldr: 'Chicago Frozen Foods stock will run out in 1.6 weeks, below your 2-week safety minimum.',
      action: 'Trigger an emergency replenishment order today and confirm inbound PO status with your supplier.',
    },
    {
      type: 'alert', severity: 'warning', label: 'Fill Rate Miss',
      entity: 'Dairy and Eggs · Los Angeles', context: '78% fill rate below 85% SLA target', time: '22 min ago',
      tldr: 'LA Dairy and Eggs is fulfilling only 78% of orders, 7 points below your SLA floor.',
      action: 'Identify the top unfulfilled SKUs and expedite. Review supplier allocation for the LA region.',
    },
    {
      type: 'anomaly', severity: 'critical', label: 'Shipment Delay Spike',
      entity: 'P95 delay at 187 hrs', context: '+2.3σ above 30-day baseline', time: 'live',
      tldr: 'P95 shipment delays are statistically abnormal, running 2.3 standard deviations above your 30-day average.',
      action: 'Audit carrier SLA compliance for the past 7 days and identify which lanes are driving the spike.',
    },
    {
      type: 'anomaly', severity: 'warning', label: 'Carrier Failure Rate',
      entity: 'UPS Ground network', context: 'Failure rate up 34% vs last 7 days', time: '14 min ago',
      tldr: 'UPS Ground failure rate jumped 34% this week with no clear trigger yet identified.',
      action: 'Pull a UPS failure detail report by zip code. Escalate to the UPS operations team if a cluster is confirmed.',
    },
    {
      type: 'anomaly', severity: 'monitor', label: 'Dock Throughput Drop',
      entity: 'Morning shift · Dock B', context: '18% below expected throughput', time: '31 min ago',
      tldr: 'Morning shift on Dock B is processing 18% fewer pallets than expected, slowing outbound flow.',
      action: 'Check for equipment issues or staffing gaps on Dock B morning shift and review the labor schedule.',
    },
  ],
  'Canada': [
    {
      type: 'alert', severity: 'critical', label: 'SLA Breach Risk',
      entity: 'Purolator Express · 9 orders', context: '70 hrs against 72 hr SLA threshold', time: 'live',
      tldr: '9 Purolator Express orders are 2 hours from breaching your 72-hour SLA commitment.',
      action: 'Contact Purolator operations immediately. Flag order IDs for priority dispatch at the nearest hub.',
    },
    {
      type: 'alert', severity: 'warning', label: 'Stockout Risk',
      entity: 'Frozen Foods · Vancouver DC', context: '1.4 WOS below 2 week reorder threshold', time: '5 min ago',
      tldr: 'Vancouver Frozen Foods is at 1.4 weeks of supply, below your 2-week reorder minimum.',
      action: 'Issue an urgent PO to your cold chain supplier and confirm truck availability for inbound delivery.',
    },
    {
      type: 'alert', severity: 'warning', label: 'Lead Time Breach',
      entity: 'Meat and Seafood · Toronto', context: 'Supplier lead time exceeded by 4 days', time: '18 min ago',
      tldr: 'Your Toronto Meat and Seafood supplier is running 4 days late against the agreed lead time.',
      action: 'Escalate to the supplier account manager. Evaluate alternate sourcing from Montreal DC to bridge the gap.',
    },
    {
      type: 'anomaly', severity: 'critical', label: 'Delay Cluster Detected',
      entity: 'Vancouver to Toronto corridor', context: '+3.1σ above 30-day corridor baseline', time: 'live',
      tldr: 'The Vancouver to Toronto lane is showing a statistically extreme delay cluster, likely weather or rail related.',
      action: 'Check CN Rail service alerts. Pre-position safety stock at Toronto DC and notify affected customers proactively.',
    },
    {
      type: 'anomaly', severity: 'warning', label: 'Return Rate Spike',
      entity: 'Bakery category · nationwide', context: 'Returns up 41% vs prior 4 week average', time: '11 min ago',
      tldr: 'Bakery returns are up 41% nationally with no corresponding demand drop, suggesting a quality or packaging issue.',
      action: 'Pull return reason codes for Bakery SKUs. Inspect recent production lots and notify QA immediately.',
    },
    {
      type: 'anomaly', severity: 'monitor', label: 'Idle Time Elevation',
      entity: 'Calgary facility · Dock 3', context: '22% above P95 idle time baseline', time: '27 min ago',
      tldr: 'Calgary Dock 3 idle time is running 22% higher than your P95 baseline, indicating a workflow bottleneck.',
      action: 'Review inbound scheduling for Dock 3. Check if a carrier is running late and causing the crew to wait.',
    },
  ],
  'Germany': [
    {
      type: 'alert', severity: 'critical', label: 'SLA Breach Risk',
      entity: 'DHL Priority · 8 orders', context: '71 hrs against 72 hr SLA threshold', time: 'live',
      tldr: '8 DHL Priority orders are 1 hour from breaching your 72-hour EU delivery SLA.',
      action: 'Escalate to DHL Key Account immediately. Request manual dispatch override for the affected shipments.',
    },
    {
      type: 'alert', severity: 'warning', label: 'Damage Rate Exceeded',
      entity: 'Fragile SKUs · Frankfurt DC', context: '4.1% damage rate above 3.5% SLA cap', time: '12 min ago',
      tldr: 'Frankfurt DC fragile SKU damage rate has exceeded your 3.5% contractual SLA cap by 0.6 points.',
      action: 'Audit packaging standards for fragile SKUs at Frankfurt. Review carrier handling logs for the past 14 days.',
    },
    {
      type: 'alert', severity: 'warning', label: 'Stockout Risk',
      entity: 'Meat and Seafood · Berlin', context: '1.2 WOS below 2 week reorder threshold', time: '19 min ago',
      tldr: 'Berlin Meat and Seafood is critically low at 1.2 weeks of supply, well below the reorder threshold.',
      action: 'Issue an emergency PO and arrange cold chain transport from Hamburg or Frankfurt DC as a bridge.',
    },
    {
      type: 'anomaly', severity: 'critical', label: 'Failure Rate Spike',
      entity: 'Failed deliveries · Hamburg zone', context: 'Up 28% vs 14-day rolling average', time: 'live',
      tldr: 'Hamburg delivery failures jumped 28% above the 2-week average with no prior warning signal.',
      action: 'Pull failure reason codes for Hamburg. Check if address validation or access issues are driving the spike.',
    },
    {
      type: 'anomaly', severity: 'warning', label: 'Peak Queue Anomaly',
      entity: 'Munich DC · 14:00 window', context: '+3.1σ above expected queue depth baseline', time: '9 min ago',
      tldr: 'Munich DC queue depth at the 14:00 peak is 3.1 standard deviations above expected, signaling a processing bottleneck.',
      action: 'Review inbound scheduling around the 14:00 window. Consider staggering carrier arrivals to reduce queue buildup.',
    },
    {
      type: 'anomaly', severity: 'monitor', label: 'Dock Wait Elevation',
      entity: 'Berlin facility · inbound bay', context: '17% above expected dock wait time', time: '33 min ago',
      tldr: 'Berlin inbound dock wait times are running 17% above baseline, adding friction to the receiving process.',
      action: 'Check if a carrier is consistently arriving outside the scheduled window. Adjust dock appointment slots if needed.',
    },
  ],
  'Japan': [
    {
      type: 'alert', severity: 'critical', label: 'SLA Breach Risk',
      entity: 'Yamato Express · 11 orders', context: '23 hrs against 24 hr SLA threshold', time: 'live',
      tldr: '11 Yamato Express orders are 1 hour from breaching your 24-hour next-day delivery SLA.',
      action: 'Contact Yamato operations center immediately. Request same-day re-dispatch for all affected shipments.',
    },
    {
      type: 'alert', severity: 'warning', label: 'Stockout Risk',
      entity: 'Frozen Foods · Tokyo DC', context: '1.4 WOS below 2 week reorder threshold', time: '6 min ago',
      tldr: 'Tokyo Frozen Foods supply is at 1.4 weeks, below the minimum threshold for this high-velocity category.',
      action: 'Trigger urgent replenishment and confirm cold storage availability at the Tokyo DC receiving dock.',
    },
    {
      type: 'alert', severity: 'warning', label: 'Fill Rate Miss',
      entity: 'Beverages · Osaka region', context: '81% fill rate below 88% SLA target', time: '20 min ago',
      tldr: 'Osaka Beverages fill rate is 7 points below your SLA target, likely driven by a top-seller stockout.',
      action: 'Identify the top 3 unfulfilled Beverage SKUs in Osaka and expedite from the nearest regional DC.',
    },
    {
      type: 'anomaly', severity: 'critical', label: 'Delay Cluster Detected',
      entity: 'Tohoku inbound routes', context: '+2.8σ above 30-day regional baseline', time: 'live',
      tldr: 'Tohoku inbound transit times are statistically abnormal, likely linked to recent seismic activity.',
      action: 'Activate contingency routing via Sendai air freight for critical SKUs. Notify the Tohoku DC team.',
    },
    {
      type: 'anomaly', severity: 'warning', label: 'Carrier Failure Rate',
      entity: 'Sagawa Express · Tokyo zone', context: 'Failure rate up 29% vs last 7 days', time: '16 min ago',
      tldr: 'Sagawa Express failure rate in Tokyo spiked 29% this week, well above typical urban delivery norms.',
      action: 'Request a failure reason breakdown from Sagawa. Evaluate shifting volume to Yamato for affected Tokyo zones.',
    },
    {
      type: 'anomaly', severity: 'monitor', label: 'Pallet Load Anomaly',
      entity: 'Nagoya facility · evening shift', context: 'Throughput 21% below 30-day shift baseline', time: '38 min ago',
      tldr: 'Nagoya evening shift pallet loading is 21% below its 30-day average, slowing outbound fulfillment.',
      action: 'Review evening shift staffing levels and equipment status at Nagoya. Check if a line was taken offline.',
    },
  ],
  'Korea': [
    {
      type: 'alert', severity: 'critical', label: 'SLA Breach Risk',
      entity: 'CJ Logistics · 7 orders', context: '47 hrs against 48 hr SLA threshold', time: 'live',
      tldr: '7 CJ Logistics orders are 1 hour from breaching your 48-hour delivery SLA commitment.',
      action: 'Call CJ Logistics operations directly and flag the 7 affected order IDs for immediate priority dispatch.',
    },
    {
      type: 'alert', severity: 'warning', label: 'Stockout Risk',
      entity: 'Dairy and Eggs · Seoul DC', context: '1.5 WOS below 2 week reorder threshold', time: '9 min ago',
      tldr: 'Seoul Dairy and Eggs stock is at 1.5 weeks of supply, below the 2-week minimum safety level.',
      action: 'Issue a priority PO to your Seoul dairy supplier and confirm lead time for the next inbound delivery.',
    },
    {
      type: 'alert', severity: 'warning', label: 'Lead Time Breach',
      entity: 'Frozen Foods · Busan supplier', context: 'Inbound lead time exceeded by 3 days', time: '24 min ago',
      tldr: 'Your Busan Frozen Foods supplier is running 3 days late against the agreed inbound lead time.',
      action: 'Escalate to the supplier account manager and explore air freight from an alternate supplier to bridge inventory.',
    },
    {
      type: 'anomaly', severity: 'critical', label: 'Shipment Delay Spike',
      entity: 'P95 delay at 54 hrs', context: '+2.6σ above 30-day P95 baseline', time: 'live',
      tldr: 'P95 shipment delays jumped to 54 hours, 2.6 standard deviations above normal for this market.',
      action: 'Identify the carriers and lanes driving the P95 spike. Check for Busan port congestion or customs backlogs.',
    },
    {
      type: 'anomaly', severity: 'warning', label: 'Return Rate Spike',
      entity: 'Pantry category · nationwide', context: 'Returns up 37% vs prior 4 week average', time: '13 min ago',
      tldr: 'Pantry category returns surged 37% nationally, suggesting a quality, labeling, or expiry date issue.',
      action: 'Pull return reason codes immediately. If expiry-related, initiate a targeted recall review with QA.',
    },
    {
      type: 'anomaly', severity: 'monitor', label: 'Idle Time Elevation',
      entity: 'Incheon DC · Dock 2', context: '19% above P95 idle time baseline', time: '29 min ago',
      tldr: 'Incheon DC Dock 2 is sitting idle 19% more than expected, suggesting a scheduling or carrier delay.',
      action: 'Review the Dock 2 appointment schedule for today. Confirm whether a carrier missed a pickup window.',
    },
  ],
  'China': [
    {
      type: 'alert', severity: 'critical', label: 'CNY Dispatch Deadline',
      entity: 'All outbound China orders', context: 'Dispatch cutoff in 72 hrs before blackout', time: 'live',
      tldr: 'The Chinese New Year logistics blackout begins in 72 hours. Any order not dispatched today will be delayed 2 weeks.',
      action: 'Halt all non-critical inbound POs. Prioritize outbound dispatch for all orders in queue immediately.',
    },
    {
      type: 'alert', severity: 'critical', label: 'SLA Breach Risk',
      entity: 'SF Express · 19 orders', context: '23 hrs against 24 hr SLA threshold', time: 'live',
      tldr: '19 SF Express orders are 1 hour from breaching your 24-hour same-day SLA commitment.',
      action: 'Contact SF Express operations immediately. Request manual override dispatch for all 19 flagged orders.',
    },
    {
      type: 'alert', severity: 'warning', label: 'Stockout Risk',
      entity: 'Frozen Foods · Shanghai bonded', context: '1.3 WOS below 2 week reorder threshold', time: '4 min ago',
      tldr: 'Shanghai bonded Frozen Foods is critically low with only 1.3 weeks of supply before the CNY blackout.',
      action: 'Issue an emergency PO now and arrange bonded warehouse transfer before the Jan 25 dispatch cutoff.',
    },
    {
      type: 'anomaly', severity: 'critical', label: 'Clearance Delay Spike',
      entity: 'Shenzhen customs · inbound', context: '+3.4σ above 30-day clearance baseline', time: 'live',
      tldr: 'Shenzhen customs clearance times are at an extreme statistical outlier, 3.4 standard deviations above baseline.',
      action: 'Pre-advise all inbound documentation to customs broker before goods arrive. Route urgent shipments via Guangzhou.',
    },
    {
      type: 'anomaly', severity: 'warning', label: 'Carrier Failure Rate',
      entity: 'JD Logistics · Guangzhou zone', context: 'Failure rate up 31% vs last 7 days', time: '17 min ago',
      tldr: 'JD Logistics Guangzhou failure rate is up 31% this week, likely driven by pre-CNY volume surge.',
      action: 'Shift non-urgent Guangzhou volume to SF Express temporarily. Monitor JD failure codes daily through CNY.',
    },
    {
      type: 'anomaly', severity: 'monitor', label: 'Warehouse Utilization',
      entity: 'Shanghai bonded zone · all bays', context: 'Utilization 2.1σ above 90-day rolling average', time: '22 min ago',
      tldr: 'Shanghai bonded warehouse utilization is statistically elevated, raising the risk of space constraints before CNY.',
      action: 'Accelerate outbound clearance of slow-moving SKUs. Pre-book overflow space at Ningbo as a contingency.',
    },
  ],
  'Mexico': [
    {
      type: 'alert', severity: 'critical', label: 'SLA Breach Risk',
      entity: 'DHL Mexico · 6 orders', context: '46 hrs against 48 hr SLA threshold', time: 'live',
      tldr: '6 DHL Mexico orders are 2 hours from breaching your 48-hour SLA commitment.',
      action: 'Contact DHL Mexico Key Account and flag the 6 orders for priority same-day dispatch.',
    },
    {
      type: 'alert', severity: 'warning', label: 'Stockout Risk',
      entity: 'Frozen Foods · Monterrey DC', context: '1.7 WOS below 2 week reorder threshold', time: '11 min ago',
      tldr: 'Monterrey Frozen Foods is at 1.7 weeks of supply, trending below the minimum safety threshold.',
      action: 'Issue a replenishment PO today and confirm cold chain transport availability from the CDMX supplier.',
    },
    {
      type: 'alert', severity: 'warning', label: 'Damage Rate Exceeded',
      entity: 'Fragile SKUs · Guadalajara DC', context: '3.8% damage rate above 3.5% SLA cap', time: '21 min ago',
      tldr: 'Guadalajara DC fragile SKU damage rate breached your 3.5% SLA cap, exposing you to contractual penalties.',
      action: 'Audit fragile SKU handling and packaging at Guadalajara DC. Review the past 7 days of carrier damage reports.',
    },
    {
      type: 'anomaly', severity: 'critical', label: 'Cross-Border Delay',
      entity: 'Laredo US-MX crossing', context: '+2.9σ above 30-day border transit baseline', time: 'live',
      tldr: 'Laredo border crossing times are at a statistical extreme, 2.9 standard deviations above your 30-day baseline.',
      action: 'Check CBP processing alerts for Laredo. Evaluate rerouting urgent US-origin shipments through McAllen or El Paso.',
    },
    {
      type: 'anomaly', severity: 'warning', label: 'Return Rate Spike',
      entity: 'Pantry category · CDMX', context: 'Returns up 44% vs prior 4 week average', time: '15 min ago',
      tldr: 'CDMX Pantry returns surged 44% above the 4-week average, pointing to a possible quality or labeling issue.',
      action: 'Pull return reason codes for CDMX Pantry SKUs. Escalate to QA if expiry or product defect codes are present.',
    },
    {
      type: 'anomaly', severity: 'monitor', label: 'Dock Throughput Drop',
      entity: 'Veracruz inbound · morning shift', context: '16% below expected throughput baseline', time: '36 min ago',
      tldr: 'Veracruz inbound morning shift throughput is 16% below baseline, likely linked to post-port congestion.',
      action: 'Review inbound scheduling at Veracruz for today. Confirm whether port delays are affecting truck arrival times.',
    },
  ],
}

const DEFAULT_WATCHLIST = WATCHLIST['United States']

export function getAlertCount(country) {
  const cards = WATCHLIST[country] ?? DEFAULT_WATCHLIST
  return cards.filter(c => c.type === 'alert').length
}

// ── Single card with flip ─────────────────────────────────────────────────────

function WatchlistCard({ card, T }) {
  const [flipped, setFlipped] = useState(false)
  const sev       = SEV[card.severity] ?? SEV.monitor
  const typeLabel = card.type === 'alert' ? '⚠ SLA ALERT' : '⚡ ANOMALY'

  const cardStyle = {
    backgroundColor: T.cardBg,
    borderTop:    `1px solid ${T.cardBorder}`,
    borderRight:  `1px solid ${T.cardBorder}`,
    borderBottom: `1px solid ${T.cardBorder}`,
    borderLeft:   `4px solid ${sev.color}`,
    borderRadius: 8,
    boxShadow: T.cardShadow,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer',
    animation: 'wiq-flip-in 0.35s ease',
  }

  return (
    <div onClick={() => setFlipped(f => !f)} title={flipped ? 'Click to flip back' : 'Click for details'}>

      {!flipped ? (
        <div key="front" style={cardStyle}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: sev.color }}>
              {typeLabel}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
              <span style={{
                fontSize: 9, fontWeight: 700, color: sev.color,
                background: sev.bg, border: `1px solid ${sev.border}`,
                borderRadius: 3, padding: '1px 6px',
              }}>
                {sev.label}
              </span>
              <span style={{ fontSize: 9, color: T.textFaint }}>{card.time}</span>
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, lineHeight: 1.25, marginBottom: 3 }}>
            {card.label}
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>
            {card.entity}
          </div>
          <div style={{ fontSize: 11, color: '#ffffff', lineHeight: 1.4, marginTop: 'auto' }}>
            {card.context}
          </div>

        </div>
      ) : (
        <div key="back" style={cardStyle}>

          <div style={{ fontSize: 11, color: T.text, lineHeight: 1.5, marginBottom: 8 }}>
            {card.tldr}
          </div>

          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: sev.color, marginBottom: 4 }}>
            RECOMMENDED ACTION
          </div>
          <div style={{ fontSize: 12, color: '#ffffff', lineHeight: 1.5 }}>
            {card.action}
          </div>

        </div>
      )}

    </div>
  )
}

// ── Row export ────────────────────────────────────────────────────────────────

export default function WatchlistRow({ country, T }) {
  const cards = WATCHLIST[country] ?? DEFAULT_WATCHLIST
  return (
    <div className="kpi-grid">
      {cards.map((card, i) => (
        <WatchlistCard key={i} card={card} T={T} />
      ))}
    </div>
  )
}
