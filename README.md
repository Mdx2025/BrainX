# 🧠 BrainX V5 — Motor de Memoria Vectorial para OpenClaw

BrainX V5 es un sistema de **memoria persistente** basado en PostgreSQL + pgvector + OpenAI embeddings, diseñado para que agentes AI recuerden, aprendan y compartan conocimiento entre sesiones.

> **Nombre:** El repo/CLI mantiene el nombre histórico `brainx-v5`. La versión actual es **V4 Core** con gobernanza, observabilidad, lifecycle, y sistema de auto-alimentación con LLM.

---

## Estado

| # | Feature | Descripción |
|---|---------|-------------|
| 1 | ✅ **Producción** | Activo en 9 agentes con memoria centralizada compartida |
| 2 | 🧠 **Auto-Learning** | Aprende solo de cada conversación sin intervención humana |
| 3 | 💾 **Memoria Persistente** | Recuerda entre sesiones — PostgreSQL + pgvector |
| 4 | 🤝 **Memoria Compartida** | Todos los agentes comparten el mismo pool de conocimiento |
| 5 | 💉 **Briefing Automático** | Inyección personalizada de contexto al iniciar cada agente |
| 6 | 🔎 **Búsqueda Semántica** | Busca por significado, no por keywords exactas |
| 7 | 🏷️ **Clasificación Inteligente** | Tipado automático: facts, decisions, learnings, gotchas, notes |
| 8 | 📊 **Priorización por Uso** | Tiers hot/warm/cold — promote/degrade automático según acceso |
| 9 | 🤝 **Cross-Agent Learning** | Propaga gotchas y learnings importantes entre todos los agentes |
| 10 | 🔄 **Anti-Duplicados** | Deduplicación semántica por similitud coseno con merge inteligente |
| 11 | ⚡ **Anti-Contradicciones** | Detecta memorias contradictorias y supersede la obsoleta |
| 12 | 📋 **Session Indexing** | Busca en conversaciones pasadas (retención 30 días) |
| 13 | 🔒 **PII Scrubbing** | Redacción automática de datos sensibles pre-almacenamiento |
| 14 | 🔮 **Pattern Detection** | Detecta patrones recurrentes y los promueve automáticamente |
| 15 | 🛡️ **Disaster Recovery** | Backup/restore completo (DB + configs + hooks + workspaces) |
| 16 | ⭐ **Quality Scoring** | Evalúa calidad de cada memoria y promueve/degrada en base a score |
| 17 | 📌 **Fact Extraction** | Regex extrae URLs, repos, puertos, branches, configs de sesiones |
| 18 | 📦 **Context Packs** | Paquetes de contexto semanales por proyecto y por agente |
| 19 | 🔍 **Telemetría** | Logs de inyección + performance de queries + métricas operacionales |
| 20 | 🔗 **Supersede Chain** | Memorias obsoletas marcadas, nunca borradas — historial completo |
| 21 | 🧬 **Memory Distiller** | LLM (gpt-4.1-mini) extrae memorias de session logs cada 6h |

---

## 🧠 Auto-Learning (Aprendizaje Automático)

> **BrainX no solo almacena memorias — aprende solo.** Auto-Learning es el sistema integrado que hace que cada agente mejore con cada conversación, sin intervención humana.

Auto-Learning NO es un solo script. Es la **orquestación completa** de captura, curación, propagación e inyección que convierte conversaciones efímeras en conocimiento permanente y compartido. Funciona 24/7 vía cron jobs, sin que ningún humano tenga que intervenir.

