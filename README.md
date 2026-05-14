# GymFideliza - Plataforma de Fidelización para Gimnasios

Aplicación web SaaS multi-gimnasio para gestión de socios, campañas de fidelización, programa de puntos, integración con WhatsApp y métricas de negocio.

## 🚀 Inicio Rápido

### Prerrequisitos

- **Node.js 20+** - [Descargar](https://nodejs.org/)
- **Docker Desktop** - [Descargar](https://www.docker.com/products/docker-desktop/) (para PostgreSQL y Redis)

### 1. Instalar dependencias

```bash
npm install
```

### 2. Levantar base de datos y Redis

```bash
docker-compose up -d
```

Esto inicia:
- PostgreSQL 16 en `localhost:5432`
- Redis 7 en `localhost:6379`

### 3. Configurar variables de entorno

El archivo `.env` ya está creado con valores de desarrollo. Para producción, cambia los secrets.

### 4. Ejecutar migraciones y seed

```bash
cd apps/api
npx prisma migrate dev --name init
npx tsx prisma/seed.ts
```

### 5. Iniciar la aplicación

Desde la raíz del proyecto:

```bash
npm run dev
```

Esto inicia:
- **API** en `http://localhost:3001`
- **Frontend** en `http://localhost:5173`

### 6. Acceder

Abre `http://localhost:5173` y usa:

| Campo | Valor |
|-------|-------|
| Email | `admin@gymfit.com` |
| Contraseña | `Admin123!@#` |

## 📁 Estructura del Proyecto

```
gimnasio-fidelizacion/
├── apps/
│   ├── api/          # Backend (Fastify + Prisma + BullMQ)
│   └── web/          # Frontend (React + Vite + Tailwind)
├── packages/
│   └── shared/       # Tipos y validadores compartidos
├── docker-compose.yml
├── turbo.json
└── package.json
```

## 🏗️ Tech Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand, Recharts |
| Backend | Node.js 20, Fastify, Prisma ORM, BullMQ |
| Base de Datos | PostgreSQL 16 |
| Cache/Colas | Redis 7 |
| Auth | JWT + Refresh Tokens + TOTP (2FA) |
| WhatsApp | Meta Cloud API (oficial) |

## 📋 Funcionalidades

- ✅ **Multi-tenant**: Cada gimnasio con datos aislados
- ✅ **Gestión de Socios**: CRUD, importación masiva CSV/XLSX, búsqueda
- ✅ **Planes y Membresías**: Creación de planes, asignación, vencimiento automático
- ✅ **Registro de Asistencia**: Manual y por QR, deduplicación configurable
- ✅ **Pagos**: Registro, anulación, exportación CSV
- ✅ **Campañas**: Recordatorio, cumpleaños, renovación, promocionales, NPS
- ✅ **Segmentación**: Criterios combinables (edad, membresía, riesgo, tags)
- ✅ **Programa de Puntos**: Acumulación por eventos, canje de recompensas
- ✅ **Referidos**: Código único, tracking de conversiones
- ✅ **WhatsApp**: Integración con Meta Cloud API, bandeja de entrada
- ✅ **Dashboard**: Métricas en tiempo real, gráficos, exportación
- ✅ **Motor de Riesgo**: Puntaje de abandono 0-100, alertas automáticas
- ✅ **Auditoría**: Log inmutable de todas las acciones
- ✅ **RBAC**: Roles Dueño, Administrador, Recepcionista

## 🔧 Comandos Útiles

```bash
# Desarrollo
npm run dev              # Iniciar todo (API + Web)

# Base de datos
cd apps/api
npx prisma studio       # UI visual de la BD
npx prisma migrate dev  # Crear migración
npx prisma db seed      # Ejecutar seed

# Build
npm run build           # Build de producción

# Tests
npm run test            # Ejecutar tests
```

## 🔐 Credenciales de Desarrollo

| Servicio | Credenciales |
|----------|-------------|
| PostgreSQL | `postgres` / `postgres123` / DB: `fidelizacion` |
| App Admin | `admin@gymfit.com` / `Admin123!@#` |

## 📄 Licencia

Privado - Todos los derechos reservados.


## 🤖 Funcionalidades de IA

La app incluye un módulo de inteligencia artificial con 4 capacidades:

### 1. Insights del Negocio
Análisis ejecutivo automático con IA que genera:
- Health Score del negocio (0-100)
- Fortalezas y puntos de atención detectados
- Oportunidades con impacto monetario estimado
- Predicciones de ingresos, churn y crecimiento
- Acción prioritaria del día

### 2. Asistente para Crear Campañas
Describe en lenguaje natural lo que quieres y la IA genera:
- Segmento con criterios automáticos
- 3 variantes de mensaje (formal, casual, urgencia)
- Mejor hora de envío predicha
- Estimación de alcance, conversión e ingresos

### 3. Análisis de Riesgo por Socio
Para cualquier socio, la IA analiza:
- Score de riesgo de abandono detallado
- Top razones del riesgo
- Acciones recomendadas con prioridad
- Mensaje de retención personalizado
- Lifetime value proyectado

### 4. Recompensas Personalizadas
Genera recomendaciones específicas por socio:
- 4-6 recompensas con match score
- Categorización por tipo
- Oferta exclusiva con vigencia sugerida
- Análisis del perfil y etapa de fidelización

### Configuración

Para activar las funciones de IA, agrega en Vercel → Settings → Environment Variables:

| Variable | Valor |
|----------|-------|
| `OPENAI_API_KEY` | Tu API key de OpenAI ([obtener](https://platform.openai.com/api-keys)) |
| `AI_MODEL` | (opcional) `gpt-4o-mini` (default, más barato) o `gpt-4o` (más potente) |

**Costo estimado:** $0.01-0.05 USD por análisis con `gpt-4o-mini`.

Alternativamente, puedes usar Anthropic Claude:

| Variable | Valor |
|----------|-------|
| `AI_PROVIDER` | `anthropic` |
| `ANTHROPIC_API_KEY` | Tu API key de Anthropic |
| `AI_MODEL` | `claude-3-5-sonnet-20241022` |
