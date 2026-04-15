import React, { useEffect, useState } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { UserStats } from '../types';
import { Trophy, Medal, Star, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { translations } from '../lib/translations';

export default function Ranking() {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const user = auth.currentUser;

  useEffect(() => {
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

  const [rankings, setRankings] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUser = auth.currentUser;

  useEffect(() => {
    const q = query(
      collection(db, 'userStats'),
      orderBy('level', 'desc'),
      orderBy('xp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => doc.data() as UserStats);
      setRankings(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="mb-12 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-100 text-amber-600 shadow-xl shadow-amber-100/50"
        >
          <Trophy size={40} />
        </motion.div>
        <h2 className="mt-6 text-4xl font-black tracking-tight text-slate-900">{t.ranking}</h2>
        <p className="mt-2 text-slate-600">{t.rankingTagline}</p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="bg-slate-50 px-8 py-4 border-b border-slate-200">
          <div className="grid grid-cols-12 text-xs font-black uppercase tracking-widest text-slate-400">
            <div className="col-span-1">{t.rank}</div>
            <div className="col-span-5">{t.learner}</div>
            <div className="col-span-2 text-center">{t.level}</div>
            <div className="col-span-2 text-center">XP</div>
            <div className="col-span-2 text-right">{t.totalPts}</div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {rankings.map((stat, idx) => (
            <motion.div
              key={stat.uid}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`grid grid-cols-12 items-center px-8 py-6 transition-colors hover:bg-slate-50/50 ${
                idx < 3 ? 'bg-indigo-50/30' : ''
              }`}
            >
              <div className="col-span-1">
                {idx === 0 ? (
                  <Medal className="text-amber-500" size={24} />
                ) : idx === 1 ? (
                  <Medal className="text-slate-400" size={24} />
                ) : idx === 2 ? (
                  <Medal className="text-amber-700" size={24} />
                ) : (
                  <span className="text-lg font-black text-slate-300">#{idx + 1}</span>
                )}
              </div>
              
              <div className="col-span-5 flex items-center gap-3">
                {stat.photoURL ? (
                  <img 
                    src={stat.photoURL} 
                    alt={stat.displayName} 
                    className="h-10 w-10 rounded-xl object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-400">
                    <Star size={20} fill={idx < 3 ? "currentColor" : "none"} />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900 truncate max-w-[150px]">
                      {stat.displayName || `User ${stat.uid.slice(0, 6)}`}
                    </p>
                    {currentUser?.uid === stat.uid && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 uppercase">
                        {t.you}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{t.learner}</p>
                </div>
              </div>

              <div className="col-span-2 text-center">
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-600">
                  Lvl {stat.level || 1}
                </span>
              </div>

              <div className="col-span-2 text-center">
                <div className="flex flex-col items-center">
                  <span className="text-sm font-bold text-slate-700">{stat.xp || 0}</span>
                  <div className="h-1 w-16 rounded-full bg-slate-100 overflow-hidden mt-1">
                    <div 
                      className="h-full bg-indigo-500" 
                      style={{ width: `${((stat.xp || 0) / ((stat.level || 1) * 1000)) * 100}%` }} 
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-2 text-right">
                <div className="flex items-center justify-end gap-1 text-indigo-600">
                  <TrendingUp size={14} />
                  <span className="font-black">{stat.totalPoints.toLocaleString()}</span>
                </div>
              </div>
            </motion.div>
          ))}

          {rankings.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-slate-400 italic">{t.noRankings}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
