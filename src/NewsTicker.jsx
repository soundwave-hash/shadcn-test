import { useState, useEffect, useRef } from 'react'
import { X, Zap, Loader2 } from 'lucide-react'

// ── Fallback static headlines if API unavailable ──────────────────────────────
const DEFAULT_HEADLINES = [
  'Global freight rates stabilize after Q3 volatility   analysts project flat Q4',
  'Air cargo demand up 6.1% YoY driven by electronics and pharmaceutical sectors',
  'Ocean carrier blank sailing rate rises to 18%   capacity management in effect',
  'Last mile delivery costs reach record $10.10 per parcel average globally',
  'Blockchain based freight tracking adoption accelerates among top 20 3PLs',
]

// ── Impact palette ─────────────────────────────────────────────────────────────
const IMPACT = {
  High:     { color: '#e53935', bg: 'rgba(229,57,53,0.10)',  border: 'rgba(229,57,53,0.30)'  },
  Moderate: { color: '#f57c00', bg: 'rgba(245,124,0,0.10)',  border: 'rgba(245,124,0,0.30)'  },
  Low:      { color: '#00897b', bg: 'rgba(0,137,123,0.10)',  border: 'rgba(0,137,123,0.30)'  },
}

function parseInsightText(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  let impact = 'Moderate'
  const bullets = []

  for (const line of lines) {
    if (line.startsWith('IMPACT:')) {
      const val = line.replace('IMPACT:', '').trim()
      if (['High', 'Moderate', 'Low'].includes(val)) impact = val
    } else if (line.trimStart().startsWith('•') || line.trimStart().startsWith('-')) {
      const bullet = line.replace(/^[\s•\-]+/, '').trim()
      if (bullet) bullets.push(bullet)
    }
  }

  return { impact, bullets: bullets.length ? bullets : ['Monitoring situation for operational impact.'] }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NewsTicker({ country, T }) {
  const [headlines, setHeadlines]         = useState(DEFAULT_HEADLINES)
  const [loadingNews, setLoadingNews]     = useState(true)
  const [showPanel, setShowPanel]         = useState(false)
  const [headlineIdx, setHeadlineIdx]     = useState(0)
  const [streamText, setStreamText]       = useState('')
  const [isStreaming, setIsStreaming]     = useState(false)
  const [parsedInsight, setParsedInsight] = useState(null)
  const abortRef = useRef(null)

  // Fetch live headlines on mount / country change
  useEffect(() => {
    const cacheKey = `newsTicker_headlines_${country}`
    setLoadingNews(true)
    fetch(`/api/news?country=${encodeURIComponent(country)}`)
      .then(r => r.json())
      .then(data => {
        if (data.headlines?.length) {
          setHeadlines(data.headlines)
          setHeadlineIdx(0)
          localStorage.setItem(cacheKey, JSON.stringify({ headlines: data.headlines, ts: Date.now() }))
        } else {
          // API returned empty — try cache
          const cached = localStorage.getItem(cacheKey)
          if (cached) {
            const { headlines: h } = JSON.parse(cached)
            if (h?.length) { setHeadlines(h); setHeadlineIdx(0) }
          }
        }
      })
      .catch(() => {
        // Network/API error — try cache
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          const { headlines: h } = JSON.parse(cached)
          if (h?.length) { setHeadlines(h); setHeadlineIdx(0) }
        }
      })
      .finally(() => setLoadingNews(false))
  }, [country])

  async function fetchInsight(idx) {
    const headline = headlines[idx] ?? headlines[0]
    if (!headline) return

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setShowPanel(true)
    setStreamText('')
    setParsedInsight(null)
    setIsStreaming(true)

    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline, country }),
        signal: controller.signal,
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setStreamText(accumulated)
      }

      setParsedInsight(parseInsightText(accumulated))
    } catch (err) {
      if (err.name !== 'AbortError') {
        setParsedInsight({ impact: 'Moderate', bullets: ['Unable to generate analysis. Please try again.'] })
      }
    } finally {
      setIsStreaming(false)
    }
  }

  function openInsight() {
    fetchInsight(headlineIdx)
  }

  function nextInsight() {
    const next = (headlineIdx + 1) % headlines.length
    setHeadlineIdx(next)
    fetchInsight(next)
  }

  function closePanel() {
    setShowPanel(false)
    if (abortRef.current) abortRef.current.abort()
  }

  const currentHeadline = headlines[headlineIdx] || ''
  const doubled = [...headlines, ...headlines]
  const imp = IMPACT[parsedInsight?.impact] ?? IMPACT.Moderate

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
          {loadingNews ? (
            <span style={{ fontSize: 11, color: T.textMuted }}>Loading live headlines…</span>
          ) : (
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
          )}
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
      {showPanel && (
        <div style={{
          position: 'fixed', top: 49, left: '50%', transform: 'translateX(-50%)',
          width: 680, maxWidth: '90vw', zIndex: 200,
          backgroundColor: T.cardBg,
          border: `1px solid ${T.border}`,
          borderTop: `2px solid ${isStreaming ? T.tabActive : imp.color}`,
          borderRadius: '0 0 10px 10px',
          padding: '14px 18px 16px',
          boxShadow: T.cardShadow ?? '0 12px 40px rgba(0,0,0,0.35)',
        }}>

          {/* Close button */}
          <button
            onClick={closePanel}
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
            {isStreaming
              ? <Loader2 size={12} color={T.tabActive} style={{ animation: 'spin 1s linear infinite' }} />
              : <Zap size={12} color={T.tabActive} />
            }
            <span style={{ fontSize: 10, fontWeight: 800, color: T.tabActive, letterSpacing: '0.08em' }}>AI ANALYSIS</span>
            {parsedInsight && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: imp.color, background: imp.bg,
                border: `1px solid ${imp.border}`,
                borderRadius: 3, padding: '1px 7px',
              }}>
                {parsedInsight.impact.toUpperCase()} IMPACT
              </span>
            )}
          </div>

          {/* Headline quote */}
          <div style={{ fontSize: 13, color: '#ffffff', marginBottom: 12, lineHeight: 1.5 }}>
            "{currentHeadline}"
          </div>

          {/* Streaming / parsed content */}
          {isStreaming && !parsedInsight ? (
            <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {streamText || 'Analyzing…'}
              <span style={{ animation: 'wiq-live-pulse 1s ease-in-out infinite', display: 'inline-block', marginLeft: 2 }}>▌</span>
            </div>
          ) : parsedInsight ? (
            <div style={{ display:'flex', flexDirection:'column', gap: 7 }}>
              {parsedInsight.bullets.map((b, i) => (
                <div key={i} style={{ display:'flex', gap: 9, alignItems:'flex-start' }}>
                  <span style={{ color: T.tabActive, fontSize: 11, flexShrink: 0, marginTop: 1 }}>▸</span>
                  <span style={{ fontSize: 11, color: T.text, lineHeight: 1.55 }}>{b}</span>
                </div>
              ))}
            </div>
          ) : null}

          {/* Footer */}
          <div style={{ marginTop: 12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <button
              onClick={nextInsight}
              disabled={isStreaming}
              style={{
                fontSize: 10, color: isStreaming ? T.textMuted : T.tabActive,
                background: T.activeItemBg,
                border: `1px solid ${T.border}`,
                borderRadius: 4, padding: '3px 10px',
                cursor: isStreaming ? 'not-allowed' : 'pointer',
              }}
            >
              Next headline →
            </button>
            <span style={{ fontSize: 9, color: T.textMuted }}>
              {headlineIdx + 1} / {headlines.length}
            </span>
          </div>
        </div>
      )}
    </>
  )
}
