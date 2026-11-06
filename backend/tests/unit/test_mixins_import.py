"""El paquete de mixins se llama `mixins` (typo `minxins` corregido en C-01)."""
import importlib
import importlib.util


def test_mixins_package_expone_unique_auditable_mixin() -> None:
    module = importlib.import_module("app.core.mixins.auditable_mixin")

    assert hasattr(module, "UniqueAuditableMixin")


def test_mixins_package_con_typo_ya_no_existe() -> None:
    assert importlib.util.find_spec("app.core.minxins") is None