### Ciclo Completo de Auto-Learning

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    🧠 CICLO DE AUTO-LEARNING                            │
│                                                                          │
│   ┌─────────────┐    ┌──────────────┐    ┌──────────────┐               │
│   │  Sesiones    │    │  Archivos    │    │   Agentes    │               │
│   │  de agentes  │    │  memory/*.md │    │  (manual)    │               │
│   └──────┬──────┘    └──────┬───────┘    └──────┬───────┘               │
│          │                  │                    │                        │
│          ▼                  ▼                    ▼                        │
│   ┌─────────────────────────────────────────────────────┐               │
│   │         📥 CAPTURA AUTOMÁTICA (3 capas)              │               │
│   │                                                      │               │
│   │  Memory Distiller ──► LLM extrae memorias            │               │
│   │  Fact Extractor   ──► Regex extrae datos duros       │               │
│   │  Session Harvester ─► Heurísticas clasifican         │               │
│   │  Memory Bridge    ──► Sync markdown → vectorial      │               │
│   └──────────────────────────┬──────────────────────────┘               │
│                              ▼                                           │
│                    ┌─────────────────┐                                   │
│                    │  PostgreSQL +   │                                   │
│                    │  pgvector       │                                   │
│                    │  (memoria       │                                   │
│                    │  centralizada)  │                                   │
│                    └────────┬────────┘                                   │
│                             │                                            │
│          ┌──────────────────┼──────────────────┐                        │
│          ▼                  ▼                   ▼                        │
│   ┌─────────────┐  ┌──────────────┐  ┌────────────────┐                │
│   │ 🔄 AUTO-    │  │ 🤝 CROSS-   │  │ 🔮 PATTERN    │                │
│   │ MEJORA      │  │ AGENT       │  │ DETECTION     │                │
│   │             │  │ LEARNING    │  │               │                │
│   │ Quality     │  │             │  │ Recurrence    │                │
│   │ Scoring     │  │ Propagar    │  │ counting      │                │
│   │ Dedup       │  │ gotchas y   │  │ Pattern keys  │                │
│   │ Contradict. │  │ learnings   │  │ Auto-promote  │                │
│   │ Cleanup     │  │ a TODOS     │  │               │                │
│   │ Lifecycle   │  │ los agentes │  │               │                │
│   └──────┬──────┘  └──────┬──────┘  └───────┬──────┘                │
│          │                │                  │                        │
│          └────────────────┼──────────────────┘                        │
│                           ▼                                            │
│                  ┌─────────────────┐                                   │
│                  │ 💉 INYECCIÓN    │                                   │
│                  │ CONTEXTUAL      │                                   │
│                  │                 │                                   │
│                  │ Auto-inject en  │                                   │
│                  │ cada bootstrap  │                                   │
│                  │ de agente       │                                   │
│                  │ Score-based     │                                   │
│                  │ ranking         │                                   │
│                  └─────────────────┘                                   │
│                           │                                            │
│                           ▼                                            │
│                  ┌─────────────────┐                                   │
│                  │ 🤖 AGENTE MÁS  │                                   │
│                  │ INTELIGENTE     │                                   │
│                  │ en cada sesión  │                                   │
│                  └─────────────────┘                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Resultado:** Cada sesión de cada agente alimenta la memoria → la memoria se auto-optimiza → el conocimiento se propaga → todos los agentes son más inteligentes en la siguiente sesión. **Ciclo infinito de mejora.**

---

### 📥 Captura Automática de Memorias

**Qué hace:** Convierte TODA actividad de los agentes en memorias vectoriales sin que nadie tenga que hacer nada.

**Por qué importa:** Sin esto, cada sesión sería desechable. Los agentes olvidarían todo. Con Auto-Learning, cada conversación es una oportunidad de aprendizaje permanente.

BrainX captura memorias a través de **4 mecanismos complementarios** que trabajan en paralelo:

| Mecanismo | Cómo funciona | Qué captura | Frecuencia |
|-----------|---------------|-------------|------------|
| **Memory Distiller** (`scripts/memory-distiller.js`) | LLM (gpt-4.1-mini) lee transcripts completos de sesiones | Preferencias, decisiones, datos personales, técnicos, financieros — TODO tipo de memoria | Cada 6h |
| **Fact Extractor** (`scripts/fact-extractor.js`) | Regex patterns extraen datos estructurados | URLs de producción, servicios Railway, repos GitHub, puertos, branches, configs | Cada 6h |
| **Session Harvester** (`scripts/session-harvester.js`) | Heurísticas y regex clasifican conversaciones | Patrones de conversación, temas recurrentes, contexto operacional | Cada 4h |
| **Memory Bridge** (`scripts/memory-bridge.js`) | Sincroniza archivos markdown con la base vectorial | Notas manuales en `memory/*.md`, documentación, decisiones escritas | Cada 6h |

**Ejemplo real:** Un agente discute con Marcelo sobre un deploy a Railway. Sin que nadie haga nada:
- El **Fact Extractor** captura la URL del servicio y el nombre del repo
- El **Memory Distiller** extrae la decisión de usar ese servicio y por qué
- El **Memory Bridge** sincroniza las notas del día
- Todo queda disponible para CUALQUIER agente en la siguiente sesión

---

### 🤝 Aprendizaje Cross-Agente

**Qué hace:** Cuando un agente descubre algo importante (un bug, un gotcha, un learning), lo propaga automáticamente a TODOS los demás agentes.

**Por qué importa:** Sin esto, cada agente sería una isla. El coder descubriría un bug y el researcher lo volvería a encontrar. Con cross-agent learning, el conocimiento fluye entre todos.

**Script:** `scripts/cross-agent-learning.js`
**Frecuencia:** Diario (cron)

**Cómo funciona:**

1. Escanea memorias recientes con importancia ≥ 7 y tipos `gotcha`, `learning`, `correction`
2. Identifica memorias que fueron creadas por un agente específico
3. Replica esas memorias en el contexto de los demás agentes
4. Genera **context packs semanales** por proyecto y por agente (`scripts/context-pack-builder.js`)

**Ejemplo real:**
```
Coder descubre: "Railway CLI v4.29 requiere --detach para deploys en background"
    ↓ cross-agent-learning.js (cron diario)
    ↓
Researcher, Writer, Main, Raider → todos reciben este gotcha
    ↓
Ningún agente vuelve a cometer ese error
```

---

### 🔄 Auto-Mejora y Curación de Calidad

**Qué hace:** La memoria se optimiza sola — las memorias buenas suben, las malas bajan, los duplicados se eliminan, las contradicciones se resuelven.

**Por qué importa:** Sin curación automática, la memoria se llenaría de basura, duplicados y información obsoleta. La calidad del retrieval se degradaría con el tiempo. Con auto-mejora, la memoria se vuelve MÁS precisa con cada ciclo.

**5 scripts trabajan en conjunto:**

| Script | Qué hace | Frecuencia |
|--------|----------|------------|
| `scripts/quality-scorer.js` | Evalúa cada memoria en múltiples dimensiones (especificidad, accionabilidad, relevancia). Promueve memorias de alta calidad, degrada las de baja calidad | Diario |
| `scripts/contradiction-detector.js` | Encuentra memorias que se contradicen entre sí. Supersede la versión obsoleta y conserva la más reciente/precisa | Diario |
| `scripts/dedup-supersede.js` | Detecta memorias duplicadas o casi-idénticas por similitud coseno. Merge inteligente conservando la información más completa | Semanal |
| `scripts/cleanup-low-signal.js` | Archiva memorias de bajo valor: demasiado cortas, baja importancia, sin accesos recientes. Libera espacio para memorias útiles | Semanal |
| **Lifecycle run** (vía `lifecycle-run` en CLI) | Promueve memorias entre tiers: `hot` → `warm` → `cold` basado en antigüedad, accesos y calidad. Las memorias hot están siempre disponibles, las cold se archivan | Automático |

**Flujo de curación:**
```
Memoria nueva entra
    ↓
Quality Scorer → ¿Es útil? ¿Específica? ¿Accionable?
    ↓                                    ↓
  Sí → promote (importance +1)     No → degrade (importance -1)
    ↓                                    ↓
Contradiction Detector              Cleanup → archive si importance < 3
    ↓
¿Contradice algo existente?
    ↓              ↓
  Sí → supersede   No → conservar ambas
    ↓
Dedup → ¿Duplicado?
    ↓              ↓
  Sí → merge       No → mantener
    ↓
Lifecycle → hot/warm/cold según uso
```

---

### 💉 Inyección Contextual Inteligente

**Qué hace:** En cada inicio de sesión de un agente, inyecta automáticamente las memorias más relevantes al contexto actual.

**Por qué importa:** De nada sirve tener una memoria perfecta si el agente no la recibe. La inyección contextual es el puente entre "memorias almacenadas" y "agente informado". Sin esto, BrainX sería una base de datos que nadie consulta.

**Componente:** Hook de auto-inyección (`hook/handler.js` + `lib/cli.js inject`)
**Frecuencia:** Cada bootstrap de agente (cada sesión nueva)

**Cómo funciona:**

1. El hook se ejecuta automáticamente al iniciar cualquier sesión de agente
2. Ejecuta `brainx inject --agent <agent_id>` que:
   - Busca memorias relevantes al agente actual (por contexto `agent:ID`)
   - Rankea por **score compuesto**: similitud semántica × importancia × tier
   - Incluye **facts operacionales** (URLs, configs, servicios) siempre disponibles
   - Formatea todo como bloque markdown inyectable en el prompt
3. El resultado se escribe en `BRAINX_CONTEXT.md` que el agente lee al iniciar

**Ranking de inyección:**
```
Score = (similitud_coseno × 0.4) + (importancia/10 × 0.3) + (tier_weight × 0.2) + (recency × 0.1)

Donde:
  tier_weight: hot=1.0, warm=0.6, cold=0.2
  recency: decay exponencial desde last_accessed
```

---

### 🔮 Detección de Patrones y Recurrencias

**Qué hace:** Detecta cuando algo aparece repetidamente en las memorias y lo promueve automáticamente como patrón importante.

**Por qué importa:** Los patrones recurrentes son las memorias más valiosas — si algo aparece 5 veces, probablemente es crítico. La detección automática asegura que estas memorias nunca se pierdan ni se degraden.

**Mecanismo integrado en:** `scripts/quality-scorer.js` + `lib/openai-rag.js`

**Cómo funciona:**

1. **Recurrence counting:** Cada vez que una memoria es accedida o una similar es creada, se incrementa `recurrence_count`
2. **Pattern key:** Memorias similares se agrupan bajo un `pattern_key` común (hash semántico)
3. **Auto-promote:** Cuando `recurrence_count` supera un umbral:
   - ≥ 3 apariciones → importance +1
   - ≥ 5 apariciones → promote a tier `hot`
   - ≥ 10 apariciones → marca como `core_knowledge` (nunca se archiva)

**Ejemplo:**
```
Memoria: "Railway CLI requiere --detach para deploys"
  → Aparece en 3 sesiones diferentes de 3 agentes
  → recurrence_count = 3
  → Auto-promote: importance 6 → 7
  → Aparece 2 veces más
  → recurrence_count = 5
  → Auto-promote a tier hot (siempre disponible)
```

---

### 📋 Resumen: Crons de Auto-Learning

Todos los crons que alimentan el ciclo de auto-learning:

| Frecuencia | Scripts | Función |
|------------|---------|---------|
| **Cada 4h** | `session-harvester.js` | Capturar sesiones nuevas |
| **Cada 6h** | `memory-distiller.js`, `fact-extractor.js`, `memory-bridge.js` | Extraer memorias y facts |
| **Diario** | `cross-agent-learning.js`, `contradiction-detector.js`, `quality-scorer.js` | Propagar, curar, evaluar |
| **Semanal** | `context-pack-builder.js`, `cleanup-low-signal.js`, `dedup-supersede.js` | Packs, limpieza, dedup |
| **Cada sesión** | Hook de auto-inyección | Inyectar memorias al agente |

> **Zero-maintenance:** Una vez configurados los crons, BrainX aprende, se optimiza y comparte conocimiento completamente solo. Los agentes mejoran con cada sesión sin que nadie toque nada.

---

## Tabla Resumen de Scripts y Herramientas

### Scripts del Pipeline (`scripts/`)

| Script | Descripción | LLM | Cron |
|--------|-------------|-----|------|
| `memory-distiller.js` | 🧬 Extractor LLM-powered de memorias desde transcripts de sesiones | gpt-4.1-mini | Cada 6h |
| `fact-extractor.js` | 📌 Extractor regex de facts operacionales (URLs, servicios, configs) | No | Cada 6h |
| `session-harvester.js` | 🔍 Harvester de sesiones basado en heurísticas regex | No | Cada 4h |
| `memory-bridge.js` | 🌉 Sincroniza archivos `memory/*.md` al brain vectorial | No | Cada 6h |
| `cross-agent-learning.js` | 🤝 Propaga aprendizajes de alta importancia entre agentes | No | Diario |
| `contradiction-detector.js` | ⚡ Detecta memorias contradictorias y supersede las obsoletas | No | Diario |
| `quality-scorer.js` | ⭐ Evalúa calidad de memorias (promote/degrade/archive) | No | Diario |
| `context-pack-builder.js` | 📦 Genera packs semanales de contexto por agente/proyecto | No | Semanal |
| `cleanup-low-signal.js` | 🧹 Limpia memorias de bajo valor (cortas, baja importancia) | No | Semanal |
| `dedup-supersede.js` | 🔗 Deduplicación exacta y superseding de memorias idénticas | No | Semanal |
| `reclassify-memories.js` | 🏷️ Reclasifica memorias existentes a nuevas categorías | No | Manual |
| `eval-memory-quality.js` | 📊 Evaluación offline de calidad de retrieval | No | Manual |
| `generate-eval-dataset-from-memories.js` | 📋 Genera dataset JSONL para benchmarks | No | Manual |
| `import-workspace-memory-md.js` | 📥 Importa MEMORY.md de workspaces al brain vectorial | No | Manual |
| `migrate-v2-to-v3.js` | 🔄 Migración de datos desde BrainX V2 | No | Una vez |
| `backup-brainx.sh` | 🛡️ Backup completo (DB + configs + hooks) | No | Diario (cron recomendado) |
| `restore-brainx.sh` | 🛡️ Restauración completa desde backup | No | Manual |

### Scripts de Cron (`cron/`)

| Script | Descripción | Frecuencia |
|--------|-------------|------------|
| `health-check.sh` | Verificación de estado de BrainX + conteo de memorias | Cada 30 min |
| `ops-alerts.sh` | Reporte operacional con alertas de latencia y lifecycle | Diario |
| `weekly-dashboard.sh` | Dashboard semanal con métricas, tendencias y distribución | Semanal |

### Módulos Core (`lib/`)

| Módulo | Descripción |
|--------|-------------|
| `openai-rag.js` | Core RAG: embeddings OpenAI, store con dedup semántico, search con scoring, query logging |
| `brainx-phase2.js` | PII scrubbing (14 patrones), dedup config, tag merging, merge plan derivation |
| `db.js` | Pool de conexiones PostgreSQL con soporte de transacciones |
| `cli.js` | CLI completo con todos los comandos (health, add, fact, facts, search, inject, resolve, etc.) |

---

## Arquitectura

BrainX V5 opera en **3 capas de alimentación** que trabajan en conjunto:

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA 3: Agentes (manual)                 │
│  Agentes escriben directamente con: brainx add / brainx fact│
│  → Decisiones, gotchas, notas durante el trabajo            │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│               CAPA 2: Memory Distiller (LLM)                │
│  scripts/memory-distiller.js — gpt-4.1-mini                 │
│  → Lee transcripts de sesiones completas                    │
│  → Extrae TODOS los tipos: personal, financial, preferences │
│  → Entiende contexto y matices del lenguaje                 │
│  → Cron cada 6h automático                                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│               CAPA 1: Fact Extractor (regex)                │
│  scripts/fact-extractor.js — sin LLM                        │
│  → Extrae URLs (Railway, Vercel, GitHub)                    │
│  → Detecta servicios, repos, puertos, branches              │
│  → Rápido, sin costo de API                                 │
│  → Complementa al distiller para datos estructurados        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
              PostgreSQL + pgvector
              (base de datos centralizada)
                        │
                        ▼
              hook/handler.js (auto-inject)
              → BRAINX_CONTEXT.md en cada workspace
```

### Flujo de datos

```
Sesiones de agentes ──→ Fact Extractor (regex)     ──→ PostgreSQL
                    ──→ Memory Distiller (LLM)     ──→ PostgreSQL
                    ──→ Session Harvester (regex)   ──→ PostgreSQL
                    ──→ Memory Bridge (markdown)    ──→ PostgreSQL
                    ──→ Agentes escriben directo    ──→ PostgreSQL
                                                          │
                                    ┌─────────────────────┤
                                    │                     │
                                    ▼                     ▼
                             Quality Scorer        hook/handler.js
                             Contradiction Det.          │
                             Cross-Agent Learning        ▼
                             Dedup/Supersede       BRAINX_CONTEXT.md
                             Cleanup Low-Signal    (3 secciones:
                             Lifecycle-Run          📌 Project Facts
                                                   🤖 Memorias propias
                                                   🔥 Equipo alta imp.)
```

---

## Quick Start

```bash
# 1. Clonar
git clone https://github.com/Mdx2025/brainx-v5.git
cd brainx-v5

# 2. Instalar dependencias
pnpm install  # o npm install

# 3. Configurar entorno
cp .env.example .env
# Editar: DATABASE_URL, OPENAI_API_KEY

# 4. Setup de base de datos (requiere PostgreSQL con pgvector)
psql "$DATABASE_URL" -f sql/v3-schema.sql

# 5. Verificar
./brainx-v5 health
```

---

## Referencia CLI Completa

El CLI (`lib/cli.js`) provee todos los comandos para interactuar con BrainX. El entry point es el script bash `brainx-v5` (o el wrapper `brainx`).

### `health` — Verificar estado

```bash
./brainx-v5 health
# BrainX V5 health: OK
# - pgvector: yes
# - brainx tables: 9
```

### `add` — Agregar memoria

```bash
./brainx-v5 add \
  --type decision \
  --content "Usar text-embedding-3-small para reducir costos" \
  --context "project:openclaw" \
  --tier hot \
  --importance 9 \
  --tags config,openai \
  --agent coder
```

**Flags disponibles:**

| Flag | Requerido | Descripción |
|------|-----------|-------------|
| `--type` | ✅ | Tipo de memoria (ver sección Tipos) |
| `--content` | ✅ | Contenido textual de la memoria |
| `--context` | ❌ | Namespace: `agent:coder`, `project:emailbot`, `personal:finanzas` |
| `--tier` | ❌ | `hot` \| `warm` \| `cold` \| `archive` (default: `warm`) |
| `--importance` | ❌ | 1-10 (default: 5) |
| `--tags` | ❌ | Tags separados por coma: `railway,deploy,url` |
| `--agent` | ❌ | Nombre del agente que crea la memoria |
| `--id` | ❌ | ID personalizado (auto-generado si se omite) |
| `--status` | ❌ | `pending` \| `in_progress` \| `resolved` \| `promoted` \| `wont_fix` |
| `--category` | ❌ | Categoría (ver sección Categorías) |
| `--patternKey` | ❌ | Clave de patrón recurrente |
| `--recurrenceCount` | ❌ | Contador de recurrencias |
| `--resolutionNotes` | ❌ | Notas de resolución |
| `--promotedTo` | ❌ | Destino de promoción |

### `fact` — Shortcut para datos operacionales

El tipo `fact` es un shortcut para `add --type fact --tier hot --category infrastructure`.

```bash
# Registrar una URL de Railway
./brainx-v5 fact \
  --content "Frontend emailbot: https://emailbot-frontend.up.railway.app" \
  --context "project:emailbot" \
  --importance 8

# Registrar config de servicio
./brainx-v5 fact \
  --content "Railway service 'emailbot-api' → puerto 3001, branch main" \
  --context "project:emailbot" \
  --importance 7 \
  --tags railway,config
```

**¿Qué es un FACT?** Datos duros que otro agente necesitaría para trabajar sin preguntar:
- URLs de producción/staging
- Mapeo servicio Railway ↔ repo ↔ directorio
- Variables de entorno clave
- Estructura del proyecto
- Branch principal, deploy target
- Datos personales, financieros, contactos

### `facts` — Listar facts almacenados

```bash
# Todos los facts
./brainx-v5 facts

# Filtrar por contexto
./brainx-v5 facts --context "project:emailbot"

# Limitar resultados
./brainx-v5 facts --limit 5
```

### `search` — Búsqueda semántica

```bash
./brainx-v5 search \
  --query "estrategia de deploy" \
  --limit 10 \
  --minSimilarity 0.15 \
  --context "project:emailbot" \
  --tier hot
```

**Score-based ranking:** Los resultados se ordenan por un score compuesto:
- **Similitud coseno** — peso principal del embedding
- **Importancia** — `(importance / 10) × 0.25` bonus
- **Tier bonus** — `hot: +0.15`, `warm: +0.05`, `cold: -0.05`, `archive: -0.10`

**Access tracking:** Cada resultado devuelto actualiza `last_accessed` y `access_count` automáticamente.

### `inject` — Obtener contexto listo para prompts

```bash
./brainx-v5 inject \
  --query "qué decidimos sobre el deploy?" \
  --limit 8 \
  --minScore 0.25 \
  --maxTotalChars 12000
```

**Formato de salida:**
```
[sim:0.82 imp:9 tier:hot type:decision agent:coder ctx:openclaw]
Usar text-embedding-3-small para reducir costos...

---

[sim:0.41 imp:6 tier:warm type:note agent:writer ctx:project-x]
Otra memoria relevante...
```

**Límites de inyección:**

| Límite | Default | Env Override | Flag Override |
|--------|---------|--------------|---------------|
| Max chars por item | 2000 | `BRAINX_INJECT_MAX_CHARS_PER_ITEM` | `--maxCharsPerItem` |
| Max líneas por item | 80 | `BRAINX_INJECT_MAX_LINES_PER_ITEM` | `--maxLinesPerItem` |
| Max chars total output | 12000 | `BRAINX_INJECT_MAX_TOTAL_CHARS` | `--maxTotalChars` |
| Min score gate | 0.25 | `BRAINX_INJECT_MIN_SCORE` | `--minScore` |

### `resolve` — Resolver/promover memorias

```bash
# Resolver una memoria
./brainx-v5 resolve --id m_123 --status resolved \
  --resolutionNotes "Parcheado retry backoff"

# Promover todas las memorias de un patrón
./brainx-v5 resolve \
  --patternKey retry.429.swallow \
  --status promoted \
  --promotedTo docs/runbooks/retry.md \
  --resolutionNotes "Capturada política estándar de retry"
```

### `promote-candidates` — Ver candidatos a promoción

```bash
./brainx-v5 promote-candidates --json
./brainx-v5 promote-candidates --minRecurrence 3 --days 30 --limit 10
```

### `lifecycle-run` — Auto-promover/degradar memorias

```bash
# Dry run primero
./brainx-v5 lifecycle-run --dryRun --json

# Ejecutar
./brainx-v5 lifecycle-run --json
```

### `metrics` — KPIs operacionales

```bash
./brainx-v5 metrics --days 30 --topPatterns 10 --json
```

Devuelve:
- Distribución por tier
- Top patrones recurrentes
- Performance de queries (duración promedio, cantidad de llamadas)
- Estadísticas de lifecycle

---

## Tipos de Memoria

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| `fact` | Datos operacionales concretos | URLs, servicios, configs, datos personales, finanzas |
| `decision` | Decisiones tomadas | "Usamos gpt-4.1-mini para el distiller" |
| `learning` | Cosas descubiertas/aprendidas | "Railway no soporta websockets en plan free" |
| `gotcha` | Trampas a evitar | "No usar `rm -rf` sin confirmar ruta primero" |
| `action` | Acciones ejecutadas | "Deployeado emailbot v2.3 a producción" |
| `note` | Notas generales | "El cliente prefiere reuniones por la mañana" |
| `feature_request` | Features pedidos/planeados | "Agregar soporte para webhooks en v3" |

---

## Categorías Soportadas

### Categorías originales (técnicas)

| Categoría | Uso |
|-----------|-----|
| `learning` | Aprendizajes técnicos |
| `error` | Errores encontrados y resueltos |
| `feature_request` | Solicitudes de features |
| `correction` | Correcciones de información previa |
| `knowledge_gap` | Gaps de conocimiento detectados |
| `best_practice` | Mejores prácticas descubiertas |

### Categorías nuevas (contextuales)

| Categoría | Uso |
|-----------|-----|
| `infrastructure` | Infra: URLs, servicios, deployments |
| `project_registry` | Registro de proyectos y sus configs |
| `personal` | Datos personales del usuario |
| `financial` | Información financiera (costos, presupuestos) |
| `contact` | Contactos (nombres, roles, empresas) |
| `preference` | Preferencias del usuario |
| `goal` | Objetivos y metas |
| `relationship` | Relaciones entre personas/entidades |
| `health` | Datos de salud |
| `business` | Información de negocio |
| `client` | Datos de clientes |
| `deadline` | Fechas límite y plazos |
| `routine` | Rutinas y procesos recurrentes |
| `context` | Contexto general para sesiones |

---

## Features Core

### PII Scrubbing Automático

**Módulo:** `lib/brainx-phase2.js`

Antes de guardar cualquier memoria, BrainX aplica automáticamente redacción de datos sensibles. Los 14 patrones detectados:

| Patrón | Ejemplo detectado |
|--------|-------------------|
| `email` | `user@domain.com` |
| `phone` | `+1 (555) 123-4567` |
| `openai_key` | `sk-abc123...` |
| `github_token` | `ghp_xxxx...` |
| `github_pat` | `github_pat_xxxx...` |
| `aws_access_key` | `AKIAIOSFODNN7EXAMPLE` |
| `slack_token` | `xoxb-xxx-xxx` |
| `bearer_token` | `Bearer eyJ...` |
| `api_key_assignment` | `api_key=sk_live_xxx` |
| `jwt_token` | `eyJhbGciOi...` |
| `private_key_block` | `-----BEGIN RSA PRIVATE KEY-----` |
| `iban` | `DE89370400440532013000` |
| `credit_card` | `4111 1111 1111 1111` |
| `ipv4` | `192.168.1.100` |

**Comportamiento:**
- Habilitado por defecto (`BRAINX_PII_SCRUB_ENABLED=true`)
- Los datos se reemplazan con `[REDACTED]` (configurable)
- Se agregan tags automáticos: `pii:redacted`, `pii:email`, etc.
- Contextos en allowlist quedan exentos

```bash
BRAINX_PII_SCRUB_ENABLED=true                        # default: true
BRAINX_PII_SCRUB_REPLACEMENT=[REDACTED]               # default
BRAINX_PII_SCRUB_ALLOWLIST_CONTEXTS=internal-safe,trusted
```

### Deduplicación Semántica

**Módulo:** `lib/openai-rag.js` (storeMemory)

Al almacenar una memoria, BrainX verifica si ya existe una similar:

1. **Por `pattern_key`** — Si la memoria tiene pattern_key, busca otra con el mismo key
2. **Por similitud coseno** — Si no tiene pattern_key, compara el embedding contra memorias recientes del mismo contexto y categoría

Si se detecta duplicado (similitud ≥ threshold):
- **No crea una nueva** — actualiza la existente
- **Incrementa `recurrence_count`** — trackea cuántas veces se repite el patrón
- **Actualiza `last_seen`** — fecha de última observación
- **Preserva `first_seen`** — mantiene la fecha original

```bash
BRAINX_DEDUPE_SIM_THRESHOLD=0.92  # default: si similitud > 0.92, merge
BRAINX_DEDUPE_RECENT_DAYS=30      # ventana de comparación
```

### Score-Based Ranking

**Módulo:** `lib/openai-rag.js` (search)

Las búsquedas usan un score compuesto para ordenar resultados:

```
score = similitud_coseno
      + (importance / 10) × 0.25     # bonus por importancia
      + tier_bonus                     # hot: +0.15, warm: +0.05, cold: -0.05, archive: -0.10
```

Esto asegura que memorias de alta importancia y tier hot aparezcan primero, incluso con similitud ligeramente menor.

### Access Tracking

**Módulo:** `lib/openai-rag.js` (search)

Cada vez que una memoria aparece en resultados de búsqueda:
- `last_accessed` se actualiza a `NOW()`
- `access_count` se incrementa en 1

Esto permite al `quality-scorer.js` identificar memorias activamente usadas vs. estancadas.

### Superseding de Memorias

**Columna:** `superseded_by` (FK a otra memoria)

Cuando una memoria es reemplazada por una versión más nueva o más completa:
- Se marca con `superseded_by = ID_de_la_nueva`
- Las memorias supersedidas se **excluyen automáticamente** de búsquedas (`WHERE superseded_by IS NULL`)
- El `contradiction-detector.js` y `dedup-supersede.js` manejan esto automáticamente

### Pattern Detection y Recurrence Counting

**Tabla:** `brainx_patterns`

Cuando una memoria se repite (por `pattern_key` o por similitud semántica):
- Se actualiza el registro en `brainx_patterns` con:
  - `recurrence_count` — veces que se ha visto
  - `first_seen` / `last_seen` — rango temporal
  - `impact_score` — `importance × tier_impact`
  - `representative_memory_id` — la memoria más representativa
- Patrones con alta recurrencia son candidatos a **promoción** (vía `promote-candidates`)

### Query Logging y Performance Tracking

**Tabla:** `brainx_query_log`

Cada operación de `search` e `inject` registra:
- `query_hash` — hash de la consulta
- `query_kind` — `search` | `inject`
- `duration_ms` — tiempo de ejecución
- `results_count` — cantidad de resultados
- `avg_similarity` / `top_similarity` — métricas de similitud

Esto alimenta el comando `metrics` y los reportes de `ops-alerts.sh` y `weekly-dashboard.sh`.

### Lifecycle Management (Promote/Degrade/Archive)

**Comando:** `lifecycle-run`

El lifecycle manager automático evalúa memorias y decide acciones:

| Acción | Criterio |
|--------|----------|
| **Promote** (cold/warm → hot) | Patrones con alta recurrencia + importancia ≥ threshold |
| **Degrade** (hot → warm, warm → cold) | Sin acceso reciente + baja importancia + poco uso |
| **Archive** (cualquier → archive) | Memorias de muy baja calidad o sin uso prolongado |

```bash
# Ver qué haría sin ejecutar
./brainx-v5 lifecycle-run --dryRun --json

# Ejecutar promociones/degradaciones
./brainx-v5 lifecycle-run --json
```

Flags: `--promoteMinRecurrence`, `--promoteDays`, `--degradeDays`, `--lowImportanceMax`, `--lowAccessMax`

### Memory Injection Engine (Motor de Inyección)

**Módulo:** `lib/cli.js` → `cmdInject()` + `formatInject()`

El **Memory Injection Engine** es el componente central que conecta la memoria almacenada con los agentes. No es un simple `SELECT` — es un pipeline completo de recuperación, filtrado, ranking, truncación y formateo.

#### Flujo completo del pipeline de inyección:

```
Query de texto
     │
     ▼
  embed(query)               ← Genera embedding via OpenAI API
     │
     ▼
  Estrategia warm_or_hot     ← Busca primero en hot, luego en warm, merge unique
     │
     ▼
  SQL Ranking                 ← score = similitud + (importance/10 × 0.25) + tier_bonus
     │
     ▼
  Min Score Gate              ← Filtra resultados con score < 0.25 (configurable)
     │
     ▼
  formatInject()              ← Truncación inteligente por líneas y caracteres
     │
     ▼
  Output prompt-ready         ← Texto listo para inyectar en contexto del LLM
```

#### Estrategia de búsqueda `warm_or_hot` (default)

Cuando no se especifica tier, el inject:
1. Busca memorias `hot` (alta prioridad)
2. Busca memorias `warm` (prioridad media)
3. Merge: elimina duplicados por ID, prioriza hot, limita al `--limit` configurado

Esto asegura que memorias críticas (hot) siempre aparecen, complementadas con warm si hay espacio.

#### Truncación inteligente (`formatInject`)

El output se controla con 3 límites:

| Parámetro | Default | Variable de entorno | CLI flag |
|-----------|---------|---------------------|----------|
| Max chars por item | 2000 | `BRAINX_INJECT_MAX_CHARS_PER_ITEM` | `--maxCharsPerItem` |
| Max líneas por item | 80 | `BRAINX_INJECT_MAX_LINES_PER_ITEM` | `--maxLinesPerItem` |
| Max chars total | 12000 | `BRAINX_INJECT_MAX_TOTAL_CHARS` | `--maxTotalChars` |
| Min score gate | 0.25 | `BRAINX_INJECT_MIN_SCORE` | `--minScore` |

Si un item excede el límite, se trunca con `…`. Si el output total excede `maxTotalChars`, se corta sin incluir más items.

#### Formato de output

Cada memoria se formatea como:

```
[sim:0.82 score:1.12 imp:9 tier:hot type:decision agent:coder ctx:openclaw]
Contenido de la memoria aquí...

---

[sim:0.71 score:0.98 imp:8 tier:warm type:learning agent:support ctx:brainx]
Otro contenido...
```

Los metadatos en la cabecera `[sim:... score:... ...]` permiten al agente evaluar la relevancia de cada memoria.

#### Hook de Auto-Inject: Del motor al agente

El hook `hook/handler.js` usa el motor de inyección para crear `BRAINX_CONTEXT.md` automáticamente:

```
Evento agent:bootstrap
     │
     ▼
  handler.js se ejecuta
     │
     ├─ Sección 1: psql directo → Facts (type=fact, tier hot/warm)
     │
     ├─ Sección 2: brainx inject → Memorias propias del agente (context=agent:NAME, imp≥6)
     │
     ├─ Sección 3: brainx inject → Memorias del equipo (imp≥8, sin filtro de context)
     │
     ▼
  BRAINX_CONTEXT.md generado → Agente lo lee como Project Context
```

**Telemetría del hook:** Cada inyección registra en `brainx_pilot_log`:
- Agente, memorias propias, memorias de equipo, total de chars generados

### Memory Store Engine (Motor de Almacenamiento)

**Módulo:** `lib/openai-rag.js` → `storeMemory()`

El almacenamiento NO es un simple INSERT. Es un pipeline de 6 pasos dentro de una transacción:

```
Memoria nueva
     │
     ▼
  1. PII Scrubbing          ← scrubTextPII() sobre content y context
     │
     ▼
  2. Tag merging             ← mergeTagsWithMetadata() agrega tags pii:redacted si aplica
     │
     ▼
  3. Embedding               ← embed("type: content [context: ctx]")
     │
     ▼
  4. Dedup check             ← Por pattern_key O por similitud coseno (threshold 0.92)
     │                         deriveMergePlan() decide: merge vs. crear nueva
     ▼
  5. UPSERT                  ← INSERT ... ON CONFLICT DO UPDATE (transaccional)
     │                         Preserva first_seen, incrementa recurrence, actualiza last_seen
     ▼
  6. Pattern upsert          ← upsertPatternRecord() actualiza brainx_patterns
     │
     ▼
  Return metadata            ← {id, pattern_key, recurrence_count, pii_scrub_applied, 
                                 redacted, redaction_reasons, dedupe_merged, dedupe_method}
```

#### Normalización de lifecycle (`normalizeLifecycle`)

Antes de almacenar, cada memoria pasa por normalización que:
- Mapea campos camelCase ↔ snake_case (`firstSeen` → `first_seen`)
- Asigna defaults (`status: 'pending'`, timestamps al NOW())
- Preserva campos existentes si no se proveen

#### Impact score para patterns (`tierImpact`)

El impact score de un patrón se calcula como:

```
impact = importance × tier_factor

tier_factor:
  hot     → 1.0
  warm    → 0.7
  cold    → 0.4
  archive → 0.2
```

### Embedding Engine

**Módulo:** `lib/openai-rag.js` → `embed()`

- **Modelo:** `text-embedding-3-small` (configurable via `OPENAI_EMBEDDING_MODEL`)
- **Dimensiones:** 1536 (debe coincidir con el schema `vector(1536)`)
- **Input:** Se concatena como `"type: content [context: ctx]"` para maximizar relevancia semántica
- **API:** POST a `https://api.openai.com/v1/embeddings`
- **Costo:** ~$0.02 por millón de tokens (text-embedding-3-small)

### Database Layer

**Módulo:** `lib/db.js`

- Pool de conexiones PostgreSQL via `pg.Pool`
- `withClient(fn)` — obtiene un client del pool, ejecuta fn, y lo devuelve (para transacciones)
- `query(sql, params)` — ejecuta query directa
- `health()` — verifica conexión
- Carga automática de env desde `BRAINX_ENV` si `DATABASE_URL` no está seteado directamente

---

## Documentación Detallada de Scripts

### `memory-distiller.js` — Extractor LLM de Memorias

**Archivo:** `scripts/memory-distiller.js`

El Memory Distiller usa un LLM (por defecto `gpt-4.1-mini`) para leer transcripts completos de sesiones de agentes y extraer **TODOS** los tipos de memorias relevantes.

#### Qué extrae

A diferencia de extractores regex, el distiller **entiende contexto**:

1. **Facts** — URLs, endpoints, configs, datos personales, finanzas, contactos, fechas
2. **Decisions** — Decisiones técnicas y de negocio
3. **Learnings** — Bugs resueltos, workarounds descubiertos
4. **Gotchas** — Trampas y errores comunes
5. **Preferences** — Cómo le gustan las cosas al usuario

#### Uso

```bash
# Ejecución manual (últimas 8 horas por defecto)
node scripts/memory-distiller.js

# Personalizar ventana de tiempo
node scripts/memory-distiller.js --hours 24

# Solo un agente
node scripts/memory-distiller.js --agent coder

# Dry run (no guarda nada)
node scripts/memory-distiller.js --dry-run --verbose

# Modelo alternativo
node scripts/memory-distiller.js --model gpt-4o-mini

# Limitar sesiones procesadas
node scripts/memory-distiller.js --max-sessions 5
```

#### Argumentos

| Argumento | Default | Descripción |
|-----------|---------|-------------|
| `--hours` | 8 | Ventana de tiempo para buscar sesiones |
| `--dry-run` | false | Simular sin guardar nada |
| `--agent` | todos | Filtrar por agente específico |
| `--verbose` | false | Output detallado |
| `--model` | `gpt-4.1-mini` | Modelo LLM a usar |
| `--max-sessions` | 20 | Máximo de sesiones a procesar |

#### Tracking de sesiones

Las sesiones ya procesadas se rastrean en `data/distilled-sessions.json`. Si una sesión no se modificó desde la última vez, se salta automáticamente (idempotente).

#### Configuración

| Variable de entorno | Default | Descripción |
|---------------------|---------|-------------|
| `BRAINX_DISTILLER_MODEL` | `gpt-4.1-mini` | Modelo por defecto |
| `OPENAI_API_KEY` | — | **Requerido** |

---

### `fact-extractor.js` — Extractor Regex de Facts

**Archivo:** `scripts/fact-extractor.js`

Extractor rápido basado en regex que complementa al Memory Distiller. No usa LLM, por lo que es gratis y rápido.

#### Qué extrae

| Patrón | Ejemplo |
|--------|---------|
| URLs de Railway | `https://emailbot.up.railway.app` |
| URLs de Vercel | `https://app.vercel.app` |
| Repos de GitHub | `github.com/user/repo` |
| Mapeos de servicios | `service emailbot-api → backend` |
| Puertos y configs | `PORT=3001`, `NODE_ENV=production` |
| Branches | `branch: main`, `deploy target: staging` |

#### Uso

```bash
# Ejecución manual (últimas 24 horas por defecto)
node scripts/fact-extractor.js

# Ventana de tiempo personalizada
node scripts/fact-extractor.js --hours 48

# Solo un agente
node scripts/fact-extractor.js --agent raider

# Dry run
node scripts/fact-extractor.js --dry-run --verbose
```

#### Argumentos

| Argumento | Default | Descripción |
|-----------|---------|-------------|
| `--hours` | 24 | Ventana de tiempo para buscar sesiones |
| `--dry-run` | false | Simular sin guardar |
| `--agent` | todos | Filtrar por agente |
| `--verbose` | false | Output detallado |

---

### `session-harvester.js` — Harvester de Sesiones

**Archivo:** `scripts/session-harvester.js`

Lee sesiones recientes de OpenClaw (archivos JSONL) y extrae memorias de alta señal usando heurísticas regex. Busca patrones como decisiones, errores, aprendizajes y gotchas en el texto de las conversaciones.

#### Uso

```bash
# Ejecución manual (últimas 4 horas por defecto)
node scripts/session-harvester.js

# Personalizar ventana y límites
node scripts/session-harvester.js --hours 8 --max-memories 40

# Solo un agente, con dry-run
node scripts/session-harvester.js --agent main --dry-run --verbose

# Filtrar por tamaño mínimo de contenido
node scripts/session-harvester.js --min-chars 200
```

#### Argumentos

| Argumento | Default | Descripción |
|-----------|---------|-------------|
| `--hours` | 4 | Ventana de tiempo para buscar sesiones |
| `--dry-run` | false | Simular sin guardar |
| `--agent` | todos | Filtrar por agente |
| `--verbose` | false | Output detallado |
| `--min-chars` | 120 | Mínimo de caracteres para considerar una memoria válida |
| `--max-memories` | (sin límite) | Máximo de memorias a extraer |

#### Diferencia con Memory Distiller

| Característica | Session Harvester | Memory Distiller |
|----------------|-------------------|------------------|
| Método | Regex/heurísticas | LLM (gpt-4.1-mini) |
| Costo | Gratis | ~$0.01-0.05 por sesión |
| Comprensión | Patrones de texto | Entiende contexto completo |
| Velocidad | Muy rápido | Lento (API calls) |
| Calidad | Media (falsos positivos) | Alta |

---

### `memory-bridge.js` — Puente Markdown → Vectorial

**Archivo:** `scripts/memory-bridge.js`

Sincroniza archivos `memory/*.md` de todos los workspaces de OpenClaw hacia la base de datos vectorial. Cada sección H2 (`##`) del markdown se convierte en una memoria independiente y buscable.

#### Uso

```bash
# Ejecución manual (archivos de las últimas 6 horas)
node scripts/memory-bridge.js

# Ventana más amplia
node scripts/memory-bridge.js --hours 24

# Limitar memorias creadas
node scripts/memory-bridge.js --max-memories 30

# Dry run
node scripts/memory-bridge.js --dry-run --verbose
```

#### Argumentos

| Argumento | Default | Descripción |
|-----------|---------|-------------|
| `--hours` | 6 | Ventana de tiempo (archivos modificados recientemente) |
| `--dry-run` | false | Simular sin guardar |
| `--max-memories` | 20 | Máximo de memorias a crear |
| `--verbose` | false | Output detallado |

#### Cómo funciona

1. Escanea todos los directorios `~/.openclaw/workspace-*/memory/`
2. Busca archivos `.md` modificados en las últimas N horas
3. Divide cada archivo en bloques por secciones H2
4. Cada bloque se guarda como memoria tipo `note` con contexto del workspace
5. Las secciones ya sincronizadas se marcan con `<!-- brainx-synced -->`

---

### `cross-agent-learning.js` — Propagación Cross-Agente

**Archivo:** `scripts/cross-agent-learning.js`

Propaga learnings y gotchas de alta importancia de un agente individual al contexto global, para que **todos** los agentes se beneficien de descubrimientos compartidos.

#### Uso

```bash
# Ejecución manual (últimas 24 horas)
node scripts/cross-agent-learning.js

