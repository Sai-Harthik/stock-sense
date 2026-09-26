// StockSense - Core Application Controller
// Handles UI reactivity, modal lifecycle, role switching, workflows, and search/filter/sort logic

class StockSenseApp {
  constructor() {
    this.currentView = 'dashboard'; // 'dashboard' | 'inventory' | 'alerts' | 'transfers' | 'history' | 'scanner'
    this.currentRole = 'manager'; // 'manager' | 'staff'
    this.selectedWarehouse = 'ALL';
    
    // Inventory table state
    this.searchQuery = '';
    this.filterCategory = 'ALL';
    this.filterWarehouse = 'ALL';
    this.filterStatus = 'ALL'; // 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'
    this.sortColumn = 'name';
    this.sortDirection = 'asc'; // 'asc' | 'desc'
    this.currentPage = 1;
    this.pageSize = 10;

    // Transaction history table state
    this.txSearchQuery = '';
    this.txFilterType = 'ALL';

    // Cached data
    this.products = [];
    this.transactions = [];
    this.warehouses = [];
    this.categories = [];
  }

  async init() {
    await store.init();
    this.warehouses = store.getWarehouses();
    this.categories = store.getCategories();

    // Subscribe to store updates
    store.subscribe((event) => {
      this.refreshData();
    });

    this.bindEvents();
    this.populateStaticDropdowns();
    await this.refreshData();
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);

