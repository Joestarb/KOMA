import sqlite3
import os
from datetime import datetime

DB_NAME = 'koma.db'

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn

def db_init():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Products table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            description TEXT,
            is_active INTEGER DEFAULT 1
        )
    ''')
    
    # 2. Orders table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            diners INTEGER NOT NULL,
            notes TEXT,
            status TEXT NOT NULL, -- pending, served, completed, cancelled
            total REAL NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ''')
    
    # 3. Order Items table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id TEXT NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            notes TEXT,
            FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
        )
    ''')
    
    # 4. Transactions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL, -- income / outcome
            category TEXT NOT NULL, -- venta, insumos, servicios, personal, caja_inicial, otros
            amount REAL NOT NULL,
            description TEXT,
            timestamp TEXT NOT NULL,
            order_id INTEGER DEFAULT NULL,
            FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL
        )
    ''')
    
    # Check if products table is empty and insert seed products
    cursor.execute("SELECT COUNT(*) FROM products WHERE is_active = 1")
    if cursor.fetchone()[0] == 0:
        seed_products = [
            ('h1', 'Hamburguesa Koma', 'food', 12.50, 'Doble res, cheddar, salsa especial.'),
            ('h2', 'Pizza Neon', 'food', 14.00, 'Mozzarella, pepperoni, miel y jalapeños.'),
            ('h3', 'Papas Trufadas', 'food', 6.50, 'Papas fritas con aceite de trufa y parmesano.'),
            ('h4', 'Tacos al Pastor', 'food', 9.00, '3 unidades con piña, cilantro y cebolla.'),
            ('d1', 'Mojito Eléctrico', 'drink', 8.50, 'Ron, menta, limón, soda y curaçao azul.'),
            ('d2', 'Cerveza IPA', 'drink', 5.50, 'Cerveza artesanal de lúpulo intenso.'),
            ('d3', 'Gin Tonic Botánico', 'drink', 9.50, 'Ginebra, tónica, bayas de enebro y pepino.'),
            ('d4', 'Soda de Maracuyá', 'drink', 4.00, 'Zumo de maracuyá y agua con gas.'),
            ('p1', 'Volcán de Chocolate', 'dessert', 7.00, 'Relleno fundido con helado de vainilla.'),
            ('p2', 'Cheesecake Pistacho', 'dessert', 7.50, 'Crema sedosa con pistacho tostado.')
        ]
        cursor.executemany(
            "INSERT INTO products (id, name, category, price, description, is_active) VALUES (?, ?, ?, ?, ?, 1)",
            seed_products
        )
        
    conn.commit()
    conn.close()

def get_products():
    conn = get_db_connection()
    products = conn.execute("SELECT * FROM products WHERE is_active = 1 ORDER BY category, name").fetchall()
    conn.close()
    return [dict(p) for p in products]

def save_product(prod_id, name, category, price, description):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if product exists (active or inactive)
    existing = cursor.execute("SELECT * FROM products WHERE id = ?", (prod_id,)).fetchone()
    
    if existing:
        cursor.execute(
            "UPDATE products SET name = ?, category = ?, price = ?, description = ?, is_active = 1 WHERE id = ?",
            (name, category, float(price), description, prod_id)
        )
    else:
        cursor.execute(
            "INSERT INTO products (id, name, category, price, description, is_active) VALUES (?, ?, ?, ?, ?, 1)",
            (prod_id, name, category, float(price), description)
        )
        
    conn.commit()
    conn.close()
    return True

