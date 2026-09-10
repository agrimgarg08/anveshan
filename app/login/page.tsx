'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { authenticated, authReady, login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (authReady && authenticated) {
      router.replace('/console');
    }
  }, [authReady, authenticated, router]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);

    const success = login(username.trim(), password);
    if (success) {
      toast.success('Access granted. Redirecting to Console...');
      router.push('/console');
    } else {
      setAuthError('Invalid credentials. Please verify your username and password.');
      setIsSubmitting(false);
    }
  };

  if (!authReady || (authReady && authenticated)) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-transparent text-slate-500 dark:text-slate-400 transition-colors">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-[calc(100vh-5rem)] items-center justify-center overflow-hidden bg-transparent px-6 py-12 text-slate-900 dark:text-slate-100 font-sans transition-colors">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-8 sm:p-10 shadow-xl dark:shadow-2xl"
      >
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2 tracking-tight">
            Welcome Back
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Please log in to continue to the console
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-600"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-600"
              placeholder="Enter password"
            />
          </div>

          <AnimatePresence>
            {authError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-xs text-red-600 dark:text-red-300 flex items-start gap-2.5"
              >
                <AlertTriangle size={16} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-8 rounded-xl bg-cyan-600 dark:bg-cyan-500 hover:bg-cyan-500 dark:hover:bg-cyan-400 disabled:opacity-50 px-4 py-3.5 text-sm font-semibold text-white dark:text-slate-950 transition-all shadow-[0_0_20px_rgba(8,145,178,0.25)] dark:shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:-translate-y-0.5 flex items-center justify-center gap-2 focus:outline-none"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Access Console</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

      </motion.div>
    </main>
  );
}

