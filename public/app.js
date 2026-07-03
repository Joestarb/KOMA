// Datos de productos
const MENU = [
    { id: 'h1', name: 'Hamburguesa Koma', category: 'food', price: 12.50, description: 'Doble res, cheddar, salsa especial.' },
    { id: 'h2', name: 'Pizza Neon', category: 'food', price: 14.00, description: 'Mozzarella, pepperoni, miel y jalapeños.' },
    { id: 'h3', name: 'Papas Trufadas', category: 'food', price: 6.50, description: 'Papas fritas con aceite de trufa y parmesano.' },
    { id: 'h4', name: 'Tacos al Pastor', category: 'food', price: 9.00, description: '3 unidades con piña, cilantro y cebolla.' },
    
    { id: 'd1', name: 'Mojito Eléctrico', category: 'drink', price: 8.50, description: 'Ron, menta, limón, soda y curaçao azul.' },
    { id: 'd2', name: 'Cerveza IPA', category: 'drink', price: 5.50, description: 'Cerveza artesanal de lúpulo intenso.' },
    { id: 'd3', name: 'Gin Tonic Botánico', category: 'drink', price: 9.50, description: 'Ginebra, tónica, bayas de enebro y pepino.' },
    { id: 'd4', name: 'Soda de Maracuyá', category: 'drink', price: 4.00, description: 'Zumo de maracuyá y agua con gas.' },
    
    { id: 'p1', name: 'Volcán de Chocolate', category: 'dessert', price: 7.00, description: 'Relleno fundido con helado de vainilla.' },
    { id: 'p2', name: 'Cheesecake Pistacho', category: 'dessert', price: 7.50, description: 'Crema sedosa con pistacho tostado.' }
];

// Estado de la aplicación
let activeTicket = [];
let nextOrderId = 101;
let currentCategory = 'all';

// Elementos DOM
const menuGrid = document.getElementById('menu-grid');
const ticketItemsContainer = document.getElementById('ticket-items');
const orderIdDisplay = document.getElementById('display-order-id');
const tableSelect = document.getElementById('order-table');
const dinersInput = document.getElementById('order-diners');
const orderNotes = document.getElementById('order-notes');
const btnClear = document.getElementById('btn-clear');
const btnPrint = document.getElementById('btn-print');
const btnBrowserPrint = document.getElementById('btn-browser-print');
const historyList = document.getElementById('history-list');
const categoryBtns = document.querySelectorAll('.tab-btn');

// Botones de test de hardware
const btnTestKitchen = document.getElementById('btn-test-kitchen');
const btnTestBar = document.getElementById('btn-test-bar');

// Elementos de comanda manual
const btnAddCustom = document.getElementById('btn-add-custom');
const customName = document.getElementById('custom-name');
const customPrice = document.getElementById('custom-price');
const customCategory = document.getElementById('custom-category');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    renderMenu();
    updateOrderId();
    checkPrintersStatus();
    setInterval(checkPrintersStatus, 5000); // Chequear impresoras cada 5 seg
    
    // Event listeners para comanda manual
    if (btnAddCustom) {
        btnAddCustom.addEventListener('click', addCustomItemToTicket);
    }
    if (customName) {
        customName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') addCustomItemToTicket();
        });
    }
    if (customPrice) {
        customPrice.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') addCustomItemToTicket();
        });
    }
});

function addCustomItemToTicket() {
    const name = customName.value.trim();
    const priceVal = parseFloat(customPrice.value);
    const category = customCategory.value;
    
    if (!name) {
        showToast('Falta Nombre', 'Por favor ingresa el nombre del producto.', 'error');
        return;
    }
    
    const price = isNaN(priceVal) ? 0.00 : priceVal;
    
    const customProduct = {
        id: 'custom-' + Date.now(),
        name: name,
        category: category,
        price: price,
        description: 'Producto ingresado manualmente.'
    };
    
    addToTicket(customProduct);
    
    // Limpiar campos
    customName.value = '';
    customPrice.value = '';
    customName.focus();
}

// Actualizar número de orden visible
function updateOrderId() {
    orderIdDisplay.textContent = `Orden #${nextOrderId}`;
}

// Renderizar el menú filtrado por categoría
function renderMenu() {
    menuGrid.innerHTML = '';
    const filtered = currentCategory === 'all' 
        ? MENU 
        : MENU.filter(item => item.category === currentCategory);

    filtered.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'menu-item';
        itemEl.setAttribute('data-cat', item.category);
        itemEl.innerHTML = `
            <div class="menu-item-info">
                <span class="item-cat-badge">${getCategoryName(item.category)}</span>
                <span class="item-name">${item.name}</span>
                <span class="item-price">$${item.price.toFixed(2)}</span>
            </div>
        `;
        itemEl.addEventListener('click', () => addToTicket(item));
        menuGrid.appendChild(itemEl);
    });
}

