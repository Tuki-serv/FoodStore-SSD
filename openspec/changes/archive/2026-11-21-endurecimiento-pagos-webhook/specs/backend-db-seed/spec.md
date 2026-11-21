## ADDED Requirements

### Requirement: Salida del seed compatible con la consola de Windows
Todo lo que `python -m app.db.seed` escribe en la salida estándar SHALL poder codificarse en cp1252 (la consola por defecto de Windows), de modo que la salida nunca haga fallar ni revertir la siembra.

#### Scenario: Consola cp1252 sobre base nueva
- **WHEN** se ejecuta el seed sobre una base recién migrada con la salida estándar en codificación cp1252 estricta
- **THEN** el seed termina sin errores y la base queda con los roles, estados, formas de pago, usuarios y datos de demostración sembrados

#### Scenario: Consola cp1252 con usuarios existentes
- **WHEN** se ejecuta el seed por segunda vez con la salida estándar en cp1252 estricta, de modo que informa usuarios que ya existen
- **THEN** el seed termina sin errores y no cambia ninguna fila
