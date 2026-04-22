'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, Bot, User, Sparkles, Lock } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AICoachPage() {
  const { data: subStatus } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: () => apiClient.get('/subscriptions/status').then((r: { data: { plan: string; status: string } }) => r.data),
  });

  const status = subStatus as { plan: string; status: string } | undefined;
  const isPro = status?.plan === 'student_pro' && status?.status === 'active';

  if (!isPro) {
    return <ProGate />;
  }

  return <ChatInterface />;
}

function ProGate() {
  const { mutate: checkout, isPending } = {
    mutate: async () => {
      const res = await apiClient.post('/subscriptions/checkout', {}) as { data: { url: string } };
      if (res.data.url) window.location.href = res.data.url;
    },
    isPending: false,
  };

  return (
    <div className="max-w-2xl mx-auto mt-20 text-center space-y-6">
      <div className="w-20 h-20 bg-primary-container/20 rounded-full flex items-center justify-center mx-auto">
        <Sparkles size={36} className="text-primary" />
      </div>
      <h1 className="text-3xl font-bold text-white">AI Investing Coach</h1>
      <p className="text-on-surface-variant text-lg">
        Get personalized portfolio feedback, ask anything about investing, and accelerate your learning with Claude AI.
      </p>
      <div className="card p-6 text-left space-y-3">
        {[
          'Personalized portfolio analysis and feedback',
          'Ask any investing question, get clear answers',
          'Contextual explanations tied to your level',
          'All advanced learning modules unlocked',
        ].map((f) => (
          <div key={f} className="flex items-center gap-3 text-sm text-on-surface-variant">
            <span className="text-primary">✓</span>
            {f}
          </div>
        ))}
      </div>
      <div>
        <button
          onClick={() => checkout()}
          disabled={isPending}
          className="btn-primary text-lg px-8 py-3"
        >
          {isPending ? 'Redirecting...' : 'Upgrade to Student Pro — $4.99/mo'}
        </button>
        <p className="text-on-surface-variant text-sm mt-2">Cancel anytime</p>
      </div>
    </div>
  );
}

function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your AI investing coach powered by Claude. I can help you understand your portfolio, explain investing concepts, and answer any questions you have. What would you like to learn today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: portfolioReview } = useQuery({
    queryKey: ['portfolio-review'],
    queryFn: () => apiClient.post('/ai/portfolio-review', {}) as Promise<{ data: { analysis: string } }>,
    enabled: false,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || isStreaming) return;
    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsStreaming(true);

    let assistantMsg = '';
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/backend/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(window as { __session?: { accessToken: string } }).__session?.accessToken ?? ''}`,
        },
        body: JSON.stringify({ message: userMessage, sessionId }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n').filter((l) => l.startsWith('data: '));
        for (const line of lines) {
          const data = JSON.parse(line.slice(6));
          if (data.chunk) {
            assistantMsg += data.chunk;
            setMessages((prev) => [
              ...prev.slice(0, -1),
              { role: 'assistant', content: assistantMsg },
            ]);
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'Sorry, I had trouble responding. Please try again.' },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }

  const QUICK_QUESTIONS = [
    'Review my portfolio',
    'What is diversification?',
    'Explain ETFs vs stocks',
    'How do I reduce risk?',
  ];

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-primary-container/20 rounded-full flex items-center justify-center">
          <Sparkles size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">AI Investing Coach</h1>
          <p className="text-xs text-on-surface-variant">Powered by Claude</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => { setInput(q); }}
            className="text-xs bg-surface-container-high text-on-surface-variant hover:text-white hover:bg-surface-bright px-3 py-1.5 rounded-full transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : '')}>
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
              msg.role === 'assistant' ? 'bg-primary-container/20' : 'bg-surface-bright',
            )}>
              {msg.role === 'assistant' ? <Bot size={16} className="text-primary" /> : <User size={16} className="text-on-surface-variant" />}
            </div>
            <div className={cn(
              'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
              msg.role === 'assistant'
                ? 'bg-surface-container-high text-on-surface rounded-tl-sm'
                : 'bg-primary-container text-white rounded-tr-sm',
            )}>
              {msg.content || (isStreaming && i === messages.length - 1 ? (
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-on-surface-variant rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-on-surface-variant rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-on-surface-variant rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              ) : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-3">
        <input
          className="input flex-1"
          placeholder="Ask me anything about investing..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          disabled={isStreaming}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isStreaming}
          className="btn-primary px-4"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
