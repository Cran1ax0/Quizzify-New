import React, { useState } from 'react';
import { db, joinSession, handleFirestoreError, OperationType, auth } from '../../lib/firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { Hash, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface JoinSessionProps {
  onJoined: (sessionId: string, participantId: string) => void;
}

export default function JoinSession({ onJoined }: JoinSessionProps) {
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [step, setStep] = useState<'pin' | 'nickname'>('pin');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6) {
      setError('PIN must be 6 digits');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const q = query(collection(db, 'sessions'), where('pin', '==', pin));
      const snap = await getDocs(q);
      const activeSession = snap.docs.find(doc => doc.data().status !== 'finished');

      if (!activeSession) {
        setError('Session not found or already finished');
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
      setError('Failed to verify PIN. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }
    if (!sessionId) return;

    setIsJoining(true);
    setError(null);

    try {
      const participantId = await joinSession(sessionId, nickname, auth.currentUser?.uid, questionCount);
      
      // If logged in, sync their global stats display name to the nickname they just entered
      if (auth.currentUser) {
        const { getOrCreateUserStats } = await import('../../lib/firebase');
        await getOrCreateUserStats(auth.currentUser.uid, nickname, auth.currentUser.photoURL);
      }

      onJoined(sessionId, participantId);
    } catch (err) {
      console.error('Join error:', err);
      setError('Failed to join session. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-slate-900">Join Playground</h2>
        <p className="mt-2 text-slate-600">
          {step === 'pin' ? 'Enter the Game PIN to start playing.' : 'Choose your nickname to enter the game.'}
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
              Game PIN
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
              Nickname
            </label>
            <input
              type="text"
              required
              autoFocus
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="Your name"
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
              {step === 'pin' ? 'Verifying...' : 'Joining...'}
            </>
          ) : (
            <>
              {step === 'pin' ? 'Verify PIN' : 'Join Session'}
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
            Change PIN
          </button>
        )}
      </form>
    </div>
  );
}
