import { state } from './state.js';
import { showToast } from './utils.js';
import { fetchProducts, saveProductApi, deleteProductApi } from './api.js';
import { getCategoryName } from './pos.js';
import { populateProductCategoryDropdown } from './categories.js';

// DOM Elements
const menuRows = document.getElementById('menu-rows');
const productModal = document.getElementById('product-modal');
const formProduct = document.getElementById('form-product');

export async function loadMenuEditorData() {
    try {
        const prodData = await fetchProducts();
        state.products = prodData;
        renderMenuEditor();
    } catch (e) {
        showToast('Error', 'No se pudo sincronizar la carta.', 'error');
    }
}

export function renderMenuEditor() {
    if (!menuRows) return;
    menuRows.innerHTML = '';
    
    if (state.products.length === 0) {
        menuRows.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--color-text-muted); padding: 30px;">
                    La carta de productos está vacía. Registra uno nuevo.
                </td>
            </tr>
        `;
        return;
    }
    
    state.products.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-family: var(--font-mono); font-size: 12px; color: var(--color-text-muted);">${p.id}</td>
            <td><span class="menu-table-badge" style="background: rgba(255,255,255,0.03); color: var(--color-text-main);">${getCategoryName(p.category)}</span></td>
            <td><strong>${p.name}</strong></td>
            <td style="color: var(--color-text-muted); font-size: 13px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.description || 'Sin descripción'}</td>
            <td class="menu-table-price">$${p.price.toFixed(2)}</td>
            <td class="menu-table-actions">
                <button class="action-btn action-edit" onclick="openProductModal('${p.id}')" title="Editar">✏️</button>
                <button class="action-btn action-delete" onclick="deleteProduct('${p.id}')" title="Dar de baja">🗑️</button>
            </td>
        `;
        menuRows.appendChild(row);
    });
}

export function openProductModal(productId = '') {
    if (!productModal) return;
    populateProductCategoryDropdown();
    
    const modalTitle = document.getElementById('product-modal-title');
    const form = document.getElementById('form-product');
    
    if (form) form.reset();
    const prodIdInput = document.getElementById('prod-id');
    if (prodIdInput) prodIdInput.value = productId;
    
    if (productId) {
        if (modalTitle) modalTitle.textContent = 'Editar Producto';
        const product = state.products.find(p => p.id === productId);
        if (product) {
            const nameInput = document.getElementById('prod-name');
            const categorySelect = document.getElementById('prod-category');
            const priceInput = document.getElementById('prod-price');
            const descTextarea = document.getElementById('prod-description');
            
            if (nameInput) nameInput.value = product.name;
            if (categorySelect) categorySelect.value = product.category;
            if (priceInput) priceInput.value = product.price;
            if (descTextarea) descTextarea.value = product.description || '';
        }
    } else {
        if (modalTitle) modalTitle.textContent = 'Agregar Producto';
    }
    
    productModal.classList.add('active');
}

export function closeProductModal() {
    if (productModal) productModal.classList.remove('active');
}

export async function submitProductForm(e) {
    e.preventDefault();
    
    const pidVal = document.getElementById('prod-id');
    const pid = pidVal ? pidVal.value : '';
    const nameVal = document.getElementById('prod-name');
    const name = nameVal ? nameVal.value.trim() : '';
    const categorySelect = document.getElementById('prod-category');
    const category = categorySelect ? categorySelect.value : 'food';
    const priceVal = document.getElementById('prod-price');
    const price = priceVal ? (parseFloat(priceVal.value) || 0) : 0;
    const descTextarea = document.getElementById('prod-description');
    const description = descTextarea ? descTextarea.value.trim() : '';
    
    if (!name || price < 0) {
        showToast('Error', 'Completa el nombre y precio del producto.', 'error');
        return;
    }
    
    const productData = {
        name: name,
        category: category,
        price: price,
        description: description
    };
    
    if (pid) {
        productData.id = pid;
    }
    
    try {
        await saveProductApi(productData);
        showToast('Guardado', 'El producto de la carta se actualizó.', 'success');
        closeProductModal();
        await loadMenuEditorData();
    } catch (e) {
        showToast('Error', e.message || 'Problema al comunicar con el servidor.', 'error');
    }
}

// Bind to window scope
window.openProductModal = openProductModal;

window.deleteProduct = async function(productId) {
    if (!confirm(`¿Estás seguro de que deseas dar de baja este producto del menú?`)) return;
    
    try {
        await deleteProductApi(productId);
        showToast('Dado de baja', 'El producto ya no aparecerá en el menú de comandas.', 'success');
        await loadMenuEditorData();
    } catch (e) {
        showToast('Error', e.message || 'Problema al conectar con el servidor.', 'error');
    }
};