def delete_product(prod_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET is_active = 0 WHERE id = ?", (prod_id,))
    conn.commit()
    conn.close()
    return True

def get_orders(status_filter=None):
    conn = get_db_connection()
    if status_filter == 'active':
        orders = conn.execute(
            "SELECT * FROM orders WHERE status IN ('pending', 'served') ORDER BY id DESC"
        ).fetchall()
    elif status_filter in ['pending', 'served', 'completed', 'cancelled']:
        orders = conn.execute(
            "SELECT * FROM orders WHERE status = ? ORDER BY id DESC", (status_filter,)
        ).fetchall()
    else:
        orders = conn.execute("SELECT * FROM orders ORDER BY id DESC").fetchall()
        
    result = []
    for order in orders:
        order_id = order['id']
        items = conn.execute(
            "SELECT * FROM order_items WHERE order_id = ?", (order_id,)
        ).fetchall()
        order_dict = dict(order)
        order_dict['items'] = [dict(i) for i in items]
        result.append(order_dict)
        
    conn.close()
    return result

def create_order(table_name, diners, notes, items):
    total = sum(float(i.get('price', 0)) * int(i.get('quantity', 1)) for i in items)
    conn = get_db_connection()
    cursor = conn.cursor()
    
    now = datetime.now().isoformat()
    cursor.execute(
        "INSERT INTO orders (table_name, diners, notes, status, total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (table_name, int(diners), notes, 'pending', total, now, now)
    )
    order_id = cursor.lastrowid
    
    for item in items:
        cursor.execute(
            "INSERT INTO order_items (order_id, product_id, name, category, price, quantity, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (order_id, item.get('id', 'custom'), item.get('name'), item.get('category'), float(item.get('price', 0)), int(item.get('quantity', 1)), item.get('notes', ''))
        )
        
    conn.commit()
    conn.close()
    return order_id

def update_order_status(order_id, new_status):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    order = cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not order:
        conn.close()
        return False, "Orden no encontrada"
        
    now = datetime.now().isoformat()
    cursor.execute(
        "UPDATE orders SET status = ?, updated_at = ? WHERE id = ?",
        (new_status, now, order_id)
    )
    
    # If completed, create cash income transaction automatically
    if new_status == 'completed':
        cursor.execute(
            "INSERT INTO transactions (type, category, amount, description, timestamp, order_id) VALUES (?, ?, ?, ?, ?, ?)",
            ('income', 'venta', order['total'], f"Venta Mesa {order['table_name']} (Orden #{order_id})", now, order_id)
        )
        
    conn.commit()
    conn.close()
    return True, None

def get_transactions(date_from=None, date_to=None, type_filter=None, cat_filter=None):
    conn = get_db_connection()
    sql = "SELECT * FROM transactions WHERE 1=1"
    params = []
    
    if date_from:
        sql += " AND DATE(timestamp) >= ?"
        params.append(date_from)
    if date_to:
        sql += " AND DATE(timestamp) <= ?"
        params.append(date_to)
    if type_filter and type_filter in ['income', 'outcome']:
        sql += " AND type = ?"
        params.append(type_filter)
    if cat_filter:
        sql += " AND category = ?"
        params.append(cat_filter)
        
    sql += " ORDER BY timestamp DESC, id DESC"
    txs = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(t) for t in txs]

def create_transaction(tx_type, category, amount, description):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        "INSERT INTO transactions (type, category, amount, description, timestamp) VALUES (?, ?, ?, ?, ?)",
        (tx_type, category, float(amount), description, now)
    )
    conn.commit()
    conn.close()
    return True

def get_stats(date_from=None, date_to=None):
    conn = get_db_connection()
    
    date_clause_tx = ""
    date_clause_orders = ""
    params_tx = []
    params_orders = []
    
    if date_from:
        date_clause_tx += " AND DATE(timestamp) >= ?"
        date_clause_orders += " AND DATE(created_at) >= ?"
        params_tx.append(date_from)
        params_orders.append(date_from)
    if date_to:
        date_clause_tx += " AND DATE(timestamp) <= ?"
        date_clause_orders += " AND DATE(created_at) <= ?"
        params_tx.append(date_to)
        params_orders.append(date_to)
    
    # totals
    total_incomes = conn.execute(
        f"SELECT SUM(amount) FROM transactions WHERE type = 'income'{date_clause_tx}", params_tx
    ).fetchone()[0] or 0.0
    total_outcomes = conn.execute(
        f"SELECT SUM(amount) FROM transactions WHERE type = 'outcome'{date_clause_tx}", params_tx
    ).fetchone()[0] or 0.0
    
    # counts
    pending_count = conn.execute(
        f"SELECT COUNT(*) FROM orders WHERE status = 'pending'{date_clause_orders}", params_orders
    ).fetchone()[0] or 0
    served_count = conn.execute(
        f"SELECT COUNT(*) FROM orders WHERE status = 'served'{date_clause_orders}", params_orders
    ).fetchone()[0] or 0
    completed_count = conn.execute(
        f"SELECT COUNT(*) FROM orders WHERE status = 'completed'{date_clause_orders}", params_orders
    ).fetchone()[0] or 0
    cancelled_count = conn.execute(
        f"SELECT COUNT(*) FROM orders WHERE status = 'cancelled'{date_clause_orders}", params_orders
    ).fetchone()[0] or 0
    
    # order sales total
    total_sales = conn.execute(
        f"SELECT SUM(total) FROM orders WHERE status = 'completed'{date_clause_orders}", params_orders
    ).fetchone()[0] or 0.0
    
    # average ticket
    avg_ticket = conn.execute(
        f"SELECT AVG(total) FROM orders WHERE status = 'completed'{date_clause_orders}", params_orders
    ).fetchone()[0] or 0.0
    
    # sales by category
    sales_by_cat = conn.execute(f'''
        SELECT oi.category, SUM(oi.price * oi.quantity) as value
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status = 'completed'{date_clause_orders}
        GROUP BY oi.category
    ''', params_orders).fetchall()
    
    # expenses by category
    expenses_by_cat = conn.execute(f'''
        SELECT category, SUM(amount) as value
        FROM transactions
        WHERE type = 'outcome'{date_clause_tx}
        GROUP BY category
    ''', params_tx).fetchall()
    
    # daily stats
    daily_stats = conn.execute(f'''
        SELECT DATE(timestamp) as date, 
               SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
               SUM(CASE WHEN type = 'outcome' THEN amount ELSE 0 END) as outcome
        FROM transactions
        WHERE 1=1{date_clause_tx}
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
        LIMIT 30
    ''', params_tx).fetchall()
    
    # top selling products
    top_products = conn.execute(f'''
        SELECT oi.name, SUM(oi.quantity) as qty, SUM(oi.price * oi.quantity) as revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status = 'completed'{date_clause_orders}
        GROUP BY oi.name
        ORDER BY qty DESC
        LIMIT 10
    ''', params_orders).fetchall()
    
    conn.close()
    
    return {
        "balance": total_incomes - total_outcomes,
        "total_incomes": total_incomes,
        "total_outcomes": total_outcomes,
        "total_sales": total_sales,
        "avg_ticket": avg_ticket,
        "counts": {
            "pending": pending_count,
            "served": served_count,
            "completed": completed_count,
            "cancelled": cancelled_count
        },
        "sales_by_category": {r['category']: r['value'] for r in sales_by_cat},
        "expenses_by_category": {r['category']: r['value'] for r in expenses_by_cat},
        "daily_stats": [dict(d) for d in reversed(daily_stats)],
        "top_products": [dict(p) for p in top_products]
    }

