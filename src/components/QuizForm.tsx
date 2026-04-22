import React, { useState, useRef, useEffect } from 'react';
import { QuizConfig, QuizLevel, UserStats } from '../types';
import { Upload, Image as ImageIcon, X, Sparkles, Loader2, Globe, GraduationCap, BookOpen, Hash, FileText, FileType } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { translations } from '../lib/translations';

interface QuizFormProps {
  onGenerate: (config: QuizConfig) => Promise<void>;
  isGenerating: boolean;
}

const LEVELS: QuizLevel[] = ['IGCSE', 'AS-Level', 'A-Levels', 'SAT', 'University', 'General'];
const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Chinese', 'Uzbek', 'Russian'];

export default function QuizForm({ onGenerate, isGenerating }: QuizFormProps) {
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

  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<QuizLevel>('IGCSE');
  const [language, setLanguage] = useState('English');
  const [questionCount, setQuestionCount] = useState(5);
  const [additionalMaterials, setAdditionalMaterials] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [documents, setDocuments] = useState<{ data: string; mimeType: string; name: string }[]>([]);
  const [type, setType] = useState<'quiz' | 'exam'>('quiz');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (!blob) continue;

          const reader = new FileReader();
          reader.onloadend = () => {
            const data = reader.result as string;
            setImages(prev => [...prev, data]);
          };
          reader.readAsDataURL(blob);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const data = reader.result as string;
        if (file.type.startsWith('image/')) {
          setImages(prev => [...prev, data]);
        } else {
          setDocuments(prev => [...prev, { data, mimeType: file.type, name: file.name }]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({
      topic,
      level,
      language,
      questionCount,
      additionalMaterials,
      images,
      documents: documents.map(d => ({ data: d.data, mimeType: d.mimeType })),
      type
    });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-10 text-center">
        <motion.h2 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-black font-serif tracking-tight text-slate-900"
        >
          {t.createAiQuiz.split('AI Quiz')[0]}<span className="text-uz-blue">AI Quiz</span>{t.createAiQuiz.split('AI Quiz')[1]}
        </motion.h2>
        <p className="mt-3 text-lg text-slate-600 font-serif italic">{t.transformStudy}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl shadow-uz-blue/5 sm:p-10">
        {/* Type Selection */}
        <div className="flex gap-4 p-1 rounded-2xl bg-slate-100">
          <button
            type="button"
            onClick={() => setType('quiz')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
              type === 'quiz' ? 'bg-white text-uz-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles size={16} />
            {t.quizMode}
          </button>
          <button
            type="button"
            onClick={() => setType('exam')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
              type === 'exam' ? 'bg-white text-uz-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText size={16} />
            {t.examMode}
          </button>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-uz-blue/10 text-uz-blue">
                <BookOpen size={14} />
              </div>
              {t.topic}
            </label>
            <input
              type="text"
              required
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder={t.topicPlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition-all focus:border-uz-blue focus:bg-white focus:ring-4 focus:ring-uz-blue/10"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-uz-green/10 text-uz-green">
                <GraduationCap size={14} />
              </div>
              {t.academicLevel}
            </label>
            <select
              value={level}
              onChange={e => setLevel(e.target.value as QuizLevel)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition-all focus:border-uz-green focus:bg-white focus:ring-4 focus:ring-uz-green/10"
            >
              <option value="IGCSE">IGCSE</option>
              <option value="AS-Level">{t.levelASLevel}</option>
              <option value="A-Levels">A-Levels</option>
              <option value="SAT">SAT</option>
              <option value="University">{t.levelUniversity}</option>
              <option value="General">{t.levelGeneral}</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-uz-blue/10 text-uz-blue">
                <Globe size={14} />
              </div>
              {t.language}
            </label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition-all focus:border-uz-blue focus:bg-white focus:ring-4 focus:ring-uz-blue/10"
            >
              <option value="English">{t.langEnglish}</option>
              <option value="Spanish">{t.langSpanish}</option>
              <option value="French">{t.langFrench}</option>
              <option value="German">{t.langGerman}</option>
              <option value="Chinese">{t.langChinese}</option>
              <option value="Uzbek">{t.langUzbek}</option>
              <option value="Russian">{t.langRussian}</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-uz-gold/10 text-uz-gold">
                <Hash size={14} />
              </div>
              {t.numQuestions}
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={questionCount}
              onChange={e => setQuestionCount(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition-all focus:border-uz-gold focus:bg-white focus:ring-4 focus:ring-uz-gold/10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-uz-blue/10 text-uz-blue">
              <Sparkles size={14} />
            </div>
            {t.additionalContext}
          </label>
          <textarea
            value={additionalMaterials}
            onChange={e => setAdditionalMaterials(e.target.value)}
            placeholder={t.additionalContext}
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition-all focus:border-uz-blue focus:bg-white focus:ring-4 focus:ring-uz-blue/10"
          />
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-uz-blue/10 text-uz-blue">
              <Upload size={14} />
            </div>
            {t.uploadMaterials}
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 transition-all hover:border-uz-blue hover:bg-uz-blue/5"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-uz-blue/5 to-uz-green/5 opacity-0 transition-opacity group-hover:opacity-100" />
            <Upload className="mb-3 text-slate-400 transition-transform group-hover:-translate-y-1 group-hover:text-uz-blue" size={32} />
            <p className="text-base font-bold text-slate-700 group-hover:text-uz-blue">{t.clickToUpload}</p>
            <p className="mt-2 text-xs text-slate-500">{t.uploadFormats}</p>
            <p className="mt-1 text-[10px] text-slate-400 italic">{t.pptNote}</p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept="image/*,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              className="hidden"
            />
          </div>

          <AnimatePresence>
            {(images.length > 0 || documents.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="space-y-4 pt-2"
              >
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {images.map((img, idx) => (
                      <motion.div
                        key={`img-${idx}`}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="group relative h-20 w-20 overflow-hidden rounded-xl border-2 border-white shadow-md"
                      >
                        <img src={img} alt="Upload" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute right-1 top-1 rounded-full bg-red-500 p-1.5 text-white shadow-lg opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X size={10} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}

                {documents.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {documents.map((doc, idx) => (
                      <motion.div
                        key={`doc-${idx}`}
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-uz-blue/10 text-uz-blue">
                            {doc.mimeType.includes('pdf') ? <FileText size={20} /> : <FileType size={20} />}
                          </div>
                          <p className="truncate text-xs font-bold text-slate-700">{doc.name}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDocument(idx)}
                          className="ml-2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="submit"
          disabled={isGenerating || !topic}
          className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-uz-blue py-5 text-base font-black text-white shadow-xl shadow-uz-blue/20 transition-all hover:scale-[1.02] hover:bg-uz-blue/90 disabled:cursor-not-allowed disabled:opacity-70 active:scale-95"
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
          {isGenerating ? (
            <>
              <Loader2 className="animate-spin" size={24} />
              {t.generating}
            </>
          ) : (
            <>
              <Sparkles size={24} className="animate-pulse" />
              {t.generate}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
