from typing import Annotated

from fastapi import APIRouter, Depends, Response, status, Query, WebSocket, WebSocketDisconnect, BackgroundTasks
from app.core.websocket import ConnectionManager, get_connection_manager, manager
from sqlmodel import Session

from app.core.security import decode_access_token
from app.core.database import get_session
from app.core.deps import get_current_active_user, require_role
from app.modules.usuarios.schemas import UserPublic
from app.modules.usuarios.unit_of_work import UsuarioUnitOfWork, get_uow
from app.modules.pedidos.schemas import PedidoCambioEstado, PedidoCreate, PedidoReadFull, PedidoList, PedidoListAdmin
from app.modules.historiales_estado_pedido.schemas import HistorialEstadoPedidoRead
from app.modules.pedidos.service import PedidoService
from app.modules.pedidos.unit_of_work import PedidoUnitOfWork

router = APIRouter()

CurrentUser = Annotated[UserPublic, Depends(get_current_active_user)]


def get_pedido_service(session: Session = Depends(get_session)) -> PedidoService:
    return PedidoService(PedidoUnitOfWork(session))


# ══════════════════════════════════════════════════════
# CLIENT — operaciones sobre sus propios pedidos
# ══════════════════════════════════════════════════════

#TODO sacando websocket de router para no romper la separación de responsabilidades
@router.post("/", response_model=PedidoReadFull, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_role(["CLIENT"]))])
def crear_pedido(
    data: PedidoCreate,
    current_user: CurrentUser,
    service: PedidoService = Depends(get_pedido_service),
) -> PedidoReadFull:
    resultado = service.crear_pedido(data, current_user.id)
    return resultado


@router.get("/mis-pedidos", response_model=PedidoList, dependencies=[Depends(require_role(["CLIENT"]))])
def obtener_mis_pedidos(
    current_user: CurrentUser,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    service: PedidoService = Depends(get_pedido_service),
) -> PedidoList:
    return service.obtener_pedidos_por_usuario(current_user.id, offset, limit)


@router.get("/mis-pedidos/{pedido_id}", response_model=PedidoReadFull, dependencies=[Depends(require_role(["CLIENT"]))])
def obtener_mi_pedido(
    pedido_id: int,
    current_user: CurrentUser,
    service: PedidoService = Depends(get_pedido_service),
) -> PedidoReadFull:
    return service.obtener_pedido_propio(pedido_id, current_user.id)


@router.patch("/mis-pedidos/{pedido_id}/cancelar", response_model=PedidoReadFull, dependencies=[Depends(require_role(["CLIENT"]))])
def cancelar_mi_pedido(
    pedido_id: int,
    data: PedidoCambioEstado,
    current_user: CurrentUser,
    service: PedidoService = Depends(get_pedido_service),
) -> PedidoReadFull:
    return service.cancelar_pedido_propio(pedido_id, current_user.id, current_user.roles[0].codigo, data)


# ══════════════════════════════════════════════════════
# ADMIN / PEDIDOS — visibilidad y gestión total
# ══════════════════════════════════════════════════════

@router.get("/", response_model=PedidoListAdmin, dependencies=[Depends(require_role(["ADMIN", "PEDIDOS"]))])
def obtener_todos_los_pedidos(
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    service: PedidoService = Depends(get_pedido_service),
) -> PedidoListAdmin:
    return service.obtener_todos_los_pedidos(offset, limit)


@router.get("/{pedido_id}", response_model=PedidoReadFull, dependencies=[Depends(require_role(["ADMIN", "PEDIDOS"]))])
def obtener_pedido(
    pedido_id: int,
    service: PedidoService = Depends(get_pedido_service),
) -> PedidoReadFull:
    return service.obtener_pedido_por_id(pedido_id)


