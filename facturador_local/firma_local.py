"""Almacén local de certificado P12/PFX protegido con Windows DPAPI.

Solo importa y recupera el certificado: NO implementa aún firma XAdES-BES.
La clave privada nunca se envía a servicios externos.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
import os
import tempfile

try:
    import win32crypt
except ImportError:
    win32crypt = None

try:
    from cryptography.hazmat.primitives.serialization import pkcs12
except ImportError:
    pkcs12 = None


@dataclass(frozen=True)
class CertificadoInfo:
    sujeto: str
    emisor: str
    vence_utc: str


def _requisitos():
    if os.name != "nt" or win32crypt is None or pkcs12 is None:
        raise RuntimeError("La firma local requiere Windows, pywin32 y cryptography")


def _directorio():
    base = os.environ.get("LOCALAPPDATA")
    if not base:
        raise RuntimeError("LOCALAPPDATA no está disponible")
    return Path(base) / "NicoleFacturador" / "certificado"


def _certificado(pfx, password):
    clave, certificado, _ = pkcs12.load_key_and_certificates(pfx, password.encode("utf-8"))
    if clave is None or certificado is None:
        raise ValueError("El archivo no contiene certificado y clave privada")
    vencimiento = getattr(certificado, "not_valid_after_utc", None)
    if vencimiento is None:
        vencimiento = certificado.not_valid_after.replace(tzinfo=timezone.utc)
    if vencimiento <= datetime.now(timezone.utc):
        raise ValueError("Certificado vencido")
    return CertificadoInfo(
        sujeto=certificado.subject.rfc4514_string(),
        emisor=certificado.issuer.rfc4514_string(),
        vence_utc=vencimiento.isoformat(),
    )


def _escribir_atomico(destino, datos):
    destino.parent.mkdir(parents=True, exist_ok=True)
    temporal = None
    try:
        with tempfile.NamedTemporaryFile(dir=destino.parent, prefix=".nuevo-", delete=False) as archivo:
            temporal = Path(archivo.name)
            archivo.write(datos)
            archivo.flush()
            os.fsync(archivo.fileno())
        os.replace(temporal, destino)
    finally:
        if temporal is not None:
            temporal.unlink(missing_ok=True)


def importar_firma(ruta_pfx, password):
    """Verifica e importa la firma para el usuario actual de Windows.

    Importante: requiere sesión de Windows protegida y perfil no compartido.
    """
    _requisitos()
    if not password:
        raise ValueError("Contraseña requerida")
    ruta = Path(ruta_pfx)
    if ruta.suffix.lower() not in (".p12", ".pfx"):
        raise ValueError("Se requiere un archivo .p12 o .pfx")
    datos = ruta.read_bytes()
    info = _certificado(datos, password)
    # DPAPI protege ambos elementos ligados al usuario actual de Windows.
    paquete = len(datos).to_bytes(8, "big") + datos + password.encode("utf-8")
    protegido = win32crypt.CryptProtectData(paquete, "NicoleFacturador", None, None, None, 0)
    _escribir_atomico(_directorio() / "firma.dpapi", protegido)
    return info


def cargar_firma_local():
    """Recupera el PFX y su contraseña en memoria para el futuro firmador XML.

    No devolver estos bytes a frontend web, logs, API o procesos no confiables.
    """
    _requisitos()
    protegido = (_directorio() / "firma.dpapi").read_bytes()
    paquete = win32crypt.CryptUnprotectData(protegido, None, None, None, 0)[1]
    longitud = int.from_bytes(paquete[:8], "big")
    if longitud <= 0 or longitud > len(paquete) - 8:
        raise ValueError("Almacén de firma corrupto")
    pfx = paquete[8:8 + longitud]
    password = paquete[8 + longitud:].decode("utf-8")
    _certificado(pfx, password)
    return pfx, password


def eliminar_firma_local():
    """Quita el archivo local; no garantiza borrado forense de disco."""
    (_directorio() / "firma.dpapi").unlink(missing_ok=True)
