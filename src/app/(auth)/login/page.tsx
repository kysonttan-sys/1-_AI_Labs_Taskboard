'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/authStore';
import { LayoutDashboard, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, checkSession } = useAuthStore();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    checkSession().then(() => {
      if (useAuthStore.getState().isAuthenticated) {
        router.replace('/board');
      }
    });
  }, [checkSession, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim() || !pin.trim()) {
      setError('Please enter your name and PIN.');
      return;
    }

    setIsSubmitting(true);
    const success = await login(name.trim(), pin.trim());
    setIsSubmitting(false);

    if (success) {
      router.replace('/board');
    } else {
      setError('Invalid name or PIN. Please try again.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-[var(--accent-muted)] flex items-center justify-center mb-4">
            <LayoutDashboard className="h-6 w-6 text-[var(--accent)]" />
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Taskboard</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="card-base p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Error message */}
            {error && (
              <div className="px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Name field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-xs font-medium text-[var(--text-secondary)]">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                autoFocus
                className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)]
                  rounded-md text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-ring"
              />
            </div>

            {/* PIN field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pin" className="text-xs font-medium text-[var(--text-secondary)]">
                PIN
              </label>
              <div className="relative">
                <input
                  id="pin"
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter your PIN"
                  maxLength={6}
                  className="w-full px-3 py-2 pr-10 text-sm bg-[var(--bg-surface)] border border-[var(--border)]
                    rounded-md text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50
                text-sm font-medium text-[var(--text-primary)] transition-colors disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Register link */}
        <p className="text-center text-xs text-[var(--text-tertiary)] mt-4">
          First time?{' '}
          <a href="/register" className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
            Create an account
          </a>
        </p>
      </div>
    </div>
  );
}