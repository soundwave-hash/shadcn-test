import { useState, useEffect, useRef } from 'react'
import { X, Zap, Loader2 } from 'lucide-react'

// ── Fallback static headlines if API unavailable ──────────────────────────────
const DEFAULT_HEADLINES = [
  { headline: 'Global freight rates stabilize after Q3 volatility   analysts project flat Q4', impact: 'Moderate' },
  { headline: 'Air cargo demand up 6.1% YoY driven by electronics and pharmaceutical sectors', impact: 'Low' },
  { headline: 'Ocean carrier blank sailing rate rises to 18%   capacity management in effect', impact: 'Moderate' },
  { headline: 'Last mile delivery costs reach record $10.10 per parcel average globally', impact: 'Moderate' },
  { headline: 'Blockchain based freight tracking adoption accelerates among top 20 3PLs', impact: 'Low' },
]

// ── Impact palette ─────────────────────────────────────────────────────────────
const IMPACT = {
  High:     { color: '#e53935', bg: 'rgba(229,57,53,0.10)',  border: 'rgba(229,57,53,0.30)'  },
  Moderate: { color: '#f57c00', bg: 'rgba(245,124,0,0.10)',  border: 'rgba(245,124,0,0.30)'  },
  Low:      { color: '#00897b', bg: 'rgba(0,137,123,0.10)',  border: 'rgba(0,137,123,0.30)'  },
}

