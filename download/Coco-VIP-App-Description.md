# 🎯 Coco VIP - Descripción Completa de la App

## Resumen General

**Coco VIP** es una aplicación web de análisis deportivo impulsada por inteligencia artificial, diseñada para detectar **value bets** y generar picks de alta calidad en múltiples deportes: **Fútbol, NBA y MLB**. La app combina datos en tiempo real de **API-Football v3**, **balldontlie** y **TheSportsDB** con un modelo LLM (DeepSeek) para ofrecer análisis profundos, cálculo de edge y recomendaciones de stake.

---

## 📱 Pantallas Principales

### 1. 🎯 Picks (Generación Automática)

**Propósito**: Generar picks automáticamente usando IA con datos reales.

**Funcionalidades**:
- **3 botones de generación por deporte**:
  - ⚽ **Fútbol**: Top 5 ligas europeas + UEFA + ligas secundarias (18 ligas total)
  - 🏀 **NBA**: Partidos del día + Player Props (puntos, rebotes, asistencias)
  - ⚾ **MLB**: Run lines y totales
- **Filtros por estado**: Todos, En Vivo, Próximos
- **Filtros por deporte**: Fútbol, NBA, MLB
- **Tarjetas de pick** con:
  - Selección destacada
  - Cuota y edge calculado
  - Barra de confianza (1-10)
  - Análisis en español
  - Calidad tier (A+ / B)

**Validación de calidad**:
- Si faltan 2+ bloques de datos (standings, forma, odds, h2h) → partido descartado
- Máximo 3 picks por día (calidad sobre cantidad)
- Confianza mínima: 65%

---

### 2. 🔍 Analysis (Análisis Manual)

**Propósito**: Analizar cualquier partido específico escrito por el usuario.

**Funcionalidades**:
- **Input de partido**: "Real Madrid vs Barcelona"
- **Selector de deporte**: Fútbol, Basketball, Béisbol
- **Contexto opcional**: Lesiones, clima, motivación
- **Resultados del análisis**:
  - Mejor value bet detectado
  - Edge y confianza
  - **Debate de analistas**: Pestañas Pro/Contra/Conclusión
  - **xG Stats (Understat)**: Solo para fútbol
    - xG promedio, xGA, xG en casa/fuera
    - Gráfico de forma xG últimos 5 partidos
  - Botón "Guardar en historial"

**Animaciones de carga**:
1. 🔍 Buscando datos del partido...
2. 📊 Procesando estadísticas...
3. 🤖 Analizando con IA...

---

### 3. 📡 Scanner (Value Bets en Tiempo Real)

**Propósito**: Escanear todos los partidos disponibles y detectar value bets con edge > 3%.

**Funcionalidades**:
- **Auto-refresh**: Cada 30 minutos
- **Estadísticas del escaneo**:
  - Partidos analizados
  - Value bets encontrados
  - Mejor edge detectado
  - Confianza media
- **Filtros por deporte**: Todos, Fútbol, Basket, Béisbol
- **Tarjetas de resultado**:
  - Partido, liga y mercado
  - Selección y edge (+X.X%)
  - **Odds Shopping**: Mejor cuota disponible entre casas
  - Barra de confianza animada
  - Análisis corto
  - Botón "Analizar en detalle" → navega a Analysis

---

### 4. 📊 History (Historial de Predicciones)

**Propósito**: Rastrear resultados, profit y rendimiento.

**Funcionalidades**:
- **Stats cards**: Total, Ganados, Perdidos, Win Rate %
- **Gráfico de profit acumulado**: Línea SVG con tendencia
- **Rendimiento por deporte**: Barras de win rate
- **Distribución de confianza**: Alta/Media/Baja
- **Hot Streak indicator**: 🔥 si 3+ de últimas 5 ganadas
- **Filtros**: Todos, Pendientes, Ganados, Perdidos
- **Cada predicción muestra**:
  - Estado actualizable (dropdown)
  - Movimiento de línea (si hay)
  - Kelly Criterion 1/2 sugerido
  - Botón actualizar cuota
- **Acciones**: Borrar historial, actualizar estados

---

### 5. 👤 Profile (Perfil y Configuración)

**Propósito**: Gestionar cuenta, bankroll y configuración.

**Funcionalidades**:
- **Avatar VIP** con badge dorado
- **Tarjeta Carbon**: Estadísticas de rendimiento
  - Ganados / Perdidos / Pendientes
  - Win Rate con barra animada
  - Profit y ROI
- **Estadísticas adicionales**:
  - Cuota promedio
  - Mejor racha ganadora
- **Gestión de Bankroll**:
  - Input para configurar bankroll en unidades
  - Criterio de Kelly aplicado a cada pick
- **Caché de datos**:
  - Estado del caché (Google Sheets)
  - Última actualización
  - Entradas por deporte
  - Botón "Actualizar caché diario"
- **Toggle Modo Claro/Oscuro**
- **Configuración**: Notificaciones, Privacidad, Preferencias
- **Borrar todos los datos**

---

## 🎨 Paleta de Colores

### Modo Claro (Default)

