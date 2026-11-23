"""Documentación de entrega (C-25b, capability `project-delivery`): README, plantillas y evidencia verificables sin servidor.

Son comprobaciones estáticas: comparan lo que el README y `docs/entrega/` nombran con lo que existe en el repo.
"""
import json
import re
from pathlib import Path

import pytest
from dotenv import dotenv_values

from app.db.seed import ADMIN_EMAIL, ADMIN_PASSWORD_DESARROLLO, USUARIOS_DEMO

BACKEND_DIR = Path(__file__).resolve().parents[2]
ROOT = BACKEND_DIR.parent
README = ROOT / "README.md"
ENTREGA = ROOT / "docs" / "entrega"
COMPOSE = ROOT / "docker-compose.yml"
ENV_RAIZ = ROOT / ".env.example"
ENV_BACKEND = BACKEND_DIR / ".env.example"
MP_VARS = ("MP_ACCESS_TOKEN", "MP_PUBLIC_KEY", "MP_WEBHOOK_SECRET")
KEY_PATTERN = re.compile(r"^\s*#?\s*([A-Z][A-Z0-9_]*)=")
SECRETO_REAL = re.compile(r"(APP_USR|TEST)-[0-9A-Za-z-]{20,}|[0-9A-Za-z+/]{40,}")


