"""Servicio Cloudinary con configuración perezosa y opcional. El SDK siempre está mockeado: nunca hay red."""
import importlib
import io
import logging
from types import SimpleNamespace
from unittest.mock import MagicMock

import cloudinary
import pytest
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from app.core.cloudinary import service as cloudinary_service
from app.core.config import settings


def _png_upload() -> UploadFile:
    return UploadFile(file=io.BytesIO(b"\x89PNG-bytes"), filename="a.png", headers=Headers({"content-type": "image/png"}))


def _pdf_upload() -> UploadFile:
    return UploadFile(file=io.BytesIO(b"%PDF"), filename="a.pdf", headers=Headers({"content-type": "application/pdf"}))


@pytest.fixture
def sdk(monkeypatch: pytest.MonkeyPatch) -> SimpleNamespace:
    """Reemplaza `cloudinary.config` y `cloudinary.uploader` por mocks y reinicia el flag de configuración."""
    config = MagicMock(name="cloudinary.config")
    uploader = MagicMock(name="cloudinary.uploader")
    uploader.upload.return_value = {"secure_url": "https://res.example/x.png", "public_id": "foodstore/categorias/x"}
    uploader.destroy.return_value = {"result": "ok"}
    monkeypatch.setattr(cloudinary, "config", config)
    monkeypatch.setattr(cloudinary, "uploader", uploader)
    monkeypatch.setattr(cloudinary_service, "_configurado", False, raising=False)
    return SimpleNamespace(config=config, uploader=uploader)


@pytest.fixture
def sin_credenciales(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("CLOUDINARY_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"):
        monkeypatch.setattr(settings, name, None)


@pytest.fixture
def con_credenciales(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "CLOUDINARY_NAME", "nube-falsa")
    monkeypatch.setattr(settings, "CLOUDINARY_API_KEY", "key-falsa")
    monkeypatch.setattr(settings, "CLOUDINARY_API_SECRET", "secret-falso")


def test_importar_el_servicio_sin_credenciales_no_configura_el_sdk_ni_lanza(
    sdk: SimpleNamespace, sin_credenciales: None
) -> None:
    importlib.reload(cloudinary_service)

    sdk.config.assert_not_called()


def test_subir_imagen_sin_credenciales_responde_503_sin_llamar_al_sdk(sdk: SimpleNamespace, sin_credenciales: None) -> None:
    with pytest.raises(HTTPException) as exc_info:
        cloudinary_service.subir_imagen(_png_upload(), tipo="categoria")

    assert exc_info.value.status_code == 503
    assert "no está configurado" in exc_info.value.detail
    sdk.uploader.upload.assert_not_called()


def test_subir_imagen_sin_credenciales_y_archivo_invalido_sigue_siendo_400(
    sdk: SimpleNamespace, sin_credenciales: None
) -> None:
    with pytest.raises(HTTPException) as exc_info:
        cloudinary_service.subir_imagen(_pdf_upload(), tipo="categoria")

    assert exc_info.value.status_code == 400


def test_eliminar_imagen_sin_credenciales_devuelve_false_con_advertencia_y_sin_llamar_al_sdk(
    sdk: SimpleNamespace, sin_credenciales: None, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.WARNING):
        resultado = cloudinary_service.eliminar_imagen("x")

    assert resultado is False
    assert [r.levelno for r in caplog.records] == [logging.WARNING]
    sdk.uploader.destroy.assert_not_called()


@pytest.mark.parametrize("vacio", [None, ""])
def test_eliminar_imagen_sin_public_id_devuelve_true_aun_sin_credenciales(
    sdk: SimpleNamespace, sin_credenciales: None, vacio: str | None
) -> None:
    assert cloudinary_service.eliminar_imagen(vacio) is True
    sdk.uploader.destroy.assert_not_called()


def test_subir_imagen_con_credenciales_configura_el_sdk_una_sola_vez_y_devuelve_url_y_public_id(
    sdk: SimpleNamespace, con_credenciales: None
) -> None:
    primero = cloudinary_service.subir_imagen(_png_upload(), tipo="categoria")
    cloudinary_service.subir_imagen(_png_upload(), tipo="categoria")

    sdk.config.assert_called_once_with(
        cloud_name="nube-falsa", api_key="key-falsa", api_secret="secret-falso", secure=True
    )
    assert sdk.uploader.upload.call_count == 2
    assert primero.imagen_url == "https://res.example/x.png"
    assert primero.imagen_public_id == "foodstore/categorias/x"


def test_eliminar_imagen_con_credenciales_llama_a_destroy(sdk: SimpleNamespace, con_credenciales: None) -> None:
    assert cloudinary_service.eliminar_imagen("foodstore/productos/abc") is True
    sdk.uploader.destroy.assert_called_once()
    assert sdk.uploader.destroy.call_args.args == ("foodstore/productos/abc",)


def test_eliminar_multiples_imagenes_sin_credenciales_no_lanza_y_cuenta_los_intentos(
    sdk: SimpleNamespace, sin_credenciales: None
) -> None:
    assert cloudinary_service.eliminar_multiples_imagenes(["a", None, "b"]) == 2
    sdk.uploader.destroy.assert_not_called()
