<div align="center">
  <img width="1200" height="475" alt="Coco VIP Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  
  # 🎰 Coco VIP - Value Bets Assistant
  
  **Asistente de Apuestas con Inteligencia Artificial**
  
  [![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
  [![Firebase](https://img.shields.io/badge/Firebase-Auth & Firestore-FFCA28?logo=firebase)](https://firebase.google.com/)
</div>

---

## 📱 Características

### ✨ Funcionalidades Principales

| Feature | Descripción |
|---------|-------------|
| **🔴 En Vivo** | Partidos en tiempo real de Fútbol, Basketball y Béisbol |
| **📊 Análisis IA** | Análisis de Value Bets con DeepSeek AI |
| **⭐ Top Picks** | Mejores oportunidades detectadas automáticamente |
| **📈 Historial** | Seguimiento completo de predicciones (localStorage) |
| **👤 Perfil** | Estadísticas de rendimiento detalladas |
| **🔥 Win Rate** | Tracking de victorias y ROI |
| **🚀 Sin Login** | Acceso directo sin autenticación |

### 🏆 Deportes Soportados

- ⚽ **Fútbol** - Principales ligas (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League)
- 🏀 **Basketball** - NBA, Euroleague, ACB
- ⚾ **Béisbol** - MLB, NPB, KBO

---

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+
- API Key de API-Sports (para datos en vivo)

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/MCYSTORE/app-coco-vip-de-ia-studio.git
cd app-coco-vip-de-ia-studio

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus API keys
```

### Configuración

Crea un archivo `.env` con las siguientes variables:

```env
# Sports API (API-Sports - funciona para Football, Basketball, Baseball)
SPORTS_API_KEY=tu_api_key_de_api_sports

# OpenRouter para análisis IA (opcional)
OPENROUTER_API_KEY=tu_api_key_de_openrouter

# App Configuration
APP_URL=http://localhost:3000
PORT=3000
NODE_ENV=development
```

### Ejecutar

```bash
# Modo desarrollo
npm run dev

# Build producción
npm run build

# Preview producción
npm run preview
```

---

## 📁 Estructura del Proyecto

```
src/
├── components/
│   ├── Layout.tsx      # Layout principal con navegación
│   └── PickCard.tsx    # Tarjeta de predicción con modal
├── pages/
│   ├── Picks.tsx       # Top Picks en vivo y próximos
│   ├── Analysis.tsx    # Análisis manual de partidos
│   ├── History.tsx     # Historial con gestión de estado
│   └── Profile.tsx     # Perfil con estadísticas
├── types.ts            # Tipos TypeScript
├── firebase.ts         # Configuración Firebase
├── App.tsx             # Componente principal
├── main.tsx            # Entry point
└── index.css           # Estilos Tailwind
server.ts               # Servidor Express con APIs
```

---

## 🔌 API Endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/top-picks` | GET | Top picks agregados de todos los deportes |
| `/api/football/live` | GET | Partidos de fútbol en vivo |
| `/api/football/upcoming` | GET | Próximos partidos de fútbol |
| `/api/basketball/live` | GET | Partidos de basketball en vivo |
| `/api/basketball/upcoming` | GET | Próximos partidos de basketball |
| `/api/baseball/live` | GET | Partidos de béisbol en vivo |
| `/api/baseball/upcoming` | GET | Próximos partidos de béisbol |
| `/api/analyze` | POST | Análisis IA de un partido |
| `/api/stats/:userId` | GET | Estadísticas del usuario |
| `/api/predictions/:id/status` | PATCH | Actualizar estado de predicción |

---

## 🛠️ Tecnologías

### Frontend
- **React 19** - UI Library
- **TypeScript** - Type Safety
- **Tailwind CSS 4** - Styling
- **Motion** - Animations
- **Lucide Icons** - Iconos
- **date-fns** - Formateo de fechas

### Backend
- **Express** - Servidor web
- **Vite** - Build tool & HMR
- **API-Sports** - Datos deportivos en vivo

### Servicios
- **localStorage** - Almacenamiento local de predicciones
- **OpenRouter/DeepSeek** - Análisis IA (opcional)

---

## 📊 Funcionalidades Detalladas

### 🔴 Picks en Vivo
- Actualización automática cada 5 minutos
- Filtro por estado (En vivo / Próximos)
- Indicador visual de eventos en vivo
- Análisis automático de cada pick

### 📈 Análisis Manual
- Selección de deporte (Fútbol, Basketball, Béisbol)
- Múltiples mercados por deporte
- Contexto adicional personalizable
- Guardado automático al historial

### 📋 Historial Inteligente
- Filtro por estado (Pendiente, Ganado, Perdido)
- Actualización de estado con un click
- Estadísticas en tiempo real
- Win Rate calculado automáticamente

### 👤 Perfil con Stats
- Total de predicciones
- Ganados / Perdidos / Pendientes
- Win Rate visual
- ROI y Profit tracking
- Cuota promedio
- Mejor racha

---

## 🔒 Seguridad

- Firestore Rules configuradas para protección de datos
- Autenticación requerida para todas las operaciones
- Validación de datos en cliente y servidor
- API Keys protegidas en backend

---

## 📝 Licencia

Este proyecto es privado y de uso exclusivo para miembros VIP de Coco.

---

<div align="center">
  <p>Hecho con ❤️ por <strong>MCY STORE</strong></p>
  <p>Powered by <strong>API-Sports</strong> & <strong>DeepSeek AI</strong></p>
</div>
