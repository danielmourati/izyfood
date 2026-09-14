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

  // Keyboard navigation for F11, Enter, and Escape
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
    <div className="fixed inset-0 z-[90] bg-black/20 flex items-center justify-end p-2 sm:p-4 pointer-events-none font-sans">
      <div className="bg-card text-card-foreground w-full max-w-4xl rounded-md shadow-2xl overflow-hidden border border-border flex flex-col h-[90vh] max-h-[750px] animate-in zoom-in-95 duration-150 pointer-events-auto ml-[180px] sm:ml-[300px]">
        
        {/* Window Header */}
        <div className="bg-muted/70 px-4 py-2 flex justify-between items-center border-b border-border shrink-0">
          <span className="text-sm font-semibold text-foreground">Localizar Produto</span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Top Control Bar */}
        <div className="bg-muted/30 p-3 border-b border-border flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-background border border-input rounded p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded text-xs transition-colors ${viewMode === 'table' ? 'bg-muted text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                title="Visualização em Lista"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded text-xs transition-colors ${viewMode === 'grid' ? 'bg-muted text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'}`}
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
              className="h-9 px-3 text-xs bg-background border-input text-foreground hover:bg-muted gap-1.5 font-medium"
            >
              <RotateCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
          </div>
        </div>

        {/* Main Section (Split Categories Sidebar vs Product Catalog Table) */}
        <div className="flex-1 flex overflow-hidden bg-background">
          
          {/* Left Categories Vertical Bar */}
          <div className="w-48 bg-muted/20 border-r border-border p-2 flex flex-col gap-1.5 overflow-y-auto shrink-0">
            <button
              onClick={() => setSelectedCatId('all')}
              className={`w-full py-2.5 px-3 rounded font-bold text-xs text-left transition-all ${
                selectedCatId === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs border-l-4 border-primary'
                  : 'bg-muted/50 text-foreground hover:bg-muted'
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
                  style={{ backgroundColor: color }}
                  className={`w-full py-2.5 px-3 rounded font-bold text-xs text-left text-white transition-all drop-shadow-xs ${
                    isSelected ? 'ring-2 ring-foreground scale-[1.02] brightness-110' : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Right Product Catalog */}
          <div className="flex-1 flex flex-col overflow-hidden bg-background">
            {viewMode === 'table' ? (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-muted/60 text-foreground border-b border-border shadow-xs z-10">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">Categoria</th>
                      <th className="py-2.5 px-2 font-bold w-16 text-center">Cód.</th>
                      <th className="py-2.5 px-3 font-bold">Nome do Produto</th>
                      <th className="py-2.5 px-3 font-bold text-right">Preço de Venda</th>
                      <th className="py-2.5 px-3 font-bold text-center w-28">Adicionar (F11)</th>
                      <th className="py-2.5 px-3 font-bold text-center w-32">Personalizar (Enter)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-foreground">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-muted-foreground italic">
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
                                ? 'bg-primary text-primary-foreground font-medium'
                                : idx % 2 === 0
                                ? 'bg-card hover:bg-muted/40'
                                : 'bg-muted/10 hover:bg-muted/40'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-medium">{cat?.name || '-'}</td>
                            <td className="py-2.5 px-2 text-center opacity-70 font-mono text-[11px]">
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
                                className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-transform active:scale-95"
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
                                className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-transform active:scale-95"
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
                      className="bg-card hover:bg-muted/40 border border-border p-3 rounded flex flex-col justify-between cursor-pointer transition-all active:scale-95 shadow-xs"
                    >
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          {cat?.name || 'Geral'}
                        </span>
                        <h4 className="font-bold text-sm text-foreground mt-1 line-clamp-2">{prod.name}</h4>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">R$ {fmt(prod.price)}</span>
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
                            className="p-1.5 rounded-full bg-muted text-foreground hover:bg-muted/80"
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
        <div className="bg-muted/50 px-4 py-2.5 border-t border-border flex justify-between items-center text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-2">
            <Switch
              checked={groupByCat}
              onCheckedChange={setGroupByCat}
              className="data-[state=checked]:bg-primary"
            />
            <span className="font-medium text-foreground">Agrupar Categoria</span>
          </div>

          <span className="font-semibold text-foreground">
            {filteredProducts.length} Produtos encontrados.
          </span>
        </div>
      </div>
    </div>
  );
}
