'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Send, Sparkles, AlertCircle } from 'lucide-react';
import { useAiStore } from '@/features/ai/aiStore';
import { useBoardStore } from '@/features/board/boardStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function AIChatSidebar() {
  const {
    isOpen,
    isStreaming,
    messages,
    error,
    ollamaConnected,
    aiDisabled,
    toggleOpen,
    sendMessage,
    clearMessages,
    checkConnection,
  } = useAiStore();

  const { activeBoardId } = useBoardStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isStreaming) return;
    setInput('');
    await sendMessage(content, activeBoardId ?? '');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    { label: 'Summarize board', message: 'Summarize the current board and its progress' },
    { label: "What's overdue?", message: 'What tasks are overdue on this board?' },
    { label: 'Suggest priorities', message: 'Suggest priority changes for my tasks' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-full sm:w-[380px] bg-[var(--bg-elevated)] border-l border-[var(--border)] z-50 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--accent)]" />
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">AI Assistant</h2>
          <div
            className={`h-2 w-2 rounded-full ${aiDisabled ? 'bg-[var(--text-tertiary)]' : ollamaConnected ? 'bg-[var(--accent)]' : 'bg-red-500'}`}
            title={aiDisabled ? 'AI not available' : ollamaConnected ? 'Ollama connected' : 'Ollama disconnected'}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearMessages}
            className="px-2 py-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Clear
          </button>
          <button
            onClick={toggleOpen}
            className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {aiDisabled && (
          <div className="flex items-start gap-2 p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg">
            <AlertCircle className="h-4 w-4 text-[var(--text-tertiary)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--text-tertiary)]">AI features are not available in this deployment.</p>
          </div>
        )}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <Sparkles className="h-8 w-8 text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-tertiary)]">Ask me anything about your tasks</p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    setInput(action.message);
                  }}
                  className="px-3 py-1.5 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-[var(--accent)] text-[var(--text-primary)]'
                  : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)]'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-invert prose-sm max-w-none [&_code]:text-[var(--accent)] [&_a]:text-[var(--accent)]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" />
                <div className="h-2 w-2 rounded-full bg-[var(--text-tertiary)] animate-bounce [animation-delay:150ms]" />
                <div className="h-2 w-2 rounded-full bg-[var(--text-tertiary)] animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/20">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[var(--border)]">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={aiDisabled ? 'AI features are not available' : ollamaConnected ? 'Ask about your tasks...' : 'Ollama is not connected'}
            disabled={isStreaming || !ollamaConnected || aiDisabled}
            rows={1}
            className="flex-1 resize-none rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim() || !ollamaConnected || aiDisabled}
            className="p-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:hover:bg-[var(--accent)] text-[var(--text-primary)] transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {!ollamaConnected && (
          <p className="text-[10px] text-red-400 mt-1">Connect Ollama to enable AI features</p>
        )}
      </div>
    </div>
  );
}