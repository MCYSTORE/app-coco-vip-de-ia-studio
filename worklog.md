# Coco VIP - Work Log

---
Task ID: 8
Agent: Main Agent
Task: FIX - Prompts dinámicos por deporte en API + Supabase error handling

Work Log:
- FIX 1: Template Sección B NBA
  - `parseNBAReport()` ahora parsea oRTG, dRTG, Pace, NetRTG del texto
  - `analyzeNBA()` añade `teams_stats` y `nbaStats` al resultado
  - Frontend `NBAStatsSection` ya existe y muestra stats condicionalmente
- FIX 2: Gemini fallback automático
  - Si respuesta vacía o < 50 chars, reintenta con query alternativa
  - Fallback usa basketball-reference.com, nba.com/stats
  - Nunca devuelve "Sin datos de contexto" sin intentar 2 veces
- FIX 3: Supabase insert condicional
  - Spread operator condicional por deporte
  - NBA fields solo si basketball, Football fields solo si football
  - Log detallado de error con código, mensaje, hint, datos enviados
- FIX RAÍZ: Variable deporte NO se usaba en los prompts
  - Creados prompts separados: GEMINI_SYSTEM_PROMPT_FOOTBALL y _NBA
  - Creados prompts separados: SONAR_SYSTEM_PROMPT_FOOTBALL y _NBA
  - Funciones selectoras: getGeminiPrompt(sport), getSonarPrompt(sport)
  - Corners solo se busca si sport === 'football'
- Commits: 81f5d04, 90b6545

Stage Summary:
- El deporte seleccionado por usuario AHORA llega a los modelos
- NBA: queries a ESPN, NBA.com, basketball-reference
- Fútbol: queries sin cambios (NO TOCADO)
- Template visual condicional funcionando
- Supabase con mejor manejo de errores

---
Task ID: 7
Agent: Main Agent
Task: Corregir pipeline NBA con prompts específicos y reglas de probabilidad

Work Log:
- Modificado `/lib/nbaAnalysis.ts`:
  - Sección A: Nuevo prompt específico para Gemini 2.5 Pro con Google Search
    - Búsqueda obligatoria de lesionados: "[equipo] injury report today NBA 2026"
    - Forma reciente con estructura detallada (últimos 5 partidos)
    - Detección de back-to-back y fatiga de calendario
    - REGLA: No devuelve "Sin datos" sin intentar 3 queries distintas
  - Sección B: Nuevo prompt para Sonar Pro
    - Stats avanzadas NBA: oRTG, dRTG, NetRTG, Pace, eFG%
    - NO busca corners ni xG (eso es fútbol)
    - Lesionados confirmados con fuentes: ESPN, Rotowire, NBA.com
    - Tendencias ATS y Over/Under
  - Llamadas paralelas: Promise.all([Gemini, Sonar Pro])
- Modificado `/lib/nbaQuantModel.ts`:
  - REGLA CRÍTICA: Edge máximo 20%
  - Fórmula de probabilidad: prob_home = 0.50 + (NetRTG_diff × 0.02) + 0.03
  - Ajustes: Lesiones estrella (-5%), Back-to-back (-3%), H2H (±2%)
  - confidence_score SIEMPRE entre 0.0 y 1.0
  - Edge > 20% → se ajusta a 20% con nota
- Push a GitHub: commit 837cfd6

Stage Summary:
- Pipeline NBA corregido con prompts específicos
- NO se modificó el pipeline de fútbol
- Modelo cuantitativo con límites de edge
- Fuentes específicas para cada tipo de dato
- TypeScript compila sin errores

---
Task ID: 6
Agent: Main Agent
Task: Create NBA Quantitative Model for betting projections

Work Log:
- Created `/lib/nbaQuantModel.ts` - NBA Quantitative Model module
  - Complete TypeScript interfaces for NBA schema:
    - NBAQuantResult, NBATeamStatsQuant, NBAGameTotalMarket, NBASpreadMarket
    - NBAPlayerProp, NBABestPick, NBATotalsMarkets
  - `runNBAQuantModel()` - Main function that processes research + odds → structured JSON
  - `convertNBAQuantToAnalysisResult()` - Converts NBA schema to app's AnalysisResult format
  - `formatNBAQuantResult()` - Human-readable output for debugging
  - Team abbreviation helper for game_id generation
  - Default fallback result for error handling
- Updated `/lib/analyzeMatch.ts`:
  - Added import for nbaQuantModel functions
  - Modified `analyzeNBA()` to use NBA-specific quant model instead of football's runQuantAnalysis
  - Pipeline now: Odds → NBA Research → NBA Quant Model → Grok validation
- Verified TypeScript compilation (no errors)

