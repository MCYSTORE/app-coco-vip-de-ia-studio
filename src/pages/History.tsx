import React, { useState, useEffect } from 'react';
import { Prediction } from '../types';
import { History as HistoryIcon, Trophy, CheckCircle, XCircle, Clock, ChevronDown, Trash2, TrendingUp, TrendingDown, BarChart3, Target, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY = 'coco_vip_predictions';

export default function History() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<'all' | 'pending' | 'won' | 'lost'>('all');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPredictions(JSON.parse(stored));
      } catch (e) {
        console.error("Error loading predictions:", e);
      }
    }
    setLoading(false);
  }, []);

  const savePredictions = (newPredictions: Prediction[]) => {
    setPredictions(newPredictions);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPredictions));
  };

  const updateStatus = (id: string, newStatus: 'pending' | 'won' | 'lost') => {
    const updated = predictions.map(p => 
      p.id === id ? { ...p, status: newStatus } : p
    );
    savePredictions(updated);
  };

  const deletePrediction = (id: string) => {
    const filtered = predictions.filter(p => p.id !== id);
    savePredictions(filtered);
  };

  const clearHistory = () => {
    if (confirm('¿Estás seguro de que quieres borrar todo el historial?')) {
      savePredictions([]);
    }
  };

  const filteredPredictions = predictions.filter(p => {
    if (activeStatus === 'all') return true;
    return p.status === activeStatus;
  });

  const stats = {
    total: predictions.length,
    won: predictions.filter(p => p.status === 'won').length,
    lost: predictions.filter(p => p.status === 'lost').length,
    pending: predictions.filter(p => p.status === 'pending').length,
    winRate: 0
  };

  const settled = stats.won + stats.lost;
  stats.winRate = settled > 0 ? (stats.won / settled) * 100 : 0;

  // Calculate profit timeline for chart
  const profitTimeline = (() => {
    const sorted = [...predictions]
      .filter(p => p.status === 'won' || p.status === 'lost')
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    
    let cumulative = 0;
    return sorted.map(p => {
      if (p.status === 'won') {
        cumulative += (p.odds || 1.85) - 1;
      } else {
        cumulative -= 1;
      }
      return {
        date: p.createdAt,
        profit: cumulative,
        match: p.matchName,
        status: p.status
      };
    });
  })();

  // Stats by sport
  const sportStats = (() => {
    const sports: Record<string, { total: number; won: number; lost: number; profit: number }> = {};
    
    predictions.forEach(p => {
      const sport = p.sport || 'Other';
      if (!sports[sport]) {
        sports[sport] = { total: 0, won: 0, lost: 0, profit: 0 };
      }
      sports[sport].total++;
      if (p.status === 'won') {
        sports[sport].won++;
        sports[sport].profit += (p.odds || 1.85) - 1;
      } else if (p.status === 'lost') {
        sports[sport].lost++;
        sports[sport].profit -= 1;
      }
    });
    
    return Object.entries(sports).map(([sport, data]) => ({
      sport,
      ...data,
      winRate: data.won + data.lost > 0 ? (data.won / (data.won + data.lost)) * 100 : 0
    }));
  })();

  // Confidence distribution
  const confidenceDistribution = (() => {
    const dist = { high: 0, medium: 0, low: 0 };
    predictions.forEach(p => {
      const c = p.confidence || 7;
      if (c >= 8) dist.high++;
      else if (c >= 6) dist.medium++;
      else dist.low++;
    });
    return dist;
  })();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5E5CE6]"></div>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="text-center py-20 px-6">
        <div className="bg-[#F5F5F7] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <HistoryIcon className="text-[#AEAEB2] w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-[#1D1D1F]">No hay historial</h3>
        <p className="text-[#6E6E73] text-sm mt-2">Tus análisis se guardarán aquí automáticamente.</p>
        <p className="text-[#AEAEB2] text-xs mt-1">Usa la pestaña Analysis para crear predicciones</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-[#1D1D1F]">Historial</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#AEAEB2] uppercase tracking-widest">
            {predictions.length} ANÁLISIS
          </span>
          {predictions.length > 0 && (
            <button
              onClick={clearHistory}
              className="p-1.5 text-[#FF3B30] hover:bg-[#FFF1F0] rounded-lg transition-colors"
              title="Borrar historial"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-xl p-3 text-center border border-[#E5E5EA]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div className="text-xl font-bold text-[#1D1D1F]">{stats.total}</div>
          <div className="text-[9px] text-[#AEAEB2] uppercase font-bold">Total</div>
        </div>
        <div className="bg-[#F0FFF4] rounded-xl p-3 text-center border border-[#34C759]/20">
          <div className="text-xl font-bold text-[#34C759]">{stats.won}</div>
          <div className="text-[9px] text-[#34C759] uppercase font-bold">Ganados</div>
        </div>
        <div className="bg-[#FFF1F0] rounded-xl p-3 text-center border border-[#FF3B30]/20">
          <div className="text-xl font-bold text-[#FF3B30]">{stats.lost}</div>
          <div className="text-[9px] text-[#FF3B30] uppercase font-bold">Perdidos</div>
        </div>
        <div className="bg-[#EEEEFF] rounded-xl p-3 text-center border border-[#5E5CE6]/20">
          <div className="text-xl font-bold text-[#5E5CE6]">{stats.winRate.toFixed(0)}%</div>
          <div className="text-[9px] text-[#5E5CE6] uppercase font-bold">Win Rate</div>
        </div>
      </div>

      {/* Profit Timeline Chart */}
      {profitTimeline.length > 1 && (
        <div className="bg-white rounded-2xl p-4 border border-[#E5E5EA]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#5E5CE6]" />
              Profit Acumulado
            </h3>
            <div className={`text-sm font-bold flex items-center gap-1 ${profitTimeline[profitTimeline.length - 1]?.profit >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
              {profitTimeline[profitTimeline.length - 1]?.profit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {profitTimeline[profitTimeline.length - 1]?.profit >= 0 ? '+' : ''}{profitTimeline[profitTimeline.length - 1]?.profit.toFixed(2)}u
            </div>
          </div>
          
          {/* SVG Line Chart */}
          <div className="h-32 relative">
            <svg viewBox="0 0 300 100" className="w-full h-full" preserveAspectRatio="none">
              {/* Grid lines */}
              <line x1="0" y1="50" x2="300" y2="50" stroke="#E5E5EA" strokeWidth="0.5" strokeDasharray="4" />
              
              {/* Profit line */}
              {(() => {
                const maxProfit = Math.max(...profitTimeline.map(p => p.profit), 0);
                const minProfit = Math.min(...profitTimeline.map(p => p.profit), 0);
                const range = Math.max(Math.abs(maxProfit), Math.abs(minProfit), 1) * 2;
                const midY = 50;
                
                const points = profitTimeline.map((p, i) => {
                  const x = (i / (profitTimeline.length - 1)) * 300;
                  const y = midY - (p.profit / range) * 45;
                  return `${x},${y}`;
                }).join(' ');
                
                const lastProfit = profitTimeline[profitTimeline.length - 1]?.profit || 0;
                const lineColor = lastProfit >= 0 ? '#34C759' : '#FF3B30';
                
                return (
                  <>
                    {/* Area fill */}
                    <polygon 
                      points={`0,50 ${points} 300,50`}
                      fill={lastProfit >= 0 ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)'}
                    />
                    {/* Line */}
                    <polyline 
                      points={points}
                      fill="none"
                      stroke={lineColor}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* End dot */}
                    <circle 
                      cx="300" 
                      cy={midY - (lastProfit / range) * 45}
                      r="4"
                      fill={lineColor}
                    />
                  </>
                );
              })()}
            </svg>
            
            {/* X-axis labels */}
            <div className="flex justify-between text-[9px] text-[#AEAEB2] mt-1">
              <span>Inicio</span>
              <span>{profitTimeline.length} apuestas</span>
            </div>
          </div>
        </div>
      )}

      {/* Performance by Sport */}
      {sportStats.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-[#E5E5EA]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[#5E5CE6]" />
            Rendimiento por Deporte
          </h3>
          
          <div className="space-y-3">
            {sportStats.map((s) => (
              <div key={s.sport} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#1D1D1F] flex items-center gap-1.5">
                    <span>{getSportEmoji(s.sport)}</span>
                    {s.sport}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[#6E6E73]">{s.won}W-{s.lost}L</span>
                    <span className={`font-bold ${s.profit >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                      {s.profit >= 0 ? '+' : ''}{s.profit.toFixed(1)}u
                    </span>
                  </div>
                </div>
                {/* Win rate bar */}
                <div className="h-2 bg-[#F5F5F7] rounded-full overflow-hidden flex">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${s.winRate}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full bg-[#34C759]"
                  />
                  {s.winRate < 100 && s.won + s.lost > 0 && (
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${100 - s.winRate}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="h-full bg-[#FF3B30]"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence Distribution */}
      {predictions.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-[#E5E5EA]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-[#5E5CE6]" />
            Distribución de Confianza
          </h3>
          
          <div className="flex gap-2">
            <div className="flex-1 bg-[#F0FFF4] rounded-xl p-3 text-center border border-[#34C759]/20">
              <div className="text-xl font-bold text-[#34C759]">{confidenceDistribution.high}</div>
              <div className="text-[9px] text-[#34C759] uppercase font-bold">Alta (8-10)</div>
              <div className="mt-1 h-1 bg-[#34C759]/20 rounded-full overflow-hidden">
                <div className="h-full bg-[#34C759]" style={{ width: `${(confidenceDistribution.high / predictions.length) * 100}%` }} />
              </div>
            </div>
            <div className="flex-1 bg-[#FFF8F0] rounded-xl p-3 text-center border border-[#FF9500]/20">
              <div className="text-xl font-bold text-[#FF9500]">{confidenceDistribution.medium}</div>
              <div className="text-[9px] text-[#FF9500] uppercase font-bold">Media (6-7)</div>
              <div className="mt-1 h-1 bg-[#FF9500]/20 rounded-full overflow-hidden">
                <div className="h-full bg-[#FF9500]" style={{ width: `${(confidenceDistribution.medium / predictions.length) * 100}%` }} />
              </div>
            </div>
            <div className="flex-1 bg-[#FFF1F0] rounded-xl p-3 text-center border border-[#FF3B30]/20">
              <div className="text-xl font-bold text-[#FF3B30]">{confidenceDistribution.low}</div>
              <div className="text-[9px] text-[#FF3B30] uppercase font-bold">Baja (1-5)</div>
              <div className="mt-1 h-1 bg-[#FF3B30]/20 rounded-full overflow-hidden">
                <div className="h-full bg-[#FF3B30]" style={{ width: `${(confidenceDistribution.low / predictions.length) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hot Streak Indicator */}
      {(() => {
        const recentWins = predictions
          .filter(p => p.status === 'won' || p.status === 'lost')
          .slice(0, 5)
          .filter(p => p.status === 'won').length;
        
        if (recentWins >= 3) {
          return (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-[#FF9500] to-[#FF6B00] rounded-2xl p-4 text-white"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold">🔥 ¡Racha Ganadora!</div>
                  <div className="text-sm opacity-90">{recentWins} de las últimas 5 apuestas ganadas</div>
                </div>
              </div>
            </motion.div>
          );
        }
        return null;
      })()}

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {(['all', 'pending', 'won', 'lost'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setActiveStatus(status)}
            className={cn(
              "flex-shrink-0 px-4 py-2 rounded-xl font-medium text-sm transition-all",
              activeStatus === status 
                ? status === 'won' ? 'bg-[#34C759] text-white' :
                  status === 'lost' ? 'bg-[#FF3B30] text-white' :
                  status === 'pending' ? 'bg-[#636366] text-white' :
                  'bg-[#5E5CE6] text-white'
                : 'bg-white text-[#6E6E73] border border-[#E5E5EA] hover:border-[#C7C7CC]'
            )}
          >
            {status === 'all' ? 'Todos' : status === 'pending' ? 'Pendientes' : status === 'won' ? 'Ganados' : 'Perdidos'}
            {status !== 'all' && (
              <span className="ml-1 opacity-70">
                ({status === 'pending' ? stats.pending : status === 'won' ? stats.won : stats.lost})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Predictions List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredPredictions.map((bet, index) => (
            <motion.div
              key={bet.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: index * 0.03 }}
              className={cn(
                "bg-white rounded-2xl p-4 border-l-4 transition-all border border-[#E5E5EA]",
                bet.status === 'won' ? "border-l-[#34C759]" : 
                bet.status === 'lost' ? "border-l-[#FF3B30]" : "border-l-[#636366]"
              )}
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getSportEmoji(bet.sport)}</span>
                  <span className="text-[11px] font-bold text-[#AEAEB2] uppercase">{bet.sport}</span>
                </div>
                <div className="flex items-center gap-1">
                  <StatusDropdown 
                    status={bet.status} 
                    onStatusChange={(newStatus) => updateStatus(bet.id, newStatus)} 
                  />
                  <button
                    onClick={() => deletePrediction(bet.id)}
                    className="p-1 text-[#AEAEB2] hover:text-[#FF3B30] transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h4 className="font-bold text-[#1D1D1F]">{bet.matchName}</h4>
                  <p className="text-sm text-[#6E6E73]">
                    <strong className="text-[#5E5CE6]">{bet.selection}</strong> @ {bet.odds?.toFixed(2) || '1.85'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[#34C759] font-bold text-lg">+{bet.edgePercent?.toFixed(1) || '8.5'}%</div>
                  <div className="text-[10px] text-[#AEAEB2] font-medium">Edge</div>
                </div>
              </div>

              {/* Confidence Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-[#AEAEB2]">Confianza</span>
                  <span className="font-bold text-[#6E6E73]">{bet.confidence || 7}/10</span>
                </div>
                <div className="h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${(bet.confidence || 7) * 10}%`,
                      backgroundColor: (bet.confidence || 7) >= 8 ? '#34C759' : (bet.confidence || 7) >= 6 ? '#FF9500' : '#FF3B30'
                    }}
                  ></div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-[#F5F5F7] flex justify-between text-[11px]">
                <span className="text-[#AEAEB2] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {bet.createdAt ? format(new Date(bet.createdAt), 'MMM d, HH:mm') : 'Reciente'}
                </span>
                <span className="text-[#AEAEB2]">{bet.bookmaker || 'General'}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Status Dropdown Component
function StatusDropdown({ status, onStatusChange }: { status: string, onStatusChange: (s: 'pending' | 'won' | 'lost') => void }) {
  const [open, setOpen] = useState(false);

  const statusConfig = {
    pending: { label: 'Pendiente', icon: Clock, bg: '#F2F2F7', text: '#636366' },
    won: { label: 'Ganado', icon: CheckCircle, bg: '#F0FFF4', text: '#34C759' },
    lost: { label: 'Perdido', icon: XCircle, bg: '#FFF1F0', text: '#FF3B30' }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 transition-all"
        style={{ backgroundColor: config.bg, color: config.text }}
      >
        <Icon className="w-3 h-3" />
        {config.label}
        <ChevronDown className="w-3 h-3" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-[#E5E5EA] overflow-hidden z-20 min-w-[120px]"
            >
              {(['pending', 'won', 'lost'] as const).map((s) => {
                const c = statusConfig[s];
                const I = c.icon;
                return (
                  <button
                    key={s}
                    onClick={() => { onStatusChange(s); setOpen(false); }}
                    className={cn(
                      "w-full px-4 py-2.5 text-left text-xs font-medium flex items-center gap-2 hover:bg-[#F5F5F7] transition-colors",
                      status === s && "bg-[#F5F5F7]"
                    )}
                  >
                    <I className="w-3 h-3" style={{ color: c.text }} />
                    {c.label}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function getSportEmoji(sport: string): string {
  switch (sport?.toLowerCase()) {
    case 'football': return '⚽';
    case 'basketball': return '🏀';
    case 'baseball': return '⚾';
    default: return '🎯';
  }
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
