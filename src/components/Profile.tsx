import React, { useState, useEffect } from 'react';
import { auth, db, updateUserSettings } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserStats, UserSettings } from '../types';
import { Globe, Moon, Sun, ShieldCheck, LogOut, Settings, Bell, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { translations } from '../lib/translations';

interface ProfileProps {
  onLogout: () => void;
}

export default function Profile({ onLogout }: ProfileProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'userStats', user.uid), (snap) => {
      if (snap.exists()) {
        setStats(snap.data() as UserStats);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const settings = stats?.settings || { interfaceLanguage: 'en', examModeEnabled: false };
  const t = translations[settings.interfaceLanguage] || translations.en;

  const handleLanguageChange = async (lang: UserSettings['interfaceLanguage']) => {
    if (!user) return;
    await updateUserSettings(user.uid, { interfaceLanguage: lang });
  };

  const handleExamModeToggle = async () => {
    if (!user) return;
    await updateUserSettings(user.uid, { examModeEnabled: !settings.examModeEnabled });
  };

  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="mb-12 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="relative">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ''} className="h-24 w-24 rounded-3xl object-cover shadow-xl" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-indigo-100 text-indigo-600 shadow-xl">
                <Settings size={40} />
              </div>
            )}
            <div className="absolute -bottom-2 -right-2 rounded-full bg-emerald-500 p-2 text-white shadow-lg">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900">{user?.displayName || t.learner}</h2>
            <p className="text-slate-500">{user?.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-600">{t.level} {stats?.level || 1}</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-600">{stats?.totalPoints.toLocaleString()} {t.points}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-red-600 shadow-sm transition-all hover:bg-red-50"
        >
          <LogOut size={18} />
          {t.signOut}
        </button>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Appearance & Language */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900">
              <Globe className="text-indigo-600" size={20} />
              {t.languageRegion}
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'en', label: 'English' },
                { id: 'uz', label: "O'zbek" },
                { id: 'ru', label: 'Русский' }
              ].map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => handleLanguageChange(lang.id as any)}
                  className={`rounded-xl border-2 py-3 text-sm font-bold transition-all ${
                    settings.interfaceLanguage === lang.id
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                      : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Specialized Modes */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <ShieldCheck className="text-indigo-600" size={20} />
                {t.examMode}
              </h3>
              <button
                onClick={handleExamModeToggle}
                className={`relative h-6 w-12 rounded-full transition-colors ${settings.examModeEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${settings.examModeEnabled ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              {t.examModeDesc}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { icon: HelpCircle, label: t.helpCenter },
          { icon: Settings, label: t.account },
          { icon: Bell, label: t.notifications },
          { icon: ShieldCheck, label: t.privacy }
        ].map((link, idx) => (
          <button key={idx} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-md">
            <link.icon className="text-slate-400" size={24} />
            <span className="text-xs font-bold text-slate-600">{link.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
