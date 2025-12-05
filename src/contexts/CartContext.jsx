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

    // Helper to recalculate prices
    const recalculatePrices = useCallback((type, currentItems) => {
        const isWholesale = type === 'wholesale';
        const isCold = type === 'cold';
        return currentItems.map(item => {
            // If item is a specific unit (Pack/Kit), price doesn't change with global price type
            if (item.unit) return item;

            let newPrice = item.retailPrice || item.unitPrice;
            if (isWholesale) newPrice = item.wholesalePrice || item.unitPrice;
            if (isCold) newPrice = item.coldPrice || item.retailPrice || item.unitPrice;

            return {
                ...item,
                unitPrice: newPrice,
                total: (item.quantity * newPrice) - (item.discount || 0)
            };
        });
    }, []);

    // Add item to cart
    const addItem = useCallback((product, quantity = 1, unit = null, options = {}) => {
        setItems(prevItems => {
            // Check if item already exists (same product, same unit choice, same cold flag)
            const type = options.itemPriceType ? options.itemPriceType : priceType;
            const isCold = type === 'cold';

            const existingIndex = prevItems.findIndex(item =>
                item.id === product.id &&
                ((!item.unit && !unit) || (item.unit && unit && item.unit.name === unit.name)) &&
                ((item.isCold || false) === isCold)
            );

            // Determine price based on current price type
            const isWholesale = type === 'wholesale';

            let priceToUse = product.wholesalePrice || product.price;
            let costToUse = product.cost || 0;
            let stockDeduction = 1;

            if (unit) {
                // If selling a specific unit (Pack/Kit)
                priceToUse = unit.price;
                // Cost should ideally be calculated based on multiplier, but for now we might need to approximate or add cost to unit
                // Assuming unit cost is proportional to base cost for now
                costToUse = (product.cost || 0) * unit.multiplier;
                stockDeduction = unit.multiplier;
            } else {
                // Standard unit logic
                if (isWholesale && product.wholesalePrice) priceToUse = product.wholesalePrice;
                if (isCold && product.coldPrice) priceToUse = product.coldPrice;
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
                    quantity: item.quantity + quantity,
                    // If it's a unit, price is fixed. If base product, it follows priceType
                    unitPrice: unit ? (options.customPrice !== undefined ? Number(options.customPrice) : unit.price) : priceToUse,
                    stockDeduction: (item.quantity + quantity) * stockDeduction,
                    isCold,
                    isWholesale
                };

                // Recalculate total for this item
                updatedItems[existingIndex].total =
                    (updatedItems[existingIndex].quantity * updatedItems[existingIndex].unitPrice) -
                    (updatedItems[existingIndex].discount || 0);

                return updatedItems;
            }

            // Add new item
            return [...prevItems, {
                id: product.id,
                name: unit ? `${product.name} (${unit.name})` : product.name,
                barcode: unit ? (unit.barcode || product.barcode) : product.barcode,
                quantity,
                retailPrice: product.price,  // Always store retail price
                wholesalePrice: product.wholesalePrice || product.price,  // Always store wholesale price
                coldPrice: product.coldPrice || product.price, // Always store cold price
                unitPrice: priceToUse,  // The price being charged
                unitCost: costToUse,
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
    }, [priceType]);

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
    const removeItem = useCallback((productId) => {
        setItems(prevItems => prevItems.filter(item => item.id !== productId));
    }, []);

    // Update item quantity
    const updateQuantity = useCallback((productId, quantity) => {
        if (quantity <= 0) {
            removeItem(productId);
            return;
        }

        setItems(prevItems => {
            return prevItems.map(item => {
                if (item.id === productId) {
                    const perUnit = item.stockDeductionPerUnit ?? (item.unit?.multiplier ?? 1);
                    const isCold = !!item.isCold;
                    const available = isCold ? (item.coldStock ?? 0) : (item.stock ?? 0);

                    // Total deduction of other items of same product and same stock type (cold/natural)
                    const otherDeduction = prevItems.reduce((acc, it) => {
                        if (it.id !== productId) return acc;
                        if (!!it.isCold !== isCold) return acc;
                        const dpu = it.stockDeductionPerUnit ?? (it.unit?.multiplier ?? 1);
                        if (it === item) return acc; // exclude current item
                        return acc + dpu * it.quantity;
                    }, 0);

                    const required = quantity * perUnit;
                    if (available && otherDeduction + required > available) {
                        return item; // exceed available stock, do not update
                    }

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
    const updateItemDiscount = useCallback((productId, discountValue) => {
        setItems(prevItems => {
            return prevItems.map(item => {
                if (item.id === productId) {
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
    const updatePrice = useCallback((productId, newPrice) => {
        setItems(prevItems => {
            return prevItems.map(item => {
                if (item.id === productId) {
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
        setPriceType('wholesale');
    }, []);

    // Get cart data for sale
    const getCartData = useCallback(() => {
        const totals = calculateTotals();

        return {
            items: items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                unitCost: item.unitCost,
                discount: item.discount || 0,
                total: item.total,
                retailPrice: item.retailPrice,
                wholesalePrice: item.wholesalePrice,
                coldPrice: item.coldPrice,
                unit: item.unit, // Include unit info
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
        setItems(presale.items.map(item => ({
            id: item.productId,
            ...item,
            retailPrice: item.retailPrice || item.unitPrice,
            wholesalePrice: item.wholesalePrice || item.unitPrice,
            coldPrice: item.coldPrice || item.unitPrice,
            isCold: item.isCold || presale.priceType === 'cold',
            isWholesale: !!item.isWholesale
        })));

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
    }, []);

    const loadSale = useCallback((sale) => {
        setItems((sale.items || []).map(item => ({
            id: item.productId,
            name: item.productName,
            barcode: item.barcode || '',
            quantity: Number(item.quantity) || 1,
            retailPrice: item.retailPrice || item.unitPrice,
            wholesalePrice: item.wholesalePrice || item.unitPrice,
            coldPrice: item.coldPrice || item.unitPrice,
            unitPrice: Number(item.unitPrice) || 0,
            unitCost: Number(item.unitCost) || 0,
            stock: undefined,
            coldStock: undefined,
            stockDeductionPerUnit: item.unit?.multiplier ? item.unit.multiplier : 1,
            unit: item.unit || null,
            isCold: !!item.isCold || sale.priceType === 'cold',
            isWholesale: !!item.isWholesale,
            discount: Number(item.discount) || 0,
            total: Number(item.total) || (Number(item.quantity) * Number(item.unitPrice))
        })));

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
    }, []);

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
    };

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
