import { useMemo, useRef, useState, useEffect } from 'react';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';

const STATUS_SPLIT = {
  express:  { delivered: 0.96, failed: 0.025, canceled: 0.015 },
  ground:   { delivered: 0.93, failed: 0.04,  canceled: 0.03  },
  priority: { delivered: 0.97, failed: 0.02,  canceled: 0.01  },
  sameDay:  { delivered: 0.91, failed: 0.05,  canceled: 0.04  },
  standard: { delivered: 0.89, failed: 0.06,  canceled: 0.05  },
  freight:  { delivered: 0.94, failed: 0.035, canceled: 0.025 },
  returns:  { delivered: 0.85, failed: 0.08,  canceled: 0.07  },
  unknown:  { delivered: 0.70, failed: 0.15,  canceled: 0.15  },
};

const TYPE_KEYS = ['express', 'ground', 'priority', 'sameDay', 'standard', 'freight', 'returns', 'unknown'];
const TYPE_LABELS = {
  express: 'EXPRESS',
  ground: 'GROUND',
  priority: 'PRIORITY',
  sameDay: 'SAME DAY',
  standard: 'STANDARD',
  freight: 'FREIGHT',
  returns: 'RETURNS',
  unknown: 'UNKNOWN',
};

const NODE_COLORS = {
  express:  '#00bcd4',
  ground:   '#f44336',
  priority: '#4caf50',
  sameDay:  '#ff9800',
  standard: '#3f51b5',
  freight:  '#e91e63',
  returns:  '#8bc34a',
  unknown:  '#9e9e9e',
  DELIVERED: '#4caf50',
  FAILED:    '#f44336',
  CANCELED:  '#757575',
};

// Distinct per-carrier colors — purples, browns, yellows, and dark neutrals only
// deliberately avoids cyan, red, green, orange, indigo, pink, grey (all used by type/status nodes)
const CARRIER_PALETTE = [
  '#2F5D8C', // navy medium blue
  '#4e342e', // dark brown
  '#fdd835', // yellow
  '#123A63', // navy deep blue
  '#795548', // medium brown
  '#f0b429', // golden yellow
  '#827717', // olive
  '#37474f', // dark slate
  '#C9D6E5', // navy light steel blue
  '#263238', // very dark slate
];

const HEIGHT = 800;

function getNodeColor(node) {
  if (node.kind === 'carrier') return node.color || '#9e9e9e';
  if (node.kind === 'type') return NODE_COLORS[node.typeKey] || '#9e9e9e';
  if (node.kind === 'status') return NODE_COLORS[node.name] || '#9e9e9e';
  return '#9e9e9e';
}

