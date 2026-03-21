import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Loader2, ArrowLeft, CheckCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ForgotPasswordScreenProps {
  onNavigate: (screen: 'login') => void;
}

export default function ForgotPasswordScreen({ onNavigate }: ForgotPasswordScreenProps) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await resetPassword(email);
      if (error) {
        setError('No se pudo enviar el email. Verifica que el email sea correcto.');
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError('Error al enviar el email. Intenta de nuevo.');
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
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>Email Enviado</h1>
          <p className="text-sm mb-6 max-w-xs mx-auto" style={{ color: 'var(--color-text-secondary)' }}>Hemos enviado un enlace de recuperación a <strong>{email}</strong>.</p>
          <button onClick={() => onNavigate('login')} className="px-6 py-3 rounded-xl font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary))' }}>Volver a Login</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={() => onNavigate('login')} className="absolute top-6 left-6 p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        <ArrowLeft className="w-5 h-5" style={{ color: 'var(--color-text-primary)' }} />
      </motion.button>

      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl" style={{ background: 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary))' }}>
          <Sparkles className="w-8 h-8 text-white" />
        </div>
      </motion.div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>¿Olvidaste tu contraseña?</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Te enviaremos un enlace para recuperarla</p>
      </motion.div>

      <motion.form initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium ml-1" style={{ color: 'var(--color-text-primary)' }}>Email</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required className="w-full pl-12 pr-4 py-3.5 rounded-xl outline-none" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl text-sm text-center" style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            {error}
          </motion.div>
        )}

        <button type="submit" disabled={loading || !email} className="w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary))' }}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar Enlace'}
        </button>
      </motion.form>
    </div>
  );
}
