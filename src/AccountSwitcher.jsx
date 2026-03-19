import { useState, useRef, useEffect } from 'react'

const HOVER_STYLE = `
@keyframes avatarHoverReveal {
  from { transform: scale(1.18); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}
.avatar-hover-card {
  animation: avatarHoverReveal 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.avatar-user-row:hover {
  background: rgba(0,188,212,0.08) !important;
}
`

export const USERS = [
  { id: 1, name: 'Takumi Fujiwara', role: 'Supply Chain Manager', src: '/avatar.jpg'   },
  { id: 2, name: 'Sarah Smiles',    role: 'Operations Analyst',   src: '/avatar2.avif',
    imgStyle: { transform: 'scale(1.3) translateY(-8%)', transformOrigin: 'center 25%' } },
]

// Renders a circular avatar with per-user zoom/crop applied
function Avatar({ user, size, border, onClick, title, cursor }) {
  return (
    <div
      onClick={onClick}
      title={title}
      style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        flexShrink: 0, border, cursor: cursor ?? 'default',
        transition: 'border 0.15s',
      }}
    >
      <img
        src={user.src}
        alt={user.name}
        style={{
          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          ...(user.imgStyle ?? {}),
        }}
      />
    </div>
  )
}

export default function AccountSwitcher({ activeUser, onSwitch, T, marginLeft }) {
  const [hovered, setHovered] = useState(false)
  const ref = useRef(null)

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', flexShrink: 0, marginLeft: marginLeft ?? 0 }}
    >
      <style>{HOVER_STYLE}</style>

      <Avatar
        user={activeUser}
        size={28}
        border={hovered ? '2px solid #00bcd4' : `1px solid ${T.inputBorder}`}
        cursor="pointer"
        title="Switch account"
      />

      {hovered && (
        <div
          className="avatar-hover-card"
          style={{
            position: 'absolute', top: 36, right: 0,
            background: T.panelBg,
            border: `1px solid ${T.border}`,
            borderRadius: 10, padding: '10px 8px 8px',
            minWidth: 215, zIndex: 9999,
            boxShadow: '0 10px 32px rgba(0,0,0,0.5)',
          }}
        >
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
                className="avatar-user-row"
                onClick={() => onSwitch(user)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 8px', borderRadius: 7,
                  cursor: active ? 'default' : 'pointer',
                  background: active ? 'rgba(0,188,212,0.1)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar
                    user={user}
                    size={36}
                    border={active ? '2px solid #00bcd4' : `2px solid ${T.border}`}
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
