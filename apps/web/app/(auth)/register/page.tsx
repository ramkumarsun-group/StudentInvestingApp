'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

function getAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dobError, setDobError] = useState('');
  const [form, setForm] = useState({
    email: '', username: '', password: '',
    dateOfBirth: '',
    role: 'student' as 'student' | 'teacher',
  });

  function handleDobChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setForm({ ...form, dateOfBirth: value });
    if (value && getAge(value) < 13) {
      setDobError('You must be at least 13 years old to register.');
    } else {
      setDobError('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.dateOfBirth && getAge(form.dateOfBirth) < 13) {
      toast.error('You must be at least 13 years old to register.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/register', form);
      const result = await signIn('credentials', { email: form.email, password: form.password, redirect: false });
      if (!result?.ok) {
        toast.error('Account created but sign-in failed. Please log in manually.');
        router.push('/login');
        return;
      }
      router.push('/dashboard');
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string } | string };
      const msg = typeof apiErr?.error === 'object'
        ? apiErr.error?.message
        : apiErr?.error;
      toast.error(msg ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-on-surface">StudentInvest</h1>
          <p className="text-on-surface-variant mt-2">Create your free account</p>
        </div>
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">I am a</label>
              <div className="grid grid-cols-2 gap-2">
                {(['student', 'teacher'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({ ...form, role: r })}
                    className={`py-2 rounded-lg font-medium capitalize transition-colors ${
                      form.role === r
                        ? 'bg-primary-container text-white'
                        : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">Display Name / Username</label>
              <input
                type="text"
                className="input"
                placeholder="trader_pro"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">Date of Birth</label>
              <input
                type="date"
                className="input"
                value={form.dateOfBirth}
                onChange={handleDobChange}
                max={new Date().toLocaleDateString('en-CA')}
                autoComplete="bday"
                required
              />
              {dobError && (
                <p className="mt-1 text-sm text-red-400">{dobError}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">Password</label>
              <input
                type="password"
                className="input"
                placeholder="Min 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            <p className="text-xs text-on-surface-variant text-center">
              By registering, you agree to our{' '}
              <Link href="/legal/dpa" target="_blank" rel="noopener noreferrer" className="underline text-green-400">
                Data Processing Agreement
              </Link>
              .
            </p>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account — It\'s Free'}
            </button>
          </form>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-outline-variant" />
            </div>
            <div className="relative flex justify-center text-xs text-on-surface-variant">
              <span className="bg-surface-container px-2">or</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
          <p className="text-center text-on-surface-variant mt-4 text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:text-primary">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
