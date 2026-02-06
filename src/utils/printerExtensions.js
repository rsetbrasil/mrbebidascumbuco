
import { formatDateTime, formatNumber } from './formatters';
import { printHtml } from './receiptPrinter';

export const printDetailedAuditReport = (sales, settings = {}) => {
    const companyName = settings.companyName || 'MR BEBIDAS DISTRIBUIDORA';
    const paperWidthMm = Number(settings.paperWidthMm) || 80;

    // Flatten items from all sales
    const allItems = [];
    sales.forEach(sale => {
        const dateStr = formatDateTime(sale.createdAt).split(' ')[0]; // DD/MM/YYYY
        (sale.items || []).forEach(item => {
            const qty = Number(item.quantity || 0);
            const price = Number(item.unitPrice || 0);
            const cost = Number(item.unitCost || item.cost || 0);
            const total = price * qty;
            const totalCost = cost * qty;
            const profit = total - totalCost;

            allItems.push({
                saleId: sale.saleNumber || '-',
                date: dateStr,
                product: item.name || item.productName || 'Item',
                qty,
                price,
                cost,
                profit
            });
        });
    });

    // Generate HTML rows
    const rowsHtml = allItems.map(item => {
        const costStyle = item.cost === 0 ? 'color: red; font-weight: bold;' : '';
        return `
        <div class="mb-1 border-b" style="padding-bottom: 2px;">
            <div class="flex text-xs">
                <span style="font-weight:bold;">${item.date} - #${item.saleId}</span>
                <span>${item.product.substring(0, 15)}</span>
            </div>
            <div class="flex text-xs">
                <span>Q:${item.qty} x ${formatNumber(item.price)}</span>
                <span>Venda: ${formatNumber(item.price * item.qty)}</span>
            </div>
            <div class="flex text-xs" style="${costStyle}">
                <span>Custo: ${formatNumber(item.cost)}</span>
                <span>Lucro: ${formatNumber(item.profit)}</span>
            </div>
        </div>
    `}).join('');

    const html = `
        <div class="text-center mb-2">
            <div class="font-bold">${companyName}</div>
            <div class="font-bold mt-1">AUDITORIA DE LUCRO</div>
            <div class="text-xs">Itens com Custo Zero em Vermelho</div>
        </div>

        <div class="border-b mb-2"></div>
        
        <div class="items-section">
            ${rowsHtml}
        </div>

        <div class="footer">
            Fim do Relatório
        </div>
    `;

    printHtml(html, paperWidthMm);
};
