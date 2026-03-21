import { useEffect, useRef, useState } from 'react'
import { X, Bold, Italic, Smile, Paperclip, AtSign, Send } from 'lucide-react'
import { USERS } from './AccountSwitcher'

// Reactions are keyed to message index (0-based) in BASE_MESSAGES order
const BASE_REACTIONS = {
  1: [{ emoji: '😬', count: 1 }],
  2: [{ emoji: '🔥', count: 2 }, { emoji: '💯', count: 1 }],
  4: [{ emoji: '💯', count: 3 }],
  5: [{ emoji: '👀', count: 2 }],
  7: [{ emoji: '👍', count: 4 }, { emoji: '😄', count: 2 }],
}

const BASE_MESSAGES = [
  { userId: 1, time: '9:38 AM', text: 'Unit sales in CA are down 8% this week 📉 Flagging for ops review.' },
  { userId: 2, time: '9:41 AM', text: 'Confirmed 😬 SKU-1042 is showing a stockout risk in LA and SF.' },
  { userId: 1, time: '9:43 AM', text: 'Running the forecast model now. Should have updated projections by EOD 🔥' },
  { userId: 2, time: '9:45 AM', text: 'Inventory health score also dropped to 61% in the West region 😤 Worth escalating.' },
  { userId: 1, time: '9:47 AM', text: 'Agreed 💯 Can you pull the YTD variance and add it to the report?' },
  { userId: 2, time: '9:49 AM', text: 'On it! Also flagging a distribution gap in Portland 👀' },
  { userId: 1, time: '9:52 AM', text: "Let's sync at 11 AM to walk through the numbers 📊" },
  { userId: 2, time: '9:54 AM', text: '👍 See you then!' },
]

function buildMessages(activeUserId) {
  if (activeUserId === 1) return BASE_MESSAGES.map(m => ({ ...m, userId: m.userId === 1 ? 2 : 1 }))
  return BASE_MESSAGES
}

// Slack's official 4-color pinwheel logo
function SlackLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 127 127" fill="none">
      <path d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2S.8 87.3.8 80s5.9-13.2 13.2-13.2H27.2V80z" fill="#36C5F0"/>
      <path d="M33.7 80c0-7.3 5.9-13.2 13.2-13.2s13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2S33.7 120.3 33.7 113V80z" fill="#36C5F0"/>
      <path d="M46.9.8c7.3 0 13.2 5.9 13.2 13.2s-5.9 13.2-13.2 13.2H33.7V14C33.7 6.7 39.6.8 46.9.8z" fill="#2EB67D"/>
      <path d="M46.9 27.2c7.3 0 13.2 5.9 13.2 13.2s-5.9 13.2-13.2 13.2H14c-7.3 0-13.2-5.9-13.2-13.2S6.7 27.2 14 27.2H46.9z" fill="#2EB67D"/>
      <path d="M127 40.4c0 7.3-5.9 13.2-13.2 13.2s-13.2-5.9-13.2-13.2V27.2h13.2c7.3 0 13.2 5.9 13.2 13.2z" fill="#E01E5A"/>
      <path d="M113.8 53.6c7.3 0 13.2 5.9 13.2 13.2s-5.9 13.2-13.2 13.2H80.8c-7.3 0-13.2-5.9-13.2-13.2s5.9-13.2 13.2-13.2H113.8z" fill="#E01E5A"/>
      <path d="M80.2 127c-7.3 0-13.2-5.9-13.2-13.2s5.9-13.2 13.2-13.2h13.2v13.2c0 7.3-5.9 13.2-13.2 13.2z" fill="#ECB22E"/>
      <path d="M80.2 100.4c-7.3 0-13.2-5.9-13.2-13.2s5.9-13.2 13.2-13.2H113c7.3 0 13.2 5.9 13.2 13.2s-5.9 13.2-13.2 13.2H80.2z" fill="#ECB22E"/>
    </svg>
  )
}

