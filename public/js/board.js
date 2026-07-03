import { state } from './state.js';
import { showToast } from './utils.js';
import { fetchOrders, updateOrderStatusApi } from './api.js';

// DOM Elements
const boardPendingList = document.getElementById('board-pending-list');
const boardServedList = document.getElementById('board-served-list');
const countPending = document.getElementById('count-pending');
const countServed = document.getElementById('count-served');
const badgeActiveOrders = document.getElementById('badge-active-orders');

export async function loadBoardData() {
    if (!boardPendingList || !boardServedList) return;
    
    try {
        const activeOrders = await fetchOrders('active');
        state.orders = activeOrders;
        
        boardPendingList.innerHTML = '';
        boardServedList.innerHTML = '';
        
        let pendingCount = 0;
        let servedCount = 0;
        
        state.orders.forEach(order => {
            const card = document.createElement('div');
            card.className = `order-card status-${order.status}`;
            
            // Calc time elapsed
            const created = new Date(order.created_at);
            const diffMs = new Date() - created;
            const diffMins = Math.floor(diffMs / 60000);
            
            let timeText = `${diffMins} min`;
            if (diffMins < 1) timeText = 'Hace un momento';
            
            let itemsHtml = '';
            order.items.forEach(item => {
                itemsHtml += `
                    <div class="order-card-item">
                        <span class="item-qty">${item.quantity}x</span>
                        <span class="item-name">${item.name}</span>
                    </div>
                `;
                if (item.notes) {
                    itemsHtml += `<div class="order-card-item-notes">${item.notes}</div>`;
                }
            });
            
            let notesHtml = '';
            if (order.notes) {
                notesHtml = `<div class="order-card-notes"><strong>Notas:</strong> ${order.notes}</div>`;
            }
            
            let actionButtons = '';
            if (order.status === 'pending') {
                actionButtons = `
                    <button class="order-card-btn btn-serve-order" onclick="updateOrderStatus(${order.id}, 'served')">
                        ✓ Servir Comida
                    </button>
                `;
            } else if (order.status === 'served') {
                actionButtons = `
                    <button class="order-card-btn btn-bill-order" onclick="updateOrderStatus(${order.id}, 'completed')">
                        💳 Cobrar Mesa
                    </button>
                `;
            }
            
            card.innerHTML = `
                <div class="order-card-top">
                    <div class="order-card-meta">
                        <span class="order-card-table">${order.table_name.toUpperCase()}</span>
                        <span class="order-card-id">Orden #${order.id} | Pers: ${order.diners}</span>
                    </div>
                    <span class="order-card-time">${timeText}</span>
                </div>
                
                <div class="order-card-items-list">
                    ${itemsHtml}
                </div>
                
                ${notesHtml}
                
                <div class="order-card-footer">
                    <span class="order-card-total">$${order.total.toFixed(2)}</span>
                    <div class="order-card-actions">
                        <button class="order-card-btn btn-cancel-order" onclick="updateOrderStatus(${order.id}, 'cancelled')">
                            ✕ Cancelar
                        </button>
                        ${actionButtons}
                    </div>
                </div>
            `;
            
            if (order.status === 'pending') {
                boardPendingList.appendChild(card);
                pendingCount++;
            } else if (order.status === 'served') {
                boardServedList.appendChild(card);
                servedCount++;
            }
        });
        
        if (countPending) countPending.textContent = pendingCount;
        if (countServed) countServed.textContent = servedCount;
        
        if (pendingCount === 0) {
            boardPendingList.innerHTML = `
                <div style="text-align: center; color: var(--color-text-muted); padding: 40px; margin: auto;">
                    <p>No hay comandas pendientes de preparación.</p>
                </div>
            `;
        }
        if (servedCount === 0) {
            boardServedList.innerHTML = `
                <div style="text-align: center; color: var(--color-text-muted); padding: 40px; margin: auto;">
                    <p>No hay mesas servidas activas.</p>
                </div>
            `;
        }
    } catch (e) {
        showToast('Error', 'No se pudieron cargar las comandas del tablero.', 'error');
        console.error(e);
    }
}

// Bind to window scope for onclick actions in dynamically rendered HTML
window.updateOrderStatus = async function(id, status) {
    let confirmMsg = '';
    if (status === 'cancelled') {
        confirmMsg = '¿Estás seguro de que deseas cancelar esta comanda?';
    } else if (status === 'completed') {
        confirmMsg = '¿Confirmas el cobro y cierre de esta mesa? Se generará una venta en caja.';
    }
    
    if (confirmMsg && !confirm(confirmMsg)) return;

    try {
        const data = await updateOrderStatusApi(id, status);
        showToast('Actualizado', `Comanda #${id} actualizada correctamente.`, 'success');
        await loadBoardData();
    } catch (e) {
        showToast('Error', e.message || 'No se pudo actualizar el estado.', 'error');
    }
};

export async function updateActiveOrdersCount() {
    try {
        const active = await fetchOrders('active');
        if (badgeActiveOrders) {
            badgeActiveOrders.textContent = active.length;
            badgeActiveOrders.style.display = active.length > 0 ? 'inline-block' : 'none';
        }
    } catch (e) {
        console.error("Error consultando conteo de comandas", e);
    }
}
