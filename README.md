# 📦 StockSense - Intelligent Enterprise Inventory Management

> **Hackathon Submission**: Modern, responsive, multi-facility inventory tracking and warehouse operations web application.

---

## 🎯 Problem Statement & Target Users

Inventory loss, stockouts, inaccurate counts, and poor inter-facility communication cost warehouses billions annually. **StockSense** bridges the gap between high-level management and ground-floor execution:

1. **👔 Inventory Managers**:
   - High-level financial valuation across facilities.
   - Proactive safety-stock monitoring and automated reorder alerts.
   - Immutable audit trail of every SKU movement.
   - Comprehensive CSV report exports.

2. **👷 Warehouse Floor Staff**:
   - Fast Barcode / SKU scanner simulation.
   - Rapid **Stock In** (Inbound Receiving) and **Stock Out** (Order Fulfillment).
   - Clear Bin / Aisle / Shelf storage tracking.
   - Inter-facility transfer execution with instant stock balancing.

---

## ✨ Key Features & Capabilities

### 1. 📊 Executive Dashboard
- **Real-Time KPIs**: Total active products, on-hand units, gross inventory valuation ($), low-stock warnings, and critical out-of-stock items.
- **Interactive Visualizations (Chart.js)**:
  - *Warehouse Distribution*: Breakdown of stock units by facility.
  - *Category Valuation*: Capital allocated per product vertical.
  - *Stock Health Gauge*: Proportional ratio of healthy vs. depleted inventory.
- **Urgent Action Hub**: One-click restock triggers for depleted items.
- **Live Movement Feed**: Most recent inbound, outbound, and transfer actions.

### 2. 📋 Comprehensive Inventory Catalog
- Real-time instant search across product name, SKU, category, warehouse, and bin location.
- Multi-dimensional filtering by Category, Facility, and Stock Level (Healthy, Low Stock, Out of Stock).
- Clickable column sorting (Ascending / Descending).
- Visual stock health progress bars relative to safety threshold.
- Quick action buttons on every row: Inbound 📥, Outbound 📤, Transfer 🔁, Edit ✏️, Delete 🗑️.

### 3. ➕ Product Catalog Management
- Modal to register new items with:
  - Product Name & Category
  - SKU (with 1-click **Auto-Generate SKU** button)
  - Initial Quantity & Unit of Measure (Units, Boxes, Rolls, Kits, Pallets)
  - Unit Price ($ USD)
  - Assigned Warehouse Facility
  - Minimum Safety Stock Threshold (configurable reorder point)
  - Bin / Aisle Location
  - Product Notes & Description

### 4. 📥 Inbound (Stock In) & 📤 Outbound (Stock Out)
- **Stock In**: Log purchase order receipts or customer returns with live balance preview, PO reference, receiving staff ID, and dock notes.
- **Stock Out**: Dispatch orders with automatic guardrails preventing negative stock or over-dispatch, recording sales order # and fulfillment operator.

### 5. 🚨 Low-Stock Alerts & Replenishment Hub
- Dedicated alert center highlighting all items at or below their safety stock threshold.
- Calculates exact unit deficit and suggests optimal purchase order quantity.
- One-click **Fast Restock** button that pre-fills the inbound receipt modal.

### 6. 🔁 Inter-Warehouse Transfers
- Move inventory between 4 logistics nodes (*Warehouse Alpha - Chicago, Bravo - Seattle, Charlie - NJ, Delta - Dallas*).
- Validates available stock at origin facility, automatically decrements source stock, credits target stock, and generates a transfer manifest in the audit log.

### 7. ⏱️ Immutable Audit Trail & Transaction History
- Logs every stock movement: `STOCK_IN`, `STOCK_OUT`, `TRANSFER`, `PRODUCT_CREATED`, `PRODUCT_UPDATED`, and `PRODUCT_DELETED`.
- Searchable and filterable by event type and keyword.
- Exportable to standard CSV format.

### 8. 📷 Barcode Scanner Simulator (Hackathon Demo Feature!)
- Built-in interactive floor scanner with animated laser reticle.
- Type, paste, or click sample SKUs to instantly view real-time stock and perform 1-click `+1 Quick In` or `-1 Quick Out` adjustments.

---

## 🏗️ Architecture & Dual-Mode Execution

StockSense is engineered to run **flawlessly in any environment** with zero external dependencies:

```
stocksense/
├── index.html          # Semantic HTML5 SPA with Tailwind CSS & responsive layouts
├── css/
│   └── styles.css      # Enterprise styling, animations, laser scan line & toast alerts
├── js/
│   ├── data.js         # Pre-seeded realistic demo dataset (16 products, 4 facilities, txs)
│   ├── storage.js      # Resilient dual-mode store (localStorage + REST API sync)
│   ├── charts.js       # Chart.js analytics engine with automatic fallback
│   └── app.js          # Core reactive controller, modals, filtering & role switching
├── server.py           # Zero-dependency Python 3 HTTP + SQLite REST API backend
├── start.sh            # One-click launch shell script
└── README.md           # Documentation & hackathon guide
```

### Dual-Mode Flexibility:
1. **Full-Stack Mode (Python 3 + SQLite)**:
   - Run `python3 server.py` to start the REST API and persist data to `stocksense.db`.
2. **Zero-Install Client Mode (Direct Browser)**:
   - Simply double-click `index.html` in any modern browser! The app automatically detects offline/standalone execution and runs using `localStorage` persistence.

---

## 🚀 How to Run Locally

### Option A: Using the Python Backend (Recommended)
Open your terminal in this directory:
```bash
./start.sh
# OR
python3 server.py
```
Then open your browser to:
👉 **[http://localhost:8000](http://localhost:8000)**

### Option B: Using Python's Built-in HTTP Server
```bash
python3 -m http.server 8000
```
Then open **[http://localhost:8000](http://localhost:8000)**.

### Option C: Direct File Opening
Double-click `index.html` or open `file:///.../stocksense/index.html` in Chrome, Safari, Edge, or Firefox.

---

## 🧪 Demo Testing Checklist for Evaluators

1. **Dashboard**: Observe real-time stats ($ valuation, low stock alerts, warehouse distribution charts).
2. **Role Toggle**: Switch between **Inventory Manager View** and **Warehouse Staff View** in the top navigation.
3. **Add Product**: Click "+ Add Product", use "Auto-Generate" for the SKU, and save.
4. **Stock In**: Click 📥 on any item to receive new units. Notice the instant toast and table update.
5. **Stock Out**: Click 📤 on any item to dispatch units. Try entering a quantity higher than available to test the validation guardrail!
6. **Transfer**: Click 🔁 on an item to transfer 5 units from Warehouse Alpha to Warehouse Bravo. Check that both facilities reflect the change.
7. **Low Stock Alerts**: Navigate to "Low Stock Alerts" in the sidebar to review the replenishment cards and click "Fast Restock".
8. **Audit Trail**: Visit "Audit & Transactions" to see the chronological history of all your actions.
9. **Floor Scanner**: Click the Barcode Scanner icon in the header or sidebar, click a preset SKU (e.g. `ELEC-SCN-201`), and test `+1 Quick In`.
10. **CSV Export**: Click "Export CSV" to download the inventory catalog or audit trail.
11. **Reset Demo Data**: Click "Reset Data" in the sidebar anytime to return to the original clean demo state.
