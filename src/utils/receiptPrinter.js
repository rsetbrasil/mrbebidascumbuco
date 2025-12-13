import { formatCurrency, formatDateTime, formatNumber, truncate, formatPercentage } from './formatters';

const getPrintStyles = (paperWidthMm = 80) => `
    <style>
        @media print {
            @page {
                margin: 0 !important;
            }
            html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: auto;
            }
            header, footer { display: none !important; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { height: auto; overflow: visible; }
        body {
            font-family: 'Courier New', Courier, monospace;
            width: 100%;
            margin: 0 !important;
            padding: 0 !important;
            font-size: 12px;
            color: #000;
            line-height: 1.2;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .text-sm { font-size: 11px; }
        .text-xs { font-size: 10px; }
        .mb-1 { margin-bottom: 2px; }
        .mb-2 { margin-bottom: 4px; }
        .border-b { border-bottom: 1px dashed #000; }
        .border-t { border-top: 1px dashed #000; }
        .py-1 { padding-top: 1px; padding-bottom: 1px; }
        .flex { display: flex; justify-content: space-between; }
        .w-full { width: 100%; }
        .item-row { display: grid; grid-template-columns: 1fr 70px; gap: 4px; }
        .item-row span:first-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .row { display: grid; grid-template-columns: 1fr 60px; gap: 4px; }
        .details-row { display: grid; grid-template-columns: 70px 1fr; }
        .text { word-break: break-word; }
    </style>
`;

const printHtml = (htmlContent, paperWidthMm = 80) => {
    const w = window.open('', '', 'width=280,height=600');
    if (!w) {
        alert('Por favor, permita popups para imprimir o comprovante.');
        return;
    }
    const doc = w.document;
    doc.open();
    doc.write(`
        <html>
            <head>
                <title>Imprimir Comprovante</title>
                <style>
                    @media print {
                        @page { margin: 0 !important; }
                        html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: auto; }
                    }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #000; line-height: 1.2; }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .font-bold { font-weight: bold; }
                    .text-sm { font-size: 11px; }
                    .text-xs { font-size: 10px; }
                    .mb-1 { margin-bottom: 2px; }
                    .mb-2 { margin-bottom: 4px; }
                    .border-b { border-bottom: 1px dashed #000; }
                    .border-t { border-top: 1px dashed #000; }
                    .py-1 { padding-top: 1px; padding-bottom: 1px; }
                    .flex { display: flex; justify-content: space-between; }
                    .w-full { width: 100%; }
                    .header { margin-bottom: 5px; }
                    .company-name { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
                    .receipt-title { font-size: 13px; font-weight: bold; margin: 5px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0; }
                    .details-row { display: flex; justify-content: space-between; margin-bottom: 1px; }
                    .items-section { margin-bottom: 5px; }
                    .item-name { font-weight: bold; }
                    .item-meta { font-size: 11px; }
                    .item-total { font-weight: bold; }
                    .totals-section { margin-top: 5px; border-top: 1px dashed #000; padding-top: 5px; }
                    .final-total { margin-top: 5px; border-top: 1px solid #000; padding-top: 5px; }
                    .payment-section { margin-top: 5px; border-top: 1px dashed #000; padding-top: 5px; }
                    .footer { margin-top: 10px; text-align: center; font-size: 10px; border-top: 1px dashed #000; padding-top: 5px; }
                </style>
            </head>
            <body>
                <div id="receipt-root">${htmlContent}</div>
            </body>
        </html>
    `);
    doc.close();
    const trigger = () => {
        try {
            w.focus();
            w.print();
            setTimeout(() => { w.close(); }, 300);
        } catch {}
    };
    if (w.document.readyState === 'complete') {
        setTimeout(trigger, 50);
    } else {
        w.addEventListener('load', () => setTimeout(trigger, 50));
    }
};

