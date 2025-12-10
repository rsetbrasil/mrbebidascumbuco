import { formatCurrency, formatDateTime, formatNumber, truncate } from './formatters';

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
    const printWindow = window.open('', '', 'width=280,height=600');
    if (!printWindow) {
        alert('Por favor, permita popups para imprimir o comprovante.');
        return;
    }

    printWindow.document.write(`
        <html>
            <head>
                <title>Imprimir Comprovante</title>
                <style id="dynamic-styles">
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
                    html { height: auto; overflow: hidden; }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        width: 100%;
                        margin: 0 !important;
                        padding: 0 !important;
                        font-size: 12px;
                        color: #000;
                        line-height: 1.2;
                        height: auto;
                        min-height: 0;
                    }
                    /* Utility Classes */
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
                    
                    /* Specific Receipt Classes */
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
                <script>
                    window.onload = function() {
                        var root = document.getElementById('receipt-root');
                        var heightPx = Math.max(root.scrollHeight, root.offsetHeight);
                        var heightMm = Math.max(20, Math.ceil((heightPx * 25.4) / 96));
                        var dyn = document.createElement('style');
                        dyn.type = 'text/css';
                        dyn.innerHTML = '@page{margin:0 !important;}';
                        document.head.appendChild(dyn);
                        setTimeout(function(){
                            window.print();
                            setTimeout(function(){ window.close(); }, 300);
                        }, 50);
                    }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
};

export const printReceipt = (sale, settings = {}) => {
    const sanitize = (s) => (s || '').trim().replace(/\n+/g, '\n');
    const companyName = sanitize(settings.companyName) || 'MR BEBIDAS DISTRIBUIDORA';
    const address = sanitize(settings.companyAddress) || 'Rua Firmo Ananias Cardoso, 269';
    const phone = sanitize(settings.companyPhone) || 'Tel: (11) 1234-5678';
    const dateStr = formatDateTime(sale.createdAt || new Date());
    
    const paperWidthMm = Number(settings.paperWidthMm) || 80;

    let itemsHtml = '';
    const approxEq = (a, b) => {
        const na = Number(a || 0);
        const nb = Number(b || 0);
        return Math.abs(na - nb) < 0.005; // ~0.5 centavos
    };

    const hasCold = (sale.items || []).some(i => !!i.isCold);
    const hasWholesale = (sale.items || []).some(i => !!i.isWholesale);
    const wholesaleSavings = (sale.items || []).reduce((sum, item) => {
        if (item.isCold) return sum;
        if (item.isWholesale) {
            const retail = Number(item.retailPrice || item.unitPrice || 0);
            const wholesale = Number(item.wholesalePrice || item.unitPrice || 0);
            const diff = Math.max(0, retail - wholesale);
            return sum + diff * Number(item.quantity || 0);
        }
        return sum;
    }, 0);

    (sale.items || []).forEach((item, index) => {
        const total = formatCurrency(item.total).replace('R$', '').trim();
        const unitPriceStr = formatCurrency(item.unitPrice).replace('R$', '').trim();
        const qty = formatNumber(item.quantity, 0);

        let typeBadge = '';
        if (item.isCold) {
            typeBadge = ' • Mercearia';
        }

        const unitName = (item.unit && (item.unit.abbreviation || item.unit.name))
            ? (item.unit.abbreviation || item.unit.name)
            : ((item.isWholesale && !item.isCold) ? (settings.wholesaleUnitLabel || 'FD') : 'un');
        let displayName = item.productName || item.name || `Produto ${index + 1}`;
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
            ${index < ((sale.items || []).length - 1) ? '<div class="border-b mb-1"></div>' : ''}
        `;
    });

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
    if (wholesaleSavings && wholesaleSavings > 0) {
        savingsHtml = `
            <div class="totals-section text-sm">
                <div class="flex font-bold mt-1">
                    <span>Economia no Atacado:</span>
                    <span>${formatCurrency(wholesaleSavings)}</span>
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
            <div class="details-row"><span>Tipos:</span><span>${[hasCold ? 'Mercearia' : null, hasWholesale ? 'Atacado' : null].filter(Boolean).join(' + ') || '-'}</span></div>
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
    const isDuplicate = !!settings.duplicate;

    const html = `
        <div class="text-center mb-2">
            <div class="font-bold">${companyName}</div>
            <div class="font-bold mt-1">FECHAMENTO DE CAIXA</div>
            ${isDuplicate ? '<div class="text-xs mt-1">2ª VIA</div>' : ''}
        </div>

        <div class="border-b mb-2"></div>

        <div class="mb-2 text-sm">
            <div class="flex">
                <span>Abertura:</span>
                <span>${formatDateTime(data.openedAt)}</span>
            </div>
            <div class="flex">
                <span>Fechamento:</span>
                <span>${dateStr}</span>
            </div>
            <div class="flex">
                <span>Operador:</span>
                <span>${data.closedBy || 'Admin'}</span>
            </div>
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

        <div class="font-bold text-center mb-1">RESUMO DE LUCRO</div>
        <div class="mb-2 text-sm">
            <div class="flex">
                <span>Lucro Atacado:</span>
                <span>${formatCurrency(Number(data.profitWholesale || 0))}</span>
            </div>
            <div class="flex">
                <span>Lucro Mercearia:</span>
                <span>${formatCurrency(Number(data.profitMercearia || 0))}</span>
            </div>
        </div>

        <div class="border-b mb-2"></div>
        <div class="font-bold text-center mb-1">FORMAS DE PAGAMENTO</div>
        <div class="mb-2 text-sm">
            ${(Array.isArray(data.paymentSummary) && data.paymentSummary.length > 0)
                ? data.paymentSummary.map(p => `
                    <div class="flex">
                        <span>${p.method}${Number(p.count || 0) > 0 ? ` (${p.count})` : ''}</span>
                        <span>${formatCurrency(Number(p.amount || 0))}</span>
                    </div>
                `).join('')
                : '<div class="text-xs text-center">-</div>'}
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
