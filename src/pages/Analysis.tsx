import React, { useState, useEffect } from 'react';
import { Search, Calendar, Loader2, TrendingUp, Verified, Info, Database, ThumbsUp, ThumbsDown, Scale, ChevronDown, ChevronUp, Target, Activity, BarChart3, Zap } from 'lucide-react';
import { Prediction, DebateResult, XGMatchStats } from '../types';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY = 'coco_vip_predictions';

// Loading messages for the automatic analysis
const LOADING_MESSAGES = [
  { text: "Buscando datos del partido...", icon: "🔍" },
  { text: "Procesando estadísticas...", icon: "📊" },
  { text: "Analizando con IA...", icon: "🤖" }
];

// xG Stats Section Component
function XGSection({ xgStats }: { xgStats: XGMatchStats }) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!xgStats || !xgStats.home || !xgStats.away) return null;

  const home = xgStats.home;
  const away = xgStats.away;

  // Calculate projected total xG
  const projectedTotalXG = home.avg_xg + away.avg_xg;
  const projectedHomeXG = home.avg_home_xg || home.avg_xg;
  const projectedAwayXG = away.avg_away_xg || away.avg_xg;

  // Mini bar chart for xG last 5
  const XGBarChart = ({ values, color }: { values: number[], color: string }) => {
    const max = Math.max(...values, 3);
    return (
      <div className="flex items-end gap-1 h-8">
        {values.map((v, i) => (
          <div
            key={i}
            className={`w-4 rounded-t transition-all`}
            style={{
              height: `${(v / max) * 100}%`,
              backgroundColor: color,
              opacity: 0.6 + (i * 0.1)
            }}
            title={`${v.toFixed(2)} xG`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}
      >
        <span className="flex items-center gap-2">
          <Target className="w-4 h-4" style={{ color: 'var(--color-accent-primary)' }} />
          xG Stats Understat
          {xgStats.cached && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>cached</span>
          )}
        </span>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
              {/* Projected Total */}
              <div className="flex items-center justify-between rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>xG Total Proyectado</span>
                <span className="text-lg font-bold" style={{ color: 'var(--color-accent-primary)' }}>{projectedTotalXG.toFixed(2)}</span>
              </div>

              {/* Teams Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Home Team */}
                <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-success)' }} />
                    <span className="text-xs font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>{home.team}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-accent-primary)' }}>LOCAL</span>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span style={{ color: 'var(--color-text-secondary)' }}>xG promedio</span>
                      <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{home.avg_xg.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span style={{ color: 'var(--color-text-secondary)' }}>xGA promedio</span>
                      <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{home.avg_xga.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span style={{ color: 'var(--color-text-secondary)' }}>xG en casa</span>
                      <span className="font-bold" style={{ color: 'var(--color-success)' }}>{projectedHomeXG.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span style={{ color: 'var(--color-text-secondary)' }}>npxG</span>
                      <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>{home.npxg.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* xG Last 5 */}
                  {home.xg_last5 && home.xg_last5.length > 0 && (
                    <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <p className="text-[9px] uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>Forma xG últimos 5</p>
                      <XGBarChart values={home.xg_last5} color="var(--color-success)" />
                    </div>
                  )}

                  {/* Source */}
                  <div className="pt-1 text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
                    Fuente: {home.source}
                  </div>
                </div>

                {/* Away Team */}
                <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-danger)' }} />
                    <span className="text-xs font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>{away.team}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>VISIT.</span>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span style={{ color: 'var(--color-text-secondary)' }}>xG promedio</span>
                      <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{away.avg_xg.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span style={{ color: 'var(--color-text-secondary)' }}>xGA promedio</span>
                      <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{away.avg_xga.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span style={{ color: 'var(--color-text-secondary)' }}>xG fuera</span>
                      <span className="font-bold" style={{ color: 'var(--color-danger)' }}>{projectedAwayXG.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span style={{ color: 'var(--color-text-secondary)' }}>npxG</span>
                      <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>{away.npxg.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* xG Last 5 */}
                  {away.xg_last5 && away.xg_last5.length > 0 && (
                    <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <p className="text-[9px] uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>Forma xG últimos 5</p>
                      <XGBarChart values={away.xg_last5} color="var(--color-danger)" />
                    </div>
                  )}

                  {/* Source */}
                  <div className="pt-1 text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
                    Fuente: {away.source}
                  </div>
                </div>
              </div>

              {/* xG Analysis Info */}
              <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                <Activity className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent-primary)' }} />
                <div className="text-[10px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <strong style={{ color: 'var(--color-text-primary)' }}>xG (Expected Goals)</strong> mide la calidad de las oportunidades creadas.
                  Compara xG vs goles reales para detectar sobre/sub-rendimiento.
                  Útil para mercados <strong>Over/Under</strong>.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Debate Section Component with Tabs
function DebateSection({ debate }: { debate: DebateResult }) {
  const [activeTab, setActiveTab] = useState<'pro' | 'contra' | 'conclusion'>('pro');

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'mantener': return { color: 'var(--color-success)', backgroundColor: 'var(--color-success-bg)', borderColor: 'var(--color-success)' };
      case 'evitar': return { color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)' };
      case 'stake reducido': return { color: 'var(--color-warning)', backgroundColor: 'var(--color-warning-bg)', borderColor: 'var(--color-warning)' };
      default: return { color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' };
    }
  };

  const getRecommendationLabel = (rec: string) => {
    switch (rec) {
      case 'mantener': return '✅ Mantener Apuesta';
      case 'evitar': return '❌ Evitar Apuesta';
      case 'stake reducido': return '⚠️ Stake Reducido';
      default: return rec;
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
        <Scale className="w-4 h-4" style={{ color: 'var(--color-accent-primary)' }} />
        Debate de Analistas
      </p>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        <button
          onClick={() => setActiveTab('pro')}
          className="flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          style={activeTab === 'pro' ? { backgroundColor: 'var(--color-success)', color: 'white' } : { color: 'var(--color-text-secondary)' }}
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          A Favor
        </button>
        <button
          onClick={() => setActiveTab('contra')}
          className="flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          style={activeTab === 'contra' ? { backgroundColor: 'var(--color-danger)', color: 'white' } : { color: 'var(--color-text-secondary)' }}
        >
          <ThumbsDown className="w-3.5 h-3.5" />
          En Contra
        </button>
        <button
          onClick={() => setActiveTab('conclusion')}
          className="flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          style={activeTab === 'conclusion' ? { backgroundColor: 'var(--color-accent-primary)', color: 'white' } : { color: 'var(--color-text-secondary)' }}
        >
          <Scale className="w-3.5 h-3.5" />
          Conclusión
        </button>
      </div>

      {/* Tab Content */}
      <div className="rounded-xl p-4 min-h-[100px]" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'pro' && (
            <motion.div
              key="pro"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-success)' }}>
                  <ThumbsUp className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--color-success)' }}>Analista Optimista</span>
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{debate.pro.summary}</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{debate.pro.details}</p>
            </motion.div>
          )}

          {activeTab === 'contra' && (
            <motion.div
              key="contra"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-danger)' }}>
                  <ThumbsDown className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--color-danger)' }}>Analista Escéptico</span>
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{debate.contra.summary}</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{debate.contra.details}</p>
            </motion.div>
          )}

          {activeTab === 'conclusion' && (
            <motion.div
              key="conclusion"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-accent-primary)' }}>
                  <Scale className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--color-accent-primary)' }}>Moderador</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{debate.conclusion.summary}</p>

              {/* Recommendation Badge */}
              <div
                className="inline-flex px-3 py-2 rounded-lg text-xs font-bold border"
                style={{
                  color: getRecommendationColor(debate.conclusion.recommendation).color,
                  backgroundColor: getRecommendationColor(debate.conclusion.recommendation).backgroundColor,
                  borderColor: getRecommendationColor(debate.conclusion.recommendation).borderColor
                }}
              >
                {getRecommendationLabel(debate.conclusion.recommendation)}
              </div>

              {/* Adjusted Confidence */}
              {debate.conclusion.confidence_adjusted && (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <span>Confianza ajustada:</span>
                  <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{debate.conclusion.confidence_adjusted}/10</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const SPORTS = [
  { id: 'football', name: 'Fútbol', emoji: '⚽' },
  { id: 'basketball', name: 'Basketball', emoji: '🏀' },
  { id: 'baseball', name: 'Béisbol', emoji: '⚾' }
];

interface AnalysisProps {
  initialMatchName?: string | null;
}

export default function Analysis({ initialMatchName }: AnalysisProps) {
  const [formData, setFormData] = useState({
    match_name: initialMatchName || '',
    date: '',
    sport: 'football',
    user_context: ''
  });
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<Prediction | null>(null);
  const [saved, setSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Update form when initialMatchName changes
  useEffect(() => {
    if (initialMatchName) {
      setFormData(prev => ({ ...prev, match_name: initialMatchName }));
    }
  }, [initialMatchName]);

  // Animate loading messages
  useEffect(() => {
    if (loading && loadingStep < LOADING_MESSAGES.length - 1) {
      const timer = setTimeout(() => {
        setLoadingStep(prev => prev + 1);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, loadingStep]);

  const handleAnalyze = async () => {
    if (!formData.match_name) return;
    setLoading(true);
    setLoadingStep(0);
    setResult(null);
    setSaved(false);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      
      const normalizedResult: Prediction = {
        id: Date.now().toString(),
        matchName: data.matchName || data.match_name || formData.match_name,
        sport: data.sport || formData.sport,
        bestMarket: data.bestMarket || data.best_market || 'Análisis completo',
        selection: data.selection || '',
        bookmaker: data.bookmaker || 'General',
        odds: data.odds || 1.85,
        edgePercent: data.edgePercent || data.edge_percent || data.edgePercent || 8.5,
        confidence: data.confidence || 7,
        analysisText: data.analysisText || data.analysis_text || 'Análisis completado',
        status: 'pending',
        createdAt: new Date().toISOString(),
        hasRealStats: data.hasRealStats || false,
        openingOdd: data.openingOdd || data.odds || 1.85,
        openingOddTimestamp: data.openingOddTimestamp || new Date().toISOString(),
        currentOdd: data.currentOdd || data.odds || 1.85,
        currentOddTimestamp: data.currentOddTimestamp || new Date().toISOString(),
        lineMovementPercent: data.lineMovementPercent || 0,
        lineMovementDirection: data.lineMovementDirection || 'stable',
        debate: data.debate || undefined,
        xgStats: data.xgStats || data.xg_stats || undefined,
        // New fields from strict analysis
        edge_detected: data.edge_detected,
        quality_tier: data.quality_tier,
        implied_prob: data.implied_prob,
        estimated_prob: data.estimated_prob,
        risk_factors: data.risk_factors,
        supporting_factors: data.supporting_factors,
        recommendation: data.recommendation,
        valid: data.valid,
        reason: data.reason,
        autoContext: data.autoContext
      };
      
      setResult(normalizedResult);
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveToHistory = async () => {
    if (!result) return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const existing: Prediction[] = stored ? JSON.parse(stored) : [];
      
      const newPrediction: Prediction = {
        ...result,
        userContext: formData.user_context,
        createdAt: new Date().toISOString()
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify([newPrediction, ...existing]));
      setSaved(true);
    } catch (error) {
      console.error("Error saving to history:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Análisis Manual</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Escribe el partido y Coco buscará todos los datos automáticamente</p>
      </div>

      <div className="space-y-5">
        {/* Sport Selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold ml-1" style={{ color: 'var(--color-text-primary)' }}>Deporte</label>
          <div className="grid grid-cols-3 gap-2">
            {SPORTS.map((sport) => (
              <button
                key={sport.id}
                onClick={() => setFormData({ ...formData, sport: sport.id })}
                className="py-3 rounded-xl font-medium text-sm transition-all flex flex-col items-center gap-1"
                style={formData.sport === sport.id 
                  ? { backgroundColor: 'var(--color-accent-primary)', color: 'white' }
                  : { backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }
                }
              >
                <span className="text-xl">{sport.emoji}</span>
                <span>{sport.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Match Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold ml-1" style={{ color: 'var(--color-text-primary)' }}>Partido</label>
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
            <input
              value={formData.match_name}
              onChange={(e) => setFormData({ ...formData, match_name: e.target.value })}
              className="w-full pl-12 pr-4 py-3 rounded-2xl focus:ring-2 focus:border-transparent outline-none resize-none text-sm"
              style={{ 
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                '--tw-ring-color': 'var(--color-accent-primary)'
              } as React.CSSProperties}
              placeholder="Ej: Real Madrid vs Barcelona"
              type="text"
            />
          </div>
        </div>

        {/* Advanced Options (Collapsed by default) */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs flex items-center gap-1 ml-1 transition-colors"
            style={{ color: 'var(--color-accent-primary)' }}
          >
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            ➕ Añadir contexto manual (opcional)
          </button>
          
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4 overflow-hidden"
              >
                {/* Date */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold ml-1" style={{ color: 'var(--color-text-primary)' }}>Fecha (opcional)</label>
                  <div className="relative flex items-center">
                    <Calendar className="absolute left-4 w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
                    <input
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 rounded-2xl focus:ring-2 focus:border-transparent outline-none text-sm"
                      style={{ 
                        backgroundColor: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-primary)',
                        '--tw-ring-color': 'var(--color-accent-primary)'
                      } as React.CSSProperties}
                      type="date"
                    />
                  </div>
                </div>

                {/* Additional Context */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold ml-1" style={{ color: 'var(--color-text-primary)' }}>Contexto Adicional</label>
                  <textarea
                    value={formData.user_context}
                    onChange={(e) => setFormData({ ...formData, user_context: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl focus:ring-2 focus:border-transparent outline-none resize-none text-sm"
                    style={{ 
                      backgroundColor: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                      '--tw-ring-color': 'var(--color-accent-primary)'
                    } as React.CSSProperties}
                    placeholder="Lesiones, clima, motivación del equipo..."
                    rows={2}
                  ></textarea>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={loading || !formData.match_name}
          className="w-full py-4 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--color-accent-primary)', color: 'white', boxShadow: '0 2px 8px rgba(24,24,27,0.3)' }}
        >
          {loading ? (
            <motion.div 
              className="flex items-center gap-2"
              key={loadingStep}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="flex items-center gap-2">
                <span>{LOADING_MESSAGES[loadingStep].icon}</span>
                <span>{LOADING_MESSAGES[loadingStep].text}</span>
              </span>
            </motion.div>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Analizar Value Bet
            </>
          )}
        </button>
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mt-10 pb-10"
          >
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4 px-1" style={{ color: 'var(--color-text-muted)' }}>Resultado del Análisis</h3>
            
            <div className="rounded-3xl p-6 border" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' }}>
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-accent-primary)' }}>Mejor Value Bet</p>
                  
                  {/* SELECCIÓN DESTACADA */}
                  <div className="px-4 py-3 rounded-xl inline-block mb-3" style={{ background: 'linear-gradient(to right, var(--color-accent-primary), var(--color-accent-secondary))', color: 'white' }}>
                    <span className="text-2xl font-bold">{result.selection}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{result.matchName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
                      {result.sport === 'football' ? '⚽ Fútbol' : result.sport === 'basketball' ? '🏀 Basketball' : result.sport === 'baseball' ? '⚾ Béisbol' : result.sport}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Mercado: {result.bestMarket}</p>
                </div>
                <div className="flex flex-col items-end gap-2 ml-4">
                  <div className="px-3 py-1.5 rounded-full text-sm font-bold border" style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', borderColor: 'rgba(22,163,74,0.2)' }}>
                    +{result.edgePercent.toFixed(1)}% Edge
                  </div>
                  {result.hasRealStats && (
                    <div className="px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-accent-primary)' }}>
                      <Database className="w-3 h-3" />
                      Stats Reales
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-2xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                  <p className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--color-text-muted)' }}>Confianza</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{result.confidence}</span>
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>/ 10</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                    <div 
                      className="h-full rounded-full"
                      style={{ width: `${result.confidence * 10}%`, backgroundColor: 'var(--color-accent-primary)' }}
                    ></div>
                  </div>
                </div>
                <div className="p-4 rounded-2xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                  <p className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--color-text-muted)' }}>Cuota</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{result.odds.toFixed(2)}</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{result.bookmaker}</p>
                </div>
              </div>

              {/* Analysis Text */}
              <div className="space-y-2">
                <p className="text-xs font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                  <Info className="w-4 h-4" style={{ color: 'var(--color-accent-primary)' }} />
                  Análisis
                </p>
                <p className="text-sm leading-relaxed rounded-xl p-4 italic" style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-secondary)' }}>
                  "{result.analysisText}"
                </p>
              </div>

              {/* Debate Section */}
              {result.debate && (
                <DebateSection debate={result.debate} />
              )}

              {/* xG Stats Section - Football Only */}
              {result.sport === 'football' && result.xgStats && (
                <div className="mt-4">
                  <XGSection xgStats={result.xgStats} />
                </div>
              )}

              {/* Save Button */}
              {!saved ? (
                <button
                  onClick={saveToHistory}
                  className="mt-6 w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  style={{ backgroundColor: 'var(--color-success)', color: 'white' }}
                >
                  <TrendingUp className="w-4 h-4" />
                  Guardar en Historial
                </button>
              ) : (
                <div className="mt-6 w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2 border" style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', borderColor: 'rgba(22,163,74,0.2)' }}>
                  <Verified className="w-4 h-4" />
                  Guardado en tu historial
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