export const printReceipt = (sale, settings = {}) => {
    const sanitize = (s) => (s || '').trim().replace(/\n+/g, '\n');
    const companyName = sanitize(settings.companyName) || 'MR BEBIDAS DISTRIBUIDORA';
    const address = sanitize(settings.companyAddress) || 'Rua Firmo Ananias Cardoso, 269';
    const phone = sanitize(settings.companyPhone) || 'Tel: (11) 1234-5678';
    const dateStr = formatDateTime(sale.createdAt || new Date());
    const isColdSale = sale.priceType === 'cold';
    const paperWidthMm = Number(settings.paperWidthMm) || 80;
    const itemsArr = Array.isArray(sale.items) ? sale.items : [];
    const hasColdItems = itemsArr.some(it => it && it.isCold);
    const hasWarmItems = itemsArr.some(it => it && !it.isCold);
    const saleTypeLabel = hasColdItems && hasWarmItems ? 'Atacado + Mercearia' : (hasColdItems ? 'Mercearia' : 'Atacado');

    let itemsHtml = '';
    const approxEq = (a, b) => {
        const na = Number(a || 0);
        const nb = Number(b || 0);
        return Math.abs(na - nb) < 0.005; // ~0.5 centavos
    };

    itemsArr.forEach((item, index) => {
        const total = formatCurrency(item.total).replace('R$', '').trim();
        const unitPriceStr = formatCurrency(item.unitPrice).replace('R$', '').trim();
        const qty = formatNumber(item.quantity, 0);

        let typeBadge = '';
        if (item.isCold) {
            typeBadge = ' • Mercearia';
        } else if (approxEq(item.unitPrice, item.wholesalePrice)) {
            typeBadge = ' • Atacado';
        }

        const unitName = (item.unit && (item.unit.abbreviation || item.unit.name)) ? (item.unit.abbreviation || item.unit.name) : 'un';
        let displayName = item.name || item.productName || 'Item';
        if ((!displayName || displayName === 'Produto Sem Nome') && sale._productNames && item.productId && sale._productNames[item.productId]) {
            displayName = sale._productNames[item.productId] || displayName;
        }
        if (item.unit && item.unit.name && !String(displayName).includes(item.unit.name)) {
            displayName = `${displayName} (${item.unit.name})`;
        }

        itemsHtml += `
            <div class="mb-1">
                <div class="item-name">${index + 1}. ${displayName}</div>
                <div class="flex">
                    <span class="item-meta">${qty} ${unitName} x ${unitPriceStr}${typeBadge}</span>
                    <span class="item-total">${total}</span>
                </div>
            </div>
        `;
    });
    if (!itemsHtml) {
        itemsHtml = `
            <div class="mb-1">
                <div class="item-name">Sem itens</div>
                <div class="flex">
                    <span class="item-meta">-</span>
                    <span class="item-total">-</span>
                </div>
            </div>
        `;
    }

    let paymentsHtml = '';
    if (sale.payments && sale.payments.length > 0) {
        sale.payments.forEach(p => {
            paymentsHtml += `
                <div class="flex text-sm">
                    <span>${p.method}</span>
                    <span>${formatCurrency(p.amount)}</span>
                </div>
            `;
        });
    } else {
        paymentsHtml = `
            <div class="flex text-sm">
                <span>${sale.paymentMethod || 'Dinheiro'}</span>
                <span>${formatCurrency(sale.total)}</span>
            </div>
        `;
    }

    let savingsHtml = '';
    if (!isColdSale && sale.totalSavings && sale.totalSavings > 0) {
        const retailTotal = sale.total + sale.totalSavings;
        savingsHtml = `
            <div class="totals-section text-sm">
                <div class="flex">
                    <span>Preço Varejo:</span>
                    <span>${formatCurrency(retailTotal)}</span>
                </div>
                <div class="flex">
                    <span>Preço Atacado:</span>
                    <span>${formatCurrency(sale.total)}</span>
                </div>
                <div class="flex font-bold mt-1">
                    <span>Você Economizou:</span>
                    <span>${formatCurrency(sale.totalSavings)}</span>
                </div>
            </div>
        `;
    }

    let changeHtml = '';
    if (sale.change && sale.change > 0) {
        changeHtml = `
            <div class="flex font-bold text-sm mt-1">
                <span>TROCO:</span>
                <span>${formatCurrency(sale.change)}</span>
            </div>
        `;
    }

    const html = `
        <div class="header text-center">
            <div class="company-name">${companyName}</div>
            <div class="text-xs">${address}</div>
            <div class="text-xs">${phone}</div>
        </div>
        
        <div class="text-center receipt-title">
            CUPOM NÃO FISCAL
        </div>
        
        <div class="mb-2 text-sm">
            <div class="details-row"><span>Pedido:</span><span>#${sale.saleNumber || '0'}</span></div>
            <div class="details-row"><span>Cliente:</span><span>${(sale.customerName || 'Consumidor Final').substring(0, 24)}</span></div>
            <div class="details-row"><span>Data:</span><span>${dateStr}</span></div>
            <div class="details-row"><span>Tipo:</span><span>${saleTypeLabel}</span></div>
        </div>
        
        <div class="border-b mb-2"></div>
        
        <div class="items-section">
            ${itemsHtml}
        </div>

        <div class="totals-section">
            <div class="flex font-bold text-lg final-total">
                <span>TOTAL:</span>
                <span>${formatCurrency(sale.total)}</span>
            </div>
            ${savingsHtml}
        </div>

        <div class="payment-section">
            <div class="font-bold text-sm mb-1">FORMA DE PAGAMENTO</div>
            ${paymentsHtml}
            ${changeHtml}
        </div>

        <div class="footer">
            ${sanitize(settings.receiptFooter) || 'Obrigado e volte sempre!'}
        </div>
    `;

    printHtml(html, paperWidthMm);
};

