import React, { useState } from 'react';
import PickCard from '../components/PickCard';
import { Prediction } from '../types';
import { Loader2, TrendingUp, Sparkles, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PicksProps {
  onNavigate?: (tab: string) => void;
}

export default function Picks({ onNavigate }: PicksProps) {
  const [picks, setPicks] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [generateResult, setGenerateResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchPicks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/top-picks');
      const data = await response.json();
      setPicks(data);
      setLastUpdate(new Date());
      setHasLoaded(true);
    } catch (error) {
      console.error("Error fetching picks:", error);
    } finally {
      setLoading(false);
    }
  };

  const generatePicksForSport = async (sport: 'football' | 'basketball' | 'baseball') => {
    setGenerating(sport);
    setGenerateResult(null);
    
    const endpoints: Record<string, string> = {
      football: '/api/generate-daily-picks',
      basketball: '/api/generate-nba-picks',
      baseball: '/api/generate-baseball-picks'
    };
    
    const sportNames: Record<string, string> = {
      football: 'Fútbol',
      basketball: 'NBA',
      baseball: 'MLB'
    };
    
    try {
      const response = await fetch(endpoints[sport], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.message && data.picks_generated === 0) {
          setGenerateResult({
            success: false,
            message: `${sportNames[sport]}: ${data.message}`
          });
        } else if (data.picks_generated > 0) {
          setGenerateResult({
            success: true,
            message: `¡${data.picks_generated} pick${data.picks_generated > 1 ? 's' : ''} de ${sportNames[sport]} generados!`
          });
        } else {
          setGenerateResult({
            success: false,
            message: `${sportNames[sport]}: No se encontraron picks de calidad`
          });
        }
        await fetchPicks();
      } else {
        setGenerateResult({
          success: false,
          message: data.error || `Error al generar picks de ${sportNames[sport]}`
        });
      }
    } catch (error: any) {
      setGenerateResult({
        success: false,
        message: error.message || 'Error de conexión'
      });
    } finally {
      setGenerating(null);
    }
  };

  // Loading state
  if (loading && picks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-10 h-10 text-[var(--color-accent-primary)]" />
        </motion.div>
        <p className="text-[var(--color-text-secondary)] font-medium mt-4">Analizando mercados...</p>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════════
  // VISUAL DESIGN - Matching Reference Image Exactly
  // ═════════════════════════════════════════════════════════════════════════════════
  
  return (
    <div className="space-y-6">
      {/* Header - Simple and Clean */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Top Picks
        </h1>
        <p className="text-sm flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
          <TrendingUp className="w-3.5 h-3.5" />
          Mejores oportunidades detectadas
        </p>
      </div>

      {/* Sport Cards - Clean Design Matching Reference */}
      <div className="space-y-3">
        {/* Fútbol Card */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => generatePicksForSport('football')}
          disabled={generating !== null}
          className="w-full rounded-[20px] overflow-hidden relative"
          style={{ 
            height: '110px',
            background: 'linear-gradient(135deg, #2D7A3A 0%, #1B5E3A 100%)'
          }}
        >
          {/* Background ball image effect */}
          <div 
            className="absolute right-[-20px] bottom-[-10px] w-[130px] h-[130px] opacity-25 pointer-events-none"
            style={{ 
              background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='35' fill='%23ffffff'/%3E%3Cpath d='M50 25 L35 25 L50 5 L65 25 L50' fill='%23ffffff' opacity='0.3'/%3E%3Cpath d='M25 50 L50 35 L50 65 L75 50 L50 35' fill='%23ffffff' opacity='0.3'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundSize: 'contain'
            }}
          />
          
          {/* Content */}
          <div className="relative z-10 flex items-center p-5">
            {/* Icon */}
            <div 
              className="w-12 h-12 rounded-[14px] flex items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <span className="text-2xl">⚽</span>
            </div>
            
            {/* Text */}
            <div className="flex-1 ml-4">
              <p className="text-xl font-bold text-white">Fútbol</p>
              <p className="text-[13px] text-white/85">Top 5 ligas + UEFA</p>
            </div>
            
            {/* Arrow */}
            <span className="text-3xl text-white/60">›</span>
          </div>
          
          {/* Loading indicator */}
          {generating === 'football' && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-[20px]">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </motion.button>

        {/* NBA Card */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => generatePicksForSport('basketball')}
          disabled={generating !== null}
          className="w-full rounded-[20px] overflow-hidden relative"
          style={{ 
            height: '110px',
            background: 'linear-gradient(135deg, #C94A1A 0%, #E74C3C 100%)'
          }}
        >
          {/* Background ball image effect */}
          <div 
            className="absolute right-[-20px] bottom-[-10px] w-[130px] h-[130px] opacity-25 pointer-events-none"
            style={{ 
              background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='35' fill='%23D35420' stroke='%23ffffff' stroke-width='2'/%3E%3Cpath d='M50 30 L70 50 L50 70 L30 50' fill='none' stroke='%23ffffff' stroke-width='2'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundSize: 'contain'
            }}
          />
          
          {/* Content */}
          <div className="relative z-10 flex items-center p-5">
            {/* Icon */}
            <div 
              className="w-12 h-12 rounded-[14px] flex items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <span className="text-2xl">🏀</span>
            </div>
            
            {/* Text */}
            <div className="flex-1 ml-4">
              <p className="text-xl font-bold text-white">NBA + Player Props</p>
              <p className="text-[13px] text-white/85">Puntos, rebotes, asistencias</p>
            </div>
            
            {/* Arrow */}
            <span className="text-3xl text-white/60">›</span>
          </div>
          
          {/* Loading indicator */}
          {generating === 'basketball' && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-[20px]">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </motion.button>

        {/* MLB Card */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => generatePicksForSport('baseball')}
          disabled={generating !== null}
          className="w-full rounded-[20px] overflow-hidden relative"
          style={{ 
            height: '110px',
            background: 'linear-gradient(135deg, #2B4FBF 0%, #3498DB 100%)'
          }}
        >
          {/* Background ball image effect */}
          <div 
            className="absolute right-[-20px] bottom-[-10px] w-[130px] h-[130px] opacity-25 pointer-events-none"
            style={{ 
              background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='30' fill='none' stroke='%23ffffff' stroke-width='2'/%3E%3Cpath d='M50 25 L50 35 M35 50 L50 65 M65 50' stroke='%23ffffff' stroke-width='1.5'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundSize: 'contain'
            }}
          />
          
          {/* Content */}
          <div className="relative z-10 flex items-center p-5">
            {/* Icon */}
            <div 
              className="w-12 h-12 rounded-[14px] flex items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <span className="text-2xl">🏆</span>
            </div>
            
            {/* Text */}
            <div className="flex-1 ml-4">
              <p className="text-xl font-bold text-white">MLB</p>
              <p className="text-[13px] text-white/85">Run lines, totales</p>
            </div>
            
            {/* Arrow */}
            <span className="text-3xl text-white/60">›</span>
          </div>
          
          {/* Loading indicator */}
          {generating === 'baseball' && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-[20px]">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </motion.button>
      </div>

      {/* Generate Result Message */}
      <AnimatePresence>
        {generateResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-xl text-sm ${
              generateResult.success 
                ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                : 'bg-red-500/10 text-red-500 border border-red-500/20'
            }`}
          >
            {generateResult.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Last Update */}
      {lastUpdate && (
        <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
          Última actualización: {lastUpdate.toLocaleTimeString('es-ES')}
        </div>
      )}

      {/* Picks List */}
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {picks.length === 0 ? (
            <div className="text-center py-12">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
              >
                {!hasLoaded ? (
                  <Sparkles className="w-8 h-8" style={{ color: 'var(--color-accent-primary)' }} />
                ) : (
                  <Shield className="w-8 h-8" style={{ color: 'var(--color-accent-primary)' }} />
                )}
              </div>
              {!hasLoaded ? (
                <>
                  <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Selecciona un deporte para analizar
                  </p>
                  <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
                    Pulsa uno de los botones de arriba para generar picks automáticamente con IA.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Sin picks de calidad hoy
                  </p>
                  <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
                    El sistema es estricto para proteger tu bankroll. Vuelve mañana para nuevas oportunidades.
                  </p>
                </>
              )}
            </div>
          ) : (
            picks.map((pick, index) => (
              <motion.div
                key={pick.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <PickCard pick={pick} />
              </motion.div>
            ))
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
