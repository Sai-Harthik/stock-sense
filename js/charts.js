// StockSense - Interactive Charting & Analytics Engine
// Uses Chart.js with automatic graceful canvas fallback if offline

class StockCharts {
  constructor() {
    this.warehouseChart = null;
    this.categoryChart = null;
    this.healthChart = null;
  }

  init(products, warehouses) {
    this.renderAll(products, warehouses);
  }

  destroyAll() {
    if (this.warehouseChart) {
      this.warehouseChart.destroy();
      this.warehouseChart = null;
    }
    if (this.categoryChart) {
      this.categoryChart.destroy();
      this.categoryChart = null;
    }
    if (this.healthChart) {
      this.healthChart.destroy();
      this.healthChart = null;
    }
  }

  update(products, warehouses) {
    this.renderAll(products, warehouses);
  }

  renderAll(products, warehouses) {
    if (typeof Chart === 'undefined') {
      console.warn('[StockSense] Chart.js not detected in global scope. Rendering fallback visual metric bars.');
      this.renderFallbackBars(products, warehouses);
      return;
    }

    this.renderWarehouseChart(products, warehouses);
    this.renderCategoryChart(products);
    this.renderHealthChart(products);
  }

  renderWarehouseChart(products, warehouses) {
    const canvas = document.getElementById('chart-warehouse');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Aggregate units per warehouse
    const whMap = {};
    warehouses.forEach(wh => {
      // Shorten name for clean chart label
      const shortName = wh.name.split('(')[0].trim();
      whMap[shortName] = 0;
    });

    products.forEach(p => {
      const matched = warehouses.find(w => w.name === p.warehouse);
      const key = matched ? matched.name.split('(')[0].trim() : 'Other';
      whMap[key] = (whMap[key] || 0) + (p.quantity || 0);
    });

    const labels = Object.keys(whMap);
    const data = Object.values(whMap);

    if (this.warehouseChart) {
      this.warehouseChart.destroy();
    }

    this.warehouseChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            'rgba(59, 130, 246, 0.85)', // Blue
            'rgba(16, 185, 129, 0.85)', // Emerald
            'rgba(245, 158, 11, 0.85)', // Amber
            'rgba(139, 92, 246, 0.85)', // Purple
            'rgba(236, 72, 153, 0.85)'  // Pink
          ],
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { family: "'Inter', sans-serif", size: 11, weight: '500' },
              padding: 12
            }
          },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ` ${ctx.label}: ${ctx.raw.toLocaleString()} units`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  renderCategoryChart(products) {
    const canvas = document.getElementById('chart-category');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Aggregate asset valuation by category
    const catMap = {};
    products.forEach(p => {
      const cat = p.category || 'Other';
      const val = (p.quantity || 0) * (p.price || 0);
      catMap[cat] = (catMap[cat] || 0) + val;
    });

    // Sort categories by value descending
    const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(i => i[0]);
    const data = sorted.map(i => Math.round(i[1]));

    if (this.categoryChart) {
      this.categoryChart.destroy();
    }

    this.categoryChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Value ($)',
          data: data,
          backgroundColor: 'rgba(99, 102, 241, 0.8)',
          hoverBackgroundColor: 'rgba(79, 70, 229, 0.95)',
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ` Value: $${ctx.raw.toLocaleString()}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(226, 232, 240, 0.6)' },
            ticks: {
              font: { family: "'Inter', sans-serif", size: 10 },
              callback: val => '$' + (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val)
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { family: "'Inter', sans-serif", size: 11, weight: '500' }
            }
          }
        }
      }
    });
  }

  renderHealthChart(products) {
    const canvas = document.getElementById('chart-health');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let healthy = 0;
    let low = 0;
    let out = 0;

    products.forEach(p => {
      if (p.quantity === 0) out++;
      else if (p.quantity <= (p.minThreshold || 10)) low++;
      else healthy++;
    });

    if (this.healthChart) {
      this.healthChart.destroy();
    }

    this.healthChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Healthy Stock', 'Low Stock Alert', 'Out of Stock'],
        datasets: [{
          data: [healthy, low, out],
          backgroundColor: [
            'rgba(16, 185, 129, 0.85)', // Green
            'rgba(245, 158, 11, 0.85)', // Amber
            'rgba(239, 68, 68, 0.85)'   // Red
          ],
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { family: "'Inter', sans-serif", size: 11, weight: '500' },
              padding: 10
            }
          },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ` ${ctx.label}: ${ctx.raw} items`;
              }
            }
          }
        }
      }
    });
  }

  renderFallbackBars(products, warehouses) {
    // Canvas fallback if Chart.js is not loaded
    const canvases = ['chart-warehouse', 'chart-category', 'chart-health'];
    canvases.forEach(id => {
      const c = document.getElementById(id);
      if (!c) return;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#64748b';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Real-time Analytics Ready', c.width / 2, c.height / 2);
    });
  }
}

const charts = new StockCharts();
