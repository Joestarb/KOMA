export async function fetchStatus() {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('Error al consultar estado de dispositivos');
    return res.json();
}

export async function fetchProducts() {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Error al cargar la carta');
    return res.json();
}

export async function fetchOrders(statusFilter = 'all', dateFrom = '', dateTo = '') {
    let url = `/api/orders?status=${statusFilter}`;
    if (dateFrom && dateTo) {
        url += `&from=${dateFrom}&to=${dateTo}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Error al cargar comandas');
    return res.json();
}

export async function fetchTransactions(dateFrom = '', dateTo = '') {
    let url = '/api/transactions';
    if (dateFrom && dateTo) {
        url += `?from=${dateFrom}&to=${dateTo}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Error al cargar transacciones');
    return res.json();
}

export async function fetchStats(dateFrom = '', dateTo = '') {
    let url = '/api/stats';
    if (dateFrom && dateTo) {
        url += `?from=${dateFrom}&to=${dateTo}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Error al obtener estadísticas');
    return res.json();
}

export async function fetchReports(dateFrom, dateTo) {
    const res = await fetch(`/api/reports?from=${dateFrom}&to=${dateTo}`);
    if (!res.ok) throw new Error('Error al obtener reporte del servidor');
    return res.json();
}

export async function submitOrder(orderData) {
    const res = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al enviar comanda');
    }
    return res.json();
}

export async function updateOrderStatusApi(id, status) {
    const res = await fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'No se pudo actualizar el estado');
    }
    return res.json();
}

export async function saveProductApi(productData) {
    const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'No se pudo guardar el producto');
    }
    return res.json();
}

export async function deleteProductApi(id) {
    const res = await fetch('/api/products/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'No se pudo dar de baja el producto');
    }
    return res.json();
}

export async function submitTransactionApi(txData) {
    const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'No se pudo registrar el movimiento');
    }
    return res.json();
}

export async function resetDatabaseApi() {
    const res = await fetch('/api/config/reset', {
        method: 'POST'
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'No se pudo restablecer la base de datos');
    }
    return res.json();
}

export async function updateTransactionApi(txData) {
    const res = await fetch('/api/transactions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'No se pudo modificar la transacción');
    }
    return res.json();
}

export async function deleteTransactionApi(id) {
    const res = await fetch('/api/transactions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'No se pudo eliminar la transacción');
    }
    return res.json();
}
