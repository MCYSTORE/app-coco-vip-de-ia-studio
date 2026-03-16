import React, { useState, useEffect } from 'react';
import { Prediction, calculateLineMovement, calculateKellyStake, deriveWinProbabilityFromEdge, getBankroll } from '../types';
import { History as HistoryIcon, Trophy, CheckCircle, XCircle, Clock, ChevronDown, Trash2, TrendingUp, TrendingDown, BarChart3, Target, Zap, RefreshCw, ArrowUp, ArrowDown, Minus, Calculator, Wallet, Percent } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY = 'coco_vip_predictions';

export default function History() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<'all' | 'pending' | 'won' | 'lost'>('all');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

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

  const refreshOdds = async (predictionId: string) => {
    if (refreshingId) return;
    
    setRefreshingId(predictionId);
    try {
      const prediction = predictions.find(p => p.id === predictionId);
      if (!prediction) return;
      
      const response = await fetch('/api/refresh-odds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pick: prediction })
      });
      
      const data = await response.json();
      
      if (data.success && data.pick) {
        const updated = predictions.map(p => 
          p.id === data.pick.id ? data.pick : p
        );
        savePredictions(updated);
      }
    } catch (error) {
      console.error("Error refreshing odds:", error);
    } finally {
      setRefreshingId(null);
    }
  };

  const getMovementIcon = (direction: 'up' | 'down' | 'stable') => {
    switch (direction) {
      case 'up': return <ArrowUp className="w-3 h-3" />;
      case 'down': return <ArrowDown className="w-3 h-3" />;
      default: return <Minus className="w-3 h-3" />;
    }
  };

  const getMovementColor = (direction: 'up' | 'down' | 'stable') => {
    switch (direction) {
      case 'up': return 'var(--color-success)';
      case 'down': return 'var(--color-danger)';
      default: return 'var(--color-text-secondary)';
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-accent-primary)' }}></div>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="text-center py-20 px-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
          <HistoryIcon className="w-8 h-8" style={{ color: 'var(--color-text-muted)' }} />
        </div>
        <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>No hay historial</h3>
        <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>Tus análisis se guardarán aquí automáticamente.</p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Usa la pestaña Analysis para crear predicciones</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Historial</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
            {predictions.length} ANÁLISIS
          </span>
          {predictions.length > 0 && (
            <button
              onClick={clearHistory}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--color-danger)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-danger-bg)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Borrar historial"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{stats.total}</div>
          <div className="text-[9px] uppercase font-bold" style={{ color: 'var(--color-text-muted)' }}>Total</div>
        </div>
        <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: 'var(--color-success-bg)', borderColor: 'rgba(22, 163, 74, 0.2)' }}>
          <div className="text-xl font-bold" style={{ color: 'var(--color-success)' }}>{stats.won}</div>
          <div className="text-[9px] uppercase font-bold" style={{ color: 'var(--color-success)' }}>Ganados</div>
        </div>
        <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'rgba(220, 38, 38, 0.2)' }}>
          <div className="text-xl font-bold" style={{ color: 'var(--color-danger)' }}>{stats.lost}</div>
          <div className="text-[9px] uppercase font-bold" style={{ color: 'var(--color-danger)' }}>Perdidos</div>
        </div>
        <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'rgba(24, 24, 27, 0.2)' }}>
          <div className="text-xl font-bold" style={{ color: 'var(--color-accent-primary)' }}>{stats.winRate.toFixed(0)}%</div>
          <div className="text-[9px] uppercase font-bold" style={{ color: 'var(--color-accent-primary)' }}>Win Rate</div>
        </div>
      </div>

      {/* Profit Timeline Chart */}
      {profitTimeline.length > 1 && (
        <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <TrendingUp className="w-4 h-4" style={{ color: 'var(--color-accent-primary)' }} />
              Profit Acumulado
            </h3>
            <div className="text-sm font-bold flex items-center gap-1" style={{ color: profitTimeline[profitTimeline.length - 1]?.profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {profitTimeline[profitTimeline.length - 1]?.profit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {profitTimeline[profitTimeline.length - 1]?.profit >= 0 ? '+' : ''}{profitTimeline[profitTimeline.length - 1]?.profit.toFixed(2)}u
            </div>
          </div>
          
          {/* SVG Line Chart */}
          <div className="h-32 relative">
            <svg viewBox="0 0 300 100" className="w-full h-full" preserveAspectRatio="none">
              {/* Grid lines */}
              <line x1="0" y1="50" x2="300" y2="50" stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="4" />
              
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
                const lineColor = lastProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
                const areaFill = lastProfit >= 0 ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)';
                
                return (
                  <>
                    {/* Area fill */}
                    <polygon 
                      points={`0,50 ${points} 300,50`}
                      fill={areaFill}
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
            <div className="flex justify-between text-[9px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
              <span>Inicio</span>
              <span>{profitTimeline.length} apuestas</span>
            </div>
          </div>
        </div>
      )}

      {/* Performance by Sport */}
      {sportStats.length > 0 && (
        <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--color-text-primary)' }}>
            <BarChart3 className="w-4 h-4" style={{ color: 'var(--color-accent-primary)' }} />
            Rendimiento por Deporte
          </h3>
          
          <div className="space-y-3">
            {sportStats.map((s) => (
              <div key={s.sport} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                    <span>{getSportEmoji(s.sport)}</span>
                    {s.sport}
                  </span>
                  <div className="flex items-center gap-3">
                    <span style={{ color: 'var(--color-text-secondary)' }}>{s.won}W-{s.lost}L</span>
                    <span className="font-bold" style={{ color: s.profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {s.profit >= 0 ? '+' : ''}{s.profit.toFixed(1)}u
                    </span>
                  </div>
                </div>
                {/* Win rate bar */}
                <div className="h-2 rounded-full overflow-hidden flex" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${s.winRate}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full"
                    style={{ backgroundColor: 'var(--color-success)' }}
                  />
                  {s.winRate < 100 && s.won + s.lost > 0 && (
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${100 - s.winRate}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="h-full"
                      style={{ backgroundColor: 'var(--color-danger)' }}
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
        <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--color-text-primary)' }}>
            <Target className="w-4 h-4" style={{ color: 'var(--color-accent-primary)' }} />
            Distribución de Confianza
          </h3>
          
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl p-3 text-center border" style={{ backgroundColor: 'var(--color-success-bg)', borderColor: 'rgba(22, 163, 74, 0.2)' }}>
              <div className="text-xl font-bold" style={{ color: 'var(--color-success)' }}>{confidenceDistribution.high}</div>
              <div className="text-[9px] uppercase font-bold" style={{ color: 'var(--color-success)' }}>Alta (8-10)</div>
              <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(22, 163, 74, 0.2)' }}>
                <div className="h-full" style={{ width: `${(confidenceDistribution.high / predictions.length) * 100}%`, backgroundColor: 'var(--color-success)' }} />
              </div>
            </div>
            <div className="flex-1 rounded-xl p-3 text-center border" style={{ backgroundColor: 'var(--color-warning-bg)', borderColor: 'rgba(217, 119, 6, 0.2)' }}>
              <div className="text-xl font-bold" style={{ color: 'var(--color-warning)' }}>{confidenceDistribution.medium}</div>
              <div className="text-[9px] uppercase font-bold" style={{ color: 'var(--color-warning)' }}>Media (6-7)</div>
              <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(217, 119, 6, 0.2)' }}>
                <div className="h-full" style={{ width: `${(confidenceDistribution.medium / predictions.length) * 100}%`, backgroundColor: 'var(--color-warning)' }} />
              </div>
            </div>
            <div className="flex-1 rounded-xl p-3 text-center border" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'rgba(220, 38, 38, 0.2)' }}>
              <div className="text-xl font-bold" style={{ color: 'var(--color-danger)' }}>{confidenceDistribution.low}</div>
              <div className="text-[9px] uppercase font-bold" style={{ color: 'var(--color-danger)' }}>Baja (1-5)</div>
              <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(220, 38, 38, 0.2)' }}>
                <div className="h-full" style={{ width: `${(confidenceDistribution.low / predictions.length) * 100}%`, backgroundColor: 'var(--color-danger)' }} />
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
              className="rounded-2xl p-4 text-white"
              style={{ background: 'linear-gradient(to right, var(--color-warning), color-mix(in srgb, var(--color-warning) 70%, black))' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
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
                ? 'text-white'
                : 'border'
            )}
            style={activeStatus === status 
              ? { backgroundColor: status === 'won' ? 'var(--color-success)' : status === 'lost' ? 'var(--color-danger)' : status === 'pending' ? 'var(--color-text-muted)' : 'var(--color-accent-primary)' }
              : { backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }
            }
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
          {filteredPredictions.map((bet, index) => {
            // Calculate line movement for this prediction
            const lineMovement = calculateLineMovement(
              bet.currentOdd || bet.odds,
              bet.openingOdd || bet.odds
            );
            const hasLineMovement = lineMovement.direction !== 'stable';
            const isRefreshing = refreshingId === bet.id;
            
            return (
              <motion.div
                key={bet.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.03 }}
                className={cn(
                  "rounded-2xl p-4 border-l-4 transition-all border",
                  bet.status === 'won' ? "border-l-[var(--color-success)]" : 
                  bet.status === 'lost' ? "border-l-[var(--color-danger)]" : "border-l-[var(--color-text-muted)]"
                )}
                style={{ 
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border)',
                  borderLeftColor: bet.status === 'won' ? 'var(--color-success)' : bet.status === 'lost' ? 'var(--color-danger)' : 'var(--color-text-muted)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getSportEmoji(bet.sport)}</span>
                    <span className="text-[11px] font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>{bet.sport}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusDropdown 
                      status={bet.status} 
                      onStatusChange={(newStatus) => updateStatus(bet.id, newStatus)} 
                    />
                    <button
                      onClick={() => deletePrediction(bet.id)}
                      className="p-1 transition-colors"
                      style={{ color: 'var(--color-text-muted)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h4 className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{bet.matchName}</h4>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      <strong style={{ color: 'var(--color-accent-primary)' }}>{bet.selection}</strong> @ {bet.odds?.toFixed(2) || '1.85'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg" style={{ color: 'var(--color-success)' }}>+{bet.edgePercent?.toFixed(1) || '8.5'}%</div>
                    <div className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Edge</div>
                  </div>
                </div>

                {/* Line Movement Display */}
                {hasLineMovement && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-3 rounded-xl p-2.5 border"
                    style={{ 
                      backgroundColor: lineMovement.direction === 'up' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                      borderColor: lineMovement.direction === 'up' ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.2)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: lineMovement.direction === 'up' ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.2)', color: lineMovement.direction === 'up' ? 'var(--color-success)' : 'var(--color-danger)' }}
                        >
                          {getMovementIcon(lineMovement.direction)}
                        </div>
                        <div className="text-xs">
                          <span style={{ color: lineMovement.direction === 'up' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {bet.openingOdd?.toFixed(2)} → {bet.currentOdd?.toFixed(2)}
                          </span>
                          <span 
                            className="ml-2 font-bold px-1.5 py-0.5 rounded text-[10px]"
                            style={{ 
                              backgroundColor: lineMovement.direction === 'up' ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.2)',
                              color: lineMovement.direction === 'up' ? 'var(--color-success)' : 'var(--color-danger)'
                            }}
                          >
                            {lineMovement.percent > 0 ? '+' : ''}{lineMovement.percent}%
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => refreshOdds(bet.id)}
                        disabled={isRefreshing}
                        className="p-1 rounded transition-colors"
                        style={{ backgroundColor: 'transparent' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.5)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Actualizar cuota"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} style={{ color: 'var(--color-text-secondary)' }} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Confidence Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span style={{ color: 'var(--color-text-muted)' }}>Confianza</span>
                    <span className="font-bold" style={{ color: 'var(--color-text-secondary)' }}>{bet.confidence || 7}/10</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${(bet.confidence || 7) * 10}%`,
                        backgroundColor: (bet.confidence || 7) >= 8 ? 'var(--color-success)' : (bet.confidence || 7) >= 6 ? 'var(--color-warning)' : 'var(--color-danger)'
                      }}
                    ></div>
                  </div>
                </div>

                {/* Kelly Criterion mini display */}
                {(() => {
                  const bankroll = getBankroll();
                  const winProb = deriveWinProbabilityFromEdge(bet.odds || 1.85, bet.edgePercent || 8);
                  const kelly = calculateKellyStake(bet.odds || 1.85, winProb, bankroll);
                  
                  if (kelly.hasPositiveEdge) {
                    return (
                      <div className="mb-3 rounded-xl p-2.5 border" style={{ backgroundColor: 'rgba(24, 24, 27, 0.05)', borderColor: 'rgba(24, 24, 27, 0.1)' }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calculator className="w-3.5 h-3.5" style={{ color: 'var(--color-accent-primary)' }} />
                            <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>Kelly 1/2 sugerido:</span>
                          </div>
                          <span className="text-xs font-bold" style={{ color: 'var(--color-accent-primary)' }}>
                            {kelly.stakeHalf.toFixed(1)} uds
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="mt-3 pt-3 flex justify-between items-center text-[11px]" style={{ borderTopColor: 'var(--color-bg-secondary)', borderTopWidth: '1px', borderTopStyle: 'solid' }}>
                  <span className="flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                    <Clock className="w-3 h-3" />
                    {bet.createdAt ? format(new Date(bet.createdAt), 'MMM d, HH:mm') : 'Reciente'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--color-text-muted)' }}>{bet.bookmaker || 'General'}</span>
                    {!hasLineMovement && bet.status === 'pending' && (
                      <button
                        onClick={() => refreshOdds(bet.id)}
                        disabled={isRefreshing}
                        className="p-1 rounded transition-colors"
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Actualizar cuota"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} style={{ color: 'var(--color-text-secondary)' }} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Status Dropdown Component
function StatusDropdown({ status, onStatusChange }: { status: string, onStatusChange: (s: 'pending' | 'won' | 'lost') => void }) {
  const [open, setOpen] = useState(false);

  const statusConfig = {
    pending: { label: 'Pendiente', icon: Clock, bg: 'var(--color-bg-secondary)', text: 'var(--color-text-muted)' },
    won: { label: 'Ganado', icon: CheckCircle, bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
    lost: { label: 'Perdido', icon: XCircle, bg: 'var(--color-danger-bg)', text: 'var(--color-danger)' }
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
              className="absolute right-0 top-full mt-1 rounded-xl shadow-lg border overflow-hidden z-20 min-w-[120px]"
              style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
            >
              {(['pending', 'won', 'lost'] as const).map((s) => {
                const c = statusConfig[s];
                const I = c.icon;
                return (
                  <button
                    key={s}
                    onClick={() => { onStatusChange(s); setOpen(false); }}
                    className={cn(
                      "w-full px-4 py-2.5 text-left text-xs font-medium flex items-center gap-2 transition-colors"
                    )}
                    style={{ 
                      backgroundColor: status === s ? 'var(--color-bg-secondary)' : 'transparent',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = status === s ? 'var(--color-bg-secondary)' : 'transparent'}
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
