import React, { useState } from 'react';
import { db, joinSession, auth } from '../../lib/firebase';
import { collection, query, where, getDocs, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { Hash, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { translations } from '../../lib/translations';
import { UserStats } from '../../types';

interface JoinSessionProps {
  onJoined: (sessionId: string, participantId: string) => void;
}

export default function JoinSession({ onJoined }: JoinSessionProps) {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [step, setStep] = useState<'pin' | 'nickname'>('pin');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);

  const user = auth.currentUser;

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

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6) {
      setError(t.pinError);
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const q = query(collection(db, 'sessions'), where('pin', '==', pin));
      const snap = await getDocs(q);
      const activeSession = snap.docs.find(doc => doc.data().status !== 'finished');

      if (!activeSession) {
        setError(t.sessionNotFound);
        setIsJoining(false);
        return;
      }

      const sid = activeSession.id;
      const sessionData = activeSession.data();
      
      const quizDoc = await getDoc(doc(db, 'quizzes', sessionData.quizId));
      const qCount = quizDoc.exists() ? (quizDoc.data().questions?.length || 0) : 0;
      
      setSessionId(sid);
      setQuestionCount(qCount);
      setStep('nickname');
    } catch (err) {
      console.error('PIN verify error:', err);
      setError(t.failedVerifyPin);
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError(t.enterNicknameError);
      return;
    }
    if (!sessionId) return;

    setIsJoining(true);
    setError(null);

    try {
      const participantId = await joinSession(sessionId, nickname, auth.currentUser?.uid, questionCount);
      onJoined(sessionId, participantId);
    } catch (err) {
      console.error('Join error:', err);
      setError(t.failedJoinSession);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-slate-900">{t.joinPlayground}</h2>
        <p className="mt-2 text-slate-600">
          {step === 'pin' ? t.enterPinDesc : t.chooseNicknameDesc}
        </p>
      </div>

      <form onSubmit={step === 'pin' ? handleVerifyPin : handleJoin} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-600 border border-red-100">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {step === 'pin' ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Hash size={16} className="text-indigo-600" />
              {t.gamePin}
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <User size={16} className="text-indigo-600" />
              {t.nickname}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder={t.yourName}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isJoining}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:opacity-70"
        >
          {isJoining ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              {step === 'pin' ? t.verifying : t.joining}
            </>
          ) : (
            <>
              {step === 'pin' ? t.verifyPin : t.joinSessionBtn}
              <ArrowRight size={20} />
            </>
          )}
        </button>
        
        {step === 'nickname' && (
          <button
            type="button"
            onClick={() => setStep('pin')}
            className="w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            {t.changePin}
          </button>
        )}
      </form>
    </div>
  );
}
