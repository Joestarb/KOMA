#!/usr/bin/env python3
import http.server
import socketserver
import json
import os
import urllib.parse
from datetime import datetime

import database
import printer_service

PORT = 3000
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), 'public')

class KomaHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Servir archivos desde PUBLIC_DIR
        parsed = urllib.parse.urlparse(path)
        path = parsed.path
        if path == '/':
            path = '/index.html'
        
        clean_path = path.lstrip('/')
        return os.path.join(PUBLIC_DIR, clean_path)

    def do_GET(self):
        url_parsed = urllib.parse.urlparse(self.path)
        path = url_parsed.path
        query = urllib.parse.parse_qs(url_parsed.query)
        
        if path == '/api/status':
            try:
                status_data = printer_service.check_printers_status()
                self.send_json_response(status_data)
            except Exception as e:
                self.send_error_response(f"Error al verificar impresoras: {str(e)}")
            
        elif path == '/api/products':
            try:
                products = database.get_products()
                self.send_json_response(products)
            except Exception as e:
                self.send_error_response(f"Error al obtener productos: {str(e)}")
                
        elif path == '/api/categories':
            try:
                categories = database.get_categories()
                self.send_json_response(categories)
            except Exception as e:
                self.send_error_response(f"Error al obtener categorías: {str(e)}")
                
        elif path == '/api/orders':
            try:
                status_filter = query.get('status', ['all'])[0]
                date_from = query.get('from', [None])[0]
                date_to = query.get('to', [None])[0]
                orders = database.get_orders(status_filter, date_from, date_to)
                self.send_json_response(orders)
            except Exception as e:
                self.send_error_response(f"Error al obtener comandas: {str(e)}")
                
        elif path == '/api/transactions':
            try:
                date_from = query.get('from', [None])[0]
                date_to = query.get('to', [None])[0]
                type_filter = query.get('type', [None])[0]
                cat_filter = query.get('category', [None])[0]
                
                txs = database.get_transactions(date_from, date_to, type_filter, cat_filter)
                self.send_json_response(txs)
            except Exception as e:
                self.send_error_response(f"Error al obtener transacciones: {str(e)}")
                
        elif path == '/api/stats':
            try:
                date_from = query.get('from', [None])[0]
                date_to = query.get('to', [None])[0]
                
                stats = database.get_stats(date_from, date_to)
                self.send_json_response(stats)
            except Exception as e:
                self.send_error_response(f"Error al obtener estadísticas: {str(e)}")
                
        elif path == '/api/reports':
            try:
                date_from = query.get('from', [None])[0]
                date_to = query.get('to', [None])[0]
                
                if not date_from or not date_to:
                    self.send_error_response("Se requieren las fechas 'from' y 'to'.")
                    return
                
                report = database.get_detailed_report(date_from, date_to)
                self.send_json_response(report)
            except Exception as e:
                self.send_error_response(f"Error al generar reporte: {str(e)}")
        else:
            # Servir archivo estático
            super().do_GET()

    def do_POST(self):
        url_parsed = urllib.parse.urlparse(self.path)
        path = url_parsed.path
        
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
        except Exception:
            self.send_error_response("Error leyendo cuerpo de la solicitud")
            return
            
        if path == '/api/print' or path == '/api/orders':
            try:
                data = json.loads(post_data.decode('utf-8'))
                order_info = data.get('order')
                items = data.get('items', [])
                target = data.get('target', 'auto')
                
                if not order_info or not items:
                    self.send_error_response("Datos de la comanda incompletos.")
                    return
                
                table_name = order_info.get('table', 'Mesa')
                diners = int(order_info.get('diners', 1))
                notes = order_info.get('notes', '')
                
                # Crear orden en base de datos
                order_id = database.create_order(table_name, diners, notes, items)
                
                order_info_db = {
                    'id': order_id,
                    'table': table_name,
                    'diners': diners,
                    'notes': notes,
                    'timestamp': datetime.now().isoformat()
                }
                
                # Enviar trabajos de impresión
                print_results, success_count, total_jobs = printer_service.execute_print_jobs(
                    order_info_db, items, target
                )
                
                msg = "Comanda registrada e impresa correctamente."
                if total_jobs > 0 and success_count < total_jobs:
                    msg = "Comanda registrada, error parcial en impresión."
                
                self.send_json_response({
                    "success": True,
                    "order_id": order_id,
                    "message": msg,
                    "results": print_results
                })
            except Exception as e:
                self.send_error_response(f"Error al procesar comanda: {str(e)}")
                
        elif path == '/api/orders/update-status':
            try:
                body = json.loads(post_data.decode('utf-8'))
                order_id = body.get('id')
                new_status = body.get('status')
                
                if not order_id or not new_status:
                    self.send_error_response("Falta ID de orden o nuevo estado")
                    return
                    
                if new_status not in ['pending', 'served', 'completed', 'cancelled']:
                    self.send_error_response("Estado inválido")
                    return
                    
                success, err = database.update_order_status(order_id, new_status)
                if not success:
                    self.send_error_response(err)
                    return
                    
                self.send_json_response({
                    "success": True, 
                    "message": f"Estado de orden #{order_id} cambiado a {new_status}"
                })
            except Exception as e:
                self.send_error_response(f"Error al actualizar orden: {str(e)}")
                
        elif path == '/api/products':
            try:
                p = json.loads(post_data.decode('utf-8'))
                pid = p.get('id')
                name = p.get('name')
                category = p.get('category')
                price = float(p.get('price', 0))
                description = p.get('description', '')
                
                if not name or not category or price < 0:
                    self.send_error_response("Datos de producto inválidos")
                    return
                    
                database.save_product(pid, name, category, price, description)
                self.send_json_response({"success": True, "message": "Producto guardado correctamente"})
            except Exception as e:
                self.send_error_response(f"Error al guardar producto: {str(e)}")
                
        elif path == '/api/products/delete':
            try:
                p = json.loads(post_data.decode('utf-8'))
                pid = p.get('id')
                if not pid:
                    self.send_error_response("Falta ID de producto")
                    return
                database.delete_product(pid)
                self.send_json_response({"success": True, "message": "Producto dado de baja del menú"})
            except Exception as e:
                self.send_error_response(f"Error al eliminar producto: {str(e)}")
                
        elif path == '/api/categories':
            try:
                body = json.loads(post_data.decode('utf-8'))
                cat_id = body.get('id')
                name = body.get('name')
                icon = body.get('icon', '📦')
                
                if not cat_id or not name:
                    self.send_error_response("Datos de categoría inválidos")
                    return
                    
                database.save_category(cat_id, name, icon)
                self.send_json_response({"success": True, "message": "Categoría guardada correctamente"})
            except Exception as e:
                self.send_error_response(f"Error al guardar categoría: {str(e)}")
                
        elif path == '/api/categories/delete':
            try:
                body = json.loads(post_data.decode('utf-8'))
                cat_id = body.get('id')
                if not cat_id:
                    self.send_error_response("Falta ID de categoría")
                    return
                if cat_id == 'otros':
                    self.send_error_response("No se puede eliminar la categoría fallback 'otros'")
                    return
                database.delete_category(cat_id)
                self.send_json_response({"success": True, "message": "Categoría eliminada. Los productos fueron reasignados a 'Otros'"})
            except Exception as e:
                self.send_error_response(f"Error al eliminar categoría: {str(e)}")
                
        elif path == '/api/transactions':
            try:
                body = json.loads(post_data.decode('utf-8'))
                t_type = body.get('type')
                category = body.get('category', 'otros')
                amount = float(body.get('amount', 0))
                description = body.get('description', '')
                
                if t_type not in ['income', 'outcome'] or amount <= 0:
                    self.send_error_response("Tipo de movimiento o monto inválido")
                    return
                    
                database.create_transaction(t_type, category, amount, description)
                self.send_json_response({"success": True, "message": "Movimiento registrado correctamente"})
            except Exception as e:
                self.send_error_response(f"Error al registrar movimiento: {str(e)}")
                
        elif path == '/api/transactions/update':
            try:
                body = json.loads(post_data.decode('utf-8'))
                tx_id = body.get('id')
                amount = float(body.get('amount', 0))
                description = body.get('description', '')
                category = body.get('category', 'otros')
                t_type = body.get('type')
                
                if not tx_id or amount <= 0 or not description or t_type not in ['income', 'outcome']:
                    self.send_error_response("Datos de transacción inválidos")
                    return
                    
                database.update_transaction(tx_id, amount, description, category, t_type)
                self.send_json_response({"success": True, "message": "Transacción modificada correctamente"})
            except Exception as e:
                self.send_error_response(f"Error al modificar transacción: {str(e)}")
                
        elif path == '/api/transactions/delete':
            try:
                body = json.loads(post_data.decode('utf-8'))
                tx_id = body.get('id')
                
                if not tx_id:
                    self.send_error_response("Falta ID de transacción")
                    return
                    
                database.delete_transaction(tx_id)
                self.send_json_response({"success": True, "message": "Transacción eliminada correctamente"})
            except Exception as e:
                self.send_error_response(f"Error al eliminar transacción: {str(e)}")

        elif path == '/api/config/reset':
            try:
                database.reset_db()
                self.send_json_response({"success": True, "message": "Base de datos restablecida"})
            except Exception as e:
                self.send_error_response(f"Error al restablecer base de datos: {str(e)}")
        else:
            self.send_response(404)
            self.end_headers()

    def send_json_response(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def send_error_response(self, message):
        self.send_response(400)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({"success": False, "error": message}).encode('utf-8'))

    def log_message(self, format, *args):
        # Desactivamos los logs ruidosos de solicitudes HTTP en la consola
        return

if __name__ == '__main__':
    database.db_init()
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), KomaHandler) as httpd:
        print(f"Servidor Koma (Python + SQLite) iniciado en http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor detenido por el usuario.")