| Variable | Color | Uso |
|----------|-------|-----|
| `--color-bg-primary` | `#FAFAFA` | Fondo principal |
| `--color-bg-secondary` | `#F4F4F5` | Fondo de cards/inputs |
| `--color-bg-card` | `#FFFFFF` | Cards |
| `--color-accent-primary` | `#18181B` | Texto destacado, botones |
| `--color-accent-secondary` | `#3F3F46` | Hover states |
| `--color-accent-gold` | `#D4AF37` | Badge VIP, acentos premium |
| `--color-text-primary` | `#18181B` | Títulos |
| `--color-text-secondary` | `#52525B` | Texto normal |
| `--color-text-muted` | `#A1A1AA` | Labels, texto secundario |
| `--color-border` | `#E4E4E7` | Bordes |
| `--color-success` | `#16A34A` | Ganado, positivo |
| `--color-danger` | `#DC2626` | Perdido, error |
| `--color-warning` | `#D97706` | Alertas, pendientes |

### Modo Oscuro

| Variable | Color | Uso |
|----------|-------|-----|
| `--color-bg-primary` | `#09090B` | Fondo principal (casi negro) |
| `--color-bg-secondary` | `#18181B` | Cards, inputs |
| `--color-bg-card` | `#1C1C1F` | Cards elevadas |
| `--color-accent-primary` | `#FAFAFA` | Texto claro, botones invertidos |
| `--color-accent-secondary` | `#A1A1AA` | Hover states |
| `--color-accent-gold` | `#D4AF37` | Badge VIP (igual) |
| `--color-text-primary` | `#FAFAFA` | Títulos claros |
| `--color-text-secondary` | `#A1A1AA` | Texto secundario |
| `--color-text-muted` | `#52525B` | Labels apagados |
| `--color-border` | `#27272A` | Bordes sutiles |
| `--color-success` | `#22C55E` | Verde más brillante |
| `--color-danger` | `#EF4444` | Rojo brillante |
| `--color-warning` | `#F59E0B` | Naranja brillante |

### Colores por Deporte

| Deporte | Color Primario | Gradiente Botón |
|---------|----------------|-----------------|
| ⚽ Fútbol | `#16A34A` (verde) | `from-emerald-500 to-green-600` |
| 🏀 NBA | `#D97706` (naranja) | `from-orange-500 to-red-600` |
| ⚾ MLB | `#007AFF` (azul) | `from-blue-500 to-indigo-600` |

### Badges y Estados

| Elemento | Estilo |
|----------|--------|
| **Badge A+** | Gradiente dorado `#D4AF37 → #C4A030` |
| **Badge B** | Fondo gris + borde |
| **Ganado** | Fondo verde claro + borde verde |
| **Perdido** | Fondo rojo claro + borde rojo |
| **Pendiente** | Fondo gris + texto gris |
| **VIP Badge** | Fondo dorado + corona blanca |

---

## 🏗️ Arquitectura Técnica

### Frontend
- **Framework**: React + TypeScript
- **Build**: Vite
- **Estilos**: Tailwind CSS v4 + CSS Variables
- **Animaciones**: Motion (Framer Motion)
- **Iconos**: Lucide React
- **Fechas**: date-fns

### Backend APIs
- **API-Football v3**: 18 ligas, 10 endpoints (fixtures, standings, odds, predictions, etc.)
- **balldontlie**: NBA data + Player Props
- **TheSportsDB**: Logos y assets visuales
- **OpenRouter + DeepSeek**: LLM para análisis

### Base de Datos
- **Supabase**: `predictions`, `picks_discarded`, `assets_cache`
- **localStorage**: Historial local, bankroll, tema

---

## 📐 Diseño UI/UX

### Principios de Diseño
1. **Minimalista Premium**: Fondos limpios, tipografía Inter, espacios generosos
2. **Glass Morphism**: Cards con blur sutil y bordes definidos
3. **Acciones Claras**: Botones grandes, estados hover visibles
4. **Feedback Visual**: Animaciones de carga, transiciones suaves
5. **Accesibilidad**: Contraste WCAG, estados focus, tamaños tocables

### Componentes Recurrentes
- **Cards**: Bordes 24px, sombra sutil, border 1px
- **Botones primary**: 12px radius, bold, transiciones 0.2s
- **Pills**: 12px radius, padding 12px horizontal
- **Input fields**: 16px radius, padding 12px, fondo secondary
- **Headers**: Glass effect, blur 20px, sticky

### Responsive
- Mobile-first design
- Bottom navigation sticky
- Cards full-width con padding lateral
- Scroll horizontal para filtros (no-scrollbar)

---

## 🔮 Próximas Funcionalidades

1. **Notificaciones push** para picks en vivo
2. **Integración con casas de apuestas** para auto-betting
3. **Chat con Coco** para consultas en lenguaje natural
4. **Comunidad** para compartir picks
5. **Exportar historial** a CSV/Excel

---

**Versión**: 2.0  
**Powered by**: API-Football v3, balldontlie, TheSportsDB, DeepSeek LLM  
**Storage**: Supabase + localStorage  
**Theme**: Minimalist Premium (Light/Dark)
