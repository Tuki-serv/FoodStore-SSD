import logging
from typing import Any
from fastapi import WebSocket

logger = logging.getLogger("app.core.websocket")


class ConnectionManager:
    """Gestor de conexiones WebSocket basado en rooms."""

    def __init__(self) -> None:
        self.rooms: dict[str, set[WebSocket]] = {}
        self.socket_rooms: dict[WebSocket, set[str]] = {}

    def _join_room(self, websocket: WebSocket, room: str) -> None:
        if room not in self.rooms:
            self.rooms[room] = set()

        self.rooms[room].add(websocket)

        if websocket not in self.socket_rooms:
            self.socket_rooms[websocket] = set()

        self.socket_rooms[websocket].add(room)

    def _leave_room(self, websocket: WebSocket, room: str) -> None:
        if room in self.rooms:
            self.rooms[room].discard(websocket)
            if not self.rooms[room]:
                del self.rooms[room]

        if websocket in self.socket_rooms:
            self.socket_rooms[websocket].discard(room)
            if not self.socket_rooms[websocket]:
                del self.socket_rooms[websocket]

    async def connect(self, websocket: WebSocket, role: str, user_id: int) -> None:
        """Acepta el handshake y suscribe la conexion a su room de rol."""
        await websocket.accept()

        role_key = f"role:{role.upper()}"
        self._join_room(websocket, role_key)

        logger.info(
            f"Conexion Websocket aceptada. user_id={user_id}, role={role}, "
            f"room={role_key}. Total de rooms activas: {len(self.rooms)}")

    def disconnect(self, websocket: WebSocket) -> None:
        """Elimina la conexion de todas las rooms suscritas."""
        rooms = list(self.socket_rooms.get(websocket, set()))
        for room in rooms:
            self._leave_room(websocket, room)

        logger.info(
            f"Conexion Websocket finalizada. Rooms liberadas: {rooms}. "
            f"Total rooms activas: {len(self.rooms)}"
        )

    def join_role_room(self, websocket: WebSocket, role_code: str) -> None:
        """Suscribe la conexion a una room de rol adicional."""
        room = f"role:{role_code.upper()}"
        self._join_room(websocket, room)
        logger.info(f"Socket suscrito a room {room}")

    async def send_to_room(self, room: str, event_type: str, data: dict[str, Any]) -> None:
        """
        Envia un evento JSON a todos los miembros de una room.
        Si una conexion falla, la remueve del manager y continua con las demas.
        """
        connections = self.rooms.get(room)
        if not connections:
            logger.info(f"Evento {event_type}: sin destinatarios en {room}")
            return

        payload = {"event": event_type, "data": data}
        members = list(connections)
        logger.info(
            f"Transmitiendo evento {event_type} a {len(members)} conexiones en {room}")

        for connection in members:
            try:
                await connection.send_json(payload)
            except Exception as e:
                logger.warning(
                    f"Error al enviar WebSocket en {room}. Removiendo conexion: {e}")
                self.disconnect(connection)


# Instancia global (singleton) del gestor de conexiones
manager = ConnectionManager()


def get_connection_manager() -> ConnectionManager:
    """Obtiene el gestor de conexiones WebSocket"""
    return manager
