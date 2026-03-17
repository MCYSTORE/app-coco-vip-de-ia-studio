import React, { useState } from 'react';
import { Prediction, calculateExtraEdge, calculateLineMovement, calculateKellyStake, deriveWinProbabilityFromEdge, getBankroll } from '../types';
import { TrendingUp, Verified, Target, BookOpen, X, Clock, Flame, Zap, Building2, Bookmark, Check, ShoppingBag, ArrowUpRight, RefreshCw, ArrowUp, ArrowDown, Minus, Calculator, AlertTriangle, Info, Wallet, Percent, Shield, Bot, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY = 'coco_vip_predictions';

interface PickCardProps {
  pick: Prediction;
  onDetail?: (pick: Prediction) => void;
  onUpdate?: (pick: Prediction) => void;
}

export default function PickCard({ pick, onDetail, onUpdate }: PickCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPick, setCurrentPick] = useState<Prediction>(pick);
  
  // Calculate odds shopping data
  const hasBestOdd = currentPick.bestOdd && currentPick.bestOdd > currentPick.odds;
  const extraEdgePercent = hasBestOdd ? calculateExtraEdge(currentPick.bestOdd!, currentPick.odds) : 0;
  const numAlternativeBookmakers = currentPick.allOdds?.length ? currentPick.allOdds.length - 1 : 0;
  
  // Calculate line movement
  const lineMovement = calculateLineMovement(
    currentPick.currentOdd || currentPick.odds, 
    currentPick.openingOdd || currentPick.odds
  );
  const hasLineMovement = lineMovement.direction !== 'stable';

  const saveToHistory = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const existing: Prediction[] = stored ? JSON.parse(stored) : [];
      
      // Check if already saved
      if (existing.some(p => p.id === currentPick.id)) {
        setSaved(true);
        return;
      }
      
      const newPrediction: Prediction = {
        ...currentPick,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify([newPrediction, ...existing]));
      setSaved(true);
    } catch (error) {
      console.error("Error saving to history:", error);
    }
  };

  const refreshOdds = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      const response = await fetch('/api/refresh-odds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pick: currentPick })
      });
      
      const data = await response.json();
      
      if (data.success && data.pick) {
        setCurrentPick(data.pick);
        
        // Update in localStorage if saved
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const existing: Prediction[] = JSON.parse(stored);
          const updated = existing.map(p => 
            p.id === data.pick.id ? data.pick : p
          );
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        }
        
        // Notify parent component
        if (onUpdate) {
          onUpdate(data.pick);
        }
      }
    } catch (error) {
      console.error("Error refreshing odds:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const getSportEmoji = (sport: string) => {
    switch (sport.toLowerCase()) {
      case 'football': return '⚽';
      case 'basketball': return '🏀';
      case 'baseball': return '⚾';
      default: return '🎯';
    }
  };

  const getSportColor = (sport: string) => {
    switch (sport.toLowerCase()) {
      case 'football': return 'var(--color-success)';
      case 'basketball': return 'var(--color-warning)';
      case 'baseball': return '#007AFF'; // Keep baseball blue for sport-specific color
      default: return 'var(--color-accent-primary)';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 9) return 'var(--color-success)';
    if (confidence >= 7) return 'var(--color-warning)';
    return 'var(--color-text-secondary)';
  };

  const getMovementIcon = () => {
    switch (lineMovement.direction) {
      case 'up': return <ArrowUp className="w-3 h-3" />;
      case 'down': return <ArrowDown className="w-3 h-3" />;
      default: return <Minus className="w-3 h-3" />;
    }
  };

  const getMovementColor = () => {
    switch (lineMovement.direction) {
      case 'up': return 'var(--color-success)';
      case 'down': return 'var(--color-danger)';
      default: return 'var(--color-text-secondary)';
    }
  };

  return (
    <>
      <motion.div
        whileHover={{ y: -4 }}
        className="group flex flex-col overflow-hidden rounded-2xl transition-all hover:shadow-lg border border-[var(--color-border)]"
        style={{ backgroundColor: 'var(--color-bg-card)', boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' }}
      >
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#1C1C1E]">
          {!imageError ? (
            <img
              src={`https://picsum.photos/seed/${encodeURIComponent(currentPick.matchName)}/800/450`}
              alt={currentPick.matchName}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-60"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
            />
          ) : null}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Sport Badge */}
          <div 
            className="absolute top-3 left-3 px-3 py-1 rounded-full text-white text-xs font-bold flex items-center gap-1 shadow-lg"
            style={{ backgroundColor: getSportColor(currentPick.sport) }}
          >
            <span>{getSportEmoji(currentPick.sport)}</span>
            <span>{currentPick.sport}</span>
          </div>

          {/* Source Badge (Auto/Manual) */}
          {currentPick.source && (
            <div 
              className={`absolute top-3 ${currentPick.isLive ? 'right-24' : 'right-14'} px-2 py-1 rounded-full text-white text-[10px] font-bold flex items-center gap-1 shadow-lg`}
              style={{ backgroundColor: currentPick.source === 'daily_auto' ? '#8B5CF6' : 'var(--color-text-secondary)' }}
            >
              {currentPick.source === 'daily_auto' ? (
                <>
                  <Bot className="w-3 h-3" />
                  AUTO
                </>
              ) : (
                <>
                  <User className="w-3 h-3" />
                  MANUAL
                </>
              )}
            </div>
          )}

          {/* Live Badge */}
          {currentPick.isLive && (
            <div className={`absolute top-3 ${currentPick.source ? 'right-36' : 'right-14'} px-2 py-1 rounded-full bg-[var(--color-danger)] text-white text-[10px] font-bold flex items-center gap-1 animate-pulse`}>
              <Zap className="w-3 h-3" />
              LIVE
            </div>
          )}

          {/* Top Pick Badge */}
          {currentPick.confidence >= 9 && (
            <div className="absolute top-3 right-3 rounded-full bg-[var(--color-warning)] px-2 py-1 text-[10px] font-bold text-white shadow-lg flex items-center gap-1">
              <Flame className="w-3 h-3" />
              TOP PICK
            </div>
          )}

          {/* Match Name Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="text-lg font-bold text-white leading-tight drop-shadow-lg">{currentPick.matchName}</h2>
            {currentPick.league && (
              <p className="text-xs text-white/70 mt-1">{currentPick.league}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5" style={{ color: 'var(--color-success)' }}>
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-bold">+{currentPick.edgePercent.toFixed(1)}% Edge</span>
            </div>
            <div className="flex items-center gap-1" style={{ color: getConfidenceColor(currentPick.confidence) }}>
              <Verified className="w-4 h-4" />
              <span className="text-sm font-bold">{currentPick.confidence}/10</span>
            </div>
          </div>

          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2 text-[var(--color-text-secondary)] text-sm">
              <Target className="w-4 h-4 text-[var(--color-accent-primary)]" />
              <span><strong className="text-[var(--color-text-primary)]">{currentPick.selection}</strong></span>
            </div>
            
            {/* Line Movement Display */}
            {hasLineMovement && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-3 border"
                style={{ 
                  backgroundColor: lineMovement.direction === 'up' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                  borderColor: lineMovement.direction === 'up' ? 'rgba(52,199,89,0.2)' : 'rgba(255,59,48,0.2)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: getMovementColor() + '20' }}
                    >
                      <span style={{ color: getMovementColor() }}>{getMovementIcon()}</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase" style={{ color: getMovementColor() }}>
                        Line Movement
                      </span>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-[var(--color-text-secondary)]">
                          {currentPick.openingOdd?.toFixed(2)} → <strong style={{ color: getMovementColor() }}>{currentPick.currentOdd?.toFixed(2)}</strong>
                        </span>
                        <span 
                          className="font-bold text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: getMovementColor() + '20', color: getMovementColor() }}
                        >
                          {lineMovement.percent > 0 ? '+' : ''}{lineMovement.percent}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={refreshOdds}
                    disabled={refreshing}
                    className="p-2 rounded-lg border border-[var(--color-border)] transition-colors"
                    style={{ backgroundColor: 'var(--color-bg-card)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-card)'}
                    title="Actualizar cuota"
                  >
                    <RefreshCw className={`w-4 h-4 text-[var(--color-text-secondary)] ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </motion.div>
            )}
            
            {/* Odds Shopping Display */}
            {hasBestOdd ? (
              <div className="bg-[var(--color-success-bg)] rounded-xl p-3 border border-[var(--color-success)]/20">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-[var(--color-success)]" />
                    <span className="text-xs font-bold text-[var(--color-success)] uppercase">Mejor cuota disponible</span>
                  </div>
                  {!hasLineMovement && (
                    <button
                      onClick={refreshOdds}
                      disabled={refreshing}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ backgroundColor: 'transparent' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(52,199,89,0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      title="Actualizar cuotas"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[var(--color-success)] ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-[var(--color-text-primary)]">{currentPick.bestOdd?.toFixed(2)}</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">en {currentPick.bestBookmaker}</span>
                </div>
                {extraEdgePercent > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowUpRight className="w-3 h-3 text-[var(--color-success)]" />
                    <span className="text-xs font-medium text-[var(--color-success)]">
                      +{extraEdgePercent.toFixed(1)}% edge extra vs cuota base
                    </span>
                  </div>
                )}
                {numAlternativeBookmakers > 0 && (
                  <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                    {numAlternativeBookmakers} otra{numAlternativeBookmakers > 1 ? 's' : ''} casa{numAlternativeBookmakers > 1 ? 's' : ''} disponible{numAlternativeBookmakers > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between text-[var(--color-text-secondary)] text-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[var(--color-accent-primary)]" />
                  <span>Cuota: <strong className="text-[var(--color-text-primary)]">{currentPick.odds.toFixed(2)}</strong> @ {currentPick.bookmaker}</span>
                </div>
                <button
                  onClick={refreshOdds}
                  disabled={refreshing}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  title="Actualizar cuotas"
                >
                  <RefreshCw className={`w-4 h-4 text-[var(--color-text-secondary)] ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveToHistory}
              disabled={saved}
              className={`flex-1 flex items-center justify-center rounded-xl py-3 text-sm font-bold transition-all active:scale-95 ${
                saved 
                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/20' 
                  : 'bg-[var(--color-bg-card)] text-[var(--color-accent-primary)] border-2 border-[var(--color-accent-primary)]'
              }`}
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Guardado
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4 mr-2" />
                  Guardar
                </>
              )}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary flex-1 flex items-center justify-center rounded-xl py-3 text-sm font-bold transition-all active:scale-95"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Ver Análisis
            </button>
          </div>
        </div>
      </motion.div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto"
            >
              <div className="rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                {/* Header */}
                <div className="p-6 text-white relative" style={{ backgroundColor: getSportColor(currentPick.sport) }}>
                  <button
                    onClick={() => setShowModal(false)}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getSportEmoji(currentPick.sport)}</span>
                    <span className="text-sm font-medium opacity-90">{currentPick.sport}</span>
                    {currentPick.isLive && (
                      <span className="ml-2 px-2 py-0.5 bg-[var(--color-danger)] rounded text-xs font-bold animate-pulse">LIVE</span>
                    )}
                    {currentPick.source === 'daily_auto' && (
                      <span className="ml-1 px-2 py-0.5 bg-purple-500 rounded text-xs font-bold flex items-center gap-1">
                        <Bot className="w-3 h-3" />
                        AUTO
                      </span>
                    )}
                    {currentPick.source === 'manual' && (
                      <span className="ml-1 px-2 py-0.5 bg-white/20 rounded text-xs font-bold flex items-center gap-1">
                        <User className="w-3 h-3" />
                        MANUAL
                      </span>
                    )}
                  </div>
                  
                  <h2 className="text-2xl font-bold mb-1">{currentPick.matchName}</h2>
                  {currentPick.league && <p className="text-sm opacity-80">{currentPick.league}</p>}
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {/* Key Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: 'var(--color-success-bg)' }}>
                      <div className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>+{currentPick.edgePercent.toFixed(1)}%</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-success)', opacity: 0.7 }}>Edge</div>
                    </div>
                    <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                      <div className="text-2xl font-bold text-[var(--color-accent-primary)]">{currentPick.odds.toFixed(2)}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-primary)]/70">Cuota</div>
                    </div>
                    <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: 'var(--color-warning-bg)' }}>
                      <div className="text-2xl font-bold text-[var(--color-warning)]">{currentPick.confidence}/10</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-warning)]/70">Confianza</div>
                    </div>
                  </div>

                  {/* Line Movement in Modal */}
                  {hasLineMovement && (
                    <div 
                      className="rounded-2xl p-4 border"
                      style={{ 
                        backgroundColor: lineMovement.direction === 'up' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                        borderColor: lineMovement.direction === 'up' ? 'rgba(52,199,89,0.2)' : 'rgba(255,59,48,0.2)'
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: getMovementColor() + '20' }}
                          >
                            <span style={{ color: getMovementColor() }}>{getMovementIcon()}</span>
                          </div>
                          <div>
                            <span className="text-sm font-bold" style={{ color: getMovementColor() }}>
                              Movimiento de Línea
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={refreshOdds}
                          disabled={refreshing}
                          className="p-2 rounded-lg border border-[var(--color-border)] transition-colors"
                          style={{ backgroundColor: 'var(--color-bg-card)' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-card)'}
                        >
                          <RefreshCw className={`w-4 h-4 text-[var(--color-text-secondary)] ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-[var(--color-text-secondary)]">
                          <span>Cuota inicial: </span>
                          <strong>{currentPick.openingOdd?.toFixed(2)}</strong>
                        </div>
                        <span className="text-lg">→</span>
                        <div className="text-sm">
                          <span>Cuota actual: </span>
                          <strong style={{ color: getMovementColor() }}>{currentPick.currentOdd?.toFixed(2)}</strong>
                        </div>
                      </div>
                      <div className="mt-2 text-center">
                        <span 
                          className="font-bold text-sm px-3 py-1 rounded-full"
                          style={{ backgroundColor: getMovementColor() + '20', color: getMovementColor() }}
                        >
                          {lineMovement.percent > 0 ? '+' : ''}{lineMovement.percent}% {lineMovement.direction === 'up' ? '↑ Subió' : '↓ Bajó'}
                        </span>
                      </div>
                      {currentPick.currentOddTimestamp && (
                        <p className="text-[10px] text-[var(--color-text-muted)] text-center mt-2">
                          Actualizado: {new Date(currentPick.currentOddTimestamp).toLocaleString('es-ES')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Bet Details */}
                  <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--color-text-secondary)]">Mercado</span>
                      <span className="font-bold text-[var(--color-text-primary)]">{currentPick.bestMarket}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--color-text-secondary)]">Selección</span>
                      <span className="font-bold text-[var(--color-accent-primary)]">{currentPick.selection}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--color-text-secondary)]">Bookmaker</span>
                      <span className="font-bold text-[var(--color-text-primary)]">{currentPick.bookmaker}</span>
                    </div>
                  </div>

                  {/* Kelly Criterion Section */}
                  <KellySection 
                    odds={currentPick.currentOdd || currentPick.odds} 
                    edgePercent={currentPick.edgePercent}
                    confidence={currentPick.confidence}
                  />

                  {/* Analysis */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[var(--color-accent-primary)]" />
                      Análisis Detallado
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                      {currentPick.analysisText}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <Clock className="w-3 h-3" />
                    <span>Creado: {new Date(currentPick.createdAt).toLocaleString('es-ES')}</span>
                  </div>

                  {/* Save Button in Modal */}
                  <button
                    onClick={saveToHistory}
                    disabled={saved}
                    className={`w-full py-4 font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                      saved 
                        ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/20' 
                        : 'text-white'
                    }`}
                    style={saved ? {} : { backgroundColor: 'var(--color-success)' }}
                    onMouseEnter={(e) => !saved && (e.currentTarget.style.backgroundColor = '#2DB94D')}
                    onMouseLeave={(e) => !saved && (e.currentTarget.style.backgroundColor = 'var(--color-success)')}
                  >
                    {saved ? (
                      <>
                        <Check className="w-5 h-5" />
                        Guardado en Historial
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-5 h-5" />
                        Guardar en Historial
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// Kelly Criterion Section Component
interface KellySectionProps {
  odds: number;
  edgePercent: number;
  confidence: number;
}

function KellySection({ odds, edgePercent, confidence }: KellySectionProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Get bankroll
  const bankroll = getBankroll();
  
  // Calculate estimated win probability from edge
  const winProb = deriveWinProbabilityFromEdge(odds, edgePercent);
  
  // Calculate Kelly recommendation
  const kelly = calculateKellyStake(odds, winProb, bankroll);
  
  return (
    <div className="rounded-2xl p-4 border border-[var(--color-accent-primary)]/20" style={{ background: 'linear-gradient(to bottom right, rgba(94,92,230,0.05), rgba(94,92,230,0.1))' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-accent-primary)' }}>
            <Calculator className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Criterio de Kelly</h3>
            <p className="text-[10px] text-[var(--color-text-secondary)]">Tamaño de apuesta sugerido</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] text-[var(--color-accent-primary)] font-medium hover:underline"
        >
          {showAdvanced ? 'Ocultar' : 'Detalles'}
        </button>
      </div>

      {/* Bankroll info */}
      <div className="flex items-center justify-between text-xs mb-3 pb-2 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-1 text-[var(--color-text-secondary)]">
          <Wallet className="w-3.5 h-3.5" />
          <span>Bankroll:</span>
        </div>
        <span className="font-bold text-[var(--color-text-primary)]">{bankroll} unidades</span>
      </div>

      {!kelly.hasPositiveEdge ? (
        <div className="rounded-xl p-3 border border-[var(--color-warning)]/20" style={{ backgroundColor: 'var(--color-warning-bg)' }}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-[var(--color-text-primary)]">Sin valor según Kelly</p>
              <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                El criterio de Kelly sugiere no apostar en este pick debido a edge insuficiente.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Main Kelly recommendation */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-xl p-3 text-center border border-[var(--color-border)]" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Percent className="w-3.5 h-3.5 text-[var(--color-accent-primary)]" />
                <span className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase">Kelly Full</span>
              </div>
              <div className="text-lg font-bold text-[var(--color-text-primary)]">
                {(kelly.kellyFractionFull * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">
                {kelly.stakeFull.toFixed(1)} uds
              </div>
            </div>
            <div className="rounded-xl p-3 text-center border border-[var(--color-success)]/20" style={{ backgroundColor: 'var(--color-success-bg)' }}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Shield className="w-3.5 h-3.5 text-[var(--color-success)]" />
                <span className="text-[10px] font-medium text-[var(--color-success)] uppercase">1/2 Kelly ✓</span>
              </div>
              <div className="text-lg font-bold text-[var(--color-success)]">
                {(kelly.kellyFractionHalf * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-[var(--color-success)]">
                {kelly.stakeHalf.toFixed(1)} uds
              </div>
            </div>
          </div>

          {/* Warning for high risk */}
          {kelly.isHighRisk && kelly.warning && (
            <div className="rounded-xl p-2.5 border border-[var(--color-warning)]/20 mb-3" style={{ backgroundColor: 'var(--color-warning-bg)' }}>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-[var(--color-text-secondary)] leading-relaxed">{kelly.warning}</p>
              </div>
            </div>
          )}

          {/* Advanced details */}
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2 pt-2 border-t border-[var(--color-border)]"
            >
              <div className="flex justify-between text-[10px]">
                <span className="text-[var(--color-text-secondary)]">Prob. estimada:</span>
                <span className="font-medium text-[var(--color-text-primary)]">{(winProb * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[var(--color-text-secondary)]">Prob. implícita (cuota):</span>
                <span className="font-medium text-[var(--color-text-primary)]">{((1 / odds) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[var(--color-text-secondary)]">Edge:</span>
                <span className="font-medium text-[var(--color-success)]">+{edgePercent.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[var(--color-text-secondary)]">Beneficio neto (b):</span>
                <span className="font-medium text-[var(--color-text-primary)]">{(odds - 1).toFixed(2)}x</span>
              </div>
            </motion.div>
          )}

          {/* Recommended stake */}
          <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--color-accent-primary)' }}>
            <p className="text-[10px] text-white/70 uppercase font-medium mb-1">
              Stake recomendado (1/2 Kelly)
            </p>
            <p className="text-2xl font-bold text-white">
              {kelly.stakeHalf.toFixed(2)} unidades
            </p>
          </div>
        </>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-1.5 mt-2 px-1">
        <Info className="w-3 h-3 text-[var(--color-text-muted)] flex-shrink-0 mt-0.5" />
        <p className="text-[9px] text-[var(--color-text-muted)] leading-relaxed">
          Kelly es una guía matemática, no una garantía. Ajusta el stake según tu tolerancia al riesgo.
        </p>
      </div>
    </div>
  );
}