# Personalizar ventana
node scripts/cross-agent-learning.js --hours 48

# Dry run (recomendado primero)
node scripts/cross-agent-learning.js --dry-run --verbose

# Limitar comparticiones
node scripts/cross-agent-learning.js --max-shares 5
```

#### Argumentos

| Argumento | Default | Descripción |
|-----------|---------|-------------|
| `--hours` | 24 | Ventana de tiempo |
| `--dry-run` | false | Simular sin compartir |
| `--verbose` | false | Output detallado |
| `--max-shares` | 10 | Máximo de memorias a compartir |

#### Lógica

1. Busca memorias de tipo `learning` o `gotcha` con importancia alta
2. Filtra las que tienen contexto `agent:*` (específicas de un agente)
3. Crea una copia con contexto `global` para que todos los agentes la vean
4. Evita duplicados verificando si ya existe una copia global

---

### `contradiction-detector.js` — Detector de Contradicciones

**Archivo:** `scripts/contradiction-detector.js`

Detecta memorias hot semánticamente muy similares entre sí y marca las más antiguas/cortas como supersedidas por las más nuevas/completas.

#### Uso

```bash
# Dry run (recomendado primero)
node scripts/contradiction-detector.js --dry-run --verbose

# Analizar top 50 memorias hot con threshold 0.80
node scripts/contradiction-detector.js --top 50 --threshold 0.80

