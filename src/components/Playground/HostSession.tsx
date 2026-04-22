import React, { useState } from 'react';
import { db, createSession, auth } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { Quiz, UserStats } from '../../types';
import { Play, Users, Loader2, GraduationCap, Search } from 'lucide-react';
import { translations } from '../../lib/translations';

interface HostSessionProps {
  onStarted: (sessionId: string) => void;
}

export default function HostSession({ onStarted }: HostSessionProps) {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [mode, setMode] = useState<'host-paced' | 'student-paced'>('student-paced');
  const [isTestMode, setIsTestMode] = useState(false);
  const [showAnswers, setShowAnswers] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [loading, setLoading] = useState(true);

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

  React.useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'quizzes'), where('userId', '==', auth.currentUser.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setQuizzes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [gameMode, setGameMode] = useState<'classic' | 'cryptohack'>('classic');
  const [duration, setDuration] = useState(8);

  const handleStart = async () => {
    if (!selectedQuiz || !auth.currentUser) return;
    setIsStarting(true);
    try {
      const sessionId = await createSession(auth.currentUser.uid, selectedQuiz.id, mode, isTestMode, showAnswers, gameMode, duration);
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
        <h2 className="text-3xl font-bold text-slate-900">{t.hostPlaygroundTitle}</h2>
        <p className="mt-2 text-slate-600">{t.hostPlaygroundTagline}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">{t.selectQuiz}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {quizzes.map(quiz => {
              const translatedLevel = t[`level${quiz.level.replace('-', '')}` as keyof typeof t] || quiz.level;
              return (
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
                      {translatedLevel}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {quiz.questions.length} {t.questionsCount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Game Mode</h3>
            <div className="grid grid-cols-2 gap-4">
              <div 
                onClick={() => setGameMode('classic')}
                className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                  gameMode === 'classic' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${gameMode === 'classic' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <Users size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Classic</p>
                    <p className="text-[10px] text-slate-500">Standard mode</p>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => setGameMode('cryptohack')}
                className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                  gameMode === 'cryptohack' ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${gameMode === 'cryptohack' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <Search size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">CryptoHack</p>
                    <p className="text-[10px] text-slate-500">Cyber hacking fun!</p>
                  </div>
                </div>
              </div>
            </div>

            {gameMode === 'cryptohack' && (
              <div className="rounded-xl border-2 border-slate-100 bg-slate-50/50 p-4">
                <p className="text-sm font-bold text-slate-900 mb-2">Duration: {duration} minutes</p>
                <input 
                  type="range" 
                  min="1" 
                  max="30" 
                  value={duration} 
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">{t.gameSettings}</h3>
            
            <div className="space-y-4">
              <div 
                onClick={() => setIsTestMode(!isTestMode)}
                className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                  isTestMode ? 'border-amber-500 bg-amber-50/50' : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${isTestMode ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <GraduationCap size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.examMode}</p>
                    <p className="text-xs text-slate-500">{t.testModeDesc}</p>
                  </div>
                </div>
              </div>

              {/* Show Answers Toggle */}
              <div 
                onClick={() => setShowAnswers(!showAnswers)}
                className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                  showAnswers ? 'border-uz-blue bg-uz-blue/5' : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${showAnswers ? 'bg-uz-blue text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <Play size={18} fill="currentColor" />
                    </div>
                    <p className="text-sm font-bold text-slate-900">{t.showAnswersToggle}</p>
                  </div>
                  <div className={`h-5 w-10 rounded-full bg-slate-200 p-1 transition-colors ${showAnswers ? 'bg-uz-blue' : ''}`}>
                    <div className={`h-3 w-3 rounded-full bg-white transition-transform ${showAnswers ? 'translate-x-5' : ''}`} />
                  </div>
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
                {t.launching}
              </>
            ) : (
              <>
                <Play size={20} fill="currentColor" />
                {t.launchPlayground}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
