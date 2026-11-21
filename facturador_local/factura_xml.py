"""Generación local de borradores XML de factura ecuatoriana.

NO firma, NO envía al SRI y NO reserva secuenciales de producción.
Los códigos tributarios deben verificarse contra el catálogo SRI vigente.
"""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from xml.etree.ElementTree import Element, SubElement, tostring
import re

CENT = Decimal("0.01")
FOUR = Decimal("0.0001")


def dec(value):
    if isinstance(value, float):
        raise TypeError("Use Decimal o cadenas, nunca float para dinero")
    return Decimal(str(value))


def fmt(value, places=CENT):
    return str(dec(value).quantize(places, rounding=ROUND_HALF_UP))


def _digits(value, length, name):
    value = str(value)
    if not re.fullmatch(r"[0-9]{" + str(length) + r"}", value):
        raise ValueError(f"{name} debe tener {length} dígitos")
    return value


def _tag(parent, name, value):
    SubElement(parent, name).text = str(value)


@dataclass(frozen=True)
class Emisor:
    ruc: str
    razon_social: str
    nombre_comercial: str
    direccion_matriz: str
    direccion_establecimiento: str
    establecimiento: str
    punto_emision: str
    obligado_contabilidad: str = "NO"

    def __post_init__(self):
        _digits(self.ruc, 13, "RUC")
        _digits(self.establecimiento, 3, "establecimiento")
        _digits(self.punto_emision, 3, "punto_emision")
        if self.obligado_contabilidad not in ("SI", "NO"):
            raise ValueError("obligado_contabilidad debe ser SI o NO")


@dataclass(frozen=True)
class Receptor:
    tipo_identificacion: str
    identificacion: str
    razon_social: str
    direccion: str = ""

    def __post_init__(self):
        if self.tipo_identificacion not in ("04", "05", "06", "07", "08"):
            raise ValueError("Tipo de identificación SRI no reconocido")
        if not self.identificacion or not self.razon_social:
            raise ValueError("Identificación y razón social son obligatorias")


@dataclass(frozen=True)
class Item:
    codigo: str
    descripcion: str
    cantidad: Decimal
    precio_unitario: Decimal
    descuento: Decimal
    codigo_impuesto: str
    codigo_porcentaje: str
    tarifa_porcentaje: Decimal

    def __post_init__(self):
        if not self.codigo or not self.descripcion:
            raise ValueError("Código y descripción obligatorios")
        if dec(self.cantidad) <= 0 or dec(self.precio_unitario) < 0:
            raise ValueError("Cantidad y precio inválidos")
        if dec(self.descuento) < 0:
            raise ValueError("Descuento negativo")
        if dec(self.descuento) > dec(self.cantidad) * dec(self.precio_unitario):
            raise ValueError("Descuento mayor que importe")
        if dec(self.tarifa_porcentaje) < 0:
            raise ValueError("Tarifa negativa")


@dataclass(frozen=True)
class Factura:
    emisor: Emisor
    receptor: Receptor
    fecha_emision: date
    secuencial: str
    items: tuple
    forma_pago: str
    plazo: str = "0"
    unidad_tiempo: str = "dias"
    ambiente: str = "1"
    tipo_emision: str = "1"
    codigo_numerico: str = "12345678"

    def __post_init__(self):
        _digits(self.secuencial, 9, "secuencial")
        _digits(self.codigo_numerico, 8, "codigo_numerico")
        if self.ambiente not in ("1", "2"):
            raise ValueError("Ambiente 1 pruebas / 2 producción")
        if self.tipo_emision != "1":
            raise ValueError("Solo se implementa emisión normal")
        if not self.items:
            raise ValueError("La factura requiere al menos un detalle")
        if not self.forma_pago:
            raise ValueError("Forma de pago obligatoria")


def clave_acceso(factura):
    cuerpo = (
        factura.fecha_emision.strftime("%d%m%Y")
        + "01"
        + factura.emisor.ruc
        + factura.ambiente
        + factura.emisor.establecimiento
        + factura.emisor.punto_emision
        + factura.secuencial
        + factura.codigo_numerico
        + factura.tipo_emision
    )
    factores = (2, 3, 4, 5, 6, 7)
    suma = sum(int(digito) * factores[i % len(factores)] for i, digito in enumerate(reversed(cuerpo)))
    residuo = 11 - (suma % 11)
    verificador = 0 if residuo == 11 else 1 if residuo == 10 else residuo
    return cuerpo + str(verificador)


