import { state } from './state.js';
import { showToast } from './utils.js';
import { fetchProducts, fetchOrders, submitOrder, fetchCategories } from './api.js';

// DOM Elements inside module scope
const menuGrid = document.getElementById('menu-grid');
const ticketItemsContainer = document.getElementById('ticket-items');
const orderIdDisplay = document.getElementById('display-order-id');
const tableSelect = document.getElementById('order-table');
const dinersInput = document.getElementById('order-diners');
const orderNotes = document.getElementById('order-notes');
const ticketSubtotal = document.getElementById('ticket-subtotal');
const ticketTotal = document.getElementById('ticket-total');
const btnPrint = document.getElementById('btn-print');
const searchProduct = document.getElementById('search-product');
const posCategoryTabs = document.getElementById('pos-category-tabs');

export async function refreshPOSData() {
    try {
        const categories = await fetchCategories();
        state.categories = categories;
        
        const prodData = await fetchProducts();
        state.products = prodData;
        
        renderCategoryTabs();
        renderMenu();
        
        const allOrders = await fetchOrders();
        state.nextOrderId = allOrders.length > 0 ? (Math.max(...allOrders.map(o => o.id)) + 1) : 101;
        if (orderIdDisplay) {
            orderIdDisplay.textContent = `Orden #${state.nextOrderId}`;
        }
    } catch (e) {
        showToast('Error', 'No se pudieron sincronizar los productos de la base de datos.', 'error');
        console.error(e);
    }
}

export function renderMenu() {
    if (!menuGrid) return;
    menuGrid.innerHTML = '';
    
    const query = searchProduct ? searchProduct.value.trim().toLowerCase() : '';
    
    const filtered = state.products.filter(item => {
        const matchCategory = state.currentCategory === 'all' || item.category === state.currentCategory;
        const matchQuery = item.name.toLowerCase().includes(query) || 
                           (item.description && item.description.toLowerCase().includes(query));
        return matchCategory && matchQuery;
    });

    if (filtered.length === 0) {
        menuGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted); padding: 40px;">
                <p>No se encontraron productos en la carta.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'menu-item';
        itemEl.setAttribute('data-cat', item.category);
        itemEl.innerHTML = `
            <div class="menu-item-info">
                <span class="item-cat-badge">${getCategoryName(item.category)}</span>
                <span class="item-name">${item.name}</span>
                <p class="item-desc">${item.description || 'Sin descripción'}</p>
            </div>
            <span class="item-price">$${item.price.toFixed(2)}</span>
        `;
        itemEl.addEventListener('click', () => addToTicket(item));
        menuGrid.appendChild(itemEl);
    });
}

export function renderCategoryTabs() {
    if (!posCategoryTabs) return;
    posCategoryTabs.innerHTML = '';
    
    // Always add "Todos"
    const allBtn = document.createElement('button');
    allBtn.className = 'tab-btn';
    if (state.currentCategory === 'all') allBtn.classList.add('active');
    allBtn.setAttribute('data-category', 'all');
    allBtn.textContent = 'Todos';
    posCategoryTabs.appendChild(allBtn);
    
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        if (state.currentCategory === cat.id) btn.classList.add('active');
        btn.setAttribute('data-category', cat.id);
        btn.textContent = `${cat.icon} ${cat.name}`;
        posCategoryTabs.appendChild(btn);
    });
    
    // Bind click handlers to newly created tabs
    const tabBtns = posCategoryTabs.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            state.currentCategory = target.getAttribute('data-category');
            renderMenu();
        });
    });
}

export function getCategoryName(cat) {
    const found = state.categories.find(c => c.id === cat);
    return found ? `${found.icon} ${found.name}` : cat;
}

export function addToTicket(product) {
    const existingIndex = state.activeTicket.findIndex(item => item.id === product.id);
    
    if (existingIndex > -1) {
        state.activeTicket[existingIndex].quantity += 1;
    } else {
        state.activeTicket.push({
            id: product.id,
            name: product.name,
            price: product.price,
            category: product.category,
            quantity: 1,
            notes: ''
        });
    }
    
    renderTicket();
    showToast('Añadido', `${product.name} agregado a la comanda.`, 'info');
}

export function renderTicket() {
    if (!ticketItemsContainer) return;
    
    if (state.activeTicket.length === 0) {
        ticketItemsContainer.innerHTML = `
            <div class="empty-ticket-message">
                <span>📝</span>
                <p>Agrega productos del menú para comenzar la comanda.</p>
            </div>
        `;
        if (ticketSubtotal) ticketSubtotal.textContent = '$0.00';
        if (ticketTotal) ticketTotal.textContent = '$0.00';
        return;
    }

    ticketItemsContainer.innerHTML = '';
    let sub = 0;
    
    state.activeTicket.forEach((item, index) => {
        const itemSub = item.price * item.quantity;
        sub += itemSub;
        
        const row = document.createElement('div');
        row.className = 'ticket-item-row';
        row.innerHTML = `
            <div class="item-row-top">
                <div class="item-qty-name">
                    <div class="item-qty-controls">
                        <button class="qty-btn" onclick="adjustQty(${index}, -1)">-</button>
                        <span class="qty-val">${item.quantity}</span>
                        <button class="qty-btn" onclick="adjustQty(${index}, 1)">+</button>
                    </div>
                    <span class="ticket-item-name">${item.name}</span>
                </div>
                <div class="ticket-item-right">
                    <span class="ticket-item-price">$${itemSub.toFixed(2)}</span>
                    <button class="btn-remove-item" onclick="removeItem(${index})">✕</button>
                </div>
            </div>
            <input type="text" class="item-row-note" placeholder="Notas: sin cebolla, hielo..." 
                   value="${item.notes}" oninput="updateItemNotes(${index}, this.value)">
        `;
        ticketItemsContainer.appendChild(row);
    });

    if (ticketSubtotal) ticketSubtotal.textContent = `$${sub.toFixed(2)}`;
    if (ticketTotal) ticketTotal.textContent = `$${sub.toFixed(2)}`;
}

