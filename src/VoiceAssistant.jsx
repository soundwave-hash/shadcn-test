import { useState, useEffect, useRef } from 'react'
import { Mic, X } from 'lucide-react'

// ── Country metadata ────────────────────────────────────────────────────────
const COUNTRY_META = {
  'United States': { flag: '🇺🇸', label: 'United States' },
  'Canada':        { flag: '🇨🇦', label: 'Canada' },
  'Mexico':        { flag: '🇲🇽', label: 'Mexico' },
  'Germany':       { flag: '🇩🇪', label: 'Germany' },
  'Japan':         { flag: '🇯🇵', label: 'Japan' },
  'Korea':         { flag: '🇰🇷', label: 'Korea' },
  'China':         { flag: '🇨🇳', label: 'China' },
}

// ── Scripted conversations per country ─────────────────────────────────────
const CONVERSATIONS = {
  'United States': [
    { role: 'user', text: 'Why are unit sales down 8% in CA this week?' },
    { role: 'ai', text: 'The drop is concentrated in LA and SF — SKU-1042 hit stockout across both DCs. West Coast replenishment runs 6 days, so recovery is Thursday at the earliest.' },
    { role: 'user', text: "What's the revenue risk if we don't act by EOD?" },
    { role: 'ai', text: "We're projecting $420K in lost revenue over 72 hours, plus SLA exposure on 3 key retail accounts with breach windows opening tomorrow morning." },
    { role: 'user', text: 'Should we reroute from the Phoenix DC?' },
    { role: 'ai', text: 'Yes — Phoenix has 1,200 units of SKU-1042 and can reach LA in ~18 hours via ground priority, covering ~60% of the demand gap immediately.' },
  ],
  'Canada': [
    { role: 'user', text: 'Why is shipment time spiking across Ontario?' },
    { role: 'ai', text: 'A winter storm hit the Toronto–Montreal corridor Tuesday. Carriers are running 2–3 day delays and our Mississauga DC lost 4 loading bays to ice damage.' },
    { role: 'user', text: 'Are we at risk of SLA breaches?' },
    { role: 'ai', text: '14 enterprise accounts are at risk — 8 in Ontario, 6 in Quebec. The first breach window opens in 36 hours.' },
    { role: 'user', text: 'Can air freight bridge the gap?' },
    { role: 'ai', text: 'Air out of Pearson covers the Montreal shortfall — adds $38/unit, but that\'s ~$215K in expedite cost vs. ~$580K in SLA penalties. Air freight wins here.' },
  ],
  'Mexico': [
    { role: 'user', text: "What's causing the fulfillment delays in Monterrey?" },
    { role: 'ai', text: 'CBP inspection volumes at Laredo are up 40% — average dwell time jumped from 4 to 11 hours. Three northbound trucks are in secondary inspection right now.' },
    { role: 'user', text: 'How does this affect our inventory health score?' },
    { role: 'ai', text: 'Monterrey dropped to 58% health, driven by inbound delays on SKU-2210 and SKU-2215 — both tied to the held trucks.' },
    { role: 'user', text: "What's our best contingency?" },
    { role: 'ai', text: 'Source 60% of SKU-2210 from Guadalajara — bypasses the border entirely. 2-day lead time vs. 6+ for the held shipment. Recommend pulling that lever today.' },
  ],
  'Germany': [
    { role: 'user', text: 'Why is dock efficiency down at the Hamburg terminal?' },
    { role: 'ai', text: 'Hamburg upgraded to the new EU customs declaration system last Monday. Processing time per manifest jumped from 12 to 31 minutes — teams haven\'t completed the new protocol training yet.' },
    { role: 'user', text: 'Are we exposed to any EU compliance penalties?' },
    { role: 'ai', text: 'Two shipments missed the 24-hour pre-arrival notification window under ICS2. Penalty exposure is €4,200. Late declarations should be filed before Friday.' },
    { role: 'user', text: 'When will efficiency normalize?' },
    { role: 'ai', text: 'Training completes end of week. We\'re projecting a return to 18-minute dock times by Monday, which brings throughput back within SLA.' },
  ],
  'Japan': [
    { role: 'user', text: 'Queue times are up — what\'s driving it?' },
    { role: 'ai', text: 'The Osaka facility ran a 3-day kaizen event last week, temporarily cutting picker throughput 22%. Queue depth peaked at 94 units, well above the 40-unit JIT threshold.' },
    { role: 'user', text: 'Is the waste ratio still within spec?' },
    { role: 'ai', text: 'Defect rate is 0.018% — within spec. Motion waste is elevated though. The kaizen team flagged 3 redundant steps in the pick-pack flow that will cut 8 seconds per unit once removed.' },
    { role: 'user', text: 'When does full JIT flow resume?' },
    { role: 'ai', text: 'The revised standard takes effect Monday. Modeling shows queue depth returning to 35 units within 48 hours of implementation.' },
  ],
  'Korea': [
    { role: 'user', text: "What's driving the sales spike in Seoul this week?" },
    { role: 'ai', text: 'A major electronics launch triggered a 340% demand surge for SKU-K77. Our model missed the correlation to the launch date — current inventory covers only 2.1 days of demand.' },
    { role: 'user', text: 'Can the distribution network handle this?' },
    { role: 'ai', text: 'Incheon hub is at 94% capacity. We have overflow at Busan, but routing adds 6 hours and puts next-day SLAs at risk.' },
    { role: 'user', text: 'How do we prevent this forecast miss next time?' },
    { role: 'ai', text: 'Integrating the marketing launch calendar into the forecast model would have flagged this 3 weeks out. That feed can be built in about 2 days.' },
  ],
  'China': [
    { role: 'user', text: 'Why is export fulfillment below target in Shanghai?' },
    { role: 'ai', text: 'Pudong is processing 18% above normal volume from Golden Week restocks. The carton sealing line is the bottleneck — capped at 4,200 units/hour vs. 5,800 target.' },
    { role: 'user', text: 'What\'s the downstream impact on US delivery timelines?' },
    { role: 'ai', text: '6 container shipments are delayed an average of 3.2 days. US retail partners will see pre-Christmas stock arrive Dec 11–12 instead of Dec 8.' },
    { role: 'user', text: 'Can we air freight the high-priority SKUs?' },
    { role: 'ai', text: 'Air from PVG covers the top 4 margin SKUs — C14, C19, C22, C31. Cost is $180K but protects $2.1M in holiday margin. Recommend approving air freight for those SKUs immediately.' },
  ],
}

