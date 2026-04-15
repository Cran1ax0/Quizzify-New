import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { collection, addDoc, getDoc, setDoc, onSnapshot, doc } from 'firebase/firestore';
import { generateAll } from './lib/gemini';
import { Quiz, QuizConfig, Flashcard, UserStats } from './types';
import Layout from './components/Layout';
import QuizForm from './components/QuizForm';
import QuizView from './components/QuizView';
import QuizHistory from './components/QuizHistory';
import QuizEditor from './components/QuizEditor';
import HostSession from './components/Playground/HostSession';
import JoinSession from './components/Playground/JoinSession';
import GameSession from './components/Playground/GameSession';
import Ranking from './components/Ranking';
import Profile from './components/Profile';
import Login from './components/Login';
import { BrainCircuit, Sparkles, LogIn, ChevronRight, BookOpen, Search, Image as ImageIcon, Users, Play, FileText, Trophy, User as UserIcon, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithGoogle, getOrCreateUserStats, logout } from './lib/firebase';
import { translations } from './lib/translations';

export default function App() {
  const [user, loading] = useAuthState(auth);
  const [activeTab, setActiveTab] = useState<'create' | 'history' | 'playground' | 'ranking' | 'profile'>('create');
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [interfaceLang, setInterfaceLang] = useState<'en' | 'uz' | 'ru'>('en');
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [isCreatingManual, setIsCreatingManual] = useState(false);

  const t = translations[userStats?.settings?.interfaceLanguage || interfaceLang] || translations.en;

  // Playground state
  const [playgroundMode, setPlaygroundMode] = useState<'landing' | 'host' | 'join' | 'active'>('landing');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeParticipantId, setActiveParticipantId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  
  useEffect(() => {
    if (user) {
      setShowLogin(false);
      getOrCreateUserStats(user.uid, user.displayName, user.photoURL);
      
      const unsubscribe = onSnapshot(doc(db, 'userStats', user.uid), (snap) => {
        if (snap.exists()) {
          const stats = snap.data() as UserStats;
          setUserStats(stats);
        }
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleGenerate = async (config: QuizConfig) => {
    if (!user) return;
    setIsGenerating(true);
    setError(null);
    try {
      // Generate quiz and flashcards in a single call to save quota
      const { questions, flashcards: flashcardData } = await generateAll(config);

      const quizData: Omit<Quiz, 'id'> = {
        userId: user.uid,
        topic: config.topic,
        level: config.level,
        language: config.language,
        questions,
        createdAt: new Date().toISOString(),
        sourceMaterials: config.additionalMaterials ? [config.additionalMaterials] : [],
        type: config.type
      };

      const quizDocRef = await addDoc(collection(db, 'quizzes'), quizData);
      const quizId = quizDocRef.id;

      // Save flashcards
      await Promise.all(flashcardData.map(card => 
        addDoc(collection(db, 'flashcards'), {
          quizId,
          userId: user.uid,
          front: card.front,
          back: card.back,
          createdAt: new Date().toISOString()
        })
      ));

      setCurrentQuiz({ id: quizId, ...quizData });
    } catch (err: any) {
      console.error('Generation error:', err);
      
      let userMessage = 'Failed to generate quiz and flashcards. Please try again.';
      
      // Check for Gemini Quota Error (429)
      const errorString = JSON.stringify(err);
      if (errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED')) {
        userMessage = 'AI Quota Exceeded: You have reached the limit for free generations. Please wait a minute or try again tomorrow.';
      } else if (err.message?.includes('GoogleSearchRetrievalError')) {
        userMessage = 'AI Search Error: The AI had trouble verifying facts online. Please try a more specific topic.';
      }
      
      setError(userMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveManual = async (quizData: Partial<Quiz>) => {
    if (!user) return;
    try {
      if (editingQuiz) {
        // Update existing
        const quizRef = doc(db, 'quizzes', editingQuiz.id);
        await setDoc(quizRef, { ...quizData, updatedAt: new Date().toISOString() }, { merge: true });
        setEditingQuiz(null);
      } else {
        // Create new
        const newQuiz: Omit<Quiz, 'id'> = {
          userId: user.uid,
          topic: quizData.topic!,
          level: quizData.level!,
          language: quizData.language!,
          questions: quizData.questions!,
          createdAt: new Date().toISOString(),
          type: quizData.type!
        };
        const docRef = await addDoc(collection(db, 'quizzes'), newQuiz);
        setCurrentQuiz({ id: docRef.id, ...newQuiz });
        setIsCreatingManual(false);
      }
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save quiz');
    }
  };

  const startHosting = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setIsHost(true);
    setPlaygroundMode('active');
  };

  const startJoining = (sessionId: string, participantId: string) => {
    setActiveSessionId(sessionId);
    setActiveParticipantId(participantId);
    setIsHost(false);
    setPlaygroundMode('active');
  };

  const exitPlayground = () => {
    setPlaygroundMode('landing');
    setActiveSessionId(null);
    setActiveParticipantId(null);
    setIsHost(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">{t.loadingApp}</p>
        </div>
      </div>
    );
  }

  // If in active playground session, show the game view full screen (no layout)
  if (playgroundMode === 'active' && activeSessionId) {
    return (
      <GameSession
        sessionId={activeSessionId}
        participantId={activeParticipantId || undefined}
        isHost={isHost}
        onExit={exitPlayground}
      />
    );
  }

  if (!user && activeTab !== 'playground') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <div className="relative overflow-hidden bg-white">
          {/* Animated Background Blobs */}
          <div className="absolute -top-24 -left-24 h-96 w-96 animate-pulse rounded-full bg-indigo-200/30 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-100/20 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-96 w-96 animate-pulse rounded-full bg-fuchsia-200/30 blur-3xl" />
          
          <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                className="mb-10 flex justify-center"
              >
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-3xl bg-indigo-400/20" />
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-2xl">
                    <BrainCircuit size={56} />
                  </div>
                </div>
              </motion.div>
              
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-6xl font-black tracking-tight text-slate-900 sm:text-8xl"
              >
                Quizzify<span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">.ai</span>
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-8 text-2xl font-medium leading-relaxed text-slate-600"
              >
                <span className="font-black text-slate-900">{t.landingTaglineMain}</span> {t.landingTaglineSub}
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-12 flex flex-col items-center justify-center gap-6"
              >
                {!showLogin && (
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-100 p-1 mb-4">
                    {[
                      { id: 'en', label: 'EN' },
                      { id: 'uz', label: 'UZ' },
                      { id: 'ru', label: 'RU' }
                    ].map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => setInterfaceLang(lang.id as any)}
                        className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                          interfaceLang === lang.id
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-col items-center justify-center gap-6 sm:flex-row w-full">
                  {showLogin ? (
                    <Login onSuccess={() => setShowLogin(false)} lang={interfaceLang} />
                  ) : (
                    <>
                      <button
                        onClick={() => setShowLogin(true)}
                        className="group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-slate-900 px-10 py-5 text-xl font-black text-white shadow-2xl transition-all hover:scale-105 hover:bg-slate-800 active:scale-95"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 opacity-0 transition-opacity group-hover:opacity-10" />
                        <LogIn size={24} />
                        {t.getStartedFree}
                      </button>
                      
                      <button
                        onClick={() => setActiveTab('playground')}
                        className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-10 py-5 text-xl font-bold text-slate-700 transition-all hover:border-indigo-300 hover:bg-indigo-50/30 active:scale-95"
                      >
                        <Play size={24} fill="currentColor" className="text-indigo-600" />
                        {t.tryPlayground}
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            </div>

            {!showLogin && (
              <div className="mt-32 grid grid-cols-1 gap-10 sm:grid-cols-3">
              {[
                { 
                  icon: FileText, 
                  title: t.featureMultiModalTitle, 
                  desc: t.featureMultiModalDesc,
                  color: "bg-indigo-50 text-indigo-600"
                },
                { 
                  icon: Search, 
                  title: t.featureSearchTitle, 
                  desc: t.featureSearchDesc,
                  color: "bg-violet-50 text-violet-600"
                },
                { 
                  icon: Sparkles, 
                  title: t.featureAdaptiveTitle, 
                  desc: t.featureAdaptiveDesc,
                  color: "bg-fuchsia-50 text-fuchsia-600"
                }
              ].map((feature, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                  className="group relative rounded-3xl border border-slate-100 bg-white p-10 shadow-sm transition-all hover:-translate-y-2 hover:border-indigo-200 hover:shadow-xl"
                >
                  <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${feature.color} transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                    <feature.icon size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">{feature.title}</h3>
                  <p className="mt-4 text-lg text-slate-500 leading-relaxed">{feature.desc}</p>
                </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} disabled={!!currentQuiz || !!editingQuiz || isCreatingManual}>
      <AnimatePresence mode="wait">
        {currentQuiz ? (
          <motion.div
            key="quiz-view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <QuizView quiz={currentQuiz} onClose={() => setCurrentQuiz(null)} />
          </motion.div>
        ) : editingQuiz || isCreatingManual ? (
          <motion.div
            key="quiz-editor"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <QuizEditor 
              quiz={editingQuiz || undefined} 
              onSave={handleSaveManual} 
              onCancel={() => {
                setEditingQuiz(null);
                setIsCreatingManual(false);
              }} 
            />
          </motion.div>
        ) : activeTab === 'create' ? (
          <motion.div
            key="quiz-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {error && (
              <div className="mx-auto mb-6 max-w-3xl rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600 border border-red-100">
                {error}
              </div>
            )}
            <div className="mx-auto max-w-3xl mb-8 flex justify-end">
              <button
                onClick={() => setIsCreatingManual(true)}
                className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-6 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition-all"
              >
                <Plus size={18} />
                {t.createManualQuiz}
              </button>
            </div>
            <QuizForm onGenerate={handleGenerate} isGenerating={isGenerating} />
          </motion.div>
        ) : activeTab === 'history' ? (
          <motion.div
            key="quiz-history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <QuizHistory onSelect={setCurrentQuiz} onEdit={setEditingQuiz} />
          </motion.div>
        ) : activeTab === 'ranking' ? (
          <motion.div
            key="ranking"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Ranking />
          </motion.div>
        ) : activeTab === 'profile' ? (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Profile onLogout={logout} />
          </motion.div>
        ) : (
          <motion.div
            key="playground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {playgroundMode === 'landing' && (
              <div className="mx-auto max-w-4xl py-12">
                <div className="mb-12 text-center">
                  <h2 className="text-4xl font-black text-slate-900">{t.playgroundTitle}</h2>
                  <p className="mt-4 text-xl text-slate-600">{t.playgroundTagline}</p>
                </div>

                <div className="grid gap-8 sm:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:border-indigo-300 hover:shadow-xl">
                    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                      <Play size={32} fill="currentColor" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900">{t.hostSession}</h3>
                    <p className="mt-4 text-slate-600 leading-relaxed">
                      {t.hostDesc}
                    </p>
                    <button
                      onClick={() => user ? setPlaygroundMode('host') : signInWithGoogle()}
                      className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700"
                    >
                      {t.startHosting}
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:border-indigo-300 hover:shadow-xl">
                    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-100">
                      <Users size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900">{t.joinSession}</h3>
                    <p className="mt-4 text-slate-600 leading-relaxed">
                      {t.joinDesc}
                    </p>
                    <button
                      onClick={() => setPlaygroundMode('join')}
                      className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-600"
                    >
                      {t.joinGame}
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {playgroundMode === 'host' && (
              <div className="space-y-6">
                <button onClick={() => setPlaygroundMode('landing')} className="text-sm font-medium text-slate-500 hover:text-slate-900">
                  ← {t.backToPlayground}
                </button>
                <HostSession onStarted={startHosting} />
              </div>
            )}

            {playgroundMode === 'join' && (
              <div className="space-y-6">
                <button onClick={() => setPlaygroundMode('landing')} className="text-sm font-medium text-slate-500 hover:text-slate-900">
                  ← {t.backToPlayground}
                </button>
                <JoinSession onJoined={startJoining} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
