import { state } from './state.js';
import { showToast } from './utils.js';
import { fetchCategories, saveCategoryApi, deleteCategoryApi } from './api.js';

// DOM Elements
const categoriesRows = document.getElementById('categories-rows');
const categoryModal = document.getElementById('category-modal');
const formCategory = document.getElementById('form-category');
const catIdInput = document.getElementById('cat-id');
const catNameInput = document.getElementById('cat-name');
const catIconInput = document.getElementById('cat-icon');

export async function loadCategoriesData() {
    try {
        const categories = await fetchCategories();
        state.categories = categories;
        renderCategoriesTable();
        populateProductCategoryDropdown();
    } catch (e) {
        showToast('Error', 'No se pudieron sincronizar las categorías.', 'error');
    }
}

export function renderCategoriesTable() {
    if (!categoriesRows) return;
    categoriesRows.innerHTML = '';
    
    if (state.categories.length === 0) {
        categoriesRows.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--color-text-muted); padding: 30px;">
                    No hay categorías registradas.
                </td>
            </tr>
        `;
        return;
    }
    
    state.categories.forEach(c => {
        const row = document.createElement('tr');
        // Prevent deleting 'otros'
        const deleteButton = c.id === 'otros' ? 
            `<button class="action-btn" style="opacity:0.3; cursor:not-allowed;" title="No se puede eliminar la categoría fallback" disabled>🗑️</button>` :
            `<button class="action-btn action-delete" onclick="deleteCategory('${c.id}')" title="Eliminar">🗑️</button>`;
            
        row.innerHTML = `
            <td style="font-family: var(--font-mono); font-size: 12px; color: var(--color-text-muted);">${c.id}</td>
            <td style="font-size: 20px; text-align: center; width: 60px;">${c.icon}</td>
            <td><strong>${c.name}</strong></td>
            <td class="menu-table-actions" style="text-align: center; width: 120px;">
                <button class="action-btn action-edit" onclick="openCategoryModal('${c.id}')" title="Editar">✏️</button>
                ${deleteButton}
            </td>
        `;
        categoriesRows.appendChild(row);
    });
}

export function populateProductCategoryDropdown() {
    const select = document.getElementById('prod-category');
    if (!select) return;
    
    const currentVal = select.value;
    select.innerHTML = '';
    
    state.categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = `${cat.icon} ${cat.name}`;
        select.appendChild(opt);
    });
    
    if (currentVal && state.categories.some(c => c.id === currentVal)) {
        select.value = currentVal;
    }
}

export function openCategoryModal(catId = '') {
    if (!categoryModal) return;
    const modalTitle = document.getElementById('category-modal-title');
    
    if (formCategory) formCategory.reset();
    
    if (catIdInput) {
        catIdInput.value = catId;
        // If editing, ID is read-only
        if (catId) {
            catIdInput.removeAttribute('placeholder');
            catIdInput.style.opacity = '0.5';
            catIdInput.readOnly = true;
        } else {
            catIdInput.placeholder = "Identificador (ej: postres)";
            catIdInput.style.opacity = '1';
            catIdInput.readOnly = false;
        }
    }
    
    if (catId) {
        if (modalTitle) modalTitle.textContent = 'Editar Categoría';
        const cat = state.categories.find(c => c.id === catId);
        if (cat) {
            if (catNameInput) catNameInput.value = cat.name;
            if (catIconInput) catIconInput.value = cat.icon;
        }
    } else {
        if (modalTitle) modalTitle.textContent = 'Agregar Categoría';
    }
    
    categoryModal.classList.add('active');
}

export function closeCategoryModal() {
    if (categoryModal) categoryModal.classList.remove('active');
}

// Auto-generate ID slug from Name (only when creating)
if (catNameInput) {
    catNameInput.addEventListener('input', () => {
        if (catIdInput && !catIdInput.readOnly) {
            const slug = catNameInput.value
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // Remove accents
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/(^_+|_+$)/g, '');
            catIdInput.value = slug;
        }
    });
}

export async function submitCategoryForm(e) {
    e.preventDefault();
    
    const id = catIdInput ? catIdInput.value.trim() : '';
    const name = catNameInput ? catNameInput.value.trim() : '';
    const icon = catIconInput ? catIconInput.value.trim() : '📦';
    
    if (!id || !name || !icon) {
        showToast('Error', 'Todos los campos son obligatorios.', 'error');
        return;
    }
    
    try {
        await saveCategoryApi({ id, name, icon });
        showToast('Guardado', 'La categoría se guardó correctamente.', 'success');
        closeCategoryModal();
        await loadCategoriesData();
    } catch (err) {
        showToast('Error', err.message || 'No se pudo guardar la categoría.', 'error');
    }
}

// Bind handlers to window scope for inline HTML actions
window.openCategoryModal = openCategoryModal;

window.deleteCategory = async function(catId) {
    if (catId === 'otros') {
        showToast('Error', 'No puedes eliminar la categoría comodín.', 'error');
        return;
    }
    
    if (!confirm('¿Estás seguro de eliminar esta categoría? Todos los productos asociados serán reasignados automáticamente a la categoría "Otros".')) return;
    
    try {
        await deleteCategoryApi(catId);
        showToast('Eliminada', 'Categoría eliminada con éxito.', 'success');
        await loadCategoriesData();
    } catch (err) {
        showToast('Error', err.message || 'No se pudo eliminar la categoría.', 'error');
    }
};
