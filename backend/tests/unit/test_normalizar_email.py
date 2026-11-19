import pytest

from app.core.email_normalizado import normalizar_email


@pytest.mark.parametrize(
    "entrada,esperado",
    [
        pytest.param(" Ana@Example.COM ", "ana@example.com", id="espacios-y-mayusculas"),
        pytest.param("ana@example.com", "ana@example.com", id="ya-normalizado"),
        pytest.param("\tANA@X.com\n", "ana@x.com", id="tabulacion-y-salto"),
        pytest.param("Ana.Gomez+Pedidos@Example.com", "ana.gomez+pedidos@example.com", id="parte-local-con-signos"),
    ],
)
def test_normalizar_email_recorta_y_pasa_a_minusculas(entrada: str, esperado: str) -> None:
    assert normalizar_email(entrada) == esperado
