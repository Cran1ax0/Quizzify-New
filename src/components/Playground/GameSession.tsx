import React, { useEffect, useState } from 'react';
import { db, auth, handleFirestoreError, OperationType, updateUserStats, awardSessionXp } from '../../lib/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, updateDoc, getDoc, getDocs, setDoc, increment, arrayUnion } from 'firebase/firestore';
import { Session, Participant, Quiz, Question, CheatingAlert, UserStats } from '../../types';
import { Users, Play, Trophy, ChevronRight, Loader2, Clock, CheckCircle2, XCircle, Info, LogOut, Shield, Timer, Search, Monitor, Star, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface GameSessionProps {
  sessionId: string;
  participantId?: string; // If student
  isHost: boolean;
  onExit: () => void;
}

export default function GameSession({ sessionId, participantId, isHost, onExit }: GameSessionProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [writingAnswer, setWritingAnswer] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState(25);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [isGracePeriod, setIsGracePeriod] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const requestFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  useEffect(() => {
    const sessionDoc = doc(db, 'sessions', sessionId);
    const unsubscribeSession = onSnapshot(sessionDoc, async (snap) => {
      if (!snap.exists()) return;
      const sessionData = { id: snap.id, ...snap.data() } as Session;
      setSession(sessionData);

      if (!quiz || quiz.id !== sessionData.quizId) {
        const quizDoc = doc(db, 'quizzes', sessionData.quizId);
        const quizSnap = await getDoc(quizDoc);
        if (quizSnap.exists()) {
          setQuiz({ id: quizSnap.id, ...quizSnap.data() } as Quiz);
        }
      }
      setLoading(false);
    });

    const participantsQuery = query(collection(db, 'sessions', sessionId, 'participants'), orderBy('score', 'desc'));
    const unsubscribeParticipants = onSnapshot(participantsQuery, (snap) => {
      const allParticipants = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Participant));
      setParticipants(allParticipants);
      
      if (participantId) {
        const p = allParticipants.find(x => x.id === participantId);
        if (p) setParticipant(p);
      }
    });

    return () => {
      unsubscribeSession();
      unsubscribeParticipants();
    };
  }, [sessionId, participantId]);

  // Timer logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (session?.status === 'playing' && !isHost && !selectedOption && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && !selectedOption && !isHost) {
      handleAnswer(''); // Auto-submit as wrong if time runs out
    }
    return () => clearInterval(timer);
  }, [session?.status, timeLeft, selectedOption, isHost]);

  // Fullscreen check
  const shouldEnforceFullscreen = !isHost && session?.status === 'playing';

  useEffect(() => {
    if (session?.status === 'playing') {
      setIsFullscreen(!!document.fullscreenElement);
      // Add a 3-second grace period when the game starts to allow for fullscreen transitions
      setIsGracePeriod(true);
      const timer = setTimeout(() => setIsGracePeriod(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [session?.status]);

  useEffect(() => {
    if (session?.status === 'playing' && !isFullscreen) {
      const interval = setInterval(() => {
        const currentFs = !!document.fullscreenElement;
        if (currentFs !== isFullscreen) {
          setIsFullscreen(currentFs);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [session?.status, isFullscreen]);

  // Reset state when question changes
  useEffect(() => {
    if (session?.status === 'playing' && participant) {
      setStartTime(Date.now());
      setSelectedOption(null);
      setWritingAnswer('');
      setShowExplanation(false);
      setTimeLeft(25);
    }
  }, [participant?.currentQuestionIndex, session?.status]);

  // Fetch user stats for finished screen
  useEffect(() => {
    if ((session?.status === 'finished' || participant?.isFinished) && auth.currentUser) {
      const statsDoc = doc(db, 'userStats', auth.currentUser.uid);
      getDoc(statsDoc).then(snap => {
        if (snap.exists()) {
          setUserStats(snap.data() as UserStats);
        }
      });
    }
  }, [session?.status, participant?.isFinished]);

  const handleStartGame = async () => {
    if (!isHost) return;
    await updateDoc(doc(db, 'sessions', sessionId), { status: 'playing' });
  };

  const handleNextQuestion = async () => {
    if (isHost || !session || !quiz || !participantId || !participant) return;
    
    const nextIndex = participant.currentQuestionIndex + 1;
    if (nextIndex < quiz.questions.length) {
      await updateDoc(doc(db, 'sessions', sessionId, 'participants', participantId), {
        currentQuestionIndex: nextIndex
      });
    } else {
      // Participant finished
      await updateDoc(doc(db, 'sessions', sessionId, 'participants', participantId), {
        isFinished: true
      });
    }
  };

  useEffect(() => {
    if (isHost || !participantId || !participant) return;

    const lastReported: Record<string, number> = {};
    const reportCheating = async (type: CheatingAlert['type']) => {
      // Only report cheating if the game is actually playing and we are not in the grace period
      if (session?.status !== 'playing' || isGracePeriod) return;
      
      const now = Date.now();
      if (lastReported[type] && now - lastReported[type] < 3000) return;
      lastReported[type] = now;

      const participantDoc = doc(db, 'sessions', sessionId, 'participants', participantId);
      const alert: CheatingAlert = { type, timestamp: new Date().toISOString() };
      await updateDoc(participantDoc, {
        cheatingAlerts: arrayUnion(alert)
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        reportCheating('tab_switch');
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        reportCheating('fullscreen_exit');
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportCheating('right_click');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [sessionId, participantId, isHost, participant, session?.status]);

  const handleAnswer = async (option: string) => {
    if (isHost || !session || !quiz || !participantId || !participant || selectedOption) return;
    
    // Prevent answering if screen is frozen (Lavalanche/Freeze)

    // Prevent double-answering the same question (Anti-glitch)
    if (participant.lastAnsweredIndex === participant.currentQuestionIndex) return;

    const qIndex = participant.shuffledQuestionIndices ? participant.shuffledQuestionIndices[participant.currentQuestionIndex] : participant.currentQuestionIndex;
    const currentQuestion = quiz.questions[qIndex];
    
    const isCorrect = currentQuestion.type === 'writing'
      ? option.trim().toLowerCase() === currentQuestion.correctAnswer.toLowerCase()
      : option === currentQuestion.correctAnswer;

    setSelectedOption(option);
    setShowExplanation(true);

    let points = 0;
    if (isCorrect) {
      const timeTaken = (Date.now() - startTime) / 1000;
      points = Math.max(500, 1000 - Math.floor(timeTaken * 20)); // Adjusted speed bonus for 25s
    }

    const participantDoc = doc(db, 'sessions', sessionId, 'participants', participantId);
    
    // Fire and forget updates to keep UI snappy
    updateDoc(participantDoc, {
      score: increment(points),
      lastAnsweredIndex: participant.currentQuestionIndex,
      correctAnswersCount: increment(isCorrect ? 1 : 0)
    }).catch(err => handleFirestoreError(err, OperationType.UPDATE, 'participants'));

    if (auth.currentUser) {
      updateUserStats(auth.currentUser.uid, points, isCorrect ? undefined : {
        question: currentQuestion.question,
        correctAnswer: currentQuestion.correctAnswer,
        userAnswer: option,
        topic: quiz.topic
      }).catch(err => console.error('Stats update failed:', err));
    }
  };

  if (loading || !session || !quiz) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Connecting to Playground...</p>
        </div>
      </div>
    );
  }

  // Host Screen: Leaderboard Only
  if (isHost && session.status === 'playing') {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-12 text-center">
          <h2 className="text-5xl font-black text-slate-900">Leaderboard</h2>
          <p className="mt-2 text-xl text-slate-600">PIN: {session.pin} • {quiz.topic}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {participants.map((p, idx) => (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center justify-between rounded-3xl border-2 p-6 transition-all ${
                idx === 0 ? 'border-indigo-600 bg-indigo-50/50 shadow-xl' : 'border-slate-100 bg-white'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-black ${
                  idx === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {idx + 1}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-black text-slate-900">{p.nickname}</p>
                    {p.cheatingAlerts && p.cheatingAlerts.length > 0 && (
                      <div className="group relative">
                        <XCircle className="text-red-500" size={18} />
                        <div className="absolute left-1/2 bottom-full mb-2 hidden w-48 -translate-x-1/2 rounded-lg bg-red-600 p-2 text-xs text-white shadow-xl group-hover:block">
                          <p className="font-bold">Cheating Alerts ({p.cheatingAlerts.length})</p>
                          <ul className="mt-1 list-disc pl-3">
                            {p.cheatingAlerts.slice(-3).map((a, i) => (
                              <li key={i}>{a.type.replace('_', ' ')}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">Question {p.currentQuestionIndex + 1}/{quiz.questions.length}</p>
                </div>
              </div>
              <span className="text-2xl font-black text-indigo-600">{p.score}</span>
            </motion.div>
          ))}
        </div>
        <div className="mt-12 flex justify-center">
          <button
            onClick={async () => {
              await awardSessionXp(sessionId);
              await updateDoc(doc(db, 'sessions', sessionId), { status: 'finished' });
            }}
            className="rounded-2xl bg-red-600 px-10 py-4 text-lg font-black text-white shadow-xl transition-all hover:bg-red-700"
          >
            End Session
          </button>
        </div>
      </div>
    );
  }

  if (session.status === 'lobby') {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-bold text-indigo-600">
            <Users size={16} />
            Lobby
          </div>
          <h2 className="mt-4 text-5xl font-black tracking-tight text-slate-900">PIN: {session.pin}</h2>
          <p className="mt-2 text-slate-600">Waiting for participants to join...</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-500">Participants ({participants.length})</h3>
            <div className="flex flex-wrap gap-3">
              <AnimatePresence>
                {participants.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm"
                  >
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-bold text-slate-900">{p.nickname}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="rounded-3xl bg-indigo-600 p-8 text-white shadow-xl shadow-indigo-200">
            <h3 className="text-lg font-bold">Quiz Details</h3>
            <p className="mt-1 text-indigo-100">{quiz.topic}</p>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-indigo-200">Questions</span>
                <span className="font-bold">{quiz.questions.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-indigo-200">Mode</span>
                <span className="font-bold capitalize">Classic Mode</span>
              </div>
            </div>

            {isHost && (
              <button
                onClick={handleStartGame}
                disabled={participants.length === 0}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-sm font-bold text-indigo-600 shadow-lg transition-all hover:bg-indigo-50 disabled:opacity-50"
              >
                <Play size={20} fill="currentColor" />
                Start Game
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (session.status === 'finished' || (participant && participant.isFinished)) {
    // Beautiful Podium for Host
    if (isHost) {
      const top3 = participants.slice(0, 3);
      return (
        <div className="flex min-h-screen flex-col items-center justify-start bg-slate-900 p-6 text-white overflow-y-auto">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-12 mt-12 text-center"
          >
            <h2 className="text-6xl font-black tracking-tighter">Podium</h2>
            <p className="mt-2 text-xl text-slate-400">{quiz.topic}</p>
          </motion.div>

          <div className="flex items-end gap-4 sm:gap-8 mb-16">
            {/* 2nd Place */}
            {top3[1] && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex flex-col items-center"
              >
                <div className="mb-4 text-center">
                  <p className="text-xl font-bold">{top3[1].nickname}</p>
                  <p className="text-indigo-400 font-black">{top3[1].score} pts</p>
                </div>
                <div className="flex h-48 w-32 items-center justify-center rounded-t-3xl bg-slate-700 shadow-2xl sm:h-64 sm:w-48">
                  <span className="text-6xl font-black text-slate-500">2</span>
                </div>
              </motion.div>
            )}

            {/* 1st Place */}
            {top3[0] && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1 }}
                className="flex flex-col items-center"
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="mb-4 text-center"
                >
                  <Trophy size={64} className="text-amber-400" />
                  <p className="mt-4 text-3xl font-black">{top3[0].nickname}</p>
                  <p className="text-amber-400 text-xl font-black">{top3[0].score} pts</p>
                </motion.div>
                <div className="flex h-64 w-32 items-center justify-center rounded-t-3xl bg-amber-500 shadow-2xl sm:h-80 sm:w-48">
                  <span className="text-8xl font-black text-amber-600">1</span>
                </div>
              </motion.div>
            )}

            {/* 3rd Place */}
            {top3[2] && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col items-center"
              >
                <div className="mb-4 text-center">
                  <p className="text-xl font-bold">{top3[2].nickname}</p>
                  <p className="text-indigo-400 font-black">{top3[2].score} pts</p>
                </div>
                <div className="flex h-32 w-32 items-center justify-center rounded-t-3xl bg-slate-800 shadow-2xl sm:h-48 sm:w-48">
                  <span className="text-6xl font-black text-slate-600">3</span>
                </div>
              </motion.div>
            )}
          </div>
          
          {/* Class Summary */}
          <div className="mb-12 grid w-full max-w-5xl gap-6 sm:grid-cols-2">
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="rounded-3xl bg-slate-800/50 p-8 backdrop-blur-xl border border-slate-700 text-center"
            >
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Class Average Score</p>
              <p className="mt-2 text-5xl font-black text-indigo-400">
                {Math.round(participants.reduce((sum, p) => sum + p.score, 0) / (participants.length || 1)).toLocaleString()}
              </p>
              <p className="mt-2 text-xs text-slate-500">Overall performance of the group</p>
            </motion.div>
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1.4 }}
              className="rounded-3xl bg-slate-800/50 p-8 backdrop-blur-xl border border-slate-700 text-center"
            >
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Class Accuracy</p>
              <p className="mt-2 text-5xl font-black text-emerald-400">
                {Math.round((participants.reduce((sum, p) => sum + (p.correctAnswersCount || 0), 0) / ((participants.length || 1) * quiz.questions.length)) * 100)}%
              </p>
              <p className="mt-2 text-xs text-slate-500">Percentage of correct answers</p>
            </motion.div>
          </div>

          {/* Detailed Report */}
          <div className="w-full max-w-5xl rounded-3xl bg-slate-800/50 p-8 backdrop-blur-xl border border-slate-700">
            <h3 className="mb-6 text-2xl font-black flex items-center gap-2">
              <Search className="text-indigo-400" />
              Detailed Session Report
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-sm uppercase tracking-widest">
                    <th className="pb-4 font-bold">Participant</th>
                    <th className="pb-4 font-bold">Score</th>
                    <th className="pb-4 font-bold">Accuracy</th>
                    <th className="pb-4 font-bold">Cheating Alerts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {participants.map((p) => {
                    const accuracy = Math.round(((p.correctAnswersCount || 0) / quiz.questions.length) * 100);
                    return (
                      <tr key={p.id} className="group hover:bg-slate-700/30 transition-colors">
                        <td className="py-4 font-bold">{p.nickname}</td>
                        <td className="py-4 font-black text-indigo-400">{p.score}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 rounded-full bg-slate-700 overflow-hidden">
                              <div 
                                className={`h-full ${accuracy > 70 ? 'bg-emerald-500' : accuracy > 40 ? 'bg-amber-500' : 'bg-red-500'}`} 
                                style={{ width: `${accuracy}%` }} 
                              />
                            </div>
                            <span className="text-sm font-bold">{accuracy}%</span>
                          </div>
                        </td>
                        <td className="py-4">
                          {p.cheatingAlerts && p.cheatingAlerts.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {p.cheatingAlerts.map((a, i) => (
                                <span key={i} className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400 uppercase">
                                  {a.type.replace('_', ' ')}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 italic">None detected</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={onExit}
            className="mt-16 mb-12 rounded-2xl bg-white px-12 py-4 text-lg font-black text-slate-900 shadow-xl transition-all hover:bg-slate-100"
          >
            Close Session
          </button>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <div className="mb-8 flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <Trophy size={48} />
          </div>
        </div>
        <h2 className="text-4xl font-black text-slate-900">Game Over!</h2>
        <p className="mt-2 text-slate-600">Here are the final standings for {quiz.topic}.</p>

        {userStats && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-8 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-8 text-white shadow-xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="text-left">
                <p className="text-xs font-black uppercase tracking-widest text-indigo-200">Current Level</p>
                <h3 className="text-3xl font-black">Level {userStats.level}</h3>
              </div>
              <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center">
                <Star size={32} fill="currentColor" className="text-amber-300" />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold">
                <span>XP Progress</span>
                <span>{userStats.xp} / {userStats.level * 1000} XP</span>
              </div>
              <div className="h-3 w-full rounded-full bg-black/20 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(userStats.xp / (userStats.level * 1000)) * 100}%` }}
                  className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-indigo-100 text-sm font-medium">
              <TrendingUp size={16} />
              <span>Keep playing to reach Level {userStats.level + 1}!</span>
            </div>
          </motion.div>
        )}

        <div className="mt-12 space-y-3">
          {participants.map((p, idx) => (
            <motion.div
              key={p.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: idx * 0.1 }}
              className={`flex items-center justify-between rounded-2xl border p-5 ${
                idx === 0 ? 'border-indigo-600 bg-indigo-50/50 shadow-md' : 'border-slate-100 bg-white'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  idx === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {idx + 1}
                </span>
                <span className="font-bold text-slate-900">{p.nickname}</span>
              </div>
              <span className="text-xl font-black text-indigo-600">{p.score} pts</span>
            </motion.div>
          ))}
        </div>

        <button
          onClick={onExit}
          className="mt-12 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 text-sm font-bold text-white shadow-lg transition-all hover:bg-slate-800"
        >
          <LogOut size={20} />
          Exit Playground
        </button>
      </div>
    );
  }

  if (!participant) return null;

  // Fullscreen Enforcement Overlay
  if (shouldEnforceFullscreen && !isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900 p-6 text-center text-white">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20 text-red-500">
            <Shield size={40} />
          </div>
          <h2 className="text-3xl font-black">Fullscreen Required</h2>
          <p className="mt-4 text-slate-400">
            To ensure a fair game, you must play in fullscreen mode. 
            Questions will be hidden if you exit fullscreen.
          </p>
          <button
            onClick={requestFullscreen}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-lg font-black shadow-xl transition-all hover:bg-indigo-700"
          >
            <Play size={20} fill="currentColor" />
            Enter Fullscreen
          </button>
        </motion.div>
      </div>
    );
  }

  const qIndex = participant.shuffledQuestionIndices ? participant.shuffledQuestionIndices[participant.currentQuestionIndex] : participant.currentQuestionIndex;
  const currentQuestion = quiz.questions[qIndex];
  const hasAnswered = selectedOption !== null;
  const progress = ((participant.currentQuestionIndex) / quiz.questions.length) * 100;

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white overflow-hidden flex flex-col font-sans">
      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-white/10">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/20 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-black shadow-lg">
            {participant.currentQuestionIndex + 1}
          </div>
          <div className="hidden sm:block">
            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Question</h3>
            <p className="text-sm font-bold text-white/80">{participant.currentQuestionIndex + 1} of {quiz.questions.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 border border-white/10">
            <Trophy size={16} className="text-amber-400" />
            <span className="font-black text-lg">{participant.score}</span>
          </div>
          <div className={`flex items-center gap-2 rounded-xl px-4 py-2 border border-white/10 ${timeLeft < 10 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-white/5 text-white/60'}`}>
            <Clock size={16} />
            <span className="font-black">{timeLeft}s</span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center p-4 sm:p-8">
        {/* Question Area */}
        <div className="w-full max-w-5xl flex-1 flex flex-col">
          <motion.div
            key={participant.currentQuestionIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center p-6"
          >
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight max-w-4xl drop-shadow-lg">
              {currentQuestion.question}
            </h2>

            {currentQuestion.type === 'writing' && !hasAnswered && (
              <div className="mt-8 w-full max-w-md space-y-4">
                <input
                  type="text"
                  value={writingAnswer}
                  onChange={(e) => setWritingAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full rounded-2xl border-2 border-white/10 bg-white/5 p-6 text-xl font-black text-white placeholder:text-white/20 focus:border-indigo-500 focus:bg-white/10 focus:outline-none transition-all shadow-2xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && writingAnswer.trim()) {
                      handleAnswer(writingAnswer.trim());
                    }
                  }}
                  autoFocus
                />
                <button
                  onClick={() => handleAnswer(writingAnswer.trim())}
                  disabled={!writingAnswer.trim()}
                  className="w-full rounded-2xl bg-indigo-600 py-4 text-lg font-black text-white shadow-[0_6px_0_#4338ca] hover:bg-indigo-700 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                >
                  Submit Answer
                </button>
              </div>
            )}
          </motion.div>

          {/* Options Grid */}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 mt-auto pb-8">
            {currentQuestion.type === 'multiple_choice' && currentQuestion.options.map((option, idx) => {
              const isSelected = selectedOption === option;
              const isCorrect = option === currentQuestion.correctAnswer;
              const showResult = hasAnswered;

              const colors = [
                { bg: 'bg-[#ef4444]', hover: 'hover:bg-[#dc2626]', border: 'border-[#b91c1c]', shadow: 'shadow-[0_6px_0_#b91c1c]' },
                { bg: 'bg-[#3b82f6]', hover: 'hover:bg-[#2563eb]', border: 'border-[#1d4ed8]', shadow: 'shadow-[0_6px_0_#1d4ed8]' },
                { bg: 'bg-[#f59e0b]', hover: 'hover:bg-[#d97706]', border: 'border-[#b45309]', shadow: 'shadow-[0_6px_0_#b45309]' },
                { bg: 'bg-[#10b981]', hover: 'hover:bg-[#059669]', border: 'border-[#047857]', shadow: 'shadow-[0_6px_0_#047857]' }
              ];
              const color = colors[idx % colors.length];

              let buttonClass = "group relative w-full flex items-center gap-4 rounded-2xl p-6 text-left transition-all active:translate-y-1 active:shadow-none ";
              
              if (!showResult) {
                buttonClass += `${color.bg} ${color.hover} ${color.shadow} text-white`;
              } else {
                if (isCorrect) {
                  buttonClass += "bg-emerald-500 shadow-[0_6px_0_#047857] text-white scale-105 z-10";
                } else if (isSelected) {
                  buttonClass += "bg-red-500 shadow-[0_6px_0_#b91c1c] text-white opacity-100";
                } else {
                  buttonClass += "bg-white/5 border border-white/10 text-white/20 grayscale pointer-events-none";
                }
              }

              return (
                <motion.button
                  key={idx}
                  whileHover={!showResult ? { y: -2 } : {}}
                  whileTap={!showResult ? { y: 2 } : {}}
                  disabled={showResult}
                  onClick={() => handleAnswer(option)}
                  className={buttonClass}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/20 font-black text-white/80">
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <span className="text-lg sm:text-xl font-black">{option}</span>
                  {showResult && isCorrect && <CheckCircle2 className="ml-auto text-white shrink-0" size={24} />}
                  {showResult && isSelected && !isCorrect && <XCircle className="ml-auto text-white shrink-0" size={24} />}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Result Bar & Explanation Modal */}
      <AnimatePresence>
        {hasAnswered && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed inset-x-0 bottom-0 z-50 flex flex-col bg-indigo-950/95 backdrop-blur-2xl border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] max-h-[60vh]`}
          >
            {/* Top Bar with Status and Next Button */}
            <div className={`flex items-center justify-between p-4 sm:p-6 border-b border-white/5 ${
              (currentQuestion.type === 'writing' 
                ? selectedOption?.trim().toLowerCase() === currentQuestion.correctAnswer.toLowerCase()
                : selectedOption === currentQuestion.correctAnswer)
              ? 'bg-emerald-500/10' : 'bg-red-500/10'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  (currentQuestion.type === 'writing' 
                    ? selectedOption?.trim().toLowerCase() === currentQuestion.correctAnswer.toLowerCase()
                    : selectedOption === currentQuestion.correctAnswer)
                  ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                }`}>
                  {(currentQuestion.type === 'writing' 
                    ? selectedOption?.trim().toLowerCase() === currentQuestion.correctAnswer.toLowerCase()
                    : selectedOption === currentQuestion.correctAnswer)
                  ? <CheckCircle2 size={28} /> : <XCircle size={28} />}
                </div>
                <div>
                  <h3 className={`text-xl sm:text-2xl font-black uppercase tracking-tight ${
                    (currentQuestion.type === 'writing' 
                      ? selectedOption?.trim().toLowerCase() === currentQuestion.correctAnswer.toLowerCase()
                      : selectedOption === currentQuestion.correctAnswer)
                    ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {(currentQuestion.type === 'writing' 
                      ? selectedOption?.trim().toLowerCase() === currentQuestion.correctAnswer.toLowerCase()
                      : selectedOption === currentQuestion.correctAnswer)
                    ? 'Correct!' : 'Incorrect!'}
                  </h3>
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest">
                    {(currentQuestion.type === 'writing' 
                      ? selectedOption?.trim().toLowerCase() === currentQuestion.correctAnswer.toLowerCase()
                      : selectedOption === currentQuestion.correctAnswer)
                    ? '+ Points earned' : `Correct answer: ${currentQuestion.correctAnswer}`}
                  </p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleNextQuestion}
                className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-8 sm:px-12 py-4 text-lg font-black text-white shadow-[0_6px_0_#4338ca] hover:bg-indigo-700 active:translate-y-1 active:shadow-none transition-all"
              >
                {participant.currentQuestionIndex === quiz.questions.length - 1 ? 'Finish' : 'Next'}
                <ChevronRight size={24} />
              </motion.button>
            </div>

            {/* Explanation Content */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                    <Info size={20} />
                  </div>
                  <h4 className="text-lg font-black text-white uppercase tracking-wider">Explanation</h4>
                </div>
                <div className="text-indigo-100/80 leading-relaxed prose prose-invert max-w-none">
                  <ReactMarkdown>{currentQuestion.explanation}</ReactMarkdown>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
