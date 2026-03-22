import React, { useState, useEffect } from 'react';
import {
  History as HistoryIcon, ExternalLink, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Clock, MinusCircle, TrendingUp, TrendingDown,
  Target, Zap, RefreshCw, ArrowLeft, ChevronRight, Sparkles, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
interface HistoryItem {
  rowIndex: number;
  id: string;
  fecha: string;
  hora: string;
  sport: string;
  partido: string;
  liga: string;
  data_quality: string;
  mercado: string;
  seleccion: string;
  cuota: number;
  edge: number;
  confianza: number;
  tier: string;
  kelly: number;
  resultado_probable: string;
  marcador_estimado: string;
  rango_goles: string;
  btts: string;
  pros: string[];
  contras: string;
  conclusion: string;
  stats: string[];
  razonamiento: string;
  contexto_tactico: string;
  contexto_stats: string;
  modelo: string;
  source: string;
  status: string;
  resultado_real: string;
  notas: string;
}

interface HistoryStats {
  total: number;
  won: number;
  lost: number;
  pending: number;
  void: number;
  roi: number;
}

// Supabase Dashboard URL
const SUPABASE_DASHBOARD_URL = 'https://supabase.com/dashboard/project/hrsjwpbamfszaldctbgv';

export default function History() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<HistoryStats>({ total: 0, won: 0, lost: 0, pending: 0, void: 0, roi: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  
  // Filters
  const [activeSport, setActiveSport] = useState('Todos');
  const [activeStatus, setActiveStatus] = useState('Todos');
  
  // Detail view
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [showRazonamiento, setShowRazonamiento] = useState(false);
  const [showContexto, setShowContexto] = useState(false);
  
  // Update status
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Fetch history on mount and when filters change
  useEffect(() => {
    fetchHistory();
  }, [activeSport, activeStatus]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (activeSport !== 'Todos') params.append('sport', activeSport);
      if (activeStatus !== 'Todos') params.append('status', activeStatus);
      
      const response = await fetch(`/api/history?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch history');
      }
      
      setItems(data.items || []);
      setStats(data.stats || { total: 0, won: 0, lost: 0, pending: 0, void: 0, roi: 0 });
      setConfigured(data.configured !== false);
      
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: 'won' | 'lost' | 'void') => {
    setUpdatingId(id);
    
    try {
      const response = await fetch('/api/history-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update local state
        setItems(prev => prev.map(item => 
          item.id === id ? { ...item, status: newStatus } : item
        ));
        
        // Update stats
        setStats(prev => {
          const oldStatus = items.find(i => i.id === id)?.status;
          const newStats = { ...prev };
          
          if (oldStatus === 'pending') newStats.pending--;
          else if (oldStatus === 'won') newStats.won--;
          else if (oldStatus === 'lost') newStats.lost--;
          else if (oldStatus === 'void') newStats.void--;
          
          if (newStatus === 'pending') newStats.pending++;
          else if (newStatus === 'won') newStats.won++;
          else if (newStatus === 'lost') newStats.lost++;
          else if (newStatus === 'void') newStats.void++;
          
          // Recalculate ROI
          const settled = newStats.won + newStats.lost;
          newStats.roi = settled > 0 ? ((newStats.won - newStats.lost) / settled) * 100 : 0;
          
          return newStats;
        });
        
        // Show confetti for won
        if (newStatus === 'won') {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
        }
        
        // Close detail view if open
        if (selectedItem?.id === id) {
          setSelectedItem({ ...selectedItem, status: newStatus });
        }
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Get sports for filter
  const sports = ['Todos', 'Football', 'NBA', 'MLB'];
  const statuses = ['Todos', 'pending', 'won', 'lost', 'void'];

  // Loading state
  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--color-accent-primary)' }}></div>
        <p className="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Cargando historial...</p>
      </div>
    );
  }

  // Not configured state
  if (!configured) {
    return (
      <div className="text-center py-20 px-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--color-warning-bg)' }}>
          <AlertTriangle className="w-8 h-8" style={{ color: 'var(--color-warning)' }} />
        </div>
        <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Supabase no configurado</h3>
        <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
          Añade las variables de entorno en Vercel:
        </p>
        <div className="mt-4 text-left max-w-sm mx-auto p-4 rounded-xl text-xs font-mono" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)' }}>
          <p>SUPABASE_URL</p>
          <p>SUPABASE_ANON_KEY</p>
          <p>SUPABASE_SERVICE_ROLE_KEY</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="text-center py-20 px-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
          <HistoryIcon className="w-8 h-8" style={{ color: 'var(--color-text-muted)' }} />
        </div>
        <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>No hay análisis</h3>
        <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>Tus análisis se guardarán aquí automáticamente.</p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Usa la pestaña Analysis para crear predicciones</p>
      </div>
    );
  }

  // Detail view
  if (selectedItem) {
    return (
      <DetailView
        item={selectedItem}
        onBack={() => setSelectedItem(null)}
        onUpdateStatus={(status) => updateStatus(selectedItem.id, status)}
        isUpdating={updatingId === selectedItem.id}
        showRazonamiento={showRazonamiento}
        setShowRazonamiento={setShowRazonamiento}
        showContexto={showContexto}
        setShowContexto={setShowContexto}
      />
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Confetti animation */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
          >
            <div className="text-6xl animate-bounce">🎉</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Historial</h2>
        <button
          onClick={() => window.open(SUPABASE_DASHBOARD_URL, '_blank')}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}
        >
          <ExternalLink className="w-4 h-4" />
          Abrir Supabase
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-2">
        <StatCard label="Total" value={stats.total} color="primary" />
        <StatCard label="✅" value={stats.won} color="success" />
        <StatCard label="❌" value={stats.lost} color="danger" />
        <StatCard label="⏳" value={stats.pending} color="muted" />
        <StatCard 
          label="ROI" 
          value={`${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%`} 
          color={stats.roi >= 0 ? 'success' : 'danger'} 
        />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Sport filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {sports.map((sport) => (
            <button
              key={sport}
              onClick={() => setActiveSport(sport)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                activeSport === sport ? 'text-white' : 'border'
              )}
              style={activeSport === sport 
                ? { backgroundColor: 'var(--color-accent-primary)' }
                : { backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }
              }
            >
              {sport === 'Todos' ? '🎯 Todos' : getSportEmoji(sport) + ' ' + sport}
            </button>
          ))}
        </div>

        {/* Status filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                activeStatus === status ? 'text-white' : 'border'
              )}
              style={activeStatus === status 
                ? { backgroundColor: getStatusColor(status) }
                : { backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }
              }
            >
              {getStatusEmoji(status)} {status === 'Todos' ? 'Todos' : status === 'pending' ? 'Pendiente' : status === 'won' ? 'Ganado' : status === 'lost' ? 'Perdido' : 'Void'}
            </button>
          ))}
        </div>
      </div>

      {/* Analysis List */}
      <div className="space-y-3">
        <AnimatePresence>
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => setSelectedItem(item)}
              className="rounded-2xl p-4 border transition-all cursor-pointer active:scale-[0.98]"
              style={{ 
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}
            >
              {/* Header row */}
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getSportEmoji(item.sport)}</span>
                  <span className="text-[11px] font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>{item.sport}</span>
                </div>
                <StatusBadge status={item.status} />
              </div>

              {/* Match name */}
              <h4 className="font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>{item.partido}</h4>
              <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>{item.liga} · {item.fecha} · {item.hora}</p>

              {/* Pick summary */}
              <div className="flex justify-between items-center mb-3 p-2 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--color-accent-primary)' }}>🎯 {item.seleccion}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.mercado} · Cuota {item.cuota}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg" style={{ color: 'var(--color-success)' }}>+{item.edge}%</p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Edge</p>
                </div>
              </div>

              {/* Metrics row */}
              <div className="flex justify-between items-center text-xs">
                <div className="flex gap-3">
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    Conf: <strong style={{ color: getConfidenceColor(item.confianza) }}>{item.confianza}/10</strong>
                  </span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    Tier: <strong style={{ color: item.tier === 'A+' ? 'var(--color-success)' : 'var(--color-warning)' }}>{item.tier}</strong>
                  </span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    Kelly: <strong>{item.kelly}</strong>
                  </span>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DETAIL VIEW COMPONENT
// ═══════════════════════════════════════════════════════════════

function DetailView({ 
  item, 
  onBack, 
  onUpdateStatus,
  isUpdating,
  showRazonamiento,
  setShowRazonamiento,
  showContexto,
  setShowContexto
}: { 
  item: HistoryItem; 
  onBack: () => void;
  onUpdateStatus: (status: 'won' | 'lost' | 'void') => void;
  isUpdating: boolean;
  showRazonamiento: boolean;
  setShowRazonamiento: (v: boolean) => void;
  showContexto: boolean;
  setShowContexto: (v: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-xl transition-colors"
          style={{ backgroundColor: 'var(--color-bg-secondary)' }}
        >
          <ArrowLeft className="w-5 h-5" style={{ color: 'var(--color-text-primary)' }} />
        </button>
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{item.partido}</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{item.liga} · {item.fecha}</p>
        </div>
      </div>

      {/* Best Pick Summary */}
      <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Mejor Pick</p>
            <h3 className="text-2xl font-bold" style={{ color: 'var(--color-accent-primary)' }}>{item.seleccion}</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{item.mercado}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold" style={{ color: 'var(--color-success)' }}>{item.cuota}</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>cuota</p>
          </div>
        </div>

        {/* Key metrics grid */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="text-center p-2 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
            <p className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>+{item.edge}%</p>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Edge</p>
          </div>
          <div className="text-center p-2 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
            <p className="text-lg font-bold" style={{ color: getConfidenceColor(item.confianza) }}>{item.confianza}/10</p>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Confianza</p>
          </div>
          <div className="text-center p-2 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
            <p className="text-lg font-bold" style={{ color: item.tier === 'A+' ? 'var(--color-success)' : 'var(--color-warning)' }}>{item.tier}</p>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Tier</p>
          </div>
          <div className="text-center p-2 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
            <p className="text-lg font-bold" style={{ color: 'var(--color-accent-primary)' }}>{item.kelly}</p>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Kelly</p>
          </div>
        </div>

        {/* Projection */}
        <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Proyección</p>
          <div className="flex gap-4 text-sm">
            <span style={{ color: 'var(--color-text-secondary)' }}>Resultado: <strong>{item.resultado_probable}</strong></span>
            <span style={{ color: 'var(--color-text-secondary)' }}>Score: <strong>{item.marcador_estimado}</strong></span>
            <span style={{ color: 'var(--color-text-secondary)' }}>BTTS: <strong>{item.btts}</strong></span>
          </div>
        </div>
      </div>

      {/* Pros / Cons / Conclusion */}
      <div className="rounded-2xl p-4 border space-y-4" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
        {/* Pros */}
        {item.pros.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-success)' }}>✓ Factores a favor</p>
            <ul className="space-y-1">
              {item.pros.map((pro, i) => (
                <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                  <span style={{ color: 'var(--color-success)' }}>•</span>
                  {pro}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cons */}
        {item.contras && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-danger)' }}>✗ Riesgo principal</p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{item.contras}</p>
          </div>
        )}

        {/* Conclusion */}
        {item.conclusion && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-accent-primary)' }}>📝 Conclusión</p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{item.conclusion}</p>
          </div>
        )}
      </div>

      {/* Stats Highlights */}
      {item.stats.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {item.stats.map((stat, i) => (
            <div key={i} className="rounded-xl p-3 text-center border" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{stat}</p>
            </div>
          ))}
        </div>
      )}

      {/* Razonamiento Accordion */}
      {item.razonamiento && (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
          <button
            onClick={() => setShowRazonamiento(!showRazonamiento)}
            className="w-full p-4 flex justify-between items-center"
          >
            <span className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>🧠 Razonamiento completo</span>
            {showRazonamiento ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {showRazonamiento && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 pt-0 text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                  {item.razonamiento}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Contexto Accordion */}
      {(item.contexto_tactico || item.contexto_stats) && (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
          <button
            onClick={() => setShowContexto(!showContexto)}
            className="w-full p-4 flex justify-between items-center"
          >
            <span className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>📡 Contexto de Perplexity</span>
            {showContexto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {showContexto && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 pt-0 text-sm space-y-3">
                  {item.contexto_tactico && (
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Contexto Táctico</p>
                      <p className="whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>{item.contexto_tactico}</p>
                    </div>
                  )}
                  {item.contexto_stats && (
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Contexto Estadístico</p>
                      <p className="whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>{item.contexto_stats}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Update Result Button */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-center" style={{ color: 'var(--color-text-muted)' }}>Actualizar resultado</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onUpdateStatus('won')}
            disabled={isUpdating}
            className="py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}
          >
            ✅ Ganado
          </button>
          <button
            onClick={() => onUpdateStatus('lost')}
            disabled={isUpdating}
            className="py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
          >
            ❌ Perdido
          </button>
          <button
            onClick={() => onUpdateStatus('void')}
            disabled={isUpdating}
            className="py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
          >
            ⬜ Void
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div className="text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <p>Analizado por {item.modelo} · {item.source}</p>
        {item.data_quality && <p className="mt-1">Calidad de datos: {item.data_quality}</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorMap = {
    primary: { bg: 'var(--color-bg-secondary)', text: 'var(--color-accent-primary)' },
    success: { bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
    danger: { bg: 'var(--color-danger-bg)', text: 'var(--color-danger)' },
    muted: { bg: 'var(--color-bg-secondary)', text: 'var(--color-text-muted)' }
  };
  
  const c = colorMap[color] || colorMap.primary;
  
  return (
    <div className="rounded-xl p-2 text-center border" style={{ backgroundColor: c.bg, borderColor: c.text + '20' }}>
      <div className="text-lg font-bold" style={{ color: c.text }}>{value}</div>
      <div className="text-[9px] uppercase font-bold" style={{ color: c.text }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { emoji: '⏳', label: 'Pending', bg: 'var(--color-bg-secondary)', text: 'var(--color-text-muted)' },
    won: { emoji: '✅', label: 'Won', bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
    lost: { emoji: '❌', label: 'Lost', bg: 'var(--color-danger-bg)', text: 'var(--color-danger)' },
    void: { emoji: '⬜', label: 'Void', bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' }
  };
  
  const c = config[status as keyof typeof config] || config.pending;
  
  return (
    <span className="px-2 py-1 rounded-lg text-[10px] font-bold" style={{ backgroundColor: c.bg, color: c.text }}>
      {c.emoji} {c.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getSportEmoji(sport: string): string {
  switch (sport?.toLowerCase()) {
    case 'football': return '⚽';
    case 'basketball': 
    case 'nba': return '🏀';
    case 'baseball': 
    case 'mlb': return '⚾';
    default: return '🎯';
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'pending': return '⏳';
    case 'won': return '✅';
    case 'lost': return '❌';
    case 'void': return '⬜';
    default: return '📋';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'pending': return 'var(--color-text-muted)';
    case 'won': return 'var(--color-success)';
    case 'lost': return 'var(--color-danger)';
    case 'void': return 'var(--color-warning)';
    default: return 'var(--color-accent-primary)';
  }
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 8) return 'var(--color-success)';
  if (confidence >= 6) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
