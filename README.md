# Food Store

Tienda de comida online (React + TypeScript + FastAPI + PostgreSQL) con catálogo jerárquico, carrito persistente,
pedidos con máquina de estados, pago con MercadoPago y panel de administración. TPI desarrollado con SDD (OpenSpec).

Video: https://drive.google.com/file/d/1TN4jfbk-sBAEybgjCK4OUvrTVEcnvxwF/view?usp=sharing

## Estructura del repo

La raíz es solo de **gestión del proyecto**; el código vive en subdirectorios.

```
Food-Store-Prueba/
├── backend/          # API FastAPI (app/, tests/, pytest.ini, requirements.txt, Dockerfile) — ver backend/README.md
├── docker-compose.yml # orquesta todo el proyecto: db, pgadmin, backend (frontend llega en C-13a); su .env (raíz) solo trae variables de compose
├── frontend/         # React + TS (llega en C-13a; todavía no existe)
├── openspec/         # changes y specs (SDD)
├── knowledge-base/   # base de conocimiento del dominio
├── design-system/    # sistema de diseño
├── docs/             # documentos fuente
├── todoAMd/          # tareas manuales pendientes del usuario
├── CHANGES.md        # roadmap de changes
├── CLAUDE.md / AGENTS.md  # instrucciones para agentes
```

## Backend

Instalación, variables de entorno, ejecución y tests: [backend/README.md](backend/README.md)
(todos los comandos se corren desde `backend/`).
