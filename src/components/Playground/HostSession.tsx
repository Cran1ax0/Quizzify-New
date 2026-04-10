import React, { useState } from 'react';
import { db, createSession, handleFirestoreError, OperationType, auth } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { Quiz, Session } from '../../types';
import { Play, Users, Settings, Loader2, AlertCircle, BookOpen, GraduationCap, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HostSessionProps {
  onStarted: (sessionId: string) => void;
}

export default function HostSession({ onStarted }: HostSessionProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [mode, setMode] = useState<'host-paced' | 'student-paced'>('student-paced');
  const [isStarting, setIsStarting] = useState(false);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'quizzes'), where('userId', '==', auth.currentUser.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setQuizzes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleStart = async () => {
    if (!selectedQuiz || !auth.currentUser) return;
    setIsStarting(true);
    try {
      const sessionId = await createSession(auth.currentUser.uid, selectedQuiz.id, mode);
      onStarted(sessionId);
    } catch (err) {
      console.error('Start error:', err);
      setIsStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-slate-900">Host a Playground Session</h2>
        <p className="mt-2 text-slate-600">Select a quiz and choose your game mode.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Select Quiz</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {quizzes.map(quiz => (
              <div
                key={quiz.id}
                onClick={() => setSelectedQuiz(quiz)}
                className={`cursor-pointer rounded-2xl border-2 p-4 transition-all ${
                  selectedQuiz?.id === quiz.id ? 'border-indigo-600 bg-indigo-50/50 shadow-md' : 'border-slate-100 bg-white hover:border-indigo-200'
                }`}
              >
                <h4 className="line-clamp-1 font-bold text-slate-900">{quiz.topic}</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    {quiz.level}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    {quiz.questions.length} Qs
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Game Settings</h3>
          
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-indigo-600 bg-indigo-50/50 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-600 p-2 text-white">
                  <Users size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Classic Mode</p>
                  <p className="text-xs text-slate-500">Intense sprint to finish.</p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!selectedQuiz || isStarting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:opacity-70"
          >
            {isStarting ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Launching...
              </>
            ) : (
              <>
                <Play size={20} fill="currentColor" />
                Launch Playground
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
