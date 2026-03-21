import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, X, Clipboard, Check, Languages } from 'lucide-react'

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
    { role: 'ai', text: 'The drop is concentrated in LA and SF. SKU 1042 hit stockout across both DCs. West Coast replenishment runs 6 days, so recovery is Thursday at the earliest.' },
    { role: 'user', text: "What's the revenue risk if we don't act by EOD?" },
    { role: 'ai', text: "We're projecting $420K in lost revenue over 72 hours, plus SLA exposure on 3 key retail accounts with breach windows opening tomorrow morning." },
    { role: 'user', text: 'Should we reroute from the Phoenix DC?' },
    { role: 'ai', text: 'Yes. Phoenix has 1,200 units of SKU 1042 and can reach LA in ~18 hours via ground priority, covering ~60% of the demand gap immediately.' },
  ],
  'Canada': [
    { role: 'user', text: 'Why is shipment time spiking across Ontario?' },
    { role: 'ai', text: 'A winter storm hit the Toronto–Montreal corridor Tuesday. Carriers are running 2–3 day delays and our Mississauga DC lost 4 loading bays to ice damage.' },
    { role: 'user', text: 'Are we at risk of SLA breaches?' },
    { role: 'ai', text: '14 enterprise accounts are at risk, 8 in Ontario and 6 in Quebec. The first breach window opens in 36 hours.' },
    { role: 'user', text: 'Can air freight bridge the gap?' },
    { role: 'ai', text: 'Air out of Pearson covers the Montreal shortfall. It adds $38/unit, but that\'s ~$215K in expedite cost vs. ~$580K in SLA penalties. Air freight wins here.' },
  ],
  'Mexico': [
    { role: 'user', text: '¿Qué está causando los retrasos de cumplimiento en Monterrey?' },
    { role: 'ai', text: 'Los volúmenes de inspección de la CBP en Laredo aumentaron un 40%. El tiempo de permanencia promedio pasó de 4 a 11 horas. Tres camiones con destino norte están en inspección secundaria en este momento.' },
    { role: 'user', text: '¿Cómo afecta esto a nuestra puntuación de salud de inventario?' },
    { role: 'ai', text: 'Monterrey cayó al 58% de salud, impulsado por retrasos en la entrada de SKU 2210 y SKU 2215, ambos vinculados a los camiones retenidos.' },
    { role: 'user', text: '¿Cuál es nuestra mejor contingencia?' },
    { role: 'ai', text: 'Abastece el 60% del SKU 2210 desde Guadalajara. Evita la frontera por completo con un tiempo de entrega de 2 días frente a más de 6 para el envío retenido. Se recomienda tomar esa decisión hoy.' },
  ],
  'Germany': [
    { role: 'user', text: 'Warum ist die Dock-Effizienz am Hamburger Terminal gesunken?' },
    { role: 'ai', text: 'Hamburg hat letzten Montag auf das neue EU-Zollerklärungssystem umgestellt. Die Bearbeitungszeit pro Manifest stieg von 12 auf 31 Minuten. Die Teams haben die Schulung zum neuen Protokoll noch nicht abgeschlossen.' },
    { role: 'user', text: 'Sind wir EU-Compliance-Strafen ausgesetzt?' },
    { role: 'ai', text: 'Zwei Sendungen haben das 24-Stunden-Voranmeldefenster gemäß ICS2 verpasst. Das Strafrisiko beträgt 4.200 €. Verspätete Erklärungen sollten bis Freitag eingereicht werden.' },
    { role: 'user', text: 'Wann normalisiert sich die Effizienz wieder?' },
    { role: 'ai', text: 'Die Schulung endet Ende der Woche. Wir erwarten eine Rückkehr zu 18-minütigen Dock-Zeiten bis Montag, was den Durchsatz wieder innerhalb der SLA bringt.' },
  ],
  'Japan': [
    { role: 'user', text: 'キュー時間が増加しています。原因は何ですか？' },
    { role: 'ai', text: '大阪工場が先週3日間のカイゼンイベントを実施し、ピッカーのスループットが一時的に22%低下しました。キュー深度は94ユニットでピークとなり、40ユニットのJIT閾値を大きく上回りました。' },
    { role: 'user', text: '廃棄率はまだ仕様の範囲内ですか？' },
    { role: 'ai', text: '不良率は0.018%で仕様内です。ただし、動作ムダが増加しています。カイゼンチームはピックパックフローで3つの冗長ステップを特定しており、削除後にユニットあたり8秒の短縮が見込まれます。' },
    { role: 'user', text: '完全なJITフローはいつ再開しますか？' },
    { role: 'ai', text: '改訂された標準は月曜日に施行されます。モデリングでは、実施から48時間以内にキュー深度が35ユニットに戻ることが示されています。' },
  ],
  'Korea': [
    { role: 'user', text: '이번 주 서울의 판매 급증 원인은 무엇인가요?' },
    { role: 'ai', text: '주요 전자제품 출시로 SKU K77의 수요가 340% 급증했습니다. 모델이 출시일과의 상관관계를 놓쳤고, 현재 재고는 2.1일치 수요만 충당 가능합니다.' },
    { role: 'user', text: '유통 네트워크가 이를 감당할 수 있나요?' },
    { role: 'ai', text: '인천 허브가 94% 용량에 달했습니다. 부산에 초과 물량이 있지만 경로 추가로 6시간이 더 소요되어 익일 SLA가 위험해집니다.' },
    { role: 'user', text: '다음에 이런 예측 오류를 어떻게 방지할 수 있을까요?' },
    { role: 'ai', text: '마케팅 출시 캘린더를 예측 모델에 통합했다면 3주 전에 이를 포착할 수 있었을 것입니다. 해당 피드는 약 2일 내에 구축 가능합니다.' },
  ],
  'China': [
    { role: 'user', text: '为什么上海的出口履行率低于目标？' },
    { role: 'ai', text: '浦东正处理黄金周补货带来的超额订单，比正常量高出18%。纸箱封装线是瓶颈，当前上限为每小时4,200件，而目标是5,800件。' },
    { role: 'user', text: '这对美国交货时间有什么影响？' },
    { role: 'ai', text: '6批集装箱货物平均延误3.2天。美国零售合作伙伴将在12月11日至12日收到圣诞前库存，而非原定的12月8日。' },
    { role: 'user', text: '我们可以对高优先级的SKU进行空运吗？' },
    { role: 'ai', text: '从PVG空运可覆盖利润率最高的4个SKU：C14、C19、C22、C31。费用为18万美元，但可保护210万美元的节假日利润。建议立即批准这些SKU的空运。' },
  ],
}

