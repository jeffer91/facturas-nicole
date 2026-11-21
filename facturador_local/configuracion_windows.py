"""Ventana local de configuración de certificado y preparación de correo.

No abre puertos ni transmite el certificado; el botón de correo solo crea borradores.
Ejecutar: python -m facturador_local.configuracion_windows
"""
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from .firma_local import importar_firma, eliminar_firma_local
from .correo_edge import abrir_correo_edge


def main():
    raiz = tk.Tk()
    raiz.title("Nicole Facturador · Configuración local")
    raiz.geometry("650x430")
    raiz.minsize(600, 400)
    contenedor = ttk.Frame(raiz, padding=24)
    contenedor.pack(fill="both", expand=True)

    ttk.Label(contenedor, text="Nicole Facturador", font=("Segoe UI", 18, "bold")).pack(anchor="w")
    ttk.Label(contenedor, text="Configuración local · todavía no emite comprobantes al SRI").pack(anchor="w", pady=(0, 18))
    ttk.Label(contenedor, text="Archivo de firma electrónica (.p12/.pfx)").pack(anchor="w")
    fila = ttk.Frame(contenedor)
    fila.pack(fill="x", pady=5)
    ruta = tk.StringVar()
    ttk.Entry(fila, textvariable=ruta).pack(side="left", fill="x", expand=True)

    def seleccionar():
        archivo = filedialog.askopenfilename(filetypes=[("Certificados", "*.p12 *.pfx")])
        if archivo:
            ruta.set(archivo)

    ttk.Button(fila, text="Seleccionar", command=seleccionar).pack(side="left", padx=(8, 0))
    ttk.Label(contenedor, text="Contraseña del certificado").pack(anchor="w")
    password = tk.StringVar()
    ttk.Entry(contenedor, textvariable=password, show="*").pack(fill="x", pady=5)

    def guardar():
        try:
            info = importar_firma(ruta.get(), password.get())
            messagebox.showinfo("Firma configurada", f"Certificado guardado en Windows.\nVence: {info.vence_utc}")
            password.set("")
            ruta.set("")
        except Exception as exc:
            messagebox.showerror("No se pudo configurar", str(exc))

    botones = ttk.Frame(contenedor)
    botones.pack(fill="x", pady=12)
    ttk.Button(botones, text="Guardar firma protegida", command=guardar).pack(side="left")
    ttk.Button(botones, text="Quitar firma", command=lambda: (eliminar_firma_local(), messagebox.showinfo("Firma", "Configuración retirada"))).pack(side="left", padx=8)
    ttk.Separator(contenedor).pack(fill="x", pady=12)
    ttk.Label(contenedor, text="Abrir correo en Microsoft Edge (borrador sin adjuntos)").pack(anchor="w")
    destinatario = tk.StringVar()
    numero = tk.StringVar()
    proveedor = tk.StringVar(value="gmail")
    ttk.Entry(contenedor, textvariable=destinatario).pack(fill="x", pady=4)
    ttk.Entry(contenedor, textvariable=numero).pack(fill="x", pady=4)
    ttk.Combobox(contenedor, textvariable=proveedor, values=["gmail", "outlook"], state="readonly").pack(anchor="w", pady=4)

    def abrir():
        try:
            abrir_correo_edge(destinatario.get().strip(), numero.get().strip(), proveedor.get())
        except Exception as exc:
            messagebox.showerror("No se pudo abrir Edge", str(exc))

    ttk.Button(contenedor, text="Abrir borrador de correo", command=abrir).pack(anchor="w", pady=6)
    ttk.Label(contenedor, text="Escribe correo del cliente y número 002-001-000000398. Adjunta PDF y XML manualmente.").pack(anchor="w")
    raiz.mainloop()


if __name__ == "__main__":
    main()