# Ejecutar (modifica la DB)
node scripts/contradiction-detector.js --verbose
```

#### Argumentos

| Argumento | Default | Descripción |
|-----------|---------|-------------|
| `--top` | 30 | Número de memorias hot a analizar |
| `--threshold` | 0.85 | Umbral de similitud coseno para considerar contradicción |
| `--dry-run` | false | Solo reportar, no modificar |
| `--verbose` | false | Imprimir análisis detallado de cada par |

#### Lógica

1. Carga las top N memorias hot (con embeddings)
2. Compara cada par calculando similitud coseno
3. Si similitud ≥ threshold, marca la más antigua o más corta como supersedida
4. La más nueva/completa se convierte en la memoria canónica

---

### `quality-scorer.js` — Evaluador de Calidad

**Archivo:** `scripts/quality-scorer.js`

Evalúa memorias existentes en base a múltiples factores y decide si deben ser promovidas, mantenidas, degradadas, o archivadas.

#### Uso

```bash
# Dry run (recomendado primero)
node scripts/quality-scorer.js --dry-run --verbose

# Evaluar más memorias
node scripts/quality-scorer.js --limit 100 --verbose

# Ejecutar (modifica tiers)
node scripts/quality-scorer.js
```

#### Argumentos

| Argumento | Default | Descripción |
|-----------|---------|-------------|
| `--limit` | 50 | Número de memorias a evaluar |
| `--dry-run` | false | Solo reportar, no modificar |
| `--verbose` | false | Mostrar detalle de scoring por memoria |

#### Factores de Scoring

| Factor | Efecto |
|--------|--------|
| **Edad de acceso** | >30 días sin acceso: -2, >14 días: -1, <3 días: +1 |
| **Conteo de accesos** | ≥10 accesos: +2, ≥5: +1, 0 accesos: -1 |
| **Longitud de contenido** | ≥100 chars: +1, <50 chars: -1 |
| **Archivos referenciados** | Por cada archivo inexistente: -0.5 |
| **Coherencia tier/importancia** | Importancia ≥8 en cold: +2 (promote); importancia ≤3 en hot: -2 (degrade) |

**Resultado:** Score 1-10 → decide la acción:
- Score alto → **promote** (subir tier)
- Score medio → **mantener** (sin cambio)
- Score bajo → **degrade** (bajar tier)
- Score muy bajo → **archive**

---

### `context-pack-builder.js` — Builder de Context Packs

**Archivo:** `scripts/context-pack-builder.js`

Genera "packs de contexto" semanales que resumen memorias hot/warm agrupadas por contexto (`agent:*`, `project:*`). Los packs son bloques markdown compactos diseñados para inyección eficiente en LLMs (menos tokens, más señal).

#### Uso

```bash
# Generar packs de los últimos 7 días
node scripts/context-pack-builder.js

# Personalizar ventana
node scripts/context-pack-builder.js --days 14

# Dry run
node scripts/context-pack-builder.js --dry-run --verbose
```

#### Argumentos

| Argumento | Default | Descripción |
|-----------|---------|-------------|
| `--days` | 7 | Ventana de tiempo (días) |
| `--dry-run` | false | Simular sin guardar |
| `--verbose` | false | Output detallado |

#### Output

Los packs se guardan en:
- **Tabla `brainx_context_packs`** — en la base de datos
- **Archivo `data/context-packs.json`** — cache local

Cada pack contiene contenido truncado (max 200 chars por memoria, 800 chars por pack de contexto).

---

### `cleanup-low-signal.js` — Limpieza de Memorias de Bajo Valor

**Archivo:** `scripts/cleanup-low-signal.js`

Degrada a `cold` las memorias con contenido muy corto y baja importancia, marcándolas con tag `low_signal`.

#### Uso

```bash
# Ejecutar con defaults
node scripts/cleanup-low-signal.js

# Configurar via variables de entorno
CLEANUP_MAX_LEN=20 CLEANUP_TIER=archive CLEANUP_MAX_IMPORTANCE=3 \
  node scripts/cleanup-low-signal.js
```

#### Configuración (Variables de entorno)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `CLEANUP_MAX_LEN` | 12 | Longitud máxima de contenido para considerar low-signal |
| `CLEANUP_TIER` | `cold` | Tier al que se degradan las memorias |
| `CLEANUP_MAX_IMPORTANCE` | 2 | Importancia máxima tras la degradación |

#### Lógica

Afecta memorias que cumplen **todos** estos criterios:
- `superseded_by IS NULL` (no supersedidas)
- `length(content) <= CLEANUP_MAX_LEN` (contenido muy corto)
- `type IN ('decision', 'action', 'learning', 'note')` (no afecta facts ni gotchas)

---

### `dedup-supersede.js` — Deduplicación Exacta

**Archivo:** `scripts/dedup-supersede.js`

Detecta memorias **exactamente duplicadas** (mismo type + content + context + agent) y supersede las copias más recientes, dejando solo el registro más antiguo.

#### Uso

```bash
# Dry run (ver qué se deduplicaría)
DEDUP_DRY_RUN=true node scripts/dedup-supersede.js

# Ejecutar deduplicación
node scripts/dedup-supersede.js
```

#### Configuración

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DEDUP_DRY_RUN` | `false` | Si `true`, solo reporta sin modificar |

#### Lógica

1. Calcula fingerprint MD5 de `type|content|context|agent`
2. Agrupa memorias con el mismo fingerprint
3. Mantiene la más antigua (`ORDER BY created_at ASC`)
4. Las demás se marcan con `superseded_by = ID_de_la_más_antigua`

---

### `reclassify-memories.js` — Reclasificador de Categorías

**Archivo:** `scripts/reclassify-memories.js`

Reclasifica memorias existentes que no tienen categoría asignada, usando reglas heurísticas basadas en regex (sin LLM).

#### Uso

```bash
# Ejecutar reclasificación
node scripts/reclassify-memories.js
```

#### Reglas de Clasificación

| Patrón detectado | Categoría asignada |
|------------------|--------------------|
| `error`, `fail`, `crash`, `bug`, `fix` | `error` |
| `learn`, `realiz`, `discover`, `found out` | `learning` |
| `decid`, `chose`, `decision`, `switch`, `migrat` | (tipo: `decision`) |
| `gotcha`, `careful`, `watch out`, `trap`, `avoid` | `correction` |
| `feature`, `request`, `want`, `need`, `wish` | `feature_request` |
| `best practice`, `pattern`, `convention`, `always` | `best_practice` |
| `gap`, `missing`, `didn't know`, `unclear` | `knowledge_gap` |

Además recalcula la importancia basándose en:
- Longitud del contenido (>500 chars: +1, >1000: +1)
- Tier actual (hot: +1)
- Conteo de accesos (>3: +1, >10: +1)

---

### `eval-memory-quality.js` — Evaluación de Calidad de Retrieval

**Archivo:** `scripts/eval-memory-quality.js`

Harness offline para evaluar la calidad del sistema de búsqueda. Usa un dataset JSON/JSONL de pares `query` + `expected_key` para medir hit rate y similitud.

#### Uso

```bash
# Ejecutar con dataset default
node scripts/eval-memory-quality.js --json

# Con dataset personalizado
node scripts/eval-memory-quality.js --dataset tests/fixtures/memory-eval-real.jsonl --k 5 --json
```

