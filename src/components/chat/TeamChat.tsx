'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, X, AtSign, Reply } from 'lucide-react';
import { useChatStore } from '@/features/chat/chatStore';
import { getInitials } from '@/lib/utils/initials';

interface UserOption {
  id: string;
  name: string;
  color: string;
}

interface TeamChatProps {
  boardId: string;
}

export default function TeamChat({ boardId }: TeamChatProps) {
  const { messages, isOpen, toggleOpen, fetchMessages, sendMessage, startPolling, stopPolling } = useChatStore();
  const [input, setInput] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [mentionIndex, setMentionIndex] = useState(-1);
  const [mentionFilter, setMentionFilter] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; text: string; userName: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/users', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setUsers(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchMessages(boardId);
    startPolling(boardId);
    return () => stopPolling();
  }, [boardId, fetchMessages, startPolling, stopPolling]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  const handleInputChange = (value: string) => {
    setInput(value);

    const cursorPos = value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setShowMentions(true);
      setMentionFilter(atMatch[1]);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
      setMentionFilter('');
      setMentionIndex(-1);
    }
  };

  const insertMention = (user: UserOption) => {
    const cursorPos = input.length;
    const textBeforeCursor = input.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      const before = input.slice(0, cursorPos - atMatch[0].length);
      const after = input.slice(cursorPos);
      setInput(`${before}@${user.name} ${after}`);
    }
    setShowMentions(false);
    setMentionFilter('');
    setMentionIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => Math.min(prev + 1, filteredUsers.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredUsers[mentionIndex] || filteredUsers[0]);
        return;
      }
      if (e.key === 'Escape') {
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    setShowMentions(false);
    const replyId = replyingTo?.id;
    setReplyingTo(null);
    await sendMessage(boardId, text, replyId);
  }, [input, boardId, sendMessage, replyingTo]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const highlightMentions = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} className="text-cyan-400 font-medium">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const handleReply = (msg: { id: string; text: string; user?: { name: string } | null }) => {
    setReplyingTo({ id: msg.id, text: msg.text, userName: msg.user?.name || 'Unknown' });
    inputRef.current?.focus();
  };

  const renderReplyReference = (replyTo?: { id: string; text: string; user: { id: string; name: string; color: string } | null } | null) => {
    if (!replyTo) return null;
    return (
      <div className="text-[11px] text-gray-500 mb-0.5 flex items-center gap-1 bg-[var(--bg-base)] rounded px-1.5 py-0.5">
        <Reply className="h-3 w-3 shrink-0" />
        <span className="text-cyan-400 font-medium">{replyTo.user?.name || 'Unknown'}</span>
        <span className="truncate">{replyTo.text.substring(0, 50)}{replyTo.text.length > 50 ? '…' : ''}</span>
      </div>
    );
  };

  if (!isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
          text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10
          border border-[var(--border)] hover:border-emerald-500/30 transition-colors"
        title="Team Chat"
      >
        <AtSign className="h-4 w-4" />
        <span className="hidden sm:inline">Chat</span>
      </button>
    );
  }

  return (
    <>
      {/* Mobile overlay */}
      <div className="sm:hidden fixed inset-0 z-40 flex flex-col">
        <div className="absolute inset-0 bg-black/60" onClick={toggleOpen} />
        <div className="relative flex flex-col h-full bg-[var(--bg-card)] border-l border-[var(--border)]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
            <div className="flex items-center gap-2">
              <AtSign className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-medium text-white">Team Chat</h3>
            </div>
            <button
              onClick={toggleOpen}
              className="p-1 rounded hover:bg-[var(--bg-base)] text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
            {messages.length === 0 && (
              <p className="text-sm text-gray-600 text-center py-8">No messages yet. Start the conversation!</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-2">
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
                  style={{
                    backgroundColor: msg.user ? `${msg.user.color}22` : '#6366f122',
                    color: msg.user?.color || '#6366f1',
                  }}
                >
                  {getInitials(msg.user?.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-gray-300">{msg.user?.name || 'Unknown'}</span>
                    <span className="text-[10px] text-gray-600">{formatTime(msg.createdAt)}</span>
                    <button
                      onClick={() => handleReply(msg)}
                      className="p-0.5 text-gray-600 hover:text-cyan-400 transition-colors"
                      title="Reply"
                    >
                      <Reply className="h-3 w-3" />
                    </button>
                  </div>
                  {renderReplyReference(msg.replyTo)}
                  <p className="text-sm text-gray-200 break-words mt-0.5">{highlightMentions(msg.text)}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="relative border-t border-[var(--border)] p-3 shrink-0">
            {replyingTo && (
              <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-[var(--bg-base)] rounded-lg text-xs">
                <Reply className="h-3 w-3 text-cyan-400 shrink-0" />
                <span className="text-cyan-400 font-medium">{replyingTo.userName}</span>
                <span className="text-gray-500 truncate flex-1">{replyingTo.text.substring(0, 60)}{replyingTo.text.length > 60 ? '…' : ''}</span>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-gray-500 hover:text-gray-300 shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {showMentions && filteredUsers.length > 0 && (
              <div className="absolute bottom-full left-3 right-3 mb-1 max-h-36 overflow-y-auto bg-[var(--bg-base)] border border-[var(--border)] rounded-lg shadow-xl z-10">
                {filteredUsers.slice(0, 6).map((user, i) => (
                  <button
                    key={user.id}
                    onClick={() => insertMention(user)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      i === mentionIndex ? 'bg-[var(--bg-card)] text-white' : 'text-gray-300 hover:bg-[var(--bg-card)]'
                    }`}
                  >
                    <div
                      className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold"
                      style={{ backgroundColor: `${user.color}22`, color: user.color }}
                    >
                      {getInitials(user.name)}
                    </div>
                    <span>{user.name}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type @ to mention someone..."
                className="flex-1 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus-ring"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-white rounded-lg transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop panel */}
      <div className="hidden sm:flex w-72 shrink-0 flex-col bg-[var(--bg-card)] border border-[var(--border)] rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <AtSign className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-medium text-white">Team Chat</h3>
          </div>
          <button
            onClick={toggleOpen}
            className="p-1 rounded hover:bg-[var(--bg-base)] text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
          {messages.length === 0 && (
            <p className="text-sm text-gray-600 text-center py-8">No messages yet. Start the conversation!</p>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="group flex gap-2">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
                style={{
                  backgroundColor: msg.user ? `${msg.user.color}22` : '#6366f122',
                  color: msg.user?.color || '#6366f1',
                }}
              >
                {getInitials(msg.user?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-gray-300">{msg.user?.name || 'Unknown'}</span>
                  <span className="text-[10px] text-gray-600">{formatTime(msg.createdAt)}</span>
                  <button
                    onClick={() => handleReply(msg)}
                    className="p-0.5 text-gray-600 hover:text-cyan-400 transition-colors"
                    title="Reply"
                  >
                    <Reply className="h-3 w-3" />
                  </button>
                </div>
                {renderReplyReference(msg.replyTo)}
                <p className="text-sm text-gray-200 break-words mt-0.5">{highlightMentions(msg.text)}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="relative border-t border-[var(--border)] p-3 shrink-0">
          {replyingTo && (
            <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-[var(--bg-base)] rounded-lg text-xs">
              <Reply className="h-3 w-3 text-cyan-400 shrink-0" />
              <span className="text-cyan-400 font-medium">{replyingTo.userName}</span>
              <span className="text-gray-500 truncate flex-1">{replyingTo.text.substring(0, 60)}{replyingTo.text.length > 60 ? '…' : ''}</span>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-gray-500 hover:text-gray-300 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {showMentions && filteredUsers.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 mb-1 max-h-36 overflow-y-auto bg-[var(--bg-base)] border border-[var(--border)] rounded-lg shadow-xl z-10">
              {filteredUsers.slice(0, 6).map((user, i) => (
                <button
                  key={user.id}
                  onClick={() => insertMention(user)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    i === mentionIndex ? 'bg-[var(--bg-card)] text-white' : 'text-gray-300 hover:bg-[var(--bg-card)]'
                  }`}
                >
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold"
                    style={{ backgroundColor: `${user.color}22`, color: user.color }}
                  >
                    {getInitials(user.name)}
                  </div>
                  <span>{user.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type @ to mention..."
              className="flex-1 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus-ring"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-white rounded-lg transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}