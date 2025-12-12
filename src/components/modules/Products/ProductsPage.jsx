import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package, AlertCircle, Upload, FileText, MoreVertical } from 'lucide-react';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import Loading from '../../common/Loading';
import Notification from '../../common/Notification';
import ProductModal from './ProductModal';
import ImportProductsModal from './ImportProductsModal';
import { productService, categoryService, firestoreService, COLLECTIONS } from '../../../services/firestore';
import { formatCurrency } from '../../../utils/formatters';

const ProductsPage = () => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [rawSearch, setRawSearch] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 50;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [notification, setNotification] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);

    useEffect(() => {
        let unsubProducts = null;
        let unsubCategories = null;
        setLoading(true);
        try {
            unsubProducts = firestoreService.subscribe(
                COLLECTIONS.PRODUCTS,
                (list) => {
                    setProducts(list);
                    setLoading(false);
                },
                [],
                'name',
                'asc'
            );
            unsubCategories = firestoreService.subscribe(
                COLLECTIONS.CATEGORIES,
                (cats) => {
                    const map = {};
                    (cats || []).forEach(c => { map[c.id] = c.name; });
                    setCategories(map);
                },
                [],
                'name',
                'asc'
            );
        } catch (error) {
            console.error('Error subscribing products/categories:', error);
            showNotification('error', 'Erro ao assinar produtos e categorias');
            setLoading(false);
        }
        return () => {
            try { unsubProducts && unsubProducts(); } catch {}
            try { unsubCategories && unsubCategories(); } catch {}
        };
    }, []);

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleSearch = async (term) => {
        setRawSearch(term);
    };

    useEffect(() => {
        const h = setTimeout(() => setSearchTerm(rawSearch), 200);
        return () => clearTimeout(h);
    }, [rawSearch]);

    const handleSave = async (productData) => {
        try {
            if (editingProduct) {
                await productService.update(editingProduct.id, productData);
                showNotification('success', 'Produto atualizado com sucesso');
            } else {
                await productService.create(productData);
                showNotification('success', 'Produto criado com sucesso');
            }
            // Atualiza automaticamente via assinatura
            
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
            // Atualiza automaticamente via assinatura
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
        // Atualiza automaticamente via assinatura
    };

    const filteredProducts = React.useMemo(() => {
        const term = (searchTerm || '').toLowerCase();
        const list = products.filter(p =>
            (p.name || '').toLowerCase().includes(term) ||
            (p.barcode && String(p.barcode).includes(searchTerm))
        );
        return list; // já ordenado pela assinatura por 'name'
    }, [products, searchTerm]);

    useEffect(() => {
        setPage(1);
    }, [searchTerm, products]);

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
    const pageStart = (page - 1) * pageSize;
    const pageEnd = Math.min(page * pageSize, filteredProducts.length);
    const pagedProducts = React.useMemo(() => {
        return filteredProducts.slice(pageStart, pageEnd);
    }, [filteredProducts, pageStart, pageEnd]);

    if (loading && !products.length) return <Loading fullScreen />;

    const exportProductsCSV = () => {
        if (!products || products.length === 0) {
            showNotification('warning', 'Nenhum produto para exportar');
            return;
        }

        const header = [
            'nome',
            'codigo',
            'preco',
            'custo',
            'custo_mercearia',
            'estoque',
            'categoria',
            'preco_mercearia',
            'preco_atacado',
            'estoque_mercearia',
            'unidade'
        ].join(';');

        const fmt = (n) => {
            const num = Number(n || 0);
            return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
        };

        const rows = products.map(p => [
            (p.name || '').replace(/;/g, ','),
            (p.barcode || ''),
            fmt(p.price),
            fmt(p.cost),
            fmt(p.coldCost ?? p.cost),
            String(p.stock ?? 0),
            (categories[p.categoryId] || 'Geral').replace(/;/g, ','),
            fmt(p.coldPrice ?? p.price),
            fmt(p.wholesalePrice ?? p.price),
            String(p.coldStock ?? 0),
            (p.retailUnit || p.unitOfMeasure || 'UN').toString().replace(/;/g, ',')
        ].join(';'));

        const csv = ['\uFEFF' + header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'produtos.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification('success', 'Lista de produtos exportada');
    };

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
                                // Ordena por nome (asc) e gera códigos sequenciais 1..N (atacado)
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
                        onClick={() => setIsImportModalOpen(true)}
                        icon={<Upload size={20} />}
                    >
                        Importar CSV
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={exportProductsCSV}
                        icon={<FileText size={20} />}
                    >
                        Exportar CSV
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
                            value={rawSearch}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
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
                                    <td colSpan="8" style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                            <Package size={48} style={{ opacity: 0.2 }} />
                                            <p>Nenhum produto encontrado</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pagedProducts.map((product) => (
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
                                        <td style={{ padding: 'var(--spacing-md)', fontWeight: 500, color: '#3b82f6' }}>
                                            {formatCurrency(product.coldPrice || product.price)}
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
                                                background: (product.coldStock || 0) <= 5 ? 'rgba(59, 130, 246, 0.12)' : 'var(--color-bg-secondary)',
                                                color: (product.coldStock || 0) <= 5 ? '#3b82f6' : 'var(--color-text-secondary)'
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
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', position: 'relative' }}>
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
                                                    onClick={() => setOpenMenuId(openMenuId === product.id ? null : product.id)}
                                                    style={{
                                                        padding: '8px',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: 'var(--color-text-secondary)',
                                                        cursor: 'pointer',
                                                        borderRadius: 'var(--radius-md)',
                                                        transition: 'background var(--transition-fast)'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                    title="Mais"
                                                >
                                                    <MoreVertical size={18} />
                                                </button>
                                                {openMenuId === product.id && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        right: 0,
                                                        top: '36px',
                                                        background: 'var(--color-bg-secondary)',
                                                        border: '1px solid var(--color-border)',
                                                        borderRadius: 'var(--radius-md)',
                                                        boxShadow: 'var(--shadow-md)',
                                                        minWidth: '160px',
                                                        zIndex: 10
                                                    }}>
                                                        <button
                                                            onClick={() => { setOpenMenuId(null); handleDelete(product.id); }}
                                                            style={{
                                                                width: '100%',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                padding: '8px 12px',
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: 'var(--color-danger)',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <Trash2 size={16} />
                                                            Excluir
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    {filteredProducts.length > 0 && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: 'var(--spacing-md)',
                            borderTop: '1px solid var(--color-border)'
                        }}>
                            <div style={{ color: 'var(--color-text-secondary)' }}>
                                Mostrando {pageStart + 1}–{pageEnd} de {filteredProducts.length}
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                <Button
                                    variant="secondary"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                >
                                    Próxima
                                </Button>
                            </div>
                        </div>
                    )}
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