function TypingBubble({ user, isMine, dark, border, text }) {
  return (
    <>
      <style>{`
        @keyframes slackDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%            { transform: translateY(-4px); opacity: 1; }
        }
        .slack-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: slackDot 1.2s ease-in-out infinite; }
        .slack-dot:nth-child(2) { animation-delay: 0.2s; }
        .slack-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
      <div style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
        <UserAvatar user={user} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', gap: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: isMine ? '#00bcd4' : text }}>
            {user.name.split(' ')[0]}
          </span>
          <div style={{
            padding: '10px 14px',
            borderRadius: isMine ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
            background: isMine ? (dark ? 'rgba(0,188,212,0.15)' : 'rgba(0,188,212,0.10)') : (dark ? '#252525' : '#F4F4F5'),
            border: isMine ? '1px solid rgba(0,188,212,0.3)' : `1px solid ${border}`,
            display: 'flex', gap: 4, alignItems: 'center',
            color: dark ? '#aaa' : '#A1A1AA',
          }}>
            <span className="slack-dot" />
            <span className="slack-dot" />
            <span className="slack-dot" />
          </div>
        </div>
      </div>
    </>
  )
}

function UserAvatar({ user }) {
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
      <img
        src={user.src}
        alt={user.name}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(user.imgStyle ?? {}) }}
      />
    </div>
  )
}

function DateDivider({ dark }) {
  const lineColor = dark ? '#2a2a2a' : '#E4E4E7'   // was #e0e0e0 — matches border system
  const textColor = dark ? '#666' : '#A1A1AA'      // was #aaa — slate gray
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 6px' }}>
      <div style={{ flex: 1, height: 1, background: lineColor }} />
      <span style={{
        fontSize: 10, fontWeight: 700, color: textColor,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        border: `1px solid ${lineColor}`, borderRadius: 20,
        padding: '2px 10px',
      }}>
        Today
      </span>
      <div style={{ flex: 1, height: 1, background: lineColor }} />
    </div>
  )
}

function Reactions({ reactions, dark }) {
  if (!reactions?.length) return null
  const bg       = dark ? 'rgba(255,255,255,0.06)' : '#F4F4F5'            // was rgba(0,0,0,0.05)
  const border   = dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E4E4E7' // was rgba(0,0,0,0.1)
  const textColor= dark ? 'rgba(255,255,255,0.65)' : '#52525B'           // was #555 — slate gray
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
      {reactions.map(r => (
        <div
          key={r.emoji}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: bg, border, borderRadius: 20,
            padding: '2px 7px', fontSize: 11,
            cursor: 'default', userSelect: 'none',
          }}
        >
          <span style={{ fontSize: 13 }}>{r.emoji}</span>
          <span style={{ color: textColor, fontWeight: 600 }}>{r.count}</span>
        </div>
      ))}
    </div>
  )
}

const TYPING_DURATION = 3000
const BETWEEN_DELAY   = 600

export default function SlackPanel({ open, onClose, theme, activeUser }) {
  const [visibleMessages, setVisibleMessages] = useState([])
  const [typingUser, setTypingUser] = useState(null)
  const bottomRef  = useRef(null)
  const messagesRef = useRef([])

  const activeUserId = activeUser?.id ?? 1

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [visibleMessages, typingUser])

  useEffect(() => {
    if (!open) {
      setVisibleMessages([])
      setTypingUser(null)
      return
    }

    messagesRef.current = buildMessages(activeUserId)
    setVisibleMessages([])
    setTypingUser(null)

    const timers = []
    let t = 400

    messagesRef.current.forEach((msg, i) => {
      const user = USERS.find(u => u.id === msg.userId)
      timers.push(setTimeout(() => setTypingUser(user), t))
      t += TYPING_DURATION
      timers.push(setTimeout(() => {
        setVisibleMessages(prev => [...prev, { ...msg, reactions: BASE_REACTIONS[i] ?? null }])
        setTypingUser(null)
      }, t))
      t += BETWEEN_DELAY
    })

    return () => timers.forEach(clearTimeout)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const dark        = theme === 'dark'
  const panelBg     = dark ? '#1a1a1a' : '#FFFFFF'
  const border      = dark ? '#2a2a2a' : '#E4E4E7'   // was #e0e0e0 — matches dashboard border system
  const text        = dark ? '#fff'    : '#18181B'   // was #111 — softer near-black
  const textDim     = dark ? '#888'    : '#71717A'   // was #888 — slate gray (readable on white)
  const inputBg     = dark ? '#252525' : '#F4F4F5'   // was #f9f9f9 — matches THEME.light.inputBg
  const inputBorder = dark ? '#3a3a3a' : '#D4D4D8'   // was #d0d0d0 — matches THEME.light.inputBorder
  const toolbarBorder = dark ? '#2e2e2e' : '#E4E4E7' // was #e8e8e8 — matches border system

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 199,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 300ms ease',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 48, right: 0, bottom: 0, width: 360,
        background: panelBg,
        borderLeft: `1px solid ${border}`,
        display: 'flex', flexDirection: 'column',
        zIndex: 200,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms ease',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>

        {/* ── Workspace strip (Slack aubergine) ── */}
        <div style={{
          background: '#3F0E40',
          padding: '9px 14px',
          display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0,
        }}>
          <SlackLogo size={18} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', flex: 1, letterSpacing: '0.01em' }}>
            WarehouseIQ
          </span>
          <button
            onClick={onClose}
            style={{
              width: 22, height: 22, borderRadius: 4, border: 'none',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} color="rgba(255,255,255,0.6)" />
          </button>
        </div>

        {/* ── Channel header ── */}
        <div style={{
          background: dark ? '#161616' : '#F8F9FA',  // was #f5f5f5 — matches page bg
          borderBottom: `1px solid ${border}`,
          padding: '8px 14px 9px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, color: dark ? 'rgba(255,255,255,0.35)' : '#A1A1AA', fontWeight: 400, lineHeight: 1 }}>#</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: text }}>warehouse-ops</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <div style={{ display: 'flex' }}>
              {USERS.map((u, i) => (
                <div key={u.id} style={{
                  width: 16, height: 16, borderRadius: '50%', overflow: 'hidden',
                  border: `1.5px solid ${dark ? '#161616' : '#F8F9FA'}`,
                  marginLeft: i === 0 ? 0 : -5,
                }}>
                  <img src={u.src} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover', ...(u.imgStyle ?? {}) }} />
                </div>
              ))}
            </div>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4caf50', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: textDim }}>2 members online</span>
          </div>
          <div style={{ fontSize: 10, color: dark ? '#555' : '#A1A1AA', marginTop: 5, fontStyle: 'italic' }}>
            Ops alerts, inventory flags, and fulfillment updates
          </div>
        </div>

        {/* ── Message feed ── */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '10px 14px',
          display: 'flex', flexDirection: 'column', gap: 10,
          scrollbarWidth: 'thin', scrollbarColor: `${border} ${panelBg}`,
        }}>
          {/* Date divider always shows once panel is open */}
          {open && <DateDivider dark={dark} />}

          {visibleMessages.map((msg, i) => {
            const user   = USERS.find(u => u.id === msg.userId)
            const isMine = msg.userId === activeUserId
            return (
              <div key={i} style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                <UserAvatar user={user} />
                <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexDirection: isMine ? 'row-reverse' : 'row' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: isMine ? '#00bcd4' : text }}>
                      {user.name.split(' ')[0]}
                    </span>
                    <span style={{ fontSize: 10, color: textDim }}>{msg.time}</span>
                  </div>
                  <div style={{
                    padding: '7px 11px',
                    borderRadius: isMine ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                    background: isMine
                      ? (dark ? 'rgba(0,188,212,0.15)' : 'rgba(0,188,212,0.10)')
                      : (dark ? '#252525' : '#F4F4F5'),  // was #f0f0f0 — matches inputBg
                    border: isMine ? '1px solid rgba(0,188,212,0.3)' : `1px solid ${border}`,
                    fontSize: 12, color: text, lineHeight: 1.55,
                  }}>
                    {msg.text}
                  </div>
                  <Reactions reactions={msg.reactions} dark={dark} />
                </div>
              </div>
            )
          })}

          {typingUser && (
            <TypingBubble
              user={typingUser}
              isMine={typingUser.id === activeUserId}
              dark={dark}
              border={border}
              text={text}
            />
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input area ── */}
        <div style={{ padding: '10px 14px 12px', flexShrink: 0 }}>
          <div style={{
            border: `1px solid ${inputBorder}`,
            borderRadius: 8,
            background: inputBg,
            overflow: 'hidden',
          }}>
            {/* Fake text field */}
            <div style={{
              padding: '9px 12px 7px',
              fontSize: 12, color: textDim,
              userSelect: 'none',
              minHeight: 36,
            }}>
              Message #warehouse-ops
            </div>
            {/* Formatting toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center',
              borderTop: `1px solid ${toolbarBorder}`,
              padding: '5px 8px',
              gap: 2,
            }}>
              {[Bold, Italic, AtSign, Paperclip, Smile].map((Icon, i) => (
                <button key={i} style={{
                  width: 26, height: 26, borderRadius: 5, border: 'none',
                  background: 'transparent', cursor: 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={13} color={textDim} />
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button style={{
                width: 26, height: 26, borderRadius: 5, border: 'none',
                background: '#007a5a', cursor: 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Send size={12} color="#fff" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
