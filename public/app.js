import { state } from './js/state.js';
import { showToast } from './js/utils.js';
import { fetchStatus, resetDatabaseApi } from './js/api.js';
import { refreshPOSData, renderMenu, clearActiveTicket, submitActiveOrder, previewOrderInBrowser } from './js/pos.js';
import { loadBoardData, updateActiveOrdersCount } from './js/board.js';
import { loadCajaData, renderLedger, updateTransactionCategories, submitTransaction, handlePresetChange, applyCustomDates } from './js/finance.js';
import { loadMenuEditorData, closeProductModal, submitProductForm } from './js/menu.js';
import { generatePDFReport } from './js/reports.js';

// DOM Elements
const statusKitchen = document.getElementById('status-kitchen');
const statusBar = document.getElementById('status-bar');
const searchProduct = document.getElementById('search-product');
const categoryBtns = document.querySelectorAll('.tab-btn');
const btnClear = document.getElementById('btn-clear');
const btnPrint = document.getElementById('btn-print');
const btnBrowserPrint = document.getElementById('btn-browser-print');
const searchLedger = document.getElementById('search-ledger');
const formTransaction = document.getElementById('form-transaction');
const txTypeRadios = document.getElementsByName('tx-type');
const txCategorySelect = document.getElementById('tx-category');
const filterTxType = document.getElementById('filter-tx-type');
const btnApplyDates = document.getElementById('btn-apply-dates');
const btnGeneratePdf = document.getElementById('btn-generate-pdf');
const btnNewProduct = document.getElementById('btn-new-product');
const btnCancelProductModal = document.getElementById('btn-cancel-product-modal');
const btnCloseProductModal = document.getElementById('btn-close-product-modal');
const formProduct = document.getElementById('form-product');
const btnResetDb = document.getElementById('btn-reset-db');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupNavigation();
    setupEventListeners();
    
    // Initial load
    await refreshPOSData();
    updateActiveOrdersCount();
    
    // Background polling
    checkPrintersStatus();
    setInterval(checkPrintersStatus, 5000);
    setInterval(updateActiveOrdersCount, 10000);
}

// 1. SPA Navigation
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.app-view');
    const viewTitle = document.getElementById('current-view-title');
    const viewDesc = document.getElementById('current-view-desc');
    
    const titles = {
        pos: { title: "Nueva Comanda", desc: "Crea y envía pedidos directamente a cocina o barra." },
        board: { title: "Tablero de Comandas", desc: "Gestiona los estados de preparación y entrega de mesas." },
        caja: { title: "Caja y Finanzas", desc: "Historial de transacciones de ingresos y egresos, balance general de operación." },
        menu: { title: "Carta y Menú", desc: "Administra el catálogo de platos, bebidas, postres y modifica sus precios." },
        config: { title: "Configuración del Sistema", desc: "Pruebas de comunicación de impresoras térmicas y utilidades de base de datos." }
    };

    navItems.forEach(item => {
        item.addEventListener('click', async () => {
            const tab = item.getAttribute('data-tab');
            state.currentTab = tab;
            
            navItems.forEach(i => i.classList.remove('active'));
            views.forEach(v => v.classList.remove('active-view'));
            
            item.classList.add('active');
            
            const targetView = document.getElementById(`view-${tab}`);
            if (targetView) targetView.classList.add('active-view');
            
            if (viewTitle && viewDesc && titles[tab]) {
                viewTitle.textContent = titles[tab].title;
                viewDesc.textContent = titles[tab].desc;
            }
            
            // Lazy load tab data
            if (tab === 'pos') {
                await refreshPOSData();
            } else if (tab === 'board') {
                await loadBoardData();
            } else if (tab === 'caja') {
                await loadCajaData();
            } else if (tab === 'menu') {
                await loadMenuEditorData();
            }
        });
    });
}

