import React, { useState, useEffect } from 'react';
import { User as UserIcon, Mail, Shield, Settings, Target, Flame, DollarSign, BarChart3, Crown, Star, Trash2, Wallet, Info, Save, Trophy, RefreshCw, Database, Clock, CheckCircle, XCircle, Sun, Moon, LogOut } from 'lucide-react';
import { Prediction, UserStats, getBankroll, saveBankroll, DEFAULT_BANKROLL } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

const STORAGE_KEY = 'coco_vip_predictions';

interface CacheStatus {
  hasCache: boolean;
  lastUpdated: string | null;
  totalEntries: number;
  todayEntries: number;
  sportsBreakdown: Record<string, number>;
}

export default function Profile() {
  const { user, signOut } = useAuth();
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
  const [bankroll, setBankrollState] = useState<number>(DEFAULT_BANKROLL);
  const [bankrollInput, setBankrollInput] = useState<string>('');
  const [bankrollSaved, setBankrollSaved] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshLogs, setRefreshLogs] = useState<string[]>([]);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const { theme, toggleTheme } = useTheme();

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
    
    // Load bankroll
    const savedBankroll = getBankroll();
    setBankrollState(savedBankroll);
    setBankrollInput(savedBankroll.toString());

    // Load cache status
    fetchCacheStatus();

    setLoading(false);
  }, []);

  const fetchCacheStatus = async () => {
    try {
      const response = await fetch('/api/cache-status');
      const data = await response.json();
      setCacheStatus(data);
    } catch (error) {
      console.error("Error fetching cache status:", error);
    }
  };

  const handleRefreshCache = async (force = false) => {
    setRefreshing(true);
    setRefreshLogs(['🔄 Iniciando actualización de caché...']);

    try {
      const response = await fetch('/api/daily-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force })
      });

      const data = await response.json();

      if (data.logs) {
        setRefreshLogs(data.logs);
      }

      if (data.success) {
        setRefreshLogs(prev => [...prev, '✅ Caché actualizado correctamente']);
        // Refresh cache status
        await fetchCacheStatus();
      } else {
        setRefreshLogs(prev => [...prev, `❌ Error: ${data.message || data.error}`]);
      }
    } catch (error: any) {
      setRefreshLogs(prev => [...prev, `❌ Error: ${error.message}`]);
    } finally {
      setRefreshing(false);
    }
  };

  const formatLastUpdated = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 24) {
      return `Hace ${Math.floor(diffHours / 24)} días`;
    } else if (diffHours > 0) {
      return `Hace ${diffHours}h ${diffMins}m`;
    } else {
      return `Hace ${diffMins} minutos`;
    }
  };

  const handleSaveBankroll = () => {
    const value = parseFloat(bankrollInput);
    if (isNaN(value) || value <= 0) {
      return;
    }
    saveBankroll(value);
    setBankrollState(value);
    setBankrollSaved(true);
    setTimeout(() => setBankrollSaved(false), 2000);
  };

  const clearAllData = () => {
    if (confirm('¿Estás seguro de que quieres borrar todos los datos? Esta acción no se puede deshacer.')) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('coco_vip_bankroll');
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
      setBankrollState(DEFAULT_BANKROLL);
      setBankrollInput(DEFAULT_BANKROLL.toString());
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex flex-col items-center py-6">
        <div className="relative mb-4">
          <div 
            className="w-24 h-24 rounded-full p-1 shadow-lg" 
            style={{ border: '2px solid var(--color-accent-primary)' }}
          >
            <div 
              className="w-full h-full rounded-full flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: 'var(--color-bg-card)' }}
            >
              <UserIcon className="w-12 h-12" style={{ color: 'var(--color-accent-primary)' }} />
            </div>
          </div>
          {/* VIP Badge - Gold */}
          <div 
            className="absolute -bottom-1 -right-1 rounded-full p-1.5 shadow-md"
            style={{ backgroundColor: 'var(--color-accent-gold)' }}
          >
            <Crown className="w-4 h-4 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{user?.email?.split('@')[0] || 'Usuario'}</h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{user?.email || 'Modo Local'}</p>
        <div 
          className="mt-2 px-3 py-1 rounded-full"
          style={{ border: '1px solid var(--color-accent-gold)' }}
        >
          <span className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--color-accent-gold)' }}>
            <Star className="w-3 h-3" />
            Miembro VIP
          </span>
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={signOut}
        className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
        style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}
      >
        <LogOut className="w-5 h-5" />
        Cerrar Sesión
      </button>

      {/* Stats Overview - Carbon card */}
      <div className="carbon-card rounded-3xl p-6 shadow-lg">
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
              style={{ backgroundColor: 'var(--color-success)' }}
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
            <div 
              className="text-xl font-bold"
              style={{ color: stats.roi >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
            >
              {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
            </div>
            <div className="text-[10px] text-white/70 uppercase">ROI</div>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            <Target className="w-4 h-4" />
            <span className="text-xs font-medium">Cuota Promedio</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{stats.avgOdds.toFixed(2)}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            <Flame className="w-4 h-4" />
            <span className="text-xs font-medium">Mejor Racha</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{stats.bestStreak} seguidas</div>
        </div>
      </div>

      {/* Bankroll Management Section */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-bg-secondary)' }}
          >
            <Wallet className="w-5 h-5" style={{ color: 'var(--color-accent-primary)' }} />
          </div>
          <div>
            <h3 className="font-bold" style={{ color: 'var(--color-text-primary)' }}>Gestión de Bankroll</h3>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Configura tu bankroll para recomendaciones de stake</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
              Bankroll actual (en unidades)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                <input
                  type="number"
                  value={bankrollInput}
                  onChange={(e) => setBankrollInput(e.target.value)}
                  className="input-field w-full pl-9 pr-4 py-3 font-medium focus:outline-none transition-all"
                  placeholder="100"
                  min="1"
                  step="1"
                />
              </div>
              <button
                onClick={handleSaveBankroll}
                disabled={bankrollSaved}
                className={`px-4 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 btn-primary ${
                  bankrollSaved ? '' : ''
                }`}
                style={bankrollSaved ? { backgroundColor: 'var(--color-success)' } : {}}
              >
                {bankrollSaved ? (
                  <>
                    <Trophy className="w-4 h-4" />
                    Guardado
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </div>

          <div 
            className="flex items-start gap-2 p-3 rounded-xl"
            style={{ backgroundColor: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)' }}
          >
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Las recomendaciones de stake se calculan usando el <strong style={{ color: 'var(--color-text-primary)' }}>Criterio de Kelly</strong> basado en este bankroll. Unidades = porcentaje de tu bankroll total.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between text-sm">
            <span style={{ color: 'var(--color-text-secondary)' }}>Bankroll configurado:</span>
            <span className="font-bold" style={{ color: 'var(--color-accent-primary)' }}>{bankroll} unidades</span>
          </div>
        </div>
      </div>

      {/* Cache Management Section */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-bg-secondary)' }}
          >
            <Database className="w-5 h-5" style={{ color: 'var(--color-accent-primary)' }} />
          </div>
          <div>
            <h3 className="font-bold" style={{ color: 'var(--color-text-primary)' }}>Caché de Datos</h3>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Datos de partidos guardados en Google Sheets</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Cache Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
              <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                <Clock className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase font-bold">Actualizado</span>
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {cacheStatus?.hasCache ? formatLastUpdated(cacheStatus.lastUpdated) : 'Sin datos'}
              </p>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
              <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                <Database className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase font-bold">Entradas hoy</span>
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {cacheStatus?.todayEntries || 0}
              </p>
            </div>
          </div>

          {/* Sports Breakdown */}
          {cacheStatus?.sportsBreakdown && Object.keys(cacheStatus.sportsBreakdown).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {cacheStatus.sportsBreakdown.football > 0 && (
                <span 
                  className="px-2.5 py-1 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  ⚽ {cacheStatus.sportsBreakdown.football}
                </span>
              )}
              {cacheStatus.sportsBreakdown.basketball > 0 && (
                <span 
                  className="px-2.5 py-1 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  🏀 {cacheStatus.sportsBreakdown.basketball}
                </span>
              )}
              {cacheStatus.sportsBreakdown.baseball > 0 && (
                <span 
                  className="px-2.5 py-1 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  ⚾ {cacheStatus.sportsBreakdown.baseball}
                </span>
              )}
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => setShowRefreshModal(true)}
            disabled={refreshing}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {refreshing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Actualizando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Actualizar Caché Diario
              </>
            )}
          </button>
        </div>
      </div>

      {/* Settings Menu */}
      <div className="card p-4">
        <div className="space-y-2">
          {/* Theme Toggle - NEW */}
          <div 
            className="flex items-center justify-between p-3 rounded-2xl transition-colors cursor-pointer"
            style={{ backgroundColor: 'var(--color-bg-secondary)' }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--color-bg-card)' }}
              >
                {theme === 'light' ? (
                  <Sun className="w-5 h-5" style={{ color: 'var(--color-accent-gold)' }} />
                ) : (
                  <Moon className="w-5 h-5" style={{ color: 'var(--color-accent-primary)' }} />
                )}
              </div>
              <div>
                <span className="font-medium block" style={{ color: 'var(--color-text-primary)' }}>Apariencia</span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {theme === 'light' ? 'Modo claro' : 'Modo oscuro'}
                </span>
              </div>
            </div>
            {/* Toggle Switch */}
            <button
              onClick={toggleTheme}
              className="w-12 h-7 rounded-full relative cursor-pointer transition-all"
              style={{ backgroundColor: theme === 'dark' ? 'var(--color-accent-primary)' : 'var(--color-border)' }}
            >
              <motion.div
                className="absolute top-1 w-5 h-5 rounded-full shadow-sm transition-all"
                style={{ backgroundColor: 'var(--color-bg-card)' }}
                animate={{ left: theme === 'dark' ? '26px' : '4px' }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          <div 
            className="flex items-center justify-between p-3 rounded-2xl transition-colors cursor-pointer"
            style={{ backgroundColor: 'transparent' }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
              >
                <Mail className="w-5 h-5" style={{ color: 'var(--color-accent-primary)' }} />
              </div>
              <div>
                <span className="font-medium block" style={{ color: 'var(--color-text-primary)' }}>Notificaciones</span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Alertas de picks y resultados</span>
              </div>
            </div>
            <div 
              className="w-12 h-7 rounded-full relative cursor-pointer"
              style={{ backgroundColor: 'var(--color-success)' }}
            >
              <div 
                className="absolute right-1 top-1 w-5 h-5 rounded-full shadow-sm transition-all"
                style={{ backgroundColor: 'var(--color-bg-card)' }}
              />
            </div>
          </div>
          <div 
            className="flex items-center justify-between p-3 rounded-2xl transition-colors cursor-pointer"
            style={{ backgroundColor: 'transparent' }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
              >
                <Shield className="w-5 h-5" style={{ color: 'var(--color-accent-primary)' }} />
              </div>
              <div>
                <span className="font-medium block" style={{ color: 'var(--color-text-primary)' }}>Privacidad</span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Configurar datos</span>
              </div>
            </div>
          </div>
          <div 
            className="flex items-center justify-between p-3 rounded-2xl transition-colors cursor-pointer"
            style={{ backgroundColor: 'transparent' }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
              >
                <Settings className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
              </div>
              <div>
                <span className="font-medium block" style={{ color: 'var(--color-text-primary)' }}>Preferencias</span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Deportes y mercados favoritos</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clear Data Button */}
      <button
        onClick={clearAllData}
        className="badge-danger w-full py-4 font-bold rounded-2xl flex items-center justify-center gap-3 hover:opacity-80 transition-opacity"
      >
        <Trash2 className="w-5 h-5" />
        Borrar Todos los Datos
      </button>

      {/* Version */}
      <div className="text-center text-xs pb-4" style={{ color: 'var(--color-text-muted)' }}>
        Coco VIP v2.0 • Powered by API-Sports • Local Storage Mode
      </div>

      {/* Refresh Modal */}
      <AnimatePresence>
        {showRefreshModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !refreshing && setShowRefreshModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-3xl p-6 max-w-sm w-full shadow-2xl"
              style={{ backgroundColor: 'var(--color-bg-card)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                >
                  <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} style={{ color: 'var(--color-accent-primary)' }} />
                </div>
                <div>
                  <h3 className="font-bold" style={{ color: 'var(--color-text-primary)' }}>Actualizar Caché</h3>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Refrescar datos de partidos</p>
                </div>
              </div>

              {/* Logs */}
              <div 
                className="rounded-xl p-3 mb-4 max-h-48 overflow-y-auto"
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
              >
                {refreshLogs.length === 0 ? (
                  <p className="text-xs text-center" style={{ color: 'var(--color-text-secondary)' }}>
                    Presiona actualizar para comenzar
                  </p>
                ) : (
                  <div className="space-y-1">
                    {refreshLogs.map((log, i) => (
                      <p key={i} className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                        {log}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRefreshModal(false)}
                  disabled={refreshing}
                  className="flex-1 py-3 font-bold rounded-xl transition-all disabled:opacity-50"
                  style={{ 
                    backgroundColor: 'var(--color-bg-secondary)', 
                    color: 'var(--color-text-secondary)' 
                  }}
                >
                  Cerrar
                </button>
                <button
                  onClick={() => handleRefreshCache(false)}
                  disabled={refreshing}
                  className="btn-primary flex-1 py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {refreshing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Actualizar
                    </>
                  )}
                </button>
              </div>

              {/* Force Refresh Option */}
              {!refreshing && (
                <button
                  onClick={() => handleRefreshCache(true)}
                  className="w-full mt-2 py-2 text-xs font-medium hover:underline"
                  style={{ color: 'var(--color-warning)' }}
                >
                  Forzar actualización (ignorar límite)
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
