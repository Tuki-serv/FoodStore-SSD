# Food Store — Base de Conocimiento

Base de conocimiento generada (modo ingest, sin preguntas al usuario) a partir de los documentos del proyecto en `docs/`:

- `Descripcion.docx` — descripción integral narrativa del sistema (`[DESC]`).
- `integrador.docx` — Especificación Técnica v5.0, SDD / Feature-First, con rúbrica (`[INT]`).

Las contradicciones entre fuentes están centralizadas en [10_preguntas_abiertas.md](10_preguntas_abiertas.md).

## Regla de la KB

**La spec (integrador v5.0) es el objetivo; el código actual es el estado actual con deuda.** Ante contradicción entre documentos, `integrador.docx` v5.0 prevalece sobre `Descripcion.docx` (DD-16). El comportamiento del código actual se conserva pero se etiqueta como deuda técnica / divergencia (DD-17). Lo que la spec no define (rol `COCINA`, WebSocket/KDS) figura como *extra del código, no especificado* y queda abierto (PA-07, PA-19). Tabla consolidada de deuda: [09 — Deuda técnica DT-01..DT-26](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada).

## Índice de Archivos

| Archivo | Contenido |
|---------|-----------|
| [01_vision_y_objetivos.md](01_vision_y_objetivos.md) | Propósito, objetivos por actor, alcance v5.0, fuera de alcance, métricas |
| [02_descripcion_general.md](02_descripcion_general.md) | Stack, arquitectura, integraciones, resumen de API REST |
| [03_actores_y_roles.md](03_actores_y_roles.md) | Actores, matriz RBAC, rutas públicas |
| [04_modelo_de_datos.md](04_modelo_de_datos.md) | 3 dominios, ERD, entidades, seed data |
| [05_reglas_de_negocio.md](05_reglas_de_negocio.md) | Reglas RN-AU/US/DI/CA/PR/PE/ST/PA/GL, FSM del pedido |
| [06_funcionalidades.md](06_funcionalidades.md) | 31 historias de usuario en 8 épicas |
| [07_flujos_principales.md](07_flujos_principales.md) | Auth, catálogo, compra, webhook, ciclo operativo, cancelación, dashboard |
| [08_arquitectura_propuesta.md](08_arquitectura_propuesta.md) | Patrones, estructura de directorios, Zustand, seguridad, variables de entorno |
| [09_decisiones_y_supuestos.md](09_decisiones_y_supuestos.md) | 17 decisiones (DD-16 spec normativa, DD-17 spec = objetivo), 7 supuestos y la **tabla consolidada de deuda técnica DT-01..DT-26** |
| [10_preguntas_abiertas.md](10_preguntas_abiertas.md) | 27 inconsistencias, 19 preguntas (PA-02 resuelta), incertidumbres de discovery |
| [11_pagos_mercadopago.md](11_pagos_mercadopago.md) | Extra: integración MercadoPago, spec vs implementación, riesgos |
| [12_tiempo_real_websocket.md](12_tiempo_real_websocket.md) | Extra: WebSocket KDS y seguimiento de pedido |
| [13_rubrica_y_entrega.md](13_rubrica_y_entrega.md) | Extra: rúbrica de 200 pts, checklist de entrega, estado frente a la rúbrica |

## Quick Start para Desarrolladores

1. Entender el dominio → [01](01_vision_y_objetivos.md), [03](03_actores_y_roles.md)
2. Entender los datos → [04](04_modelo_de_datos.md)
3. Entender las reglas → [05](05_reglas_de_negocio.md)
4. Entender la arquitectura → [02](02_descripcion_general.md), [08](08_arquitectura_propuesta.md)
5. Implementar → [07](07_flujos_principales.md), [06](06_funcionalidades.md), [11](11_pagos_mercadopago.md)
6. Antes de codificar → [10](10_preguntas_abiertas.md) (resolver PA-01, PA-03, PA-04, PA-06, PA-07; PA-02 ya resuelta) y revisar la deuda en [09](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada)

## Resumen Ejecutivo

Food Store es una tienda de comida online (React + TypeScript + FastAPI + PostgreSQL) con catálogo jerárquico, carrito persistente, pedidos gobernados por una máquina de estados con historial append-only, pago con MercadoPago (webhook IPN idempotente) y un panel de administración con métricas, protegido por JWT y RBAC de cuatro roles. Se desarrolla como TPI con SDD, evaluado sobre 200 puntos. El código actual es solo el backend: implementa la mayor parte de la spec pero diverge en puntos relevantes que se tratan como **deuda técnica** respecto del objetivo v5.0 (auth por cookie, Checkout Pro, stock descontado al crear el pedido, sin estado `EN_CAMINO`, endpoints de pago sin auth, webhook sin firma), más extras no especificados (rol `COCINA`, WebSocket). Conviene resolver las preguntas abiertas de prioridad alta restantes (PA-01, PA-03, PA-04, PA-06, PA-07) antes de planificar los changes.
