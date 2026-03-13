import React, { useState } from 'react';
import { Search, Calendar, Sparkles, Loader2, TrendingUp, Verified, Info } from 'lucide-react';
import { Prediction } from '../types';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY = 'coco_vip_predictions';

const SPORTS = [
  { id: 'football', name: 'Fútbol', emoji: '⚽' },
  { id: 'basketball', name: 'Basketball', emoji: '🏀' },
  { id: 'baseball', name: 'Béisbol', emoji: '⚾' }
];

export default function Analysis() {
  const [formData, setFormData] = useState({
    match_name: '',
    date: '',
    sport: 'football',
    user_context: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Prediction | null>(null);
  const [saved, setSaved] = useState(false);

  const handleAnalyze = async () => {
    if (!formData.match_name) return;
    setLoading(true);
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
        edgePercent: data.edgePercent || data.edge_percent || 8.5,
        confidence: data.confidence || 7,
        analysisText: data.analysisText || data.analysis_text || 'Análisis completado',
        status: 'pending',
        createdAt: new Date().toISOString()
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
        <h2 className="text-2xl font-bold text-[#1D1D1F]">Análisis Manual</h2>
        <p className="text-sm text-[#6E6E73] mt-1">La IA analizará todos los mercados y te dará las mejores opciones</p>
      </div>

      <div className="space-y-5">
        {/* Sport Selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-[#1D1D1F] ml-1">Deporte</label>
          <div className="grid grid-cols-3 gap-2">
            {SPORTS.map((sport) => (
              <button
                key={sport.id}
                onClick={() => setFormData({ ...formData, sport: sport.id })}
                className={`py-3 rounded-xl font-medium text-sm transition-all flex flex-col items-center gap-1 ${
                  formData.sport === sport.id 
                    ? 'bg-[#5E5CE6] text-white' 
                    : 'bg-white text-[#6E6E73] border border-[#E5E5EA] hover:border-[#5E5CE6]'
                }`}
              >
                <span className="text-xl">{sport.emoji}</span>
                <span>{sport.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Match Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-[#1D1D1F] ml-1">Partido o Equipos</label>
          <div className="relative flex items-center">
            <Search className="absolute left-4 text-[#AEAEB2] w-5 h-5" />
            <input
              value={formData.match_name}
              onChange={(e) => setFormData({ ...formData, match_name: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-[#F5F5F7] border border-[#E5E5EA] rounded-2xl focus:ring-2 focus:ring-[#5E5CE6] focus:border-transparent outline-none text-[#1D1D1F] placeholder:text-[#AEAEB2]"
              placeholder="Ej: Real Madrid vs Barcelona"
              type="text"
            />
          </div>
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-[#1D1D1F] ml-1">Fecha (Opcional)</label>
          <div className="relative flex items-center">
            <Calendar className="absolute left-4 text-[#AEAEB2] w-5 h-5" />
            <input
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-[#F5F5F7] border border-[#E5E5EA] rounded-2xl focus:ring-2 focus:ring-[#5E5CE6] focus:border-transparent outline-none text-[#1D1D1F] text-sm"
              type="date"
            />
          </div>
        </div>

        {/* Additional Context */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-[#1D1D1F] ml-1">Contexto Adicional</label>
          <textarea
            value={formData.user_context}
            onChange={(e) => setFormData({ ...formData, user_context: e.target.value })}
            className="w-full px-4 py-3 bg-[#F5F5F7] border border-[#E5E5EA] rounded-2xl focus:ring-2 focus:ring-[#5E5CE6] focus:border-transparent outline-none text-[#1D1D1F] placeholder:text-[#AEAEB2] resize-none text-sm"
            placeholder="Lesiones, clima, motivación del equipo, racha reciente..."
            rows={3}
          ></textarea>
        </div>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={loading || !formData.match_name}
          className="w-full py-4 bg-[#5E5CE6] hover:bg-[#4B49C8] text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ boxShadow: '0 2px 8px rgba(94,92,230,0.3)' }}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analizando...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
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
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#AEAEB2] mb-4 px-1">Resultado del Análisis</h3>
            
            <div className="bg-white rounded-3xl p-6 border border-[#E5E5EA]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' }}>
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-[10px] font-bold text-[#5E5CE6] uppercase tracking-wider mb-1">Mejor Value Bet</p>
                  <h4 className="text-xl font-bold text-[#1D1D1F] leading-tight">{result.selection}</h4>
                  <p className="text-sm text-[#6E6E73]">{result.matchName}</p>
                </div>
                <div className="bg-[#F0FFF4] text-[#34C759] px-3 py-1.5 rounded-full text-sm font-bold border border-[#34C759]/20">
                  +{result.edgePercent.toFixed(1)}% Edge
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#F5F5F7] p-4 rounded-2xl">
                  <p className="text-[10px] text-[#AEAEB2] uppercase font-bold mb-1">Confianza</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl font-bold text-[#1D1D1F]">{result.confidence}</span>
                    <span className="text-sm text-[#AEAEB2]">/ 10</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-[#E5E5EA] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#5E5CE6] rounded-full"
                      style={{ width: `${result.confidence * 10}%` }}
                    ></div>
                  </div>
                </div>
                <div className="bg-[#F5F5F7] p-4 rounded-2xl">
                  <p className="text-[10px] text-[#AEAEB2] uppercase font-bold mb-1">Cuota</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-[#1D1D1F]">{result.odds.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-[#6E6E73] mt-1">{result.bookmaker}</p>
                </div>
              </div>

              {/* Market Info */}
              <div className="bg-[#EEEEFF] p-3 rounded-xl mb-4 flex items-center justify-between">
                <span className="text-sm text-[#5E5CE6]">Mercado: <strong>{result.bestMarket}</strong></span>
                <span className="text-xs text-[#5E5CE6]/70">{result.sport}</span>
              </div>

              {/* Analysis Text */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[#1D1D1F] flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#5E5CE6]" />
                  Análisis
                </p>
                <p className="text-sm leading-relaxed text-[#6E6E73] bg-[#F5F5F7] rounded-xl p-4 italic">
                  "{result.analysisText}"
                </p>
              </div>

              {/* Save Button */}
              {!saved ? (
                <button
                  onClick={saveToHistory}
                  className="mt-6 w-full py-3 bg-[#34C759] hover:bg-[#2DB94D] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <TrendingUp className="w-4 h-4" />
                  Guardar en Historial
                </button>
              ) : (
                <div className="mt-6 w-full py-3 bg-[#F0FFF4] text-[#34C759] font-bold rounded-xl flex items-center justify-center gap-2 border border-[#34C759]/20">
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
