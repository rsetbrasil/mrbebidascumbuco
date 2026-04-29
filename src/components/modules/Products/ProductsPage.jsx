import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package, AlertCircle, List, Printer, Tag } from 'lucide-react';
import CategoriesPage from '../Categories/CategoriesPage';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Loading from '../../common/Loading';
import Notification from '../../common/Notification';
import ProductModal from './ProductModal';
import Modal from '../../common/Modal';
import { productService, categoryService } from '../../../services/firestore';
import { formatCurrency } from '../../../utils/formatters';
import { printProductsPriceList } from '../../../utils/receiptPrinter';
import { useApp } from '../../../contexts/AppContext';
import { useAuth } from '../../../contexts/AuthContext';

const ProductsPage = () => {
    const { settings } = useApp();
    const { canWrite, user } = useAuth();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [notification, setNotification] = useState(null);
    const [isPriceListOpen, setIsPriceListOpen] = useState(false);
    const [priceListSearch, setPriceListSearch] = useState('');
    const [activeTab, setActiveTab] = useState('products');

    useEffect(() => {
        try {
            const cachedProducts = JSON.parse(localStorage.getItem('pdv_products_cache') || 'null');
            if (Array.isArray(cachedProducts) && cachedProducts.length > 0) {
                setProducts(cachedProducts);
                setLoading(false);
            }
            const cachedCategories = JSON.parse(localStorage.getItem('pdv_categories_cache') || 'null');
            if (cachedCategories && typeof cachedCategories === 'object') {
                setCategories(cachedCategories);
            }
        } catch { }
        loadData();
    }, []);

    const [limit, setLimit] = useState(200);
    const [loadedAll, setLoadedAll] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            // Start both requests in parallel
            const productsPromise = loadedAll ? productService.getAll() : productService.getAllLimited(limit);
            const categoriesPromise = categoryService.getAll();

            // Await products first to show content ASAP
            const productsData = await productsPromise;
            setProducts(productsData);

            // Allow UI to render products (even with missing category names)
            if (productsData.length > 0) setLoading(false);

            try { localStorage.setItem('pdv_products_cache', JSON.stringify(productsData)); } catch { }

            // Then await categories and update
            const categoriesData = await categoriesPromise;
            const catMap = {};
            categoriesData.forEach(cat => {
                catMap[cat.id] = cat.name;
            });
            setCategories(catMap);
            try { localStorage.setItem('pdv_categories_cache', JSON.stringify(catMap)); } catch { }

        } catch (error) {
            console.error('Error loading data:', error);
            showNotification('error', 'Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleSearch = async (term) => {
        setSearchTerm(term);
    };

    const handleLoadMore = async () => {
        setLoadedAll(true);
        await loadData();
    };

    const handleIncreaseLimit = async () => {
        const next = limit + 200;
        setLimit(next);
        setLoadedAll(false);
        await loadData();
    };

    const handleSave = async (productData) => {
        try {
            if (editingProduct) {
                await productService.update(editingProduct.id, productData);
                showNotification('success', 'Produto atualizado com sucesso');
            } else {
                await productService.create(productData);
                showNotification('success', 'Produto criado com sucesso');
            }
            loadData();
        } catch (error) {
            console.error('Error saving product:', error);
            showNotification('error', 'Erro ao salvar produto');
            throw error;
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir este produto?')) return;

        try {
            await productService.delete(id);
            showNotification('success', 'Produto excluído com sucesso');
            loadData();
        } catch (error) {
            console.error('Error deleting product:', error);
            showNotification('error', 'Erro ao excluir produto');
        }
    };

    const handleImportSuccess = (successCount, errorCount) => {
        showNotification('success', `${successCount} produtos importados com sucesso!`);
        if (errorCount > 0) {
            setTimeout(() => {
                showNotification('warning', `${errorCount} produtos falharam na importação.`);
            }, 3000);
        }
        loadData();
    };

    const filteredProducts = products
        .filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.barcode && p.barcode.includes(searchTerm))
        )
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));

    const priceListFilteredProducts = products
        .filter(p => {
            const term = String(priceListSearch || '').trim().toLowerCase();
            if (!term) return true;
            const name = String(p?.name || '').toLowerCase();
            const barcode = String(p?.barcode || '');
            return name.includes(term) || barcode.includes(priceListSearch);
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));

    if (loading && !products.length) return <Loading fullScreen />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {notification && (
                <Notification
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}

            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Package size={14} /> {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''}
                    </div>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>Produtos</h1>
                </div>
                {activeTab === 'products' && (
                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                        <Button
                            variant="secondary"
                            onClick={() => setIsPriceListOpen(true)}
                            icon={<List size={20} />}
                        >
                            Lista (Venda/Custo)
                        </Button>
                        {canWrite && user?.role === 'admin' && (
                            <>
                                <Button
                                    variant="secondary"
                                    onClick={async () => {
                                        if (!window.confirm('ATENÇÃO: Isso vai redefinir TODOS os códigos (barcode) dos produtos. Deseja continuar?')) return;
                                        if (!window.confirm('Confirmar novamente: Redefinir códigos sequenciais por ordem alfabética?')) return;

                                        setLoading(true);
                                        try {
                                            // Ordena por nome (asc) e gera códigos sequenciais 1..N (sem zeros à esquerda)
                                            const sorted = [...products].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
                                            let updatedCount = 0;

                                            for (let i = 0; i < sorted.length; i++) {
                                                const product = sorted[i];
                                                const seq = String(i + 1);
                                                await productService.update(product.id, { barcode: seq });
                                                updatedCount++;
                                            }

                                            showNotification('success', `${updatedCount} códigos redefinidos (1… em ordem alfabética)`);
                                            loadData();
                                        } catch (error) {
                                            console.error('Error resetting codes:', error);
                                            showNotification('error', 'Erro ao redefinir códigos');
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    icon={<Package size={20} />}
                                >
                                    Redefinir Códigos
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={async () => {
                                        if (!window.confirm('Deseja remover produtos duplicados e somar estoques automaticamente?')) return;
                                        setLoading(true);
                                        try {
                                            const { mergedGroups, removed } = await productService.deduplicateAndMerge();
                                            showNotification('success', `Mesclados ${mergedGroups} grupos, removidos ${removed} duplicados`);
                                            await loadData();
                                        } catch (error) {
                                            console.error('Erro ao remover duplicados:', error);
                                            showNotification('error', 'Falha ao remover duplicados');
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    icon={<AlertCircle size={20} />}
                                >
                                    Remover Duplicados
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={async () => {
                                        if (!window.confirm('ATENÇÃO: Isso vai APAGAR TODOS os produtos. Deseja continuar?')) return;
                                        if (!window.confirm('Confirme novamente: apagar todos os produtos?')) return;
                                        setLoading(true);
                                        try {
                                            await productService.deleteAll();
                                            setProducts([]);
                                            try { localStorage.removeItem('pdv_products_cache'); } catch { }
                                            showNotification('success', 'Todos os produtos foram apagados');
                                        } catch (error) {
                                            console.error('Erro ao apagar todos os produtos:', error);
                                            showNotification('error', 'Falha ao apagar todos os produtos');
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    icon={<Trash2 size={20} />}
                                >
                                    Apagar Todos os Produtos
                                </Button>
                            </>
                        )}
                        {canWrite && (
                            <button
                                onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 20px', borderRadius: '10px', border: 'none', background: 'var(--gradient-primary)', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}
                            >
                                <Plus size={18} /> Novo Produto
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border)' }}>
                <button
                    onClick={() => setActiveTab('products')}
                    style={{
                        padding: 'var(--spacing-md) var(--spacing-lg)',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'products' ? '2px solid var(--color-primary)' : '2px solid transparent',
                        marginBottom: '-2px',
                        color: activeTab === 'products' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        fontWeight: activeTab === 'products' ? 600 : 500,
                        fontSize: 'var(--font-size-md)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                        transition: 'all var(--transition-fast)'
                    }}
                >
                    <Package size={18} />
                    Produtos
                </button>
                <button
                    onClick={() => setActiveTab('categories')}
                    style={{
                        padding: 'var(--spacing-md) var(--spacing-lg)',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'categories' ? '2px solid var(--color-primary)' : '2px solid transparent',
                        marginBottom: '-2px',
                        color: activeTab === 'categories' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        fontWeight: activeTab === 'categories' ? 600 : 500,
                        fontSize: 'var(--font-size-md)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                        transition: 'all var(--transition-fast)'
                    }}
                >
                    <Tag size={18} />
                    Categorias
                </button>
            </div>

            {activeTab === 'categories' ? (
                <CategoriesPage />
            ) : (
                <>
                    <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '14px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                            <div style={{ maxWidth: '400px' }}>
                                <Input
                                    placeholder="Buscar por nome ou código de barras..."
                                    icon={Search}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div style={{ marginTop: 'var(--spacing-sm)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {!loadedAll && (
                                    <>
                                        <Button variant="secondary" onClick={handleIncreaseLimit}>
                                            Carregar +{200}
                                        </Button>
                                        <Button variant="secondary" onClick={handleLoadMore}>
                                            Carregar tudo
                                        </Button>
                                    </>
                                )}
                                <Button variant="ghost" onClick={loadData}>
                                    Atualizar
                                </Button>
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        {['Produto', 'Categoria', 'Preço (Atacado)', 'Preço (Mercearia)', 'Preço (Varejo)', 'Estoque', 'Est. Mercearia', 'Est. Varejo', 'Status', 'Ações'].map((h, i) => (
                                            <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i === 9 ? 'right' : 'left' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan="10" style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                                <Package size={40} style={{ opacity: 0.15, display: 'block', margin: '0 auto 10px' }} />
                                                Nenhum produto encontrado
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredProducts.map((product) => (
                                            <tr key={product.id} style={{ borderBottom: '1px solid var(--color-divider)', transition: 'background 0.1s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                                onMouseLeave={e => e.currentTarget.style.background = ''}>
                                                <td style={{ padding: '13px 16px' }}>
                                                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{product.name}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{product.barcode || 'Sem código'}</div>
                                                </td>
                                                <td style={{ padding: '13px 16px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                                                    {categories[product.categoryId] || '—'}
                                                </td>
                                                <td style={{ padding: '13px 16px', fontWeight: 600, color: 'var(--color-success)', fontSize: '13px' }}>
                                                    {product.wholesalePrice === null ? '—' : formatCurrency((product.wholesalePrice ?? product.price) || 0)}
                                                </td>
                                                <td style={{ padding: '13px 16px', fontWeight: 600, color: 'var(--color-info)', fontSize: '13px' }}>
                                                    {product.coldPrice === null ? '—' : formatCurrency((product.coldPrice ?? product.price) || 0)}
                                                </td>
                                                <td style={{ padding: '13px 16px', fontWeight: 600, color: 'var(--color-warning)', fontSize: '13px' }}>
                                                    {product.retailPrice == null ? '—' : formatCurrency(product.retailPrice || 0)}
                                                </td>
                                                <td style={{ padding: '13px 16px' }}>
                                                    <span style={{
                                                        padding: '3px 10px',
                                                        borderRadius: '20px',
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        background: product.stock <= 5 ? 'rgba(239,68,68,0.1)' : '#6366f118',
                                                        color: product.stock <= 5 ? 'var(--color-danger)' : 'var(--color-text-secondary)'
                                                    }}>
                                                        {product.stock} {product.wholesaleUnit || product.unitOfMeasure || 'UN'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '13px 16px' }}>
                                                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: '#3b82f618', color: '#3b82f6' }}>
                                                        {product.coldStock || 0} {product.coldUnit || product.unitOfMeasure || 'UN'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '13px 16px' }}>
                                                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: '#f59e0b18', color: '#f59e0b' }}>
                                                        {product.retailStock || 0} {product.retailUnit || 'UN'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '13px 16px' }}>
                                                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: product.active ? 'rgba(16,185,129,0.1)' : 'var(--color-bg-hover)', color: product.active ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                                                        {product.active ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                                                        {canWrite && (
                                                            <button onClick={() => { setEditingProduct(product); setIsModalOpen(true); }} style={{ padding: '7px', background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', borderRadius: '8px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Editar"><Edit size={16} /></button>
                                                        )}
                                                        {canWrite && (
                                                            <button onClick={() => handleDelete(product.id)} style={{ padding: '7px', background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', borderRadius: '8px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Excluir"><Trash2 size={16} /></button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <ProductModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onSave={handleSave}
                        product={editingProduct}
                    />

                    <Modal
                        isOpen={isPriceListOpen}
                        onClose={() => setIsPriceListOpen(false)}
                        title="Lista de Produtos (Atacado/Mercearia)"
                        size="xl"
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                {priceListFilteredProducts.length} produto(s)
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <Button
                                    variant="secondary"
                                    icon={<Printer size={18} />}
                                    onClick={() => printProductsPriceList({ products: priceListFilteredProducts, search: priceListSearch }, settings)}
                                >
                                    Imprimir
                                </Button>
                                <Button variant="ghost" onClick={() => setIsPriceListOpen(false)}>
                                    Fechar
                                </Button>
                            </div>
                        </div>

                        <div style={{ maxWidth: '420px', marginBottom: 'var(--spacing-md)' }}>
                            <Input
                                placeholder="Buscar na lista por nome ou código..."
                                icon={Search}
                                value={priceListSearch}
                                onChange={(e) => setPriceListSearch(e.target.value)}
                            />
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                        <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Produto</th>
                                        <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Atacado (Venda)</th>
                                        <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Atacado (Custo)</th>
                                        <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Mercearia (Venda)</th>
                                        <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Mercearia (Custo)</th>
                                        <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Varejo (Venda)</th>
                                        <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Varejo (Custo)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {priceListFilteredProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                                Nenhum produto encontrado
                                            </td>
                                        </tr>
                                    ) : (
                                        priceListFilteredProducts.map((product) => (
                                            <tr key={`price-list-${product.id}`} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                                                <td style={{ padding: 'var(--spacing-md)' }}>
                                                    <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{product.name}</div>
                                                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{product.barcode || 'Sem código'}</div>
                                                </td>
                                                <td style={{ padding: 'var(--spacing-md)', fontWeight: 600, color: 'var(--color-success)' }}>
                                                    {product.wholesalePrice === null ? '-' : formatCurrency((product.wholesalePrice ?? product.price) || 0)}
                                                </td>
                                                <td style={{ padding: 'var(--spacing-md)', fontWeight: 600, color: 'var(--color-warning)' }}>
                                                    {formatCurrency(product.cost || 0)}
                                                </td>
                                                <td style={{ padding: 'var(--spacing-md)', fontWeight: 600, color: 'var(--color-primary)' }}>
                                                    {product.coldPrice === null ? '-' : formatCurrency((product.coldPrice ?? product.price) || 0)}
                                                </td>
                                                <td style={{ padding: 'var(--spacing-md)', fontWeight: 600, color: 'var(--color-warning)' }}>
                                                    {formatCurrency(product.coldCost || product.cost || 0)}
                                                </td>
                                                <td style={{ padding: 'var(--spacing-md)', fontWeight: 600, color: 'var(--color-warning)' }}>
                                                    {product.retailPrice == null ? '-' : formatCurrency(product.retailPrice || 0)}
                                                </td>
                                                <td style={{ padding: 'var(--spacing-md)', fontWeight: 600, color: 'var(--color-warning)' }}>
                                                    {formatCurrency(product.retailCost || 0)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Modal>
                </>
            )}
        </div >
    );
};

export default ProductsPage;
