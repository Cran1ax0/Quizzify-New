import React from 'react';
import { auth, logout, signInWithGoogle, db } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { LogOut, User as UserIcon, BrainCircuit, History, PlusCircle, Gamepad2, Trophy, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { translations } from '../lib/translations';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserStats } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'create' | 'history' | 'playground' | 'ranking' | 'profile';
  setActiveTab: (tab: 'create' | 'history' | 'playground' | 'ranking' | 'profile') => void;
  disabled?: boolean;
}

export default function Layout({ children, activeTab, setActiveTab, disabled }: LayoutProps) {
  const [user] = useAuthState(auth);
  const [userStats, setUserStats] = React.useState<UserStats | null>(null);

  React.useEffect(() => {
    if (user) {
      const unsubscribe = onSnapshot(doc(db, 'userStats', user.uid), (snap) => {
        if (snap.exists()) {
          setUserStats(snap.data() as UserStats);
        }
      });
      return () => unsubscribe();
    }
  }, [user]);

  const t = translations[userStats?.settings?.interfaceLanguage || 'en'] || translations.en;

  const handleTabChange = (tab: 'create' | 'history' | 'playground' | 'ranking' | 'profile') => {
    if (disabled) return;
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] bg-uz-pattern font-sans text-slate-900 transition-colors">
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-xl bg-uz-blue/20 blur-lg" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-uz-blue to-uz-green text-white shadow-lg shadow-uz-blue/20">
                <BrainCircuit size={24} />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black font-serif tracking-tight text-slate-900">Quizzify<span className="text-uz-blue">.ai</span></h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-uz-green">Scan • Search • Study</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  onClick={() => handleTabChange('create')}
                  disabled={disabled}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    activeTab === 'create' ? 'bg-white text-uz-blue shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <PlusCircle size={16} />
                  {t.create}
                </button>
                <button
                  onClick={() => handleTabChange('history')}
                  disabled={disabled}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    activeTab === 'history' ? 'bg-white text-uz-blue shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <History size={16} />
                  {t.history}
                </button>
                <button
                  onClick={() => handleTabChange('playground')}
                  disabled={disabled}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    activeTab === 'playground' ? 'bg-white text-uz-blue shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Gamepad2 size={16} />
                  {t.playground}
                </button>
                <button
                  onClick={() => handleTabChange('ranking')}
                  disabled={disabled}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    activeTab === 'ranking' ? 'bg-white text-uz-blue shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Trophy size={16} />
                  {t.ranking}
                </button>
                <button
                  onClick={() => handleTabChange('profile')}
                  disabled={disabled}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    activeTab === 'profile' ? 'bg-white text-uz-blue shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <UserIcon size={16} />
                  {t.profile}
                </button>
              </nav>
              <div className="h-8 w-px bg-slate-200" />
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden text-right lg:block">
                    <p className="text-sm font-bold text-slate-900 leading-none">{user.displayName || 'User'}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{user.email || user.phoneNumber}</p>
                  </div>
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="h-9 w-9 rounded-full border-2 border-uz-gold shadow-sm" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-uz-blue text-white">
                      <UserIcon size={20} />
                    </div>
                  )}
                  <button
                    onClick={logout}
                    className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    title={t.signOut}
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="flex items-center gap-2 rounded-lg bg-uz-blue px-4 py-2 text-sm font-bold text-white shadow-md shadow-uz-blue/20 hover:bg-uz-blue/90 transition-all"
                >
                  {t.signIn}
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
      <nav className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white/90 p-2 shadow-2xl backdrop-blur-md md:hidden ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <button
          onClick={() => handleTabChange('create')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'create' ? 'bg-uz-blue text-white shadow-lg shadow-uz-blue/20' : 'text-slate-600'
          }`}
        >
          <PlusCircle size={18} />
        </button>
        <button
          onClick={() => handleTabChange('history')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'history' ? 'bg-uz-blue text-white shadow-lg shadow-uz-blue/20' : 'text-slate-600'
          }`}
        >
          <History size={18} />
        </button>
        <button
          onClick={() => handleTabChange('playground')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'playground' ? 'bg-uz-blue text-white shadow-lg shadow-uz-blue/20' : 'text-slate-600'
          }`}
        >
          <Gamepad2 size={18} />
        </button>
        <button
          onClick={() => handleTabChange('ranking')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'ranking' ? 'bg-uz-blue text-white shadow-lg shadow-uz-blue/20' : 'text-slate-600'
          }`}
        >
          <Trophy size={18} />
        </button>
        <button
          onClick={() => handleTabChange('profile')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'profile' ? 'bg-uz-blue text-white shadow-lg shadow-uz-blue/20' : 'text-slate-600'
          }`}
        >
          <UserIcon size={18} />
        </button>
      </nav>
    </div>
  );
}
