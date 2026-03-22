import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Mail, Lock, Loader2, User, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface RegisterScreenProps {
  onNavigate: (screen: 'login') => void;
}

export default function RegisterScreen({ onNavigate }: RegisterScreenProps) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const { error } = await signUp(email, password);
      
      if (error) {
        if (error.message.includes('already registered')) {
          setError('Este email ya está registrado');
        } else {
          setError(error.message);
        }
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError('Error al crear cuenta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: 'var(--color-success-bg)' }}>
            <CheckCircle className="w-10 h-10" style={{ color: 'var(--color-success)' }} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>¡Cuenta creada!</h1>
          <p className="text-sm mb-6 max-w-xs mx-auto" style={{ color: 'var(--color-text-secondary)' }}>Hemos enviado un email de confirmación a <strong>{email}</strong>. Revisa tu bandeja de entrada.</p>
          <button onClick={() => onNavigate('login')} className="px-6 py-3 rounded-xl font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary))' }}>Ir a Login</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl" style={{ background: 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary))' }}>
          <User className="w-8 h-8 text-white" />
        </div>
      </motion.div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Crear Cuenta</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Únete a Coco VIP</p>
      </motion.div>

      <motion.form initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} onSubmit={handleRegister} className="w-full max-w-sm space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium ml-1" style={{ color: 'var(--color-text-primary)' }}>Email</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required className="w-full pl-12 pr-4 py-3 rounded-xl outline-none" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium ml-1" style={{ color: 'var(--color-text-primary)' }}>Contraseña</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} className="w-full pl-12 pr-12 py-3 rounded-xl outline-none" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium ml-1" style={{ color: 'var(--color-text-primary)' }}>Confirmar Contraseña</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
            <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repite tu contraseña" required className="w-full pl-12 pr-4 py-3 rounded-xl outline-none" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl text-sm text-center" style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            {error}
          </motion.div>
        )}

        <button type="submit" disabled={loading || !email || !password || !confirmPassword} className="w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary))' }}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Crear Cuenta<ArrowRight className="w-5 h-5" /></>}
        </button>
      </motion.form>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-6 text-center">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>¿Ya tienes cuenta? <button onClick={() => onNavigate('login')} className="font-bold" style={{ color: 'var(--color-accent-primary)' }}>Iniciar sesión</button></p>
      </motion.div>
    </div>
  );
}