def generar_xml_borrador(factura):
    """Devuelve XML UTF-8 sin firma. Bloquea deliberadamente ambiente de producción."""
    if factura.ambiente != "1":
        raise ValueError("Producción bloqueada: esta fase solo genera borradores de certificación")
    root = Element("factura", {"id": "comprobante", "version": "2.1.0"})
    tributaria = SubElement(root, "infoTributaria")
    for key, value in (
        ("ambiente", factura.ambiente), ("tipoEmision", factura.tipo_emision),
        ("razonSocial", factura.emisor.razon_social),
        ("nombreComercial", factura.emisor.nombre_comercial),
        ("ruc", factura.emisor.ruc), ("claveAcceso", clave_acceso(factura)),
        ("codDoc", "01"), ("estab", factura.emisor.establecimiento),
        ("ptoEmi", factura.emisor.punto_emision), ("secuencial", factura.secuencial),
        ("dirMatriz", factura.emisor.direccion_matriz),
    ):
        _tag(tributaria, key, value)

    info = SubElement(root, "infoFactura")
    _tag(info, "fechaEmision", factura.fecha_emision.strftime("%d/%m/%Y"))
    _tag(info, "dirEstablecimiento", factura.emisor.direccion_establecimiento)
    _tag(info, "obligadoContabilidad", factura.emisor.obligado_contabilidad)
    _tag(info, "tipoIdentificacionComprador", factura.receptor.tipo_identificacion)
    _tag(info, "razonSocialComprador", factura.receptor.razon_social)
    _tag(info, "identificacionComprador", factura.receptor.identificacion)
    if factura.receptor.direccion:
        _tag(info, "direccionComprador", factura.receptor.direccion)

    bases = {}
    impuestos = {}
    descuento_total = Decimal("0")
    subtotal_total = Decimal("0")
    detalles = SubElement(root, "detalles")
    for item in factura.items:
        bruto = dec(item.cantidad) * dec(item.precio_unitario)
        base = (bruto - dec(item.descuento)).quantize(CENT, rounding=ROUND_HALF_UP)
        descuento_total += dec(item.descuento)
        subtotal_total += base
        llave = (item.codigo_impuesto, item.codigo_porcentaje, dec(item.tarifa_porcentaje))
        bases[llave] = bases.get(llave, Decimal("0")) + base

        detalle = SubElement(detalles, "detalle")
        for key, value in (
            ("codigoPrincipal", item.codigo), ("descripcion", item.descripcion),
            ("cantidad", fmt(item.cantidad, FOUR)), ("precioUnitario", fmt(item.precio_unitario, FOUR)),
            ("descuento", fmt(item.descuento)), ("precioTotalSinImpuesto", fmt(base)),
        ):
            _tag(detalle, key, value)
        impuestos_detalle = SubElement(detalle, "impuestos")
        imp = SubElement(impuestos_detalle, "impuesto")
        for key, value in (
            ("codigo", item.codigo_impuesto), ("codigoPorcentaje", item.codigo_porcentaje),
            ("tarifa", fmt(item.tarifa_porcentaje)),
            ("baseImponible", fmt(base)),
            ("valor", fmt(base * dec(item.tarifa_porcentaje) / Decimal("100"))),
        ):
            _tag(imp, key, value)

    total_impuestos = SubElement(info, "totalConImpuestos")
    for (codigo, porcentaje, tarifa), base in sorted(bases.items()):
        valor = (base * tarifa / Decimal("100")).quantize(CENT, rounding=ROUND_HALF_UP)
        impuestos[(codigo, porcentaje)] = impuestos.get((codigo, porcentaje), Decimal("0")) + valor
        t = SubElement(total_impuestos, "totalImpuesto")
        for key, v in (
            ("codigo", codigo), ("codigoPorcentaje", porcentaje),
            ("baseImponible", fmt(base)), ("valor", fmt(valor)),
        ):
            _tag(t, key, v)

    # ElementTree conserva orden de inserción: reorganizamos campos según esquema factura.
    info.remove(total_impuestos)
    _tag(info, "totalSinImpuestos", fmt(subtotal_total))
    _tag(info, "totalDescuento", fmt(descuento_total))
    info.append(total_impuestos)
    _tag(info, "propina", "0.00")
    total = subtotal_total + sum(impuestos.values(), Decimal("0"))
    _tag(info, "importeTotal", fmt(total))
    _tag(info, "moneda", "DOLAR")
    pagos = SubElement(info, "pagos")
    pago = SubElement(pagos, "pago")
    _tag(pago, "formaPago", factura.forma_pago)
    _tag(pago, "total", fmt(total))
    _tag(pago, "plazo", factura.plazo)
    _tag(pago, "unidadTiempo", factura.unidad_tiempo)

    # El XSD requiere infoFactura antes de detalles.
    root.remove(detalles)
    root.append(detalles)
    return b'<?xml version="1.0" encoding="UTF-8"?>\n' + tostring(root, encoding="utf-8")
