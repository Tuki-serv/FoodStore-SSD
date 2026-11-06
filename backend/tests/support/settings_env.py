"""Entornos de ejemplo (falsos) para tests de `Settings`: obligatorias, opcionales y variables retiradas."""

REQUIRED_ENV: dict[str, str] = {
    "ENVIRONMENT": "test",
    "DATABASE_URL": "postgresql+psycopg://u:p@h:5433/d_test",
    "SECRET_KEY": "k" * 64,
    "ALGORITHM": "HS256",
    "ACCESS_TOKEN_EXPIRE_MINUTES": "15",
    "REFRESH_TOKEN_EXPIRE_DAYS": "7",
    "LOG_LEVEL": "WARNING",
    "SQL_ECHO": "false",
    "CORS_ORIGINS": '["http://localhost:5173","http://localhost:3000"]',
    "RATE_LIMIT_DEFAULT_PER_MINUTE": "1000",
    "RATE_LIMIT_DEFAULT_BURST": "1000",
    "RATE_LIMIT_AUTH_PER_MINUTE": "1000",
    "RATE_LIMIT_AUTH_BURST": "1000",
}

OPTIONAL_ENV: dict[str, str] = {
    "MP_ACCESS_TOKEN": "mp-token-falso",
    "MP_PUBLIC_KEY": "mp-public-falsa",
    "MP_NOTIFICATION_URL": "https://abc.ngrok-free.app/api/v1/pagos/webhook",
    "BACKEND_PUBLIC_URL": "https://abc.ngrok-free.app",
    "FRONTEND_URL": "https://tienda.example",
    "CLOUDINARY_NAME": "nube-falsa",
    "CLOUDINARY_API_KEY": "key-falsa",
    "CLOUDINARY_API_SECRET": "secret-falso",
}

OPTIONAL_FIELDS = tuple(OPTIONAL_ENV)
RETIRED_VARS = ("MP_WEBHOOK_URL", "NGROK_URL", "VITE_FRONTEND_URL", "VITE_API_URL")
POSTGRES_VARS = ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "POSTGRES_HOST", "POSTGRES_PORT")