def _texto(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _bloque_de(lines: list[str], clave: str) -> str:
    """Comentarios contiguos que rodean a `clave` (sin línea en blanco)."""
    index = next(i for i, line in enumerate(lines) if (m := KEY_PATTERN.match(line)) and m.group(1) == clave)
    start, end = index, index
    while start > 0 and lines[start - 1].strip():
        start -= 1
    while end + 1 < len(lines) and lines[end + 1].strip():
        end += 1
    return "\n".join(lines[start : end + 1]).lower()


def _filas_ce() -> dict[str, str]:
    return {
        m.group(1): linea
        for linea in _texto(ENTREGA / "checklist-rubrica.md").splitlines()
        if (m := re.match(r"\|\s*(CE-\d\d)\s*\|", linea))
    }


# ── Plantillas de entorno ────────────────────────────────────────────────────


def test_variables_de_compose_sin_default_estan_en_el_env_example_de_la_raiz() -> None:
    usadas = set(re.findall(r"\$\{([A-Z][A-Z0-9_]*)\}", _texto(COMPOSE)))  # `${X:-default}` no es obligatoria
    declaradas = set(dotenv_values(ENV_RAIZ))

    assert usadas, "el compose debería usar variables"
    assert usadas <= declaradas


@pytest.mark.parametrize("clave", ["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "PGADMIN_EMAIL", "PGADMIN_PASSWORD"])
def test_cada_variable_de_compose_esta_declarada_por_nombre(clave: str) -> None:
    assert clave in _texto(COMPOSE)
    assert clave in dotenv_values(ENV_RAIZ)


@pytest.mark.parametrize("clave", MP_VARS)
def test_variables_de_mercadopago_explican_donde_se_obtienen(clave: str) -> None:
    bloque = _bloque_de(_texto(ENV_BACKEND).splitlines(), clave)

    assert "mercado" in bloque and ("panel" in bloque or "desarrolladores" in bloque)


@pytest.mark.parametrize("ruta", [ENV_RAIZ, ENV_BACKEND, ROOT / "frontend" / ".env.example"])
def test_plantillas_sin_valores_con_forma_de_credencial_real(ruta: Path) -> None:
    valores = [v for v in dotenv_values(ruta).values() if v]

    assert [v for v in valores if SECRETO_REAL.search(v)] == []


# ── README raíz ──────────────────────────────────────────────────────────────


def test_readme_no_tiene_el_estado_desactualizado() -> None:
    texto = _texto(README)

    assert "31 changes" not in texto
    assert "en curso" not in texto.lower()


def test_readme_nombra_los_pasos_de_arranque_en_orden() -> None:
    texto = _texto(README)
    pasos = [
        "docker compose up -d db",
        "pip install -r requirements.txt",
        "alembic upgrade head",
        "python -m app.db.seed",
        "uvicorn app.main:app",
        "npm install",
        "npm run dev",
    ]

    posiciones = [texto.find(p) for p in pasos]

    assert -1 not in posiciones, dict(zip(pasos, posiciones))
    assert posiciones == sorted(posiciones)
    assert "http://localhost:5173" in texto and "http://localhost:8000/docs" in texto


def test_scripts_npm_del_readme_existen_en_package_json() -> None:
    scripts = json.loads(_texto(ROOT / "frontend" / "package.json"))["scripts"]
    nombrados = set(re.findall(r"npm run ([a-z:]+)", _texto(README)))

    assert {"dev", "typecheck", "lint"} <= nombrados
    assert nombrados <= set(scripts)


def test_modulos_python_del_readme_existen() -> None:
    nombrados = set(re.findall(r"python -m (app(?:\.[a-z_]+)+)", _texto(README)))

    assert {"app.db.seed", "app.db.reset"} <= nombrados
    for modulo in nombrados:
        assert (BACKEND_DIR / (modulo.replace(".", "/") + ".py")).exists(), modulo


def test_servicios_y_perfiles_de_compose_del_readme_existen() -> None:
    compose = _texto(COMPOSE)
    texto = _texto(README)

    assert "db" in re.findall(r"docker compose up -d (\w+)", texto)
    perfiles = re.findall(r"docker compose --profile (\w+) up -d --build ([\w-]+)", texto)
    assert perfiles, "el README debería documentar el perfil prod"
    for perfil, nombre in perfiles:
        assert f"{nombre}:" in compose and f'profiles: ["{perfil}"]' in compose


def test_readme_lista_las_credenciales_reales_del_seed() -> None:
    texto = _texto(README)

    assert ADMIN_EMAIL in texto and ADMIN_PASSWORD_DESARROLLO in texto
    for email, _nombre, _apellido, _celular, password, rol in USUARIOS_DEMO:
        assert email in texto and password in texto and rol in texto
    assert "desarrollo" in texto.lower()


@pytest.mark.parametrize(
    "marca",
    ["DT-28", "PA-07", "COCINA", "UTC", "PA-13", "$50", "idempotencia", "Tailwind", "app.db.seed"],
)
def test_readme_documenta_cada_limitacion_conocida(marca: str) -> None:
    seccion = _texto(README).split("## Limitaciones conocidas", 1)

    assert len(seccion) == 2, "falta la sección «Limitaciones conocidas»"
    assert marca.lower() in seccion[1].lower()


@pytest.mark.parametrize(
    "marca", ["pytest --cov", "60", "ngrok", "/api/v1/pagos/webhook", "--profile prod", "MP_WEBHOOK_SECRET"]
)
def test_readme_documenta_cobertura_mercadopago_y_perfil_prod(marca: str) -> None:
    assert marca in _texto(README)


@pytest.mark.parametrize("archivo", ["checklist-rubrica.md", "recorrido-e2e.md", "metadatos.md"])
def test_readme_enlaza_la_evidencia_de_entrega_y_existe(archivo: str) -> None:
    assert f"docs/entrega/{archivo}" in _texto(README)
    assert (ENTREGA / archivo).exists()


# ── docs/entrega ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize("n", range(1, 15))
def test_checklist_incluye_cada_item_ce_exactamente_una_vez(n: int) -> None:
    clave = f"CE-{n:02d}"
    filas = [l for l in _texto(ENTREGA / "checklist-rubrica.md").splitlines() if re.match(rf"\|\s*{clave}\s*\|", l)]

    assert len(filas) == 1


def test_checklist_cubre_los_13_criterios_y_los_bonus() -> None:
    texto = _texto(ENTREGA / "checklist-rubrica.md")
    kb = _texto(ROOT / "knowledge-base" / "13_rubrica_y_entrega.md")
    criterios = re.findall(r"^\| ((?:Backend|Frontend|UI/UX|Calidad)[^|]+?) \| \d+ \|", kb, flags=re.M)

    assert len(criterios) == 13
    for criterio in criterios:
        assert sum(1 for l in texto.splitlines() if l.startswith("|") and criterio in l) == 1, criterio
    assert "+10" in texto and "deploy" in texto.lower() and "tests" in texto.lower()


def test_checklist_filas_ce_tienen_estado_y_evidencia() -> None:
    estados = ("cumplido", "parcial", "pendiente")
    filas = _filas_ce()

    assert len(filas) == 14
    for fila in filas.values():
        celdas = [c.strip() for c in fila.strip().strip("|").split("|")]
        assert any(e in celdas[2].lower() for e in estados), fila
        assert celdas[3], fila


@pytest.mark.parametrize("clave", ["CE-01", "CE-09", "CE-12", "CE-13", "CE-14"])
def test_checklist_no_declara_cumplido_lo_que_depende_del_usuario_o_de_la_espera(clave: str) -> None:
    assert "pendiente" in _filas_ce()[clave].lower()


@pytest.mark.parametrize("campo", ["Materia", "Carrera", "Equipo", "Docente"])
def test_metadatos_muestran_tbd_visible_para_cada_campo(campo: str) -> None:
    texto = _texto(ENTREGA / "metadatos.md")

    assert re.search(rf"{campo}[^\n]*\(TBD\)", texto)
    assert "PA-18" in texto


@pytest.mark.parametrize(
    "marca",
    [
        "cliente@foodstore.com",
        "pedidos@foodstore.com",
        "admin@foodstore.com",
        "EFECTIVO",
        "MERCADOPAGO",
        "ENTREGADO",
        "CONFIRMADO",
        "EN_PREP",
        "EN_CAMINO",
        "CANCELADO",
        "motivo",
        "Dashboard",
    ],
)
def test_recorrido_e2e_cubre_efectivo_tarjeta_cancelacion_y_dashboard(marca: str) -> None:
    assert marca in _texto(ENTREGA / "recorrido-e2e.md")