@router.get("/{pedido_id}/historial", response_model=list[HistorialEstadoPedidoRead], dependencies=[Depends(require_role(["ADMIN", "PEDIDOS"]))])
def obtener_historial_pedido(
    pedido_id: int,
    service: PedidoService = Depends(get_pedido_service),
) -> list[HistorialEstadoPedidoRead]:
    return service.obtener_historial_pedido(pedido_id)


@router.patch("/{pedido_id}/estado", response_model=PedidoReadFull, dependencies=[Depends(require_role(["ADMIN", "PEDIDOS", "COCINA"]))])
async def cambiar_estado_pedido(
    pedido_id: int,
    data: PedidoCambioEstado,
    current_user: CurrentUser,
    ws_manager: ConnectionManager = Depends(get_connection_manager),
    service: PedidoService = Depends(get_pedido_service),
) -> PedidoReadFull:
    resultado = await service.cambiar_estado_pedido(
        pedido_id, 
        data, 
        current_user.id, 
        current_user.roles[0].codigo,
        ws_manager
    )

    return resultado


@router.delete("/{pedido_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role(["ADMIN"]))])
def eliminar_pedido(
    pedido_id: int,
    service: PedidoService = Depends(get_pedido_service),
) -> Response:
    service.eliminar_pedido(pedido_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)



# ─── WebSocket para tiempo real ─────────────────────────────────────────────

@router.get("/cocina/pedidos", response_model=PedidoListAdmin, dependencies=[Depends(require_role(["COCINA", "ADMIN", "PEDIDOS"]))])
def obtener_pedidos_cocina(
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    service: PedidoService = Depends(get_pedido_service),
) -> PedidoListAdmin:
    return service.obtener_pedidos_cocina(offset, limit)


@router.websocket("/cocina/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    # Inyectamos el manager para tener acceso a la lista global de túneles abiertos
    manager: ConnectionManager = Depends(get_connection_manager),
    # Inyectamos el UnitOfWork para poder consultar la base de datos de usuarios
    uow: UsuarioUnitOfWork = Depends(get_uow),
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
    with uow:
        # Buscamos al usuario en la BD usando el ID que sacamos del token
        user = uow.usuarios.get_by_id(user_id)

        # Validamos dos cosas de un plumazo:
        # 1. Que el usuario exista ('not user')
        # 2. Que su rol (en mayúsculas por seguridad) sea uno de los permitidos.
        # Si es un cliente normal (rol "CLIENT"), lo rebotamos.
        if not user or not any(rol.codigo in ["COCINA", "ADMIN", "PEDIDOS"] for rol in user.roles):
            await websocket.accept()
            await websocket.close(code=1008, reason="Permisos insuficientes")
            return

    # FASE 4: EL REGISTRO
    # ¡Pasó todos los controles de seguridad! Oficialmente le abrimos la puerta.
    # El manager suscribe este websocket a la room de su rol y a la room
    # funcional KDS para recibir los eventos en tiempo real.
    await manager.connect(websocket, user.roles[0].codigo, user_id)
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
        await manager.disconnect(websocket)

    # Por las dudas, si ocurre CUALQUIER otro error raro, también lo desconectamos
    # para no dejar conexiones fantasma ocupando memoria RAM en el servidor.
    except Exception:
        await manager.disconnect(websocket)


@router.websocket("/{pedido_id}/ws")
async def websocket_pedido_endpoint(
    pedido_id: int,
    websocket: WebSocket,
    manager: ConnectionManager = Depends(get_connection_manager),
    session: Session = Depends(get_session)
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

    pedido_uow = PedidoUnitOfWork(session)
    with pedido_uow:
        pedido = pedido_uow.pedidos.get_by_id(pedido_id)
        if not pedido or pedido.usuario_id != user_id:
            await websocket.accept()
            await websocket.close(code=1008, reason="Pedido no encontrado o permisos insuficientes")
            return

    await manager.connect(websocket, "CLIENT", user_id)
    manager.join_role_room(websocket, f"pedido:{pedido_id}")

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)
