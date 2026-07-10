import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const components: Components = {
  table({ children }) {
    return (
      <div className="overflow-x-auto my-4">
        <table className="w-full border-collapse">{children}</table>
      </div>
    )
  },
  th({ children }) {
    return (
      <th className="border border-[var(--card-border)] bg-[var(--sidebar-hover)] px-3 py-2 text-left text-xs font-semibold text-[var(--text)]">
        {children}
      </th>
    )
  },
  td({ children }) {
    return (
      <td className="border border-[var(--card-border)] px-3 py-2 text-sm text-[var(--text)]">
        {children}
      </td>
    )
  },
  pre({ children }) {
    return (
      <pre className="bg-[var(--sidebar-hover)] border border-[var(--card-border)] rounded-lg p-4 overflow-x-auto text-xs font-mono my-3 leading-relaxed whitespace-pre">
        {children}
      </pre>
    )
  },
  code({ children, className }) {
    const isBlock = !!className
    if (isBlock) return <code className={className}>{children}</code>
    return (
      <code className="bg-[var(--sidebar-hover)] border border-[var(--card-border)] px-1 py-0.5 rounded text-xs font-mono">
        {children}
      </code>
    )
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-4 border-[var(--accent)] bg-[var(--accent)]/5 pl-4 pr-3 py-2 my-3 rounded-r-lg text-[var(--text-secondary)] text-sm not-italic">
        {children}
      </blockquote>
    )
  },
  hr() {
    return <hr className="my-6 border-[var(--card-border)]" />
  },
  h1({ children }) {
    return (
      <h1 className="text-xl font-bold mt-6 mb-3 text-[var(--text)] border-b border-[var(--card-border)] pb-2">
        {children}
      </h1>
    )
  },
  h2({ children }) {
    return <h2 className="text-base font-semibold mt-5 mb-2 text-[var(--text)]">{children}</h2>
  },
  h3({ children }) {
    return <h3 className="text-sm font-semibold mt-4 mb-1.5 text-[var(--text-secondary)] uppercase tracking-wide">{children}</h3>
  },
  p({ children }) {
    return <p className="text-sm text-[var(--text)] leading-relaxed my-2">{children}</p>
  },
  ul({ children }) {
    return <ul className="list-disc pl-5 my-2 space-y-0.5 text-sm text-[var(--text)]">{children}</ul>
  },
  ol({ children }) {
    return <ol className="list-decimal pl-5 my-2 space-y-0.5 text-sm text-[var(--text)]">{children}</ol>
  },
  li({ children }) {
    return <li className="text-sm text-[var(--text)]">{children}</li>
  },
  strong({ children }) {
    return <strong className="font-semibold text-[var(--text)]">{children}</strong>
  },
}

export function ReportMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  )
}
