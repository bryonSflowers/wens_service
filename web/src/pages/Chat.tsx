import { useState, useRef, useEffect } from 'react'
import { chatApi } from '../api/client'
import { Send, Loader2, Bot, User } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I can help you analyze Taiwan Mobile financial data. Ask me about revenue trends, monthly reports, or any financial metrics.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setLoading(true)

    try {
      const { data } = await chatApi.send({
        messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        max_tokens: 4096,
      })
      setMessages((m) => [...m, { role: 'assistant', content: data.content }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div>
        <h1 className="text-2xl font-bold">LLM Chat</h1>
        <p className="text-sm text-gray-500 mt-1">Chat with the AI analyst about financial data</p>
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
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot className="w-4 h-4 text-blue-600" />
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
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
              placeholder="Ask about financial data..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={loading}
            />
            <button className="btn-primary" onClick={handleSend} disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
