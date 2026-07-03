#!/usr/bin/env python3
import http.server
import socketserver
import json
import os
import urllib.parse
from datetime import datetime

PORT = 3000
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), 'public')

PRINTER_KITCHEN = '/dev/usb/lp0'
PRINTER_BAR = '/dev/usb/lp1'

def generate_escpos_buffer(order, items, destination_name):
    # Generar secuencia de comandos en bytes ESC/POS
    ESC = b'\x1b'
    GS = b'\x1d'
    
    chunks = []
    # 1. Inicializar (ESC @)
    chunks.append(ESC + b'@')
    # 2. Alinear al centro (ESC a 1)
    chunks.append(ESC + b'a\x01')
    # 3. Tamaño doble para el título del área (GS ! 17)
    chunks.append(GS + b'!\x11')
    chunks.append(f"*** {destination_name.upper()} ***\n\n".encode('latin-1'))
    # 4. Tamaño normal (GS ! 0)
    chunks.append(GS + b'!\x00')
    # 5. Mesa y número de orden
    chunks.append(f"MESA: {order['table'].upper()} | ORDEN: #{order['id']}\n".encode('latin-1'))
    # Hora
    time_str = datetime.now().strftime('%H:%M:%S')
    chunks.append(f"Hora: {time_str}\n".encode('latin-1'))
    chunks.append(b"================================\n")
    # 6. Alinear a la izquierda (ESC a 0)
    chunks.append(ESC + b'a\x00')
    # 7. Ítems
    for item in items:
        qty_str = f"{item['quantity']}x".ljust(4)
        chunks.append(f"{qty_str}{item['name']}\n".encode('latin-1'))
        if item.get('notes'):
            chunks.append(f"   * Nota: {item['notes']}\n".encode('latin-1'))
            
    chunks.append(b"================================\n")
    # 8. Notas generales de la orden
    if order.get('notes'):
        chunks.append(f"NOTAS GENERALES:\n{order['notes']}\n".encode('latin-1'))
        chunks.append(b"================================\n")
        
    # 9. Pie de ticket centrado
    chunks.append(ESC + b'a\x01')
    chunks.append(b"KOMA - SISTEMA DE COMANDAS\n\n\n")
    
    # 10. Alimentar papel y cortar (ESC d 4 + GS V 66 0)
    chunks.append(ESC + b'd\x04')
    chunks.append(GS + b'V\x42\x00')
    
    return b"".join(chunks)

class KomaHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Servir archivos desde PUBLIC_DIR en lugar de la carpeta de ejecución
        parsed = urllib.parse.urlparse(path)
        path = parsed.path
        if path == '/':
            path = '/index.html'
        
        # Evitar vulnerabilidad de path traversal
        clean_path = path.lstrip('/')
        return os.path.join(PUBLIC_DIR, clean_path)

    def do_GET(self):
        if self.path == '/api/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            kitchen_exists = os.path.exists(PRINTER_KITCHEN)
            bar_exists = os.path.exists(PRINTER_BAR)
            
            kitchen_writable = False
            bar_writable = False
            
            if kitchen_exists:
                kitchen_writable = os.access(PRINTER_KITCHEN, os.W_OK)
            if bar_exists:
                bar_writable = os.access(PRINTER_BAR, os.W_OK)
                
            status_data = {
                "kitchen": {
                    "device": PRINTER_KITCHEN,
                    "connected": kitchen_exists,
                    "writable": kitchen_writable
                },
                "bar": {
                    "device": PRINTER_BAR,
                    "connected": bar_exists,
                    "writable": bar_writable
                }
            }
            self.wfile.write(json.dumps(status_data).encode('utf-8'))
        else:
            # Comportamiento normal de servidor estático
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/print':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                order = data.get('order')
                items = data.get('items', [])
                target = data.get('target', 'auto')
                
                if not order or not items:
                    self.send_error_response("Datos de la comanda incompletos.")
                    return
                
                # Filtrar según la categoría
                food_items = [i for i in items if i.get('category') in ['food', 'dessert']]
                drink_items = [i for i in items if i.get('category') == 'drink']
                
                print_jobs = []
                if target == 'auto':
                    if food_items:
                        print_jobs.append({"device": PRINTER_KITCHEN, "name": "Cocina", "items": food_items})
                    if drink_items:
                        print_jobs.append({"device": PRINTER_BAR, "name": "Barra", "items": drink_items})
                elif target == 'cocina':
                    print_jobs.append({"device": PRINTER_KITCHEN, "name": "Cocina (Forzado)", "items": items})
                elif target == 'barra':
                    print_jobs.append({"device": PRINTER_BAR, "name": "Barra (Forzado)", "items": items})
                elif target == 'ambas':
                    print_jobs.append({"device": PRINTER_KITCHEN, "name": "Cocina", "items": items})
                    print_jobs.append({"device": PRINTER_BAR, "name": "Barra", "items": items})
                
                if not print_jobs:
                    self.send_error_response("No hay elementos para enviar a ninguna impresora.")
                    return
                
                results = []
                success_count = 0
                
                for job in print_jobs:
                    device = job["device"]
                    name = job["name"]
                    
                    if not os.path.exists(device):
                        results.append({
                            "printer": name,
                            "device": device,
                            "success": False,
                            "error": f"El puerto {device} no está disponible."
                        })
                        continue
                        
                    try:
                        buffer = generate_escpos_buffer(order, job["items"], name)
                        with open(device, 'wb') as f:
                            f.write(buffer)
                        results.append({
                            "printer": name,
                            "device": device,
                            "success": True
                        })
                        success_count += 1
                    except Exception as e:
                        results.append({
                            "printer": name,
                            "device": device,
                            "success": False,
                            "error": f"Error de acceso/permisos: {str(e)}"
                        })
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                
                response_data = {
                    "success": success_count > 0,
                    "message": "Comanda impresa correctamente." if success_count == len(print_jobs) else "Impresión parcial.",
                    "results": results
                }
                self.wfile.write(json.dumps(response_data).encode('utf-8'))
                
            except Exception as e:
                self.send_error_response(f"Error interno: {str(e)}")
        else:
            self.send_response(404)
            self.end_headers()

    def send_error_response(self, message):
        self.send_response(400)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"success": False, "error": message}).encode('utf-8'))

    def log_message(self, format, *args):
        # Desactivamos los logs ruidosos de solicitudes HTTP en la consola
        return

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), KomaHandler) as httpd:
        print(f"Servidor Koma (Python) iniciado en http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor detenido por el usuario.")
