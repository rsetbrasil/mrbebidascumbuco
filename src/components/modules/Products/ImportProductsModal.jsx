import React, { useState, useRef } from 'react';
import { Upload, X, Check, AlertTriangle, FileText, Loader } from 'lucide-react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import { productService, categoryService } from '../../../services/firestore';
import { parseCurrency } from '../../../utils/formatters';

const ImportProductsModal = ({ isOpen, onClose, onImportSuccess }) => {
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
                setError('Por favor, selecione um arquivo CSV válido.');
                return;
            }
            setFile(selectedFile);
            setError(null);
            parseCSV(selectedFile);
        }
    };

    const parseCSV = (file, encoding = 'UTF-8') => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;

            // Check for encoding issues (replacement character)
            if (encoding === 'UTF-8' && text.includes('\uFFFD')) {
                console.log('Detected encoding issues, retrying with ISO-8859-1');
                parseCSV(file, 'ISO-8859-1');
                return;
            }

            const lines = text.split('\n').filter(line => line.trim());
            if (lines.length === 0) return;

            // Detect separator
            const firstLine = lines[0];
            const commaCount = (firstLine.match(/,/g) || []).length;
            const semiCount = (firstLine.match(/;/g) || []).length;
            const separator = semiCount > commaCount ? ';' : ',';

            const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ''));

            const data = [];
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;

                const row = parseCSVLine(lines[i], separator);

                if (row.length === headers.length) {
                    const item = {};
                    headers.forEach((header, index) => {
                        item[header] = row[index]?.trim();
                    });
                    data.push(item);
                }
            }
            setPreviewData(data);
        };
        reader.readAsText(file, encoding);
    };

    // CSV line parser that handles quotes and custom separator
    const parseCSVLine = (text, separator) => {
        const result = [];
        let cell = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === separator && !inQuotes) {
                result.push(cell.replace(/^"|"$/g, '').trim()); // Remove surrounding quotes
                cell = '';
            } else {
                cell += char;
            }
        }
        result.push(cell.replace(/^"|"$/g, '').trim());
        return result;
    };

    const parseNumber = (value) => {
        if (!value) return 0;
        // Remove currency symbols and whitespace
        let clean = value.toString().replace(/[R$\s]/g, '');

        // Handle Brazilian format (1.234,56) -> 1234.56
        if (clean.includes(',') && clean.includes('.')) {
            // Check which is the decimal separator (usually the last one)
            const lastDot = clean.lastIndexOf('.');
            const lastComma = clean.lastIndexOf(',');

            if (lastComma > lastDot) {
                // Comma is decimal separator (1.234,56)
                clean = clean.replace(/\./g, '').replace(',', '.');
            } else {
                // Dot is decimal separator (1,234.56)
                clean = clean.replace(/,/g, '');
            }
        } else if (clean.includes(',')) {
            // Only comma, assume decimal (1234,56)
            clean = clean.replace(',', '.');
        }

        return parseFloat(clean) || 0;
    };

    const handleImport = async () => {
        if (previewData.length === 0) return;

        setImporting(true);
        let successCount = 0;
        let errorCount = 0;

        try {
            // Get existing categories to map or create
            const categories = await categoryService.getAll();
            const categoryMap = {};
            categories.forEach(c => categoryMap[c.name.toLowerCase()] = c.id);

            // Default category if none found
            let defaultCategoryId = categories.find(c => c.name === 'Geral')?.id;
            if (!defaultCategoryId && categories.length > 0) {
                defaultCategoryId = categories[0].id;
            }

            for (const item of previewData) {
                try {
                    // Map fields based on expected CSV headers or common variations
                    const name = item.nome || item.name || item.produto || item.description;
                    const barcode = item.codigo || item.barcode || item.ean || item.sku || '';

                    // Parse numbers with improved logic
                    const price = parseNumber(item.preco || item.price || item.valor || item.venda);
                    const cost = parseNumber(item.custo || item.cost || item.compra);
                    const stock = parseInt(item.estoque || item.stock || item.quantidade || '0');

                    const categoryName = item.categoria || item.category || 'Geral';

                    if (!name) continue; // Skip if no name

                    // Resolve category
                    let categoryId = defaultCategoryId;
                    if (categoryName) {
                        const normalizedCat = categoryName.toLowerCase();
                        if (categoryMap[normalizedCat]) {
                            categoryId = categoryMap[normalizedCat];
                        } else {
                            const newCat = await categoryService.create({
                                name: categoryName,
                                description: 'Importada automaticamente'
                            });
                            categoryId = newCat.id;
                            categoryMap[normalizedCat] = newCat.id;
                            if (!defaultCategoryId) defaultCategoryId = newCat.id;
                        }
                    }

                    const product = {
                        name,
                        barcode,
                        price,
                        cost,
                        stock,
                        categoryId: categoryId || '1', // Fallback
                        active: true
                    };

                    await productService.create(product);
                    successCount++;
                } catch (err) {
                    console.error('Error importing item:', item, err);
                    errorCount++;
                }
            }

            onImportSuccess(successCount, errorCount);
            handleClose();
        } catch (err) {
            console.error('Import failed:', err);
            setError('Falha ao processar importação.');
        } finally {
            setImporting(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setPreviewData([]);
        setError(null);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Importar Produtos (CSV)"
            footer={
                <>
                    <Button variant="secondary" onClick={handleClose} disabled={importing}>
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleImport}
                        disabled={!file || previewData.length === 0 || importing}
                    >
                        {importing ? 'Importando...' : `Importar ${previewData.length} Produtos`}
                    </Button>
                </>
            }
        >
            <div className="space-y-6">
                {!file ? (
                    <div
                        className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-white mb-2">Clique para selecionar o arquivo CSV</h3>
                        <p className="text-gray-400 text-sm">
                            O arquivo deve conter cabeçalhos: nome, codigo, preco, custo, estoque, categoria
                        </p>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".csv"
                            className="hidden"
                        />
                    </div>
                ) : (
                    <div>
                        <div className="flex items-center justify-between bg-slate-800 p-4 rounded-lg mb-4">
                            <div className="flex items-center gap-3">
                                <FileText className="text-primary-400" />
                                <div>
                                    <p className="font-medium text-white">{file.name}</p>
                                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(2)} KB</p>
                                </div>
                            </div>
                            <button onClick={() => setFile(null)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 text-red-400 p-4 rounded-lg mb-4 flex items-center gap-2">
                                <AlertTriangle size={20} />
                                {error}
                            </div>
                        )}

                        <div className="max-h-60 overflow-y-auto border border-slate-700 rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-800 text-gray-400 sticky top-0">
                                    <tr>
                                        <th className="p-2">Nome</th>
                                        <th className="p-2">Código</th>
                                        <th className="p-2">Preço</th>
                                        <th className="p-2">Estoque</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {previewData.slice(0, 50).map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-800/50">
                                            <td className="p-2 text-white">{item.nome || item.name}</td>
                                            <td className="p-2 text-gray-400">{item.codigo || item.barcode}</td>
                                            <td className="p-2 text-gray-400">{item.preco || item.price}</td>
                                            <td className="p-2 text-gray-400">{item.estoque || item.stock}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {previewData.length > 50 && (
                                <div className="p-2 text-center text-xs text-gray-500 bg-slate-800">
                                    E mais {previewData.length - 50} itens...
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ImportProductsModal;
