import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from facturador_local.secuenciales import inicializar, reservar, numero_factura


class SecuencialesTests(unittest.TestCase):
    def test_formato(self):
        self.assertEqual(numero_factura(2000), "002-001-000002000")

    def test_bloqueo_y_reserva_idempotente(self):
        with TemporaryDirectory() as tmp:
            ruta = Path(tmp) / "facturas.sqlite"
            inicializar(ruta)
            with self.assertRaises(RuntimeError):
                reservar(ruta, "venta-00001")
            self.assertEqual(reservar(ruta, "venta-00001", conciliacion_verificada=True), "002-001-000002000")
            self.assertEqual(reservar(ruta, "venta-00001", conciliacion_verificada=True), "002-001-000002000")
            self.assertEqual(reservar(ruta, "venta-00002", conciliacion_verificada=True), "002-001-000002001")


if __name__ == "__main__":
    unittest.main()
