import React, { createContext, useContext, useState, useCallback } from 'react';

const CartContext = createContext();

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within CartProvider');
    }
    return context;
};

export const CartProvider = ({ children }) => {
    const [items, setItems] = useState([]);
    const [customer, setCustomer] = useState(null);
    const [discount, setDiscount] = useState(0);
    const [notes, setNotes] = useState('');
    const [presaleId, setPresaleId] = useState(null);
    const [editingSale, setEditingSale] = useState(null); // { id, originalTotal, originalItems, priceType }
    const [priceType, setPriceType] = useState('wholesale'); // 'retail', 'wholesale', or 'cold'
    const [cartVersion, setCartVersion] = useState(0);

    const buildCartItemId = useCallback((productId, unit, isCold) => {
        const unitName = unit ? unit.name : 'base';
        return `${String(productId || '')}-${String(unitName || 'base')}-${isCold ? 'cold' : 'normal'}`;
    }, []);

    // Helper to recalculate prices
    const recalculatePrices = useCallback((type, currentItems) => {
        const isWholesale = type === 'wholesale';
        const isCold = type === 'cold';
        return currentItems.map(item => {
            let newPrice = item.retailPrice || item.unitPrice;
            if (isWholesale) {
                const candidate = item.wholesalePrice === null ? null : (item.wholesalePrice ?? item.retailPrice ?? item.unitPrice);
                if (candidate !== null && candidate !== undefined) newPrice = candidate;
            }
            if (isCold) {
                const candidate = item.coldPrice === null ? null : (item.coldPrice ?? item.retailPrice ?? item.unitPrice);
                if (candidate !== null && candidate !== undefined) newPrice = candidate;
            }
            const baseCost = isCold
                ? ((item.coldCost !== undefined ? item.coldCost : 0) || 0)
                : ((item.wholesaleCost !== undefined ? item.wholesaleCost : 0) || 0);
            const costUnitMultiplier = isCold
                ? Number(item.coldUnitMultiplier || 1)
                : Number(item.wholesaleUnitMultiplier || 1);
            const normalized = costUnitMultiplier > 0 ? (baseCost / costUnitMultiplier) : baseCost;
            const multiplier = item.unit?.multiplier ? item.unit.multiplier : 1;
            const newCost = normalized * multiplier;
            return {
                ...item,
                unitPrice: item.unit ? item.unitPrice : newPrice,
                unitCost: newCost,
                isCold,
                isWholesale,
                total: (item.quantity * (item.unit ? item.unitPrice : newPrice)) - (item.discount || 0)
            };
        });
    }, []);

    // Add item to cart
    const addItem = useCallback((product, quantity = 1, unit = null, options = {}) => {
        setItems(prevItems => {
            // Check if item already exists (same product, same unit choice, same cold flag)
            const type = options.itemPriceType ? options.itemPriceType : priceType;
            const isCold = type === 'cold';
            const isWholesale = type === 'wholesale';

            const newCartItemId = buildCartItemId(product.id, unit, isCold);

            const existingIndex = prevItems.findIndex(item =>
                item.cartItemId === newCartItemId
            );

            // Determine price based on current price type

            const wholesaleBasePrice = product.wholesalePrice === null ? null : (product.wholesalePrice ?? product.price);
            const coldBasePrice = product.coldPrice === null ? null : (product.coldPrice ?? product.price);
            let priceToUse = wholesaleBasePrice ?? product.price;
            const costUnitMultiplier = isCold
                ? Number(product.coldUnitMultiplier || 1)
                : Number(product.wholesaleUnitMultiplier || 1);
            const rawCost = isCold ? (product.coldCost || product.cost || 0) : (product.cost || 0);
            const baseCost = costUnitMultiplier > 0 ? (rawCost / costUnitMultiplier) : rawCost;
            let costToUse = baseCost;
            let stockDeduction = 1;

            if (!unit && options.customPrice === undefined) {
                if (isWholesale && wholesaleBasePrice === null) return prevItems;
                if (isCold && coldBasePrice === null) return prevItems;
            }

            if (unit) {
                // If selling a specific unit (Pack/Kit)
                priceToUse = unit.price;
                costToUse = baseCost * unit.multiplier;
                stockDeduction = unit.multiplier;
            } else {
                // Standard unit logic
                if (isWholesale && wholesaleBasePrice !== null && wholesaleBasePrice !== undefined) {
                    priceToUse = wholesaleBasePrice;
                    costToUse = rawCost; // Use full cost of the bundle/unit
                    stockDeduction = costUnitMultiplier > 0 ? costUnitMultiplier : 1;
                }
                if (isCold && coldBasePrice !== null && coldBasePrice !== undefined) {
                    priceToUse = coldBasePrice;
                    costToUse = rawCost; // Use full cost of the bundle/unit
                    stockDeduction = costUnitMultiplier > 0 ? costUnitMultiplier : 1;
                }
            }

            if (options.customPrice !== undefined) {
                priceToUse = Number(options.customPrice);
            }

            if (existingIndex >= 0) {
                // Update quantity if item already exists
                const updatedItems = [...prevItems];
                const item = updatedItems[existingIndex];

                updatedItems[existingIndex] = {
                    ...item,
                    quantity: options.replaceQuantity ? quantity : (item.quantity + quantity),
                    // If it's a unit, price is fixed. If base product, it follows priceType
                    unitPrice: unit ? (options.customPrice !== undefined ? Number(options.customPrice) : unit.price) : priceToUse,
                    unitCost: unit ? costToUse : baseCost,
                    isCold,
                    isWholesale,
                    stockDeduction: (options.replaceQuantity ? quantity : (item.quantity + quantity)) * stockDeduction
                };

                // Recalculate total for this item
                updatedItems[existingIndex].total =
                    (updatedItems[existingIndex].quantity * updatedItems[existingIndex].unitPrice) -
                    (updatedItems[existingIndex].discount || 0);

                return updatedItems;
            }

            // Add new item
            return [...prevItems, {
                cartItemId: newCartItemId,
                id: product.id,
                name: unit ? `${product.name} (${unit.name})` : product.name,
                barcode: unit ? (unit.barcode || product.barcode) : product.barcode,
                quantity,
                retailPrice: product.price,  // Always store retail price
                wholesalePrice: product.wholesalePrice === null ? null : (product.wholesalePrice ?? product.price),  // Always store wholesale price
                coldPrice: product.coldPrice === null ? null : (product.coldPrice ?? product.price), // Always store cold price
                unitPrice: priceToUse,  // The price being charged
                unitCost: costToUse,
                wholesaleCost: product.cost || 0,
                coldCost: product.coldCost || product.cost || 0,
                wholesaleUnitMultiplier: Number(product.wholesaleUnitMultiplier || 1),
                coldUnitMultiplier: Number(product.coldUnitMultiplier || 1),
                stock: product.stock, // Store stock limit
                coldStock: product.coldStock || 0, // Store cold stock limit
                stockDeductionPerUnit: stockDeduction, // How much to deduct from stock per 1 quantity
                unit: unit, // Store the unit details if any
                isCold: isCold, // Track if this is a cold item
                isWholesale,
                discount: 0,
                total: (quantity * priceToUse)
            }];
        });
    }, [priceType, buildCartItemId]);

    // Update customer and auto-set price type
    const updateCustomer = useCallback((newCustomer) => {
        setCustomer(newCustomer);

        // Auto-set price type based on customer preference, or default to retail
        const newPriceType = 'wholesale';
        setPriceType(newPriceType);

        setItems(prevItems => recalculatePrices(newPriceType, prevItems));
    }, [recalculatePrices]);

    // Manually update price type
    const updatePriceType = useCallback((newType) => {
        setPriceType(newType);
        setItems(prevItems => recalculatePrices(newType, prevItems));
    }, [recalculatePrices]);

    // Remove item from cart
    const removeItem = useCallback((cartItemId) => {
        setItems(prevItems => prevItems.filter(item => item.cartItemId !== cartItemId));
    }, []);

    // Update item quantity
    const updateQuantity = useCallback((cartItemId, quantity) => {
        if (quantity <= 0) {
            removeItem(cartItemId);
            return;
        }

        setItems(prevItems => {
            return prevItems.map(item => {
                if (item.cartItemId === cartItemId) {
                    const itemDiscount = item.discount || 0;
                    const subtotal = quantity * item.unitPrice;
                    return {
                        ...item,
                        quantity,
                        total: subtotal - itemDiscount
                    };
                }
                return item;
            });
        });
    }, [removeItem]);

    // Update item discount
    const updateItemDiscount = useCallback((cartItemId, discountValue) => {
        setItems(prevItems => {
            return prevItems.map(item => {
                if (item.cartItemId === cartItemId) {
                    const subtotal = item.quantity * item.unitPrice;
                    return {
                        ...item,
                        discount: discountValue,
                        total: subtotal - discountValue
                    };
                }
                return item;
            });
        });
    }, []);

    // Update item price
    const updatePrice = useCallback((cartItemId, newPrice) => {
        setItems(prevItems => {
            return prevItems.map(item => {
                if (item.cartItemId === cartItemId) {
                    const itemDiscount = item.discount || 0;
                    const subtotal = item.quantity * newPrice;
                    return {
                        ...item,
                        unitPrice: newPrice,
                        total: subtotal - itemDiscount
                    };
                }
                return item;
            });
        });
    }, []);

    // Calculate totals
    const calculateTotals = useCallback(() => {
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const itemsDiscount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
        const total = subtotal - itemsDiscount - discount;

        return {
            subtotal,
            itemsDiscount,
            discount,
            total: Math.max(0, total)
        };
    }, [items, discount]);

    // Clear cart
    const clearCart = useCallback(() => {
        setItems([]);
        setCustomer(null);
        setDiscount(0);
        setNotes('');
        setPresaleId(null);
        setEditingSale(null);
        setPriceType('wholesale');
        setCartVersion(v => v + 1);
    }, []);

    // Get cart data for sale
    const getCartData = useCallback(() => {
        const totals = calculateTotals();

        return {
            items: items.map(item => ({
                productId: item.id,
                productName: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                unitCost: item.unitCost,
                discount: item.discount || 0,
                total: item.total,
                retailPrice: item.retailPrice,
                wholesalePrice: item.wholesalePrice,
                coldPrice: item.coldPrice,
                unit: item.unit, // Include unit info
                isCold: !!item.isCold,
                isWholesale: !!item.isWholesale,
                stockDeduction: item.stockDeductionPerUnit * item.quantity // Include total stock deduction
            })),
            customerId: customer?.id || null,
            customerName: customer?.name || null,
            subtotal: totals.subtotal,
            discount: totals.discount + totals.itemsDiscount,
            total: totals.total,
            notes,
            presaleId,
            priceType // Include priceType in sale data
        };
    }, [items, customer, discount, notes, calculateTotals, presaleId, priceType]);

    // Load presale into cart
    const loadPresale = useCallback((presale) => {
        const list = Array.isArray(presale?.items) ? presale.items : [];
        const used = new Map();
        const mapped = list.map((item) => {
            const isCold = (item?.isCold !== undefined) ? !!item.isCold : (presale?.priceType === 'cold');
            const unit = item?.unit || null;
            const baseId = buildCartItemId(item?.productId, unit, isCold);
            const next = (used.get(baseId) || 0) + 1;
            used.set(baseId, next);
            const cartItemId = next === 1 ? baseId : `${baseId}-${next}`;
            return {
                cartItemId,
                id: item.productId,
                name: item.productName || item.name,
                ...item,
                retailPrice: item.retailPrice || item.unitPrice,
                wholesalePrice: item.wholesalePrice === null ? null : (item.wholesalePrice ?? item.unitPrice),
                coldPrice: item.coldPrice === null ? null : (item.coldPrice ?? item.unitPrice),
                stockDeductionPerUnit: unit?.multiplier ? unit.multiplier : 1,
                isCold
            };
        });
        setItems(mapped);

        if (presale.customer) {
            setCustomer(presale.customer);
        } else if (presale.customerName) {
            setCustomer({
                id: presale.customerId || null,
                name: presale.customerName
            });
        } else {
            setCustomer(null);
        }

        setDiscount(presale.discount || 0);
        setNotes(presale.notes || '');
        setPresaleId(presale.id);
        setPriceType(presale.priceType || 'wholesale');
    }, [buildCartItemId]);

    const loadSale = useCallback((sale) => {
        const list = Array.isArray(sale?.items) ? sale.items : [];
        const used = new Map();
        const mapped = list.map((item) => {
            const isCold = (item?.isCold !== undefined) ? !!item.isCold : (sale?.priceType === 'cold');
            const unit = item?.unit || null;
            const baseId = buildCartItemId(item?.productId, unit, isCold);
            const next = (used.get(baseId) || 0) + 1;
            used.set(baseId, next);
            const cartItemId = next === 1 ? baseId : `${baseId}-${next}`;
            return {
                cartItemId,
                id: item.productId,
                name: item.productName,
                barcode: item.barcode || '',
                quantity: Number(item.quantity) || 1,
                retailPrice: item.retailPrice || item.unitPrice,
                wholesalePrice: item.wholesalePrice === null ? null : (item.wholesalePrice ?? item.unitPrice),
                coldPrice: item.coldPrice === null ? null : (item.coldPrice ?? item.unitPrice),
                unitPrice: Number(item.unitPrice) || 0,
                unitCost: Number(item.unitCost) || 0,
                stock: undefined,
                coldStock: undefined,
                stockDeductionPerUnit: unit?.multiplier ? unit.multiplier : 1,
                unit,
                isCold,
                isWholesale: (item.isWholesale !== undefined) ? !!item.isWholesale : (sale?.priceType === 'wholesale'),
                discount: Number(item.discount) || 0,
                total: Number(item.total) || (Number(item.quantity) * Number(item.unitPrice))
            };
        });
        setItems(mapped);

        if (sale.customerId || sale.customerName) {
            setCustomer({ id: sale.customerId || null, name: sale.customerName || 'Cliente Padrão' });
        } else {
            setCustomer(null);
        }

        setDiscount(Number(sale.discount) || 0);
        setNotes(sale.notes || '');
        setPresaleId(null);
        setPriceType(sale.priceType || 'wholesale');
        setEditingSale({ id: sale.id, originalTotal: Number(sale.total) || 0, originalItems: sale.items || [], priceType: sale.priceType || 'wholesale' });
    }, [buildCartItemId]);

    const value = {
        items,
        customer,
        discount,
        notes,
        presaleId,
        editingSale,
        priceType,
        addItem,
        removeItem,
        updateQuantity,
        updateItemDiscount,
        updatePrice,
        setCustomer: updateCustomer,
        setPriceType: updatePriceType, // Expose manual update
        setDiscount,
        setNotes,
        calculateTotals,
        clearCart,
        getCartData,
        loadPresale,
        loadSale,
        itemCount: items.length,
        totalItems: items.reduce((sum, item) => sum + item.quantity, 0)
        ,
        cartVersion
    };

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
