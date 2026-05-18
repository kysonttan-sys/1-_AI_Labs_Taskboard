'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/authStore';
import { UserPlus, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { checkSession } = useAuthStore();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
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

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), pin }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Registration failed. The name may already be taken.');
        setIsSubmitting(false);
        return;
      }

      // Registration auto-logs in (session cookie is set)
      const data = await res.json();
      useAuthStore.setState({
        user: { id: data.id, name: data.name, role: data.role },
        isAuthenticated: true,
      });
      router.replace('/board');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/15 flex items-center justify-center mb-4">
            <UserPlus className="h-6 w-6 text-emerald-500" />
          </div>
          <h1 className="text-xl font-semibold text-white">Create your account</h1>
          <p className="text-sm text-gray-500 mt-1">Join your team on TaskBoard</p>
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
              <label htmlFor="name" className="text-xs font-medium text-gray-400">
                Your Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                autoFocus
                className="w-full px-3 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)]
                  rounded-md text-white placeholder:text-gray-600 focus-ring"
              />
            </div>

            {/* PIN field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pin" className="text-xs font-medium text-gray-400">
                PIN
              </label>
              <div className="relative">
                <input
                  id="pin"
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Choose a PIN (4+ digits)"
                  maxLength={6}
                  className="w-full px-3 py-2 pr-10 text-sm bg-[var(--bg-base)] border border-[var(--border)]
                    rounded-md text-white placeholder:text-gray-600 focus-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm PIN field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPin" className="text-xs font-medium text-gray-400">
                Confirm PIN
              </label>
              <input
                id="confirmPin"
                type={showPin ? 'text' : 'password'}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Re-enter your PIN"
                maxLength={6}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-base)] border border-[var(--border)]
                  rounded-md text-white placeholder:text-gray-600 focus-ring"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50
                text-sm font-medium text-white transition-colors disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Login link */}
        <p className="text-center text-xs text-gray-600 mt-4">
          Already have an account?{' '}
          <a href="/login" className="text-emerald-500 hover:text-emerald-400 transition-colors">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}