# Nicole Facturador — aplicación de escritorio (fase de pruebas)

Esta rama `main` incluye una envoltura Electron para abrir la interfaz publicada del facturador en una ventana de escritorio.

## Requisitos
- Windows 10/11, Node.js LTS y npm.
- Conexión a internet para consultar registros de clientes desde Supabase.
- Acceso administrativo autorizado.

## Ejecutar en Visual Studio Code
```powershell
git clone https://github.com/jeffer91/facturas-nicole.git
cd facturas-nicole
npm install
npm start
```

Para compilar un instalador de Windows:
```powershell
npm run dist
```
El instalador se generará en `dist/` si la compilación concluye correctamente.

## Seguridad
- Electron usa `contextIsolation`, `sandbox`, deshabilita `nodeIntegration` y no expone APIs de Node a la interfaz.
- No incrustar certificados, contraseñas ni claves privadas en Electron o GitHub.
- Las operaciones de SRI y firma no están integradas; la interfaz solo prepara borradores.
- La configuración de secuencial 2000 es una intención de negocio, no un número verificado o reservado en el SRI.
- Electron carga `https://jeffer91.github.io/facturas-nicole/facturador/` para conservar el origen web permitido por la API. Requiere internet; **no se ha verificado que el inicio de sesión funcione desde Electron**.
- No se ha ejecutado `npm install`, `npm start` ni compilación Windows en esta sesión.

## Pendientes para emisión real
1. Conectar autenticación segura de escritorio a Supabase.
2. Integrar catálogo, cálculos fiscales exactos y persistencia de borradores.
3. Motor XML oficial, firma XAdES-BES, recepción y autorización SRI.
4. Reserva idempotente de secuenciales y conciliación de 002-001 desde 2000.
5. RIDE, archivo por fecha/cliente y Gmail con adjuntos.
6. Pruebas de certificación SRI, regresión y empaquetado Windows.
