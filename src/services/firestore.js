import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    setDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
    onSnapshot
} from 'firebase/firestore';
import { db, isDemoMode } from './firebase';

// Collection names
export const COLLECTIONS = {
    PRODUCTS: 'products',
    CUSTOMERS: 'customers',
    SALES: 'sales',
    PRESALES: 'presales',
    CASH_REGISTER: 'cashRegister',
    CASH_MOVEMENTS: 'cashMovements',
    CATEGORIES: 'categories',
    SETTINGS: 'settings',
    USERS: 'users',
    COUNTERS: 'counters',
    UNITS: 'units',
    INVENTORY_ENTRIES: 'inventoryEntries',
    STOCKS: 'stocks'
};

export const PRESALE_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

// Mock Data Store
const mockStore = {
    products: [
        { id: '1', name: 'Coca-Cola 2L', barcode: '7894900011517', price: 10.00, cost: 7.50, stock: 100, categoryId: '1', active: true, createdAt: new Date() },
        { id: '2', name: 'Heineken Long Neck', barcode: '7893249823', price: 8.50, cost: 5.00, stock: 200, categoryId: '2', active: true, createdAt: new Date() },
        { id: '3', name: 'Água Mineral 500ml', barcode: '789123456', price: 3.00, cost: 1.00, stock: 500, categoryId: '3', active: true, createdAt: new Date() },
        { id: '4', name: 'Red Bull 250ml', barcode: '9002490205', price: 12.00, cost: 8.00, stock: 50, categoryId: '3', active: true, createdAt: new Date() }
    ],
    customers: [
        { id: '1', name: 'Cliente Balcão', document: '', phone: '', createdAt: new Date() },
        { id: '2', name: 'João Silva', document: '123.456.789-00', phone: '(11) 99999-9999', createdAt: new Date() }
    ],
    sales: [],
    presales: [],
    cashRegister: [],
    cashMovements: [],
    categories: [
        { id: '1', name: 'Refrigerantes', description: 'Refrigerantes diversos' },
        { id: '2', name: 'Cervejas', description: 'Cervejas nacionais e importadas' },
        { id: '3', name: 'Não Alcoólicos', description: 'Águas e energéticos' }
    ],
    settings: [
        { id: '1', key: 'receiptHeader', value: 'MR BEBIDAS\nRua Demo, 123\n(11) 9999-9999' },
        { id: '2', key: 'receiptFooter', value: 'Obrigado pela preferência!\nVolte sempre!' }
    ],
    inventoryEntries: [],
    stocks: []
};

// Demo mode subscribers per collection for live updates in preview
const demoSubscribers = new Map();
const notifyDemoSubscribers = (collectionName) => {
    const subs = demoSubscribers.get(collectionName) || [];
    const data = [...(mockStore[collectionName] || [])];
    subs.forEach(cb => {
        try { cb(data); } catch {}
    });
};

// Helper to simulate async delay (keep minimal in demo mode)
const delay = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

