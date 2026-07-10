import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, Bot, User, StopCircle } from 'lucide-react'
import { useT } from '../i18n'


interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function ChatPage() {
  const _ = useT()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: _('chat.welcome') },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setLoading(true)
    setStreamingContent('')

    const controller = new AbortController()
    abortRef.current = controller

    const API_BASE = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_BASE || '')
    const token = sessionStorage.getItem('token')
    const apiKey = sessionStorage.getItem('api_key')

    try {
      const res = await fetch(`${API_BASE}/llm/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          max_tokens: 4096,
          stream: true,
        }),
        signal: controller.signal,
      })

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'content' && parsed.text) {
              fullText += parsed.text
              setStreamingContent(fullText)
            }
          } catch {}
        }
      }

      setMessages((m) => [...m, { role: 'assistant', content: fullText }])
      setStreamingContent('')
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setMessages((m) => [...m, { role: 'assistant', content: _('chat.error') }])
    } finally {
      setLoading(false)
      setStreamingContent('')
      abortRef.current = null
    }
  }, [input, loading, messages, _])

  const handleStop = () => {
    abortRef.current?.abort()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div>
        <h1 className="text-2xl font-bold">{_('chat.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{_('chat.subtitle')}</p>
      </div>

      <div className="flex-1 card mt-4 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}>
                <div className="prose-report whitespace-pre-wrap">{msg.content}</div>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ))}
          {streamingContent && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-blue-600" />
              </div>
              <div className="bg-gray-100 dark:bg-slate-700 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-gray-800 dark:text-slate-200">
                <div className="prose-report whitespace-pre-wrap">{streamingContent}</div>
                <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-0.5" />
              </div>
            </div>
          )}
          {loading && !streamingContent && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot className="w-4 h-4 text-blue-600" />
              </div>
              <div className="bg-gray-100 dark:bg-slate-700 rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder={_('chat.placeholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={loading}
            />
            {loading ? (
              <button className="btn-danger" onClick={handleStop}>
                <StopCircle className="w-4 h-4" />
              </button>
            ) : (
              <button className="btn-primary" onClick={handleSend} disabled={!input.trim()}>
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