function getCategoryName(cat) {
    if (cat === 'food') return 'Comida';
    if (cat === 'drink') return 'Bebida';
    if (cat === 'dessert') return 'Postre';
    return cat;
}

// Cambiar de Categoría
categoryBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        categoryBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentCategory = e.target.getAttribute('data-category');
        renderMenu();
    });
});

// Agregar item al ticket
function addToTicket(product) {
    const existingIndex = activeTicket.findIndex(item => item.id === product.id);
    
    if (existingIndex > -1) {
        activeTicket[existingIndex].quantity += 1;
    } else {
        activeTicket.push({
            ...product,
            quantity: 1,
            notes: ''
        });
    }
    
    renderTicket();
    showToast('Producto Agregado', `${product.name} añadido a la comanda.`, 'info');
}

// Renderizar la comanda activa
function renderTicket() {
    if (activeTicket.length === 0) {
        ticketItemsContainer.innerHTML = `
            <div class="empty-ticket-message">
                <span>📝</span>
                <p>Agrega productos del menú para comenzar la comanda.</p>
            </div>
        `;
        return;
    }

    ticketItemsContainer.innerHTML = '';
    activeTicket.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'ticket-item-row';
        row.innerHTML = `
            <div class="item-row-top">
                <div class="item-qty-name">
                    <div class="item-qty-controls">
                        <button class="qty-btn dec-btn" data-index="${index}">-</button>
                        <span class="qty-val">${item.quantity}</span>
                        <button class="qty-btn inc-btn" data-index="${index}">+</button>
                    </div>
                    <span class="ticket-item-name">${item.name}</span>
                </div>
                <div class="ticket-item-right">
                    <span class="ticket-item-price">$${(item.price * item.quantity).toFixed(2)}</span>
                    <button class="btn-remove-item" data-index="${index}">✕</button>
                </div>
            </div>
            <input type="text" class="item-row-note" placeholder="Instrucción especial (ej: sin hielo)..." 
                   value="${item.notes}" data-index="${index}">
        `;
        
        // Listeners para botones de incrementar/decrementar cantidad
        row.querySelector('.dec-btn').addEventListener('click', () => adjustQty(index, -1));
        row.querySelector('.inc-btn').addEventListener('click', () => adjustQty(index, 1));
        row.querySelector('.btn-remove-item').addEventListener('click', () => removeItem(index));
        
        // Listener para notas específicas por ítem
        const noteInput = row.querySelector('.item-row-note');
        noteInput.addEventListener('input', (e) => {
            activeTicket[index].notes = e.target.value;
        });

        ticketItemsContainer.appendChild(row);
    });
}

function adjustQty(index, delta) {
    activeTicket[index].quantity += delta;
    if (activeTicket[index].quantity <= 0) {
        activeTicket.splice(index, 1);
    }
    renderTicket();
}

function removeItem(index) {
    const item = activeTicket[index];
    activeTicket.splice(index, 1);
    renderTicket();
    showToast('Producto Eliminado', `${item.name} quitado de la comanda.`, 'info');
}

// Limpiar comanda activa
btnClear.addEventListener('click', () => {
    if (activeTicket.length === 0) return;
    activeTicket = [];
    orderNotes.value = '';
    renderTicket();
    showToast('Comanda Limpia', 'Se eliminaron todos los elementos.', 'info');
});

// Enviar impresión al backend silencioso
btnPrint.addEventListener('click', async () => {
    if (activeTicket.length === 0) {
        showToast('Comanda vacía', 'Agrega elementos antes de mandar a imprimir.', 'error');
        return;
    }

    const table = tableSelect.value;
    const diners = dinersInput.value;
    const notes = orderNotes.value;
    const target = document.querySelector('input[name="print-target"]:checked').value;
    
    const orderData = {
        order: {
            id: nextOrderId,
            table: table,
            diners: diners,
            notes: notes,
            timestamp: new Date().toISOString()
        },
        items: activeTicket.map(item => ({
            name: item.name,
            quantity: item.quantity,
            category: item.category,
            notes: item.notes
        })),
        target: target
    };

    try {
        btnPrint.disabled = true;
        btnPrint.classList.add('loading');
        
        const response = await fetch('/api/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast('¡Impreso!', data.message || 'Comanda enviada a las impresoras.', 'success');
            addToHistory(orderData.order, orderData.items, target, true, null);
            
            // Incrementar orden y limpiar
            nextOrderId++;
            updateOrderId();
            activeTicket = [];
            orderNotes.value = '';
            renderTicket();
        } else {
            showToast('Error de Impresión', data.error || 'No se pudo imprimir.', 'error');
            addToHistory(orderData.order, orderData.items, target, false, data.error);
        }
    } catch (err) {
        console.error(err);
        showToast('Error de Red', 'No se pudo comunicar con el servidor POS.', 'error');
        addToHistory(orderData.order, orderData.items, target, false, 'Error de comunicación.');
    } finally {
        btnPrint.disabled = false;
        btnPrint.classList.remove('loading');
    }
});

