#!/usr/bin/env python3
"""
StockSense - Lightweight Backend Server with SQLite
Provides RESTful API and static file hosting for the hackathon demo.
Zero external dependencies required (uses built-in Python 3 standard library).
"""

import sys
import os
import json
import sqlite3
import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.parse

PORT = 8000
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stocksense.db')
WEB_DIR = os.path.dirname(os.path.abspath(__file__))

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    
    # Products table
    c.execute('''
    CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        price REAL NOT NULL DEFAULT 0.0,
        warehouse TEXT NOT NULL,
        min_threshold INTEGER NOT NULL DEFAULT 10,
        location TEXT,
        unit TEXT DEFAULT 'Units',
        description TEXT,
        updated_at TEXT
    )
    ''')

    # Transactions audit table
    c.execute('''
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        product_id TEXT,
        product_name TEXT,
        sku TEXT,
        type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        source_warehouse TEXT,
        target_warehouse TEXT,
        reference TEXT,
        operator TEXT,
        notes TEXT,
        timestamp TEXT NOT NULL
    )
    ''')

    # Seed if empty
    c.execute('SELECT COUNT(*) FROM products')
    count = c.fetchone()[0]
    if count == 0:
        seed_data(c)
        conn.commit()
    conn.close()

def seed_data(cursor):
    sample_products = [
        ('prod-001', 'Industrial Rugged Barcode Scanner 2D', 'ELEC-SCN-201', 'Electronics & Hardware', 45, 349.99, 'Warehouse Alpha (Central Hub - Chicago)', 15, 'Aisle A-03, Bin 12', 'Units', 'IP65 drop-resistant wireless barcode scanner with Bluetooth cradle and high-speed CMOS sensor.', '2026-09-26T05:30:00Z'),
        ('prod-002', 'N95 Particulate Respirator Mask (Box 50)', 'PPE-MSK-092', 'PPE & Safety Gear', 8, 42.50, 'Warehouse Alpha (Central Hub - Chicago)', 25, 'Aisle B-01, Bin 04', 'Boxes', 'NIOSH certified N95 particle filter respirator with adjustable nose clip.', '2026-09-26T01:30:00Z'),
        ('prod-003', 'Thermal Transfer Shipping Labels 4x6" (Roll of 1000)', 'PKG-LBL-406', 'Packaging & Shipping', 0, 18.75, 'Warehouse Charlie (East Port Logistics - NJ)', 30, 'Aisle C-04, Bin 18', 'Rolls', 'Standard fanfold 4x6 direct thermal commercial shipping labels. Out of stock - reorder urgent.', '2026-09-25T09:30:00Z'),
        ('prod-004', 'Hydraulic Hand Pallet Jack 5,500 lbs Capacity', 'MCH-PLT-550', 'Heavy Machinery & Tools', 14, 489.00, 'Warehouse Delta (Southern Gateway - Dallas)', 5, 'Zone D-Floor, Staging 2', 'Units', 'Heavy gauge steel hydraulic pallet truck with polyurethane steer wheels and overload valve.', '2026-09-25T21:30:00Z'),
        ('prod-005', 'Lithium-Ion Forklift Battery Pack 48V 600Ah', 'ELEC-BAT-48V', 'Electronics & Hardware', 3, 4200.00, 'Warehouse Bravo (West Coast Depot - Seattle)', 6, 'Zone H-Hazmat, Bay 01', 'Units', 'High density fast-charge industrial lithium battery pack with integrated CAN-bus BMS.', '2026-09-25T15:30:00Z'),
        ('prod-006', 'High-Visibility Class 2 Reflective Safety Vests', 'PPE-VST-101', 'PPE & Safety Gear', 85, 14.20, 'Warehouse Alpha (Central Hub - Chicago)', 20, 'Aisle B-02, Bin 09', 'Units', 'ANSI/ISEA compliant breathable neon yellow reflective vest with multiple gear pockets.', '2026-09-26T07:30:00Z'),
        ('prod-007', 'Cat6 Pure Copper Bulk Cable Reel 1,000 ft', 'IT-CAT6-100', 'Office & IT Equipment', 6, 175.50, 'Warehouse Bravo (West Coast Depot - Seattle)', 15, 'Aisle E-01, Shelf 3', 'Rolls', 'Solid pure bare copper 550MHz UTP plenum rated Ethernet communication cable.', '2026-09-25T03:30:00Z'),
        ('prod-008', 'Heavy Duty Stretch Wrap Film 18" x 1500ft', 'PKG-STW-180', 'Packaging & Shipping', 110, 26.80, 'Warehouse Charlie (East Port Logistics - NJ)', 40, 'Aisle C-01, Pallet 05', 'Rolls', '80-gauge cast industrial hand stretch wrap with superior puncture resistance.', '2026-09-26T03:30:00Z'),
        ('prod-009', 'ANSI Hard Hats with Ratchet Suspension', 'PPE-HAT-305', 'PPE & Safety Gear', 62, 22.90, 'Warehouse Delta (Southern Gateway - Dallas)', 20, 'Aisle B-03, Bin 11', 'Units', 'High-density polyethylene shell impact hard hat with 6-point suspension system.', '2026-09-25T19:30:00Z'),
        ('prod-010', 'Industrial First Aid & Burn Trauma Station', 'MED-FAS-050', 'Medical & First Aid', 18, 129.00, 'Warehouse Alpha (Central Hub - Chicago)', 10, 'Aisle F-01, Wall 02', 'Kits', 'OSHA 1910 and ANSI compliant 4-shelf wall mounted emergency medical station.', '2026-09-24T09:30:00Z'),
        ('prod-011', 'Corrugated Double-Wall Shipping Cartons 24x18x18"', 'PKG-BOX-241', 'Packaging & Shipping', 320, 4.85, 'Warehouse Charlie (East Port Logistics - NJ)', 100, 'Zone C-Staging, Rack 12', 'Units', 'ECT-48 heavy-duty corrugated cardboard shipping boxes for parcel dispatch.', '2026-09-26T04:30:00Z'),
        ('prod-012', 'Cordless Brushless Impact Driver Kit 20V', 'MCH-IMP-20V', 'Heavy Machinery & Tools', 22, 199.95, 'Warehouse Delta (Southern Gateway - Dallas)', 8, 'Aisle D-02, Shelf 04', 'Kits', 'Compact high-torque 2050 in-lbs impact driver with two 4Ah batteries and rapid charger.', '2026-09-26T00:30:00Z'),
        ('prod-013', 'Hydraulic Cylinder Seal Repair Kit Series-X', 'MCH-SLK-009', 'Heavy Machinery & Tools', 5, 88.00, 'Warehouse Bravo (West Coast Depot - Seattle)', 15, 'Aisle D-04, Bin 02', 'Kits', 'Complete nitrile and polyurethane sealing kit for industrial forklift lift cylinders.', '2026-09-25T13:30:00Z'),
        ('prod-014', 'Enterprise Wi-Fi 6 Industrial Access Point', 'IT-WAP-600', 'Office & IT Equipment', 19, 520.00, 'Warehouse Alpha (Central Hub - Chicago)', 8, 'Aisle E-02, Shelf 01', 'Units', 'Ruggedized IP67 weatherproof 4x4 MU-MIMO dual-band wireless gateway with PoE+ support.', '2026-09-26T02:30:00Z'),
        ('prod-015', 'Nitrile Heavy-Duty Disposable Gloves 6mil (Box 100)', 'PPE-GLV-006', 'PPE & Safety Gear', 145, 16.50, 'Warehouse Bravo (West Coast Depot - Seattle)', 50, 'Aisle B-04, Bin 19', 'Boxes', 'Powder-free chemical resistant textured grip black nitrile examination gloves.', '2026-09-26T06:30:00Z'),
        ('prod-016', 'Waterproof Digital Inventory Scale 600 lbs', 'ELEC-SCL-600', 'Electronics & Hardware', 9, 360.00, 'Warehouse Delta (Southern Gateway - Dallas)', 4, 'Zone D-Bench, Bay 03', 'Units', 'Stainless steel washdown platform scale with backlit LCD and RS232 serial printer output.', '2026-09-25T17:30:00Z')
    ]
    cursor.executemany('''
    INSERT OR REPLACE INTO products (id, name, sku, category, quantity, price, warehouse, min_threshold, location, unit, description, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', sample_products)

    sample_txs = [
        ('tx-1001', 'prod-001', 'Industrial Rugged Barcode Scanner 2D', 'ELEC-SCN-201', 'STOCK_IN', 25, 45, '', 'Warehouse Alpha (Central Hub - Chicago)', 'PO-2026-8891', 'Sarah Jenkins (Logistics Mgr)', 'Received initial shipment from Honeywell OEM supplier.', '2026-09-26T05:30:00Z'),
        ('tx-1002', 'prod-008', 'Heavy Duty Stretch Wrap Film 18" x 1500ft', 'PKG-STW-180', 'STOCK_OUT', 30, 110, 'Warehouse Charlie (East Port Logistics - NJ)', '', 'DISP-7721', 'Marcus Vance (Warehouse Staff)', 'Dispatched to outbound fulfillment bays 3 & 4.', '2026-09-26T03:30:00Z'),
        ('tx-1003', 'prod-005', 'Lithium-Ion Forklift Battery Pack 48V 600Ah', 'ELEC-BAT-48V', 'TRANSFER', 2, 3, 'Warehouse Alpha (Central Hub - Chicago)', 'Warehouse Bravo (West Coast Depot - Seattle)', 'XFER-00941', 'Elena Rostova (Fleet Specialist)', 'Inter-facility transfer to replenish West Coast fleet maintenance.', '2026-09-25T15:30:00Z'),
        ('tx-1004', 'prod-002', 'N95 Particulate Respirator Mask (Box 50)', 'PPE-MSK-092', 'STOCK_OUT', 15, 8, 'Warehouse Alpha (Central Hub - Chicago)', '', 'SO-99231', 'David Kim (Inventory Clerk)', 'Safety distribution to Regional Plant #4.', '2026-09-26T01:30:00Z'),
        ('tx-1005', 'prod-003', 'Thermal Transfer Shipping Labels 4x6" (Roll of 1000)', 'PKG-LBL-406', 'STOCK_OUT', 40, 0, 'Warehouse Charlie (East Port Logistics - NJ)', '', 'DISP-7750', 'Marcus Vance (Warehouse Staff)', 'High-volume seasonal dispatch consumed entire reserve.', '2026-09-25T09:30:00Z'),
        ('tx-1006', 'prod-011', 'Corrugated Double-Wall Shipping Cartons 24x18x18"', 'PKG-BOX-241', 'STOCK_IN', 200, 320, '', 'Warehouse Charlie (East Port Logistics - NJ)', 'PO-2026-9042', 'Sarah Jenkins (Logistics Mgr)', 'Bulk pallet delivery from International Paper packaging.', '2026-09-26T04:30:00Z'),
        ('tx-1007', 'prod-006', 'High-Visibility Class 2 Reflective Safety Vests', 'PPE-VST-101', 'TRANSFER', 20, 85, 'Warehouse Delta (Southern Gateway - Dallas)', 'Warehouse Alpha (Central Hub - Chicago)', 'XFER-00948', 'Alex Rivera (Dock Lead)', 'Seasonal staff onboarding reallocation to Central hub.', '2026-09-26T07:30:00Z')
    ]
    cursor.executemany('''
    INSERT OR REPLACE INTO transactions (id, product_id, product_name, sku, type, quantity, balance_after, source_warehouse, target_warehouse, reference, operator, notes, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', sample_txs)

class StockSenseHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        content_len = int(self.headers.get('Content-Length', 0))
        if content_len == 0:
            return {}
        raw = self.rfile.read(content_len).decode('utf-8')
        return json.loads(raw)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/'):
            self.handle_api_get(path, urllib.parse.parse_qs(parsed.query))
        else:
            super().do_GET()

    def handle_api_get(self, path, query_params):
        conn = get_db()
        c = conn.cursor()

        if path == '/api/products':
            c.execute('SELECT * FROM products ORDER BY name ASC')
            rows = [dict(r) for r in c.fetchall()]
            # Map column names for frontend compatibility
            for r in rows:
                r['minThreshold'] = r.pop('min_threshold')
                r['updatedAt'] = r.pop('updated_at')
            conn.close()
            self.send_json(rows)
            return

        elif path.startswith('/api/products/'):
            prod_id = path.split('/')[-1]
            c.execute('SELECT * FROM products WHERE id = ?', (prod_id,))
            row = c.fetchone()
            conn.close()
            if row:
                d = dict(row)
                d['minThreshold'] = d.pop('min_threshold')
                d['updatedAt'] = d.pop('updated_at')
                self.send_json(d)
            else:
                self.send_json({'error': 'Product not found'}, status=404)
            return

        elif path == '/api/transactions':
            c.execute('SELECT * FROM transactions ORDER BY timestamp DESC')
            rows = [dict(r) for r in c.fetchall()]
            for r in rows:
                r['productId'] = r.pop('product_id')
                r['productName'] = r.pop('product_name')
                r['balanceAfter'] = r.pop('balance_after')
                r['sourceWarehouse'] = r.pop('source_warehouse')
                r['targetWarehouse'] = r.pop('target_warehouse')
            conn.close()
            self.send_json(rows)
            return

        elif path == '/api/dashboard':
            c.execute('SELECT COUNT(*), SUM(quantity), SUM(quantity * price) FROM products')
            total_prods, total_stock, total_val = c.fetchone()
            
            c.execute('SELECT COUNT(*) FROM products WHERE quantity <= min_threshold AND quantity > 0')
            low_stock = c.fetchone()[0]

            c.execute('SELECT COUNT(*) FROM products WHERE quantity = 0')
            out_of_stock = c.fetchone()[0]

            c.execute('SELECT warehouse, COUNT(*), SUM(quantity) FROM products GROUP BY warehouse')
            wh_breakdown = [{'warehouse': r[0], 'productCount': r[1], 'stockUnits': r[2] or 0} for r in c.fetchall()]

            c.execute('SELECT category, COUNT(*), SUM(quantity * price) FROM products GROUP BY category')
            cat_breakdown = [{'category': r[0], 'count': r[1], 'value': round(r[2] or 0, 2)} for r in c.fetchall()]

            conn.close()
            self.send_json({
                'totalProducts': total_prods or 0,
                'totalStock': total_stock or 0,
                'totalValuation': round(total_val or 0.0, 2),
                'lowStockItems': low_stock or 0,
                'outOfStockItems': out_of_stock or 0,
                'warehouseBreakdown': wh_breakdown,
                'categoryBreakdown': cat_breakdown
            })
            return

        conn.close()
        self.send_json({'error': 'Endpoint not found'}, status=404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if not path.startswith('/api/'):
            self.send_json({'error': 'Invalid endpoint'}, status=404)
            return

        try:
            body = self.read_json_body()
        except Exception as e:
            self.send_json({'error': f'Invalid JSON payload: {str(e)}'}, status=400)
            return

        conn = get_db()
        c = conn.cursor()

        if path == '/api/products':
            try:
                prod_id = body.get('id') or ('prod-' + hex(int(datetime.datetime.now().timestamp() * 1000))[2:])
                now = datetime.datetime.utcnow().isoformat() + 'Z'
                c.execute('''
                INSERT INTO products (id, name, sku, category, quantity, price, warehouse, min_threshold, location, unit, description, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    prod_id,
                    body['name'].strip(),
                    body['sku'].strip().upper(),
                    body.get('category', 'General'),
                    int(body.get('quantity', 0)),
                    float(body.get('price', 0.0)),
                    body.get('warehouse', 'Warehouse Alpha (Central Hub - Chicago)'),
                    int(body.get('minThreshold', 10)),
                    body.get('location', 'General Floor'),
                    body.get('unit', 'Units'),
                    body.get('description', ''),
                    now
                ))
                conn.commit()

                # Return created product
                c.execute('SELECT * FROM products WHERE id = ?', (prod_id,))
                created = dict(c.fetchone())
                created['minThreshold'] = created.pop('min_threshold')
                created['updatedAt'] = created.pop('updated_at')
                conn.close()
                self.send_json(created, status=201)
                return
            except sqlite3.IntegrityError as ie:
                conn.close()
                self.send_json({'error': f'SKU already exists: {str(ie)}'}, status=409)
                return
            except Exception as ex:
                conn.close()
                self.send_json({'error': str(ex)}, status=500)
                return

        elif path == '/api/reset-data':
            c.execute('DELETE FROM products')
            c.execute('DELETE FROM transactions')
            seed_data(c)
            conn.commit()
            conn.close()
            self.send_json({'success': True, 'message': 'Database re-seeded with demo data.'})
            return

        conn.close()
        self.send_json({'error': 'Endpoint not found'}, status=404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/products/'):
            prod_id = path.split('/')[-1]
            try:
                body = self.read_json_body()
                conn = get_db()
                c = conn.cursor()
                now = datetime.datetime.utcnow().isoformat() + 'Z'
                c.execute('''
                UPDATE products SET
                    name = ?,
                    sku = ?,
                    category = ?,
                    price = ?,
                    warehouse = ?,
                    min_threshold = ?,
                    location = ?,
                    unit = ?,
                    description = ?,
                    updated_at = ?
                WHERE id = ?
                ''', (
                    body['name'].strip(),
                    body['sku'].strip().upper(),
                    body.get('category', 'General'),
                    float(body.get('price', 0.0)),
                    body.get('warehouse', ''),
                    int(body.get('minThreshold', 10)),
                    body.get('location', ''),
                    body.get('unit', 'Units'),
                    body.get('description', ''),
                    now,
                    prod_id
                ))
                conn.commit()
                c.execute('SELECT * FROM products WHERE id = ?', (prod_id,))
                updated = dict(c.fetchone())
                updated['minThreshold'] = updated.pop('min_threshold')
                updated['updatedAt'] = updated.pop('updated_at')
                conn.close()
                self.send_json(updated)
                return
            except Exception as ex:
                self.send_json({'error': str(ex)}, status=500)
                return

        self.send_json({'error': 'Endpoint not found'}, status=404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/products/'):
            prod_id = path.split('/')[-1]
            conn = get_db()
            c = conn.cursor()
            c.execute('DELETE FROM products WHERE id = ?', (prod_id,))
            conn.commit()
            conn.close()
            self.send_json({'success': True, 'deletedId': prod_id})
            return

        self.send_json({'error': 'Endpoint not found'}, status=404)

def run():
    init_db()
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, StockSenseHandler)
    print(f"=======================================================")
    print(f"  StockSense Inventory Management Server is Live!     ")
    print(f"  URL: http://localhost:{PORT}                         ")
    print(f"  REST API: http://localhost:{PORT}/api/products       ")
    print(f"  Database: {DB_FILE}                                  ")
    print(f"=======================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping StockSense server...")
        httpd.server_close()
        sys.exit(0)

if __name__ == '__main__':
    run()
