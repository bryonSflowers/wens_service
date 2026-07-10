import { useGlossaryStore } from '../../store/glossary'
import { useLangStore } from '../../store/language'
import { GLOSSARY, GLOSSARY_TERMS } from '../../utils/glossary'
import { useState, type ReactNode, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'

interface TooltipPos { x: number; y: number }

export function TermTooltip({ term, children }: { term: string; children: ReactNode }) {
  const enabled = useGlossaryStore((s) => s.enabled)
  const lang = useLangStore((s) => s.lang)
  const [pos, setPos] = useState<TooltipPos | null>(null)

  const entry = GLOSSARY[term]
  const explanation = entry?.[lang as 'en' | 'zh-TW'] ?? entry?.en

  const show = (e: MouseEvent<HTMLSpanElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setPos({ x: r.left + r.width / 2, y: r.top })
  }

  if (!enabled || !explanation) return <>{children}</>

  return (
    <>
      <span
        className="cursor-help"
        style={{ borderBottom: '1px dotted var(--accent)' }}
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
      >
        {children}
      </span>
      {pos && createPortal(
        <div
          className="text-xs leading-relaxed rounded-xl px-3 py-2.5 shadow-2xl pointer-events-none"
          style={{
            position: 'fixed',
            zIndex: 9999,
            left: pos.x,
            top: pos.y - 10,
            transform: 'translate(-50%, -100%)',
            maxWidth: 300,
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            color: 'var(--text)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
          }}
        >
          {explanation}
          <span
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: '100%',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid var(--card-border)',
            }}
          />
        </div>,
        document.body,
      )}
    </>
  )
}

// Auto-scans English text for known glossary terms and wraps them.
// For zh-TW labels, use TermTooltip with an explicit term prop instead.
export function GlossaryText({ text }: { text: string }) {
  const enabled = useGlossaryStore((s) => s.enabled)

  if (!enabled) return <>{text}</>

  const parts: ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    let matched = false
    for (const term of GLOSSARY_TERMS) {
      const idx = remaining.toLowerCase().indexOf(term.toLowerCase())
      if (idx === -1) continue
      if (idx > 0) parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>)
      parts.push(
        <TermTooltip key={key++} term={term}>
          {remaining.slice(idx, idx + term.length)}
        </TermTooltip>,
      )
      remaining = remaining.slice(idx + term.length)
      matched = true
      break
    }
    if (!matched) {
      parts.push(<span key={key++}>{remaining}</span>)
      break
    }
  }

  return <span>{parts}</span>
}
