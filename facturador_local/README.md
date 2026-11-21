# Nicole Facturador — motor XML (primera implementación)

Este directorio contiene **código ejecutable inicial**, no una aplicación de Windows instalable ni un facturador listo para producción.

## Estado actual
- Modelo de emisor, receptor, líneas y factura.
- Cálculo de importes con `Decimal`, agrupación de impuestos y clave de acceso módulo 11.
- Generación de borrador XML en **ambiente de pruebas únicamente**.
- Pruebas unitarias iniciales.
- Datos de emisor de ejemplo basados en una factura facilitada por el negocio; **direcciones QUITO son marcadores, no datos finales**.
- Los códigos de impuestos, versión XSD y reglas tributarias deben verificarse con la documentación SRI vigente antes de utilizar el resultado para certificación.

**No implementado:** validación XSD oficial, firma XAdES-BES, servicios web SRI, persistencia, numeración transaccional, aplicación Windows, PDF RIDE ni correo.

## Ejecutar pruebas

Desde la raíz del repositorio, con Python 3.10 o superior:

```bash
python -m unittest discover -s facturador_local/tests -v
```

## Seguridad
No subir archivos `.p12`, `.pfx`, contraseñas, claves privadas ni XML de clientes reales al repositorio. No reutilizar secuenciales reales para pruebas.

## Próximo trabajo
1. Validar XML contra XSD oficial aplicable.
2. Completar campos fiscales y catálogos de impuestos.
3. Implementar firma local protegida y certificación SRI.
4. Incorporar SQLite y aplicación instalable.
