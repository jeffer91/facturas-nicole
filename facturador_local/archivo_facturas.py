"""Archivo local de facturas por año/mes/fecha/cliente.

Solo archiva comprobantes ya autorizados; no genera ni autoriza facturas.
"""
from datetime import date
from pathlib import Path
import os
import re
import shutil
import tempfile
import unicodedata


def carpeta_base():
    base = os.environ.get("USERPROFILE")
    if not base:
        raise RuntimeError("USERPROFILE no está disponible en esta computadora")
    return Path(base) / "Documents" / "Nicole Facturador" / "Facturas"


def _limpiar(texto, maximo=70):
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = re.sub(r"[^A-Za-z0-9 _.-]", "", texto).strip(" ._-")
    texto = re.sub(r"\s+", " ", texto)
    return (texto[:maximo].strip(" ._-") or "SIN NOMBRE")


def ruta_cliente(fecha, cliente, identificacion, base=None):
    if not isinstance(fecha, date):
        raise TypeError("fecha debe ser date")
    if not re.fullmatch(r"[A-Za-z0-9-]{3,20}", identificacion):
        raise ValueError("Identificación del cliente inválida")
    meses = ("Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
             "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre")
    raiz = Path(base) if base is not None else carpeta_base()
    return (raiz / str(fecha.year) / f"{fecha.month:02d} - {meses[fecha.month - 1]}"
            / fecha.strftime("%d-%m-%Y") / f"{_limpiar(cliente)} - {identificacion}")


def guardar_factura_autorizada(fecha, cliente, identificacion, numero, pdf, xml, autorizada=False, base=None):
    """Copia PDF y XML sin sobrescribir facturas previas.

    El llamador debe obtener 'autorizada' de una respuesta SRI verificada,
    nunca de un campo del formulario del cliente.
    """
    if autorizada is not True:
        raise ValueError("Solo se archivan facturas autorizadas por el SRI")
    if not re.fullmatch(r"[0-9]{3}-[0-9]{3}-[0-9]{9}", numero):
        raise ValueError("Número de factura inválido")
    pdf, xml = Path(pdf), Path(xml)
    if pdf.suffix.lower() != ".pdf" or xml.suffix.lower() != ".xml":
        raise ValueError("Se requiere PDF y XML")
    if not pdf.is_file() or not xml.is_file():
        raise FileNotFoundError("Falta PDF o XML")
    destino = ruta_cliente(fecha, cliente, identificacion, base)
    destino.mkdir(parents=True, exist_ok=True)
    salidas = [destino / f"{numero}.pdf", destino / f"{numero}.xml"]
    if any(p.exists() for p in salidas):
        raise FileExistsError("La factura ya está archivada; no se sobrescribirá")
    temporales = []
    try:
        for origen, salida in zip((pdf, xml), salidas):
            with tempfile.NamedTemporaryFile(dir=destino, prefix=".pendiente-", delete=False) as f:
                tmp = Path(f.name)
                temporales.append(tmp)
                with origen.open("rb") as entrada:
                    shutil.copyfileobj(entrada, f)
                f.flush()
                os.fsync(f.fileno())
        for tmp, salida in zip(temporales, salidas):
            os.replace(tmp, salida)
    finally:
        for tmp in temporales:
            tmp.unlink(missing_ok=True)
    return tuple(salidas)
