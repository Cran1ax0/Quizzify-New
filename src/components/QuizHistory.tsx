import React, { useEffect, useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Quiz, UserStats } from '../types';
import { Trash2, Play, Calendar, BookOpen, GraduationCap, Globe, Search, FileText, Pencil, Eye, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations } from '../lib/translations';
import { generateExamPDF } from '../lib/pdfGenerator';

interface QuizHistoryProps {
  onSelect: (quiz: Quiz, isStudyMode?: boolean) => void;
  onEdit: (quiz: Quiz) => void;
}

export default function QuizHistory({ onSelect, onEdit }: QuizHistoryProps) {
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

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'quiz' | 'exam'>('all');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'quizzes'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
      setQuizzes(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quizzes');
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      // Auto-reset confirmation after 3 seconds
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }

    try {
      await deleteDoc(doc(db, 'quizzes', id));
      setConfirmDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `quizzes/${id}`);
    }
  };

  const filteredQuizzes = quizzes.filter(q => {
    const matchesSearch = q.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         q.level.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || q.type === filterType;
    return matchesSearch && matchesType;
  });

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleDownloadPaper = async (e: React.MouseEvent, quiz: Quiz) => {
    e.stopPropagation();
    try {
      setIsGeneratingPDF(true);
      await generateExamPDF(quiz);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      setIsGeneratingPDF(false);
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
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">{t.yourLibrary}</h2>
          <p className="mt-1 text-slate-600">{t.revisitLibrary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex rounded-xl bg-slate-100 p-1">
            {(['all', 'quiz', 'exam'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold capitalize transition-all ${
                  filterType === type ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t[type as keyof typeof t] || type}s
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder={t.search}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:w-48"
            />
          </div>
        </div>
      </div>

      {filteredQuizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
            <BookOpen size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">{t.noQuizzes}</h3>
          <p className="mt-2 text-slate-500">{t.startCreating}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredQuizzes.map((quiz, idx) => {
              const levelColors: Record<string, string> = {
                'IGCSE': 'bg-indigo-50 text-indigo-600 border-indigo-100',
                'AS-Level': 'bg-cyan-50 text-cyan-600 border-cyan-100',
                'A-Levels': 'bg-violet-50 text-violet-600 border-violet-100',
                'SAT': 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100',
                'University': 'bg-emerald-50 text-emerald-600 border-emerald-100',
                'General': 'bg-amber-50 text-amber-600 border-amber-100'
              };
              const color = levelColors[quiz.level] || levelColors['General'];
              
              const translatedLevel = t[`level${quiz.level.replace('-', '')}` as keyof typeof t] || quiz.level;
              const translatedLanguage = t[`lang${quiz.language}` as keyof typeof t] || quiz.language;
              const translatedType = t[quiz.type as keyof typeof t] || quiz.type;

              return (
                <motion.div
                  key={quiz.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => onSelect(quiz)}
                  className="group relative cursor-pointer overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-fuchsia-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
                  
                  <div className="relative mb-6 flex items-start justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color.split(' ')[0]} ${color.split(' ')[1]} transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                      {quiz.type === 'exam' ? <FileText size={24} /> : <BookOpen size={24} />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md px-2 py-1 text-[8px] font-black uppercase tracking-tighter ${quiz.type === 'exam' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        {translatedType}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(quiz);
                        }}
                        className="rounded-full p-2 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, quiz.id)}
                        className={`rounded-full p-2 transition-all ${
                          confirmDeleteId === quiz.id 
                            ? 'bg-red-600 text-white opacity-100' 
                            : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500'
                        }`}
                      >
                        {confirmDeleteId === quiz.id ? (
                          <span className="px-1 text-[10px] font-black uppercase">{t.confirmDelete}</span>
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  <h4 className="relative line-clamp-2 text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{quiz.topic}</h4>
                  
                  <div className="relative mt-6 flex flex-wrap gap-2">
                    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${color}`}>
                      <GraduationCap size={14} />
                      {translatedLevel}
                    </span>
                    <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                      <Globe size={14} />
                      {translatedLanguage}
                    </span>
                  </div>

                  <div className="relative mt-8 flex items-center justify-between border-t border-slate-50 pt-5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(quiz, true);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-all hover:bg-uz-blue/10 hover:text-uz-blue"
                        title={t.view}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDownloadPaper(e, quiz)}
                        disabled={isGeneratingPDF}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-all hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
                        title={t.download}
                      >
                        {isGeneratingPDF ? (
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                        ) : (
                          <Download size={16} />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-black text-indigo-600 transition-transform group-hover:translate-x-1">
                      {t.practice}
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                        <Play size={12} fill="currentColor" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