export default function SankeyPanel({ country, carrierRows, T }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    setWidth(containerRef.current.clientWidth);
    return () => observer.disconnect();
  }, []);

  const [hoveredLink, setHoveredLink] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [nodeTooltipPos, setNodeTooltipPos] = useState({ x: 0, y: 0 });

  const sankeyData = useMemo(() => {
    if (!carrierRows || carrierRows.length === 0) return null;

    const nodes = [];
    const links = [];

    // Collapse carriers below 5% of total volume into "Other"
    const CARRIER_KEYS = ['express','ground','priority','sameDay','standard','freight','returns','unknown'];
    const rowTotals = carrierRows.map(row => ({
      ...row,
      _total: CARRIER_KEYS.reduce((s, k) => s + (row[k] || 0), 0),
    }));
    const grandTotal = rowTotals.reduce((s, r) => s + r._total, 0);
    const threshold = grandTotal * 0.05;

    const mainRows = rowTotals.filter(r => r._total >= threshold);
    const otherRows = rowTotals.filter(r => r._total < threshold);

    let collapsedRows = mainRows;
    if (otherRows.length > 0) {
      const otherMerged = { carrier: 'Other', _total: 0 };
      CARRIER_KEYS.forEach(k => {
        otherMerged[k] = otherRows.reduce((s, r) => s + (r[k] || 0), 0);
        otherMerged._total += otherMerged[k];
      });
      collapsedRows = [...mainRows, otherMerged];
    }

    // Carrier nodes — each gets a unique color from the palette
    const carrierIndexMap = {};
    collapsedRows.forEach((row, idx) => {
      carrierIndexMap[row.carrier] = nodes.length;
      nodes.push({ name: row.carrier, kind: 'carrier', color: CARRIER_PALETTE[idx % CARRIER_PALETTE.length] });
    });

    // Which type keys have any volume > 0
    const activeTypeKeys = TYPE_KEYS.filter(key =>
      collapsedRows.some(row => (row[key] || 0) > 0)
    );

    // Type nodes
    const typeIndexMap = {};
    activeTypeKeys.forEach(key => {
      typeIndexMap[key] = nodes.length;
      nodes.push({ name: TYPE_LABELS[key], kind: 'type', typeKey: key });
    });

    // Status nodes
    const statusNames = ['DELIVERED', 'FAILED', 'CANCELED'];
    const statusIndexMap = {};
    statusNames.forEach(s => {
      statusIndexMap[s] = nodes.length;
      nodes.push({ name: s, kind: 'status' });
    });

    // Carrier → Type links
    const typeVolumes = {};
    activeTypeKeys.forEach(k => { typeVolumes[k] = 0; });

    collapsedRows.forEach(row => {
      const carrierIdx = carrierIndexMap[row.carrier];
      activeTypeKeys.forEach(key => {
        const val = row[key] || 0;
        if (val > 0) {
          links.push({ source: carrierIdx, target: typeIndexMap[key], value: val });
          typeVolumes[key] += val;
        }
      });
    });

    // Type → Status links
    activeTypeKeys.forEach(key => {
      const total = typeVolumes[key];
      if (total <= 0) return;
      const split = STATUS_SPLIT[key];
      const typeIdx = typeIndexMap[key];

      const deliveredVal = Math.round(total * split.delivered);
      const failedVal = Math.round(total * split.failed);
      const canceledVal = total - deliveredVal - failedVal;

      if (deliveredVal > 0) links.push({ source: typeIdx, target: statusIndexMap['DELIVERED'], value: deliveredVal });
      if (failedVal > 0)    links.push({ source: typeIdx, target: statusIndexMap['FAILED'],    value: failedVal });
      if (canceledVal > 0)  links.push({ source: typeIdx, target: statusIndexMap['CANCELED'],  value: canceledVal });
    });

    // Keep the collapsed carriers list for the "Other" tooltip
    const otherCarriers = otherRows.map(r => ({ name: r.carrier, total: r._total }));

    return { nodes, links, otherCarriers, grandTotal };
  }, [carrierRows]);

  const layout = useMemo(() => {
    if (!sankeyData || width < 50) return null;

    // Dynamically compute margins so labels never overflow the panel
    const CHAR_W = 6.2;  // approx px per character at 10px sans-serif
    const PAD    = 12;   // gap between node edge and label

    const longestCarrier = sankeyData.nodes
      .filter(n => n.kind === 'carrier')
      .reduce((max, n) => Math.max(max, n.name.length), 0);
    const longestStatus = sankeyData.nodes
      .filter(n => n.kind === 'status')
      .reduce((max, n) => Math.max(max, n.name.length), 0);

    // Stats label "1,234,567 (100%)" ≈ 16 chars — may be wider than the name itself
    const STATS_CHARS = 16;
    const leftMargin  = Math.ceil(Math.max(longestCarrier, STATS_CHARS) * CHAR_W) + PAD;
    const rightMargin = Math.ceil(Math.max(longestStatus,  STATS_CHARS) * CHAR_W) + PAD;

    const gen = sankey()
      .nodeWidth(16)
      .nodePadding(20)
      .nodeSort((a, b) => b.value - a.value)
      .extent([[leftMargin, 10], [width - rightMargin, HEIGHT - 10]]);

    // d3-sankey mutates the data, so deep clone
    const graph = gen({
      nodes: sankeyData.nodes.map(d => ({ ...d })),
      links: sankeyData.links.map(d => ({ ...d })),
    });

    // Scale node heights and link widths by 0.8 from vertical center so
    // lines look less chunky while nodes and links remain perfectly aligned
    const VISUAL_SCALE = 0.8;
    const yMid = HEIGHT / 2;
    graph.nodes.forEach(node => {
      node.y0 = yMid + (node.y0 - yMid) * VISUAL_SCALE;
      node.y1 = yMid + (node.y1 - yMid) * VISUAL_SCALE;
    });
    graph.links.forEach(link => {
      link.width *= VISUAL_SCALE;
      link.y0 = yMid + (link.y0 - yMid) * VISUAL_SCALE;
      link.y1 = yMid + (link.y1 - yMid) * VISUAL_SCALE;
    });

    return graph;
  }, [sankeyData, width]);

  const isEmpty = !carrierRows || carrierRows.length === 0;

  return (
    <div
      style={{
        backgroundColor: T.panelBg,
        border: '1px solid ' + T.border,
        borderRadius: 8,
        padding: '14px 16px',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 'bold', color: T.text, marginBottom: 10 }}>
        {country} - Carrier Flow
      </div>

      <div ref={containerRef} style={{ width: '100%', minHeight: HEIGHT }}>
        {isEmpty ? (
          <div
            style={{
              height: HEIGHT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: T.textMuted,
              fontSize: 13,
            }}
          >
            Select a country on the map
          </div>
        ) : layout ? (
          <svg width={width} height={HEIGHT} style={{ display: 'block', overflow: 'hidden' }}>
            {/* Links */}
            {layout.links.map((link, i) => {
              const pathD = sankeyLinkHorizontal()(link);
              const color = getNodeColor(link.source);
              const isHovered = hoveredLink === i;
              return (
                <path
                  key={i}
                  d={pathD}
                  fill="none"
                  stroke={color}
                  strokeOpacity={isHovered ? 0.5 : 0.25}
                  strokeWidth={Math.max(3, link.width)}
                  onMouseEnter={(e) => { setHoveredLink(i); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                  onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredLink(null)}
                  style={{ cursor: 'default' }}
                />
              );
            })}

            {/* Nodes */}
            {(() => {
              const grandTotal = layout.nodes
                .filter(n => n.kind === 'status')
                .reduce((s, n) => s + (n.value || 0), 0);

              return layout.nodes.map((node, i) => {
                const color = getNodeColor(node);
                const nodeH = Math.max(1, node.y1 - node.y0);
                const nodeCenter = (node.y0 + node.y1) / 2;

                // Stats label
                const pct = grandTotal > 0 ? Math.round((node.value / grandTotal) * 100) : 0;
                const volLabel = (node.value || 0).toLocaleString();
                const statsLabel = `${volLabel} (${pct}%)`;
                // Only show second line if node is tall enough
                const showStats = nodeH >= 16;
                const LINE_GAP = 11;

                // Label positioning — carriers left, status right, types beside node
                let labelX, textAnchor;
                if (node.kind === 'carrier') {
                  labelX = node.x0 - 8;
                  textAnchor = 'end';
                } else if (node.kind === 'status') {
                  labelX = node.x1 + 8;
                  textAnchor = 'start';
                } else {
                  labelX = node.x1 + 6;
                  textAnchor = 'start';
                }

                const nameY  = showStats ? nodeCenter - LINE_GAP / 2 : nodeCenter;
                const statsY = nodeCenter + LINE_GAP / 2;

                const isOther = node.name === 'Other' && node.kind === 'carrier';

                return (
                  <g key={i}>
                    <rect
                      x={node.x0}
                      y={node.y0}
                      width={node.x1 - node.x0}
                      height={nodeH}
                      fill={color}
                      fillOpacity={0.7}
                      rx={3}
                      style={isOther ? { cursor: 'default' } : undefined}
                      onMouseEnter={isOther ? (e) => { setHoveredNode(node); setNodeTooltipPos({ x: e.clientX, y: e.clientY }); } : undefined}
                      onMouseMove={isOther ? (e) => setNodeTooltipPos({ x: e.clientX, y: e.clientY }) : undefined}
                      onMouseLeave={isOther ? () => setHoveredNode(null) : undefined}
                    />
                    <text
                      x={labelX}
                      y={nameY}
                      textAnchor={textAnchor}
                      dominantBaseline="middle"
                      fill={T.text}
                      fontSize={10}
                      style={{ userSelect: 'none' }}
                    >
                      {node.name}
                    </text>
                    {showStats && (
                      <text
                        x={labelX}
                        y={statsY}
                        textAnchor={textAnchor}
                        dominantBaseline="middle"
                        fill={T.textMuted}
                        fontSize={10}
                        fontWeight="bold"
                        style={{ userSelect: 'none' }}
                      >
                        {statsLabel}
                      </text>
                    )}
                  </g>
                );
              });
            })()}
          </svg>
        ) : null}
      </div>

      {/* Link hover tooltip */}
      {hoveredLink !== null && layout && (() => {
        const link = layout.links[hoveredLink];
        const grandTotal = layout.nodes
          .filter(n => n.kind === 'status')
          .reduce((s, n) => s + (n.value || 0), 0);
        const pct = grandTotal > 0 ? Math.round((link.value / grandTotal) * 100) : 0;
        return (
          <div
            style={{
              position: 'fixed',
              left: tooltipPos.x + 14,
              top: tooltipPos.y - 14,
              backgroundColor: T.panelBg,
              border: '1px solid ' + T.border,
              borderRadius: 6,
              padding: '7px 11px',
              pointerEvents: 'none',
              zIndex: 9999,
              fontSize: 11,
              color: T.text,
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              minWidth: 140,
            }}
          >
            <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 3 }}>
              {link.source.name} → {link.target.name}
            </div>
            <div style={{ fontWeight: 'bold', fontSize: 13 }}>
              {link.value.toLocaleString()}
            </div>
            <div style={{ color: T.textMuted, marginTop: 1 }}>
              {pct}% of total
            </div>
          </div>
        );
      })()}

      {/* "Other" carrier node tooltip */}
      {hoveredNode && sankeyData?.otherCarriers?.length > 0 && (() => {
        const grandTotal = sankeyData.grandTotal;
        return (
          <div
            style={{
              position: 'fixed',
              left: nodeTooltipPos.x + 14,
              top: nodeTooltipPos.y - 14,
              backgroundColor: T.panelBg,
              border: '1px solid ' + T.border,
              borderRadius: 6,
              padding: '7px 11px',
              pointerEvents: 'none',
              zIndex: 9999,
              fontSize: 11,
              color: T.text,
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              minWidth: 160,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 'bold', color: T.text, marginBottom: 6 }}>
              Other Carriers
            </div>
            {sankeyData.otherCarriers.map(c => {
              const pct = grandTotal > 0 ? Math.round((c.total / grandTotal) * 100) : 0;
              return (
                <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
                  <span style={{ color: T.textMuted }}>{c.name}</span>
                  <span style={{ fontWeight: 'bold' }}>{c.total.toLocaleString()} <span style={{ fontWeight: 'normal', color: T.textMuted }}>({pct}%)</span></span>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
