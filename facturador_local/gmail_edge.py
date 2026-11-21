"""Crea borradores Gmail con PDF/XML adjuntos y los abre en Microsoft Edge.

Requiere OAuth de aplicación de escritorio y consentimiento del propietario.
Nunca envía el correo automáticamente.
"""
from email.message import EmailMessage
from pathlib import Path
import base64
import json
import re
import os

SCOPES = ["https://www.googleapis.com/auth/gmail.compose"]


def _ruta_privada(nombre):
    base = os.environ.get("LOCALAPPDATA")
    if not base:
        raise RuntimeError("Solo se admite configuración local en Windows")
    directorio = Path(base) / "NicoleFacturador" / "gmail"
    directorio.mkdir(parents=True, exist_ok=True)
    return directorio / nombre


def _dependencias():
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    return Request, Credentials, InstalledAppFlow, build


def _credenciales():
    Request, Credentials, InstalledAppFlow, build = _dependencias()
    # El token OAuth está protegido por DPAPI para el usuario Windows.
    import win32crypt
    token = _ruta_privada("token.dpapi")
    cred = None
    if token.exists():
        raw = win32crypt.CryptUnprotectData(token.read_bytes(), None, None, None, 0)[1]
        cred = Credentials.from_authorized_user_info(json.loads(raw), SCOPES)
    if cred and cred.expired and cred.refresh_token:
        cred.refresh(Request())
    if not cred or not cred.valid:
        cliente = _ruta_privada("oauth_client.json")
        if not cliente.is_file():
            raise FileNotFoundError(
                "Falta oauth_client.json local: configura una aplicación OAuth Desktop en Google Cloud"
            )
        flujo = InstalledAppFlow.from_client_secrets_file(str(cliente), SCOPES)
        cred = flujo.run_local_server(port=0, open_browser=True)
    protegido = win32crypt.CryptProtectData(
        cred.to_json().encode("utf-8"), "Nicole Gmail OAuth", None, None, None, 0
    )
    token.write_bytes(protegido)
    return build("gmail", "v1", credentials=cred)


def preparar_borrador_gmail(destinatario, numero_factura, pdf, xml, autorizado=False):
    """Crea borrador real con adjuntos; no permite comprobantes sin autorización.

    Requiere que pdf y xml existan en disco local y que autorizado=True provenga
    de verificación persistida del SRI (nunca de un checkbox público).
    """
    if autorizado is not True:
        raise ValueError("Solo se preparan facturas autorizadas por el SRI")
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", destinatario):
        raise ValueError("Correo del destinatario inválido")
    if not re.fullmatch(r"[0-9]{3}-[0-9]{3}-[0-9]{9}", numero_factura):
        raise ValueError("Número de factura inválido")
    pdf, xml = Path(pdf), Path(xml)
    if pdf.suffix.lower() != ".pdf" or xml.suffix.lower() != ".xml":
        raise ValueError("Se requieren un PDF y un XML")
    if not pdf.is_file() or not xml.is_file():
        raise FileNotFoundError("Falta el PDF o XML autorizado")
    if pdf.stat().st_size > 15_000_000 or xml.stat().st_size > 15_000_000:
        raise ValueError("Adjuntos demasiado grandes")
    mensaje = EmailMessage()
    mensaje["To"] = destinatario
    mensaje["Subject"] = f"Nicole Encajes - Factura electrónica {numero_factura}"
    mensaje.set_content(
        f"Estimado cliente:\n\nAdjuntamos su factura electrónica {numero_factura} "
        "de Nicole Encajes en formatos PDF y XML.\n\nGracias por su compra.\nNicole Encajes"
    )
    mensaje.add_attachment(pdf.read_bytes(), maintype="application", subtype="pdf", filename=pdf.name)
    mensaje.add_attachment(xml.read_bytes(), maintype="application", subtype="xml", filename=xml.name)
    servicio = _credenciales()
    raw = base64.urlsafe_b64encode(mensaje.as_bytes()).decode("ascii")
    borrador = servicio.users().drafts().create(userId="me", body={"message": {"raw": raw}}).execute()
    identificador = borrador["id"]
    if not re.fullmatch(r"[A-Za-z0-9_-]+", identificador):
        raise ValueError("ID de borrador inesperado")
    from .correo_edge import _edge
    import subprocess
    url = "https://mail.google.com/mail/u/0/#drafts?compose=" + identificador
    # Gmail puede no interpretar compose=<draft id> en todas sus versiones.
    # Abrir carpeta de borradores es más fiable; el usuario elige el borrador.
    subprocess.Popen([_edge(), "--new-window", "https://mail.google.com/mail/u/0/#drafts"], close_fds=True)
    return identificador
