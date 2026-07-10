import { useGlossaryStore } from '../../store/glossary'
import { GLOSSARY, GLOSSARY_TERMS } from '../../utils/glossary'
import { useState, useRef, useEffect, type ReactNode } from 'react'

export function TermTooltip({ term, children }: { term: string; children: ReactNode }) {
  const enabled = useGlossaryStore((s) => s.enabled)
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const explanation = GLOSSARY[term]

  if (!enabled || !explanation) return <>{children}</>

  return (
    <span
      ref={ref}
      className="relative border-b border-dotted border-blue-400/40 cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs leading-relaxed shadow-xl whitespace-nowrap max-w-[320px] pointer-events-none" style={{ whiteSpace: 'normal' }}>
          {explanation}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  )
}

export function GlossaryText({ text }: { text: string }) {
  const enabled = useGlossaryStore((s) => s.enabled)
  const [show, setShow] = useState<string | null>(null)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!show) return
    const timer = setTimeout(() => setShow(null), 3000)
    return () => clearTimeout(timer)
  }, [show])

  if (!enabled) return <>{text}</>

  const parts: ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    let matched = false
    for (const term of GLOSSARY_TERMS) {
      const idx = remaining.toLowerCase().indexOf(term.toLowerCase())
      if (idx === -1) continue
      if (idx > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>)
      }
      const match = remaining.slice(idx, idx + term.length)
      parts.push(
        <TermTooltip key={key++} term={term}>
          {match}
        </TermTooltip>
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

  return <span ref={ref}>{parts}</span>
}
