'use client';

import { useEffect, useState } from 'react';
import { Settings, Users, Trash2, Plus, Calendar, Unlink, Shield, User } from 'lucide-react';
import { getInitials } from '@/lib/utils/initials';

interface User {
  id: string;
  name: string;
  color: string;
  role: string;
}

export default function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPin, setNewMemberPin] = useState('');
  const [googleConnected, setGoogleConnected] = useState(false);

  useEffect(() => {
    loadUsers();
    checkGoogleCalendar();
  }, []);

  async function loadUsers() {
    const res = await fetch('/api/users');
    setUsers(await res.json());
  }


  async function addMember() {
    if (!newMemberName.trim() || !newMemberPin.trim()) return;
    await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newMemberName.trim(), pin: newMemberPin.trim() }),
    });
    setNewMemberName('');
    setNewMemberPin('');
    loadUsers();
  }

  async function updateRole(id: string, role: string) {
    const res = await fetch('/api/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, role }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to update role');
    }
    loadUsers();
  }

  async function removeMember(id: string) {
    if (!confirm('Remove this team member?')) return;
    await fetch('/api/team', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    });
    loadUsers();
  }

  async function checkGoogleCalendar() {
    try {
      const res = await fetch('/api/calendar/google/status');
      const data = await res.json();
      setGoogleConnected(data.connected);
    } catch {
      setGoogleConnected(false);
    }
  }

  function connectGoogleCalendar() {
    window.location.href = '/api/auth/google?redirect=/settings';
  }

  async function disconnectGoogleCalendar() {
    if (!confirm('Disconnect Google Calendar?')) return;
    await fetch('/api/auth/google/disconnect', { method: 'DELETE' });
    setGoogleConnected(false);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-[var(--accent)]" />
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Settings</h1>
      </div>

      {/* Google Calendar */}
      <section className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-medium text-[var(--text-primary)]">Google Calendar</h2>
          <div className={`ml-auto flex items-center gap-1.5 text-xs ${googleConnected ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
            <div className={`h-2 w-2 rounded-full ${googleConnected ? 'bg-[var(--accent)]' : 'bg-[var(--text-tertiary)]'}`} />
            {googleConnected ? 'Connected' : 'Not connected'}
          </div>
        </div>

        <p className="text-sm text-[var(--text-tertiary)]">
          Connect your Google Calendar to see your events alongside your task board. Each team member connects their own Google account.
        </p>

        {googleConnected ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--accent)]">Your Google Calendar is synced</span>
            <button
              onClick={disconnectGoogleCalendar}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/30 rounded-md hover:bg-red-500/10 transition-colors"
            >
              <Unlink className="h-3.5 w-3.5" />
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connectGoogleCalendar}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-[var(--text-primary)] text-sm font-medium rounded-md transition-colors flex items-center gap-2"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Connect Google Calendar
          </button>
        )}
      </section>

      {/* Team Members */}
      <section className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-medium text-[var(--text-primary)]">Team Members</h2>
        </div>

        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="flex items-center gap-3 px-3 py-2.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-md">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium"
                style={{ backgroundColor: `${user.color}22`, color: user.color }}
              >
                {getInitials(user.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text-primary)] truncate">{user.name}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{user.role}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={user.role}
                    onChange={(e) => updateRole(user.id, e.target.value)}
                    className="appearance-none pl-7 pr-7 py-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-md text-xs text-[var(--text-primary)] focus-ring cursor-pointer"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    {user.role === 'admin' ? (
                      <Shield className="h-3.5 w-3.5 text-[var(--accent)]" />
                    ) : (
                      <User className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                    )}
                  </div>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="h-3 w-3 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <button
                  onClick={() => removeMember(user.id)}
                  className="p-1.5 text-[var(--text-tertiary)] hover:text-red-400 transition-colors rounded"
                  title="Remove member"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--border)] pt-4">
          <p className="text-sm text-[var(--text-tertiary)] mb-2">Add team member</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Name"
              className="flex-1 px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-md text-[var(--text-primary)] text-sm focus-ring"
            />
            <input
              type="password"
              value={newMemberPin}
              onChange={(e) => setNewMemberPin(e.target.value)}
              placeholder="PIN"
              className="w-full sm:w-24 px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-md text-[var(--text-primary)] text-sm focus-ring"
            />
            <button
              onClick={addMember}
              disabled={!newMemberName.trim() || !newMemberPin.trim()}
              className="px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] text-sm font-medium rounded-md transition-colors disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Data */}
      <section className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-4 sm:p-5 space-y-4">
        <h2 className="text-lg font-medium text-[var(--text-primary)]">Data</h2>
        <div className="flex gap-3">
          <a
            href="/api/boards"
            target="_blank"
            className="px-4 py-2 border border-[var(--border)] rounded-md text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            View API Data
          </a>
          <a
            href={typeof window !== 'undefined' ? window.location.origin : '/'}
            target="_blank"
            className="px-4 py-2 border border-[var(--border)] rounded-md text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Open in New Tab
          </a>
        </div>
      </section>
    </div>
  );
}