#### Argumentos

| Argumento | Default | Descripción |
|-----------|---------|-------------|
| `--dataset` | `tests/fixtures/memory-eval.jsonl` | Ruta al dataset |
| `--k` | 5 | Top-k resultados para evaluar |
| `--json` | false | Output en JSON |

#### Métricas reportadas

- `hit_at_k_proxy` — Tasa de acierto en top-k resultados
- `avg_top_similarity` — Similitud promedio del mejor resultado
- `duplicates_reduced` — Duplicados colapsados por `pattern_key`

---

### `generate-eval-dataset-from-memories.js` — Generador de Dataset

**Archivo:** `scripts/generate-eval-dataset-from-memories.js`

Genera un dataset JSONL a partir de memorias reales para usar con `eval-memory-quality.js`. Toma las memorias más recientes y crea pares query/expected_id.

#### Uso

```bash
# Generar dataset default (80 memorias)
node scripts/generate-eval-dataset-from-memories.js

# Personalizar output y cantidad
node scripts/generate-eval-dataset-from-memories.js /path/to/output.jsonl 100
```

#### Argumentos

| Posición | Default | Descripción |
|----------|---------|-------------|
| 1 | `tests/fixtures/memory-eval-real.jsonl` | Ruta de salida |
| 2 | 80 | Cantidad de memorias a incluir |

---

### `import-workspace-memory-md.js` — Importador de MEMORY.md

**Archivo:** `scripts/import-workspace-memory-md.js`

Importa un archivo `MEMORY.md` completo al brain vectorial. Divide el contenido en chunks de ~5000 caracteres y los almacena como memorias tipo `note`.

#### Uso

```bash
# Importar MEMORY.md default (../../MEMORY.md relativo a brainx-v5)
node scripts/import-workspace-memory-md.js

# Importar archivo específico
MEMORY_MD=/home/clawd/.openclaw/workspace-coder/MEMORY.md \
  node scripts/import-workspace-memory-md.js
```

#### Configuración

| Variable | Default | Descripción |
|----------|---------|-------------|
| `MEMORY_MD` | `../../MEMORY.md` (relativo) | Ruta al archivo a importar |

#### Lógica

1. Lee el archivo MEMORY.md completo
2. Lo divide en chunks de ~5000 caracteres (respetando saltos de línea)
3. Genera ID único por chunk (SHA1 del contenido)
4. Almacena cada chunk como memoria tipo `note` con tags `imported`, `memory-md`

---

### `migrate-v2-to-v3.js` — Migración desde BrainX V2

**Archivo:** `scripts/migrate-v2-to-v3.js`

Migra memorias almacenadas en el formato de archivos JSON de BrainX V2 hacia la base de datos PostgreSQL de V4.

#### Uso

```bash
# Migrar desde ubicación default
node scripts/migrate-v2-to-v3.js

# Especificar ubicación de V2
BRAINX_V2_HOME=/path/to/brainx-v2 node scripts/migrate-v2-to-v3.js
```

#### Configuración

| Variable | Default | Descripción |
|----------|---------|-------------|
| `BRAINX_V2_HOME` | `../../brainx-v2` (relativo) | Directorio raíz de BrainX V2 |

#### Lógica

1. Busca archivos JSON en `storage/{hot,warm,cold}/` de V2
2. Lee cada archivo y mapea el tier
3. Genera un ID basado en SHA1 del contenido
4. Almacena en PostgreSQL con embedding nuevo via `storeMemory()`

---

### `backup-brainx.sh` — Backup Completo

**Archivo:** `scripts/backup-brainx.sh`

Crea un backup completo de BrainX V5 incluyendo base de datos, configuración, hooks, workspaces y wrappers.

#### Uso

```bash
# Backup a directorio default
./scripts/backup-brainx.sh

# Backup a directorio específico
./scripts/backup-brainx.sh ~/mis-backups

# Output: ~/mis-backups/brainx-v5_backup_YYYYMMDD_HHMMSS.tar.gz
```

#### Qué incluye el backup

| Componente | Archivo en backup | Criticidad |
|------------|-------------------|------------|
| Base de datos PostgreSQL | `brainx_v5_database.sql` | 🔴 CRÍTICO |
| Skill BrainX V5 completo | `config/brainx-v5-skill/` | 🟢 Reinstalable |
| Variables de entorno | `config/openclaw.env` | 🔴 CRÍTICO |
| Configuración OpenClaw | `config/openclaw.json` | 🟡 Medio |
| Hooks personalizados | `hooks/` | 🟡 Medio |
| brainx.md de workspaces | `workspaces/` | 🟢 Recreatable |
| Wrappers de workspaces | `wrappers/` | 🟢 Recreatable |
| Metadatos del backup | `METADATA.json` | 📋 Info |

#### Cron recomendado

```bash
# Backup diario a las 3 AM
0 3 * * * /home/clawd/.openclaw/skills/brainx-v5/scripts/backup-brainx.sh ~/backups >> ~/backups/backup.log 2>&1

# Limpiar backups viejos (mantener 7 días)
0 4 * * * find ~/backups -name "brainx-v5_backup_*.tar.gz" -mtime +7 -delete
```

---

### `restore-brainx.sh` — Restauración Completa

**Archivo:** `scripts/restore-brainx.sh`

Restaura completamente BrainX V5 desde un backup, incluyendo base de datos, skill, hooks, configuración y workspaces.

#### Uso

```bash
# Restauración interactiva (pide confirmación)
./scripts/restore-brainx.sh brainx-v5_backup_20260220.tar.gz

# Restauración sin confirmación
./scripts/restore-brainx.sh brainx-v5_backup_20260220.tar.gz --force

# Solo archivos (sin restaurar DB)
./scripts/restore-brainx.sh brainx-v5_backup_20260220.tar.gz --skip-db
```

#### Opciones

| Opción | Descripción |
|--------|-------------|
| `--force` | Sobrescribir archivos existentes sin preguntar |
| `--skip-db` | No restaurar la base de datos (solo archivos de configuración) |

#### Pasos de restauración

1. **Base de datos PostgreSQL** — Restaura el dump SQL completo
2. **Skill BrainX V5** — Copia el skill a `~/.openclaw/skills/brainx-v5`
3. **Hooks personalizados** — Restaura hooks a `~/.openclaw/hooks/internal/`
4. **Configuración OpenClaw** — Merge de hooks en `openclaw.json`
5. **brainx.md de workspaces** — Restaura a cada workspace
6. **Wrappers** — Restaura scripts wrapper de cada workspace

---

## Documentación de Scripts Cron

### `health-check.sh` — Health Check Periódico

**Archivo:** `cron/health-check.sh`

Verifica el estado de BrainX V5 cada 30 minutos, registrando el resultado en un log.

#### Qué verifica

1. Existencia del CLI `brainx-v5`
2. Ejecuta `brainx-v5 health` (conexión a PostgreSQL + pgvector)
3. Cuenta total de memorias en la DB
4. Cuenta memorias creadas en las últimas 24h

#### Log

- Ubicación: `/home/clawd/.openclaw/skills/brainx-v5/cron/health.log`
- Auto-rotación: mantiene las últimas 1000 líneas
- Lock file: `/tmp/brainx-health-check.lock` (previene ejecuciones concurrentes)

#### Cron recomendado

```bash
*/30 * * * * /home/clawd/.openclaw/skills/brainx-v5/cron/health-check.sh
```

---

### `ops-alerts.sh` — Alertas Operacionales Diarias

**Archivo:** `cron/ops-alerts.sh`

Genera un reporte operacional diario con métricas de performance y alertas automáticas.

#### Qué reporta

- **Lifecycle:** Cantidad de memorias promoted/degraded (dry-run)
- **Latencia:** Tiempos promedio de `inject` y `search`
- **Alertas automáticas:**
  - Inject > 2000ms → alerta
  - Search > 1300ms → alerta
  - Degradaciones > 25 en un día → alerta

#### Output ejemplo

```
Reporte operativo BrainX (24h)
- lifecycle: promoted=3, degraded=12
- latencia: inject=450ms, search=320ms
- alertas: ninguna
```

#### Cron recomendado

```bash
0 8 * * * /home/clawd/.openclaw/skills/brainx-v5/cron/ops-alerts.sh
```

---

### `weekly-dashboard.sh` — Dashboard Semanal

**Archivo:** `cron/weekly-dashboard.sh`

Genera un dashboard semanal completo con todas las métricas del sistema.

#### Secciones del dashboard

1. **📊 Estado General** — Métricas 7d, auto-harvested, dedup fusionadas
2. **🔥 Top Patrones** — Patrones con mayor recurrencia (top 5)
3. **🤖 Cross-Agent Activity** — Top 5 contextos con más memorias creadas
4. **📦 Quality Distribution** — Distribución de memorias por tier
5. **⚡ Performance Query** — Promedio de queries por tipo
6. **📈 Tendencia Diaria** — Desglose día a día de calls y latencia

#### Output ejemplo

```
🧠 BrainX Weekly Dashboard (7 días)

📊 Estado General:
- metrics: true
- auto-harvested: 45 memorias creadas
- dedup fusionadas: 12 memorias

🔥 Top Patrones (recurrence):
  - railway.deploy.fail: 8x
  - retry.429.swallow: 5x

🤖 Cross-Agent Activity (top 5):
  - agent:coder: 28 memorias (avg imp: 6.2)
  - project:emailbot: 15 memorias (avg imp: 7.1)

📦 Quality Distribution (por tier):
  - hot: 45
  - warm: 120
  - cold: 30

⚡ Performance Query (promedio 7d):
  - inject: 152 calls
  - search: 89 calls

📈 Tendencia Diaria:
  - 2026-02-26 inject: 25 calls, 412ms
  - 2026-02-26 search: 14 calls, 298ms
```

#### Cron recomendado

```bash
0 9 * * 1 /home/clawd/.openclaw/skills/brainx-v5/cron/weekly-dashboard.sh
```

---

## Módulos Core (`lib/`)

### `openai-rag.js` — Core RAG

Módulo principal que implementa toda la lógica de almacenamiento y búsqueda vectorial.

#### Funciones exportadas

| Función | Descripción |
|---------|-------------|
| `embed(text)` | Genera embedding via OpenAI API (`text-embedding-3-small`, 1536 dims) |
| `storeMemory(memory)` | Almacena memoria con PII scrub, dedup semántico y pattern tracking |
| `search(query, options)` | Búsqueda por similitud coseno con score compuesto y access tracking |
| `logQueryEvent(event)` | Registra telemetría de consulta en `brainx_query_log` |

#### Flujo de `storeMemory()`

```
Input → PII Scrub → Embed → Check Dedup (pattern_key o semántico)
                                  │
                          ┌───────┴───────┐
                          │ Duplicado     │ Nuevo
                          │ encontrado    │
                          ▼               ▼
                    Merge/Update      Insert nuevo
                    recurrence++      registro
                          │               │
                          └───────┬───────┘
                                  ▼
                         Upsert brainx_patterns
                                  ▼
                              COMMIT
```

#### Flujo de `search()`

```
Query → Embed → SQL (coseno + importance bonus + tier bonus)
                  │
                  ▼
         Filter (minSimilarity)
                  │
                  ▼
         Update access_count + last_accessed
                  │
                  ▼
         Return resultados ordenados por score
```

---

### `brainx-phase2.js` — Controles de Seguridad

Módulo con funciones de seguridad y control de calidad pre-almacenamiento.

#### Funciones exportadas

| Función | Descripción |
|---------|-------------|
| `getPhase2Config()` | Lee configuración de PII y dedup desde env vars |
| `shouldScrubForContext(context, cfg)` | Determina si PII scrub aplica a este contexto |
| `scrubTextPII(text, opts)` | Aplica 14 patrones regex de PII, retorna texto limpio + razones |
| `mergeTagsWithMetadata(tags, meta)` | Agrega tags `pii:*` si hubo redacción |
| `deriveMergePlan(existingRow, lifecycle, now)` | Calcula plan de merge para dedup (recurrence, timestamps) |
| `cosineSimilarity(a, b)` | Calcula similitud coseno entre dos vectores |

---

### `db.js` — Pool PostgreSQL

Módulo de conexión a la base de datos.

#### Funciones exportadas

| Función | Descripción |
|---------|-------------|
| `query(text, params)` | Ejecuta query SQL con parámetros |
| `withClient(fn)` | Obtiene un client del pool, ejecuta función, y libera |
| `pool` | Acceso directo al pool de `pg` |

#### Configuración

- Lee `DATABASE_URL` del entorno (o de `.env` via dotenv)
- Soporte para `BRAINX_ENV` como ruta alternativa al `.env`
- Pool de conexiones estándar de `pg`

---

### `cli.js` — CLI Completo

Implementa todos los comandos del CLI `brainx-v5`.

#### Comandos

```
brainx-v5 health
brainx-v5 add --type <type> --content <text> [opciones]
brainx-v5 fact --content <text> [opciones]
brainx-v5 facts [--context <ctx>] [--limit <n>]
brainx-v5 search --query <text> [opciones]
brainx-v5 inject --query <text> [opciones]
brainx-v5 resolve (--id <id> | --patternKey <key>) --status <status> [opciones]
brainx-v5 promote-candidates [opciones]
brainx-v5 lifecycle-run [opciones]
brainx-v5 metrics [--days <n>] [--topPatterns <n>] [--json]
```

---

## Hook de Auto-Inyección

**Archivo:** `hook/handler.js`

Se ejecuta automáticamente en el evento `agent:bootstrap` de OpenClaw. Genera `BRAINX_CONTEXT.md` en el workspace del agente con **3 secciones**:

### Sección 1: 📌 Project Facts (Infrastructure)

Consulta directa a PostgreSQL — todos los facts tipo `fact` con tier `hot`/`warm`, ordenados por importancia.

```sql
SELECT content, tier, importance, context, tags
FROM brainx_memories
WHERE type = 'fact' AND superseded_by IS NULL AND tier IN ('hot', 'warm')
ORDER BY importance DESC, last_seen DESC
LIMIT 15;
```

