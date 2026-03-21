/**
 * useAnalysisState Hook
 * 
 * Manages the 3-step analysis pipeline state for the UI
 * with animated progress and toast warnings.
 */

import { useState, useCallback } from 'react';

// Types from analyzeMatch.ts
export interface AnalysisStep {
  step: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  icon: string;
  message: string;
  progress: number;
  warning?: string;
}

export interface AnalysisResult {
  sport: 'Football' | 'NBA' | 'MLB';
  match: string;
  data_quality: 'alta' | 'media' | 'baja';
  estimated_odds: boolean;
  best_pick: {
    market: string;
    selection: string;
    odds: number;
    edge_percentage: number;
    confidence_score: number;
    tier: 'A+' | 'B';
    kelly_stake_units: number;
    value_bet: boolean;
    analysis: {
      pros: string[];
      cons: string[];
      conclusion: string;
    };
    stats_highlights: {
      metric_1: string;
      metric_2: string;
      metric_3: string;
    };
  };
  mercados_completos: any;
  picks_con_value: any[];
  supporting_factors: string[];
  risk_factors: string[];
  ajustes_aplicados: string[];
  fuentes_contexto: string[];
  timestamp: string;
}

export interface AnalysisState {
  currentStep: number;
  steps: AnalysisStep[];
  result: AnalysisResult | null;
  error: string | null;
}

const INITIAL_STEPS: AnalysisStep[] = [
  { step: 1, status: 'pending', icon: '🔍', message: 'Buscando cuotas en tiempo real...', progress: 15 },
  { step: 2, status: 'pending', icon: '📡', message: 'Investigando la web (Lesiones, xG, Noticias)...', progress: 45 },
  { step: 3, status: 'pending', icon: '🤖', message: 'DeepSeek calculando Edge y valor matemático...', progress: 80 }
];

export function useAnalysisState() {
  const [state, setState] = useState<AnalysisState>({
    currentStep: 0,
    steps: INITIAL_STEPS.map(s => ({ ...s, status: 'pending' as const })),
    result: null,
    error: null
  });

  const [warnings, setWarnings] = useState<string[]>([]);

  /**
   * Reset state to initial
   */
  const reset = useCallback(() => {
    setState({
      currentStep: 0,
      steps: INITIAL_STEPS.map(s => ({ ...s, status: 'pending' as const })),
      result: null,
      error: null
    });
    setWarnings([]);
  }, []);

  /**
   * Update a specific step's status
   */
  const updateStep = useCallback((stepNumber: number, status: AnalysisStep['status'], warning?: string) => {
    setState(prev => {
      const newSteps = prev.steps.map(s => {
        if (s.step === stepNumber) {
          return { ...s, status, warning };
        }
        if (s.step < stepNumber && s.status === 'pending') {
          return { ...s, status: 'completed' as const };
        }
        return s;
      });

      return {
        ...prev,
        currentStep: stepNumber,
        steps: newSteps
      };
    });

    if (warning) {
      setWarnings(prev => [...prev, `Step ${stepNumber}: ${warning}`]);
    }
  }, []);

  /**
   * Set final result
   */
  const setResult = useCallback((result: AnalysisResult) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(s => ({ ...s, status: 'completed' as const })),
      result
    }));
  }, []);

  /**
   * Set error
   */
  const setError = useCallback((error: string) => {
    setState(prev => ({
      ...prev,
      error
    }));
  }, []);

  /**
   * Get current progress percentage
   */
  const getProgress = useCallback(() => {
    const currentStepData = state.steps.find(s => s.step === state.currentStep);
    if (!currentStepData) return 0;
    
    if (currentStepData.status === 'completed' && state.currentStep === 3) {
      return 100;
    }
    
    return currentStepData.progress;
  }, [state]);

  /**
   * Get current loading message
   */
  const getCurrentMessage = useCallback(() => {
    const currentStepData = state.steps.find(s => s.step === state.currentStep);
    if (!currentStepData) return { icon: '⏳', message: 'Iniciando...' };
    return { icon: currentStepData.icon, message: currentStepData.message };
  }, [state]);

  /**
   * Run the full analysis pipeline
   */
  const analyze = useCallback(async (matchName: string, sport: 'football' | 'basketball' | 'baseball' = 'football') => {
    reset();

    try {
      // Step 1: Starting
      updateStep(1, 'running');

      // Make API call
      const response = await fetch('/api/analyze-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchName, sport })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Analysis failed');
      }

      // All steps completed by the server
      const result = await response.json();
      
      // Update steps to completed
      setState(prev => ({
        ...prev,
        steps: prev.steps.map(s => ({ ...s, status: 'completed' as const })),
        result
      }));

      return result;
    } catch (error: any) {
      setError(error.message);
      throw error;
    }
  }, [reset, updateStep, setError]);

  return {
    state,
    warnings,
    reset,
    updateStep,
    setResult,
    setError,
    getProgress,
    getCurrentMessage,
    analyze,
    // Computed properties
    isAnalyzing: state.currentStep > 0 && !state.result && !state.error,
    isComplete: state.result !== null,
    hasError: state.error !== null,
    hasWarnings: warnings.length > 0
  };
}

export default useAnalysisState;
