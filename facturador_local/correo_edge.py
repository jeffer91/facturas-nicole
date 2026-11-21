"""Abre un borrador de correo en Microsoft Edge, sin enviar mensajes automáticamente.

Adjuntar PDF/XML requiere integración autenticada con proveedor de correo.
"""
from pathlib import Path
from urllib.parse import urlencode
import os
import re
import shutil
import subprocess


def _edge():
    rutas = [
        Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
        Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
    ]
    encontrado = shutil.which("msedge")
    if encontrado:
        return encontrado
    for ruta in rutas:
        if ruta.is_file():
            return str(ruta)
    raise RuntimeError("Microsoft Edge no está instalado o no se encuentra")


def enlace_borrador(destinatario, numero_factura, proveedor="gmail"):
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", destinatario):
        raise ValueError("Correo del destinatario inválido")
    if not re.fullmatch(r"[0-9]{3}-[0-9]{3}-[0-9]{9}", numero_factura):
        raise ValueError("Número de factura inválido")
    asunto = f"Nicole Encajes - Factura electrónica {numero_factura}"
    cuerpo = (
        "Estimado cliente:\n\n"
        f"Adjuntamos su factura electrónica {numero_factura} de Nicole Encajes.\n"
        "Por favor, compruebe que se incluyen el PDF (RIDE) y el XML autorizado.\n\n"
        "Gracias por su compra.\nNicole Encajes"
    )
    if proveedor == "gmail":
        return "https://mail.google.com/mail/?" + urlencode(
            {"view": "cm", "fs": "1", "to": destinatario, "su": asunto, "body": cuerpo}
        )
    if proveedor == "outlook":
        return "https://outlook.office.com/mail/deeplink/compose?" + urlencode(
            {"to": destinatario, "subject": asunto, "body": cuerpo}
        )
    raise ValueError("Proveedor no admitido: gmail u outlook")


def abrir_correo_edge(destinatario, numero_factura, proveedor="gmail"):
    """Abre borrador en Edge; NO adjunta documentos y NO envía correo."""
    url = enlace_borrador(destinatario, numero_factura, proveedor)
    subprocess.Popen([_edge(), "--new-window", url], close_fds=True)
    return url
