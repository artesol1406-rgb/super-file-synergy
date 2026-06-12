# Plan: El Guardián del Espejo · motor Amalgam

Combino lo mejor de los dos archivos:
- **Base funcional** = el repo `psychic-garden-grower` ("The Mirror-Keeper"): RPG narrativo de IA con creación de personaje, compañeros, visualizador de escena por imagen IA y guardado/carga en PDF (vía Lovable AI Gateway, sin base de datos).
- **Profundidad narrativa y estructura** = el PDF **Amalgam Engine V11**: gramática de coherencia con 7 chakras, tensión (τ), energía de curvatura, suerte (L), arcanos y la **Ley de Espejo Total** — que encaja con el isomorfismo del juego.

## Decisiones confirmadas
- **Idioma:** bilingüe. Interfaz en español; la IA narra/responde en el idioma del jugador.
- **Amalgam:** se usa el PDF para enriquecer la narrativa y la estructura, con **mecánicas reales nuevas** (estado de chakras, coherencia, tensión, suerte, eventos correctivos).
- **Continuidad:** **no** se puede continuar la partida de otra persona. Se elimina el "continuar sesión" desde memoria local del navegador. La única forma de reanudar es **subir tu propio PDF de memoria**.

## Qué se construye

### 1. Portado de la base (desde el repo)
- Traer estilos del tema a la vela/ámbar oscuro (`src/styles.css`), el dado `d20` (puntero de asset) y los helpers:
  - `src/lib/ai-gateway.server.ts` (proveedor del Gateway)
  - `src/lib/streamImage.ts` (streaming de imagen de escena)
  - `src/lib/saveGame.ts` (export/import de PDF de memoria) — **quitando el autosave a `localStorage` y el "continuar"**.
- Rutas de servidor IA:
  - `src/routes/api/chat.ts` — Game Master en streaming.
  - `src/routes/api/companion.ts` — compañeros con voz propia.
  - `src/routes/api/scene-image.ts` — imagen simbólica de la escena.
- Pantalla principal `src/routes/index.tsx`: creación de personaje + juego (chat, modos exploración/combate/diálogo, visualizador, panel de party).
- Instalar dependencias: `ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`, `react-markdown`, `eventsource-parser`, `pdf-lib`.

### 2. Interfaz bilingüe (español)
- Traducir toda la UI a español (creación de personaje, modos, botones, party, mensajes de estado, textos del visualizador).
- Razas/clases/semillas con sus "susurros" en español.
- Instrucción al GM y a los compañeros: **responder siempre en el idioma del último mensaje del jugador** (por defecto español), manteniendo el contrato terapéutico/sin filtros original.

### 3. Motor Amalgam (mecánicas nuevas)
Nuevo módulo `src/lib/amalgam.ts` con un estado del observador (Ψ) que vive en el cliente y evoluciona por turno:
- **7 chakras** Cᵢ con `activación / bloqueo / coherencia`.
- **Coherencia global**, **tensión τ**, **energía de curvatura E_curv** (acumulada), **rigidez κ** (se ablanda con la calma, se endurece con la repetición) y **suerte L = f(coherencia, balance de chakras)**.
- Actualización por turno mediante heurística ligera de la acción del jugador (palabras de fuerza/control/entrega/empatía/introspección/negación) + ligera aleatoriedad, siguiendo las reglas del PDF (acción impulsiva ↑C₃ ↓C₆, empática ↑C₄, negación ↑bloqueo, etc.).
- **Eventos correctivos**: cuando τ se mantiene alta varios ciclos, el motor inyecta presión/repetición; cuando E_curv queda muy baja, inyecta "ruido fértil" (sorpresa). Estas señales se pasan al GM como instrucciones invisibles.

Integración con la narrativa (Ley de Espejo Total):
- En cada turno, el cliente envía el estado Amalgam resumido al `api/chat`, que lo inyecta en el system prompt como **brújula invisible**: el GM colapsa la escena hacia resonancia/tensión/suerte según Ψ, **sin nombrar nunca la mecánica** (ni chakras ni fórmulas en la ficción).

Capa visible (panel secundario, plegable) "Espejo Interior":
- Barras de los 7 chakras, medidor de coherencia, tensión y suerte, y una nota poética del estado. Plegado por defecto para no romper la inmersión; el motor funciona aunque esté cerrado.

### 4. Guardado / memoria (regla de continuidad)
- Quitar el botón "Continuar sesión" y el autosave a memoria local.
- Mantener **Guardar** (descarga PDF de memoria) y **Cargar PDF** para reanudar.
- El PDF de memoria ahora incluye también el **estado Amalgam** (Ψ) para que al reanudar la coherencia/tensión/suerte vuelvan como estaban.

## Detalles técnicos
- Stack actual: TanStack Start + Tailwind v4 + shadcn (ya presentes). No requiere Lovable Cloud (sin DB).
- IA: Lovable AI Gateway con `google/gemini-3-flash-preview` (chat/compañeros) y `google/gemini-3.1-flash-image-preview` (imagen). Verificar que exista el secreto `LOVABLE_API_KEY`; si falta, aprovisionarlo.
- El estado Amalgam se computa en cliente y se serializa en el PDF; el servidor solo lo recibe para guiar el prompt (sin persistencia en backend).
- Se respeta la arquitectura de rutas de TanStack (rutas API bajo `src/routes/api/`, sin tocar `routeTree.gen.ts`).
- SEO/meta de la home en `index.tsx` actualizados al título del juego en español.

## Resultado
Un RPG narrativo de espejo, en español (con narración en el idioma del jugador), donde cada escena la guía un motor de coherencia Amalgam invisible con mecánicas reales (chakras, tensión, suerte, eventos correctivos), visualizador de escena por IA, compañeros vivos, y memoria portable solo vía tu propio PDF.
