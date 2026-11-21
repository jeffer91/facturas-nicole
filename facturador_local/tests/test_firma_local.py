import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from facturador_local import firma_local


class FirmaLocalTests(unittest.TestCase):
    def test_extension_invalida(self):
        with patch.object(firma_local, "_requisitos"):
            with self.assertRaisesRegex(ValueError, "p12"):
                firma_local.importar_firma("firma.txt", "secreto")

    def test_password_obligatorio(self):
        with patch.object(firma_local, "_requisitos"):
            with self.assertRaisesRegex(ValueError, "Contraseña"):
                firma_local.importar_firma("firma.p12", "")

    def test_sin_dependencias_falla_cerrado(self):
        with patch.object(firma_local, "win32crypt", None):
            with self.assertRaises(RuntimeError):
                firma_local._requisitos()

    def test_almacen_fuera_repositorio(self):
        with patch.dict("os.environ", {"LOCALAPPDATA": "C:/Users/operador/AppData/Local"}):
            self.assertIn("NicoleFacturador", str(firma_local._directorio()))


if __name__ == "__main__":
    unittest.main()
