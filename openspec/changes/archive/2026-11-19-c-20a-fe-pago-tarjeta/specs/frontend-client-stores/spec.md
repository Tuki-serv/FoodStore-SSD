# Spec Delta — frontend-client-stores

## MODIFIED Requirements

### Requirement: Estado del pago no persistente
El estado del pago en curso (pedido, estado del intento, identificador de pago de MercadoPago y error) SHALL vivir solo en memoria: al recargar la página SHALL volver al estado inicial sin intento en curso. El identificador de pago de MercadoPago SHALL guardarse como texto tal como lo devuelve el backend (p. ej. `PAY01…`) y el resultado registrado SHALL admitir `aprobado`, `rechazado`, `pendiente` y `a_devolver`. El store nunca SHALL guardar datos de tarjeta.

#### Scenario: Recarga durante un pago
- **WHEN** hay un intento de pago en curso para el pedido 12 y la página se recarga
- **THEN** el estado del pago no tiene pedido ni intento en curso

#### Scenario: Identificador de pago como texto
- **WHEN** se registra el resultado `aprobado` con identificador `"PAY01JX7"` y detalle `"accredited"`
- **THEN** el estado del pago es `aprobado`, el identificador es `"PAY01JX7"` y el detalle `"accredited"`

#### Scenario: Pago aprobado sin pedido que lo respalde
- **WHEN** se registra el resultado `a_devolver`
- **THEN** el estado del pago es `a_devolver`
