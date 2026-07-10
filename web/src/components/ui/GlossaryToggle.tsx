import { BookOpen } from 'lucide-react'
import { useGlossaryStore } from '../../store/glossary'

export function GlossaryToggle() {
  const enabled = useGlossaryStore((s) => s.enabled)
  const toggle = useGlossaryStore((s) => s.toggle)

  return (
    <button
      onClick={toggle}
      className={`btn-ghost p-2 rounded-lg relative ${enabled ? 'text-blue-400 bg-blue-900/20' : ''}`}
      title={enabled ? 'Glossary on' : 'Glossary off'}
    >
      <BookOpen className="w-4 h-4" />
    </button>
  )
}
