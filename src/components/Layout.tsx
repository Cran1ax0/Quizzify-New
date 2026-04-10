import React from 'react';
import { auth, logout, signInWithGoogle } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { LogOut, User as UserIcon, BrainCircuit, History, PlusCircle, Gamepad2, Trophy } from 'lucide-react';
import { motion } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'create' | 'history' | 'playground' | 'ranking';
  setActiveTab: (tab: 'create' | 'history' | 'playground' | 'ranking') => void;
  disabled?: boolean;
}

export default function Layout({ children, activeTab, setActiveTab, disabled }: LayoutProps) {
  const [user] = useAuthState(auth);

  const handleTabChange = (tab: 'create' | 'history' | 'playground' | 'ranking') => {
    if (disabled) return;
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-xl bg-indigo-400/20 blur-lg" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-lg shadow-indigo-200">
                <BrainCircuit size={24} />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900">Quizzify<span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">.ai</span></h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Scan. Search. Study.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  onClick={() => handleTabChange('create')}
                  disabled={disabled}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    activeTab === 'create' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <PlusCircle size={16} />
                  Create
                </button>
                <button
                  onClick={() => handleTabChange('history')}
                  disabled={disabled}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <History size={16} />
                  History
                </button>
                <button
                  onClick={() => handleTabChange('playground')}
                  disabled={disabled}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    activeTab === 'playground' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Gamepad2 size={16} />
                  Playground
                </button>
                <button
                  onClick={() => handleTabChange('ranking')}
                  disabled={disabled}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    activeTab === 'ranking' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Trophy size={16} />
                  Ranking
                </button>
              </nav>
              <div className="h-8 w-px bg-slate-200" />
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-medium text-slate-900">{user.displayName || 'User'}</p>
                    <p className="text-xs text-slate-500">{user.email || user.phoneNumber}</p>
                  </div>
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="h-9 w-9 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                      <UserIcon size={20} />
                    </div>
                  )}
                  <button
                    onClick={logout}
                    className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    title="Logout"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile Nav */}
      <nav className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white/90 p-2 shadow-xl backdrop-blur-md md:hidden ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <button
          onClick={() => handleTabChange('create')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'create' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-600'
          }`}
        >
          <PlusCircle size={18} />
        </button>
        <button
          onClick={() => handleTabChange('history')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-600'
          }`}
        >
          <History size={18} />
        </button>
        <button
          onClick={() => handleTabChange('playground')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'playground' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-600'
          }`}
        >
          <Gamepad2 size={18} />
        </button>
        <button
          onClick={() => handleTabChange('ranking')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'ranking' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-600'
          }`}
        >
          <Trophy size={18} />
        </button>
      </nav>
    </div>
  );
}