Stage Summary:
- NBA Quant Model produces structured JSON with:
  - teams_stats (pace, ORtg, DRtg, NetRtg, PPG, ATS record, injuries, back-to-back)
  - totals_markets (game_total, team_totals with projections, probabilities, edges, Kelly)
  - spread_market (fair spread, cover probabilities, edge calculations)
  - player_props (2-4 relevant players with projections)
  - best_pick (optimal market selection with confidence 0.0-1.0)
- All calculations follow formulas specified:
  - model_projection = pace × (ORtg_home/100 + ORtg_away/100)
  - model_fair_spread = NetRtg_home - NetRtg_away + 3
  - Kelly = (prob × odds - 1) / (odds - 1)
- confidence_score ALWAYS between 0.0 and 1.0 (validated and normalized)
- Respects restriction: NO modification to existing football pipeline steps

---
Task ID: 5
Agent: Main Agent
Task: Create independent NBA research module for sports betting analysis

Work Log:
- Created `/lib/nbaAnalysis.ts` - New independent NBA research module
  - Interfaces: NBAAnalysisOptions, NBATeamForm, NBATeamStats, NBAInjuryReport, NBAMarketTrends, NBAResearchResult
  - Uses Perplexity Sonar Pro for real-time web search
  - Generates text report for downstream model consumption
  - Follows exact 5-section format requested:
    1. Recent form (last 5 games per team)
    2. Advanced team statistics (ORtg, DRtg, NetRtg, Pace, eFG%, etc.)
    3. Injuries and rest (back-to-back, 3-in-4, 4-in-6 nights)
    4. Market trends (Over/Under %, ATS record)
    5. Quantitative summary for model
- Added `analyzeNBA()` function to `/lib/analyzeMatch.ts`
  - Independent pipeline from football (does NOT modify existing steps)
  - Pipeline: Odds API → NBA Research (Sonar Pro) → Claude Sonnet → Grok validation
- Verified TypeScript compilation (no errors in new files)

Stage Summary:
- New NBA module at `/lib/nbaAnalysis.ts` with `runNBAResearch()` and `fetchNBAResearch()` functions
- New `analyzeNBA()` export in `/lib/analyzeMatch.ts`
- Uses same infrastructure (Odds API, OpenRouter, Claude, Grok) but with NBA-specific prompts
- All prompts in Spanish as requested
- Respects restriction: NO modification to existing Step 1, 2A, 2B, 3, 4 for football

---
Task ID: 1
Agent: Main Agent
Task: Configure API keys and push AI-driven 3-step analysis pipeline to GitHub

Work Log:
- Verified existing project structure in `/home/z/my-project/app-coco-vip-de-ia-studio/`
- Confirmed `lib/analyzeMatch.ts` already implements the 3-step pipeline:
  - Step 1: The Odds API (real-time odds from Bet365, Pinnacle, Betfair)
  - Step 2: Perplexity via OpenRouter (Research Agent for web data)
  - Step 3: DeepSeek R1 via OpenRouter (Quant/Sniper Agent for value calculation)
- Updated `.env` file with new API keys:
  - ODDS_API_KEY: 714f29cea0ad08ee1234a255c69f1e8c
  - OPENROUTER_API_KEY: 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
- Updated `.env.example` with new environment variable documentation
- Created `/api/analyze-v2.js` endpoint for Vercel serverless deployment
- Verified `/api/analyze-v2` route already exists in `server.ts` for local development
- Verified `useAnalysisState.ts` hook already exists for UI loading states
- Committed changes with message: "feat: Add AI-driven 3-step analysis pipeline"
- Pushed to GitHub: https://github.com/MCYSTORE/app-coco-vip-de-ia-studio.git

Stage Summary:
- All API keys configured locally in `.env` (not committed for security)
- GitHub updated with commit 30903a0
- Architecture ready for deployment:
  - `/lib/analyzeMatch.ts` - Main analysis service
  - `/api/analyze-v2.js` - Serverless endpoint
  - `/api/analyze-v2` (server.ts) - Local development endpoint
  - `useAnalysisState.ts` - UI state management hook

---
Task ID: 4
Agent: Main Agent
Task: Add complete authentication system with Supabase Auth

Work Log:
- Created `/src/lib/supabase-client.ts` - Frontend Supabase client with anon key
- Created `/src/contexts/AuthContext.tsx` - Auth context with signUp, signIn, signOut, resetPassword
- Created `/src/screens/LoginScreen.tsx` - Login form with email/password
- Created `/src/screens/RegisterScreen.tsx` - Registration with email confirmation
- Created `/src/screens/ForgotPasswordScreen.tsx` - Password recovery
- Created `/src/screens/AuthWrapper.tsx` - Route protection component
- Updated `/src/App.tsx` - Added AuthProvider and AuthWrapper
- Updated `/src/pages/Profile.tsx` - Added user email display and logout button

Commit: dc33259
Pushed to: main

Stage Summary:
- Complete authentication system implemented
- Login, Register, Password Reset screens created
- All routes protected - users must login to access app
- Profile shows user email and logout button