const TICKER_SPEED = 50 // px per second

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
  const panelModeRef                      = useRef('badge')   // 'badge' | 'headline'
  const [headlineIdx, setHeadlineIdx]     = useState(0)
  const [streamText, setStreamText]       = useState('')
  const [isStreaming, setIsStreaming]     = useState(false)
  const [parsedInsight, setParsedInsight] = useState(null)
  const [lastUpdated, setLastUpdated]     = useState(null)
  const [, setTick] = useState(0)
  const [tickerDuration, setTickerDuration] = useState(70)
  const tickerRef     = useRef(null)
  const abortRef      = useRef(null)
  const dragRef       = useRef({ isDragging: false, startX: 0, startOffset: 0, hasDragged: false })
  const durationRef   = useRef(70)

  // Keep durationRef in sync
  useEffect(() => { durationRef.current = tickerDuration }, [tickerDuration])

  // Re-render every minute so "X min ago" stays current
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  // Fetch live headlines on mount / country change
  useEffect(() => {
    const cacheKey = `newsTicker_headlines_${country}`
    setLoadingNews(true)
    function normalize(items) {
      const seen = new Set()
      return items
        .map(item => typeof item === 'string' ? { headline: item, impact: 'Moderate' } : item)
        .filter(item => {
          if (!item.headline || seen.has(item.headline)) return false
          seen.add(item.headline)
          return true
        })
    }

    function loadCache() {
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          const { headlines: h, ts } = JSON.parse(cached)
          if (h?.length) {
            setHeadlines(normalize(h))
            setHeadlineIdx(0)
            if (ts) setLastUpdated(ts)
          }
        }
      } catch {}
    }

    function fetchHeadlines() {
      fetch(`/api/news?country=${encodeURIComponent(country)}`)
        .then(r => r.json())
        .then(data => {
          if (data.headlines?.length) {
            const unique = normalize(data.headlines)
            setHeadlines(unique)
            setHeadlineIdx(0)
            setLastUpdated(Date.now())
            localStorage.setItem(cacheKey, JSON.stringify({ headlines: unique, ts: Date.now() }))
          } else {
            loadCache()
          }
        })
        .catch(loadCache)
        .finally(() => { setLoadingNews(false); setLastUpdated(Date.now()) })
    }

    fetchHeadlines()
    const interval = setInterval(fetchHeadlines, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [country])

  async function fetchInsight(idx) {
    const item = headlines[idx] ?? headlines[0]
    if (!item) return
    const headline = item.headline

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
        await new Promise(r => setTimeout(r, 40))
      }

      const parsed = parseInsightText(accumulated)
      parsed.impact = item.impact  // always use pre-classified impact as source of truth
      setParsedInsight(parsed)
    } catch (err) {
      if (err.name !== 'AbortError') {
        setParsedInsight({ impact: 'Moderate', bullets: ['Unable to generate analysis. Please try again.'] })
      }
    } finally {
      setIsStreaming(false)
    }
  }

  function openInsight() { panelModeRef.current = 'badge'; fetchInsight(headlineIdx) }

  function nextInsight() {
    const next = (headlineIdx + 1) % headlines.length
    setHeadlineIdx(next)
    fetchInsight(next)
  }

  function closePanel() {
    setShowPanel(false)
    if (abortRef.current) abortRef.current.abort()
  }

  // Recalculate duration whenever headlines change
  useEffect(() => {
    if (tickerRef.current) {
      const halfWidth = tickerRef.current.scrollWidth / 2
      setTickerDuration(Math.round(halfWidth / TICKER_SPEED))
    }
  }, [headlines])

  // ── Drag-to-scrub ────────────────────────────────────────────────────────────
  function getTranslateX(el) {
    const matrix = new DOMMatrix(getComputedStyle(el).transform)
    return matrix.m41
  }

  function resumeAnimation(el, currentX) {
    const halfWidth = el.scrollWidth / 2
    // Normalise into [-halfWidth, 0]
    let pos = currentX % halfWidth
    if (pos > 0) pos -= halfWidth
    const elapsed = Math.abs(pos) / TICKER_SPEED
    el.style.transform = ''
    el.style.animation = `wiq-ticker ${durationRef.current}s linear -${elapsed}s infinite`
  }

  // Apply spring tension to backward (rightward) drags
  function applyTension(delta) {
    if (delta <= 0) return delta                        // forward: 1:1
    return Math.pow(delta, 0.65) * 3.5                 // backward: dampened pull
  }

  function springBack(el, targetOffset) {
    el.style.transition = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
    el.style.transform = `translateX(${targetOffset}px)`
    setTimeout(() => {
      el.style.transition = ''
      if (!showPanel) resumeAnimation(el, targetOffset)
      else el.style.animation = 'none'
    }, 450)
  }

  const DRAG_THRESHOLD = 6 // px of movement before committing to drag

  function handleMouseDown(e) {
    if (e.button !== 0) return
    const el = tickerRef.current
    if (!el) return
    // Don't preventDefault or touch animation — wait to confirm it's a drag
    dragRef.current = { isDragging: false, startX: e.clientX, startOffset: null, hasDragged: false, isBackward: false }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  function handleMouseMove(e) {
    const drag = dragRef.current
    const el = tickerRef.current
    if (!el) return

    const delta = e.clientX - drag.startX

    if (!drag.isDragging) {
      if (Math.abs(delta) < DRAG_THRESHOLD) return
      // Threshold crossed — commit to drag, NOW freeze animation
      const currentX = getTranslateX(el)
      drag.startOffset = currentX
      drag.isDragging = true
      drag.hasDragged = true
      el.style.animation = 'none'
      el.style.transform = `translateX(${currentX}px)`
    }

    drag.isBackward = delta > 0
    const halfWidth = el.scrollWidth / 2
    let newOffset = drag.startOffset + applyTension(delta)
    newOffset = newOffset % halfWidth
    if (newOffset > 0) newOffset -= halfWidth
    el.style.transform = `translateX(${newOffset}px)`
    el.style.cursor = 'grabbing'
  }

  function handleMouseUp() {
    const drag = dragRef.current
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)

    const el = tickerRef.current
    if (el) el.style.cursor = ''

    if (!drag.isDragging) return  // was a clean click — animation untouched

    drag.isDragging = false

    if (el) {
      if (drag.isBackward) {
        springBack(el, drag.startOffset)
      } else if (!showPanel) {
        resumeAnimation(el, getTranslateX(el))
      } else {
        el.style.animation = 'none'
      }
    }
  }

  // Touch equivalents
  function handleTouchStart(e) {
    const el = tickerRef.current
    if (!el) return
    const touch = e.touches[0]
    dragRef.current = { isDragging: false, startX: touch.clientX, startOffset: null, hasDragged: false, isBackward: false }
  }

  function handleTouchMove(e) {
    const drag = dragRef.current
    const el = tickerRef.current
    if (!el) return
    const touch = e.touches[0]
    const delta = touch.clientX - drag.startX

    if (!drag.isDragging) {
      if (Math.abs(delta) < DRAG_THRESHOLD) return
      const currentX = getTranslateX(el)
      drag.startOffset = currentX
      drag.isDragging = true
      drag.hasDragged = true
      el.style.animation = 'none'
      el.style.transform = `translateX(${currentX}px)`
    }

    drag.isBackward = delta > 0
    const halfWidth = el.scrollWidth / 2
    let newOffset = drag.startOffset + applyTension(delta)
    newOffset = newOffset % halfWidth
    if (newOffset > 0) newOffset -= halfWidth
    el.style.transform = `translateX(${newOffset}px)`
  }

  function handleTouchEnd() {
    const drag = dragRef.current
    const el = tickerRef.current
    if (!drag.isDragging) return
    drag.isDragging = false
    if (el) {
      if (drag.isBackward) springBack(el, drag.startOffset)
      else if (!showPanel) resumeAnimation(el, getTranslateX(el))
      else el.style.animation = 'none'
    }
  }

  // When panel opens/closes, sync animation state
  useEffect(() => {
    const el = tickerRef.current
    if (!el) return
    if (showPanel) {
      el.style.animation = 'none'
    } else {
      resumeAnimation(el, getTranslateX(el))
    }
  }, [showPanel]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentHeadline = headlines[headlineIdx]?.headline || ''
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
          style={{ flex: 1, overflow: 'hidden', minWidth: 0, cursor: 'grab' }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {loadingNews ? (
            <span style={{ fontSize: 11, color: T.textMuted }}>Loading live headlines…</span>
          ) : (
            <div ref={tickerRef} style={{
              display: 'inline-block',
              width: 'max-content',
              whiteSpace: 'nowrap',
              fontSize: 11,
              animation: `wiq-ticker ${tickerDuration}s linear infinite`,
              userSelect: 'none',
            }}>
              {doubled.map((item, i) => {
                const realIdx = i % headlines.length
                const imp = IMPACT[item.impact] ?? IMPACT.Moderate
                return (
                  <span
                    key={i}
                    onClick={() => {
                      if (dragRef.current.hasDragged) return
                      panelModeRef.current = 'headline'
                      setHeadlineIdx(realIdx)
                      fetchInsight(realIdx)
                    }}
                    title="Click for AI analysis"
                    style={{ cursor: 'inherit' }}
                  >
                    <span style={{
                      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: imp.color, marginRight: 6, verticalAlign: 'middle',
                      flexShrink: 0,
                    }} />
                    <span style={{ color: T.textMuted }}>{item.headline}</span>
                    <span style={{ color: T.text, margin: '0 14px' }}>|</span>
                  </span>
                )
              })}
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

        {/* Last updated */}
        {lastUpdated != null && (
          <span style={{ flexShrink: 0, fontSize: 9, color: T.textMuted, whiteSpace: 'nowrap' }}>
            Updated {Math.max(0, Math.floor((Date.now() - lastUpdated) / 60000))}m ago
          </span>
        )}
      </div>

      {/* ── AI Insight panel   fixed below nav, centered ── */}
      {showPanel && (
        <>
        {/* Backdrop — click outside to close */}
        <div onClick={closePanel} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
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
            <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
              {streamText || 'Analyzing…'}
              <span style={{ animation: 'wiq-live-pulse 1s ease-in-out infinite', display: 'inline-block', marginLeft: 2 }}>▌</span>
            </div>
          ) : parsedInsight ? (
            <div style={{ display:'flex', flexDirection:'column', gap: 7 }}>
              {parsedInsight.bullets.map((b, i) => (
                <div key={i} style={{ display:'flex', gap: 9, alignItems:'flex-start' }}>
                  <span style={{ color: T.tabActive, fontSize: 11, flexShrink: 0, marginTop: 1 }}>▸</span>
                  <span style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.55 }}>{b}</span>
                </div>
              ))}
            </div>
          ) : null}

          {/* Footer — only shown when opened via AI badge */}
          {panelModeRef.current === 'badge' && (
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
          )}
        </div>
        </>
      )}
    </>
  )
}
