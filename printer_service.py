import os
from datetime import datetime

PRINTER_KITCHEN = '/dev/usb/lp0'
PRINTER_BAR = '/dev/usb/lp1'

def check_printers_status():
    kitchen_exists = os.path.exists(PRINTER_KITCHEN)
    bar_exists = os.path.exists(PRINTER_BAR)
    
    kitchen_writable = False
    bar_writable = False
    
    if kitchen_exists:
        kitchen_writable = os.access(PRINTER_KITCHEN, os.W_OK)
    if bar_exists:
        bar_writable = os.access(PRINTER_BAR, os.W_OK)
        
    return {
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

def execute_print_jobs(order_info_db, items, target):
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
            buffer = generate_escpos_buffer(order_info_db, job["items"], name)
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
            
    return results, success_count, len(print_jobs)