### Sección 2: 🤖 Memorias propias del agente

Usa `brainx inject` filtrado por contexto del agente actual (`agent:NOMBRE`), con importancia mínima 6. Memorias recientes de decisiones y gotchas.

### Sección 3: 🔥 Equipo (alta importancia)

Memorias globales de alta importancia (≥8) compartidas entre todos los agentes. Decisiones críticas e infraestructura.

### Telemetría

El hook registra estadísticas en la tabla `brainx_pilot_log`:
- Agente, cantidad de facts, memorias propias, memorias de equipo, total de caracteres inyectados.

### Configuración en openclaw.json

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "brainx-auto-inject": {
          "enabled": true,
          "limit": 5,
          "tier": "hot+warm",
          "minImportance": 5
        }
      }
    }
  }
}
```

---

## Pipeline de Auto-Alimentación

### Cron recomendado completo

```bash
# ── Health & Monitoring ──
*/30 * * * * /home/clawd/.openclaw/skills/brainx-v5/cron/health-check.sh

# ── Alimentación (cada 4-6h) ──
0 */6 * * * cd /home/clawd/.openclaw/skills/brainx-v5 && node scripts/memory-distiller.js --hours 8 >> /tmp/brainx-distiller.log 2>&1
0 */6 * * * cd /home/clawd/.openclaw/skills/brainx-v5 && node scripts/fact-extractor.js --hours 8 >> /tmp/brainx-facts.log 2>&1
0 */4 * * * cd /home/clawd/.openclaw/skills/brainx-v5 && node scripts/session-harvester.js --hours 6 >> /tmp/brainx-harvester.log 2>&1
0 */6 * * * cd /home/clawd/.openclaw/skills/brainx-v5 && node scripts/memory-bridge.js --hours 8 >> /tmp/brainx-bridge.log 2>&1

# ── Mantenimiento diario ──
0 2 * * * cd /home/clawd/.openclaw/skills/brainx-v5 && node scripts/contradiction-detector.js >> /tmp/brainx-contradictions.log 2>&1
0 2 * * * cd /home/clawd/.openclaw/skills/brainx-v5 && node scripts/quality-scorer.js >> /tmp/brainx-quality.log 2>&1
0 3 * * * cd /home/clawd/.openclaw/skills/brainx-v5 && node scripts/cross-agent-learning.js >> /tmp/brainx-cross.log 2>&1

# ── Mantenimiento semanal ──
0 4 * * 0 cd /home/clawd/.openclaw/skills/brainx-v5 && node scripts/context-pack-builder.js >> /tmp/brainx-packs.log 2>&1
0 4 * * 0 cd /home/clawd/.openclaw/skills/brainx-v5 && node scripts/cleanup-low-signal.js >> /tmp/brainx-cleanup.log 2>&1
0 4 * * 0 cd /home/clawd/.openclaw/skills/brainx-v5 && node scripts/dedup-supersede.js >> /tmp/brainx-dedup.log 2>&1

# ── Reportes ──
0 8 * * * /home/clawd/.openclaw/skills/brainx-v5/cron/ops-alerts.sh >> /tmp/brainx-ops.log 2>&1
0 9 * * 1 /home/clawd/.openclaw/skills/brainx-v5/cron/weekly-dashboard.sh >> /tmp/brainx-weekly.log 2>&1

# ── Backup diario ──
0 3 * * * /home/clawd/.openclaw/skills/brainx-v5/scripts/backup-brainx.sh ~/backups >> ~/backups/backup.log 2>&1
0 4 * * * find ~/backups -name "brainx-v5_backup_*.tar.gz" -mtime +7 -delete
```

---

## Convención de Namespaces

Todas las memorias usan `--context` para namespacing:

| Patrón | Uso | Ejemplo |
|--------|-----|---------|
| `agent:NOMBRE` | Memorias específicas de un agente | `agent:coder`, `agent:raider` |
| `project:NOMBRE` | Memorias de un proyecto | `project:emailbot`, `project:mdx-web` |
| `personal:TOPIC` | Datos personales | `personal:finanzas`, `personal:salud` |
| `business:TOPIC` | Datos de negocio | `business:mdx`, `business:pricing` |
| `global` | Compartidas entre todos | `global` |

---

## Schema de Base de Datos

### Tabla principal: `brainx_memories`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | text (PK) | ID único de la memoria |
| `type` | text | `decision` \| `action` \| `learning` \| `gotcha` \| `note` \| `feature_request` \| `fact` |
| `content` | text | Contenido textual |
| `context` | text | Namespace (`agent:X`, `project:Y`) |
| `tier` | text | `hot` \| `warm` \| `cold` \| `archive` |
| `agent` | text | Agente que creó la memoria |
| `importance` | integer | 1-10 |
| `embedding` | vector(1536) | Embedding OpenAI |
| `created_at` | timestamptz | Fecha de creación |
| `last_accessed` | timestamptz | Último acceso (se actualiza en cada search) |
| `access_count` | integer | Veces accedida (se incrementa en cada search) |
| `source_session` | text | Sesión de origen |
| `superseded_by` | text (FK) | Si fue reemplazada, apunta a la nueva |
| `tags` | text[] | Array de tags (incluye `pii:*` si hubo redacción) |
| `status` | text | `pending` \| `in_progress` \| `resolved` \| `promoted` \| `wont_fix` |
| `category` | text | Categoría (ver sección Categorías) |
| `pattern_key` | text | Clave de patrón recurrente |
| `recurrence_count` | integer | Veces que apareció el patrón |
| `first_seen` | timestamptz | Primera vez visto |
| `last_seen` | timestamptz | Última vez visto |
| `resolved_at` | timestamptz | Fecha de resolución |
| `promoted_to` | text | Destino de promoción |
| `resolution_notes` | text | Notas de resolución |

### Índices optimizados

- `idx_mem_embedding` — HNSW para búsqueda vectorial rápida
- `idx_mem_facts` — Índice parcial para facts activos (type=fact, no superseded)
- `idx_mem_context`, `idx_mem_tier`, `idx_mem_tags` — Filtrado por metadatos
- `idx_mem_pattern_key`, `idx_mem_pattern_recurrence` — Patrones recurrentes
- `idx_mem_status` — Lifecycle

### Todas las tablas

| Tabla | Propósito |
|-------|-----------|
| `brainx_memories` | 🔴 Almacén principal de memorias con embeddings |
| `brainx_learning_details` | Metadatos extendidos de aprendizajes |
| `brainx_trajectories` | Trayectorias de acciones de agentes |
| `brainx_context_packs` | Snapshots de contexto empaquetado (generados por context-pack-builder) |
| `brainx_session_snapshots` | Resúmenes de sesiones |
| `brainx_pilot_log` | Log de auditoría/telemetría de inyección del hook |
| `brainx_patterns` | Agregación de patrones recurrentes + tracking de promoción |
| `brainx_query_log` | Telemetría de búsquedas (duración/resultados/similitud) |

---

## Tablas Avanzadas del Sistema

Más allá de la tabla principal `brainx_memories`, BrainX V5 incluye 6 tablas especializadas que extienden las capacidades del sistema. Cada una resuelve un problema específico y está diseñada para funcionar tanto de forma independiente como integrada.

### `brainx_trajectories` — Trayectorias Reutilizables

**Qué es:** Un registro de soluciones multi-paso que documenta cómo se resolvió un problema: qué se intentó, qué pasos se siguieron y cuál fue el resultado.

**Para qué sirve:** Cuando un agente enfrenta un problema similar al que ya fue resuelto, puede buscar semánticamente en las trayectorias y encontrar una solución probada en lugar de empezar de cero.

**Columnas principales:**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | text (PK) | ID único de la trayectoria |
| `context` | text | Namespace del proyecto/agente |
| `problem` | text (NOT NULL) | Descripción del problema que se enfrentó |
| `steps` | JSONB | Array de pasos seguidos para resolver (estructura libre) |
| `solution` | text | Solución final aplicada |
| `outcome` | text | `success` \| `partial` \| `failed` |
| `agent` | text | Agente que registró la trayectoria |
| `embedding` | vector(1536) | Embedding del problema para búsqueda semántica |
| `times_used` | integer | Contador de cuántas veces se reutilizó esta trayectoria |
| `created_at` | timestamptz | Fecha de creación |

**Búsqueda:** Tiene su propio índice `ivfflat` (`idx_traj_embedding`) para búsqueda por similitud coseno.

**Ejemplo de uso:**
```json
{
  "problem": "Deploy falla por migraciones pendientes en Railway",
  "steps": [
    {"step": 1, "action": "Verificar railway status", "result": "service crashloop"},
    {"step": 2, "action": "Revisar logs", "result": "migration error en schema"},
    {"step": 3, "action": "psql manual migration", "result": "schema actualizado"}
  ],
  "solution": "Ejecutar migraciones manualmente antes del deploy",
  "outcome": "success"
}
```

---

### `brainx_session_snapshots` — Estado de Sesiones

**Qué es:** Captura el estado completo de una sesión de trabajo para poder reanudarla después de una interrupción larga (horas, días).

**Para qué sirve:** Cuando un agente retoma un proyecto después de tiempo, puede buscar el último snapshot y recuperar: qué estaba haciendo, qué quedó pendiente, qué bloqueantes había, y qué URLs/recursos eran relevantes.

**Columnas principales:**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | text (PK) | ID único del snapshot |
| `project` | text (NOT NULL) | Nombre del proyecto |
| `agent` | text | Agente que generó el snapshot |
| `summary` | text (NOT NULL) | Resumen del estado actual |
| `status` | text | `in_progress` \| `completed` \| `blocked` \| `paused` |
| `pending_items` | JSONB | Lista de tareas pendientes (default `[]`) |
| `blockers` | JSONB | Bloqueantes actuales (default `[]`) |
| `last_file_touched` | text | Último archivo modificado |
| `last_error` | text | Último error encontrado |
| `key_urls` | JSONB | URLs importantes del proyecto (default `[]`) |
| `embedding` | vector(1536) | Embedding del resumen para búsqueda semántica |
| `session_start` | timestamptz | Inicio de la sesión |
| `session_end` | timestamptz | Fin de la sesión |
| `turn_count` | integer | Número de turnos de conversación |

**Índices:** `idx_snapshots_project` (project + session_end DESC) y `idx_snapshots_embedding` (ivfflat coseno).

---

### `brainx_learning_details` — Postmortem Estructurado

**Qué es:** Extensión de memorias tipo `learning` con campos estructurados para análisis profundo de errores. Mientras que `brainx_memories` almacena "X falló", esta tabla almacena *por qué* falló, *cómo* se corrigió y *qué* debería hacerse diferente.

**Para qué sirve:** Análisis profundo de errores con capacidad de promoción: cuando un learning se repite lo suficiente, puede escalarse a regla permanente (gotcha, best practice, o entrada en runbook).

**Columnas principales:**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `memory_id` | text (PK, FK → brainx_memories) | Referencia a la memoria padre |
| `category` | text | Categoría del aprendizaje |
| `what_was_wrong` | text | Descripción de lo que estaba mal |
| `what_is_correct` | text | Descripción de lo correcto |
| `source` | text | Fuente del aprendizaje |
| `error_message` | text | Mensaje de error literal |
| `command_attempted` | text | Comando que se intentó |
| `stack_trace` | text | Stack trace completo |
| `reproducible` | text | `yes` \| `no` \| `unknown` |
| `suggested_fix` | text | Corrección sugerida |
| `environment` | text | Entorno donde ocurrió |
| `related_files` | text[] | Archivos relacionados |
| `requested_capability` | text | Capacidad que se necesitaba |
| `user_context` | text | Contexto del usuario al momento del error |
| `complexity` | text | `simple` \| `medium` \| `complex` |
| `suggested_implementation` | text | Implementación sugerida |
| `frequency` | text | `first_time` \| `recurring` |
| `promotion_status` | text | Estado de promoción (`pending` default) |
| `promoted_to` | text | Destino de la promoción (ej: "runbook", "gotcha") |
| `promoted_at` | timestamptz | Fecha de promoción |
| `see_also` | text[] | Referencias cruzadas |

---

### `brainx_patterns` — Agregación de Patrones Recurrentes

**Qué es:** Tabla que agrupa memorias similares por `pattern_key`, trackeando cuántas veces apareció un patrón, su impacto, y si ya fue promovido.

**Para qué sirve:** Detectar patrones recurrentes y priorizarlos. Si el mismo error aparece 5 veces en 30 días, es una señal clara de que necesita atención prioritaria. El sistema usa `brainx_patterns` para alimentar `lifecycle-run` y `promote-candidates`.

**Columnas principales:**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `pattern_key` | text (PK) | Clave única del patrón |
| `recurrence_count` | integer | Veces que apareció (mínimo 1) |
| `first_seen` | timestamptz | Primera aparición |
| `last_seen` | timestamptz | Última aparición |
| `impact_score` | real | Score calculado: `importance × tierImpact` |
| `representative_memory_id` | text (FK) | La mejor memoria representativa del patrón |
| `last_memory_id` | text (FK) | Última memoria que matcheó el patrón |
| `last_category` | text | Categoría de la última ocurrencia |
| `last_status` | text | Status de la última ocurrencia |
| `promoted_to` | text | Destino de promoción si aplica |

**Actualización automática:** Cada vez que `storeMemory()` recibe una memoria con `pattern_key`, se hace upsert en esta tabla via `upsertPatternRecord()`, incrementando contadores y actualizando timestamps.

**Índices:** `idx_patterns_last_seen` y `idx_patterns_recurrence` (recurrence_count DESC, impact_score DESC).

---

### `brainx_pilot_log` — Telemetría de Inyección

**Qué es:** Registro de cada inyección de contexto que hace el hook de auto-inject (`hook/handler.js`), con métricas de lo que se inyectó en cada bootstrap de agente.

**Para qué sirve:** Monitorear la actividad del hook de auto-inject. Permite responder preguntas como: "¿Cuántas memorias propias se inyectan por agente?", "¿Cuántos chars de contexto se generan?", "¿Qué agentes están recibiendo más contexto?".

**Columnas:**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | serial (PK) | ID autoincremental |
| `agent` | varchar(50) | Nombre del agente que recibió la inyección |
| `own_memories` | integer | Cantidad de memorias propias del agente inyectadas (default 0) |
| `team_memories` | integer | Cantidad de memorias de equipo (alta importancia) inyectadas (default 0) |
| `total_chars` | integer | Total de caracteres escritos en BRAINX_CONTEXT.md (default 0) |
| `injected_at` | timestamptz | Timestamp de la inyección (default NOW()) |

---

### `brainx_query_log` — Performance de Queries

**Qué es:** Registro de telemetría de cada búsqueda (search) o inyección (inject) ejecutada, con métricas de duración y calidad de resultados.

**Para qué sirve:** Detectar degradación de performance, monitorear la calidad de las búsquedas, y alimentar el comando `metrics` con datos reales. Si las queries empiezan a tardar más o la similitud promedio baja, es señal de que algo necesita atención.

**Columnas principales:**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | bigserial (PK) | ID autoincremental |
| `query_hash` | text (NOT NULL) | Hash de la query para agrupar repetidas |
| `query_kind` | text (NOT NULL) | `search` \| `inject` |
| `duration_ms` | integer | Duración de la query en milisegundos |
| `results_count` | integer | Cantidad de resultados retornados |
| `avg_similarity` | real | Similitud promedio de los resultados |
| `top_similarity` | real | Similitud del mejor resultado |

**Logging automático:** Cada llamada a `cmdSearch()` y `cmdInject()` en `lib/cli.js` llama a `rag.logQueryEvent()` que inserta en esta tabla. El logging nunca bloquea ni rompe el flujo principal (errores se ignoran silenciosamente).

**Índices:** `idx_query_log_created` y `idx_query_log_kind_created` para consultas por rango de tiempo.

**Uso via CLI:**
```bash
# Ver métricas de queries de los últimos 7 días
./brainx-v5 metrics --days 7 --json
```

---

## Phase 2: Governance y Seguridad

Phase 2 agrega tres capas de protección y automatización al pipeline de almacenamiento de memorias. Está implementado en `lib/brainx-phase2.js` e integrado directamente en `storeMemory()` de `lib/openai-rag.js`.

### PII Scrubbing Automático

Antes de almacenar cualquier memoria, el contenido pasa por un pipeline de redacción que detecta y reemplaza **14 patrones de datos sensibles**:

| # | Patrón | Ejemplo detectado |
|---|--------|-------------------|
| 1 | **Email** | `user@example.com` → `[REDACTED]` |
| 2 | **Teléfono** | `+1 (555) 123-4567` → `[REDACTED]` |
| 3 | **OpenAI API Key** | `sk-abc123...` → `[REDACTED]` |
| 4 | **GitHub Token** | `ghp_xxxx...` → `[REDACTED]` |
| 5 | **GitHub PAT** | `github_pat_xxxx...` → `[REDACTED]` |
| 6 | **AWS Access Key** | `AKIAXXXXXXXXXXXXXXXX` → `[REDACTED]` |
| 7 | **Slack Token** | `xoxb-xxxx...` → `[REDACTED]` |
| 8 | **Bearer Token** | `Bearer eyJ...` → `[REDACTED]` |
| 9 | **API Key Assignment** | `api_key=sk-xxxx` → `[REDACTED]` |
| 10 | **JWT Token** | `eyJhbG...` → `[REDACTED]` |
| 11 | **Private Key Block** | `-----BEGIN PRIVATE KEY-----` → `[REDACTED]` |
| 12 | **IBAN** | `DE89370400440532013000` → `[REDACTED]` |
| 13 | **Credit Card** | `4111 1111 1111 1111` → `[REDACTED]` |
| 14 | **IPv4** | `192.168.1.100` → `[REDACTED]` |

**Comportamiento:**
- Habilitado por defecto (`BRAINX_PII_SCRUB_ENABLED=true`)
- El texto de reemplazo es configurable (`BRAINX_PII_SCRUB_REPLACEMENT`, default `[REDACTED]`)
- Se pueden excluir contextos específicos de la redacción con `BRAINX_PII_SCRUB_ALLOWLIST_CONTEXTS` (CSV)
- Cuando se redacta contenido, se agregan tags automáticos: `pii:redacted`, `pii:email`, `pii:phone`, etc.

### Dedup Semántico

Al almacenar una memoria, el sistema busca si ya existe una memoria "suficientemente similar" en el mismo contexto y categoría:

1. Si la memoria tiene `pattern_key`, busca por match exacto de pattern_key
2. Si no, genera el embedding y busca memorias recientes con similitud ≥ threshold
3. Si encuentra match: **hace merge** (incrementa recurrence_count, actualiza timestamps, reutiliza el ID existente)
4. Si no: crea nueva memoria

**Configuración:**
```bash
BRAINX_DEDUPE_SIM_THRESHOLD=0.92   # Umbral de similitud (default 0.92)
BRAINX_DEDUPE_RECENT_DAYS=30       # Solo busca en memorias de los últimos N días
```

### Lifecycle Automation

El comando `lifecycle-run` automatiza transiciones de estado basadas en reglas:

- **Promote:** Memorias recurrentes (`recurrence_count >= 3` en los últimos 30 días) se promueven a status `promoted`
- **Degrade:** Memorias stale (`pending` o `in_progress` sin acceso en 45+ días, baja importancia, pocos accesos) se degradan a `wont_fix`
- Los registros de `brainx_patterns` se actualizan automáticamente con cada transición

**Configuración:**
```bash
BRAINX_LIFECYCLE_PROMOTE_MIN_RECURRENCE=3   # Mínimo de recurrencias para promover
BRAINX_LIFECYCLE_PROMOTE_DAYS=30            # Ventana de tiempo para promoción
BRAINX_LIFECYCLE_DEGRADE_DAYS=45            # Días sin actividad para degradar
BRAINX_LIFECYCLE_LOW_IMPORTANCE_MAX=3       # Importancia máxima considerada "baja"
BRAINX_LIFECYCLE_LOW_ACCESS_MAX=1           # Máximo de accesos considerados "bajos"
```

**Ejecución:**
```bash
# Preview sin cambios
./brainx-v5 lifecycle-run --dryRun --json

