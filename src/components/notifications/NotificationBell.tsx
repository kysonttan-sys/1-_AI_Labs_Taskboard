'use client';

import React, { useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  UserPlus,
  MessageSquare,
  ArrowRightLeft,
  AlertCircle,
  Clock,
  Volume2,
  VolumeX,
  CheckCheck,
  X,
} from 'lucide-react';
import { useNotificationStore } from '@/features/notifications/notificationStore';
import { useRouter } from 'next/navigation';

function getNotificationIcon(type: string) {
  switch (type) {
    case 'card_assigned':
      return <UserPlus className="h-4 w-4 text-blue-400" />;
    case 'comment_added':
      return <MessageSquare className="h-4 w-4 text-emerald-400" />;
    case 'chat_mentioned':
      return <MessageSquare className="h-4 w-4 text-cyan-400" />;
    case 'card_moved':
      return <ArrowRightLeft className="h-4 w-4 text-purple-400" />;
    case 'card_status_changed':
      return <ArrowRightLeft className="h-4 w-4 text-amber-400" />;
    case 'card_priority_changed':
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    case 'due_date_approaching':
      return <Clock className="h-4 w-4 text-yellow-400" />;
    case 'due_date_overdue':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Bell className="h-4 w-4 text-gray-400" />;
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isDropdownOpen,
    browserPermissionGranted,
    soundEnabled,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    toggleDropdown,
    setDropdownOpen,
    requestBrowserPermission,
    toggleSound,
    startPolling,
    stopPolling,
    browserNotificationSupported,
  } = useNotificationStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isDropdownOpen, setDropdownOpen]);

  function handleNotificationClick(n: typeof notifications[0]) {
    if (!n.read) markAsRead(n.id);
    if (n.boardId) {
      router.push(`/board/${n.boardId}`);
    }
    setDropdownOpen(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="relative p-2 rounded-md hover:bg-[var(--bg-card)] text-gray-500 hover:text-gray-300 transition-colors"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 max-h-[80vh] bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setDropdownOpen(false)}
                className="p-1 rounded hover:bg-[var(--bg-base)] text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-600">
                <Bell className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`group flex items-start gap-3 px-4 py-3 border-b border-[var(--border)] last:border-0 cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors ${
                    !n.read ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  <div className="shrink-0 mt-0.5">{getNotificationIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${!n.read ? 'font-semibold text-white' : 'text-gray-300'}`}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="shrink-0 h-2 w-2 rounded-full bg-emerald-400" />
                      )}
                    </div>
                    {n.body && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {n.triggerUser && (
                        <span className="text-[10px] text-gray-600">
                          by {n.triggerUser.name}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-600">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                    className="shrink-0 p-1 rounded hover:bg-[var(--bg-base)] text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Dismiss"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border)] shrink-0">
            <button
              onClick={toggleSound}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {soundEnabled ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
              Sound {soundEnabled ? 'on' : 'off'}
            </button>
            {!browserPermissionGranted && browserNotificationSupported && (
              <button
                onClick={requestBrowserPermission}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Enable browser alerts
              </button>
            )}
            {!browserNotificationSupported && (
              <span className="text-[10px] text-gray-600">Alerts need HTTPS</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}