// Bind to window object for inline HTML handlers
window.adjustQty = function(index, delta) {
    state.activeTicket[index].quantity += delta;
    if (state.activeTicket[index].quantity <= 0) {
        state.activeTicket.splice(index, 1);
    }
    renderTicket();
};

window.removeItem = function(index) {
    const item = state.activeTicket[index];
    state.activeTicket.splice(index, 1);
    renderTicket();
    showToast('Removido', `${item.name} eliminado de la comanda.`, 'info');
};

window.updateItemNotes = function(index, value) {
    state.activeTicket[index].notes = value;
};

export function clearActiveTicket() {
    if (state.activeTicket.length === 0) return;
    state.activeTicket = [];
    if (orderNotes) orderNotes.value = '';
    renderTicket();
    showToast('Limpio', 'Se borraron los productos de la comanda.', 'info');
}

export async function submitActiveOrder() {
    if (state.activeTicket.length === 0) {
        showToast('Comanda Vacía', 'Agrega productos a la comanda antes de enviarla.', 'error');
        return;
    }
    
    const table = tableSelect ? tableSelect.value : 'Mesa';
    const diners = dinersInput ? (parseInt(dinersInput.value) || 1) : 1;
    const notes = orderNotes ? orderNotes.value.trim() : '';
    const printTargetRadio = document.querySelector('input[name="print-target"]:checked');
    const target = printTargetRadio ? printTargetRadio.value : 'auto';
    
    const orderData = {
        order: {
            table: table,
            diners: diners,
            notes: notes
        },
        items: state.activeTicket,
        target: target
    };

    try {
        if (btnPrint) {
            btnPrint.disabled = true;
            btnPrint.classList.add('loading');
            btnPrint.textContent = 'Enviando...';
        }
        
        const data = await submitOrder(orderData);
        
        showToast('¡Comanda Guardada!', 'El pedido fue guardado e impreso correctamente.', 'success');
        state.activeTicket = [];
        if (orderNotes) orderNotes.value = '';
        renderTicket();
        
        // Navegar al tablero para ver el pedido
        const boardTab = document.querySelector('.nav-item[data-tab="board"]');
        if (boardTab) boardTab.click();
    } catch (e) {
        showToast('Error', e.message || 'No se puede comunicar con el servidor POS.', 'error');
    } finally {
        if (btnPrint) {
            btnPrint.disabled = false;
            btnPrint.classList.remove('loading');
            btnPrint.innerHTML = '<span class="btn-icon">🖨️</span><span class="btn-text">Imprimir y Guardar</span>';
        }
    }
}

export function previewOrderInBrowser() {
    if (state.activeTicket.length === 0) {
        showToast('Comanda vacía', 'No hay elementos para previsualizar.', 'error');
        return;
    }
    
    const browserPrintArea = document.getElementById('browser-print-ticket');
    if (!browserPrintArea) return;
    
    let itemsRowsHtml = '';
    let total = 0;
    
    state.activeTicket.forEach(item => {
        const itemSubtotal = item.price * item.quantity;
        total += itemSubtotal;
        
        itemsRowsHtml += `
            <tr>
                <td style="width: 10%">${item.quantity}x</td>
                <td style="width: 60%">${item.name}</td>
                <td style="width: 30%; text-align: right;">$${itemSubtotal.toFixed(2)}</td>
            </tr>
        `;
        if (item.notes) {
            itemsRowsHtml += `
                <tr>
                    <td colspan="3" class="print-item-notes">   * Nota: ${item.notes}</td>
                </tr>
            `;
        }
    });

    const dateStr = new Date().toLocaleString();
    
    browserPrintArea.innerHTML = `
        <div class="print-ticket-container">
            <div class="print-header">*** KOMA BISTRO ***</div>
            <div class="print-subheader">Ticket de Comanda Local</div>
            <div class="print-divider"></div>
            
            <div class="print-table-info">
                MESA: ${tableSelect ? tableSelect.value.toUpperCase() : ''}<br>
                ORDEN: Tentativa #${state.nextOrderId}<br>
                PERSONAS: ${dinersInput ? dinersInput.value : 1}
            </div>
            <div class="print-subheader">Fecha: ${dateStr}</div>
            
            <div class="print-divider"></div>
            
            <table class="print-item-table">
                <thead>
                    <tr>
                        <th style="text-align: left;">Cant</th>
                        <th style="text-align: left;">Item</th>
                        <th style="text-align: right;">Precio</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRowsHtml}
                </tbody>
            </table>
            
            <div class="print-divider"></div>
            <div style="text-align: right; font-weight: bold; font-size: 13px; margin: 5px 0;">
                TOTAL: $${total.toFixed(2)}
            </div>
            
            ${orderNotes && orderNotes.value ? `
                <div class="print-divider"></div>
                <div class="print-notes-section">
                    <strong>NOTAS GENERALES:</strong><br>
                    ${orderNotes.value}
                </div>
            ` : ''}
            
            <div class="print-divider"></div>
            <div style="font-size: 10px; margin-top: 15px;">
                Previsualización navegador
            </div>
        </div>
    `;

    window.print();
}
