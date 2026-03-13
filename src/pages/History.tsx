import React, { useState, useEffect } from 'react';
import { Prediction } from '../types';
import { History as HistoryIcon, Trophy, CheckCircle, XCircle, Clock, ChevronDown, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY = 'coco_vip_predictions';

export default function History() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<'all' | 'pending' | 'won' | 'lost'>('all');

  useEffect(() => {
    // Load predictions from localStorage
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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#895af6]"></div>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="text-center py-20 px-6">
        <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <HistoryIcon className="text-slate-400 w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">No hay historial</h3>
        <p className="text-slate-500 text-sm mt-2">Tus análisis se guardarán aquí automáticamente.</p>
        <p className="text-slate-400 text-xs mt-1">Usa la pestaña Analysis para crear predicciones</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-slate-900">Historial</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {predictions.length} ANÁLISIS
          </span>
          {predictions.length > 0 && (
            <button
              onClick={clearHistory}
              className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Borrar historial"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-xl p-3 text-center border border-slate-100 shadow-sm">
          <div className="text-xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-[9px] text-slate-400 uppercase font-bold">Total</div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
          <div className="text-xl font-bold text-emerald-600">{stats.won}</div>
          <div className="text-[9px] text-emerald-600 uppercase font-bold">Ganados</div>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
          <div className="text-xl font-bold text-red-500">{stats.lost}</div>
          <div className="text-[9px] text-red-500 uppercase font-bold">Perdidos</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
          <div className="text-xl font-bold text-[#895af6]">{stats.winRate.toFixed(0)}%</div>
          <div className="text-[9px] text-[#895af6] uppercase font-bold">Win Rate</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {(['all', 'pending', 'won', 'lost'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setActiveStatus(status)}
            className={cn(
              "flex-shrink-0 px-4 py-2 rounded-xl font-medium text-sm transition-all",
              activeStatus === status 
                ? status === 'won' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
                  status === 'lost' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' :
                  status === 'pending' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' :
                  'bg-[#895af6] text-white shadow-lg shadow-[#895af6]/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
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
                "bg-white rounded-2xl p-4 shadow-sm border-l-4 transition-all",
                bet.status === 'won' ? "border-emerald-500" : 
                bet.status === 'lost' ? "border-red-500" : "border-amber-400"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getSportEmoji(bet.sport)}</span>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">{bet.sport}</span>
                </div>
                <div className="flex items-center gap-1">
                  <StatusDropdown 
                    status={bet.status} 
                    onStatusChange={(newStatus) => updateStatus(bet.id, newStatus)} 
                  />
                  <button
                    onClick={() => deletePrediction(bet.id)}
                    className="p-1 text-slate-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h4 className="font-bold text-slate-800">{bet.matchName}</h4>
                  <p className="text-sm text-slate-500">
                    <strong className="text-[#895af6]">{bet.selection}</strong> @ {bet.odds?.toFixed(2) || '1.85'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[#895af6] font-bold text-lg">+{bet.edgePercent?.toFixed(1) || '8.5'}%</div>
                  <div className="text-[10px] text-slate-400 font-medium">Edge</div>
                </div>
              </div>

              {/* Confidence Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-400">Confianza</span>
                  <span className="font-bold text-slate-600">{bet.confidence || 7}/10</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      (bet.confidence || 7) >= 8 ? "bg-emerald-500" :
                      (bet.confidence || 7) >= 6 ? "bg-amber-500" : "bg-red-400"
                    )}
                    style={{ width: `${(bet.confidence || 7) * 10}%` }}
                  ></div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {bet.createdAt ? format(new Date(bet.createdAt), 'MMM d, HH:mm') : 'Reciente'}
                </span>
                <span className="text-slate-400">{bet.bookmaker || 'General'}</span>
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
    pending: { label: 'Pendiente', icon: Clock, color: 'bg-amber-50 text-amber-600' },
    won: { label: 'Ganado', icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
    lost: { label: 'Perdido', icon: XCircle, color: 'bg-red-50 text-red-500' }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 transition-all",
          config.color
        )}
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
              className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-20 min-w-[120px]"
            >
              {(['pending', 'won', 'lost'] as const).map((s) => {
                const c = statusConfig[s];
                const I = c.icon;
                return (
                  <button
                    key={s}
                    onClick={() => { onStatusChange(s); setOpen(false); }}
                    className={cn(
                      "w-full px-4 py-2.5 text-left text-xs font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors",
                      status === s && "bg-slate-50"
                    )}
                  >
                    <I className="w-3 h-3" />
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
