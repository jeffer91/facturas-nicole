# Firma electrónica guardada localmente

## Objetivo
En la computadora Windows del negocio, el operador selecciona el P12/PFX e ingresa su contraseña **una sola vez**. El backend local valida que el certificado tenga clave privada y esté vigente, y guarda archivo y contraseña cifrados con DPAPI para el usuario Windows actual.

## Implementado en código
- `firma_local.importar_firma(ruta_pfx, password)`: verifica e importa.
- `firma_local.cargar_firma_local()`: recupera el material solo en el backend local.
- `firma_local.eliminar_firma_local()`: retira la configuración.
- Pruebas unitarias de validación inicial y ausencia de dependencias.

Instalar dependencias en Windows: `pip install -r facturador_local/requirements-windows.txt`.

## Limitaciones actuales
- **Todavía no existe interfaz para seleccionar el archivo**, instalador Windows, ni firmador XML XAdES-BES. La importación es una API local para integrar con la futura aplicación.
- **No se firma ni transmite ningún comprobante al SRI todavía**.
- La protección DPAPI depende del perfil Windows; no usar cuentas Windows compartidas o sin contraseña.
- Los datos recuperados se mantienen en memoria del proceso Python durante el uso. Evitar volcados de memoria, diagnósticos que registren secretos y exposición por HTTP.
- El sistema debe comprobar correspondencia entre certificado y RUC del emisor antes de permitir producción.
- Si se reinstala Windows o se pierde el perfil, puede ser necesario volver a importar el P12/PFX original. Mantener copia de respaldo externa segura.
- No subir el archivo ni su contraseña a GitHub, Supabase o formularios web.
