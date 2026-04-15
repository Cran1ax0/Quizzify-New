import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Mail, Phone, Lock, User, ChevronRight, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, auth } from '../lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';

interface LoginProps {
  onSuccess: () => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [method, setMethod] = useState<'options' | 'email-login' | 'email-signup' | 'phone'>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'phone' | 'code'>('phone');

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await signInWithEmail(email, password);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await signUpWithEmail(email, password, name);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(result);
      setStep('code');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    try {
      setLoading(true);
      setError(null);
      await confirmationResult.confirm(verificationCode);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
      <div id="recaptcha-container"></div>
      
      <div className="p-8">
        <AnimatePresence mode="wait">
          {method === 'options' && (
            <motion.div
              key="options"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h2 className="text-3xl font-black text-slate-900">Welcome Back</h2>
                <p className="mt-2 text-slate-500">Choose your preferred login method</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-4 font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
                >
                  <img src="https://www.google.com/favicon.ico" className="h-5 w-5" alt="Google" />
                  Continue with Google
                </button>

                <button
                  onClick={() => setMethod('email-login')}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-4 font-bold text-white transition-all hover:bg-slate-800"
                >
                  <Mail size={20} />
                  Continue with Email
                </button>

                <button
                  onClick={() => setMethod('phone')}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-4 font-bold text-slate-700 transition-all hover:bg-slate-50"
                >
                  <Phone size={20} />
                  Continue with Phone
                </button>
              </div>

              <div className="text-center">
                <button
                  onClick={() => setMethod('email-signup')}
                  className="text-sm font-bold text-indigo-600 hover:underline"
                >
                  Don't have an account? Sign up
                </button>
              </div>
            </motion.div>
          )}

          {(method === 'email-login' || method === 'email-signup') && (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <button
                onClick={() => setMethod('options')}
                className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <div className="text-center">
                <h2 className="text-3xl font-black text-slate-900">
                  {method === 'email-login' ? 'Sign In' : 'Create Account'}
                </h2>
              </div>

              <form onSubmit={method === 'email-login' ? handleEmailLogin : handleEmailSignup} className="space-y-4">
                {method === 'email-signup' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 outline-none focus:border-indigo-500 focus:bg-white"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 outline-none focus:border-indigo-500 focus:bg-white"
                      placeholder="name@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 outline-none focus:border-indigo-500 focus:bg-white"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : method === 'email-login' ? 'Sign In' : 'Create Account'}
                  <ChevronRight size={18} />
                </button>
              </form>
            </motion.div>
          )}

          {method === 'phone' && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <button
                onClick={() => setMethod('options')}
                className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <div className="text-center">
                <h2 className="text-3xl font-black text-slate-900">Phone Login</h2>
                <p className="mt-2 text-slate-500">
                  {step === 'phone' ? 'Enter your phone number' : 'Enter the 6-digit code'}
                </p>
              </div>

              <form onSubmit={step === 'phone' ? handlePhoneSubmit : handleCodeSubmit} className="space-y-4">
                {step === 'phone' ? (
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 outline-none focus:border-indigo-500 focus:bg-white"
                        placeholder="+1 234 567 890"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Verification Code</label>
                    <div className="relative">
                      <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        required
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 outline-none focus:border-indigo-500 focus:bg-white"
                        placeholder="123456"
                        maxLength={6}
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : step === 'phone' ? 'Send Code' : 'Verify Code'}
                  <ChevronRight size={18} />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
