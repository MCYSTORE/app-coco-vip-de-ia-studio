import React, { useState } from 'react';
import PickCard from '../components/PickCard';
import { Prediction } from '../types';
import { Loader2, RefreshCw, Filter, Zap, Clock, TrendingUp, Radar, ChevronRight, Sparkles, Bot, User, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PicksProps {
  onOpenScanner?: () => void;
}

export default function Picks({ onOpenScanner }: PicksProps) {
  const [picks, setPicks] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'upcoming' | 'auto'>('all');
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

  const generateDailyPicks = async () => {
    setGenerating(true);
    setGenerateResult(null);
    
    try {
      const response = await fetch('/api/generate-daily-picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Handle the "no quality picks" message
        if (data.message && data.picks_generated === 0) {
          setGenerateResult({
            success: false,
            message: data.message
          });
        } else if (data.picks_generated > 0) {
          setGenerateResult({
            success: true,
            message: `¡${data.picks_generated} pick${data.picks_generated > 1 ? 's' : ''} de calidad generados!`
          });
        } else {
          setGenerateResult({
            success: false,
            message: data.message || 'No se encontraron picks de calidad'
          });
        }
        // Refresh picks after generation
        await fetchPicks();
      } else {
        setGenerateResult({
          success: false,
          message: data.message || 'Error al generar picks'
        });
      }
    } catch (error: any) {
      setGenerateResult({
        success: false,
        message: error.message || 'Error de conexión'
      });
    } finally {
      setGenerating(false);
    }
  };

  // No auto-fetch - user must click button to load picks

  const filteredPicks = picks.filter(pick => {
    if (activeFilter === 'live') return pick.isLive;
    if (activeFilter === 'upcoming') return !pick.isLive;
    if (activeFilter === 'auto') return pick.source === 'daily_auto';
    return true;
  });

  const liveCount = picks.filter(p => p.isLive).length;
  const autoCount = picks.filter(p => p.source === 'daily_auto').length;

  if (loading && picks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-10 h-10 text-[var(--color-accent-primary)]" />
        </motion.div>
        <p className="text-[var(--color-text-secondary)] font-medium mt-4">Analizando mercados en tiempo real...</p>
        <p className="text-[var(--color-text-muted)] text-sm mt-1">Conectando con API-Sports</p>
      </div>
    );
  }

  // Show initial state with button to load picks
  if (!hasLoaded && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Top Picks</h2>
            <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Mejores oportunidades detectadas
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="bg-[var(--color-bg-secondary)] w-20 h-20 rounded-full flex items-center justify-center mb-4">
            <TrendingUp className="w-10 h-10 text-[var(--color-accent-primary)]" />
          </div>
          <p className="text-[var(--color-text-primary)] font-semibold text-lg">Obtener Top Picks</p>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1 mb-6">Pulsa el botón para analizar los mercados</p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={fetchPicks}
            className="btn-primary px-6 py-3 rounded-xl font-semibold flex items-center gap-2"
          >
            <Zap className="w-5 h-5" />
            Analizar Mercados
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Top Picks</h2>
          <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Mejores oportunidades detectadas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPicks}
            disabled={loading}
            className="p-2 text-[var(--color-accent-primary)] hover:bg-[var(--color-bg-secondary)] rounded-full transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Generate Daily Picks Button */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={generateDailyPicks}
        disabled={generating}
        className="w-full bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] text-white p-4 rounded-2xl flex items-center justify-between shadow-lg disabled:opacity-50"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            {generating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
          </div>
          <div className="text-left">
            <p className="font-bold">{generating ? 'Generando picks...' : 'Generar Picks de Hoy'}</p>
            <p className="text-xs text-white/70">Hasta 3 picks de alta calidad con DeepSeek AI</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-white/60" />
      </motion.button>

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

      {/* Stats Bar */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        <motion.div 
          whileTap={{ scale: 0.95 }}
          onClick={() => setActiveFilter('all')}
          className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium text-sm transition-all cursor-pointer ${
            activeFilter === 'all' 
              ? 'pill-active' 
              : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'
          }`}
        >
          Todos ({picks.length})
        </motion.div>
        <motion.div 
          whileTap={{ scale: 0.95 }}
          onClick={() => setActiveFilter('live')}
          className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium text-sm transition-all cursor-pointer flex items-center gap-2 ${
            activeFilter === 'live' 
              ? 'pill-danger' 
              : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'
          }`}
        >
          <Zap className="w-3 h-3" />
          En Vivo ({liveCount})
        </motion.div>
        <motion.div 
          whileTap={{ scale: 0.95 }}
          onClick={() => setActiveFilter('upcoming')}
          className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium text-sm transition-all cursor-pointer flex items-center gap-2 ${
            activeFilter === 'upcoming' 
              ? 'pill-success' 
              : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'
          }`}
        >
          <Clock className="w-3 h-3" />
          Próximos
        </motion.div>
        <motion.div 
          whileTap={{ scale: 0.95 }}
          onClick={() => setActiveFilter('auto')}
          className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium text-sm transition-all cursor-pointer flex items-center gap-2 ${
            activeFilter === 'auto' 
              ? 'bg-purple-500 text-white' 
              : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'
          }`}
        >
          <Bot className="w-3 h-3" />
          Auto ({autoCount})
        </motion.div>
      </div>

      {/* Last Update */}
      {lastUpdate && (
        <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Última actualización: {lastUpdate.toLocaleTimeString('es-ES')}
        </div>
      )}

      {/* Open Scanner Button */}
      {onOpenScanner && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onOpenScanner}
          className="w-full bg-gradient-to-r from-[#1C1C1E] to-[#3A3A3C] text-white p-4 rounded-2xl flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--color-accent-primary)] rounded-xl flex items-center justify-center">
              <Radar className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-bold">Escáner de Value Bets</p>
              <p className="text-xs text-white/60">Radar de oportunidades en tiempo real</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/60" />
        </motion.button>
      )}

      {/* Picks List */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeFilter}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {filteredPicks.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-[var(--color-bg-secondary)] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="text-[var(--color-accent-primary)] w-8 h-8" />
              </div>
              <p className="text-[var(--color-text-primary)] font-semibold">Sin picks de calidad hoy</p>
              <p className="text-[var(--color-text-secondary)] text-sm mt-2 max-w-xs mx-auto">
                El sistema es estricto para proteger tu bankroll. Vuelve mañana para nuevas oportunidades.
              </p>
            </div>
          ) : (
            filteredPicks.map((pick, index) => (
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

      {/* Live Indicator */}
      {liveCount > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1C1C1E] text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2"
        >
          <span className="w-2 h-2 bg-[var(--color-danger)] rounded-full animate-pulse"></span>
          {liveCount} evento{liveCount !== 1 ? 's' : ''} en vivo
        </motion.div>
      )}
    </div>
  );
}