// ── English versions for non-English countries ─────────────────────────────
const CONVERSATIONS_EN = {
  'Mexico': [
    { role: 'user', text: "What's causing the fulfillment delays in Monterrey?" },
    { role: 'ai', text: 'CBP inspection volumes at Laredo are up 40%. Average dwell time jumped from 4 to 11 hours. Three northbound trucks are in secondary inspection right now.' },
    { role: 'user', text: 'How does this affect our inventory health score?' },
    { role: 'ai', text: 'Monterrey dropped to 58% health, driven by inbound delays on SKU 2210 and SKU 2215, both tied to the held trucks.' },
    { role: 'user', text: "What's our best contingency?" },
    { role: 'ai', text: 'Source 60% of SKU 2210 from Guadalajara. It bypasses the border entirely with a 2 day lead time vs. 6+ for the held shipment. Recommend pulling that lever today.' },
  ],
  'Germany': [
    { role: 'user', text: 'Why is dock efficiency down at the Hamburg terminal?' },
    { role: 'ai', text: "Hamburg upgraded to the new EU customs declaration system last Monday. Processing time per manifest jumped from 12 to 31 minutes. Teams haven't completed the new protocol training yet." },
    { role: 'user', text: 'Are we exposed to any EU compliance penalties?' },
    { role: 'ai', text: 'Two shipments missed the 24 hour pre arrival notification window under ICS2. Penalty exposure is €4,200. Late declarations should be filed before Friday.' },
    { role: 'user', text: 'When will efficiency normalize?' },
    { role: 'ai', text: "Training completes end of week. We're projecting a return to 18 minute dock times by Monday, which brings throughput back within SLA." },
  ],
  'Japan': [
    { role: 'user', text: "Queue times are up. What's driving it?" },
    { role: 'ai', text: 'The Osaka facility ran a 3 day kaizen event last week, temporarily cutting picker throughput 22%. Queue depth peaked at 94 units, well above the 40 unit JIT threshold.' },
    { role: 'user', text: 'Is the waste ratio still within spec?' },
    { role: 'ai', text: 'Defect rate is 0.018%, within spec. Motion waste is elevated though. The kaizen team flagged 3 redundant steps in the pick pack flow that will cut 8 seconds per unit once removed.' },
    { role: 'user', text: 'When does full JIT flow resume?' },
    { role: 'ai', text: 'The revised standard takes effect Monday. Modeling shows queue depth returning to 35 units within 48 hours of implementation.' },
  ],
  'Korea': [
    { role: 'user', text: "What's driving the sales spike in Seoul this week?" },
    { role: 'ai', text: 'A major electronics launch triggered a 340% demand surge for SKU K77. Our model missed the correlation to the launch date. Current inventory covers only 2.1 days of demand.' },
    { role: 'user', text: 'Can the distribution network handle this?' },
    { role: 'ai', text: 'Incheon hub is at 94% capacity. We have overflow at Busan, but routing adds 6 hours and puts next day SLAs at risk.' },
    { role: 'user', text: 'How do we prevent this forecast miss next time?' },
    { role: 'ai', text: 'Integrating the marketing launch calendar into the forecast model would have flagged this 3 weeks out. That feed can be built in about 2 days.' },
  ],
  'China': [
    { role: 'user', text: 'Why is export fulfillment below target in Shanghai?' },
    { role: 'ai', text: 'Pudong is processing 18% above normal volume from Golden Week restocks. The carton sealing line is the bottleneck, capped at 4,200 units/hour vs. 5,800 target.' },
    { role: 'user', text: "What's the downstream impact on US delivery timelines?" },
    { role: 'ai', text: '6 container shipments are delayed an average of 3.2 days. US retail partners will see pre Christmas stock arrive Dec 11–12 instead of Dec 8.' },
    { role: 'user', text: 'Can we air freight the high-priority SKUs?' },
    { role: 'ai', text: 'Air from PVG covers the top 4 margin SKUs: C14, C19, C22, C31. Cost is $180K but protects $2.1M in holiday margin. Recommend approving air freight for those SKUs immediately.' },
  ],
}