// Generic CRUD operations
export const firestoreService = {
    // Create
    async create(collectionName, data) {
        if (isDemoMode) {
            await delay();
            const newItem = {
                id: Math.random().toString(36).substr(2, 9),
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            if (!mockStore[collectionName]) mockStore[collectionName] = [];
            mockStore[collectionName].push(newItem);
            notifyDemoSubscribers(collectionName);
            return newItem;
        }

        try {
            const docRef = await addDoc(collection(db, collectionName), {
                ...data,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            return { id: docRef.id, ...data };
        } catch (error) {
            console.error('Error creating document:', error);
            throw error;
        }
    },

    // Read all
    async getAll(collectionName, orderByField = 'createdAt', orderDirection = 'desc') {
        if (isDemoMode) {
            await delay();
            return [...(mockStore[collectionName] || [])];
        }

        try {
            let q = collection(db, collectionName);

            // Only apply orderBy if orderByField is provided
            if (orderByField) {
                q = query(q, orderBy(orderByField, orderDirection));
            }

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            try {
                // Fallback: run without server-side order and sort on client
                let qNoOrder = collection(db, collectionName);
                const snapshot = await getDocs(qNoOrder);
                let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (orderByField) {
                    results.sort((a, b) => {
                        const av = a[orderByField];
                        const bv = b[orderByField];
                        if (av === undefined && bv === undefined) return 0;
                        if (av === undefined) return orderDirection === 'asc' ? 1 : -1;
                        if (bv === undefined) return orderDirection === 'asc' ? -1 : 1;
                        return av < bv ? (orderDirection === 'asc' ? -1 : 1) : av > bv ? (orderDirection === 'asc' ? 1 : -1) : 0;
                    });
                }
                return results;
            } catch (fallbackErr) {
                console.error('Error getting documents (fallback):', fallbackErr);
                return [];
            }
        }
    },

    // Read one
    async getById(collectionName, id) {
        if (isDemoMode) {
            await delay();
            return mockStore[collectionName]?.find(item => item.id === id) || null;
        }

        try {
            const docRef = doc(db, collectionName, id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            return null;
        } catch (error) {
            console.error('Error getting document:', error);
            throw error;
        }
    },

    // Update
    async update(collectionName, id, data) {
        if (isDemoMode) {
            await delay();
            const index = mockStore[collectionName]?.findIndex(item => item.id === id);
            if (index >= 0) {
                mockStore[collectionName][index] = {
                    ...mockStore[collectionName][index],
                    ...data,
                    updatedAt: new Date()
                };
                notifyDemoSubscribers(collectionName);
                return mockStore[collectionName][index];
            }
            throw new Error('Document not found');
        }

        try {
            const docRef = doc(db, collectionName, id);
            await updateDoc(docRef, {
                ...data,
                updatedAt: Timestamp.now()
            });
            return { id, ...data };
        } catch (error) {
            console.error('Error updating document:', error);
            throw error;
        }
    },

    // Delete
    async delete(collectionName, id) {
        if (isDemoMode) {
            await delay();
            const index = mockStore[collectionName]?.findIndex(item => item.id === id);
            if (index >= 0) {
                mockStore[collectionName].splice(index, 1);
                notifyDemoSubscribers(collectionName);
                return true;
            }
            return false;
        }

        try {
            await deleteDoc(doc(db, collectionName, id));
            return true;
        } catch (error) {
            console.error('Error deleting document:', error);
            throw error;
        }
    },

    // Query with conditions
    async query(collectionName, conditions = [], orderByField = 'createdAt', orderDirection = 'desc', limitCount = null) {
        if (isDemoMode) {
            await delay();
            let results = [...(mockStore[collectionName] || [])];

            // Apply filters
            conditions.forEach(condition => {
                results = results.filter(item => {
                    const itemValue = item[condition.field];
                    const targetValue = condition.value;

                    // Handle Timestamp objects in mock data if needed
                    // Simple comparison for demo
                    if (condition.operator === '==') return itemValue === targetValue;
                    if (condition.operator === '!=') return itemValue !== targetValue;
                    if (condition.operator === '>') return itemValue > targetValue;
                    if (condition.operator === '>=') return itemValue >= targetValue;
                    if (condition.operator === '<') return itemValue < targetValue;
                    if (condition.operator === '<=') return itemValue <= targetValue;
                    if (condition.operator === 'array-contains') return Array.isArray(itemValue) && itemValue.includes(targetValue);
                    return true;
                });
            });

            // Apply sort (simple implementation)
            if (orderByField) {
                results.sort((a, b) => {
                    if (a[orderByField] < b[orderByField]) return orderDirection === 'asc' ? -1 : 1;
                    if (a[orderByField] > b[orderByField]) return orderDirection === 'asc' ? 1 : -1;
                    return 0;
                });
            }

            // Apply limit
            if (limitCount) {
                results = results.slice(0, limitCount);
            }

            return results;
        }

        try {
            let q = collection(db, collectionName);

            // Apply where conditions
            conditions.forEach(condition => {
                q = query(q, where(condition.field, condition.operator, condition.value));
            });

            // Apply ordering
            if (orderByField) {
                q = query(q, orderBy(orderByField, orderDirection));
            }

            // Apply limit
            if (limitCount) {
                q = query(q, limit(limitCount));
            }

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error querying documents:', error);
            throw error;
        }
    },

    // Real-time listener
    subscribe(collectionName, callback, conditions = []) {
        if (isDemoMode) {
            const data = mockStore[collectionName] || [];
            callback([...data]);
            const list = demoSubscribers.get(collectionName) || [];
            list.push(callback);
            demoSubscribers.set(collectionName, list);
            return () => {
                try {
                    const arr = demoSubscribers.get(collectionName) || [];
                    const next = arr.filter(cb => cb !== callback);
                    demoSubscribers.set(collectionName, next);
                } catch {}
            };
        }
        let q = collection(db, collectionName);

        conditions.forEach(condition => {
            q = query(q, where(condition.field, condition.operator, condition.value));
        });

        return onSnapshot(
            q,
            (snapshot) => {
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                callback(data);
            },
            (error) => {
                const code = error?.code;
                if (code === 'cancelled' || code === 'aborted' || code === 'unavailable') {
                    return;
                }
                console.error('Firestore listener error:', error);
            }
        );
    }
};

// Product-specific operations
export const productService = {
    async getAll() {
        return firestoreService.getAll(COLLECTIONS.PRODUCTS, 'name', 'asc');
    },

    async getAllLimited(limitCount = 200) {
        return firestoreService.query(
            COLLECTIONS.PRODUCTS,
            [],
            'name',
            'asc',
            limitCount
        );
    },

    async getById(id) {
        return firestoreService.getById(COLLECTIONS.PRODUCTS, id);
    },

    async getByBarcode(barcode) {
        const results = await firestoreService.query(
            COLLECTIONS.PRODUCTS,
            [{ field: 'barcode', operator: '==', value: barcode }]
        );
        return results[0] || null;
    },

    async search(searchTerm) {
        const products = await this.getAll();
        const term = searchTerm.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(term) ||
            (p.barcode && p.barcode.includes(term))
        );
    },

    async create(product) {
        return firestoreService.create(COLLECTIONS.PRODUCTS, product);
    },

    async update(id, product) {
        return firestoreService.update(COLLECTIONS.PRODUCTS, id, product);
    },

    async delete(id) {
        return firestoreService.delete(COLLECTIONS.PRODUCTS, id);
    },

    async deleteAll() {
        const products = await this.getAll();
        const promises = products.map(p => this.delete(p.id));
        return Promise.all(promises);
    },

    async deduplicateAndMerge() {
        const normalizeBarcode = (bc) => String(bc || '').replace(/\D/g, '').replace(/^0+/, '');
        const normalizeName = (n) => String(n || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const looseNameKey = (n) => normalizeName(n)
            .replace(/\b(\d+(\.\d+)?)\s*(ml|l)\b/g, '')
            .replace(/\bpet\b/g, '')
            .replace(/\blong\s*neck\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const approx = (a, b) => {
            const x = Number(a || 0);
            const y = Number(b || 0);
            const m = Math.max(x, y, 1);
            return Math.abs(x - y) <= 0.05 * m;
        };
        const all = await this.getAll();
        const processed = new Set();
        const groups = [];
        const byBarcode = new Map();
        const byNameEmptyBarcode = new Map();
        const byLooseName = new Map();
        for (const p of all) {
            const bc = normalizeBarcode(p.barcode);
            const nk = normalizeName(p.name);
            const lk = looseNameKey(p.name);
            if (bc) {
                const arr = byBarcode.get(bc) || [];
                arr.push(p);
                byBarcode.set(bc, arr);
            }
            if (!bc && nk) {
                const arr = byNameEmptyBarcode.get(nk) || [];
                arr.push(p);
                byNameEmptyBarcode.set(nk, arr);
            }
            if (lk) {
                const arr = byLooseName.get(lk) || [];
                arr.push(p);
                byLooseName.set(lk, arr);
            }
        }
        for (const [, arr] of byBarcode.entries()) {
            if (arr.length > 1) groups.push(arr);
        }
        for (const [, arr] of byNameEmptyBarcode.entries()) {
            if (arr.length > 1) groups.push(arr);
        }
        for (const [, arr] of byLooseName.entries()) {
            const hasNonEmpty = arr.some(p => normalizeBarcode(p.barcode));
            if (!hasNonEmpty && arr.length > 1) {
                groups.push(arr);
            } else if (hasNonEmpty) {
                const primary = arr.find(p => normalizeBarcode(p.barcode)) || arr[0];
                const pbc = normalizeBarcode(primary.barcode);
                const pun = primary.wholesaleUnit || primary.unitOfMeasure || '';
                const candidates = arr.filter(p => {
                    const bc = normalizeBarcode(p.barcode);
                    const un = p.wholesaleUnit || p.unitOfMeasure || '';
                    const sameBc = bc === pbc || !bc;
                    const sameCat = String(p.categoryId || '') === String(primary.categoryId || '');
                    const pricesClose = approx(p.wholesalePrice || p.price, primary.wholesalePrice || primary.price) &&
                        approx(p.cost, primary.cost);
                    const unitsMatch = String(un || '') === String(pun || '');
                    return (sameBc || !bc) && sameCat && pricesClose && unitsMatch;
                });
                if (candidates.length > 1) groups.push(candidates);
            }
        }
        let removed = 0;
        let mergedGroups = 0;
        for (const arr of groups) {
            const pool = arr.filter(p => !processed.has(p.id));
            if (pool.length <= 1) continue;
            mergedGroups++;
            const primary = pool.find(p => normalizeBarcode(p.barcode)) || pool[0];
            const others = pool.filter(p => p.id !== primary.id);
            let stockSum = 0;
            let coldSum = 0;
            let wholesalePrice = Number(primary.wholesalePrice || primary.price || 0);
            let coldPrice = Number(primary.coldPrice || 0);
            let cost = Number(primary.cost || 0);
            let coldCost = Number(primary.coldCost || 0);
            let wholesaleUnit = primary.wholesaleUnit || primary.unitOfMeasure || 'UN';
            let coldUnit = primary.coldUnit || primary.unitOfMeasure || 'UN';
            let wholesaleUnitMultiplier = Number(primary.wholesaleUnitMultiplier || 1);
            let coldUnitMultiplier = Number(primary.coldUnitMultiplier || 1);
            for (const p of pool) {
                stockSum += Number(p.stock || 0);
                coldSum += Number(p.coldStock || 0);
                if (!wholesalePrice || wholesalePrice <= 0) wholesalePrice = Number(p.wholesalePrice || p.price || wholesalePrice);
                if (!coldPrice || coldPrice <= 0) coldPrice = Number(p.coldPrice || coldPrice);
                if (!cost || cost <= 0) cost = Number(p.cost || cost);
                if (!coldCost || coldCost <= 0) coldCost = Number(p.coldCost || coldCost);
                if (!wholesaleUnit && p.wholesaleUnit) wholesaleUnit = p.wholesaleUnit;
                if (!coldUnit && p.coldUnit) coldUnit = p.coldUnit;
                if ((!wholesaleUnitMultiplier || wholesaleUnitMultiplier <= 1) && p.wholesaleUnitMultiplier) wholesaleUnitMultiplier = Number(p.wholesaleUnitMultiplier || wholesaleUnitMultiplier);
                if ((!coldUnitMultiplier || coldUnitMultiplier <= 1) && p.coldUnitMultiplier) coldUnitMultiplier = Number(p.coldUnitMultiplier || coldUnitMultiplier);
            }
            const updateData = {
                name: primary.name,
                barcode: normalizeBarcode(primary.barcode) ? primary.barcode : primary.barcode,
                stock: stockSum,
                coldStock: coldSum,
                wholesalePrice: wholesalePrice || 0,
                price: wholesalePrice || Number(primary.price || 0),
                coldPrice: coldPrice || 0,
                cost: cost || 0,
                coldCost: coldCost || 0,
                wholesaleUnit,
                coldUnit,
                wholesaleUnitMultiplier: Math.max(1, Number(wholesaleUnitMultiplier || 1)),
                coldUnitMultiplier: Math.max(1, Number(coldUnitMultiplier || 1)),
                categoryId: primary.categoryId || null,
                active: primary.active !== false
            };
            await firestoreService.update(COLLECTIONS.PRODUCTS, primary.id, updateData);
            processed.add(primary.id);
            for (const dup of others) {
                if (processed.has(dup.id)) continue;
                await firestoreService.delete(COLLECTIONS.PRODUCTS, dup.id);
                processed.add(dup.id);
                removed++;
            }
        }
        return { removed, mergedGroups };
    }
    ,
    async resetBarcodesSequential(pad = 3) {
        const all = await this.getAll();
        const sorted = [...all].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
        let updatedCount = 0;
        for (let i = 0; i < sorted.length; i++) {
            const seq = String(i + 1).padStart(pad, '0');
            await firestoreService.update(COLLECTIONS.PRODUCTS, sorted[i].id, { barcode: seq });
            updatedCount++;
        }
        return updatedCount;
    }
};

// Customer-specific operations
export const customerService = {
    async getAll() {
        return firestoreService.getAll(COLLECTIONS.CUSTOMERS, 'name', 'asc');
    },

    async search(searchTerm) {
        const customers = await this.getAll();
        const term = searchTerm.toLowerCase();
        return customers.filter(c =>
            c.name.toLowerCase().includes(term) ||
            (c.document && c.document.includes(term)) ||
            (c.phone && c.phone.includes(term))
        );
    },

    async create(customer) {
        return firestoreService.create(COLLECTIONS.CUSTOMERS, customer);
    },

    async update(id, customer) {
        return firestoreService.update(COLLECTIONS.CUSTOMERS, id, customer);
    },

    async delete(id) {
        return firestoreService.delete(COLLECTIONS.CUSTOMERS, id);
    }
};

// Sales-specific operations
export const salesService = {
    async create(sale, fast = false) {
        let next = await counterService.getNextNumber('sales');
        if (!Number.isFinite(next) || next <= 0) {
            try {
                const latest = await this.getAll(1);
                const last = latest && latest.length > 0 ? latest[0] : null;
                const lastNum = Number(last?.saleNumber);
                next = Number.isFinite(lastNum) && lastNum >= 1 ? (lastNum + 1) : 1;
            } catch {
                next = 1;
            }
        }
        const saleNumber = String(next);

        const saleWithNumber = {
            ...sale,
            saleNumber: saleNumber
        };
        return firestoreService.create(COLLECTIONS.SALES, saleWithNumber);
    },

    async getAll(limitCount = 100) {
        return firestoreService.query(COLLECTIONS.SALES, [], 'createdAt', 'desc', limitCount);
    },

    async getById(id) {
        return firestoreService.getById(COLLECTIONS.SALES, id);
    },

    async getByDateRange(startDate, endDate) {
        // For demo mode, simple filter
        if (isDemoMode) {
            const allSales = await this.getAll();
            return allSales.filter(sale => {
                const date = new Date(sale.createdAt);
                return date >= startDate && date <= endDate;
            });
        }

        return firestoreService.query(
            COLLECTIONS.SALES,
            [
                { field: 'createdAt', operator: '>=', value: Timestamp.fromDate(startDate) },
                { field: 'createdAt', operator: '<=', value: Timestamp.fromDate(endDate) }
            ]
        );
    },

    async getByCashRegister(cashRegisterId) {
        return firestoreService.query(
            COLLECTIONS.SALES,
            [{ field: 'cashRegisterId', operator: '==', value: cashRegisterId }],
            null // Disable ordering to avoid composite index requirement
        );
    },

    async update(id, sale) {
        return firestoreService.update(COLLECTIONS.SALES, id, sale);
    },

    subscribeAll(callback) {
        return firestoreService.subscribe(COLLECTIONS.SALES, callback, []);
    },

    subscribeByDateRange(callback, startDate, endDate) {
        // Ensure we have valid Date objects
        const start = startDate instanceof Date ? startDate : new Date(startDate);
        const end = endDate instanceof Date ? endDate : new Date(endDate);
        
        // Adjust end date to end of day if it's at 00:00:00
        if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
            end.setHours(23, 59, 59, 999);
        }

        // For demo mode, we'll just subscribe all and filter client-side
        // But for Firestore, we use conditions
        if (isDemoMode) {
            return this.subscribeAll((allSales) => {
                const filtered = allSales.filter(sale => {
                    const date = new Date(sale.createdAt);
                    return date >= start && date <= end;
                });
                callback(filtered);
            });
        }

        return firestoreService.subscribe(
            COLLECTIONS.SALES,
            callback,
            [
                { field: 'createdAt', operator: '>=', value: Timestamp.fromDate(start) },
                { field: 'createdAt', operator: '<=', value: Timestamp.fromDate(end) }
            ]
        );
    }
};

// Presales-specific operations
export const presalesService = {
    async create(presale) {
        return firestoreService.create(COLLECTIONS.PRESALES, presale);
    },

    async getAll() {
        return firestoreService.getAll(COLLECTIONS.PRESALES);
    },

    async getById(id) {
        return firestoreService.getById(COLLECTIONS.PRESALES, id);
    },

    async getByStatus(status) {
        return firestoreService.query(
            COLLECTIONS.PRESALES,
            [{ field: 'status', operator: '==', value: status }],
            null
        );
    },

    async update(id, presale) {
        return firestoreService.update(COLLECTIONS.PRESALES, id, presale);
    },

    async updateStatus(id, status) {
        return firestoreService.update(COLLECTIONS.PRESALES, id, { status });
    },

    async delete(id) {
        return firestoreService.delete(COLLECTIONS.PRESALES, id);
    },

    async cancelAll() {
        const pendingReserved = await firestoreService.query(
            COLLECTIONS.PRESALES,
            [
                { field: 'status', operator: '==', value: 'pending' },
                { field: 'reserved', operator: '==', value: true }
            ],
            null
        );
        if (!pendingReserved || pendingReserved.length === 0) {
            return { cancelled: 0, releasedProducts: 0 };
        }
        const totalsByProduct = new Map();
        for (const presale of pendingReserved) {
            const items = Array.isArray(presale.items) ? presale.items : [];
            for (const item of items) {
                const pid = item?.productId;
                if (!pid) continue;
                const qty = Number(item?.quantity || 0);
                const multiplier = Number(item?.unit?.multiplier || 1);
                const deduction = qty * multiplier;
                const isCold = !!item?.isCold;
                const acc = totalsByProduct.get(pid) || { warm: 0, cold: 0 };
                if (isCold) acc.cold += deduction;
                else acc.warm += deduction;
                totalsByProduct.set(pid, acc);
            }
        }
        let releasedProducts = 0;
        for (const [pid, acc] of totalsByProduct.entries()) {
            try {
                const product = await productService.getById(pid);
                if (!product) continue;
                const payload = {};
                if (acc.cold > 0) {
                    const current = Number(product.reservedColdStock || 0);
                    payload.reservedColdStock = Math.max(0, current - acc.cold);
                }
                if (acc.warm > 0) {
                    const current = Number(product.reservedStock || 0);
                    payload.reservedStock = Math.max(0, current - acc.warm);
                }
                if (Object.keys(payload).length > 0) {
                    await productService.update(pid, payload);
                    releasedProducts++;
                }
            } catch {}
        }
        try {
            await Promise.all(
                pendingReserved.map(p =>
                    firestoreService.update(COLLECTIONS.PRESALES, p.id, { status: 'cancelled', reserved: false })
                )
            );
        } catch {}
        return { cancelled: pendingReserved.length, releasedProducts };
    },

    subscribeAll(callback) {
        return firestoreService.subscribe(COLLECTIONS.PRESALES, callback, []);
    }
};

// Cash Register operations
export const cashRegisterService = {
    async open(data) {
        return firestoreService.create(COLLECTIONS.CASH_REGISTER, {
            ...data,
            status: 'open',
            openedAt: isDemoMode ? new Date() : Timestamp.now()
        });
    },

    async close(id, data) {
        if (isDemoMode) {
            return firestoreService.update(COLLECTIONS.CASH_REGISTER, id, {
                ...data,
                status: 'closed',
                closedAt: new Date()
            });
        }

        try {
            const docRef = doc(db, COLLECTIONS.CASH_REGISTER, id);
            // Use setDoc with merge to handle cases where document might not exist
            await setDoc(docRef, {
                ...data,
                status: 'closed',
                closedAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            }, { merge: true });
            return { id, ...data };
        } catch (error) {
            console.error('Error closing cash register:', error);
            throw error;
        }
    },

    async getCurrent() {
        const results = await firestoreService.query(
            COLLECTIONS.CASH_REGISTER,
            [{ field: 'status', operator: '==', value: 'open' }],
            'openedAt',
            'desc',
            1
        );
        return results[0] || null;
    },

    async getHistory() {
        const all = await firestoreService.getAll(COLLECTIONS.CASH_REGISTER, null, null);
        const closed = all.filter(r => !!r.closedAt);
        closed.sort((a, b) => {
            const av = (a.closedAt && a.closedAt.toMillis) ? a.closedAt.toMillis() : new Date(a.closedAt || 0).getTime();
            const bv = (b.closedAt && b.closedAt.toMillis) ? b.closedAt.toMillis() : new Date(b.closedAt || 0).getTime();
            return bv - av;
        });
        return closed;
    },

    async getAll() {
        return firestoreService.getAll(COLLECTIONS.CASH_REGISTER);
    },

    async addMovement(movement) {
        return firestoreService.create(COLLECTIONS.CASH_MOVEMENTS, movement);
    },

    async getMovements(cashRegisterId) {
        return firestoreService.query(
            COLLECTIONS.CASH_MOVEMENTS,
            [{ field: 'cashRegisterId', operator: '==', value: cashRegisterId }]
        );
    }
};

// Settings operations
export const settingsService = {
    async get(key) {
        const results = await firestoreService.query(
            COLLECTIONS.SETTINGS,
            [{ field: 'key', operator: '==', value: key }],
            null, // No ordering to avoid index requirement
            null,
            null
        );
        return results[0] || null;
    },

    async set(key, value) {
        const existing = await this.get(key);
        if (existing) {
            return firestoreService.update(COLLECTIONS.SETTINGS, existing.id, { value });
        } else {
            return firestoreService.create(COLLECTIONS.SETTINGS, { key, value });
        }
    },

    async getAll() {
        return firestoreService.getAll(COLLECTIONS.SETTINGS, null, null); // No ordering
    }
};

// Category operations
export const categoryService = {
    async getAll() {
        return firestoreService.getAll(COLLECTIONS.CATEGORIES, 'name', 'asc');
    },

    async create(category) {
        return firestoreService.create(COLLECTIONS.CATEGORIES, category);
    },

    async update(id, category) {
        return firestoreService.update(COLLECTIONS.CATEGORIES, id, category);
    },

    async delete(id) {
        return firestoreService.delete(COLLECTIONS.CATEGORIES, id);
    }
};

// Inventory (CMV) operations
export const inventoryService = {
    async addEntry(entry) {
        const payload = {
            productId: entry.productId,
            isCold: !!entry.isCold,
            quantity: Number(entry.quantity || 0),
            unitCost: Number(entry.unitCost || 0),
            remaining: Number(entry.quantity || 0),
            date: isDemoMode ? (entry.date || new Date()) : (entry.date ? Timestamp.fromDate(entry.date) : Timestamp.now())
        };
        return firestoreService.create(COLLECTIONS.INVENTORY_ENTRIES, payload);
    },
    async getAvailable(productId, isCold = false) {
        if (isDemoMode) {
            await delay();
            const list = (mockStore.inventoryEntries || []).filter(e =>
                String(e.productId || '') === String(productId || '') &&
                !!e.remaining &&
                (!!e.isCold) === (!!isCold)
            );
            return list.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
        }
        const results = await firestoreService.query(
            COLLECTIONS.INVENTORY_ENTRIES,
            [
                { field: 'productId', operator: '==', value: productId },
                { field: 'isCold', operator: '==', value: !!isCold },
                { field: 'remaining', operator: '>', value: 0 }
            ],
            null
        );
        results.sort((a, b) => {
            const ad = a.date && a.date.toMillis ? a.date.toMillis() : new Date(a.date || 0).getTime();
            const bd = b.date && b.date.toMillis ? b.date.toMillis() : new Date(b.date || 0).getTime();
            return ad - bd;
        });
        return results;
    },
    async consume(productId, isCold, quantity) {
        let need = Number(quantity || 0);
        if (!Number.isFinite(need) || need <= 0) return { cmv: 0, consumed: [] };
        const entries = await this.getAvailable(productId, !!isCold);
        const consumed = [];
        let cmv = 0;
        for (const e of entries) {
            if (need <= 0) break;
            const available = Number(e.remaining || 0);
            if (available <= 0) continue;
            const take = Math.min(available, need);
            cmv += take * Number(e.unitCost || 0);
            consumed.push({
                entryId: e.id,
                productId,
                isCold: !!isCold,
                quantity: take,
                unitCost: Number(e.unitCost || 0),
                date: e.date
            });
            need -= take;
            const nextRemaining = available - take;
            if (isDemoMode) {
                const idx = (mockStore.inventoryEntries || []).findIndex(x => x.id === e.id);
                if (idx >= 0) mockStore.inventoryEntries[idx].remaining = nextRemaining;
            } else {
                await firestoreService.update(COLLECTIONS.INVENTORY_ENTRIES, e.id, { remaining: nextRemaining });
            }
        }
        return { cmv, consumed, shortage: Math.max(0, need) };
    },
    async consumeForItems(items) {
        const results = [];
        let cmvTotal = 0;
        for (const it of items) {
            const pid = it.productId || it.id;
            if (!pid) continue;
            const qty = (it.stockDeductionPerUnit
                ? (it.stockDeductionPerUnit * Number(it.quantity || 0))
                : (it.unit && it.unit.multiplier
                    ? (Number(it.quantity || 0) * it.unit.multiplier)
                    : Number(it.quantity || 0)));
            const isCold = !!(it.isCold || it.priceType === 'retail' && it.isCold);
            const { cmv, consumed, shortage } = await this.consume(pid, isCold, qty);
            cmvTotal += cmv;
            results.push({
                productId: pid,
                isCold,
                requested: qty,
                cmv,
                consumed,
                shortage
            });
        }
        return { cmvTotal, details: results };
    }
};

export const stockService = {
    async get(productId, type) {
        if (isDemoMode) {
            await delay();
            const keyType = String(type || '').toUpperCase();
            return (mockStore.stocks || []).find(s => String(s.productId || '') === String(productId || '') && String(s.type || '').toUpperCase() === keyType) || null;
        }
        const results = await firestoreService.query(
            COLLECTIONS.STOCKS,
            [
                { field: 'productId', operator: '==', value: productId },
                { field: 'type', operator: '==', value: String(type || '').toUpperCase() }
            ],
            null
        );
        return results[0] || null;
    },
    async ensure(productId, type) {
        const keyType = String(type || '').toUpperCase();
        let s = await this.get(productId, keyType);
        if (s) return s;
        let seedQty = 0;
        let seedCost = 0;
        try {
            const p = await productService.getById(productId);
            if (keyType === 'MERCEARIA') {
                seedQty = Number(p?.coldStock || 0);
                seedCost = Number(p?.coldCost || 0);
            } else {
                seedQty = Number(p?.stock || 0);
                seedCost = Number(p?.cost || 0);
            }
        } catch {}
        const payload = {
            productId,
            type: keyType,
            totalQuantity: seedQty,
            averageCost: seedQty > 0 ? Number(seedCost || 0) : 0,
            createdAt: isDemoMode ? new Date() : Timestamp.now()
        };
        if (isDemoMode) {
            const created = await firestoreService.create(COLLECTIONS.STOCKS, payload);
            return created;
        }
        const created = await firestoreService.create(COLLECTIONS.STOCKS, payload);
        return created;
    },
    async addEntry(productId, type, quantity, unitCost) {
        const keyType = String(type || '').toUpperCase();
        let s = await this.ensure(productId, keyType);
        const currQty = Number(s.totalQuantity || 0);
        const currAvg = Number(s.averageCost || 0);
        const entryQty = Number(quantity || 0);
        const entryCost = Number(unitCost || 0);
        const totalValue = (currQty * currAvg) + (entryQty * entryCost);
        const newQty = currQty + entryQty;
        const newAvg = newQty > 0 ? (totalValue / newQty) : 0;
        const updateData = {
            totalQuantity: newQty,
            averageCost: newAvg,
            updatedAt: isDemoMode ? new Date() : Timestamp.now()
        };
        if (isDemoMode) {
            const idx = (mockStore.stocks || []).findIndex(x => x.id === s.id);
            if (idx >= 0) {
                mockStore.stocks[idx] = { ...mockStore.stocks[idx], ...updateData };
                return mockStore.stocks[idx];
            }
            const created = await firestoreService.create(COLLECTIONS.STOCKS, { productId, type: keyType, ...updateData });
            return created;
        }
        await firestoreService.update(COLLECTIONS.STOCKS, s.id, updateData);
        return { id: s.id, ...s, ...updateData };
    },
    async consume(productId, type, quantity) {
        const keyType = String(type || '').toUpperCase();
        let s = await this.ensure(productId, keyType);
        const currQty = Number(s.totalQuantity || 0);
        const avg = Number(s.averageCost || 0);
        const req = Number(quantity || 0);
        const take = Math.min(currQty, req);
        const cmv = avg * take;
        const shortage = Math.max(0, req - take);
        const updateData = {
            totalQuantity: Math.max(0, currQty - take),
            updatedAt: isDemoMode ? new Date() : Timestamp.now()
        };
        if (isDemoMode) {
            const idx = (mockStore.stocks || []).findIndex(x => x.id === s.id);
            if (idx >= 0) mockStore.stocks[idx] = { ...mockStore.stocks[idx], ...updateData };
        } else {
            await firestoreService.update(COLLECTIONS.STOCKS, s.id, updateData);
        }
        return { cmv, consumed: take, shortage, averageCost: avg };
    },
    async consumeForItems(items) {
        const details = [];
        let cmvTotal = 0;
        for (const it of items) {
            const pid = it.productId || it.id;
            if (!pid) continue;
            const qty = (it.stockDeductionPerUnit
                ? (it.stockDeductionPerUnit * Number(it.quantity || 0))
                : (it.unit && it.unit.multiplier
                    ? (Number(it.quantity || 0) * it.unit.multiplier)
                    : Number(it.quantity || 0)));
            const type = (it.isCold ? 'MERCEARIA' : 'ATACADO');
            const { cmv, consumed, shortage, averageCost } = await this.consume(pid, type, qty);
            cmvTotal += cmv;
            details.push({
                productId: pid,
                type,
                requested: qty,
                consumed,
                shortage,
                averageCost,
                cmv
            });
        }
        return { cmvTotal, details };
    }
};

// Units operations
export const unitsService = {
    async getAll() {
        return firestoreService.getAll(COLLECTIONS.UNITS, 'name', 'asc');
    },

    async create(unit) {
        return firestoreService.create(COLLECTIONS.UNITS, unit);
    },

    async update(id, unit) {
        return firestoreService.update(COLLECTIONS.UNITS, id, unit);
    },

    async delete(id) {
        return firestoreService.delete(COLLECTIONS.UNITS, id);
    },

    // Initialize default units if none exist
    async initDefaultUnits() {
        const units = await this.getAll();
        if (units.length === 0) {
            const defaultUnits = [
                { name: 'Unidade', abbreviation: 'UN' },
                { name: 'Quilograma', abbreviation: 'KG' },
                { name: 'Litro', abbreviation: 'LT' },
                { name: 'Caixa', abbreviation: 'CX' },
                { name: 'Pacote', abbreviation: 'PC' },
                { name: 'Metro', abbreviation: 'MT' }
            ];

            for (const unit of defaultUnits) {
                await this.create(unit);
            }
            console.log('Default units created');
        }
    }
};

// User operations
export const userService = {
    async getAll() {
        return firestoreService.getAll(COLLECTIONS.USERS, 'name', 'asc');
    },

    async getByUsername(username) {
        const term = username.toLowerCase();
        const results = await firestoreService.query(
            COLLECTIONS.USERS,
            [{ field: 'username', operator: '==', value: term }],
            null // Disable ordering to avoid composite index requirement
        );
        return results[0] || null;
    },

    async create(user) {
        // Normalize username to lowercase
        const userToCreate = {
            ...user,
            username: user.username.toLowerCase()
        };

        // Check if username already exists
        const existing = await this.getByUsername(userToCreate.username);
        if (existing) throw new Error('Nome de usuário já existe');

        return firestoreService.create(COLLECTIONS.USERS, userToCreate);
    },

    async update(id, user) {
        const userToUpdate = { ...user };

        if (userToUpdate.username) {
            userToUpdate.username = userToUpdate.username.toLowerCase();

            // Check if username already exists (and is not the current user)
            const existing = await this.getByUsername(userToUpdate.username);
            if (existing && existing.id !== id) {
                throw new Error('Nome de usuário já existe');
            }
        }

        return firestoreService.update(COLLECTIONS.USERS, id, userToUpdate);
    },

    async delete(id) {
        return firestoreService.delete(COLLECTIONS.USERS, id);
    },

    // Initialize default admin user if no users exist
    async initDefaultUser() {
        const users = await this.getAll();
        if (users.length === 0) {
            await this.create({
                name: 'Administrador',
                username: 'admin',
                password: '123', // In a real app, this should be hashed!
                role: 'manager', // manager or seller
                active: true
            });
            console.log('Default admin user created');
        }
    }
};

// Counter service for sequential numbering
export const counterService = {
    async getNextNumber(counterName) {
        if (isDemoMode) {
            await delay();
            if (!mockStore.counters) mockStore.counters = {};
            if (!mockStore.counters[counterName]) mockStore.counters[counterName] = 0;
            mockStore.counters[counterName]++;
            return mockStore.counters[counterName];
        }

        try {
            const { runTransaction } = await import('firebase/firestore');
            const counterRef = doc(db, COLLECTIONS.COUNTERS, counterName);

            const nextNumber = await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);

                let newNumber = 1;
                if (counterDoc.exists()) {
                    newNumber = (counterDoc.data().value || 0) + 1;
                    transaction.update(counterRef, { value: newNumber });
                } else {
                    transaction.set(counterRef, { value: newNumber });
                }

                return newNumber;
            });

            return nextNumber;
        } catch (error) {
            return null;
        }
    },

    async reset(counterName) {
        if (isDemoMode) {
            await delay();
            if (!mockStore.counters) mockStore.counters = {};
            mockStore.counters[counterName] = 0;
            return true;
        }

        try {
            const counterRef = doc(db, COLLECTIONS.COUNTERS, counterName);
            await updateDoc(counterRef, { value: 0 });
            return true;
        } catch (error) {
            // If counter doesn't exist, that's fine
            if (error.code === 'not-found') return true;
            console.error('Error resetting counter:', error);
            throw error;
        }
    }
};
// Backup operations
export const backupService = {
    async createBackup() {
        const backupData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            collections: {}
        };

        const collectionsToBackup = Object.values(COLLECTIONS);

        for (const collectionName of collectionsToBackup) {
            try {
                const data = await firestoreService.getAll(collectionName, null, null);
                backupData.collections[collectionName] = data;
            } catch (error) {
                console.error(`Error backing up collection ${collectionName}:`, error);
                backupData.collections[collectionName] = { error: error.message };
            }
        }

        return backupData;
    },

    async restoreBackup(backupData) {
        if (!backupData || !backupData.collections) {
            throw new Error('Formato de backup inválido');
        }

        const results = {
            success: [],
            errors: []
        };

        for (const [collectionName, items] of Object.entries(backupData.collections)) {
            try {
                // Skip if collection has error
                if (items.error) {
                    results.errors.push({ collection: collectionName, error: items.error });
                    continue;
                }

                // Delete all existing documents
                const existing = await firestoreService.getAll(collectionName, null, null);
                for (const doc of existing) {
                    await firestoreService.delete(collectionName, doc.id);
                }

                // Restore documents from backup
                for (const item of items) {
                    const { id, ...data } = item;
                    // Use the original ID if available
                    if (id && !isDemoMode) {
                        await firestoreService.create(collectionName, data, id);
                    } else {
                        await firestoreService.create(collectionName, data);
                    }
                }

                results.success.push(collectionName);
            } catch (error) {
                console.error(`Error restoring collection ${collectionName}:`, error);
                results.errors.push({ collection: collectionName, error: error.message });
            }
        }

        return results;
    }
};
