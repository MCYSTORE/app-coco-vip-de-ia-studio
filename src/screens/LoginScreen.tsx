import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Mail, Lock, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginScreenProps {
  onNavigate: (screen: 'register' | 'forgot-password') => void;
}

export default function LoginScreen({ onNavigate }: LoginScreenProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('Email o contraseña incorrectos');
        } else if (error.message.includes('Email not confirmed')) {
          setError('Por favor verifica tu email antes de iniciar sesión');
        } else {
          setError(error.message);
        }
      }
    } catch (err: any) {
      setError('Error al iniciar sesión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-8">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl" style={{ background: 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary))' }}>
          <Sparkles className="w-10 h-10 text-white" />
        </div>
      </motion.div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>Bienvenido</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Inicia sesión para continuar</p>
      </motion.div>

      <motion.form initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium ml-1" style={{ color: 'var(--color-text-primary)' }}>Email</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required className="w-full pl-12 pr-4 py-3.5 rounded-xl outline-none" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium ml-1" style={{ color: 'var(--color-text-primary)' }}>Contraseña</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="w-full pl-12 pr-12 py-3.5 rounded-xl outline-none" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="text-right">
          <button type="button" onClick={() => onNavigate('forgot-password')} className="text-sm font-medium" style={{ color: 'var(--color-accent-primary)' }}>¿Olvidaste tu contraseña?</button>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl text-sm text-center" style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            {error}
          </motion.div>
        )}

        <button type="submit" disabled={loading || !email || !password} className="w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary))' }}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Iniciar Sesión<ArrowRight className="w-5 h-5" /></>}
        </button>
      </motion.form>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 text-center">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>¿No tienes cuenta? <button onClick={() => onNavigate('register')} className="font-bold" style={{ color: 'var(--color-accent-primary)' }}>Crear cuenta</button></p>
      </motion.div>
    </div>
  );
}