    // Initial role visual update
    this.applyRoleView();
  }

  // --- Data Loading & Synchronization ---

  async refreshData() {
    this.products = await store.getProducts();
    this.transactions = await store.getTransactions();

    this.renderKPIs();
    this.renderCurrentView();
    this.updateAlertBadge();
    charts.update(this.products, this.warehouses);
  }

  // --- View Routing ---

  switchView(viewName) {
    this.currentView = viewName;

    // Update active nav button
    document.querySelectorAll('.nav-link').forEach(btn => {
      if (btn.dataset.view === viewName) {
        btn.classList.add('bg-indigo-700', 'text-white', 'shadow-sm');
        btn.classList.remove('text-slate-300', 'hover:bg-slate-800', 'hover:text-white');
      } else {
        btn.classList.remove('bg-indigo-700', 'text-white', 'shadow-sm');
        btn.classList.add('text-slate-300', 'hover:bg-slate-800', 'hover:text-white');
      }
    });

    // Toggle view containers
    const views = ['dashboard', 'inventory', 'alerts', 'transfers', 'history', 'scanner'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) {
        if (v === viewName) {
          el.classList.remove('hidden');
          el.classList.add('animate-fade-in');
        } else {
          el.classList.add('hidden');
          el.classList.remove('animate-fade-in');
        }
      }
    });

    // Specific view renders
    if (viewName === 'inventory') this.renderInventoryTable();
    if (viewName === 'alerts') this.renderAlertsView();
    if (viewName === 'transfers') this.renderTransferView();
    if (viewName === 'history') this.renderHistoryTable();
    if (viewName === 'dashboard') charts.update(this.products, this.warehouses);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderCurrentView() {
    if (this.currentView === 'dashboard') {
      this.renderRecentActivity();
      this.renderDashboardAlertSnippet();
    } else if (this.currentView === 'inventory') {
      this.renderInventoryTable();
    } else if (this.currentView === 'alerts') {
      this.renderAlertsView();
    } else if (this.currentView === 'transfers') {
      this.renderTransferView();
    } else if (this.currentView === 'history') {
      this.renderHistoryTable();
    }
  }

  // --- Role Toggling ---

  setRole(role) {
    this.currentRole = role;
    this.applyRoleView();
    this.showToast(`Switched view to ${role === 'manager' ? 'Inventory Manager' : 'Warehouse Staff'} mode`, 'info');
  }

  applyRoleView() {
    const isManager = this.currentRole === 'manager';
    
    // Toggle role badges & styling
    const roleBadge = document.getElementById('active-role-badge');
    if (roleBadge) {
      if (isManager) {
        roleBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1.5';
        roleBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-indigo-600"></span> 👔 Inventory Manager`;
      } else {
        roleBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5';
        roleBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-600"></span> 👷 Warehouse Staff`;
      }
    }

    // Role-specific element visibility
    document.querySelectorAll('.role-manager-only').forEach(el => {
      el.style.display = isManager ? '' : 'none';
    });
    document.querySelectorAll('.role-staff-only').forEach(el => {
      el.style.display = isManager ? 'none' : '';
    });

    // Re-render table to toggle valuation vs bin locations
    this.renderCurrentView();
  }

  // --- Dashboard KPI Cards ---

  renderKPIs() {
    let filtered = this.products;
    if (this.selectedWarehouse !== 'ALL') {
      filtered = filtered.filter(p => p.warehouse === this.selectedWarehouse);
    }

    const totalProducts = filtered.length;
    const totalUnits = filtered.reduce((acc, p) => acc + (p.quantity || 0), 0);
    const totalValuation = filtered.reduce((acc, p) => acc + ((p.quantity || 0) * (p.price || 0)), 0);
    
    const lowStockCount = filtered.filter(p => p.quantity <= (p.minThreshold || 10) && p.quantity > 0).length;
    const outOfStockCount = filtered.filter(p => p.quantity === 0).length;

    // Update DOM counters
    const elProd = document.getElementById('kpi-total-products');
    const elUnits = document.getElementById('kpi-total-units');
    const elVal = document.getElementById('kpi-total-valuation');
    const elLow = document.getElementById('kpi-low-stock');
    const elOut = document.getElementById('kpi-out-stock');

    if (elProd) elProd.textContent = totalProducts.toLocaleString();
    if (elUnits) elUnits.textContent = totalUnits.toLocaleString();
    if (elVal) elVal.textContent = '$' + totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (elLow) elLow.textContent = lowStockCount.toLocaleString();
    if (elOut) elOut.textContent = outOfStockCount.toLocaleString();
  }

  renderRecentActivity() {
    const container = document.getElementById('dashboard-recent-activity');
    if (!container) return;

    const recent = this.transactions.slice(0, 5);
    if (recent.length === 0) {
      container.innerHTML = `<p class="text-sm text-slate-500 py-4 text-center">No recent activity recorded.</p>`;
      return;
    }

    container.innerHTML = recent.map(tx => {
      const badge = this.getTransactionTypeBadge(tx.type);
      const dateFormatted = this.formatRelativeTime(tx.timestamp);
      return `
        <div class="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
          <div class="mt-0.5">${badge.icon}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-semibold text-slate-800 truncate">${this.escapeHtml(tx.productName)}</p>
              <span class="text-xs text-slate-400 whitespace-nowrap">${dateFormatted}</span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <span class="font-mono bg-slate-100 px-1 rounded">${this.escapeHtml(tx.sku)}</span>
              <span>•</span>
              <span class="${badge.textClass} font-medium">${badge.label} (${tx.quantity > 0 ? (tx.type === 'STOCK_IN' ? '+' : (tx.type === 'STOCK_OUT' ? '-' : '')) + tx.quantity : '0'})</span>
              <span>•</span>
              <span class="truncate">${this.escapeHtml(tx.operator)}</span>
            </p>
          </div>
        </div>
      `;
    }).join('');
  }

  renderDashboardAlertSnippet() {
    const container = document.getElementById('dashboard-alerts-snippet');
    if (!container) return;

    const criticalItems = this.products.filter(p => p.quantity <= (p.minThreshold || 10));
    if (criticalItems.length === 0) {
      container.innerHTML = `
        <div class="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
          <p class="text-emerald-700 text-sm font-medium">✅ All inventory levels are currently healthy and above reorder thresholds.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="space-y-2.5">
        ${criticalItems.slice(0, 3).map(p => {
          const isOut = p.quantity === 0;
          return `
            <div class="p-3 rounded-lg border ${isOut ? 'bg-red-50/70 border-red-200' : 'bg-amber-50/70 border-amber-200'} flex items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full ${isOut ? 'bg-red-500 animate-ping' : 'bg-amber-500'}"></span>
                  <span class="text-xs font-semibold uppercase tracking-wider ${isOut ? 'text-red-700' : 'text-amber-700'}">${isOut ? 'Critical Out of Stock' : 'Low Stock Warning'}</span>
                </div>
                <h4 class="text-sm font-semibold text-slate-800 mt-0.5">${this.escapeHtml(p.name)}</h4>
                <p class="text-xs text-slate-500 font-mono mt-0.5">${p.sku} | In Stock: <strong class="${isOut ? 'text-red-600' : 'text-amber-600'}">${p.quantity}</strong> / Min: ${p.minThreshold} ${p.unit}</p>
              </div>
              <button onclick="app.openStockInModal('${p.id}')" class="px-3 py-1.5 bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 text-slate-700 rounded-lg text-xs font-medium shadow-sm transition whitespace-nowrap">
                📥 Restock
              </button>
            </div>
          `;
        }).join('')}
        ${criticalItems.length > 3 ? `
          <div class="text-center pt-1">
            <button onclick="app.switchView('alerts')" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              View all ${criticalItems.length} items needing attention →
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  // --- Inventory Table (Search, Filter, Sort, Pagination) ---

  renderInventoryTable() {
    const tbody = document.getElementById('inventory-table-body');
    const paginationEl = document.getElementById('inventory-pagination-info');
    const paginationControls = document.getElementById('inventory-pagination-controls');
    if (!tbody) return;

    let items = [...this.products];

    // Search filter
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      items = items.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.warehouse && p.warehouse.toLowerCase().includes(q)) ||
        (p.location && p.location.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (this.filterCategory !== 'ALL') {
      items = items.filter(p => p.category === this.filterCategory);
    }

    // Warehouse filter
    if (this.filterWarehouse !== 'ALL') {
      items = items.filter(p => p.warehouse === this.filterWarehouse);
    }

    // Stock Status filter
    if (this.filterStatus !== 'ALL') {
      if (this.filterStatus === 'OUT_OF_STOCK') {
        items = items.filter(p => p.quantity === 0);
      } else if (this.filterStatus === 'LOW_STOCK') {
        items = items.filter(p => p.quantity > 0 && p.quantity <= (p.minThreshold || 10));
      } else if (this.filterStatus === 'IN_STOCK') {
        items = items.filter(p => p.quantity > (p.minThreshold || 10));
      }
    }

    // Sort items
    items.sort((a, b) => {
      let valA, valB;
      switch (this.sortColumn) {
        case 'sku':
          valA = a.sku.toLowerCase();
          valB = b.sku.toLowerCase();
          break;
        case 'category':
          valA = (a.category || '').toLowerCase();
          valB = (b.category || '').toLowerCase();
          break;
        case 'warehouse':
          valA = (a.warehouse || '').toLowerCase();
          valB = (b.warehouse || '').toLowerCase();
          break;
        case 'quantity':
          valA = a.quantity;
          valB = b.quantity;
          break;
        case 'price':
          valA = a.price;
          valB = b.price;
          break;
        case 'value':
          valA = a.quantity * a.price;
          valB = b.quantity * b.price;
          break;
        case 'name':
        default:
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
      }

      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    const totalFiltered = items.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / this.pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const paginatedItems = items.slice(startIndex, startIndex + this.pageSize);

    // Update pagination info
    if (paginationEl) {
      if (totalFiltered === 0) {
        paginationEl.textContent = 'Showing 0 products';
      } else {
        const end = Math.min(startIndex + this.pageSize, totalFiltered);
        paginationEl.textContent = `Showing ${startIndex + 1} - ${end} of ${totalFiltered} products`;
      }
    }

    // Update pagination buttons
    if (paginationControls) {
      paginationControls.innerHTML = `
        <button onclick="app.goToPage(${this.currentPage - 1})" ${this.currentPage <= 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
        <span class="px-2 text-xs text-slate-500 font-medium">Page ${this.currentPage} of ${totalPages}</span>
        <button onclick="app.goToPage(${this.currentPage + 1})" ${this.currentPage >= totalPages ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
      `;
    }

    if (paginatedItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-12 text-center text-slate-500">
            <div class="flex flex-col items-center justify-center">
              <svg class="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
              <p class="text-base font-semibold text-slate-700">No products match your search or filter</p>
              <p class="text-xs text-slate-400 mt-1">Try resetting your filters or adding a new inventory product.</p>
              <button onclick="app.resetFilters()" class="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition">Clear All Filters</button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const isManager = this.currentRole === 'manager';

    tbody.innerHTML = paginatedItems.map(p => {
      const isOut = p.quantity === 0;
      const isLow = p.quantity > 0 && p.quantity <= (p.minThreshold || 10);
      
      let statusBadge = '';
      if (isOut) {
        statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 pulse-critical"><span class="w-1.5 h-1.5 rounded-full bg-red-600"></span>Out of Stock</span>`;
      } else if (isLow) {
        statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 pulse-warning"><span class="w-1.5 h-1.5 rounded-full bg-amber-600"></span>Low Stock</span>`;
      } else {
        statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>In Stock</span>`;
      }

      // Stock health percent (capped at 100%)
      const threshold = p.minThreshold || 10;
      const healthPct = Math.min(100, Math.round((p.quantity / (threshold * 2)) * 100));
      const barColor = isOut ? 'bg-red-500' : (isLow ? 'bg-amber-500' : 'bg-emerald-500');

      const totalVal = ((p.quantity || 0) * (p.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
          <td class="py-3.5 px-4">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center font-mono font-bold text-indigo-600 text-xs shrink-0">
                ${p.sku.slice(0, 3)}
              </div>
              <div class="min-w-0">
                <p class="font-semibold text-slate-800 text-sm truncate max-w-xs group-hover:text-indigo-600 transition-colors">${this.escapeHtml(p.name)}</p>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="font-mono text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">${p.sku}</span>
                  <span class="text-xs text-slate-400">•</span>
                  <span class="text-xs text-slate-500 font-medium">${this.escapeHtml(p.location || 'General Floor')}</span>
                </div>
              </div>
            </div>
          </td>
          <td class="py-3.5 px-4 text-xs">
            <span class="inline-block px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">${this.escapeHtml(p.category)}</span>
          </td>
          <td class="py-3.5 px-4 text-xs text-slate-600">
            <div class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
              <span class="truncate max-w-[180px]">${this.escapeHtml(p.warehouse.split('(')[0].trim())}</span>
            </div>
          </td>
          <td class="py-3.5 px-4">
            <div class="flex items-baseline gap-1.5">
              <span class="text-sm font-bold ${isOut ? 'text-red-600 font-mono' : (isLow ? 'text-amber-600 font-mono' : 'text-slate-800 font-mono')}">${p.quantity.toLocaleString()}</span>
              <span class="text-xs text-slate-400">${p.unit}</span>
            </div>
            <div class="w-24 bg-slate-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div class="${barColor} h-1.5 rounded-full" style="width: ${healthPct}%"></div>
            </div>
            <span class="text-[10px] text-slate-400 mt-0.5 block">Min: ${threshold}</span>
          </td>
          <td class="py-3.5 px-4">
            ${statusBadge}
          </td>
          <td class="py-3.5 px-4 text-right">
            <p class="text-xs font-semibold text-slate-700 font-mono">$${(p.price || 0).toFixed(2)}</p>
            <p class="text-[11px] text-slate-400 font-mono mt-0.5">Tot: $${totalVal}</p>
          </td>
          <td class="py-3.5 px-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="app.openStockInModal('${p.id}')" title="Stock In / Receive" class="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition border border-transparent hover:border-emerald-200">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              </button>
              <button onclick="app.openStockOutModal('${p.id}')" title="Stock Out / Dispatch" class="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition border border-transparent hover:border-amber-200">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              </button>
              <button onclick="app.openTransferModal('${p.id}')" title="Transfer Warehouse" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition border border-transparent hover:border-blue-200">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
              </button>
              <button onclick="app.openEditModal('${p.id}')" title="Edit Product" class="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
              <button onclick="app.confirmDeleteProduct('${p.id}')" title="Delete Product" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // --- Low Stock Alerts View ---

  renderAlertsView() {
    const container = document.getElementById('alerts-container');
    const badgeCount = document.getElementById('alerts-critical-count');
    if (!container) return;

    const criticalItems = this.products.filter(p => p.quantity <= (p.minThreshold || 10));

    if (badgeCount) {
      badgeCount.textContent = criticalItems.length;
    }

    if (criticalItems.length === 0) {
      container.innerHTML = `
        <div class="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-sm max-w-lg mx-auto">
          <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h3 class="text-lg font-bold text-slate-800">Inventory Health Optimal</h3>
          <p class="text-sm text-slate-500 mt-2">Zero products are currently below their minimum safety thresholds. All automated reorder rules are satisfied.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        ${criticalItems.map(p => {
          const isOut = p.quantity === 0;
          const deficit = Math.max(0, (p.minThreshold || 10) - p.quantity);
          const suggestedReorder = (p.minThreshold || 10) * 2;
          const estimatedCost = (suggestedReorder * p.price).toFixed(2);

          return `
            <div class="bg-white rounded-xl border ${isOut ? 'border-red-300 shadow-red-50' : 'border-amber-300 shadow-amber-50'} shadow-md p-5 flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between gap-2 mb-3">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${isOut ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}">
                    <span class="w-2 h-2 rounded-full ${isOut ? 'bg-red-600 animate-ping' : 'bg-amber-600'}"></span>
                    ${isOut ? 'OUT OF STOCK' : 'LOW STOCK ALERT'}
                  </span>
                  <span class="font-mono text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">${p.sku}</span>
                </div>

                <h3 class="text-base font-bold text-slate-900 mb-1 leading-snug">${this.escapeHtml(p.name)}</h3>
                <p class="text-xs text-slate-500 flex items-center gap-1 mb-4">
                  <span>📍 ${this.escapeHtml(p.warehouse.split('(')[0].trim())}</span>
                  <span>•</span>
                  <span>${this.escapeHtml(p.location || 'General')}</span>
                </p>

                <div class="bg-slate-50 rounded-lg p-3.5 border border-slate-100 space-y-2 mb-4">
                  <div class="flex justify-between items-center text-xs">
                    <span class="text-slate-500">Current Stock:</span>
                    <span class="font-bold font-mono text-sm ${isOut ? 'text-red-600' : 'text-amber-600'}">${p.quantity} ${p.unit}</span>
                  </div>
                  <div class="flex justify-between items-center text-xs">
                    <span class="text-slate-500">Safety Threshold:</span>
                    <span class="font-medium font-mono text-slate-700">${p.minThreshold} ${p.unit}</span>
                  </div>
                  <div class="flex justify-between items-center text-xs border-t border-slate-200/60 pt-2">
                    <span class="text-slate-500">Deficit:</span>
                    <span class="font-semibold text-rose-600 font-mono">-${deficit} ${p.unit}</span>
                  </div>
                  <div class="flex justify-between items-center text-xs">
                    <span class="text-slate-500">Suggested PO Qty:</span>
                    <span class="font-semibold text-indigo-600 font-mono">+${suggestedReorder} ${p.unit} (~$${estimatedCost})</span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2 pt-2">
                <button onclick="app.openStockInModal('${p.id}', ${suggestedReorder})" class="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center justify-center gap-1.5">
                  📥 Fast Restock (${suggestedReorder})
                </button>
                <button onclick="app.openTransferModal('${p.id}')" title="Check other warehouses for transfer" class="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center justify-center">
                  🔁 Transfer
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // --- Warehouse Stock Transfer View & Modal ---

  renderTransferView() {
    const selectProduct = document.getElementById('transfer-product-select');
    const sourceWarehouse = document.getElementById('transfer-source-wh');
    const targetWarehouse = document.getElementById('transfer-target-wh');
    if (!selectProduct) return;

    // Populate products with stock > 0
    selectProduct.innerHTML = '<option value="">-- Choose Product to Transfer --</option>' + 
      this.products.map(p => `
        <option value="${p.id}">${this.escapeHtml(p.name)} (${p.sku}) — Available: ${p.quantity} at ${this.escapeHtml(p.warehouse.split('(')[0].trim())}</option>
      `).join('');

    // Populate warehouses
    const whOptions = this.warehouses.map(w => `<option value="${this.escapeHtml(w.name)}">${this.escapeHtml(w.name)}</option>`).join('');
    if (sourceWarehouse) sourceWarehouse.innerHTML = '<option value="">-- Source Facility --</option>' + whOptions;
    if (targetWarehouse) targetWarehouse.innerHTML = '<option value="">-- Destination Facility --</option>' + whOptions;
  }

  onTransferProductSelected(productId) {
    const p = this.products.find(item => item.id === productId);
    const sourceSelect = document.getElementById('transfer-source-wh');
    const qtyInput = document.getElementById('transfer-quantity');
    const infoBox = document.getElementById('transfer-product-info');

    if (p) {
      if (sourceSelect) sourceSelect.value = p.warehouse;
      if (qtyInput) {
        qtyInput.max = p.quantity;
        qtyInput.value = Math.min(5, p.quantity);
      }
      if (infoBox) {
        infoBox.classList.remove('hidden');
        infoBox.innerHTML = `
          <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
            <strong>${this.escapeHtml(p.name)}</strong> (${p.sku})<br>
            Current Location: <strong>${this.escapeHtml(p.warehouse)}</strong><br>
            Available Units: <strong class="text-blue-700 font-mono text-sm">${p.quantity} ${p.unit}</strong>
          </div>
        `;
      }
    }
  }

  async submitTransfer(e) {
    e.preventDefault();
    const productId = document.getElementById('transfer-product-select').value;
    const sourceWarehouse = document.getElementById('transfer-source-wh').value;
    const targetWarehouse = document.getElementById('transfer-target-wh').value;
    const quantity = parseInt(document.getElementById('transfer-quantity').value, 10);
    const reference = document.getElementById('transfer-reference').value || `XFER-${Date.now().toString().slice(-5)}`;
    const operator = document.getElementById('transfer-operator').value || 'Logistics Coordinator';
    const notes = document.getElementById('transfer-notes').value;

    try {
      await store.transferStock({
        productId,
        sourceWarehouse,
        targetWarehouse,
        quantity,
        reference,
        operator,
        notes
      });
      this.showToast(`Transferred ${quantity} units to ${targetWarehouse.split('(')[0].trim()}`, 'success');
      this.closeModal('modal-transfer');
      // Reset form
      document.getElementById('form-transfer').reset();
      document.getElementById('transfer-product-info').classList.add('hidden');
      this.refreshData();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // --- Transaction History Table ---

  renderHistoryTable() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    let items = [...this.transactions];

    if (this.txFilterType !== 'ALL') {
      items = items.filter(tx => tx.type === this.txFilterType);
    }

    if (this.txSearchQuery.trim()) {
      const q = this.txSearchQuery.trim().toLowerCase();
      items = items.filter(tx => 
        (tx.productName && tx.productName.toLowerCase().includes(q)) ||
        (tx.sku && tx.sku.toLowerCase().includes(q)) ||
        (tx.reference && tx.reference.toLowerCase().includes(q)) ||
        (tx.operator && tx.operator.toLowerCase().includes(q)) ||
        (tx.notes && tx.notes.toLowerCase().includes(q))
      );
    }

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-12 text-center text-slate-500">
            <p class="text-sm font-semibold">No transactions found matching your criteria.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map(tx => {
      const badge = this.getTransactionTypeBadge(tx.type);
      const formattedDate = new Date(tx.timestamp).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      let locationText = '-';
      if (tx.type === 'TRANSFER') {
        locationText = `<span class="truncate max-w-[120px] inline-block">${this.escapeHtml(tx.sourceWarehouse.split('(')[0].trim())}</span> → <span class="truncate max-w-[120px] inline-block font-semibold">${this.escapeHtml(tx.targetWarehouse.split('(')[0].trim())}</span>`;
      } else if (tx.targetWarehouse) {
        locationText = this.escapeHtml(tx.targetWarehouse.split('(')[0].trim());
      } else if (tx.sourceWarehouse) {
        locationText = this.escapeHtml(tx.sourceWarehouse.split('(')[0].trim());
      }

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors text-xs">
          <td class="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">${formattedDate}</td>
          <td class="py-3 px-4">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold ${badge.badgeClass}">
              ${badge.icon} ${badge.label}
            </span>
          </td>
          <td class="py-3 px-4">
            <div class="font-semibold text-slate-800">${this.escapeHtml(tx.productName)}</div>
            <div class="font-mono text-slate-400 text-[11px]">${tx.sku}</div>
          </td>
          <td class="py-3 px-4 font-mono font-bold text-slate-800">
            <span class="${badge.textClass}">
              ${tx.quantity > 0 ? (tx.type === 'STOCK_IN' ? '+' : (tx.type === 'STOCK_OUT' ? '-' : '')) + tx.quantity : '0'}
            </span>
            <span class="text-slate-400 font-normal text-[11px] block">Bal: ${tx.balanceAfter}</span>
          </td>
          <td class="py-3 px-4 text-slate-600">${locationText}</td>
          <td class="py-3 px-4">
            <span class="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-medium">${this.escapeHtml(tx.reference || 'N/A')}</span>
            <div class="text-[11px] text-slate-400 mt-0.5">${this.escapeHtml(tx.operator)}</div>
          </td>
          <td class="py-3 px-4 text-slate-500 italic max-w-xs truncate">${this.escapeHtml(tx.notes || '-')}</td>
        </tr>
      `;
    }).join('');
  }

  // --- Modals Management ---

  openAddProductModal() {
    const form = document.getElementById('form-add-product');
    if (form) form.reset();
    this.populateProductModalDropdowns('add');
    this.generateSKUForAdd();
    this.openModal('modal-add-product');
  }

  openEditModal(productId) {
    const p = this.products.find(item => item.id === productId);
    if (!p) return;

    this.populateProductModalDropdowns('edit');
    document.getElementById('edit-product-id').value = p.id;
    document.getElementById('edit-product-name').value = p.name;
    document.getElementById('edit-product-sku').value = p.sku;
    document.getElementById('edit-product-category').value = p.category;
    document.getElementById('edit-product-price').value = p.price;
    document.getElementById('edit-product-warehouse').value = p.warehouse;
    document.getElementById('edit-product-min-threshold').value = p.minThreshold;
    document.getElementById('edit-product-location').value = p.location || '';
    document.getElementById('edit-product-unit').value = p.unit || 'Units';
    document.getElementById('edit-product-description').value = p.description || '';

    this.openModal('modal-edit-product');
  }

  async handleAddProductSubmit(e) {
    e.preventDefault();
    const data = {
      name: document.getElementById('add-product-name').value,
      sku: document.getElementById('add-product-sku').value,
      category: document.getElementById('add-product-category').value,
      quantity: document.getElementById('add-product-quantity').value,
      price: document.getElementById('add-product-price').value,
      warehouse: document.getElementById('add-product-warehouse').value,
      minThreshold: document.getElementById('add-product-min-threshold').value,
      location: document.getElementById('add-product-location').value,
      unit: document.getElementById('add-product-unit').value,
      description: document.getElementById('add-product-description').value
    };

    try {
      const created = await store.addProduct(data);
      this.showToast(`Product "${created.name}" created successfully!`, 'success');
      this.closeModal('modal-add-product');
      this.refreshData();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleEditProductSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-product-id').value;
    const data = {
      name: document.getElementById('edit-product-name').value,
      sku: document.getElementById('edit-product-sku').value,
      category: document.getElementById('edit-product-category').value,
      price: document.getElementById('edit-product-price').value,
      warehouse: document.getElementById('edit-product-warehouse').value,
      minThreshold: document.getElementById('edit-product-min-threshold').value,
      location: document.getElementById('edit-product-location').value,
      unit: document.getElementById('edit-product-unit').value,
      description: document.getElementById('edit-product-description').value
    };

    try {
      await store.updateProduct(id, data);
      this.showToast(`Product specifications updated.`, 'success');
      this.closeModal('modal-edit-product');
      this.refreshData();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  confirmDeleteProduct(productId) {
    const p = this.products.find(item => item.id === productId);
    if (!p) return;

    const modal = document.getElementById('modal-delete-confirm');
    document.getElementById('delete-product-title').textContent = p.name;
    document.getElementById('delete-product-sku').textContent = p.sku;
    document.getElementById('delete-product-qty').textContent = `${p.quantity} ${p.unit}`;
    document.getElementById('delete-confirm-btn').onclick = () => this.executeDeleteProduct(p.id);

    this.openModal('modal-delete-confirm');
  }

  async executeDeleteProduct(productId) {
    try {
      await store.deleteProduct(productId);
      this.showToast(`Product removed from catalog.`, 'info');
      this.closeModal('modal-delete-confirm');
      this.refreshData();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // --- Stock In & Out Modal Handlers ---

  openStockInModal(productId, defaultQty = 10) {
    const p = this.products.find(item => item.id === productId);
    if (!p) return;

    document.getElementById('stock-in-product-id').value = p.id;
    document.getElementById('stock-in-product-name').textContent = p.name;
    document.getElementById('stock-in-product-sku').textContent = p.sku;
    document.getElementById('stock-in-current-qty').textContent = `${p.quantity} ${p.unit}`;
    document.getElementById('stock-in-quantity').value = defaultQty;
    document.getElementById('stock-in-reference').value = `PO-${Date.now().toString().slice(-5)}`;
    document.getElementById('stock-in-unit-label').textContent = p.unit;

    this.calculateStockInPreview();
    this.openModal('modal-stock-in');
  }

  calculateStockInPreview() {
    const prodId = document.getElementById('stock-in-product-id').value;
    const p = this.products.find(item => item.id === prodId);
    if (!p) return;

    const addQty = parseInt(document.getElementById('stock-in-quantity').value, 10) || 0;
    const previewEl = document.getElementById('stock-in-preview-qty');
    if (previewEl) {
      previewEl.textContent = `${p.quantity + addQty} ${p.unit}`;
    }
  }

  async submitStockIn(e) {
    e.preventDefault();
    const productId = document.getElementById('stock-in-product-id').value;
    const quantity = document.getElementById('stock-in-quantity').value;
    const reason = document.getElementById('stock-in-reason').value;
    const reference = document.getElementById('stock-in-reference').value;
    const operator = document.getElementById('stock-in-operator').value || 'Receiving Staff';
    const notes = document.getElementById('stock-in-notes').value;

    try {
      const updated = await store.stockIn(productId, { quantity, reason, reference, operator, notes });
      this.showToast(`Received +${quantity} units for "${updated.name}"!`, 'success');
      this.closeModal('modal-stock-in');
      this.refreshData();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  openStockOutModal(productId) {
    const p = this.products.find(item => item.id === productId);
    if (!p) return;

    document.getElementById('stock-out-product-id').value = p.id;
    document.getElementById('stock-out-product-name').textContent = p.name;
    document.getElementById('stock-out-product-sku').textContent = p.sku;
    document.getElementById('stock-out-current-qty').textContent = `${p.quantity} ${p.unit}`;
    document.getElementById('stock-out-quantity').value = Math.min(5, p.quantity);
    document.getElementById('stock-out-quantity').max = p.quantity;
    document.getElementById('stock-out-reference').value = `SO-${Date.now().toString().slice(-5)}`;
    document.getElementById('stock-out-unit-label').textContent = p.unit;

    this.calculateStockOutPreview();
    this.openModal('modal-stock-out');
  }

  calculateStockOutPreview() {
    const prodId = document.getElementById('stock-out-product-id').value;
    const p = this.products.find(item => item.id === prodId);
    if (!p) return;

    const outQty = parseInt(document.getElementById('stock-out-quantity').value, 10) || 0;
    const previewEl = document.getElementById('stock-out-preview-qty');
    const warningEl = document.getElementById('stock-out-warning');

    const remaining = p.quantity - outQty;
    if (previewEl) {
      previewEl.textContent = `${Math.max(0, remaining)} ${p.unit}`;
    }

    if (warningEl) {
      if (outQty > p.quantity) {
        warningEl.classList.remove('hidden');
        warningEl.textContent = `⚠️ Cannot dispatch ${outQty}. Available: ${p.quantity} ${p.unit}.`;
      } else {
        warningEl.classList.add('hidden');
      }
    }
  }

  async submitStockOut(e) {
    e.preventDefault();
    const productId = document.getElementById('stock-out-product-id').value;
    const quantity = document.getElementById('stock-out-quantity').value;
    const reason = document.getElementById('stock-out-reason').value;
    const reference = document.getElementById('stock-out-reference').value;
    const operator = document.getElementById('stock-out-operator').value || 'Dispatch Staff';
    const notes = document.getElementById('stock-out-notes').value;

    try {
      const updated = await store.stockOut(productId, { quantity, reason, reference, operator, notes });
      this.showToast(`Dispatched -${quantity} units of "${updated.name}"!`, 'success');
      this.closeModal('modal-stock-out');
      this.refreshData();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  openTransferModal(productId) {
    this.switchView('transfers');
    if (productId) {
      const select = document.getElementById('transfer-product-select');
      if (select) {
        select.value = productId;
        this.onTransferProductSelected(productId);
      }
    }
  }

  // --- Barcode Scanner Simulation ---

  openScannerModal() {
    this.openModal('modal-scanner');
    this.renderScannerPresets();
  }

  renderScannerPresets() {
    const container = document.getElementById('scanner-preset-list');
    if (!container) return;

    container.innerHTML = this.products.slice(0, 6).map(p => `
      <button onclick="app.simulateScan('${p.sku}')" class="text-left p-2.5 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition flex items-center justify-between text-xs">
        <div>
          <span class="font-mono font-bold text-slate-800">${p.sku}</span>
          <p class="text-slate-500 truncate max-w-[200px]">${this.escapeHtml(p.name)}</p>
        </div>
        <span class="text-indigo-600 font-semibold">Scan →</span>
      </button>
    `).join('');
  }

  simulateScan(sku) {
    const input = document.getElementById('scanner-sku-input');
    if (input) input.value = sku;
    this.lookupScannedSKU();
  }

  lookupScannedSKU() {
    const input = document.getElementById('scanner-sku-input');
    const sku = (input.value || '').trim().toUpperCase();
    const resultBox = document.getElementById('scanner-result-box');
    if (!resultBox) return;

    if (!sku) {
      resultBox.classList.add('hidden');
      return;
    }

    const p = this.products.find(item => item.sku.toUpperCase() === sku);
    resultBox.classList.remove('hidden');

    if (!p) {
      resultBox.innerHTML = `
        <div class="p-4 bg-rose-50 border border-rose-200 rounded-xl text-center">
          <p class="text-rose-700 font-semibold text-sm">❌ SKU "${this.escapeHtml(sku)}" not found in active catalog.</p>
          <button onclick="app.openAddProductWithSKU('${sku}')" class="mt-2.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700">Register New Product</button>
        </div>
      `;
      return;
    }

    resultBox.innerHTML = `
      <div class="bg-white border-2 border-indigo-500 rounded-xl p-4 shadow-lg animate-modal-pop">
        <div class="flex items-center justify-between">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 font-mono">${p.sku}</span>
          <span class="text-xs text-slate-500 font-medium">📍 ${this.escapeHtml(p.location || 'General')}</span>
        </div>
        <h4 class="text-base font-bold text-slate-900 mt-2">${this.escapeHtml(p.name)}</h4>
        <p class="text-xs text-slate-500 mt-0.5">${this.escapeHtml(p.warehouse)}</p>

        <div class="flex items-center justify-between mt-3 py-2 px-3 bg-slate-50 rounded-lg">
          <span class="text-xs text-slate-600 font-medium">In-Stock Quantity:</span>
          <span class="text-lg font-mono font-bold ${p.quantity === 0 ? 'text-red-600' : (p.quantity <= p.minThreshold ? 'text-amber-600' : 'text-emerald-600')}">
            ${p.quantity} ${p.unit}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 mt-4">
          <button onclick="app.quickAdjust('${p.id}', 1)" class="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition">
            +1 Quick In
          </button>
          <button onclick="app.quickAdjust('${p.id}', -1)" ${p.quantity <= 0 ? 'disabled' : ''} class="py-2 px-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-sm transition">
            -1 Quick Out
          </button>
        </div>
      </div>
    `;
  }

  async quickAdjust(productId, delta) {
    const p = this.products.find(item => item.id === productId);
    if (!p) return;

    try {
      if (delta > 0) {
        await store.stockIn(productId, {
          quantity: 1,
          reason: 'Quick Barcode Scan Inbound (+1)',
          reference: 'SCAN-QUICK',
          operator: 'Floor Scanner'
        });
        this.showToast(`+1 received for ${p.sku}`, 'success');
      } else {
        await store.stockOut(productId, {
          quantity: 1,
          reason: 'Quick Barcode Scan Outbound (-1)',
          reference: 'SCAN-QUICK',
          operator: 'Floor Scanner'
        });
        this.showToast(`-1 dispatched for ${p.sku}`, 'info');
      }
      this.refreshData();
      this.lookupScannedSKU(); // Refresh scanner box
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  openAddProductWithSKU(sku) {
    this.closeModal('modal-scanner');
    this.openAddProductModal();
    const input = document.getElementById('add-product-sku');
    if (input) input.value = sku;
  }

  // --- Helpers & Dropdowns ---

  populateStaticDropdowns() {
    // Inventory table warehouse filter
    const whFilter = document.getElementById('filter-warehouse');
    if (whFilter) {
      whFilter.innerHTML = '<option value="ALL">All Warehouses</option>' + 
        this.warehouses.map(w => `<option value="${this.escapeHtml(w.name)}">${this.escapeHtml(w.name.split('(')[0].trim())}</option>`).join('');
    }

    // Inventory table category filter
    const catFilter = document.getElementById('filter-category');
    if (catFilter) {
      catFilter.innerHTML = '<option value="ALL">All Categories</option>' + 
        this.categories.map(c => `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`).join('');
    }

    // Header global warehouse selector
    const globalWh = document.getElementById('global-warehouse-select');
    if (globalWh) {
      globalWh.innerHTML = '<option value="ALL">🌐 All Warehouses</option>' + 
        this.warehouses.map(w => `<option value="${this.escapeHtml(w.name)}">${this.escapeHtml(w.name.split('(')[0].trim())}</option>`).join('');
    }
  }

  populateProductModalDropdowns(prefix) {
    const catSelect = document.getElementById(`${prefix}-product-category`);
    const whSelect = document.getElementById(`${prefix}-product-warehouse`);

    if (catSelect) {
      catSelect.innerHTML = this.categories.map(c => `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`).join('');
    }
    if (whSelect) {
      whSelect.innerHTML = this.warehouses.map(w => `<option value="${this.escapeHtml(w.name)}">${this.escapeHtml(w.name)}</option>`).join('');
    }
  }

  generateSKUForAdd() {
    const cat = document.getElementById('add-product-category')?.value || 'GEN';
    const prefix = cat.split('&')[0].trim().slice(0, 3).toUpperCase();
    const num = Math.floor(100 + Math.random() * 900);
    const sku = `${prefix}-${num}`;
    const input = document.getElementById('add-product-sku');
    if (input) input.value = sku;
  }

  updateAlertBadge() {
    const count = this.products.filter(p => p.quantity <= (p.minThreshold || 10)).length;
    const badge = document.getElementById('nav-alert-badge');
    const headerBadge = document.getElementById('header-alert-count');

    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? '' : 'none';
    }
    if (headerBadge) {
      headerBadge.textContent = count;
      headerBadge.style.display = count > 0 ? '' : 'none';
    }
  }

  updateClock() {
    const clock = document.getElementById('live-clock');
    if (!clock) return;
    const now = new Date();
    clock.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // --- Sorting & Filtering ---

  setSort(col) {
    if (this.sortColumn === col) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = col;
      this.sortDirection = 'asc';
    }
    this.renderInventoryTable();
  }

  resetFilters() {
    this.searchQuery = '';
    this.filterCategory = 'ALL';
    this.filterWarehouse = 'ALL';
    this.filterStatus = 'ALL';
    this.currentPage = 1;

    const s = document.getElementById('inventory-search');
    const c = document.getElementById('filter-category');
    const w = document.getElementById('filter-warehouse');
    const st = document.getElementById('filter-status');

    if (s) s.value = '';
    if (c) c.value = 'ALL';
    if (w) w.value = 'ALL';
    if (st) st.value = 'ALL';

    this.renderInventoryTable();
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderInventoryTable();
  }

  // --- Export CSV & JSON ---

  exportToCSV(type = 'products') {
    if (type === 'products') {
      const headers = ['ID', 'Name', 'SKU', 'Category', 'Quantity', 'Unit', 'Price_USD', 'Total_Value_USD', 'Warehouse', 'Min_Threshold', 'Location', 'Last_Updated'];
      const rows = this.products.map(p => [
        p.id,
        `"${p.name.replace(/"/g, '""')}"`,
        p.sku,
        `"${p.category}"`,
        p.quantity,
        p.unit,
        p.price,
        (p.quantity * p.price).toFixed(2),
        `"${p.warehouse}"`,
        p.minThreshold,
        `"${p.location || ''}"`,
        p.updatedAt
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      this.downloadBlob(csvContent, `StockSense_Inventory_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
      this.showToast('Inventory catalog exported to CSV', 'success');
    } else if (type === 'transactions') {
      const headers = ['Timestamp', 'Type', 'Product', 'SKU', 'Quantity', 'Balance_After', 'Source_Warehouse', 'Target_Warehouse', 'Reference', 'Operator', 'Notes'];
      const rows = this.transactions.map(t => [
        t.timestamp,
        t.type,
        `"${(t.productName || '').replace(/"/g, '""')}"`,
        t.sku,
        t.quantity,
        t.balanceAfter,
        `"${t.sourceWarehouse || ''}"`,
        `"${t.targetWarehouse || ''}"`,
        `"${t.reference || ''}"`,
        `"${t.operator || ''}"`,
        `"${(t.notes || '').replace(/"/g, '""')}"`
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      this.downloadBlob(csvContent, `StockSense_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
      this.showToast('Transaction audit log exported to CSV', 'success');
    }
  }

  downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- Modal Utility ---

  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.remove('hidden');
      el.classList.add('flex');
    }
  }

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.add('hidden');
      el.classList.remove('flex');
    }
  }

  // --- Toast Notifications ---

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
      <span class="text-base select-none">${icon}</span>
      <div class="flex-1">
        <p class="text-sm font-medium text-slate-800">${this.escapeHtml(message)}</p>
      </div>
      <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 text-xs">✕</button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 3800);
  }

  // --- Reset to Sample Demo Data ---

  resetDemoData() {
    if (confirm('Reset inventory and audit trail to default demo state?')) {
      store.resetToDefaultData();
      this.showToast('Sample inventory data restored successfully!', 'success');
    }
  }

  // --- Utility & Badge Formatting ---

  getTransactionTypeBadge(type) {
    switch (type) {
      case 'STOCK_IN':
        return {
          label: 'Stock In',
          icon: '📥',
          badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
          textClass: 'text-emerald-600'
        };
      case 'STOCK_OUT':
        return {
          label: 'Stock Out',
          icon: '📤',
          badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200',
          textClass: 'text-amber-600'
        };
      case 'TRANSFER':
        return {
          label: 'Transfer',
          icon: '🔁',
          badgeClass: 'bg-blue-100 text-blue-800 border border-blue-200',
          textClass: 'text-blue-600'
        };
      case 'PRODUCT_CREATED':
        return {
          label: 'Created',
          icon: '✨',
          badgeClass: 'bg-purple-100 text-purple-800 border border-purple-200',
          textClass: 'text-purple-600'
        };
      case 'PRODUCT_UPDATED':
        return {
          label: 'Updated',
          icon: '✏️',
          badgeClass: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
          textClass: 'text-indigo-600'
        };
      case 'PRODUCT_DELETED':
        return {
          label: 'Deleted',
          icon: '🗑️',
          badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200',
          textClass: 'text-rose-600'
        };
      default:
        return {
          label: 'Adjustment',
          icon: '📝',
          badgeClass: 'bg-slate-100 text-slate-800 border border-slate-200',
          textClass: 'text-slate-600'
        };
    }
  }

  formatRelativeTime(isoString) {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffHours = Math.round(diffMs / 3600000);
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Bind DOM Events ---

  bindEvents() {
    // Navigation click
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = btn.dataset.view;
        if (view) this.switchView(view);
      });
    });

    // Global Warehouse Selector
    const globalWh = document.getElementById('global-warehouse-select');
    if (globalWh) {
      globalWh.addEventListener('change', (e) => {
        this.selectedWarehouse = e.target.value;
        this.filterWarehouse = e.target.value;
        const subFilter = document.getElementById('filter-warehouse');
        if (subFilter) subFilter.value = e.target.value;
        this.renderKPIs();
        this.renderInventoryTable();
      });
    }

    // Role switcher dropdown or buttons
    const roleSelect = document.getElementById('role-select');
    if (roleSelect) {
      roleSelect.addEventListener('change', (e) => {
        this.setRole(e.target.value);
      });
    }

    // Inventory search input
    const searchInput = document.getElementById('inventory-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.currentPage = 1;
        this.renderInventoryTable();
      });
    }

    // Filters
    const catFilter = document.getElementById('filter-category');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        this.filterCategory = e.target.value;
        this.currentPage = 1;
        this.renderInventoryTable();
      });
    }

    const whFilter = document.getElementById('filter-warehouse');
    if (whFilter) {
      whFilter.addEventListener('change', (e) => {
        this.filterWarehouse = e.target.value;
        this.currentPage = 1;
        this.renderInventoryTable();
      });
    }

    const statusFilter = document.getElementById('filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.filterStatus = e.target.value;
        this.currentPage = 1;
        this.renderInventoryTable();
      });
    }

    // Transaction search and filter
    const txSearch = document.getElementById('history-search');
    if (txSearch) {
      txSearch.addEventListener('input', (e) => {
        this.txSearchQuery = e.target.value;
        this.renderHistoryTable();
      });
    }

    const txTypeFilter = document.getElementById('history-filter-type');
    if (txTypeFilter) {
      txTypeFilter.addEventListener('change', (e) => {
        this.txFilterType = e.target.value;
        this.renderHistoryTable();
      });
    }

    // Keyboard shortcut Escape to close modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
          if (!modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
          }
        });
      }
    });

    // Transfer product selection change
    const xferProd = document.getElementById('transfer-product-select');
    if (xferProd) {
      xferProd.addEventListener('change', (e) => {
        this.onTransferProductSelected(e.target.value);
      });
    }

    // Stock in/out preview inputs
    const stockInQty = document.getElementById('stock-in-quantity');
    if (stockInQty) {
      stockInQty.addEventListener('input', () => this.calculateStockInPreview());
    }

    const stockOutQty = document.getElementById('stock-out-quantity');
    if (stockOutQty) {
      stockOutQty.addEventListener('input', () => this.calculateStockOutPreview());
    }
  }
}

// Global application instance
const app = new StockSenseApp();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
