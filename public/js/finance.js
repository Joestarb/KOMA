import { state } from './state.js';
import { showToast } from './utils.js';
import { fetchStats, fetchTransactions, submitTransactionApi } from './api.js';
import { generatePDFReport } from './reports.js';

// DOM Elements
const cajaBalance = document.getElementById('caja-balance');
const cajaIncomes = document.getElementById('caja-incomes');
const cajaIncomesCount = document.getElementById('caja-incomes-count');
const cajaOutcomes = document.getElementById('caja-outcomes');
const cajaOutcomesCount = document.getElementById('caja-outcomes-count');
const cajaSales = document.getElementById('caja-sales');
const cajaSalesCount = document.getElementById('caja-sales-count');
const cajaAvgTicket = document.getElementById('caja-avg-ticket');
const cajaCancelled = document.getElementById('caja-cancelled');
const ledgerRows = document.getElementById('ledger-rows');
const emptyLedgerMsg = document.getElementById('empty-ledger-msg');
const searchLedger = document.getElementById('search-ledger');
const formTransaction = document.getElementById('form-transaction');
const txTypeRadios = document.getElementsByName('tx-type');
const txCategorySelect = document.getElementById('tx-category');
const filterTxType = document.getElementById('filter-tx-type');
const ledgerCountLabel = document.getElementById('ledger-count-label');
const topProductsList = document.getElementById('top-products-list');
const dateRangeInputs = document.getElementById('date-range-inputs');
const filterDateFromInput = document.getElementById('filter-date-from');
const filterDateToInput = document.getElementById('filter-date-to');
const btnApplyDates = document.getElementById('btn-apply-dates');
const btnGeneratePdf = document.getElementById('btn-generate-pdf');

export async function loadCajaData() {
    try {
        let urlParams = '';
        if (state.filterDateFrom && state.filterDateTo) {
            urlParams = `?from=${state.filterDateFrom}&to=${state.filterDateTo}`;
        }
        
        // 1. Estadísticas
        const stats = await fetchStats(state.filterDateFrom, state.filterDateTo);
        state.financeStats = stats;
        
        if (cajaBalance) cajaBalance.textContent = `$${stats.balance.toFixed(2)}`;
        if (cajaIncomes) cajaIncomes.textContent = `$${stats.total_incomes.toFixed(2)}`;
        if (cajaOutcomes) cajaOutcomes.textContent = `$${stats.total_outcomes.toFixed(2)}`;
        if (cajaSales) cajaSales.textContent = `$${stats.total_sales.toFixed(2)}`;
        if (cajaAvgTicket) cajaAvgTicket.textContent = `$${(stats.avg_ticket || 0).toFixed(2)}`;
        if (cajaCancelled) cajaCancelled.textContent = `${stats.counts.cancelled || 0}`;
        
        if (cajaSalesCount) cajaSalesCount.textContent = `${stats.counts.completed} finalizadas`;
        
        // Actualizar gráficos
        if (stats.daily_stats) {
            updateChart(stats.daily_stats);
        }
        if (stats.expenses_by_category) {
            updateCategoryChart(stats.expenses_by_category);
        }
        
        // Renderizar productos top
        if (stats.top_products) {
            renderTopProducts(stats.top_products);
        }
        
        // 2. Transacciones
        const txData = await fetchTransactions(state.filterDateFrom, state.filterDateTo);
        state.transactions = txData;
        
        const incCount = txData.filter(t => t.type === 'income').length;
        const outCount = txData.filter(t => t.type === 'outcome').length;
        
        if (cajaIncomesCount) cajaIncomesCount.textContent = `${incCount} transacciones`;
        if (cajaOutcomesCount) cajaOutcomesCount.textContent = `${outCount} transacciones`;
        
        renderLedger();
    } catch (e) {
        showToast('Error', 'No se pudieron cargar los datos financieros de la caja.', 'error');
        console.error(e);
    }
}