def get_detailed_report(date_from, date_to):
    conn = get_db_connection()
    
    txs = conn.execute(
        "SELECT * FROM transactions WHERE DATE(timestamp) >= ? AND DATE(timestamp) <= ? ORDER BY timestamp ASC",
        (date_from, date_to)
    ).fetchall()
    
    orders_completed = conn.execute(
        "SELECT * FROM orders WHERE status = 'completed' AND DATE(created_at) >= ? AND DATE(created_at) <= ? ORDER BY created_at ASC",
        (date_from, date_to)
    ).fetchall()
    
    orders_detail = []
    for o in orders_completed:
        items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (o['id'],)).fetchall()
        od = dict(o)
        od['items'] = [dict(i) for i in items]
        orders_detail.append(od)
    
    total_income = sum(t['amount'] for t in txs if t['type'] == 'income')
    total_outcome = sum(t['amount'] for t in txs if t['type'] == 'outcome')
    
    inc_by_cat = {}
    out_by_cat = {}
    for t in txs:
        if t['type'] == 'income':
            inc_by_cat[t['category']] = inc_by_cat.get(t['category'], 0) + t['amount']
        else:
            out_by_cat[t['category']] = out_by_cat.get(t['category'], 0) + t['amount']
    
    prod_stats = {}
    for o in orders_detail:
        for item in o['items']:
            name = item['name']
            if name not in prod_stats:
                prod_stats[name] = {'quantity': 0, 'revenue': 0}
            prod_stats[name]['quantity'] += item['quantity']
            prod_stats[name]['revenue'] += item['price'] * item['quantity']
    
    top_products_list = sorted(prod_stats.items(), key=lambda x: x[1]['revenue'], reverse=True)
    
    daily = {}
    for t in txs:
        d = t['timestamp'][:10]
        if d not in daily:
            daily[d] = {'income': 0, 'outcome': 0, 'orders': 0}
        if t['type'] == 'income':
            daily[d]['income'] += t['amount']
        else:
            daily[d]['outcome'] += t['amount']
    
    for o in orders_completed:
        d = o['created_at'][:10]
        if d not in daily:
            daily[d] = {'income': 0, 'outcome': 0, 'orders': 0}
        daily[d]['orders'] += 1
    
    daily_list = [{'date': k, **v} for k, v in sorted(daily.items())]
    
    conn.close()
    
    return {
        "period": {"from": date_from, "to": date_to},
        "summary": {
            "total_income": total_income,
            "total_outcome": total_outcome,
            "balance": total_income - total_outcome,
            "total_orders": len(orders_completed),
            "avg_ticket": total_income / len(orders_completed) if orders_completed else 0,
            "total_transactions": len(txs)
        },
        "income_by_category": inc_by_cat,
        "outcome_by_category": out_by_cat,
        "top_products": [{'name': k, 'quantity': v['quantity'], 'revenue': v['revenue']} for k, v in top_products_list[:15]],
        "daily_breakdown": daily_list,
        "transactions": [dict(t) for t in txs],
        "orders": orders_detail
    }

def reset_db():
    if os.path.exists(DB_NAME):
        os.remove(DB_NAME)
    db_init()
    return True