// Fallback: Imprimir en el navegador
btnBrowserPrint.addEventListener('click', () => {
    if (activeTicket.length === 0) {
        showToast('Comanda vacía', 'No hay elementos para previsualizar.', 'error');
        return;
    }

    const browserPrintArea = document.getElementById('browser-print-ticket');
    
    // Armar el ticket HTML
    let itemsRowsHtml = '';
    let total = 0;
    activeTicket.forEach(item => {
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
                MESA: ${tableSelect.value.toUpperCase()}<br>
                ORDEN: #${nextOrderId}<br>
                PERSONAS: ${dinersInput.value}
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
            
            ${orderNotes.value ? `
                <div class="print-divider"></div>
                <div class="print-notes-section">
                    <strong>NOTAS GENERALES:</strong><br>
                    ${orderNotes.value}
                </div>
            ` : ''}
            
            <div class="print-divider"></div>
            <div style="font-size: 10px; margin-top: 15px;">
                Corte manual de ticket
            </div>
        </div>
    `;

    // Disparar diálogo de impresión
    window.print();
});

// Botones de test rápido
btnTestKitchen.addEventListener('click', () => sendTestPrint('cocina', 'Test Cocina (lp0)'));
btnTestBar.addEventListener('click', () => sendTestPrint('barra', 'Test Barra (lp1)'));

async function sendTestPrint(target, label) {
    const dummyOrder = {
        order: {
            id: 999,
            table: 'Test',
            diners: 1,
            notes: 'Impresión de prueba rápida.',
            timestamp: new Date().toISOString()
        },
        items: [{
            name: `Prueba de Rodillo y Corte (${label})`,
            quantity: 1,
            category: target === 'cocina' ? 'food' : 'drink',
            notes: 'Test exitoso'
        }],
        target: target
    };
    
    try {
        const response = await fetch('/api/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dummyOrder)
        });
        const data = await response.json();
        if (response.ok && data.success) {
            showToast('Test Enviado', `Se mandó la prueba a ${target.toUpperCase()}`, 'success');
        } else {
            showToast('Error de Test', data.error || 'Fallo de puerto.', 'error');
        }
    } catch(e) {
        showToast('Error de Red', 'Servidor desconectado.', 'error');
    }
}

// Historial
function addToHistory(order, items, target, success, errorMsg) {
    const historyContainer = document.getElementById('history-list');
    
    // Remover mensaje vacío si existe
    const emptyMsg = historyContainer.querySelector('.empty-history-message');
    if (emptyMsg) emptyMsg.remove();
    
    const card = document.createElement('div');
    card.className = 'history-card';
    
    const date = new Date(order.timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const targetLabel = target === 'auto' ? 'Auto-Split' : (target === 'cocina' ? 'Cocina' : 'Barra');
    
    card.innerHTML = `
        <div class="history-card-top">
            <span class="history-card-title">Orden #${order.id} - ${order.table}</span>
            <span class="history-card-time">${timeStr}</span>
        </div>
        <div class="history-card-body">
            Destino: <strong>${targetLabel}</strong> (${items.length} items)
        </div>
        <div class="history-card-status ${success ? 'success' : 'error'}">
            ${success ? '✓ Impreso' : `✗ Error: ${errorMsg}`}
        </div>
    `;
    
    // Insertar al inicio de la lista
    historyContainer.insertBefore(card, historyContainer.firstChild);
}

// Chequear estado de las impresoras en el hardware local
async function checkPrintersStatus() {
    const kitchenIndicator = document.getElementById('status-kitchen');
    const barIndicator = document.getElementById('status-bar');
    
    try {
        const response = await fetch('/api/status');
        if (!response.ok) throw new Error();
        
        const status = await response.json();
        
        // Cocina
        kitchenIndicator.classList.remove('connected', 'writable');
        if (status.kitchen.connected) {
            kitchenIndicator.classList.add(status.kitchen.writable ? 'writable' : 'connected');
        }
        
        // Barra
        barIndicator.classList.remove('connected', 'writable');
        if (status.bar.connected) {
            barIndicator.classList.add(status.bar.writable ? 'writable' : 'connected');
        }
    } catch (err) {
        // Si el servidor Node no está corriendo
        kitchenIndicator.classList.remove('connected', 'writable');
        barIndicator.classList.remove('connected', 'writable');
    }
}

// Sistema de Toasts
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-msg">${message}</div>
        </div>
        <button class="toast-close">✕</button>
    `;
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
    
    container.appendChild(toast);
    
    // Auto remover después de 4 segundos
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 4000);
}
