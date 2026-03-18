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
  carrier:  '#00bcd4',
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

const HEIGHT = 800;

function getNodeColor(node) {
  if (node.kind === 'carrier') return NODE_COLORS.carrier;
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

    // Carrier nodes
    const carrierIndexMap = {};
    collapsedRows.forEach(row => {
      carrierIndexMap[row.carrier] = nodes.length;
      nodes.push({ name: row.carrier, kind: 'carrier' });
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

    return { nodes, links };
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

    const leftMargin  = Math.ceil(longestCarrier * CHAR_W) + PAD;
    const rightMargin = Math.ceil(longestStatus  * CHAR_W) + PAD;

    const gen = sankey()
      .nodeWidth(16)
      .nodePadding(20)
      .extent([[leftMargin, 10], [width - rightMargin, HEIGHT - 10]]);

    // d3-sankey mutates the data, so deep clone
    const graph = gen({
      nodes: sankeyData.nodes.map(d => ({ ...d })),
      links: sankeyData.links.map(d => ({ ...d })),
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
        {country} — Carrier Flow
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
                  strokeWidth={Math.max(1, link.width)}
                  onMouseEnter={() => setHoveredLink(i)}
                  onMouseLeave={() => setHoveredLink(null)}
                  style={{ cursor: 'default' }}
                />
              );
            })}

            {/* Nodes */}
            {layout.nodes.map((node, i) => {
              const color = getNodeColor(node);
              const nodeH = Math.max(1, node.y1 - node.y0);

              // Label positioning — carriers left, status right, types beside node
              let labelX, textAnchor, labelY, dominantBaseline;
              if (node.kind === 'carrier') {
                labelX = node.x0 - 8;
                textAnchor = 'end';
                labelY = (node.y0 + node.y1) / 2;
                dominantBaseline = 'middle';
              } else if (node.kind === 'status') {
                labelX = node.x1 + 8;
                textAnchor = 'start';
                labelY = (node.y0 + node.y1) / 2;
                dominantBaseline = 'middle';
              } else {
                // type — label to the right of node, vertically centered
                labelX = node.x1 + 6;
                textAnchor = 'start';
                labelY = (node.y0 + node.y1) / 2;
                dominantBaseline = 'middle';
              }

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
                  />
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor={textAnchor}
                    dominantBaseline={dominantBaseline}
                    fill={T.text}
                    fontSize={10}
                    style={{ userSelect: 'none' }}
                  >
                    {node.name}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : null}
      </div>
    </div>
  );
}
