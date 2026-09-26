// StockSense - Storage & API Service Layer
// Dual-mode: Connects to local REST API if available; gracefully falls back to localStorage

class StockSenseStore {
  constructor() {
    this.storageKeyProducts = 'stocksense_products_v2';
    this.storageKeyTransactions = 'stocksense_transactions_v2';
    this.storageKeyWarehouses = 'stocksense_warehouses_v2';
    this.storageKeyCategories = 'stocksense_categories_v2';
    this.apiBase = window.location.origin.startsWith('http') ? '/api' : null;
    this.useApi = false;
    this.listeners = [];
  }

  async init() {
    // Attempt backend API ping if served over http
    if (this.apiBase) {
      try {
        const res = await fetch(`${this.apiBase}/products`, { method: 'GET', signal: AbortSignal.timeout(1200) });
        if (res.ok) {
          this.useApi = true;
          console.log('[StockSense] Connected to Python REST API Server.');
        }
      } catch (e) {
        console.warn('[StockSense] Backend API not responding, running in high-performance localStorage mode.');
        this.useApi = false;
      }
    }

    // Initialize local storage if empty
    if (!localStorage.getItem(this.storageKeyProducts)) {
      this.resetToDefaultData(false);
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify(event, payload) {
    this.listeners.forEach(fn => fn(event, payload));
  }

  // --- Products ---

  async getProducts() {
    if (this.useApi) {
      try {
        const res = await fetch(`${this.apiBase}/products`);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('API error, falling back to local store:', err);
      }
    }
    const raw = localStorage.getItem(this.storageKeyProducts);
    return raw ? JSON.parse(raw) : [];
  }

  async getProduct(id) {
    const products = await this.getProducts();
    return products.find(p => p.id === id) || null;
  }

  async addProduct(data) {
    const newProduct = {
      id: 'prod-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      name: data.name.trim(),
      sku: data.sku.trim().toUpperCase(),
      category: data.category || 'Uncategorized',
      quantity: Math.max(0, parseInt(data.quantity, 10) || 0),
      price: Math.max(0, parseFloat(data.price) || 0),
      warehouse: data.warehouse || DEFAULT_WAREHOUSES[0].name,
      minThreshold: Math.max(0, parseInt(data.minThreshold, 10) || 10),
      location: data.location ? data.location.trim() : 'General Floor',
      unit: data.unit || 'Units',
      description: data.description ? data.description.trim() : '',
      updatedAt: new Date().toISOString()
    };

    if (this.useApi) {
      try {
        const res = await fetch(`${this.apiBase}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProduct)
        });
        if (res.ok) {
          const saved = await res.json();
          this.logTransaction({
            productId: saved.id,
            productName: saved.name,
            sku: saved.sku,
            type: 'PRODUCT_CREATED',
            quantity: saved.quantity,
            balanceAfter: saved.quantity,
            sourceWarehouse: '',
            targetWarehouse: saved.warehouse,
            reference: 'SYSTEM-INIT',
            operator: data.operator || 'Inventory Manager',
            notes: `New product catalog entry created. Initial stock: ${saved.quantity} ${saved.unit}.`
          });
          this.notify('products_changed');
          return saved;
        }
      } catch (err) {
        console.warn('API failed on addProduct, saving locally:', err);
      }
    }

    const products = await this.getProducts();
    // Validate unique SKU
    if (products.some(p => p.sku.toLowerCase() === newProduct.sku.toLowerCase())) {
      throw new Error(`SKU "${newProduct.sku}" already exists. Please choose a unique SKU.`);
    }

    products.unshift(newProduct);
    localStorage.setItem(this.storageKeyProducts, JSON.stringify(products));

    await this.logTransaction({
      productId: newProduct.id,
      productName: newProduct.name,
      sku: newProduct.sku,
      type: 'PRODUCT_CREATED',
      quantity: newProduct.quantity,
      balanceAfter: newProduct.quantity,
      sourceWarehouse: '',
      targetWarehouse: newProduct.warehouse,
      reference: 'SYSTEM-INIT',
      operator: data.operator || 'Inventory Manager',
      notes: `New product catalog entry created. Initial stock: ${newProduct.quantity} ${newProduct.unit}.`
    });

    this.notify('products_changed');
    return newProduct;
  }

  async updateProduct(id, data) {
    const products = await this.getProducts();
    const index = products.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Product not found');

    const oldProduct = products[index];

    // Check SKU conflict with other products
    const skuConflict = products.find(p => p.id !== id && p.sku.toLowerCase() === data.sku.trim().toLowerCase());
    if (skuConflict) {
      throw new Error(`SKU "${data.sku.trim().toUpperCase()}" is already assigned to "${skuConflict.name}".`);
    }

    const updated = {
      ...oldProduct,
      name: data.name.trim(),
      sku: data.sku.trim().toUpperCase(),
      category: data.category,
      price: Math.max(0, parseFloat(data.price) || 0),
      warehouse: data.warehouse,
      minThreshold: Math.max(0, parseInt(data.minThreshold, 10) || 10),
      location: data.location ? data.location.trim() : oldProduct.location,
      unit: data.unit || oldProduct.unit,
      description: data.description !== undefined ? data.description.trim() : oldProduct.description,
      updatedAt: new Date().toISOString()
    };

    if (this.useApi) {
      try {
        const res = await fetch(`${this.apiBase}/products/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        });
        if (res.ok) {
          const saved = await res.json();
          this.notify('products_changed');
          return saved;
        }
      } catch (err) {
        console.warn('API update failed, updating locally:', err);
      }
    }

    products[index] = updated;
    localStorage.setItem(this.storageKeyProducts, JSON.stringify(products));

    await this.logTransaction({
      productId: updated.id,
      productName: updated.name,
      sku: updated.sku,
      type: 'PRODUCT_UPDATED',
      quantity: 0,
      balanceAfter: updated.quantity,
      sourceWarehouse: oldProduct.warehouse,
      targetWarehouse: updated.warehouse,
      reference: 'MOD-SPEC',
      operator: data.operator || 'Inventory Manager',
      notes: `Product attributes and specification updated.`
    });

    this.notify('products_changed');
    return updated;
  }

  async deleteProduct(id, operator = 'Inventory Manager') {
    const products = await this.getProducts();
    const product = products.find(p => p.id === id);
    if (!product) throw new Error('Product not found');

    if (this.useApi) {
      try {
        const res = await fetch(`${this.apiBase}/products/${id}`, { method: 'DELETE' });
        if (res.ok) {
          this.notify('products_changed');
          return true;
        }
      } catch (err) {
        console.warn('API delete failed, deleting locally:', err);
      }
    }

    const filtered = products.filter(p => p.id !== id);
    localStorage.setItem(this.storageKeyProducts, JSON.stringify(filtered));

    await this.logTransaction({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      type: 'PRODUCT_DELETED',
      quantity: product.quantity,
      balanceAfter: 0,
      sourceWarehouse: product.warehouse,
      targetWarehouse: '',
      reference: 'DEL-ARCHIVE',
      operator: operator,
      notes: `Product removed from active catalog. Final inventory was ${product.quantity} ${product.unit}.`
    });

    this.notify('products_changed');
    return true;
  }

  // --- Stock In ---

  async stockIn(productId, { quantity, reason, reference, operator, notes, destinationWarehouse }) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) throw new Error('Quantity must be a positive number greater than 0.');

