import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import ForgotPasswordScreen from './ForgotPasswordScreen';

type AuthScreen = 'login' | 'register' | 'forgot-password';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { user, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<AuthScreen>('login');

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl mb-4" style={{ background: 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary))' }}>
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-accent-primary)' }} />
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
        </motion.div>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  const navigateTo = (screen: AuthScreen) => setCurrentScreen(screen);

  return (
    <motion.div key={currentScreen} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      {currentScreen === 'login' && <LoginScreen onNavigate={navigateTo} />}
      {currentScreen === 'register' && <RegisterScreen onNavigate={navigateTo} />}
      {currentScreen === 'forgot-password' && <ForgotPasswordScreen onNavigate={navigateTo} />}
    </motion.div>
  );
}