export function renderLedger() {
    if (!ledgerRows) return;
    ledgerRows.innerHTML = '';
    
    const query = searchLedger ? searchLedger.value.trim().toLowerCase() : '';
    
    const filtered = state.transactions.filter(t => {
        if (state.activeTxTypeFilter !== 'all' && t.type !== state.activeTxTypeFilter) {
            return false;
        }
        return t.description.toLowerCase().includes(query) || 
               t.category.toLowerCase().includes(query) || 
               t.type.toLowerCase().includes(query);
    });

    if (ledgerCountLabel) {
        ledgerCountLabel.textContent = `Mostrando ${filtered.length} de ${state.transactions.length} transacciones`;
    }

    if (filtered.length === 0) {
        if (emptyLedgerMsg) emptyLedgerMsg.style.display = 'block';
        return;
    }
    
    if (emptyLedgerMsg) emptyLedgerMsg.style.display = 'none';

    filtered.forEach(tx => {
        const row = document.createElement('tr');
        const date = new Date(tx.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const sign = tx.type === 'income' ? '+' : '-';
        const classAmount = tx.type === 'income' ? 'tx-amount-col tx-income' : 'tx-amount-col tx-outcome';
        const typeBadge = tx.type === 'income' ? 
            `<span class="tx-type-badge tx-type-income">📈 Ingreso</span>` : 
            `<span class="tx-type-badge tx-type-outcome">📉 Egreso</span>`;
            
        const orderLink = tx.order_id ? 
            `<span class="tx-order-link">Mesa/Comanda #${tx.order_id}</span>` : 
            `<span style="color: var(--color-text-muted); font-size: 11px;">Manual</span>`;
        
        row.innerHTML = `
            <td style="color: var(--color-text-muted); font-size: 12px;">${dateStr}</td>
            <td>${typeBadge}</td>
            <td><strong>${tx.description}</strong></td>
            <td><span class="ledger-category-badge badge-${tx.category}">${getCategoryLabel(tx.category)}</span></td>
            <td>${orderLink}</td>
            <td class="${classAmount}" style="text-align: right;">${sign}$${tx.amount.toFixed(2)}</td>
        `;
        
        ledgerRows.appendChild(row);
    });
}

export function getCategoryLabel(cat) {
    const labels = {
        venta: '💰 Venta',
        insumos: '🛒 Insumos',
        servicios: '💡 Servicios',
        personal: '🧑‍🍳 Personal',
        caja_inicial: '🔑 Apertura',
        otros: '⚙️ Otros'
    };
    return labels[cat] || cat;
}

export function updateTransactionCategories() {
    if (!txCategorySelect) return;
    const checkedRadio = document.querySelector('input[name="tx-type"]:checked');
    const type = checkedRadio ? checkedRadio.value : 'income';
    txCategorySelect.innerHTML = '';
    
    if (type === 'income') {
        txCategorySelect.innerHTML = `
            <option value="caja_inicial">🔑 Apertura de Caja</option>
            <option value="venta">💰 Venta Manual</option>
            <option value="otros" selected>⚙️ Otros Conceptos</option>
        `;
    } else {
        txCategorySelect.innerHTML = `
            <option value="insumos" selected>🛒 Insumos y Mercadería</option>
            <option value="servicios">💡 Servicios Públicos</option>
            <option value="personal">🧑‍🍳 Salarios / Personal</option>
            <option value="otros">⚙️ Otros Conceptos</option>
        `;
    }
}

export async function submitTransaction(e) {
    e.preventDefault();
    
    const checkedRadio = document.querySelector('input[name="tx-type"]:checked');
    const type = checkedRadio ? checkedRadio.value : 'income';
    const amountVal = document.getElementById('tx-amount');
    const amount = amountVal ? (parseFloat(amountVal.value) || 0) : 0;
    const category = txCategorySelect ? txCategorySelect.value : 'otros';
    const descInput = document.getElementById('tx-description');
    const description = descInput ? descInput.value.trim() : '';
    
    if (amount <= 0 || !description) {
        showToast('Error', 'Por favor ingresa un monto mayor a cero y el concepto del movimiento.', 'error');
        return;
    }
    
    try {
        await submitTransactionApi({
            type: type,
            amount: amount,
            category: category,
            description: description
        });
        
        showToast('Registrado', 'Transacción guardada correctamente.', 'success');
        
        if (amountVal) amountVal.value = '';
        if (descInput) descInput.value = '';
        
        await loadCajaData();
    } catch (err) {
        showToast('Error', err.message || 'No se pudo guardar la transacción.', 'error');
    }
}

export function updateChart(dailyStats) {
    const canvas = document.getElementById('cashflow-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (dailyStats.length === 0) {
        dailyStats = [{ date: new Date().toISOString().split('T')[0], income: 0, outcome: 0 }];
    }
    
    const labels = dailyStats.map(d => {
        const parts = d.date.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}`;
        }
        return d.date;
    });
    
    const incomesData = dailyStats.map(d => d.income);
    const outcomesData = dailyStats.map(d => d.outcome);
    
    if (state.cashFlowChart) {
        state.cashFlowChart.destroy();
    }
    
    state.cashFlowChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ingresos ($)',
                    data: incomesData,
                    backgroundColor: '#10b981',
                    borderRadius: 6,
                    borderWidth: 0,
                    barPercentage: 0.5
                },
                {
                    label: 'Egresos ($)',
                    data: outcomesData,
                    backgroundColor: '#f43f5e',
                    borderRadius: 6,
                    borderWidth: 0,
                    barPercentage: 0.5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Plus Jakarta Sans', weight: '600', size: 11 }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } }
                }
            }
        }
    });
}

export function updateCategoryChart(expensesByCat) {
    const canvas = document.getElementById('category-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const categoriesMap = {
        insumos: { label: 'Insumos', color: '#f59e0b' },
        servicios: { label: 'Servicios', color: '#ec4899' },
        personal: { label: 'Personal', color: '#6366f1' },
        otros: { label: 'Otros', color: '#94a3b8' }
    };
    
    const labels = [];
    const values = [];
    const colors = [];
    
    let total = 0;
    for (const key in categoriesMap) {
        const val = expensesByCat[key] || 0;
        total += val;
        labels.push(categoriesMap[key].label);
        values.push(val);
        colors.push(categoriesMap[key].color);
    }
    
    if (total === 0) {
        labels.push('Sin Egresos');
        values.push(1);
        colors.push('rgba(255,255,255,0.05)');
    }
    
    if (state.categoryChart) {
        state.categoryChart.destroy();
    }
    
    state.categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Plus Jakarta Sans', size: 11 }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

export function renderTopProducts(topProducts) {
    if (!topProductsList) return;
    topProductsList.innerHTML = '';
    
    if (topProducts.length === 0) {
        topProductsList.innerHTML = `
            <div class="empty-ledger-message">
                <p>Sin datos de ventas en este período.</p>
            </div>
        `;
        return;
    }
    
    const maxQty = Math.max(...topProducts.map(p => p.qty || 1));
    
    topProducts.forEach((prod, idx) => {
        const rank = idx + 1;
        let rankClass = 'rank-default';
        if (rank === 1) rankClass = 'rank-1';
        else if (rank === 2) rankClass = 'rank-2';
        else if (rank === 3) rankClass = 'rank-3';
        
        const pct = ((prod.qty / maxQty) * 100).toFixed(0);
        
        const row = document.createElement('div');
        row.className = 'top-product-row';
        row.innerHTML = `
            <div class="top-rank ${rankClass}">${rank}</div>
            <div class="top-product-info">
                <div class="top-product-name">${prod.name}</div>
                <div class="top-product-bar">
                    <div class="top-product-fill" style="width: ${pct}%"></div>
                </div>
            </div>
            <div class="top-product-stats">
                <span class="top-product-qty">${prod.qty} uds.</span>
                <span class="top-product-revenue">$${prod.revenue.toFixed(2)}</span>
            </div>
        `;
        topProductsList.appendChild(row);
    });
}

export function handlePresetChange(preset) {
    state.selectedPreset = preset;
    
    if (preset === 'custom') {
        if (dateRangeInputs) dateRangeInputs.style.display = 'flex';
        return;
    }
    
    if (dateRangeInputs) dateRangeInputs.style.display = 'none';
    
    const today = new Date();
    
    if (preset === 'all') {
        state.filterDateFrom = '';
        state.filterDateTo = '';
    } else if (preset === 'today') {
        const todayStr = today.toISOString().split('T')[0];
        state.filterDateFrom = todayStr;
        state.filterDateTo = todayStr;
    } else if (preset === 'week') {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(today.setDate(diff));
        
        state.filterDateFrom = startOfWeek.toISOString().split('T')[0];
        state.filterDateTo = new Date().toISOString().split('T')[0];
    } else if (preset === 'month') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        state.filterDateFrom = startOfMonth.toISOString().split('T')[0];
        state.filterDateTo = new Date().toISOString().split('T')[0];
    }
    
    if (filterDateFromInput && filterDateToInput) {
        if (state.filterDateFrom && state.filterDateTo) {
            filterDateFromInput.value = state.filterDateFrom;
            filterDateToInput.value = state.filterDateTo;
        } else {
            filterDateFromInput.value = '';
            filterDateToInput.value = '';
        }
    }
    
    loadCajaData();
}

export function applyCustomDates() {
    const fromVal = filterDateFromInput ? filterDateFromInput.value : '';
    const toVal = filterDateToInput ? filterDateToInput.value : '';
    
    if (!fromVal || !toVal) {
        showToast('Error', 'Debes seleccionar ambas fechas.', 'error');
        return;
    }
    
    if (new Date(fromVal) > new Date(toVal)) {
        showToast('Error', 'La fecha de inicio no puede ser posterior a la fecha de fin.', 'error');
        return;
    }
    
    state.filterDateFrom = fromVal;
    state.filterDateTo = toVal;
    
    loadCajaData();
}

export function triggerPDFGeneration() {
    generatePDFReport();
}