// ── Typing indicator ────────────────────────────────────────────────────────
function TypingDots({ userSide }) {
  const color = userSide ? '#00bcd4' : '#f59e0b'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 14px' }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: color,
            display: 'inline-block',
            animation: `va-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function VoiceAssistant({ open, onClose, theme, country, activeUser }) {
  const T = theme === 'dark'
    ? { bg: '#1c1c1c', panelBg: '#161616', border: '#2a2a2a', text: '#fff', textMuted: '#aaa', inputBg: '#252525', inputBorder: '#3a3a3a' }
    : { bg: '#e2e5e8', panelBg: '#f5f5f5', border: 'rgba(0,0,0,0.09)', text: '#111', textMuted: '#555', inputBg: '#d7dadd', inputBorder: 'rgba(0,0,0,0.12)' }

  const PANEL_W = 560
  const DEFAULT_POS = () => ({
    x: Math.max(0, window.innerWidth / 2 - PANEL_W / 2),
    y: 60,
  })

  const [messages, setMessages] = useState([])
  const [typingRole, setTypingRole] = useState(null) // 'user' | 'ai' | null
  const [micPulsing, setMicPulsing] = useState(false)
  const [visible, setVisible] = useState(false)
  const [started, setStarted] = useState(false)
  const [pos, setPos] = useState(DEFAULT_POS)
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const timersRef = useRef([])
  const scrollRef = useRef(null)

  const meta = COUNTRY_META[country] || { flag: '🌍', label: country }
  const script = CONVERSATIONS[country] || CONVERSATIONS['United States']

  // scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, typingRole])

  // animate in/out; reset on open
  useEffect(() => {
    if (open) {
      setVisible(true)
      setPos(DEFAULT_POS())
      setMessages([])
      setTypingRole(null)
      setStarted(false)
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    } else {
      setVisible(false)
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      // small delay before resetting messages so exit animation plays
      const t = setTimeout(() => { setMessages([]); setTypingRole(null); setStarted(false) }, 300)
      timersRef.current.push(t)
    }
    return () => { timersRef.current.forEach(clearTimeout) }
  }, [open, country])

  function handleMicClick() {
    if (started) return
    setStarted(true)
    playScript(script)
  }

  // drag handlers
  function onHeaderMouseDown(e) {
    if (e.button !== 0) return
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    setDragging(true)

    function onMove(ev) {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - PANEL_W, ev.clientX - dragOffset.current.x)),
        y: Math.max(0, ev.clientY - dragOffset.current.y),
      })
    }
    function onUp() {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function playScript(msgs) {
    let delay = 800
    msgs.forEach((msg) => {
      const isAi = msg.role === 'ai'
      const typingDuration = isAi ? 3500 : 1200
      const pauseAfter = 1000

      // show typing bubble
      const t1 = setTimeout(() => setTypingRole(msg.role), delay)
      timersRef.current.push(t1)
      delay += typingDuration

      // reveal message, hide bubble
      const t2 = setTimeout(() => {
        setTypingRole(null)
        setMessages(prev => [...prev, msg])
      }, delay)
      timersRef.current.push(t2)

      delay += pauseAfter
    })
  }

  if (!open && !visible) return null

  return (
    <>
      <style>{`
        @keyframes va-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes va-slide-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes va-slide-out {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(20px); }
        }
        @keyframes va-mic-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.5); }
          50% { box-shadow: 0 0 0 8px rgba(245,158,11,0); }
        }
      `}</style>

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: pos.y, left: pos.x,
          zIndex: 300,
          width: PANEL_W,
          maxHeight: '70vh',
          borderRadius: 14,
          background: T.bg,
          border: `1px solid ${T.border}`,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: dragging ? 'none' : `${visible ? 'va-slide-in' : 'va-slide-out'} 280ms ease forwards`,
          boxShadow: dragging ? '0 32px 80px rgba(0,0,0,0.45)' : '0 24px 60px rgba(0,0,0,0.35)',
          userSelect: dragging ? 'none' : 'auto',
        }}
      >
        {/* Header — drag handle */}
        <div
          onMouseDown={onHeaderMouseDown}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px',
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
            cursor: dragging ? 'grabbing' : 'grab',
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Mic size={16} color="#f59e0b" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, lineHeight: 1 }}>WarehouseIQ Assistant</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Powered by Anthropic</div>
          </div>
          {activeUser && (
            <div style={{
              width: 28, height: 28, borderRadius: '50%', overflow: 'hidden',
              flexShrink: 0, border: '2px solid rgba(245,158,11,0.4)',
            }}>
              <img
                src={activeUser.src}
                alt={activeUser.name}
                title={activeUser.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(activeUser.imgStyle ?? {}) }}
              />
            </div>
          )}
          <button
            onClick={onClose}
            onMouseDown={e => e.stopPropagation()}
            style={{
              width: 24, height: 24, borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${T.border}`,
              background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={13} color={T.textMuted} />
          </button>
        </div>

        {/* Chat thread */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 10,
            scrollbarWidth: 'thin',
          }}
        >
          {messages.length === 0 && !typingRole && (
            <div style={{ textAlign: 'center', color: T.textMuted, fontSize: 12, marginTop: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
              <div>{started ? `Analyzing ${meta.label} operations data…` : 'Click the mic button to start'}</div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            return (
              <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', gap: 8 }}>
                {!isUser && (
                  <div style={{
                    width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                    overflow: 'hidden', alignSelf: 'flex-end',
                    background: '#c8593a',
                  }}>
                    <img src="/bot-avatar.png" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                )}
                <div style={{
                  maxWidth: '72%',
                  padding: '9px 13px',
                  borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: isUser
                    ? 'rgba(0,188,212,0.15)'
                    : (theme === 'dark' ? '#252525' : '#dde0e3'),
                  border: isUser
                    ? '1px solid rgba(0,188,212,0.3)'
                    : `1px solid ${T.border}`,
                  fontSize: 13, lineHeight: 1.55,
                  color: T.text,
                }}>
                  {msg.text}
                </div>
              </div>
            )
          })}

          {typingRole === 'ai' && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                overflow: 'hidden', alignSelf: 'flex-end',
                background: '#c8593a',
              }}>
                <img src="/bot-avatar.png" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{
                padding: '4px 4px',
                borderRadius: '12px 12px 12px 4px',
                background: theme === 'dark' ? '#252525' : '#dde0e3',
                border: `1px solid ${T.border}`,
              }}>
                <TypingDots />
              </div>
            </div>
          )}
          {typingRole === 'user' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{
                padding: '4px 4px',
                borderRadius: '12px 12px 4px 12px',
                background: 'rgba(0,188,212,0.15)',
                border: '1px solid rgba(0,188,212,0.3)',
              }}>
                <TypingDots userSide />
              </div>
            </div>
          )}
        </div>

        {/* Input row */}
        <div style={{
          padding: '10px 14px',
          borderTop: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0,
        }}>
          <div style={{
            flex: 1, height: 34, borderRadius: 8,
            background: T.inputBg,
            border: `1px solid ${T.inputBorder}`,
            display: 'flex', alignItems: 'center',
            padding: '0 12px',
            fontSize: 12, color: T.textMuted,
          }}>
            Ask about {meta.label} operations…
          </div>
          <button
            title={started ? 'Listening…' : 'Start conversation'}
            onClick={handleMicClick}
            onMouseEnter={() => setMicPulsing(true)}
            onMouseLeave={() => setMicPulsing(false)}
            style={{
              width: 34, height: 34, borderRadius: 8, cursor: started ? 'default' : 'pointer', flexShrink: 0,
              border: started ? '1px solid rgba(245,158,11,0.6)' : '1px solid rgba(245,158,11,0.4)',
              background: started ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: (!started && micPulsing) ? 'va-mic-pulse 1.2s ease-in-out infinite' : 'none',
              transition: 'background 150ms',
            }}
          >
            <Mic size={15} color="#f59e0b" />
          </button>
        </div>
      </div>
    </>
  )
}
