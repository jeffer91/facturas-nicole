# Numeración inicial prevista: 2000

- Emisor: Nicole Encajes, RUC 0400687893001.
- Establecimiento/punto **provisionales**, extraídos de un comprobante anterior: 002-001.
- Primer secuencial **previsto**: 000002000 (factura 002-001-000002000).
- El usuario informa que el facturador SRI está alrededor del 391 y que existe un respaldo. **El número exacto actual no está confirmado**.

## Condiciones antes de emitir
1. Confirmar en SRI el último comprobante autorizado, anulado y pendiente del establecimiento/punto correspondiente.
2. Comprobar que 002-001 y el secuencial 2000 están disponibles, o configurar un punto de emisión separado autorizado.
3. Conciliar respaldos y evitar que el facturador anterior y el nuevo asignen simultáneamente números del mismo punto.
4. Registrar y bloquear secuenciales de forma transaccional e idempotente.
5. Validar firma XAdES, XML y recepción/autorización SRI en certificación antes de producción.

`facturador_local/secuenciales.py` contiene una reserva SQLite inicial con bloqueo explícito; **no equivale a autorización SRI**. Su parámetro `conciliacion_verificada` es provisional y debe sustituirse por una verificación real y persistente, no un booleano proporcionado por el usuario o frontend.

No modificar comprobantes históricos ni utilizar este número para emisión real hasta completar los controles.
