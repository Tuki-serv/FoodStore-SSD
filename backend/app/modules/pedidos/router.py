from typing import Annotated

from fastapi import APIRouter, Depends, Response, status, Query, WebSocket, WebSocketDisconnect, BackgroundTasks
from app.core.websocket import ConnectionManager, get_connection_manager

from app.core.security import decode_access_token
from app.modules.auth.dependencies import get_current_active_user, get_current_roles, require_role
from app.modules.usuarios.schemas import UserPublic
from app.core.pagination import PageQuery
from app.core.schemas import PaginatedResponse
from app.modules.pedidos.dependencies import PedidoServiceDep
from app.modules.pedidos.filtros import FiltrosPedidos
from app.modules.pedidos.schemas import PedidoCambioEstado, PedidoCancelacion, PedidoCreate, PedidoDetalle, PedidoResumen
from app.modules.pedidos.schemas import HistorialEstadoPedidoRead
from app.core.api_responses import respuestas_error

router = APIRouter()

CurrentUser = Annotated[UserPublic, Depends(get_current_active_user)]
CurrentRoles = Annotated[frozenset[str], Depends(get_current_roles)]


# ══════════════════════════════════════════════════════
# CLIENT — operaciones sobre sus propios pedidos
# ══════════════════════════════════════════════════════

#TODO sacando websocket de router para no romper la separación de responsabilidades
@router.post("/", summary="Crear un pedido", responses=respuestas_error(400, 401, 403, 404), response_model=PedidoDetalle, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_role(["CLIENT"]))])
def crear_pedido(
    data: PedidoCreate,
    current_user: CurrentUser,
    service: PedidoServiceDep,
) -> PedidoDetalle:
    resultado = service.crear_pedido(data, current_user.id)
    return resultado


# ══════════════════════════════════════════════════════
# ADMIN / PEDIDOS — visibilidad y gestión total
# ══════════════════════════════════════════════════════

@router.get("/", summary="Listar pedidos (los propios o, para gestión, todos)", responses=respuestas_error(401, 403), response_model=PaginatedResponse[PedidoResumen], dependencies=[Depends(require_role(["CLIENT", "ADMIN", "PEDIDOS"]))])
def listar_pedidos(
    current_user: CurrentUser,
    roles: CurrentRoles,
    params: PageQuery,
    filtros: Annotated[FiltrosPedidos, Depends()],
    service: PedidoServiceDep,
) -> PaginatedResponse[PedidoResumen]:
    return service.listar_pedidos(current_user.id, roles, filtros, params)


@router.get("/{pedido_id}", summary="Obtener el detalle de un pedido", responses=respuestas_error(401, 403, 404), response_model=PedidoDetalle, dependencies=[Depends(require_role(["CLIENT", "ADMIN", "PEDIDOS"]))])
def obtener_pedido(
    pedido_id: int,
    current_user: CurrentUser,
    roles: CurrentRoles,
    service: PedidoServiceDep,
) -> PedidoDetalle:
    return service.obtener_detalle(pedido_id, current_user.id, roles)


@router.get("/{pedido_id}/historial", summary="Obtener el historial de estados de un pedido", responses=respuestas_error(401, 403, 404), response_model=list[HistorialEstadoPedidoRead], dependencies=[Depends(require_role(["CLIENT", "ADMIN", "PEDIDOS"]))])
def obtener_historial_pedido(
    pedido_id: int,
    current_user: CurrentUser,
    roles: CurrentRoles,
    service: PedidoServiceDep,
) -> list[HistorialEstadoPedidoRead]:
    return service.obtener_historial(pedido_id, current_user.id, roles)


@router.patch("/{pedido_id}/estado", summary="Cambiar el estado de un pedido", responses=respuestas_error(400, 401, 403, 404, 409), response_model=PedidoDetalle, dependencies=[Depends(require_role(["ADMIN", "PEDIDOS", "COCINA"]))])
async def cambiar_estado_pedido(
    pedido_id: int,
    data: PedidoCambioEstado,
    current_user: CurrentUser,
    roles: CurrentRoles,
    ws_manager: ConnectionManager = Depends(get_connection_manager),
    *, service: PedidoServiceDep,
) -> PedidoDetalle:
    resultado = await service.cambiar_estado_pedido(
        pedido_id, 
        data, 
        current_user.id, 
        roles,
        ws_manager
    )

    return resultado


@router.delete("/{pedido_id}", summary="Cancelar un pedido propio", responses=respuestas_error(401, 403, 404, 409), response_model=PedidoDetalle, dependencies=[Depends(require_role(["CLIENT"]))])
def cancelar_pedido(
    pedido_id: int,
    current_user: CurrentUser,
    roles: CurrentRoles,
    data: PedidoCancelacion | None = None,
    *, service: PedidoServiceDep,
) -> PedidoDetalle:
    """El cliente cancela su propio pedido. Body opcional `{motivo}`; la baja nunca borra el pedido."""
    return service.cancelar_pedido_propio(pedido_id, current_user.id, roles, data.motivo if data else None)



# ─── WebSocket para tiempo real ─────────────────────────────────────────────

@router.get("/cocina/pedidos", summary="Listar los pedidos del tablero de cocina", responses=respuestas_error(401, 403), response_model=PaginatedResponse[PedidoResumen], dependencies=[Depends(require_role(["COCINA", "ADMIN", "PEDIDOS"]))])
def obtener_pedidos_cocina(
    params: PageQuery,
    service: PedidoServiceDep,
) -> PaginatedResponse[PedidoResumen]:
    return service.listar_cocina(params)


