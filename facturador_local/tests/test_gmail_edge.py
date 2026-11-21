import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path
from tempfile import TemporaryDirectory
from facturador_local.gmail_edge import preparar_borrador_gmail


class GmailEdgeTests(unittest.TestCase):
    def test_rechaza_sin_autorizacion(self):
        with self.assertRaises(ValueError):
            preparar_borrador_gmail("cliente@example.com", "002-001-000000398", "a.pdf", "a.xml")

    def test_rechaza_sin_archivos(self):
        with self.assertRaises(FileNotFoundError):
            preparar_borrador_gmail("cliente@example.com", "002-001-000000398", "a.pdf", "a.xml", autorizado=True)


if __name__ == "__main__":
    unittest.main()
