import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Search, RotateCw, Plus, MoreHorizontal, X, LayoutGrid, List } from 'lucide-react';
import { Product, ProductCategory } from '@/types';
import { useStore } from '@/contexts/StoreContext';
import { fmt } from '@/lib/utils';

interface ConsumerProductFinderModalProps {
  open: boolean;
  onClose: () => void;
  onAddDirect: (product: Product) => void;
  onPersonalize: (product: Product) => void;
}

const CATEGORY_COLORS = [
  '#00838F', // Teal
  '#37474F', // Slate Blue/Gray
  '#00695C', // Teal Green
  '#2E7D32', // Emerald Green
  '#558B2F', // Light Green
  '#F57F17', // Amber
  '#E65100', // Orange Red
  '#EF6C00', // Orange
  '#C62828', // Red
  '#AD1457', // Pink/Magenta
  '#4527A0', // Purple
  '#283593', // Indigo
];

export function ConsumerProductFinderModal({
  open,
  onClose,
  onAddDirect,
  onPersonalize,
}: ConsumerProductFinderModalProps) {
  const { products, categories, getCategoryById } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [groupByCat, setGroupByCat] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setSelectedCatId('all');
      setSelectedRowIndex(0);
    }
  }, [open]);

  const filteredProducts = useMemo(() => {
    let list = selectedCatId === 'all' ? products : products.filter(p => p.categoryId === selectedCatId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    }
    return list;
  }, [products, selectedCatId, searchQuery]);

  useEffect(() => {
    setSelectedRowIndex(0);
  }, [selectedCatId, searchQuery]);

  // Keyboard navigation for F11 and Enter
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        const prod = filteredProducts[selectedRowIndex];
        if (prod) onAddDirect(prod);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const prod = filteredProducts[selectedRowIndex];
        if (prod) onPersonalize(prod);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedRowIndex(i => Math.min(filteredProducts.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedRowIndex(i => Math.max(0, i - 1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredProducts, selectedRowIndex, onAddDirect, onPersonalize, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs font-sans">
      <div className="bg-[#252526] text-white w-full max-w-5xl rounded-md shadow-2xl overflow-hidden border border-[#3c3c3c] flex flex-col h-[90vh] max-h-[750px] animate-in zoom-in-95 duration-150">
        
        {/* Window Header */}
        <div className="bg-[#1e1e1e] px-4 py-2 flex justify-between items-center border-b border-[#333333] shrink-0">
          <span className="text-sm font-semibold text-gray-200">Localizar Produto</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#333333] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Top Control Bar */}
        <div className="bg-[#2b2b2b] p-3 border-b border-[#383838] flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-[#1e1e1e] border-[#444444] text-white placeholder:text-gray-400 focus-visible:ring-blue-500"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#1e1e1e] border border-[#444444] rounded p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded text-xs ${viewMode === 'table' ? 'bg-[#383838] text-white' : 'text-gray-400 hover:text-white'}`}
                title="Visualização em Lista"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded text-xs ${viewMode === 'grid' ? 'bg-[#383838] text-white' : 'text-gray-400 hover:text-white'}`}
                title="Visualização em Grade"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {}}
              className="h-9 px-3 text-xs bg-[#1e1e1e] border-[#444444] text-gray-200 hover:bg-[#333333] hover:text-white gap-1.5 font-medium"
            >
              <RotateCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
          </div>
        </div>

        {/* Main Section (Split Categories Sidebar vs Product Catalog Table) */}
        <div className="flex-1 flex overflow-hidden bg-[#1e1e1e]">
          
          {/* Left Categories Vertical Bar */}
          <div className="w-48 bg-[#252526] border-r border-[#333333] p-2 flex flex-col gap-1.5 overflow-y-auto shrink-0">
            <button
              onClick={() => setSelectedCatId('all')}
              className={`w-full py-2.5 px-3 rounded font-bold text-xs text-left transition-all ${
                selectedCatId === 'all'
                  ? 'bg-white text-black shadow-md border-l-4 border-blue-600'
                  : 'bg-[#333333] text-gray-200 hover:bg-[#444444]'
              }`}
            >
              Todas
            </button>

            {categories.map((cat, idx) => {
              const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
              const isSelected = selectedCatId === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  style={{ backgroundColor: isSelected ? color : color }}
                  className={`w-full py-2.5 px-3 rounded font-bold text-xs text-left text-white transition-all drop-shadow-sm ${
                    isSelected ? 'ring-2 ring-white scale-[1.02] brightness-110' : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Right Product Catalog */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#181818]">
            {viewMode === 'table' ? (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-[#252526] text-gray-300 border-b border-[#383838] shadow-sm z-10">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">Categoria</th>
                      <th className="py-2.5 px-2 font-bold w-16 text-center">Cód.</th>
                      <th className="py-2.5 px-3 font-bold">Nome do Produto</th>
                      <th className="py-2.5 px-3 font-bold text-right">Preço de Venda</th>
                      <th className="py-2.5 px-3 font-bold text-center w-28">Adicionar (F11)</th>
                      <th className="py-2.5 px-3 font-bold text-center w-32">Personalizar (Enter)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a2a] text-gray-200">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-gray-500 italic">
                          Nenhum produto encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((prod, idx) => {
                        const cat = getCategoryById(prod.categoryId);
                        const isSelectedRow = idx === selectedRowIndex;
                        return (
                          <tr
                            key={prod.id}
                            onClick={() => setSelectedRowIndex(idx)}
                            onDoubleClick={() => onPersonalize(prod)}
                            className={`cursor-pointer transition-colors ${
                              isSelectedRow
                                ? 'bg-[#0284c7] text-white font-medium'
                                : idx % 2 === 0
                                ? 'bg-[#202020] hover:bg-[#2a2a2a]'
                                : 'bg-[#1a1a1a] hover:bg-[#2a2a2a]'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-medium">{cat?.name || '-'}</td>
                            <td className="py-2.5 px-2 text-center text-gray-400 font-mono text-[11px]">
                              {prod.id.slice(0, 4)}
                            </td>
                            <td className="py-2.5 px-3 font-semibold">{prod.name}</td>
                            <td className="py-2.5 px-3 text-right font-bold">
                              R$ {fmt(prod.price)}
                            </td>

                            {/* Adicionar (F11) Button */}
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddDirect(prod);
                                }}
                                className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-sm transition-transform active:scale-95"
                                title="Adicionar diretamente ao pedido (F11)"
                              >
                                <Plus className="h-4 w-4 stroke-[3]" />
                              </button>
                            </td>

                            {/* Personalizar (Enter) Button */}
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPersonalize(prod);
                                }}
                                className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-sm transition-transform active:scale-95"
                                title="Personalizar complementos e observações (Enter)"
                              >
                                <MoreHorizontal className="h-4 w-4 stroke-[3]" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid View */
              <div className="flex-1 overflow-auto p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredProducts.map((prod, idx) => {
                  const cat = getCategoryById(prod.categoryId);
                  return (
                    <div
                      key={prod.id}
                      onClick={() => onPersonalize(prod)}
                      className="bg-[#252526] hover:bg-[#333333] border border-[#383838] p-3 rounded flex flex-col justify-between cursor-pointer transition-all active:scale-95"
                    >
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                          {cat?.name || 'Geral'}
                        </span>
                        <h4 className="font-bold text-sm text-white mt-1 line-clamp-2">{prod.name}</h4>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="font-extrabold text-sm text-green-400">R$ {fmt(prod.price)}</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddDirect(prod);
                            }}
                            className="p-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPersonalize(prod);
                            }}
                            className="p-1.5 rounded-full bg-gray-700 text-white hover:bg-gray-600"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Bar */}
        <div className="bg-[#1e1e1e] px-4 py-2.5 border-t border-[#333333] flex justify-between items-center text-xs text-gray-400 shrink-0">
          <div className="flex items-center gap-2">
            <Switch
              checked={groupByCat}
              onCheckedChange={setGroupByCat}
              className="data-[state=checked]:bg-blue-600"
            />
            <span className="font-medium text-gray-300">Agrupar Categoria</span>
          </div>

          <span className="font-semibold text-gray-300">
            {filteredProducts.length} Produtos encontrados.
          </span>
        </div>
      </div>
    </div>
  );
}