const ENGLISH_ONLY = new Set(['United States', 'Canada'])
const NATIVE_LABEL = { Mexico: 'Spanish', Germany: 'German', Japan: 'Japanese', Korea: 'Korean', China: 'Mandarin' }

// Native-language UI strings for non-English countries
const UI_TEXT = {
  'United States': { prompt: 'Click the mic button to start\nor use the text box', placeholder: 'How can I help you today…', translateTo: 'Translate to English', showIn: lang => `Show in ${lang}`, copied: 'Copied!', copy: 'Copy conversation' },
  'Canada':        { prompt: 'Click the mic button to start\nor use the text box', placeholder: 'How can I help you today…', translateTo: 'Translate to English', showIn: lang => `Show in ${lang}`, copied: 'Copied!', copy: 'Copy conversation' },
  'Mexico':        { prompt: 'Haz clic en el micrófono para comenzar\no usa el cuadro de texto', placeholder: '¿En qué puedo ayudarte hoy…', translateTo: 'Traducir al inglés', showIn: () => 'Mostrar en español', copied: '¡Copiado!', copy: 'Copiar conversación' },
  'Germany':       { prompt: 'Klicke auf das Mikrofon, um zu beginnen\noder nutze das Textfeld', placeholder: 'Wie kann ich Ihnen heute helfen…', translateTo: 'Ins Englische übersetzen', showIn: () => 'Auf Deutsch anzeigen', copied: 'Kopiert!', copy: 'Gespräch kopieren' },
  'Japan':         { prompt: 'マイクボタンをクリックして開始\nまたはテキストボックスを使用', placeholder: '今日はどのようにお手伝いできますか…', translateTo: '英語に翻訳', showIn: () => '日本語で表示', copied: 'コピーしました！', copy: '会話をコピー' },
  'Korea':         { prompt: '마이크 버튼을 클릭하여 시작하거나\n텍스트 상자를 사용하세요', placeholder: '오늘 어떻게 도와드릴까요…', translateTo: '영어로 번역', showIn: () => '한국어로 보기', copied: '복사됨!', copy: '대화 복사' },
  'China':         { prompt: '点击麦克风按钮开始\n或使用文本框', placeholder: '今天有什么可以帮您的…', translateTo: '翻译成英文', showIn: () => '显示中文', copied: '已复制！', copy: '复制对话' },
}

