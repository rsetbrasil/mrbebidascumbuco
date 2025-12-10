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
    UNITS: 'units'
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
    ]
};

// Helper to simulate async delay
const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

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
            console.error('Error getting documents:', error);
            throw error;
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
            // If the document does not exist, fall back to setDoc with merge
            if (error?.code === 'not-found') {
                const docRef = doc(db, collectionName, id);
                await setDoc(docRef, {
                    ...data,
                    updatedAt: Timestamp.now()
                }, { merge: true });
                return { id, ...data };
            }
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
    subscribe(collectionName, callback, conditions = [], orderByField = null, orderDirection = 'asc') {
        if (isDemoMode) {
            const data = mockStore[collectionName] || [];
            callback(data);
            return () => { };
        }

        let q = collection(db, collectionName);

        conditions.forEach(condition => {
            q = query(q, where(condition.field, condition.operator, condition.value));
        });

        if (orderByField) {
            q = query(q, orderBy(orderByField, orderDirection));
        }

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
    async create(sale) {
        // Sequential sale number starting at 1
        const nextNumber = await counterService.getNextNumber('sales');
        const saleWithNumber = { ...sale, saleNumber: String(nextNumber) };
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

    async delete(id) {
        return firestoreService.delete(COLLECTIONS.SALES, id);
    },

    async deleteDuplicates() {
        const list = await firestoreService.getAll(COLLECTIONS.SALES, 'createdAt', 'asc');
        const seen = new Map();
        const toDelete = [];
        const normDate = (v) => {
            try {
                const d = v?.toDate ? v.toDate() : (v instanceof Date ? v : new Date(v));
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            } catch {
                return '';
            }
        };
        const itemsKey = (items) => {
            if (!Array.isArray(items)) return '';
            return items
                .map(i => `${i.productId || i.id || ''}:${Number(i.quantity) || 0}`)
                .sort()
                .join('|');
        };
        for (const s of list) {
            if (s?.status === 'cancelled') continue;
            const key = [
                s.customerId || s.customer?.id || '',
                itemsKey(s.items || []),
                Number(s.total || 0).toFixed(2),
                normDate(s.createdAt)
            ].join('|');
            if (seen.has(key)) {
                toDelete.push(s.id);
            } else {
                seen.set(key, s.id);
            }
        }
        await Promise.all(toDelete.map(id => firestoreService.delete(COLLECTIONS.SALES, id)));
        return { deleted: toDelete.length };
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
            [{ field: 'status', operator: '==', value: status }]
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

    async deleteDuplicates() {
        const list = await firestoreService.getAll(COLLECTIONS.PRESALES, 'createdAt', 'asc');
        const seen = new Map();
        const toDelete = [];
        const normDate = (v) => {
            try {
                const d = v?.toDate ? v.toDate() : (v instanceof Date ? v : new Date(v));
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            } catch {
                return '';
            }
        };
        const itemsKey = (items) => {
            if (!Array.isArray(items)) return '';
            return items
                .map(i => `${i.productId || i.id || ''}:${Number(i.quantity) || 0}`)
                .sort()
                .join('|');
        };
        for (const p of list) {
            if (p?.status !== 'pending') continue;
            const key = [
                p.customerId || p.customer?.id || '',
                itemsKey(p.items || []),
                Number(p.total || 0).toFixed(2),
                normDate(p.createdAt)
            ].join('|');
            if (seen.has(key)) {
                toDelete.push(p.id);
            } else {
                seen.set(key, p.id);
            }
        }
        await Promise.all(toDelete.map(id => firestoreService.delete(COLLECTIONS.PRESALES, id)));
        return { deleted: toDelete.length };
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

    subscribeOpen(callback) {
        return firestoreService.subscribe(
            COLLECTIONS.CASH_REGISTER,
            callback,
            [{ field: 'status', operator: '==', value: 'open' }],
            'openedAt',
            'desc'
        );
    },

    async getHistory() {
        return firestoreService.query(
            COLLECTIONS.CASH_REGISTER,
            [], // No explicit filter needed, orderBy 'closedAt' implicitly filters documents where it exists
            'closedAt',
            'desc'
        );
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
    },

    subscribeAll(callback) {
        return firestoreService.subscribe(COLLECTIONS.SETTINGS, callback);
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
            console.error('Error getting next number:', error);
            throw error;
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