// 2. Global Event Listeners
function setupEventListeners() {
    // POS Menu search
    if (searchProduct) {
        searchProduct.addEventListener('input', renderMenu);
    }
    
    // POS Category tabs
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.currentCategory = e.target.getAttribute('data-category');
            renderMenu();
        });
    });
    
    // Clear ticket
    if (btnClear) {
        btnClear.addEventListener('click', clearActiveTicket);
    }
    
    // Submit order
    if (btnPrint) {
        btnPrint.addEventListener('click', submitActiveOrder);
    }
    
    // Preview comanda in browser
    if (btnBrowserPrint) {
        btnBrowserPrint.addEventListener('click', previewOrderInBrowser);
    }
    
    // Save manual transaction
    if (formTransaction) {
        formTransaction.addEventListener('submit', submitTransaction);
    }
    
    // Type change in manual transaction (Income/Outcome)
    txTypeRadios.forEach(radio => {
        radio.addEventListener('change', updateTransactionCategories);
    });
    
    // Search history/ledger
    if (searchLedger) {
        searchLedger.addEventListener('input', renderLedger);
    }
    
    // Transaction type filters
    if (filterTxType) {
        filterTxType.addEventListener('change', (e) => {
            state.activeTxTypeFilter = e.target.value;
            renderLedger();
        });
    }

    // Date presets
    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            presetBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            handlePresetChange(e.target.getAttribute('data-preset'));
        });
    });

    // Custom date range apply
    if (btnApplyDates) {
        btnApplyDates.addEventListener('click', applyCustomDates);
    }

    // PDF report export
    if (btnGeneratePdf) {
        btnGeneratePdf.addEventListener('click', generatePDFReport);
    }
    
    // Products modals
    if (btnNewProduct) {
        btnNewProduct.addEventListener('click', () => window.openProductModal());
    }
    if (btnCancelProductModal) {
        btnCancelProductModal.addEventListener('click', closeProductModal);
    }
    if (btnCloseProductModal) {
        btnCloseProductModal.addEventListener('click', closeProductModal);
    }
    if (formProduct) {
        formProduct.addEventListener('submit', submitProductForm);
    }
    
    // Hardware printer tests
    document.querySelectorAll('.btn-test-printer').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.getAttribute('data-target');
            testPrinter(target);
        });
    });
    
    // Reset database
    if (btnResetDb) {
        btnResetDb.addEventListener('click', handleResetDatabase);
    }
}

// 3. Hardware Printer status checks
async function checkPrintersStatus() {
    try {
        const status = await fetchStatus();
        
        // Kitchen (lp0)
        if (statusKitchen) {
            statusKitchen.className = 'status-indicator';
            if (status.kitchen.connected) {
                statusKitchen.classList.add(status.kitchen.writable ? 'writable' : 'connected');
            }
        }
        
        // Bar (lp1)
        if (statusBar) {
            statusBar.className = 'status-indicator';
            if (status.bar.connected) {
                statusBar.classList.add(status.bar.writable ? 'writable' : 'connected');
            }
        }
    } catch (err) {
        if (statusKitchen) statusKitchen.className = 'status-indicator';
        if (statusBar) statusBar.className = 'status-indicator';
    }
}

// 4. Test physical printer output
async function testPrinter(target) {
    try {
        const dummyOrder = {
            order: {
                id: 999,
                table: 'Test',
                diners: 1,
                notes: 'Impresión de prueba de hardware.'
            },
            items: [{
                name: `Prueba de Rodillo y Corte (${target.toUpperCase()})`,
                quantity: 1,
                category: target === 'cocina' ? 'food' : 'drink',
                notes: 'Prueba exitosa'
            }],
            target: target
        };
        
        const response = await fetch('/api/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dummyOrder)
        });
        
        const data = await response.json();
        if (response.ok && data.success) {
            showToast('Prueba Enviada', `Imprimiendo en dispositivo de ${target.toUpperCase()}`, 'success');
        } else {
            showToast('Error de Impresión', data.message || 'No se pudo comunicar con el hardware.', 'error');
        }
    } catch (e) {
        showToast('Error de Red', 'No se pudo enviar la comanda de prueba.', 'error');
    }
}

// 5. Database reset administration
async function handleResetDatabase() {
    if (!confirm('¿ESTÁS ABSOLUTAMENTE SEGURO? Se borrarán todas las comandas y transacciones, y se restaurarán los productos por defecto.')) return;
    
    try {
        await resetDatabaseApi();
        showToast('Base de Datos Restablecida', 'Se limpió todo el historial y productos.', 'success');
        
        state.activeTicket = [];
        if (formTransaction) formTransaction.reset();
        
        const posTab = document.querySelector('.nav-item[data-tab="pos"]');
        if (posTab) posTab.click();
    } catch(e) {
        showToast('Error', e.message || 'Ocurrió un error al intentar resetear.', 'error');
    }
}