# Aplicar transiciones
./brainx-v5 lifecycle-run --json
```

### Deployment de Phase 2

Phase 2 se despliega aplicando la migración SQL y configurando variables de entorno. El runbook completo está en [`docs/DEPLOY_PHASE2_PROD.md`](docs/DEPLOY_PHASE2_PROD.md) e incluye:

1. Backup obligatorio previo
2. Migración SQL idempotente (`sql/migrations/2026-02-24_phase2_governance.sql`)
3. Smoke checks de DB
4. Configuración de env vars
5. Validación funcional
6. Plan de rollback

---

## Migraciones SQL

BrainX V5 mantiene su schema en `sql/` con un sistema de migraciones incrementales.

### Schema Inicial: `sql/v3-schema.sql`

Contiene la definición completa de todas las tablas, constraints e índices del sistema:

- `brainx_memories` — Tabla principal con 24+ columnas
- `brainx_patterns` — Agregación de patrones
- `brainx_query_log` — Telemetría de queries
- `brainx_learning_details` — Postmortem estructurado
- `brainx_trajectories` — Trayectorias reutilizables
- `brainx_context_packs` — Packs de contexto
- `brainx_session_snapshots` — Snapshots de sesiones
- `brainx_pilot_log` — Telemetría de inyección
- Todos los índices (ivfflat, GIN, btree)

**Aplicar schema completo (primera instalación):**
```bash
psql "$DATABASE_URL" -f sql/v3-schema.sql
```

### Migración Phase 2: `sql/migrations/2026-02-24_phase2_governance.sql`

Agrega las columnas de lifecycle y las tablas de observabilidad a una instalación existente:

- Extiende `brainx_memories` con: `status`, `category`, `pattern_key`, `recurrence_count`, `first_seen`, `last_seen`, `resolved_at`, `promoted_to`, `resolution_notes`
- Crea `brainx_patterns` y `brainx_query_log`
- Agrega índices para lifecycle y telemetría
- **100% idempotente:** usa `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, y `CREATE INDEX IF NOT EXISTS`

**Aplicar migración:**
```bash
psql "$DATABASE_URL" -f sql/migrations/2026-02-24_phase2_governance.sql
```

### Cómo Aplicar Migraciones

```bash
# 1. SIEMPRE hacer backup primero
./scripts/backup-brainx.sh ~/backups

# 2. Aplicar migración
psql "$DATABASE_URL" -f sql/migrations/YYYY-MM-DD_nombre.sql

# 3. Verificar
psql "$DATABASE_URL" -c "\d+ brainx_memories"
psql "$DATABASE_URL" -c "\dt brainx_*"

# 4. Smoke test
./brainx-v5 health
```

### Rollback

Las migraciones son aditivas e idempotentes, por lo que no requieren rollback en el sentido tradicional. Si algo sale mal:

1. **Rollback de código:** Volver al commit previo (las columnas nuevas se ignoran)
2. **Rollback de datos:** Restaurar desde backup:
   ```bash
   ./scripts/restore-brainx.sh ~/backups/brainx-v5_backup_YYYYMMDD.tar.gz --force
   ```

> **Nota:** Evitar DROP de columnas en caliente. Preferir restore de snapshot completo.

---

## Variables de Entorno

```bash
# ── Requeridas ──
DATABASE_URL=postgresql://user:pass@host:5432/brainx_v5
OPENAI_API_KEY=sk-...

# ── Embeddings ──
OPENAI_EMBEDDING_MODEL=text-embedding-3-small       # default
OPENAI_EMBEDDING_DIMENSIONS=1536                     # default

# ── Inyección ──
BRAINX_INJECT_MAX_CHARS_PER_ITEM=2000
BRAINX_INJECT_MAX_LINES_PER_ITEM=80
BRAINX_INJECT_MAX_TOTAL_CHARS=12000
BRAINX_INJECT_MIN_SCORE=0.25

# ── PII Scrub ──
BRAINX_PII_SCRUB_ENABLED=true
BRAINX_PII_SCRUB_REPLACEMENT=[REDACTED]
BRAINX_PII_SCRUB_ALLOWLIST_CONTEXTS=internal-safe,trusted

# ── Deduplicación ──
BRAINX_DEDUPE_SIM_THRESHOLD=0.92
BRAINX_DEDUPE_RECENT_DAYS=30

# ── Memory Distiller ──
BRAINX_DISTILLER_MODEL=gpt-4.1-mini

# ── Cleanup ──
CLEANUP_MAX_LEN=12
CLEANUP_TIER=cold
CLEANUP_MAX_IMPORTANCE=2

# ── Dedup ──
DEDUP_DRY_RUN=false
```

---

## Integración con OpenClaw

BrainX V5 funciona como una **skill nativa de OpenClaw**:

```bash
# Instalar como skill
cp -r brainx-v5 ~/.openclaw/skills/brainx-v5

# Agregar al PATH en openclaw.json
# "env": { "PATH": "/home/clawd/.openclaw/skills/brainx-v5:$PATH" }

# Agregar DATABASE_URL a openclaw.json env
# "DATABASE_URL": "postgresql://brainx:pass@127.0.0.1:5432/brainx_v5"

# Ahora todos los agentes pueden usar: brainx search, brainx add, brainx inject, brainx fact
```

El archivo `SKILL.md` provee las definiciones de herramientas para OpenClaw (`brainx_add_memory`, `brainx_search`, `brainx_inject`, `brainx_health`).

---

## Estructura del Repositorio

```
brainx-v5/
├── brainx-v5                # CLI entry point (bash)
├── brainx                   # Wrapper para uso en PATH
├── SKILL.md                 # Definición de skill OpenClaw
├── RESILIENCE.md            # 🛡️ Guía de disaster recovery
├── README.md                # Este archivo
├── lib/
│   ├── cli.js               # Implementación de todos los comandos CLI
│   ├── openai-rag.js        # Core RAG: embeddings + búsqueda + store + dedup + telemetría
│   ├── brainx-phase2.js     # PII scrubbing (14 patrones) + dedup config + merge plan
│   └── db.js                # Pool de conexiones PostgreSQL
├── hook/
│   ├── HOOK.md              # Documentación del hook
│   └── handler.js           # Hook de auto-inyección (Node.js)
├── cron/
│   ├── health-check.sh      # Health check cada 30min
│   ├── ops-alerts.sh        # Alertas operacionales diarias
│   └── weekly-dashboard.sh  # Dashboard semanal completo
├── scripts/
│   ├── memory-distiller.js  # 🧬 Distiller LLM (gpt-4.1-mini)
│   ├── fact-extractor.js    # 📌 Extractor regex de facts
│   ├── session-harvester.js # 🔍 Harvester regex de sesiones
│   ├── memory-bridge.js     # 🌉 Puente markdown → vectorial
│   ├── cross-agent-learning.js    # 🤝 Propagación cross-agente
│   ├── contradiction-detector.js  # ⚡ Detector de contradicciones
│   ├── quality-scorer.js          # ⭐ Scoring de calidad
│   ├── context-pack-builder.js    # 📦 Builder de packs de contexto
│   ├── reclassify-memories.js     # 🏷️ Reclasificador a nuevas categorías
│   ├── cleanup-low-signal.js      # 🧹 Limpieza de baja señal
│   ├── dedup-supersede.js         # 🔗 Deduplicación exacta
│   ├── eval-memory-quality.js     # 📊 Evaluación de calidad de retrieval
│   ├── generate-eval-dataset-from-memories.js  # 📋 Generador de dataset de eval
│   ├── import-workspace-memory-md.js           # 📥 Importador de MEMORY.md
│   ├── migrate-v2-to-v3.js       # 🔄 Migración V2 → V3
│   ├── backup-brainx.sh          # 🛡️ Script de backup
│   └── restore-brainx.sh         # 🛡️ Script de restore
├── data/
│   ├── distilled-sessions.json    # Tracking de sesiones destiladas
│   └── context-packs.json         # Cache de context packs
├── sql/
│   ├── v3-schema.sql              # Schema completo de base de datos
│   └── migrations/
│       └── 2026-02-24_phase2_governance.sql  # Migración Phase 2 (lifecycle + observabilidad)
├── docs/
│   ├── INDEX.md                   # Índice de documentación
│   ├── ARCHITECTURE.md            # Diseño interno y flujo de datos
│   ├── CLI.md                     # Referencia completa de comandos
│   ├── CONFIG.md                  # Variables de entorno detalladas
│   ├── SCHEMA.md                  # Schema de DB explicado
│   ├── SCRIPTS.md                 # Scripts de mantenimiento
│   ├── DEPLOY_PHASE2_PROD.md      # Runbook de deployment Phase 2
│   └── TESTS.md                   # Suite de tests
└── tests/
    ├── smoke.js                   # Health check básico
    ├── rag.js                     # Test end-to-end del motor RAG
    ├── cli-v4.js                  # Tests unitarios del CLI + Phase 2
    └── fixtures/
        ├── memory-eval-sample.jsonl  # Dataset de eval (ejemplo)
        └── memory-eval-real.jsonl    # Dataset de eval (producción)
```

