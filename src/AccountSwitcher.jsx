import { useState, useRef, useEffect } from 'react'

export const USERS = [
  { id: 1, name: 'Alex Chen',  role: 'Supply Chain Manager', src: '/avatar.jpg'   },
  { id: 2, name: 'Sarah Smiles', role: 'Operations Analyst',   src: '/avatar2.avif' },
]

export default function AccountSwitcher({ activeUser, onSwitch, T, marginLeft }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0, marginLeft: marginLeft ?? 0 }}>
      <img
        src={activeUser.src}
        alt={activeUser.name}
        onClick={() => setOpen(o => !o)}
        title="Switch account"
        style={{
          width: 28, height: 28, borderRadius: '50%', objectFit: 'cover',
          cursor: 'pointer', flexShrink: 0, display: 'block',
          border: open ? '2px solid #00bcd4' : `1px solid ${T.inputBorder}`,
          transition: 'border 0.15s',
        }}
      />

      {open && (
        <div style={{
          position: 'absolute', top: 36, right: 0,
          background: T.panelBg,
          border: `1px solid ${T.border}`,
          borderRadius: 10, padding: '10px 8px 8px',
          minWidth: 215, zIndex: 9999,
          boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: T.textDim,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            padding: '0 8px 8px',
            borderBottom: `1px solid ${T.border}`,
            marginBottom: 6,
          }}>
            User Accounts
          </div>

          {USERS.map(user => {
            const active = user.id === activeUser.id
            return (
              <div
                key={user.id}
                onClick={() => { onSwitch(user); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 8px', borderRadius: 7, cursor: 'pointer',
                  background: active ? 'rgba(0,188,212,0.1)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    src={user.src}
                    alt={user.name}
                    style={{
                      width: 36, height: 36, borderRadius: '50%', objectFit: 'cover',
                      border: active ? '2px solid #00bcd4' : `2px solid ${T.border}`,
                    }}
                  />
                  {active && (
                    <div style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: 10, height: 10, borderRadius: '50%',
                      background: '#4caf50', border: `2px solid ${T.panelBg}`,
                    }} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: active ? '#00bcd4' : T.text, lineHeight: 1.3 }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: 11, color: T.textDim }}>
                    {user.role}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
