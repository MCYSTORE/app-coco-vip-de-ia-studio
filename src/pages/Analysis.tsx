import React, { useState, useEffect } from 'react';
import { Search, Calendar, Loader2, TrendingUp, Verified, Info, Database, ThumbsUp, ThumbsDown, Scale, ChevronDown, ChevronUp, Target, Activity, BarChart3, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Prediction, DebateResult, XGMatchStats } from '../types';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY = 'coco_vip_predictions';

// Loading messages for the automatic analysis (V1)
const LOADING_MESSAGES = [
  { text: "Buscando datos del partido...", icon: "🔍" },
  { text: "Procesando estadísticas...", icon: "📊" },
  { text: "Analizando con IA...", icon: "🤖" }
];

// V2 Pipeline Loading Messages (AI-Driven 4 Steps)
const LOADING_MESSAGES_V2 = [
  { text: "Obteniendo cuotas en tiempo real...", icon: "🔍", progress: 10 },
  { text: "Perplexity investigando la web...", icon: "📡", progress: 30 },
  { text: "DeepSeek razonando en profundidad...", icon: "🧠", progress: 60 },
  { text: "Estructurando el análisis final...", icon: "⚙️", progress: 85 }
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
          style={activeTab === 'conclusion' ? { backgroundColor: 'var(--color-accent-primary)', color: 'var(--color-bg-primary)' } : { color: 'var(--color-text-secondary)' }}
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
  
  // V2 Pipeline States
  const [useV2, setUseV2] = useState(true); // Default to V2 pipeline
  const [v2Progress, setV2Progress] = useState(0);
  const [v2Warnings, setV2Warnings] = useState<string[]>([]);
  const [v2Step, setV2Step] = useState(0);

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
    setV2Warnings([]);
    setV2Progress(0);
    setV2Step(0);

    // Use V2 pipeline if enabled
    if (useV2) {
      return handleAnalyzeV2();
    }

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

  // V2 Pipeline Analysis - AI-Driven 3 Steps
  const handleAnalyzeV2 = async () => {
    if (!formData.match_name) return;

    // Animate through V2 loading steps
    const stepTimer = setInterval(() => {
      setV2Step(prev => {
        if (prev < LOADING_MESSAGES_V2.length - 1) {
          return prev + 1;
        }
        return prev;
      });
      setV2Progress(prev => {
        if (prev < 80) {
          return prev + 15;
        }
        return prev;
      });
    }, 2000);

    try {
      const response = await fetch('/api/analyze-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchName: formData.match_name,
          sport: formData.sport
        })
      });

      clearInterval(stepTimer);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error en el análisis');
      }

      const data = await response.json();

      // Extract warnings from response headers or data
      const warnings: string[] = [];
      if (data.oddsPayload === null) {
        warnings.push('⚠️ Cuotas no disponibles, usando estimaciones');
      }
      if (!data.researchContext || data.researchContext === 'Sin contexto web disponible.') {
        warnings.push('⚠️ Búsqueda web fallida, análisis limitado');
      }
      setV2Warnings(warnings);
      setV2Progress(100);

      // Normalize V2 result to Prediction format
      const normalizedResult: Prediction = {
        id: Date.now().toString(),
        matchName: data.match || formData.match_name,
        sport: data.sport,
        bestMarket: data.best_pick?.market || 'Análisis AI',
        selection: data.best_pick?.selection || '',
        bookmaker: 'AI Pipeline',
        odds: data.best_pick?.odds || 1.85,
        edgePercent: data.best_pick?.edge_percentage || 0,
        confidence: Math.round((data.best_pick?.confidence_score || 0.5) * 10),
        analysisText: data.best_pick?.analysis?.conclusion || data.mercados_completos?.proyeccion_final?.resumen || 'Análisis completado',
        status: 'pending',
        createdAt: new Date().toISOString(),
        hasRealStats: data.data_quality === 'alta',
        openingOdd: data.best_pick?.odds || 1.85,
        openingOddTimestamp: new Date().toISOString(),
        currentOdd: data.best_pick?.odds || 1.85,
        currentOddTimestamp: new Date().toISOString(),
        lineMovementPercent: 0,
        lineMovementDirection: 'stable',
        // V2 specific fields
        supporting_factors: data.supporting_factors || data.best_pick?.analysis?.pros || [],
        risk_factors: data.risk_factors || data.best_pick?.analysis?.cons || [],
        dataQuality: data.data_quality,
        estimatedOdds: data.estimated_odds,
        kellyStake: data.best_pick?.kelly_stake_units,
        valueBet: data.best_pick?.value_bet,
        tier: data.best_pick?.tier,
        mercados_completos: data.mercados_completos,
        picks_con_value: data.picks_con_value,
        fuentes_contexto: data.fuentes_contexto,
        ajustes_aplicados: data.ajustes_aplicados,
        researchContext: data.researchContext,
        deep_reasoning: data.deep_reasoning,
        best_pick: data.best_pick
      };

      setResult(normalizedResult);
    } catch (error: any) {
      console.error("V2 Analysis error:", error);
      setV2Warnings([`❌ Error: ${error.message}`]);
    } finally {
      clearInterval(stepTimer);
      setLoading(false);
      setV2Progress(100);
    }
  };

  const [savingToSheets, setSavingToSheets] = useState(false);
  const [sheetsSaveResult, setSheetsSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  const saveToHistory = async () => {
    if (!result) return;
    
    try {
      // 1. Guardar en localStorage (copia local rápida)
      const stored = localStorage.getItem(STORAGE_KEY);
      const existing: Prediction[] = stored ? JSON.parse(stored) : [];
      
      const newPrediction: Prediction = {
        ...result,
        userContext: formData.user_context,
        createdAt: new Date().toISOString()
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify([newPrediction, ...existing]));
      
      // 2. Guardar en Google Sheets (persistencia para seguimiento)
      setSavingToSheets(true);
      setSheetsSaveResult(null);
      
      try {
        const response = await fetch('/api/history-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            result: result,
            userContext: formData.user_context
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          setSheetsSaveResult({ 
            success: true, 
            message: '✅ Guardado en Google Sheets para seguimiento' 
          });
          console.log('✅ Análisis guardado en Google Sheets:', data.id);
        } else {
          setSheetsSaveResult({ 
            success: false, 
            message: data.configured === false 
              ? '⚠️ Google Sheets no configurado - solo guardado local'
              : '⚠️ Error al guardar en Sheets - solo guardado local'
          });
          console.log('⚠️ No se pudo guardar en Google Sheets:', data.error);
        }
      } catch (sheetsError) {
        console.error("Error saving to Google Sheets:", sheetsError);
        setSheetsSaveResult({ 
          success: false, 
          message: '⚠️ Error de conexión - solo guardado local' 
        });
      }
      
      setSaved(true);
    } catch (error) {
      console.error("Error saving to history:", error);
    } finally {
      setSavingToSheets(false);
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

        {/* V2 Pipeline Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: useV2 ? 'linear-gradient(to right, var(--color-accent-primary), var(--color-accent-secondary))' : 'var(--color-bg-secondary)' }}>
              <span className="text-lg">🧠</span>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Pipeline AI v2</p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>Perplexity + DeepSeek R1</p>
            </div>
          </div>
          <button
            onClick={() => setUseV2(!useV2)}
            className="relative w-14 h-7 rounded-full transition-colors"
            style={{ backgroundColor: useV2 ? 'var(--color-accent-primary)' : 'var(--color-bg-secondary)' }}
          >
            <motion.div
              className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow"
              animate={{ left: useV2 ? '1.75rem' : '0.25rem' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>

        {/* V2 Warnings */}
        <AnimatePresence>
          {v2Warnings.length > 0 && useV2 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-2"
            >
              {v2Warnings.map((warning, idx) => (
                <div key={idx} className="px-4 py-2 rounded-xl text-sm flex items-center gap-2" style={{ backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
                  <AlertTriangle className="w-4 h-4" />
                  <span>{warning}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={loading || !formData.match_name}
          className="w-full py-4 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed btn-primary"
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
                {useV2 ? (
                  <>
                    <span>{LOADING_MESSAGES_V2[v2Step]?.icon || '🔍'}</span>
                    <span>{LOADING_MESSAGES_V2[v2Step]?.text || 'Analizando...'}</span>
                  </>
                ) : (
                  <>
                    <span>{LOADING_MESSAGES[loadingStep].icon}</span>
                    <span>{LOADING_MESSAGES[loadingStep].text}</span>
                  </>
                )}
              </span>
            </motion.div>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              {useV2 ? 'Analizar con AI Pipeline v2' : 'Analizar Value Bet'}
              {useV2 && <span className="text-xs ml-1" style={{ color: 'var(--color-accent-secondary)' }}>(4 pasos)</span>}
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
                  <div className="px-4 py-3 rounded-xl inline-block mb-3" style={{ background: 'linear-gradient(to right, var(--color-accent-primary), var(--color-accent-secondary))', color: 'var(--color-bg-primary)' }}>
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

              {/* Data Quality Badge - FIX 3E */}
              {result.dataQuality && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Calidad de datos:</span>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                    result.dataQuality === 'alta' ? 'bg-green-100 text-green-700' :
                    result.dataQuality === 'media' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {result.dataQuality === 'alta' ? '✅ Stats Reales' : 
                     result.dataQuality === 'media' ? '⚠️ Stats Parciales' : 
                     '⚠️ Datos Limitados'}
                  </span>
                </div>
              )}

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

              {/* FIX 3B: Detailed Analysis Section (Expandable) */}
              {result.best_pick?.analysis && (
                <div className="mt-4 space-y-3">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between p-3 rounded-xl"
                    style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                  >
                    <span className="text-xs font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                      <BarChart3 className="w-4 h-4" style={{ color: 'var(--color-accent-primary)' }} />
                      Análisis Detallado
                    </span>
                    {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  <AnimatePresence>
                    {showAdvanced && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-4"
                      >
                        {/* Pros */}
                        {result.best_pick.analysis.pros?.length > 0 && (
                          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-success-bg)' }}>
                            <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-success)' }}>✓ Factores a Favor</p>
                            <ul className="space-y-1">
                              {result.best_pick.analysis.pros.map((pro, idx) => (
                                <li key={idx} className="text-sm flex items-start gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
                                  {pro}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Cons */}
                        {result.best_pick.analysis.cons?.length > 0 && (
                          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-danger-bg)' }}>
                            <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-danger)' }}>✗ Riesgos</p>
                            <ul className="space-y-1">
                              {result.best_pick.analysis.cons.map((con, idx) => (
                                <li key={idx} className="text-sm flex items-start gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-danger)' }} />
                                  {con}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Stats Highlights */}
                        {result.best_pick.stats_highlights && (
                          <div className="grid grid-cols-3 gap-2">
                            {Object.entries(result.best_pick.stats_highlights).map(([key, value]) => (
                              <div key={key} className="p-3 rounded-xl text-center" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                                <p className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--color-text-muted)' }}>Métrica</p>
                                <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{value}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* FIX 3C: All Markets Table (Expandable) */}
              {result.mercados_completos && (
                <div className="mt-4 space-y-3">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between p-3 rounded-xl"
                    style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                  >
                    <span className="text-xs font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                      <Target className="w-4 h-4" style={{ color: 'var(--color-accent-primary)' }} />
                      Todos los Mercados
                    </span>
                    {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  <AnimatePresence>
                    {showAdvanced && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ backgroundColor: 'var(--color-bg-card)' }}>
                                <th className="py-2 px-3 text-left font-bold" style={{ color: 'var(--color-text-primary)' }}>Mercado</th>
                                <th className="py-2 px-3 text-left font-bold" style={{ color: 'var(--color-text-primary)' }}>Selección</th>
                                <th className="py-2 px-3 text-center font-bold" style={{ color: 'var(--color-text-primary)' }}>Cuota</th>
                                <th className="py-2 px-3 text-center font-bold" style={{ color: 'var(--color-text-primary)' }}>Edge</th>
                                <th className="py-2 px-3 text-center font-bold" style={{ color: 'var(--color-text-primary)' }}>Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* Resultado */}
                              {result.mercados_completos.resultado && (
                                <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                  <td className="py-2 px-3" style={{ color: 'var(--color-text-secondary)' }}>Resultado</td>
                                  <td className="py-2 px-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{result.mercados_completos.resultado.seleccion}</td>
                                  <td className="py-2 px-3 text-center" style={{ color: 'var(--color-text-primary)' }}>{result.mercados_completos.resultado.odds?.toFixed(2) || '-'}</td>
                                  <td className="py-2 px-3 text-center" style={{ color: result.mercados_completos.resultado.edge_percentage > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                                    {result.mercados_completos.resultado.edge_percentage ? `+${result.mercados_completos.resultado.edge_percentage.toFixed(1)}%` : '-'}
                                  </td>
                                  <td className="py-2 px-3 text-center">{result.mercados_completos.resultado.value_bet ? '✅' : '❌'}</td>
                                </tr>
                              )}
                              {/* Total */}
                              {result.mercados_completos.total && (
                                <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                  <td className="py-2 px-3" style={{ color: 'var(--color-text-secondary)' }}>Over/Under</td>
                                  <td className="py-2 px-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{result.mercados_completos.total.seleccion} {result.mercados_completos.total.linea}</td>
                                  <td className="py-2 px-3 text-center" style={{ color: 'var(--color-text-primary)' }}>{result.mercados_completos.total.odds?.toFixed(2) || '-'}</td>
                                  <td className="py-2 px-3 text-center" style={{ color: result.mercados_completos.total.edge_percentage && result.mercados_completos.total.edge_percentage > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                                    {result.mercados_completos.total.edge_percentage ? `+${result.mercados_completos.total.edge_percentage.toFixed(1)}%` : '-'}
                                  </td>
                                  <td className="py-2 px-3 text-center">{result.mercados_completos.total.value_bet ? '✅' : '❌'}</td>
                                </tr>
                              )}
                              {/* BTTS */}
                              {result.mercados_completos.ambos_anotan && result.mercados_completos.ambos_anotan.aplica && (
                                <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                  <td className="py-2 px-3" style={{ color: 'var(--color-text-secondary)' }}>Ambos Anotan</td>
                                  <td className="py-2 px-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{result.mercados_completos.ambos_anotan.seleccion === 'yes' ? 'Sí' : 'No'}</td>
                                  <td className="py-2 px-3 text-center" style={{ color: 'var(--color-text-primary)' }}>{result.mercados_completos.ambos_anotan.odds?.toFixed(2) || '-'}</td>
                                  <td className="py-2 px-3 text-center" style={{ color: result.mercados_completos.ambos_anotan.edge_percentage && result.mercados_completos.ambos_anotan.edge_percentage > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                                    {result.mercados_completos.ambos_anotan.edge_percentage ? `+${result.mercados_completos.ambos_anotan.edge_percentage.toFixed(1)}%` : '-'}
                                  </td>
                                  <td className="py-2 px-3 text-center">{result.mercados_completos.ambos_anotan.value_bet ? '✅' : '❌'}</td>
                                </tr>
                              )}
                              {/* Corners */}
                              {result.mercados_completos.corners && result.mercados_completos.corners.aplica && (
                                <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                  <td className="py-2 px-3" style={{ color: 'var(--color-text-secondary)' }}>Corners</td>
                                  <td className="py-2 px-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{result.mercados_completos.corners.seleccion} {result.mercados_completos.corners.total_estimado}</td>
                                  <td className="py-2 px-3 text-center" style={{ color: 'var(--color-text-primary)' }}>{result.mercados_completos.corners.odds?.toFixed(2) || '-'}</td>
                                  <td className="py-2 px-3 text-center" style={{ color: result.mercados_completos.corners.edge_percentage && result.mercados_completos.corners.edge_percentage > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                                    {result.mercados_completos.corners.edge_percentage ? `+${result.mercados_completos.corners.edge_percentage.toFixed(1)}%` : '-'}
                                  </td>
                                  <td className="py-2 px-3 text-center">{result.mercados_completos.corners.value_bet ? '✅' : '❌'}</td>
                                </tr>
                              )}
                              {/* Handicap */}
                              {result.mercados_completos.handicap && result.mercados_completos.handicap.aplica && (
                                <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                  <td className="py-2 px-3" style={{ color: 'var(--color-text-secondary)' }}>Hándicap</td>
                                  <td className="py-2 px-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{result.mercados_completos.handicap.seleccion} {result.mercados_completos.handicap.linea}</td>
                                  <td className="py-2 px-3 text-center" style={{ color: 'var(--color-text-primary)' }}>{result.mercados_completos.handicap.odds?.toFixed(2) || '-'}</td>
                                  <td className="py-2 px-3 text-center" style={{ color: result.mercados_completos.handicap.edge_percentage && result.mercados_completos.handicap.edge_percentage > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                                    {result.mercados_completos.handicap.edge_percentage ? `+${result.mercados_completos.handicap.edge_percentage.toFixed(1)}%` : '-'}
                                  </td>
                                  <td className="py-2 px-3 text-center">{result.mercados_completos.handicap.value_bet ? '✅' : '❌'}</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Deep Reasoning Accordion - The thinking behind the analysis */}
              {result.deep_reasoning && (
                <div className="mt-4 space-y-2">
                  <details className="group">
                    <summary className="flex items-center justify-between p-3 rounded-xl cursor-pointer" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                      <span className="text-xs font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                        🧠 Razonamiento del Analista
                      </span>
                      <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="mt-2 p-4 rounded-xl text-xs leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto font-mono" style={{ backgroundColor: '#1a1a2e', color: '#a0aec0' }}>
                      {result.deep_reasoning}
                    </div>
                  </details>
                </div>
              )}

              {/* Research Context Accordion */}
              {result.researchContext && (
                <div className="mt-4 space-y-2">
                  <details className="group">
                    <summary className="flex items-center justify-between p-3 rounded-xl cursor-pointer" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                      <span className="text-xs font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                        📡 Contexto investigado por Perplexity
                      </span>
                      <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="mt-2 p-4 rounded-xl text-xs leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto" style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-secondary)' }}>
                      {result.researchContext}
                    </div>
                  </details>
                </div>
              )}

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
                  disabled={savingToSheets}
                  className="mt-6 w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                  style={{ backgroundColor: 'var(--color-success)', color: 'white' }}
                >
                  {savingToSheets ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando en Google Sheets...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-4 h-4" />
                      Guardar en Historial (Google Sheets)
                    </>
                  )}
                </button>
              ) : (
                <div className="mt-6 space-y-2">
                  <div className="w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2 border" style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', borderColor: 'rgba(22,163,74,0.2)' }}>
                    <Verified className="w-4 h-4" />
                    Guardado en historial local
                  </div>
                  {sheetsSaveResult && (
                    <div className={`w-full py-2 px-4 rounded-xl text-sm text-center ${sheetsSaveResult.success ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                      {sheetsSaveResult.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
