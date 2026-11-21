import unittest
from urllib.parse import urlparse, parse_qs
from facturador_local.correo_edge import enlace_borrador


class CorreoEdgeTests(unittest.TestCase):
    def test_gmail(self):
        url = enlace_borrador("cliente@example.com", "002-001-000000398")
        self.assertEqual(urlparse(url).netloc, "mail.google.com")
        self.assertEqual(parse_qs(urlparse(url).query)["to"], ["cliente@example.com"])
        self.assertIn("002-001-000000398", url)

    def test_outlook(self):
        url = enlace_borrador("cliente@example.com", "002-001-000000398", "outlook")
        self.assertEqual(urlparse(url).netloc, "outlook.office.com")

    def test_email_invalido(self):
        with self.assertRaises(ValueError):
            enlace_borrador("no-email", "002-001-000000398")

    def test_factura_invalida(self):
        with self.assertRaises(ValueError):
            enlace_borrador("cliente@example.com", "398")


if __name__ == "__main__":
    unittest.main()
