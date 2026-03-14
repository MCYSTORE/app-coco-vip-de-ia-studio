import React, { useState, useEffect } from 'react';
import { User as UserIcon, Mail, Shield, Settings, TrendingUp, Target, Trophy, Flame, DollarSign, BarChart3, Crown, Star, Trash2 } from 'lucide-react';
import { Prediction, UserStats } from '../types';
import { motion } from 'motion/react';

const STORAGE_KEY = 'coco_vip_predictions';

export default function Profile() {
  const [stats, setStats] = useState<UserStats>({
    totalPredictions: 0,
    won: 0,
    lost: 0,
    pending: 0,
    winRate: 0,
    roi: 0,
    profit: 0,
    avgOdds: 0,
    bestStreak: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const predictions: Prediction[] = JSON.parse(stored);
        
        const won = predictions.filter(p => p.status === 'won').length;
        const lost = predictions.filter(p => p.status === 'lost').length;
        const pending = predictions.filter(p => p.status === 'pending').length;
        const total = predictions.length;
        const settled = won + lost;
        
        const winRate = settled > 0 ? (won / settled) * 100 : 0;
        
        const profit = predictions
          .filter(p => p.status === 'won')
          .reduce((acc, p) => acc + ((p.odds || 1.85) - 1), 0);
        
        const losses = predictions.filter(p => p.status === 'lost').length;
        const netProfit = profit - losses;
        
        const roi = settled > 0 ? (netProfit / settled) * 100 : 0;
        
        const avgOdds = total > 0 
          ? predictions.reduce((acc, p) => acc + (p.odds || 1.85), 0) / total 
          : 0;

        setStats({
          totalPredictions: total,
          won,
          lost,
          pending,
          winRate,
          roi,
          profit: netProfit,
          avgOdds,
          bestStreak: calculateBestStreak(predictions)
        });
      } catch (e) {
        console.error("Error loading stats:", e);
      }
    }
    setLoading(false);
  }, []);

  const clearAllData = () => {
    if (confirm('¿Estás seguro de que quieres borrar todos los datos? Esta acción no se puede deshacer.')) {
      localStorage.removeItem(STORAGE_KEY);
      setStats({
        totalPredictions: 0,
        won: 0,
        lost: 0,
        pending: 0,
        winRate: 0,
        roi: 0,
        profit: 0,
        avgOdds: 0,
        bestStreak: 0
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex flex-col items-center py-6">
        <div className="relative mb-4">
          <div className="w-24 h-24 rounded-full p-1 shadow-lg" style={{ border: '2px solid #5E5CE6' }}>
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
              <UserIcon className="w-12 h-12 text-[#5E5CE6]" />
            </div>
          </div>
          {/* VIP Badge */}
          <div className="absolute -bottom-1 -right-1 bg-[#FF9500] rounded-full p-1.5 shadow-md">
            <Crown className="w-4 h-4 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-[#1D1D1F]">Usuario Coco</h2>
        <p className="text-[#6E6E73] text-sm">Modo Local</p>
        <div className="mt-2 px-3 py-1 rounded-full" style={{ border: '1px solid #5E5CE6' }}>
          <span className="text-[#5E5CE6] text-xs font-bold flex items-center gap-1">
            <Star className="w-3 h-3" />
            Miembro VIP
          </span>
        </div>
      </div>

      {/* Stats Overview - Black carbon background */}
      <div className="rounded-3xl p-6 text-white shadow-lg" style={{ backgroundColor: '#1C1C1E' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Rendimiento
          </h3>
          {!loading && (
            <span className="text-xs text-white/70">{stats.totalPredictions} predicciones</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-3xl font-bold">{stats.won}</div>
            <div className="text-xs text-white/70 uppercase font-medium">Ganados</div>
          </div>
          <div className="text-center border-x border-white/20">
            <div className="text-3xl font-bold">{stats.lost}</div>
            <div className="text-xs text-white/70 uppercase font-medium">Perdidos</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">{stats.pending}</div>
            <div className="text-xs text-white/70 uppercase font-medium">Pendientes</div>
          </div>
        </div>

        {/* Win Rate Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span>Win Rate</span>
            <span className="font-bold">{stats.winRate.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(stats.winRate, 100)}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ backgroundColor: '#34C759' }}
            ></motion.div>
          </div>
        </div>

        {/* Profit / ROI */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <div className="text-xl font-bold flex items-center justify-center gap-1">
              <DollarSign className="w-4 h-4" />
              {stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(1)}
            </div>
            <div className="text-[10px] text-white/70 uppercase">Profit (unidades)</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <div className="text-xl font-bold" style={{ color: stats.roi >= 0 ? '#34C759' : '#FF3B30' }}>
              {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
            </div>
            <div className="text-[10px] text-white/70 uppercase">ROI</div>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-[#E5E5EA]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-2 text-[#6E6E73] mb-2">
            <Target className="w-4 h-4" />
            <span className="text-xs font-medium">Cuota Promedio</span>
          </div>
          <div className="text-2xl font-bold text-[#1D1D1F]">{stats.avgOdds.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E5E5EA]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-2 text-[#6E6E73] mb-2">
            <Flame className="w-4 h-4" />
            <span className="text-xs font-medium">Mejor Racha</span>
          </div>
          <div className="text-2xl font-bold text-[#1D1D1F]">{stats.bestStreak} seguidas</div>
        </div>
      </div>

      {/* Settings Menu */}
      <div className="bg-white rounded-3xl p-4 border border-[#E5E5EA]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 hover:bg-[#F5F5F7] rounded-2xl transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEEEFF] flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#5E5CE6]" />
              </div>
              <div>
                <span className="font-medium text-[#1D1D1F] block">Notificaciones</span>
                <span className="text-xs text-[#AEAEB2]">Alertas de picks y resultados</span>
              </div>
            </div>
            <div className="w-12 h-7 rounded-full relative cursor-pointer" style={{ backgroundColor: '#34C759' }}>
              <div className="absolute right-1 top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all"></div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 hover:bg-[#F5F5F7] rounded-2xl transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEEEFF] flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#5E5CE6]" />
              </div>
              <div>
                <span className="font-medium text-[#1D1D1F] block">Privacidad</span>
                <span className="text-xs text-[#AEAEB2]">Configurar datos</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 hover:bg-[#F5F5F7] rounded-2xl transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] flex items-center justify-center">
                <Settings className="w-5 h-5 text-[#6E6E73]" />
              </div>
              <div>
                <span className="font-medium text-[#1D1D1F] block">Preferencias</span>
                <span className="text-xs text-[#AEAEB2]">Deportes y mercados favoritos</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clear Data Button */}
      <button
        onClick={clearAllData}
        className="w-full py-4 bg-[#FFF1F0] text-[#FF3B30] font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-[#FFE5E3] transition-colors border border-[#FF3B30]/20"
      >
        <Trash2 className="w-5 h-5" />
        Borrar Todos los Datos
      </button>

      {/* Version */}
      <div className="text-center text-xs text-[#AEAEB2] pb-4">
        Coco VIP v2.0 • Powered by API-Sports • Local Storage Mode
      </div>
    </div>
  );
}

// Calculate best winning streak
function calculateBestStreak(predictions: Prediction[]): number {
  if (!predictions.length) return 0;
  
  const sorted = [...predictions].sort((a, b) => 
    new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  );
  
  let maxStreak = 0;
  let currentStreak = 0;
  
  for (const p of sorted) {
    if (p.status === 'won') {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else if (p.status === 'lost') {
      currentStreak = 0;
    }
  }
  
  return maxStreak;
}
