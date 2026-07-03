import { state } from './state.js';
import { showToast } from './utils.js';
import { fetchReports } from './api.js';

function getCategoryLabel(cat) {
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

export async function generatePDFReport() {
    let dateFrom = state.filterDateFrom;
    let dateTo = state.filterDateTo;
    
    if (!dateFrom || !dateTo) {
        const todayStr = new Date().toISOString().split('T')[0];
        dateFrom = dateFrom || '2026-01-01';
        dateTo = dateTo || todayStr;
    }
    
    showToast('Generando', 'Obteniendo datos del reporte financiero...', 'info');
    
    try {
        const report = await fetchReports(dateFrom, dateTo);
        
        // Generate PDF using jsPDF
        const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        if (!jsPDF) {
            throw new Error('La librería jsPDF no se pudo cargar desde el CDN.');
        }
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        // Styling helpers
        const brandColor = [99, 102, 241]; // Indigo
        const textColor = [30, 41, 59];
        
        // Header
        doc.setFillColor(30, 41, 59); // Dark blue / slate
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(22);
        doc.text("KOMA - SISTEMA DE COMANDAS", 14, 18);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(11);
        doc.text("Reporte Financiero Detallado de Caja", 14, 25);
        doc.text(`Período: ${report.period.from} al ${report.period.to}`, 14, 32);
        
        // Date generated on right side of header
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        const printedDateStr = new Date().toLocaleString();
        doc.text(`Generado: ${printedDateStr}`, 155, 18);
        doc.text(`Moneda: USD ($)`, 155, 24);
        
        // Reset colors
        doc.setTextColor(...textColor);
        
        // Section: Summary Cards
        doc.setFontSize(14);
        doc.setFont('Helvetica', 'bold');
        doc.text("Resumen de Operación", 14, 50);
        
        // We can use autoTable to make a beautiful summary box
        doc.autoTable({
            startY: 54,
            theme: 'grid',
            headStyles: { fillColor: brandColor, halign: 'center' },
            bodyStyles: { fontSize: 11, textColor: textColor },
            head: [['Concepto', 'Valor / Monto', 'Detalles']],
            body: [
                ['Ventas de Comandas Cobradas', `$${report.summary.total_income.toFixed(2)}`, `${report.summary.total_orders} comandas cerradas`],
                ['Otros Ingresos (Aperturas/Manuales)', `$${(report.summary.total_income - report.orders.reduce((sum, o) => sum + o.total, 0)).toFixed(2)}`, 'Registros manuales de caja'],
                ['Total Egresos (Salidas de efectivo)', `$${report.summary.total_outcome.toFixed(2)}`, 'Compras de insumos, servicios y nómina'],
                ['Balance General en Caja', `$${report.summary.balance.toFixed(2)}`, report.summary.balance >= 0 ? 'Superávit / Saldo Positivo' : 'Déficit / Saldo Negativo'],
                ['Ticket Promedio por Mesa', `$${report.summary.avg_ticket.toFixed(2)}`, 'Monto de comanda promedio']
            ],
            margin: { left: 14, right: 14 }
        });
        
        let nextY = doc.previousAutoTable.finalY + 12;
        
        // Category Breakdown Table
        doc.setFontSize(13);
        doc.setFont('Helvetica', 'bold');
        doc.text("Distribución por Categorías", 14, nextY);
        
        const catRows = [];
        // Outcomes
        for (const cat in report.outcome_by_category) {
            catRows.push([`Egreso: ${getCategoryLabel(cat)}`, `$${report.outcome_by_category[cat].toFixed(2)}`, 'Salida de Caja']);
        }
        // Incomes
        for (const cat in report.income_by_category) {
            catRows.push([`Ingreso: ${getCategoryLabel(cat)}`, `$${report.income_by_category[cat].toFixed(2)}`, 'Entrada de Caja']);
        }
        if (catRows.length === 0) {
            catRows.push(['Sin movimientos', '$0.00', 'N/A']);
        }
        
        doc.autoTable({
            startY: nextY + 4,
            theme: 'striped',
            headStyles: { fillColor: [100, 116, 139] },
            bodyStyles: { fontSize: 10 },
            head: [['Categoría / Concepto', 'Monto', 'Tipo de Operación']],
            body: catRows,
            margin: { left: 14, right: 14 }
        });
        
        nextY = doc.previousAutoTable.finalY + 12;
        
        // Top Selling Products Table
        doc.setFontSize(13);
        doc.setFont('Helvetica', 'bold');
        doc.text("Top 10 Productos Más Vendidos", 14, nextY);
        
        const topProdRows = report.top_products.map((p, idx) => [
            idx + 1,
            p.name,
            `${p.quantity} unidades`,
            `$${p.revenue.toFixed(2)}`
        ]);
        if (topProdRows.length === 0) {
            topProdRows.push(['-', 'Sin productos vendidos en el rango', '-', '$0.00']);
        }
        
        doc.autoTable({
            startY: nextY + 4,
            theme: 'striped',
            headStyles: { fillColor: [6, 182, 212] },
            bodyStyles: { fontSize: 10 },
            head: [['Pos', 'Producto', 'Cantidad Vendida', 'Ingreso Generado']],
            body: topProdRows,
            margin: { left: 14, right: 14 }
        });
        
        // Add new page for details
        doc.addPage();
        
        // Page 2: Transacciones detalladas
        doc.setFontSize(14);
        doc.setFont('Helvetica', 'bold');
        doc.text("Historial Detallado de Transacciones", 14, 18);
        
        const txRows = report.transactions.map(t => {
            const date = new Date(t.timestamp);
            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return [
                dateStr,
                t.type === 'income' ? 'Ingreso (+)' : 'Egreso (-)',
                t.description,
                getCategoryLabel(t.category),
                t.order_id ? `#${t.order_id}` : 'Manual',
                `$${t.amount.toFixed(2)}`
            ];
        });
        if (txRows.length === 0) {
            txRows.push(['-', '-', 'Sin transacciones en este período', '-', '-', '$0.00']);
        }
        
        doc.autoTable({
            startY: 22,
            theme: 'grid',
            headStyles: { fillColor: [51, 65, 85] },
            bodyStyles: { fontSize: 9 },
            columnStyles: {
                5: { halign: 'right', fontStyle: 'bold' }
            },
            head: [['Fecha y Hora', 'Tipo', 'Descripción / Concepto', 'Categoría', 'Origen', 'Monto']],
            body: txRows,
            margin: { left: 14, right: 14 }
        });
        
        // Save PDF
        const filename = `Reporte_KOMA_${dateFrom}_a_${dateTo}.pdf`;
        doc.save(filename);
        
        showToast('Éxito', `Reporte exportado como ${filename}`, 'success');
    } catch (err) {
        showToast('Error', `No se pudo generar el reporte PDF: ${err.message}`, 'error');
        console.error(err);
    }
}
