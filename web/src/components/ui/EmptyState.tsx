import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
}

export function EmptyState({ title = 'No data', description = 'Nothing to show yet.' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <Inbox className="w-12 h-12 mb-3" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs mt-1">{description}</p>
    </div>
  )
}
