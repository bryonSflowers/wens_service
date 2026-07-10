import { BookOpen } from 'lucide-react'
import { useGlossaryStore } from '../../store/glossary'

export function GlossaryToggle() {
  const enabled = useGlossaryStore((s) => s.enabled)
  const toggle = useGlossaryStore((s) => s.toggle)

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg transition-all"
      style={{
        color: enabled ? 'var(--accent)' : 'var(--text-secondary)',
        background: enabled ? 'rgba(59,130,246,0.12)' : 'transparent',
        border: `1px solid ${enabled ? 'rgba(59,130,246,0.25)' : 'transparent'}`,
      }}
      title={enabled ? 'Glossary ON — hover terms for definitions' : 'Glossary OFF'}
    >
      <BookOpen className="w-4 h-4" />
    </button>
  )
}
