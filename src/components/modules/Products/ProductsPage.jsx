import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package, AlertCircle, Upload } from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Loading from '../../common/Loading';
import Notification from '../../common/Notification';
import ProductModal from './ProductModal';
import ImportProductsModal from './ImportProductsModal';
import { productService, categoryService } from '../../../services/firestore';
import { formatCurrency } from '../../../utils/formatters';

const ProductsPage = () => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [notification, setNotification] = useState(null);

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
        } catch {}
        loadData();
    }, []);

    const [limit, setLimit] = useState(200);
    const [loadedAll, setLoadedAll] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const [productsData, categoriesData] = await Promise.all([
                loadedAll ? productService.getAll() : productService.getAllLimited(limit),
                categoryService.getAll()
            ]);

            setProducts(productsData);
            try { localStorage.setItem('pdv_products_cache', JSON.stringify(productsData)); } catch {}

            // Create categories map for easy lookup
            const catMap = {};
            categoriesData.forEach(cat => {
                catMap[cat.id] = cat.name;
            });
            setCategories(catMap);
            try { localStorage.setItem('pdv_categories_cache', JSON.stringify(catMap)); } catch {}
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
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--spacing-md)'
            }}>
                <div>
                    <h1 style={{
                        fontSize: 'var(--font-size-2xl)',
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        marginBottom: 'var(--spacing-xs)'
                    }}>Produtos</h1>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Gerencie seu catálogo de produtos</p>
                </div>
                <div className="flex gap-3">
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
                                try { localStorage.removeItem('pdv_products_cache'); } catch {}
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
                    <Button
                        variant="secondary"
                        onClick={() => setIsImportModalOpen(true)}
                        icon={<Upload size={20} />}
                    >
                        Importar CSV
                    </Button>
                    <Button
                        onClick={() => {
                            setEditingProduct(null);
                            setIsModalOpen(true);
                        }}
                        icon={<Plus size={20} />}
                    >
                        Novo Produto
                    </Button>
                </div>
            </div>

            <Card>
                <div style={{ padding: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border)' }}>
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
                            <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Produto</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Categoria</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Preço (Atacado)</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Preço (Mercearia)</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Estoque</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Est. Mercearia</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>Status</th>
                                <th style={{ padding: 'var(--spacing-md)', fontWeight: 600, textAlign: 'right' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                            <Package size={48} style={{ opacity: 0.2 }} />
                                            <p>Nenhum produto encontrado</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr key={product.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                                        <td style={{ padding: 'var(--spacing-md)' }}>
                                            <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{product.name}</div>
                                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{product.barcode || 'Sem código'}</div>
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>
                                            {categories[product.categoryId] || '-'}
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)', fontWeight: 500, color: 'var(--color-success)' }}>
                                            {formatCurrency(product.wholesalePrice || product.price)}
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)', fontWeight: 500, color: 'var(--color-info)' }}>
                                            {formatCurrency(product.coldPrice || 0)}
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: 'var(--font-size-xs)',
                                                fontWeight: 500,
                                                background: product.stock <= 5 ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-bg-secondary)',
                                                color: product.stock <= 5 ? 'var(--color-danger)' : 'var(--color-text-secondary)'
                                            }}>
                                                {product.stock} {product.retailUnit || product.unitOfMeasure || 'UN'}
                                            </span>
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: 'var(--font-size-xs)',
                                                fontWeight: 500,
                                                background: 'var(--color-bg-secondary)',
                                                color: 'var(--color-info)'
                                            }}>
                                                {product.coldStock || 0} {product.coldUnit || product.unitOfMeasure || 'UN'}
                                            </span>
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                                                <span style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: product.active ? 'var(--color-success)' : 'var(--color-text-muted)'
                                                }} />
                                                <span style={{ color: 'var(--color-text-secondary)' }}>
                                                    {product.active ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: 'var(--spacing-md)', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
                                                <button
                                                    onClick={() => {
                                                        setEditingProduct(product);
                                                        setIsModalOpen(true);
                                                    }}
                                                    style={{
                                                        padding: '8px',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: 'var(--color-primary)',
                                                        cursor: 'pointer',
                                                        borderRadius: 'var(--radius-md)',
                                                        transition: 'background var(--transition-fast)'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                    title="Editar"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product.id)}
                                                    style={{
                                                        padding: '8px',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: 'var(--color-danger)',
                                                        cursor: 'pointer',
                                                        borderRadius: 'var(--radius-md)',
                                                        transition: 'background var(--transition-fast)'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <ProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                product={editingProduct}
            />

            <ImportProductsModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImportSuccess={handleImportSuccess}
            />
        </div>
    );
};

export default ProductsPage;