export const printCashRegisterReport = (data, settings = {}) => {
    const companyName = settings.companyName || 'MR BEBIDAS DISTRIBUIDORA';
    const dateStr = formatDateTime(data.closedAt || new Date());
    const paperWidthMm = Number(settings.paperWidthMm) || 80;

    const lucroTotal = (data.totalProfit != null
        ? Number(data.totalProfit || 0)
        : (Number(data.profitWholesale || 0) + Number(data.profitMercearia || 0)));

    const revW = Number(data.revenueWholesale || 0);
    const revM = Number(data.revenueMercearia || 0);
    const marginW = revW > 0 ? (Number(data.profitWholesale || 0) / revW) * 100 : 0;
    const marginM = revM > 0 ? (Number(data.profitMercearia || 0) / revM) * 100 : 0;

    const paymentSummaryHtml = Array.isArray(data.paymentSummary) && data.paymentSummary.length > 0
        ? data.paymentSummary.map(p => `
            <div class="flex text-sm">
                <span>${p.method}</span>
                <span>${formatCurrency(p.amount)}${p.count ? ` (${p.count})` : ''}</span>
            </div>
        `).join('')
        : `
            <div class="flex text-sm">
                <span>-</span>
                <span>${formatCurrency(0)}</span>
            </div>
        `;

    const openedAtStr = data.openedAt ? formatDateTime(data.openedAt) : '-';
    const closedAtStr = data.closedAt ? formatDateTime(data.closedAt) : dateStr;
    const operatorStr = data.closedBy || '-';

    const html = `
        <div class="text-center mb-2">
            <div class="font-bold">${companyName}</div>
            <div class="font-bold mt-1">FECHAMENTO DE CAIXA</div>
        </div>

        <div class="border-b mb-2"></div>

        <div class="mb-2 text-sm">
            <div class="font-bold text-center mb-1">DADOS DO FECHAMENTO</div>
            <div class="details-row"><span>Abertura:</span><span>${openedAtStr}</span></div>
            <div class="details-row"><span>Fechamento:</span><span>${closedAtStr}</span></div>
            <div class="details-row"><span>Operador:</span><span class="text">${operatorStr}</span></div>
        </div>

        <div class="border-b mb-2"></div>

        <div class="font-bold text-center mb-1">RESUMO FINANCEIRO</div>
        
        <div class="mb-2 text-sm">
            <div class="flex">
                <span>Saldo Inicial:</span>
                <span>${formatCurrency(data.openingBalance)}</span>
            </div>
            <div class="flex">
                <span>Total Vendas (+):</span>
                <span>${formatCurrency(data.totalSales)}</span>
            </div>
            <div class="flex">
                <span>Custo (-):</span>
                <span>${formatCurrency(data.totalCost || 0)}</span>
            </div>
            <div class="flex font-bold">
                <span>Lucro:</span>
                <span>${formatCurrency(lucroTotal)}</span>
            </div>
            <div class="flex">
                <span>Lucro Atacado:</span>
                <span>${formatCurrency(Number(data.profitWholesale || 0))}</span>
            </div>
            <div class="flex">
                <span>Lucro Mercearia:</span>
                <span>${formatCurrency(Number(data.profitMercearia || 0))}</span>
            </div>
            <div class="flex">
                <span>Margem Atacado:</span>
                <span>${formatPercentage(marginW)}</span>
            </div>
            <div class="flex">
                <span>Margem Mercearia:</span>
                <span>${formatPercentage(marginM)}</span>
            </div>
            <div class="flex">
                <span>Suprimentos (+):</span>
                <span>${formatCurrency(data.totalSupplies)}</span>
            </div>
            <div class="flex">
                <span>Sangrias (-):</span>
                <span>${formatCurrency(data.totalBleeds)}</span>
            </div>
            <div class="flex">
                <span>Trocos (-):</span>
                <span>${formatCurrency(data.totalChange)}</span>
            </div>
        </div>

        <div class="border-t border-b py-2 mb-2">
            <div class="flex font-bold text-lg">
                <span>SALDO FINAL:</span>
                <span>${formatCurrency(data.finalBalance)}</span>
            </div>
            ${data.difference ? `
                <div class="flex font-bold text-sm mt-1">
                    <span>Diferença:</span>
                    <span>${formatCurrency(data.difference)}</span>
                </div>
            ` : ''}
        </div>

        <div class="payment-section">
            <div class="font-bold text-sm mb-1">VENDAS POR FORMA DE PAGAMENTO</div>
            ${paymentSummaryHtml}
        </div>

        ${data.notes ? `
            <div class="mb-2 text-sm">
                <div class="font-bold">Observações:</div>
                <div>${data.notes}</div>
            </div>
            <div class="border-b mb-2"></div>
        ` : ''}

        <div class="text-center text-xs mt-4">
            ____________________________<br/>
            Conferido por
        </div>
    `;

    printHtml(html, paperWidthMm);
};

// Keep for backward compatibility if needed, or remove
export const downloadReceipt = (sale, settings = {}) => {
    printReceipt(sale, settings);
};

export const previewReceipt = (sale, settings = {}) => {
    return ''; // Not supported in HTML mode
};
