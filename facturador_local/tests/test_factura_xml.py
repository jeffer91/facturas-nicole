import unittest
from datetime import date
from decimal import Decimal
from xml.etree import ElementTree as ET

from facturador_local.factura_xml import Emisor, Receptor, Item, Factura, clave_acceso, generar_xml_borrador


class FacturaXmlTests(unittest.TestCase):
    def setUp(self):
        self.emisor = Emisor(
            ruc="0400687893001",
            razon_social="VILLARREAL HERRERA EDGAR ORLANDO",
            nombre_comercial="NICOLE ENCAJES",
            direccion_matriz="QUITO",
            direccion_establecimiento="QUITO",
            establecimiento="002",
            punto_emision="001",
        )
        self.receptor = Receptor("07", "9999999999999", "CONSUMIDOR FINAL")
        self.item = Item("001", "ARTICULO DE PRUEBA", Decimal("2"), Decimal("10.00"),
                         Decimal("0"), "2", "4", Decimal("15"))

    def factura(self, **changes):
        fields = dict(emisor=self.emisor, receptor=self.receptor, fecha_emision=date(2026, 11, 21),
                      secuencial="000000001", items=(self.item,), forma_pago="01",
                      ambiente="1", codigo_numerico="12345678")
        fields.update(changes)
        return Factura(**fields)

    def test_clave_49_digitos(self):
        clave = clave_acceso(self.factura())
        self.assertEqual(len(clave), 49)
        self.assertTrue(clave.isdigit())
        self.assertEqual(clave[:10], "2111202601")

    def test_xml_montos_y_estructura(self):
        root = ET.fromstring(generar_xml_borrador(self.factura()))
        self.assertEqual(root.attrib["id"], "comprobante")
        self.assertEqual(root.findtext("infoFactura/totalSinImpuestos"), "20.00")
        self.assertEqual(root.findtext("infoFactura/importeTotal"), "23.00")
        self.assertEqual(root.findtext("infoTributaria/ambiente"), "1")
        self.assertEqual(root.findtext("detalles/detalle/impuestos/impuesto/valor"), "3.00")

    def test_produccion_bloqueada(self):
        with self.assertRaises(ValueError):
            generar_xml_borrador(self.factura(ambiente="2"))

    def test_descuento_invalido(self):
        with self.assertRaises(ValueError):
            Item("1", "Prueba", Decimal("1"), Decimal("1"), Decimal("2"), "2", "4", Decimal("15"))


if __name__ == "__main__":
    unittest.main()