// ── AI typing dots ───────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 14px' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#f59e0b', display: 'inline-block',
          animation: `va-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  )
}

// ── User voice waveform ───────────────────────────────────────────────────────
const WAVE_HEIGHTS = [10, 20, 28, 18, 32, 14, 26, 20, 12, 24]
function VoiceWave() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '8px 14px', height: 44 }}>
      {WAVE_HEIGHTS.map((h, i) => (
        <span key={i} style={{
          display: 'inline-block', width: 3, borderRadius: 2,
          background: '#00bcd4', height: h,
          animation: `va-wave ${0.6 + (i % 4) * 0.15}s ease-in-out ${i * 0.07}s infinite alternate`,
        }} />
      ))}
    </div>
  )
}

// ── Typewriter text (user messages) ──────────────────────────────────────────
function TypewriterText({ text, color, onDone, onChar }) {
  const [displayed, setDisplayed] = useState('')
  const isCJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(text)
  useEffect(() => {
    setDisplayed('')
    let i = 0
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      onChar?.()
      if (i >= text.length) { clearInterval(id); onDone?.() }
    }, isCJK ? 100 : 65)
    return () => clearInterval(id)
  }, [text])
  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span style={{ borderRight: `2px solid ${color}`, marginLeft: 1, animation: 'va-cursor 0.7s step-end infinite' }}> </span>
      )}
    </span>
  )
}

// ── Anthropic spinner (AI avatar) ────────────────────────────────────────────
function AnthropicSpinner({ active }) {
  const rays = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
  return (
    <div style={{ width: 26, height: 26, flexShrink: 0, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
      <svg width="22" height="22" viewBox="0 0 24 24" style={{ animation: active ? 'va-spin 1.8s linear infinite' : 'none' }}>
        {rays.map((angle, i) => (
          <line key={i} x1="12" y1="2.5" x2="12" y2="6.5"
            stroke="#c96a4a" strokeWidth="2.2" strokeLinecap="round"
            transform={`rotate(${angle} 12 12)`}
            opacity={active ? 0.5 + (i % 4) * 0.17 : 0.55}
          />
        ))}
      </svg>
    </div>
  )
}

// ── Word-by-word text (AI messages) ──────────────────────────────────────────
function WordByWordText({ text, onDone, onWord }) {
  const isCJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(text)
  const tokens = isCJK ? [...text] : text.split(' ')
  const [count, setCount] = useState(0)
  useEffect(() => {
    setCount(0)
    let i = 0
    const id = setInterval(() => {
      i++
      setCount(i)
      onWord?.()
      if (i >= tokens.length) { clearInterval(id); onDone?.() }
    }, isCJK ? 60 : 90)
    return () => clearInterval(id)
  }, [text])
  return <span>{isCJK ? tokens.slice(0, count).join('') : tokens.slice(0, count).join(' ')}</span>
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
  const [userWriting, setUserWriting] = useState(false)
  const [aiIsAnimating, setAiIsAnimating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [micPulsing, setMicPulsing] = useState(false)
  const [visible, setVisible] = useState(false)
  const [started, setStarted] = useState(false)
  const [translated, setTranslated] = useState(false)
  const [pos, setPos] = useState(DEFAULT_POS)
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const timersRef = useRef([])
  const scrollRef = useRef(null)
  const userWritingDoneRef = useRef(null)
  const aiWritingDoneRef = useRef(null)

  const meta = COUNTRY_META[country] || { flag: '🌍', label: country }
  const nativeUiText = UI_TEXT[country] || UI_TEXT['United States']
  const uiText = (!ENGLISH_ONLY.has(country) && translated)
    ? UI_TEXT['United States']
    : nativeUiText

  // Reset translated state when country changes
  useEffect(() => { setTranslated(false) }, [country])

  const activeConversation = !ENGLISH_ONLY.has(country) && translated
    ? (CONVERSATIONS_EN[country] || CONVERSATIONS['United States'])
    : (CONVERSATIONS[country] || CONVERSATIONS['United States'])

  function scrollToBottom() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }

  // scroll to bottom on new messages
  useEffect(() => { scrollToBottom() }, [messages, typingRole])

  // animate in/out; reset on open
  useEffect(() => {
    if (open) {
      setVisible(true)
      setPos(DEFAULT_POS())
      setMessages([])
      setTypingRole(null)
      setStarted(false)
      setUserWriting(false)
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    } else {
      setVisible(false)
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      // small delay before resetting messages so exit animation plays
      userWritingDoneRef.current = null
      aiWritingDoneRef.current = null
      const t = setTimeout(() => { setMessages([]); setTypingRole(null); setStarted(false); setUserWriting(false); setAiIsAnimating(false) }, 300)
      timersRef.current.push(t)
    }
    return () => { timersRef.current.forEach(clearTimeout) }
  }, [open, country])

  function handleCopy() {
    if (!messages.length) return
    const text = messages.map(m => `${m.role === 'user' ? 'You' : 'Assistant'}: ${m.text}`).join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleMicClick() {
    if (started) return
    setStarted(true)
    playScript(activeConversation)
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
    let idx = 0

    function playNext() {
      if (idx >= msgs.length) return
      const msg = msgs[idx++]
      const isAi = msg.role === 'ai'

      if (!isAi) {
        // show voice wave in input box
        setTypingRole('user')
        const t1 = setTimeout(() => {
          // reveal message → typewriter starts
          setTypingRole(null)
          setMessages(prev => [...prev, msg])
          setUserWriting(true)
          // when typewriter finishes, wait 1s then play AI response
          userWritingDoneRef.current = () => {
            const t2 = setTimeout(playNext, 1000)
            timersRef.current.push(t2)
          }
        }, 1200)
        timersRef.current.push(t1)
      } else {
        // reveal AI message immediately, word-by-word handles the pacing
        setMessages(prev => [...prev, msg])
        setAiIsAnimating(true)
        aiWritingDoneRef.current = () => {
          setAiIsAnimating(false)
          const t1 = setTimeout(playNext, 800)
          timersRef.current.push(t1)
        }
      }
    }

    const t0 = setTimeout(playNext, 800)
    timersRef.current.push(t0)
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
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,188,212,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(0,188,212,0); }
        }
        @keyframes va-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes va-wave {
          from { transform: scaleY(0.25); opacity: 0.5; }
          to   { transform: scaleY(1);    opacity: 1; }
        }
        .va-clip-wrap:hover .va-clip-tip { opacity: 1 !important; }
        @keyframes va-cursor {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: pos.y, left: pos.x,
          zIndex: 300,
          width: PANEL_W,
          height: '49vh',
          maxHeight: '49vh',
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

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, lineHeight: 1 }}>WarehouseIQ Assistant</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Powered by Anthropic</div>
          </div>
          {!ENGLISH_ONLY.has(country) && (
            <div style={{ position: 'relative', flexShrink: 0 }} className="va-clip-wrap">
              <button
                onClick={() => {
                  const newTranslated = !translated
                  setTranslated(newTranslated)
                  if (started && messages.length > 0) {
                    const newConv = !ENGLISH_ONLY.has(country) && newTranslated
                      ? (CONVERSATIONS_EN[country] || CONVERSATIONS['United States'])
                      : (CONVERSATIONS[country] || CONVERSATIONS['United States'])
                    setMessages(newConv.slice(0, messages.length))
                  } else {
                    setMessages([])
                    setStarted(false)
                  }
                }}
                onMouseDown={e => e.stopPropagation()}
                style={{
                  width: 24, height: 24, borderRadius: 6, cursor: 'pointer',
                  border: `1px solid ${translated ? 'rgba(201,106,74,0.4)' : T.border}`,
                  background: translated ? 'rgba(201,106,74,0.1)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 150ms',
                }}
              >
                <Languages size={13} color={translated ? '#c96a4a' : T.textMuted} />
              </button>
              <div className="va-clip-tip" style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: '50%',
                transform: 'translateX(-50%)',
                background: theme === 'dark' ? '#333' : '#222',
                color: '#fff', fontSize: 11, whiteSpace: 'nowrap',
                padding: '4px 8px', borderRadius: 5,
                pointerEvents: 'none', opacity: 0, transition: 'opacity 150ms',
              }}>
                {translated ? nativeUiText.showIn(NATIVE_LABEL[country]) : nativeUiText.translateTo}
              </div>
            </div>
          )}
          <div style={{ position: 'relative', flexShrink: 0 }} className="va-clip-wrap">
            <button
              onClick={handleCopy}
              onMouseDown={e => e.stopPropagation()}
              style={{
                width: 24, height: 24, borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : T.border}`,
                background: copied ? 'rgba(34,197,94,0.1)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 150ms',
              }}
            >
              {copied
                ? <Check size={13} color="#22c55e" />
                : <Clipboard size={13} color={T.textMuted} />}
            </button>
            <div className="va-clip-tip" style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: '50%',
              transform: 'translateX(-50%)',
              background: theme === 'dark' ? '#333' : '#222',
              color: '#fff', fontSize: 11, whiteSpace: 'nowrap',
              padding: '4px 8px', borderRadius: 5,
              pointerEvents: 'none', opacity: 0, transition: 'opacity 150ms',
            }}>
              {copied ? uiText.copied : uiText.copy}
            </div>
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
            display: 'flex', flexDirection: 'column', gap: 20,
            scrollbarWidth: 'thin',
          }}
        >
          {messages.length === 0 && !typingRole && !started && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: T.textMuted, fontSize: 12 }}>
                {uiText.prompt.split('\n')[0]}<br />{uiText.prompt.split('\n')[1]}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            return (
              <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', gap: 8 }}>
                {!isUser && (
                  <AnthropicSpinner active={aiIsAnimating && i === messages.length - 1} />
                )}
                {isUser ? (
                  <div style={{
                    maxWidth: '72%', padding: '9px 13px',
                    borderRadius: '12px 12px 4px 12px',
                    background: 'rgba(0,188,212,0.15)',
                    border: '1px solid rgba(0,188,212,0.3)',
                    fontSize: 13, lineHeight: 1.55, color: '#00bcd4',
                  }}>
                    <TypewriterText text={msg.text} color="#00bcd4" onChar={scrollToBottom} onDone={() => { setUserWriting(false); userWritingDoneRef.current?.(); userWritingDoneRef.current = null }} />
                  </div>
                ) : (
                  <div style={{
                    maxWidth: '72%', fontSize: 13, lineHeight: 1.6,
                    color: T.text, alignSelf: 'flex-start',
                  }}>
                    <WordByWordText text={msg.text} onWord={scrollToBottom} onDone={() => { aiWritingDoneRef.current?.(); aiWritingDoneRef.current = null }} />
                  </div>
                )}
                {isUser && activeUser && (
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    overflow: 'hidden', alignSelf: 'flex-end',
                  }}>
                    <img src={activeUser.src} alt={activeUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(activeUser.imgStyle ?? {}) }} />
                  </div>
                )}
              </div>
            )
          })}

          {typingRole === 'user' && activeUser && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden' }}>
                <img src={activeUser.src} alt={activeUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(activeUser.imgStyle ?? {}) }} />
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
            border: `1px solid ${typingRole === 'user' || userWriting ? 'rgba(0,188,212,0.4)' : T.inputBorder}`,
            display: 'flex', alignItems: 'center',
            padding: typingRole === 'user' || userWriting ? '0 4px' : '0 12px',
            fontSize: 12, color: T.textMuted,
            overflow: 'hidden',
            transition: 'border 200ms',
          }}>
            {typingRole === 'user' || userWriting
              ? <VoiceWave />
              : (started ? '' : uiText.placeholder)}
          </div>
          <button
            title={started ? 'Listening…' : 'Start conversation'}
            onClick={handleMicClick}
            onMouseEnter={() => setMicPulsing(true)}
            onMouseLeave={() => setMicPulsing(false)}
            style={{
              width: 34, height: 34, borderRadius: 8, cursor: started ? 'default' : 'pointer', flexShrink: 0,
              border: started ? '1px solid rgba(0,188,212,0.5)' : `1px solid ${T.inputBorder}`,
              background: started ? 'rgba(0,188,212,0.12)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: (!started && micPulsing) ? 'va-mic-pulse 1.2s ease-in-out infinite' : 'none',
              transition: 'background 150ms, border 150ms',
            }}
          >
            <Mic size={15} color={started ? '#00bcd4' : (theme === 'dark' ? '#fff' : '#333')} />
          </button>
        </div>
      </div>
    </>
  )
}