---

## Disaster Recovery y Resiliencia 🛡️

BrainX V5 incluye un sistema completo de backup, restore y disaster recovery. La base de datos PostgreSQL es el componente más crítico — todo lo demás se puede reconstruir, pero las memorias son irremplazables.

### Crear Backup

```bash
# Backup completo (database + configs + hooks)
./scripts/backup-brainx.sh ~/backups

# Output: ~/backups/brainx-v5_backup_YYYYMMDD_HHMMSS.tar.gz
```

El backup incluye:
- **Database dump** completo (`pg_dump`) — todas las memorias, patrones, trayectorias
- **Variables de entorno** (`~/.openclaw/.env`)
- **Configuración OpenClaw** (`openclaw.json` con hooks)
- **Hook de auto-inject** (`~/.openclaw/hooks/internal/brainx-auto-inject`)
- **Archivos brainx.md** de cada workspace
- **Wrappers** de cada workspace
- **Metadata JSON** con info del backup

### Restaurar desde Backup

```bash
# En VPS nuevo o después de desastre
./scripts/restore-brainx.sh brainx-v5_backup_YYYYMMDD.tar.gz --force
```

### 3 Escenarios de Desastre

| Escenario | Riesgo | Esfuerzo de Recuperación | Acción |
|-----------|--------|--------------------------|--------|
| **Update de OpenClaw** | 🟢 Bajo | 0 min (automático) | Ninguna — datos en PostgreSQL independientes |
| **Reinstalación del Gateway** (`rm -rf ~/.openclaw`) | 🟡 Medio | 5-10 min | Restore desde backup + reconfigurar env |
| **Migración a nuevo VPS** | 🔴 Alto | 15-30 min con backup | Instalar PostgreSQL + pgvector, restore, configurar env |

### ¿Qué se protege?

| Componente | Incluido | Criticidad |
|------------|----------|------------|
| Base de datos PostgreSQL (todas las memorias) | ✅ | 🔴 CRÍTICO |
| Variables de entorno (.env) | ✅ | 🔴 CRÍTICO |
| Configuración OpenClaw (hooks) | ✅ | 🟡 Medio |
| Auto-inject hooks | ✅ | 🟡 Medio |
| Archivos de skill | ✅ | 🟢 Reinstalable |
| Workspace brainx.md | ✅ | 🟢 Recreatable |

### Backups Automáticos (recomendado)

Agregar a `crontab -e`:

```bash
# Backup diario a las 3 AM
0 3 * * * /home/clawd/.openclaw/skills/brainx-v5/scripts/backup-brainx.sh ~/backups >> ~/backups/backup.log 2>&1

# Limpiar backups viejos (mantener 7 días)
0 4 * * * find ~/backups -name "brainx-v5_backup_*.tar.gz" -mtime +7 -delete
```

### Checklist de Resiliencia

**Pre-desastre (hacer ahora):**
- [ ] Crear backup inicial: `./scripts/backup-brainx.sh ~/backups`
- [ ] Verificar backup: `tar -tzf backup.tar.gz | head`
- [ ] Configurar backup automático (cron)
- [ ] Documentar contraseña de PostgreSQL en lugar seguro
- [ ] Sincronizar backups a cloud (opcional): `rclone sync ~/backups gdrive:backups/brainx-v5`

**Post-desastre:**
- [ ] PostgreSQL corriendo: `sudo systemctl status postgresql`
- [ ] Base de datos existe: `psql $DATABASE_URL -c "\l"`
- [ ] pgvector habilitado: `psql $DATABASE_URL -c "SELECT extversion FROM pg_extension WHERE extname='vector';"`
- [ ] Skill funciona: `./brainx-v5 health`
- [ ] Hook ejecutable: `ls -la ~/.openclaw/hooks/internal/brainx-auto-inject`
- [ ] Configuración ok: `cat ~/.openclaw/openclaw.json | grep -A5 hooks`
- [ ] Contexto generado: `cat ~/.openclaw/workspace-*/BRAINX_CONTEXT.md`

📖 **Guía completa:** Ver [RESILIENCE.md](RESILIENCE.md) para instrucciones detalladas paso a paso de cada escenario, troubleshooting, y comandos de verificación.

---

## Evaluación de Calidad

### Harness offline

Usa un dataset JSON/JSONL de pares `query` + `expected_key` para trackear calidad de retrieval:

```bash
# Ejecutar evaluación
node scripts/eval-memory-quality.js --json

# Generar dataset real desde memorias actuales
node scripts/generate-eval-dataset-from-memories.js
node scripts/eval-memory-quality.js --dataset tests/fixtures/memory-eval-real.jsonl --k 5 --json
```

Métricas reportadas:
- `hit_at_k_proxy` — Tasa de acierto en top-k resultados
- `avg_top_similarity` — Similitud promedio del mejor resultado
- `duplicates_reduced` — Duplicados colapsados por `pattern_key`

---

## Cuándo Usar

✅ **USAR cuando:**
- El usuario referencia decisiones pasadas
- Retomando tareas de larga duración
- "¿Qué decidimos sobre X?"
- Necesitás contexto de trabajo anterior
- Compartiendo conocimiento entre agentes
- Registrando URLs, servicios, configs de infraestructura

❌ **NO USAR cuando:**
- Preguntas simples aisladas
- Queries de conocimiento general
- Code review sin necesidad de contexto
- En cada mensaje "por las dudas"

---

## Troubleshooting

### BrainX health falla

```bash
# Verificar conexión a PostgreSQL
psql "$DATABASE_URL" -c "SELECT 1;"

# Verificar pgvector
psql "$DATABASE_URL" -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';"

# Verificar tablas
psql "$DATABASE_URL" -c "SELECT tablename FROM pg_tables WHERE tablename LIKE 'brainx%';"
```

### Embeddings no se generan

```bash
# Verificar API key
echo $OPENAI_API_KEY | head -c 10

# Test manual
curl https://api.openai.com/v1/embeddings \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": "test", "model": "text-embedding-3-small"}'
```

### Memory Distiller no procesa sesiones

```bash
# Verificar sesiones disponibles
ls -la ~/.openclaw/agents/*/sessions/*.jsonl | head -10

# Ver log de sesiones destiladas
cat data/distilled-sessions.json | python3 -m json.tool | head -20

# Ejecutar con verbose
node scripts/memory-distiller.js --dry-run --verbose --hours 24
```

### Hook de inject no genera BRAINX_CONTEXT.md

```bash
# Ejecutar manualmente
OPENCLAW_AGENT=raider WORKSPACE_DIR=/home/clawd/.openclaw/workspace-raider \
  bash hook/handler.js /home/clawd/.openclaw/workspace-raider

# Verificar output
cat /home/clawd/.openclaw/workspace-raider/BRAINX_CONTEXT.md
```

### Facts no aparecen en inject

```bash
# Verificar facts en DB directamente
psql "$DATABASE_URL" -c "SELECT id, content, tier, importance FROM brainx_memories WHERE type='fact' AND superseded_by IS NULL ORDER BY importance DESC LIMIT 10;"
```

### Scripts de mantenimiento no corren

```bash
# Verificar que .env se carga correctamente
cd /home/clawd/.openclaw/skills/brainx-v5
source .env && echo $DATABASE_URL | head -c 20

# Ejecutar con verbose para diagnosticar
node scripts/quality-scorer.js --dry-run --verbose
node scripts/contradiction-detector.js --dry-run --verbose
```

---

## Migración desde V2

```bash
node scripts/migrate-v2-to-v3.js
```

Lee archivos JSON de `storage/{hot,warm,cold}/` en el directorio de BrainX V2, mapea los tiers, genera nuevos embeddings, y almacena en PostgreSQL via `storeMemory()`.

---

## Documentación Detallada (docs/)

El directorio `docs/` contiene la documentación técnica de referencia organizada por tema. Cada documento cubre un aspecto específico del sistema en profundidad.

| Documento | Descripción |
|-----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Diseño interno del sistema: componentes (CLI, RAG engine, DB layer), flujo de ejecución de `add`/`search`/`inject`, sistema de ranking (similitud + importancia + tier boost), filtros disponibles, y tradeoffs de diseño |
| [CLI.md](docs/CLI.md) | Referencia completa de todos los comandos CLI: `add`, `search`, `inject`, `resolve`, `promote-candidates`, `lifecycle-run`, `metrics`, y eval harness. Incluye todos los flags, defaults y variables de entorno por comando |
| [CONFIG.md](docs/CONFIG.md) | Variables de entorno detalladas: requeridas (`DATABASE_URL`, `OPENAI_API_KEY`), embeddings, shared env file (`BRAINX_ENV`), y configuración de inject formatting |
| [SCHEMA.md](docs/SCHEMA.md) | Schema de base de datos explicado tabla por tabla: propósito, columnas con tipos y descripciones, índices, y consideraciones operacionales (pgvector tuning, dimension changes, backups) |
| [SCRIPTS.md](docs/SCRIPTS.md) | Documentación de scripts de mantenimiento: `migrate-v2-to-v3.js` (migración), `import-workspace-memory-md.js` (importación de markdown), `dedup-supersede.js` (deduplicación exacta), `cleanup-low-signal.js` (limpieza de baja señal). Incluye env vars y ejemplos de ejecución |
| [DEPLOY_PHASE2_PROD.md](docs/DEPLOY_PHASE2_PROD.md) | Runbook de deployment de Phase 2 a producción: pre-checks, backup obligatorio, migración SQL, smoke checks, configuración de env, validación funcional, plan de rollback, y criterio de éxito |
| [TESTS.md](docs/TESTS.md) | Suite de tests disponible: smoke test (health check), RAG test (end-to-end embed → store → search), y cómo ejecutarlos |
| [INDEX.md](docs/INDEX.md) | Índice de navegación de toda la documentación, incluyendo tabla de scripts V5 "Cerebro Vivo" |

---

## Tests

BrainX V5 incluye una suite de tests para verificar el correcto funcionamiento del sistema.

### `tests/smoke.js` — Health Check

Verifica los requisitos básicos del sistema:
- Conectividad a PostgreSQL
- Extensión pgvector instalada
- Schema instalado (cuenta tablas `brainx_*`, mínimo 3)

```bash
node tests/smoke.js
# También disponible via:
./brainx-v5 health
```

**Salida esperada:**
```
BrainX V5 health: OK
- pgvector: yes
- brainx tables: 8
```

### `tests/rag.js` — Test End-to-End del Motor RAG

Test de integración que ejecuta el flujo completo:
1. Almacena una memoria de prueba (`note` sobre conexión PostgreSQL)
2. Busca con una query relacionada ("how do we connect to postgres?")
3. Imprime los top 3 resultados con id, similitud y contenido

```bash
node tests/rag.js
```

> **Requiere:** `OPENAI_API_KEY` y `DATABASE_URL` configurados con acceso real.

### `tests/cli-v4.js` — Tests Unitarios del CLI

Tests unitarios que verifican los comandos CLI sin necesidad de base de datos ni API real (usan mocks):

- `testCmdAddMetadata` — Verifica que `add` pasa correctamente todos los campos de lifecycle (`pattern_key`, `status`, `category`, `recurrence_count`, `tags`)
- `testCmdSearchContractAndLogging` — Verifica que `search` retorna la estructura correcta y genera eventos de log con `query_kind`, `resultsCount`, `avgSimilarity`
- Tests de `inject`, `resolve`, `promote-candidates`, `lifecycle-run`, y `metrics`
- Tests de Phase 2: PII scrubbing, dedup semántico, merge plan

```bash
node tests/cli-v4.js
```

### `tests/fixtures/` — Datasets de Evaluación

Archivos JSONL con pares `query` + `expected_key` para evaluar la calidad de retrieval:

| Archivo | Descripción |
|---------|-------------|
| `memory-eval-sample.jsonl` | Dataset de ejemplo con 4 pares query/key para testing rápido |
| `memory-eval-real.jsonl` | Dataset generado desde memorias reales para evaluación de producción |

**Ejemplo de entrada:**
```json
{"query": "retry loop keeps hammering downstream API after 429", "expected_key": "retry.loop", "context": "proj-payments"}
```

**Uso con eval harness:**
```bash
# Con dataset de ejemplo
node scripts/eval-memory-quality.js --dataset tests/fixtures/memory-eval-sample.jsonl --k 5 --json

# Generar dataset real desde memorias actuales
node scripts/generate-eval-dataset-from-memories.js

# Evaluar con dataset real
node scripts/eval-memory-quality.js --dataset tests/fixtures/memory-eval-real.jsonl --k 5 --json
```

### Ejecutar Todos los Tests

```bash
# Smoke test rápido (solo DB)
node tests/smoke.js

# Test RAG completo (requiere OpenAI API)
node tests/rag.js

# Tests unitarios del CLI
node tests/cli-v4.js

# Via npm
npm test
```

---

## Licencia

MIT