    const products = await this.getProducts();
    const product = products.find(p => p.id === productId);
    if (!product) throw new Error('Product not found.');

    const oldQty = product.quantity;
    const newQty = oldQty + qty;
    product.quantity = newQty;
    product.updatedAt = new Date().toISOString();
    if (destinationWarehouse) {
      product.warehouse = destinationWarehouse;
    }

    localStorage.setItem(this.storageKeyProducts, JSON.stringify(products));

    await this.logTransaction({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      type: 'STOCK_IN',
      quantity: qty,
      balanceAfter: newQty,
      sourceWarehouse: '',
      targetWarehouse: product.warehouse,
      reference: reference || `PO-${Date.now().toString().slice(-5)}`,
      operator: operator || 'Receiving Staff',
      notes: notes || reason || 'Received inbound shipment.'
    });

    this.notify('products_changed');
    return product;
  }

  // --- Stock Out ---

  async stockOut(productId, { quantity, reason, reference, operator, notes }) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) throw new Error('Quantity must be a positive number greater than 0.');

    const products = await this.getProducts();
    const product = products.find(p => p.id === productId);
    if (!product) throw new Error('Product not found.');

    if (product.quantity < qty) {
      throw new Error(`Insufficient stock. Current stock is ${product.quantity} ${product.unit}, cannot dispatch ${qty}.`);
    }

    const oldQty = product.quantity;
    const newQty = oldQty - qty;
    product.quantity = newQty;
    product.updatedAt = new Date().toISOString();

    localStorage.setItem(this.storageKeyProducts, JSON.stringify(products));

    await this.logTransaction({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      type: 'STOCK_OUT',
      quantity: qty,
      balanceAfter: newQty,
      sourceWarehouse: product.warehouse,
      targetWarehouse: '',
      reference: reference || `SO-${Date.now().toString().slice(-5)}`,
      operator: operator || 'Fulfillment Staff',
      notes: notes || reason || 'Dispatched stock for customer delivery.'
    });

    this.notify('products_changed');
    return product;
  }

  // --- Warehouse Transfer ---

  async transferStock({ productId, sourceWarehouse, targetWarehouse, quantity, reference, operator, notes }) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) throw new Error('Transfer quantity must be greater than 0.');
    if (!sourceWarehouse || !targetWarehouse) throw new Error('Both source and destination warehouses are required.');
    if (sourceWarehouse === targetWarehouse) throw new Error('Source and destination warehouse cannot be the same facility.');

    const products = await this.getProducts();
    const product = products.find(p => p.id === productId);
    if (!product) throw new Error('Product not found.');

    if (product.warehouse !== sourceWarehouse) {
      throw new Error(`Product is currently logged at ${product.warehouse}, not ${sourceWarehouse}.`);
    }

    if (product.quantity < qty) {
      throw new Error(`Insufficient stock at ${sourceWarehouse}. Available: ${product.quantity}, Requested: ${qty}.`);
    }

    // If whole quantity or product record relocated:
    // Update product location or split
    let destinationProduct = products.find(p => p.sku === product.sku && p.warehouse === targetWarehouse);

    if (destinationProduct) {
      // Deduct from source
      product.quantity -= qty;
      product.updatedAt = new Date().toISOString();
      // Add to destination
      destinationProduct.quantity += qty;
      destinationProduct.updatedAt = new Date().toISOString();
    } else {
      // If full quantity moved, update the warehouse directly
      if (product.quantity === qty) {
        product.warehouse = targetWarehouse;
        product.updatedAt = new Date().toISOString();
      } else {
        // Partial transfer: reduce source, create target record
        product.quantity -= qty;
        product.updatedAt = new Date().toISOString();

        destinationProduct = {
          ...product,
          id: 'prod-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
          warehouse: targetWarehouse,
          quantity: qty,
          updatedAt: new Date().toISOString()
        };
        products.push(destinationProduct);
      }
    }

    localStorage.setItem(this.storageKeyProducts, JSON.stringify(products));

    await this.logTransaction({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      type: 'TRANSFER',
      quantity: qty,
      balanceAfter: product.quantity,
      sourceWarehouse: sourceWarehouse,
      targetWarehouse: targetWarehouse,
      reference: reference || `XFER-${Date.now().toString().slice(-5)}`,
      operator: operator || 'Dispatch Officer',
      notes: notes || `Internal inter-facility transfer from ${sourceWarehouse} to ${targetWarehouse}.`
    });

    this.notify('products_changed');
    return { success: true, sourceRemaining: product.quantity, destinationQuantity: qty };
  }

  // --- Transactions & Audit Trail ---

  async getTransactions(filter = {}) {
    if (this.useApi) {
      try {
        const res = await fetch(`${this.apiBase}/transactions`);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('API error fetching transactions:', err);
      }
    }
    const raw = localStorage.getItem(this.storageKeyTransactions);
    let list = raw ? JSON.parse(raw) : [];

    if (filter.type && filter.type !== 'ALL') {
      list = list.filter(t => t.type === filter.type);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(t => 
        (t.productName && t.productName.toLowerCase().includes(q)) ||
        (t.sku && t.sku.toLowerCase().includes(q)) ||
        (t.reference && t.reference.toLowerCase().includes(q)) ||
        (t.operator && t.operator.toLowerCase().includes(q))
      );
    }
    return list;
  }

  async logTransaction(entry) {
    const newTx = {
      id: 'tx-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      productId: entry.productId || '',
      productName: entry.productName || 'Unknown Item',
      sku: entry.sku || 'N/A',
      type: entry.type || 'ADJUSTMENT',
      quantity: entry.quantity || 0,
      balanceAfter: entry.balanceAfter !== undefined ? entry.balanceAfter : 0,
      sourceWarehouse: entry.sourceWarehouse || '',
      targetWarehouse: entry.targetWarehouse || '',
      reference: entry.reference || 'N/A',
      operator: entry.operator || 'System Operator',
      notes: entry.notes || '',
      timestamp: new Date().toISOString()
    };

    const raw = localStorage.getItem(this.storageKeyTransactions);
    const transactions = raw ? JSON.parse(raw) : [];
    transactions.unshift(newTx);
    localStorage.setItem(this.storageKeyTransactions, JSON.stringify(transactions));
    this.notify('transactions_changed', newTx);
    return newTx;
  }

  async clearTransactions() {
    localStorage.setItem(this.storageKeyTransactions, JSON.stringify([]));
    this.notify('transactions_changed');
    return true;
  }

  // --- Warehouses & Categories ---

  getWarehouses() {
    const raw = localStorage.getItem(this.storageKeyWarehouses);
    return raw ? JSON.parse(raw) : DEFAULT_WAREHOUSES;
  }

  getCategories() {
    const raw = localStorage.getItem(this.storageKeyCategories);
    return raw ? JSON.parse(raw) : DEFAULT_CATEGORIES;
  }

  // --- Reset to Default Seed Data ---

  resetToDefaultData(notify = true) {
    localStorage.setItem(this.storageKeyProducts, JSON.stringify(DEFAULT_PRODUCTS));
    localStorage.setItem(this.storageKeyTransactions, JSON.stringify(DEFAULT_TRANSACTIONS));
    localStorage.setItem(this.storageKeyWarehouses, JSON.stringify(DEFAULT_WAREHOUSES));
    localStorage.setItem(this.storageKeyCategories, JSON.stringify(DEFAULT_CATEGORIES));

    if (notify) {
      this.notify('products_changed');
      this.notify('transactions_changed');
    }
  }

  // --- Export & Import ---

  exportData() {
    const products = JSON.parse(localStorage.getItem(this.storageKeyProducts) || '[]');
    const transactions = JSON.parse(localStorage.getItem(this.storageKeyTransactions) || '[]');
    const warehouses = JSON.parse(localStorage.getItem(this.storageKeyWarehouses) || '[]');
    return {
      appName: 'StockSense',
      version: '2.4',
      exportedAt: new Date().toISOString(),
      products,
      transactions,
      warehouses
    };
  }

  importData(data) {
    if (!data || !Array.isArray(data.products)) {
      throw new Error('Invalid backup file format. Expected a valid StockSense export payload.');
    }
    localStorage.setItem(this.storageKeyProducts, JSON.stringify(data.products));
    if (Array.isArray(data.transactions)) {
      localStorage.setItem(this.storageKeyTransactions, JSON.stringify(data.transactions));
    }
    if (Array.isArray(data.warehouses)) {
      localStorage.setItem(this.storageKeyWarehouses, JSON.stringify(data.warehouses));
    }
    this.notify('products_changed');
    this.notify('transactions_changed');
  }
}

// Global store singleton
const store = new StockSenseStore();
