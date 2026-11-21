import unittest
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
from facturador_local.archivo_facturas import ruta_cliente, guardar_factura_autorizada


class ArchivoFacturasTests(unittest.TestCase):
    def test_estructura_fecha_cliente(self):
        ruta = ruta_cliente(date(2026, 11, 21), "María / López", "1712345678", "/tmp/Facturas")
        self.assertEqual(ruta.parts[-4:], ("2026", "11 - Noviembre", "21-11-2026", "Maria Lopez - 1712345678"))

    def test_guarda_ambos_y_no_sobrescribe(self):
        with TemporaryDirectory() as tmp:
            base = Path(tmp)
            pdf, xml = base / "entrada.pdf", base / "entrada.xml"
            pdf.write_bytes(b"%PDF-prueba")
            xml.write_bytes(b"<factura/>")
            args = (date(2026, 11, 21), "Cliente", "1712345678", "002-001-000000399", pdf, xml)
            with self.assertRaises(ValueError):
                guardar_factura_autorizada(*args, base=base)
            salidas = guardar_factura_autorizada(*args, autorizada=True, base=base)
            self.assertEqual([p.read_bytes() for p in salidas], [b"%PDF-prueba", b"<factura/>"])
            with self.assertRaises(FileExistsError):
                guardar_factura_autorizada(*args, autorizada=True, base=base)


if __name__ == "__main__":
    unittest.main()