@router.websocket("/cocina/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    # Inyectamos el service: él decide si el usuario puede ver el tablero de cocina
    service: PedidoServiceDep,
    # Inyectamos el manager para tener acceso a la lista global de túneles abiertos
    manager: ConnectionManager = Depends(get_connection_manager),
):
    # FASE 1: BÚSQUEDA DE LA CREDENCIAL
    # A diferencia de un endpoint HTTP normal, el frontend en JavaScript no puede
    # mandar un header "Authorization: Bearer..." fácilmente al abrir un WebSocket.
    # Por eso, buscamos el token directamente adentro de las cookies del navegador.
    token = websocket.cookies.get("access_token")

    if not token:
        # TRUCO DE WEBSOCKETS: Si el token no existe, no podemos simplemente hacer un 'return'.
        # El protocolo exige que primero aceptemos la conexión...
        await websocket.accept()
        # ...para poder cerrarla inmediatamente mandando un código de error específico (1008: Policy Violation).
        # Así el frontend sabe EXACTAMENTE por qué falló la conexión.
        await websocket.close(code=1008, reason="Token de autenticacion requerido")
        return

    # FASE 2: VALIDACIÓN MATEMÁTICA DEL TOKEN
    # Intentamos decodificar el JWT. Si la firma es falsa o el tiempo expiró, payload será None.
    payload = decode_access_token(token)
    if not payload:
        await websocket.accept()
        await websocket.close(code=1008, reason="Token inválido o expirado")
        return

    # Extraemos el "subject" del token, que en nuestra app es el ID numérico del usuario.
    user_id_str = payload.get("sub")
    if not user_id_str:
        await websocket.accept()
        await websocket.close(code=1008, reason="Token inválido")
        return
        
    try:
        user_id = int(user_id_str)
    except ValueError:
        await websocket.accept()
        await websocket.close(code=1008, reason="Token inválido (sub no es entero)")
        return

    # FASE 3: VALIDACIÓN DE NEGOCIO (EL "PATOVICA")
    # Ya sabemos que el token es criptográficamente válido, pero ¿el usuario sigue existiendo
    # en la base de datos? ¿Y tiene permiso para ver esta pantalla?
    # El service verifica dos cosas: que el usuario exista y que tenga un rol de gestión
    # (COCINA, ADMIN o PEDIDOS). Si es un cliente normal (rol "CLIENT"), lo rebotamos.
    rol = service.rol_para_cocina(user_id)
    if rol is None:
        await websocket.accept()
        await websocket.close(code=1008, reason="Permisos insuficientes")
        return

    # FASE 4: EL REGISTRO
    # ¡Pasó todos los controles de seguridad! Oficialmente le abrimos la puerta.
    # El manager suscribe este websocket a la room de su rol y a la room
    # funcional KDS para recibir los eventos en tiempo real.
    await manager.connect(websocket, rol, user_id)
    manager.join_role_room(websocket, "KDS")

    # FASE 5: LA VIGILIA (MANTENER EL TÚNEL VIVO)
    try:
        # En FastAPI, si la función termina, la conexión se corta.
        # Para evitarlo, clavamos un bucle infinito.
        while True:
            # receive_text() pausa la ejecución acá mismo. Python se queda esperando
            # en silencio sin consumir procesador. Si el frontend llegara a mandar un
            # mensaje de texto, lo atraparíamos acá.
            await websocket.receive_text()

    # Si el cocinero cierra la pestaña del navegador, apaga la PC, o se le corta el WiFi,
    # el 'receive_text()' de arriba explota y tira esta excepción específica:
    except WebSocketDisconnect:
        # Capturamos la explosión en silencio y le avisamos al manager que borre
        # a este websocket de su memoria porque ya no sirve más.
        manager.disconnect(websocket)

    # Por las dudas, si ocurre CUALQUIER otro error raro, también lo desconectamos
    # para no dejar conexiones fantasma ocupando memoria RAM en el servidor.
    except Exception:
        manager.disconnect(websocket)


@router.websocket("/{pedido_id}/ws")
async def websocket_pedido_endpoint(
    pedido_id: int,
    websocket: WebSocket,
    service: PedidoServiceDep,
    manager: ConnectionManager = Depends(get_connection_manager),
):
    token = websocket.cookies.get("access_token")

    if not token:
        await websocket.accept()
        await websocket.close(code=1008, reason="Token de autenticacion requerido")
        return

    payload = decode_access_token(token)
    if not payload:
        await websocket.accept()
        await websocket.close(code=1008, reason="Token inválido o expirado")
        return

    user_id_str = payload.get("sub")
    if not user_id_str:
        await websocket.accept()
        await websocket.close(code=1008, reason="Token inválido")
        return
        
    try:
        user_id = int(user_id_str)
    except ValueError:
        await websocket.accept()
        await websocket.close(code=1008, reason="Token inválido (sub no es entero)")
        return

    if not service.puede_suscribirse(pedido_id, user_id):
        await websocket.accept()
        await websocket.close(code=1008, reason="Pedido no encontrado o permisos insuficientes")
        return

    await manager.connect(websocket, "CLIENT", user_id)
    manager.join_role_room(websocket, f"pedido:{pedido_id}")

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
