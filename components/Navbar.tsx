'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { LogIn, LogOut, Settings, Sun, Moon, Check, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { authenticated, authReady, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Mounted state for next-themes
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setShowLogoutConfirm(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleHomeClick = (e: React.MouseEvent) => {
    if (pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
    setIsDropdownOpen(false);
    setShowLogoutConfirm(false);
    toast.success('Successfully logged out');
  };

  return (
    <nav className="sticky top-0 left-0 right-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand */}
          <div className="flex items-center gap-8">
            <Link href="/" onClick={handleHomeClick} className="flex items-center group">
              <span className="font-yatra text-3xl tracking-wide text-slate-800 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 group-hover:drop-shadow-[0_0_10px_rgba(8,145,178,0.3)] dark:group-hover:drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-all duration-300">
                अन्वेषण
              </span>
            </Link>

            {/* Navigation links */}
            <div className="flex items-center gap-6 text-sm font-medium">
              <Link
                href="/"
                onClick={handleHomeClick}
                className={`transition-all duration-200 py-1 ${
                  pathname === '/'
                    ? 'text-cyan-600 dark:text-cyan-400 font-semibold drop-shadow-[0_0_8px_rgba(8,145,178,0.4)] dark:drop-shadow-[0_0_10px_rgba(34,211,238,0.65)]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:drop-shadow-[0_0_6px_rgba(0,0,0,0.1)] dark:hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.2)]'
                }`}
              >
                Home
              </Link>
              <Link
                href="/dashboard"
                className={`transition-all duration-200 py-1 ${
                  pathname === '/dashboard'
                    ? 'text-cyan-600 dark:text-cyan-400 font-semibold drop-shadow-[0_0_8px_rgba(8,145,178,0.4)] dark:drop-shadow-[0_0_10px_rgba(34,211,238,0.65)]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:drop-shadow-[0_0_6px_rgba(0,0,0,0.1)] dark:hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.2)]'
                }`}
              >
                Console
              </Link>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4">
            {authReady && (
              <>
                {authenticated ? (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(!isDropdownOpen);
                        setShowLogoutConfirm(false);
                      }}
                      className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      aria-label="Settings"
                    >
                      <Settings size={20} />
                    </button>

                    <AnimatePresence>
                      {isDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col z-50 origin-top-right"
                        >
                          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              Appearance
                            </span>
                            {mounted && (
                              <button
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                className="relative flex items-center w-14 h-7 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors focus:outline-none"
                                aria-label="Toggle Dark Mode"
                              >
                                <div
                                  className={`absolute left-1 flex items-center justify-center w-5 h-5 rounded-full bg-white dark:bg-slate-900 shadow-sm transition-transform duration-300 ${
                                    theme === 'dark' ? 'translate-x-7' : 'translate-x-0'
                                  }`}
                                >
                                  <div className="relative flex items-center justify-center w-full h-full">
                                    <Moon 
                                      size={12} 
                                      className={`absolute text-cyan-400 transition-all duration-300 ${
                                        theme === 'dark' ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'
                                      }`} 
                                    />
                                    <Sun 
                                      size={12} 
                                      className={`absolute text-amber-500 transition-all duration-300 ${
                                        theme === 'dark' ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'
                                      }`} 
                                    />
                                  </div>
                                </div>
                              </button>
                            )}
                          </div>

                          <div className="p-2 min-h-[50px] flex items-center justify-center relative overflow-hidden">
                            <AnimatePresence mode="wait">
                              {!showLogoutConfirm ? (
                                <motion.button
                                  key="signout-btn"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 10 }}
                                  transition={{ duration: 0.2 }}
                                  onClick={() => setShowLogoutConfirm(true)}
                                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                >
                                  <LogOut size={16} />
                                  Sign Out
                                </motion.button>
                              ) : (
                                <motion.div
                                  key="confirm-box"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 10 }}
                                  transition={{ duration: 0.2 }}
                                  className="flex flex-col gap-2 p-1 w-full"
                                >
                                  <span className="text-xs text-center text-slate-500 dark:text-slate-400 mb-1">
                                    Are you sure?
                                  </span>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={handleLogout}
                                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
                                    >
                                      <Check size={14} /> Yes
                                    </button>
                                    <button
                                      onClick={() => setShowLogoutConfirm(false)}
                                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-medium transition-colors"
                                    >
                                      <X size={14} /> No
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all ${
                      pathname === '/login'
                        ? 'bg-cyan-500 text-white dark:text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                        : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 shadow-md dark:shadow-[0_0_20px_rgba(255,255,255,0.1)] dark:hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]'
                    }`}
                  >
                    <LogIn size={16} />
                    <span>Log In</span>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
