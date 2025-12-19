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
            setTimeout(() => {
                try {
                    w.print();
                    setTimeout(() => { try { w.close(); } catch {} }, 700);
                } catch {}
            }, 450);
        } catch {}
    };
    if (w.document.readyState === 'complete') {
        setTimeout(trigger, 250);
    } else {
        w.addEventListener('load', () => setTimeout(trigger, 250));
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

    const profitAtacado = Number(data.profitAtacado || 0);
    const profitMercearia = Number(data.profitMercearia || 0);
    const profitTotal = Number(data.profitTotal || 0);
    const totalProfitFallback = Number(data.totalProfit || 0);

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

    const profitSectionHtml = (profitAtacado > 0 || profitMercearia > 0 || profitTotal > 0 || totalProfitFallback > 0)
        ? `
        <div class="payment-section">
            <div class="font-bold text-sm mb-1">LUCRO</div>
            ${profitTotal > 0 || profitAtacado > 0 || profitMercearia > 0 ? `
                <div class="flex text-sm">
                    <span>Atacado:</span>
                    <span>${formatCurrency(profitAtacado)}</span>
                </div>
                <div class="flex text-sm">
                    <span>Mercearia:</span>
                    <span>${formatCurrency(profitMercearia)}</span>
                </div>
                <div class="flex font-bold text-sm">
                    <span>Total:</span>
                    <span>${formatCurrency(profitTotal)}</span>
                </div>
            ` : `
                <div class="flex font-bold text-sm">
                    <span>Total:</span>
                    <span>${formatCurrency(totalProfitFallback)}</span>
                </div>
            `}
        </div>
        `
        : '';

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

        ${profitSectionHtml}

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

export const printSalesDayReport = ({ sales = [], start, end }, settings = {}) => {
    const sanitize = (s) => String(s || '').trim().replace(/\n+/g, '\n');
    const companyName = sanitize(settings.companyName) || 'MR BEBIDAS DISTRIBUIDORA';
    const paperWidthMm = Number(settings.paperWidthMm) || 80;

    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;
    const periodLabel = startDate && endDate
        ? `${formatDateTime(startDate)} até ${formatDateTime(endDate)}`
        : formatDateTime(new Date());

    const normalizePayments = (sale) => {
        if (Array.isArray(sale.payments) && sale.payments.length > 0) {
            return sale.payments
                .map(p => ({ method: String(p.method || 'Dinheiro'), amount: Number(p.amount || 0) }))
                .filter(p => p.amount > 0);
        }
        const method = String(sale.paymentMethod || 'Dinheiro');
        const paid = Number(sale.totalPaid || sale.total || 0);
        return paid > 0 ? [{ method, amount: paid }] : [{ method, amount: Number(sale.total || 0) }];
    };

    const toDate = (v) => (v && typeof v.toDate === 'function') ? v.toDate() : new Date(v || 0);
    const daySales = (Array.isArray(sales) ? sales : []).filter(s => s && s.status !== 'cancelled');
    const sorted = [...daySales].sort((a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime());

    let totalNet = 0;
    let totalPaid = 0;
    let totalChange = 0;
    let totalDiscount = 0;
    let totalItems = 0;

    let revenueAtacado = 0;
    let costAtacado = 0;
    let revenueMercearia = 0;
    let costMercearia = 0;

    const byMethodReceived = new Map();
    const byMethodNet = new Map();
    const byMethodCount = new Map();

    for (const sale of sorted) {
        const net = Number(sale.total || 0);
        const paid = Number(sale.totalPaid || sale.total || 0);
        const change = Math.max(0, Number(sale.change || 0));
        const discount = Number(sale.discount || 0);
        const itemsCount = Array.isArray(sale.items) ? sale.items.length : 0;

        totalNet += net;
        totalPaid += paid;
        totalChange += change;
        totalDiscount += discount;
        totalItems += itemsCount;

        const items = Array.isArray(sale.items) ? sale.items : [];
        for (const item of items) {
            const qty = Number(item?.quantity || 0);
            const revenue = Number(item?.total ?? (Number(item?.unitPrice || 0) * qty)) || 0;
            const cost = (Number(item?.unitCost || 0) * qty) || 0;
            const isAtacado = item?.isWholesale === true;
            if (isAtacado) {
                revenueAtacado += revenue;
                costAtacado += cost;
            } else {
                revenueMercearia += revenue;
                costMercearia += cost;
            }
        }

        const payments = normalizePayments(sale);
        let changeLeft = change;
        for (const p of payments) {
            const method = String(p.method || 'Dinheiro');
            const amount = Number(p.amount || 0);
            byMethodReceived.set(method, (byMethodReceived.get(method) || 0) + amount);
            byMethodCount.set(method, (byMethodCount.get(method) || 0) + 1);
        }
        for (const p of payments) {
            const method = String(p.method || 'Dinheiro');
            const amount = Number(p.amount || 0);
            const isCash = method.toLowerCase().includes('dinheiro') || method.toLowerCase().includes('cash');
            const changeDeduct = isCash ? Math.min(changeLeft, amount) : 0;
            if (isCash) changeLeft -= changeDeduct;
            byMethodNet.set(method, (byMethodNet.get(method) || 0) + (amount - changeDeduct));
        }
        if (changeLeft > 0 && payments.length > 0) {
            const first = String(payments[0].method || 'Dinheiro');
            byMethodNet.set(first, (byMethodNet.get(first) || 0) - changeLeft);
        }
    }

    const totalNetReceived = totalPaid - totalChange;
    const avgTicket = sorted.length > 0 ? (totalNet / sorted.length) : 0;

    const profitAtacado = revenueAtacado - costAtacado;
    const profitMercearia = revenueMercearia - costMercearia;
    const profitTotal = profitAtacado + profitMercearia;
    const marginAtacado = revenueAtacado > 0 ? (profitAtacado / revenueAtacado) : 0;
    const marginMercearia = revenueMercearia > 0 ? (profitMercearia / revenueMercearia) : 0;
    const revenueTotalType = revenueAtacado + revenueMercearia;
    const costTotalType = costAtacado + costMercearia;
    const marginTotal = revenueTotalType > 0 ? (profitTotal / revenueTotalType) : 0;

    const paymentsLines = Array.from(byMethodReceived.entries())
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        .map(([method, received]) => {
            const net = byMethodNet.get(method) || 0;
            const cnt = byMethodCount.get(method) || 0;
            return `
                <div class="text-sm mb-1">
                    <div class="flex"><span>${sanitize(method)}${cnt ? ` (${cnt})` : ''}</span><span>${formatCurrency(received)}</span></div>
                    <div class="flex text-xs"><span>Líquido</span><span>${formatCurrency(net)}</span></div>
                </div>
            `;
        }).join('');

    const salesLines = sorted.map((sale) => {
        const createdAt = toDate(sale.createdAt);
        const time = createdAt instanceof Date && !isNaN(createdAt) ? createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
        const number = sanitize(sale.saleNumber || '');
        const customer = sanitize(sale.customerName || 'Cliente Balcão');
        const net = Number(sale.total || 0);
        const paid = Number(sale.totalPaid || sale.total || 0);
        const change = Math.max(0, Number(sale.change || 0));
        const payments = normalizePayments(sale);
        const paymentsLabel = payments.map(p => `${sanitize(p.method)} ${formatCurrency(p.amount)}`).join(' | ') || '-';

        const items = Array.isArray(sale.items) ? sale.items : [];
        const saleCost = items.reduce((acc, it) => {
            const qty = Number(it?.quantity || 0);
            const unitCost = Number(it?.unitCost || 0);
            return acc + (unitCost * qty);
        }, 0);
        const saleProfit = net - saleCost;

        const itemsLines = items.length === 0 ? '' : items.map((it) => {
            const name = sanitize(it?.productName || it?.name || 'Item');
            const qty = Number(it?.quantity || 0);
            const unitCost = Number(it?.unitCost || 0);
            const costTotal = unitCost * qty;
            const unitPrice = Number(it?.unitPrice || 0);
            const revenueTotal = Number(it?.total ?? (unitPrice * qty)) || 0;
            return `
                <div class="mb-1 text-xs">
                    <div class="text">${truncate(name, 34)}</div>
                    <div class="flex"><span>Qtd:</span><span>${formatNumber(qty, 0)}</span></div>
                    <div class="flex"><span>Venda un.:</span><span>${formatCurrency(unitPrice)}</span></div>
                    <div class="flex"><span>Venda total:</span><span>${formatCurrency(revenueTotal)}</span></div>
                    <div class="flex"><span>Custo un.:</span><span>${formatCurrency(unitCost)}</span></div>
                    <div class="flex"><span>Custo total:</span><span>${formatCurrency(costTotal)}</span></div>
                </div>
            `;
        }).join('');

        return `
            <div class="mb-2">
                <div class="flex font-bold"><span>${time} #${number}</span><span>${formatCurrency(net)}</span></div>
                <div class="text-xs">
                    <div class="details-row"><span>Cliente:</span><span class="text">${customer}</span></div>
                    <div class="details-row"><span>Pago:</span><span>${formatCurrency(paid)}</span></div>
                    <div class="details-row"><span>Troco:</span><span>${formatCurrency(change)}</span></div>
                    <div class="details-row"><span>Pag.:</span><span class="text">${paymentsLabel}</span></div>
                </div>
                ${items.length > 0 ? `
                    <div class="border-t py-1 mb-1"></div>
                    <div class="font-bold text-xs mb-1">ITENS (VENDA + CUSTO)</div>
                    ${itemsLines}
                    <div class="border-t py-1 mb-1"></div>
                    <div class="text-xs">
                        <div class="flex"><span>CMV:</span><span>${formatCurrency(saleCost)}</span></div>
                        <div class="flex font-bold"><span>Lucro:</span><span>${formatCurrency(saleProfit)}</span></div>
                    </div>
                ` : ''}
            </div>
            <div class="border-b mb-2"></div>
        `;
    }).join('');

    const html = `
        <div class="text-center mb-2">
            <div class="font-bold">${companyName}</div>
            <div class="font-bold mt-1">RELATÓRIO DE VENDAS</div>
        </div>

        <div class="mb-2 text-sm">
            <div class="details-row"><span>Período:</span><span class="text">${sanitize(periodLabel)}</span></div>
        </div>

        <div class="border-b mb-2"></div>

        <div class="font-bold text-center mb-1">RESUMO</div>
        <div class="mb-2 text-sm">
            <div class="flex"><span>Vendas:</span><span>${sorted.length}</span></div>
            <div class="flex"><span>Itens:</span><span>${totalItems}</span></div>
            <div class="flex"><span>Descontos:</span><span>${formatCurrency(totalDiscount)}</span></div>
            <div class="flex font-bold"><span>Total (líquido):</span><span>${formatCurrency(totalNet)}</span></div>
            <div class="flex"><span>Total recebido:</span><span>${formatCurrency(totalPaid)}</span></div>
            <div class="flex"><span>Troco (-):</span><span>${formatCurrency(totalChange)}</span></div>
            <div class="flex font-bold"><span>Recebido líquido:</span><span>${formatCurrency(totalNetReceived)}</span></div>
            <div class="flex"><span>Ticket médio:</span><span>${formatCurrency(avgTicket)}</span></div>
        </div>

        <div class="payment-section">
            <div class="font-bold text-sm mb-1">LUCRO (POR TIPO)</div>
            <div class="text-sm mb-1">
                <div class="flex"><span>Atacado (Vendas):</span><span>${formatCurrency(revenueAtacado)}</span></div>
                <div class="flex"><span>Atacado (CMV):</span><span>${formatCurrency(costAtacado)}</span></div>
                <div class="flex font-bold"><span>Atacado (Lucro):</span><span>${formatCurrency(profitAtacado)}</span></div>
                <div class="flex text-xs"><span>Atacado (Margem):</span><span>${formatPercentage(marginAtacado)}</span></div>
            </div>
            <div class="text-sm mb-1">
                <div class="flex"><span>Mercearia (Vendas):</span><span>${formatCurrency(revenueMercearia)}</span></div>
                <div class="flex"><span>Mercearia (CMV):</span><span>${formatCurrency(costMercearia)}</span></div>
                <div class="flex font-bold"><span>Mercearia (Lucro):</span><span>${formatCurrency(profitMercearia)}</span></div>
                <div class="flex text-xs"><span>Mercearia (Margem):</span><span>${formatPercentage(marginMercearia)}</span></div>
            </div>
            <div class="border-t py-1 mb-1"></div>
            <div class="text-sm">
                <div class="flex"><span>Total (Vendas):</span><span>${formatCurrency(revenueTotalType)}</span></div>
                <div class="flex"><span>Total (CMV):</span><span>${formatCurrency(costTotalType)}</span></div>
                <div class="flex font-bold"><span>Total (Lucro):</span><span>${formatCurrency(profitTotal)}</span></div>
                <div class="flex text-xs"><span>Total (Margem):</span><span>${formatPercentage(marginTotal)}</span></div>
            </div>
        </div>

        <div class="payment-section">
            <div class="font-bold text-sm mb-1">POR FORMA DE PAGAMENTO</div>
            ${paymentsLines || `<div class="text-sm"><div class="flex"><span>-</span><span>${formatCurrency(0)}</span></div></div>`}
        </div>

        <div class="payment-section">
            <div class="font-bold text-sm mb-1">VENDAS (DETALHES)</div>
            ${salesLines || `<div class="text-sm text-center">Nenhuma venda no período</div>`}
        </div>

        <div class="text-center text-xs mt-4">
            ____________________________<br/>
            Conferido por
        </div>
    `;

    printHtml(html, paperWidthMm);
};

export const printProductsPriceList = ({ products = [], search = '' }, settings = {}) => {
    const sanitize = (s) => String(s || '').trim().replace(/\n+/g, '\n');
    const escapeHtml = (s) => String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    const companyName = escapeHtml(sanitize(settings.companyName) || 'MR BEBIDAS DISTRIBUIDORA');
    const paperWidthMm = Number(settings.paperWidthMm) || 80;
    const dateStr = formatDateTime(new Date());
    const term = sanitize(search);

    const sorted = (Array.isArray(products) ? products : [])
        .filter(p => p && p.active !== false)
        .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR'));

    const lines = sorted.length === 0
        ? `<div class="text-center text-sm">Nenhum produto</div>`
        : sorted.map((p, idx) => {
            const name = escapeHtml(truncate(sanitize(p?.name || 'Produto'), 40));
            const barcode = escapeHtml(truncate(sanitize(p?.barcode || ''), 32));
            const saleWholesale = Number(p?.wholesalePrice ?? p?.price ?? 0);
            const costWholesale = Number(p?.cost ?? 0);
            const saleCold = Number(p?.coldPrice ?? p?.price ?? 0);
            const costCold = Number(p?.coldCost ?? p?.cost ?? 0);
            return `
                <div class="mb-1">
                    <div class="font-bold">${idx + 1}. ${name}</div>
                    ${barcode ? `<div class="text-xs">${barcode}</div>` : ''}
                    <div class="text-sm mb-1">
                        <div class="font-bold">Atacado</div>
                        <div class="flex"><span>Venda:</span><span>${formatCurrency(saleWholesale)}</span></div>
                        <div class="flex"><span>Custo:</span><span>${formatCurrency(costWholesale)}</span></div>
                    </div>
                    <div class="text-sm">
                        <div class="font-bold">Mercearia</div>
                        <div class="flex"><span>Venda:</span><span>${formatCurrency(saleCold)}</span></div>
                        <div class="flex"><span>Custo:</span><span>${formatCurrency(costCold)}</span></div>
                    </div>
                </div>
                <div class="border-b mb-2"></div>
            `;
        }).join('');

    const html = `
        <div class="text-center mb-2">
            <div class="font-bold">${companyName}</div>
            <div class="font-bold mt-1">LISTA DE PRODUTOS</div>
            <div class="text-xs">${dateStr}</div>
        </div>

        ${term ? `
            <div class="mb-2 text-sm">
                <div class="details-row"><span>Busca:</span><span class="text">${escapeHtml(truncate(term, 24))}</span></div>
            </div>
        ` : ''}

        <div class="border-b mb-2"></div>

        <div class="mb-2 text-sm">
            <div class="flex"><span>Total:</span><span>${sorted.length}</span></div>
        </div>

        <div class="border-b mb-2"></div>

        <div>
            ${lines}
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
