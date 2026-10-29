import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '@/contexts/StoreContext';
import { usePrinter } from '@/hooks/use-printer';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { fmt, formatBRLInput, parseBRLInput } from '@/lib/utils';
import { sectorLabel, buildSectorOptions, PRINT_SECTOR_OPTIONS } from '@/lib/print-sectors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Pencil, Trash2, Search, Copy, Tag, Layers, Building2,
  PackageOpen, X, Printer, Package, UtensilsCrossed, ExternalLink, SlidersHorizontal,
  FileText, Check, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import type { Product, ProductCategory, ProductNoteOption, ProductType, Supplier } from '@/types';

const emptyProductForm = {
  name: '',
  description: '',
  price: '',
  categoryId: '',
  type: 'unit' as ProductType,
  unit: 'un',
  stock: '',
  loyaltyEligible: false,
  controlStock: true,
  supplierId: '',
  searchCode: '',
  costPrice: '',
  minStock: '',
  serviceFeeExempt: false,
  printSector: '',
};

const emptyNoteOptionForm = {
  name: '',
  type: 'note' as 'note' | 'complement',
  price: '',
  categoryIds: [] as string[],
  active: true,
  classification: 'additional' as 'flavor' | 'additional',
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="rounded-lg border p-3.5 space-y-3.5 bg-card">
    <legend className="px-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</legend>
    {children}
  </fieldset>
);

const CheckOption = ({ checked, onChange, title, hint }: { checked: boolean; onChange: (v: boolean) => void; title: string; hint: string }) => (
  <label className="flex items-start gap-2.5 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
    />
    <span className="text-sm">
      <strong className="text-foreground">{title}</strong>{' '}
      <span className="text-muted-foreground">— {hint}</span>
    </span>
  </label>
);

const Produtos = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useTenantNavigate();
  const { products, setProducts, categories, noteOptions, setNoteOptions, suppliers, setSuppliers } = useStore();
  const { printers } = usePrinter();
  const sectorOptions = buildSectorOptions(printers);

  // Estados principais
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStockStatus, setFilterStockStatus] = useState<'all' | 'low' | 'regular' | 'untracked'>('all');

  // Sincronizar filtro com query params da URL (ex: /produtos?categoria=ID)
  useEffect(() => {
    const urlCat = searchParams.get('categoria');
    if (urlCat) {
      if (categories.some(c => c.id === urlCat)) {
        setFilterCategory(urlCat);
      }
    }
  }, [searchParams, categories]);

  // Modal de Produto
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dados' | 'impressao' | 'estoque' | 'adicionais'>('dados');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProductForm);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Exclusão de Produto
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  // Modal de Observações e Adicionais
  const [optsDialogOpen, setOptsDialogOpen] = useState(false);
  const [optFormOpen, setOptFormOpen] = useState(false);
  const [editingOptId, setEditingOptId] = useState<string | null>(null);
  const [optForm, setOptForm] = useState(emptyNoteOptionForm);

  // Modal Rápido de Fornecedor
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact: '' });
  const [supplierSaving, setSupplierSaving] = useState(false);

  // Foco automático no nome ao abrir o diálogo
  useEffect(() => {
    if (!dialogOpen) return;
    const t = setTimeout(() => nameInputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [dialogOpen]);

  const getCat = (id?: string) => categories.find(c => c.id === id);

  // Filtragem e busca de produtos
  const normalize = (s?: string | null) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const q = normalize(search.trim());

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch =
        !q ||
        normalize(p.name).includes(q) ||
        normalize(p.searchCode).includes(q) ||
        normalize(p.description).includes(q);

      const matchCat = filterCategory === 'all' || p.categoryId === filterCategory;

      let matchStock = true;
      if (filterStockStatus === 'low') {
        matchStock = p.controlStock && p.stock <= (p.minStock ?? 0);
      } else if (filterStockStatus === 'regular') {
        matchStock = p.controlStock && p.stock > (p.minStock ?? 0);
      } else if (filterStockStatus === 'untracked') {
        matchStock = !p.controlStock;
      }

      return matchSearch && matchCat && matchStock;
    });
  }, [products, q, filterCategory, filterStockStatus]);

  // Contadores por categoria
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
    }
    return counts;
  }, [products]);

  // Métricas gerais
  const totalProducts = products.length;
  const lowStockCount = products.filter(p => p.controlStock && p.stock <= (p.minStock ?? 0)).length;
  const untrackedStockCount = products.filter(p => !p.controlStock).length;

  // ---- CRUD de Produtos ----
  const openCreate = () => {
    setEditingId(null);
    setActiveTab('dados');
    setForm({
      ...emptyProductForm,
      categoryId: filterCategory !== 'all' ? filterCategory : categories[0]?.id || '',
    });
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setActiveTab('dados');
    setForm({
      name: p.name,
      description: p.description || '',
      price: formatBRLInput(p.price),
      categoryId: p.categoryId,
      type: p.type,
      unit: p.unit,
      stock: String(p.stock),
      loyaltyEligible: p.loyaltyEligible,
      controlStock: p.controlStock,
      supplierId: p.supplierId || '',
      searchCode: p.searchCode || '',
      costPrice: p.costPrice != null ? formatBRLInput(p.costPrice) : '',
      minStock: String(p.minStock ?? 0),
      serviceFeeExempt: p.serviceFeeExempt ?? false,
      printSector: p.printSector || '',
    });
    setDialogOpen(true);
  };

  const duplicateProduct = (p: Product) => {
    const newProduct: Product = {
      ...p,
      id: crypto.randomUUID(),
      name: `${p.name} (Cópia)`,
      searchCode: p.searchCode ? `${p.searchCode}-COP` : undefined,
    };
    setProducts(prev => [...prev, newProduct]);
    toast.success(`Cópia de "${p.name}" criada com sucesso!`, {
      action: {
        label: 'Editar',
        onClick: () => openEdit(newProduct),
      },
    });
  };

  const openDelete = (p: Product) => {
    setDeleteProduct(p);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteProduct) return;
    setProducts(prev => prev.filter(p => p.id !== deleteProduct.id));
    toast.success(`Produto "${deleteProduct.name}" excluído.`);
    setDeleteOpen(false);
    setDeleteProduct(null);
  };

  const saveProduct = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!form.name.trim()) {
      toast.error('Informe o nome do produto.');
      setActiveTab('dados');
      return;
    }
    if (!form.price || parseBRLInput(form.price) < 0) {
      toast.error('Informe um preço de venda válido.');
      setActiveTab('dados');
      return;
    }
    if (!form.categoryId) {
      toast.error('Selecione uma categoria para o produto.');
      setActiveTab('dados');
      return;
    }

    const product: Product = {
      id: editingId || crypto.randomUUID(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price: parseBRLInput(form.price),
      categoryId: form.categoryId,
      type: form.type,
      unit: form.type === 'weight' ? 'kg' : 'un',
      stock: parseFloat(form.stock) || 0,
      image: editingId ? products.find(p => p.id === editingId)?.image : undefined,
      loyaltyEligible: form.loyaltyEligible,
      controlStock: form.controlStock,
      supplierId: form.supplierId || undefined,
      searchCode: form.searchCode.trim() || undefined,
      costPrice: form.costPrice ? parseBRLInput(form.costPrice) : undefined,
      minStock: parseFloat(form.minStock) || 0,
      serviceFeeExempt: form.serviceFeeExempt,
      printSector: form.printSector || undefined,
    };

    if (editingId) {
      setProducts(prev => prev.map(p => (p.id === editingId ? product : p)));
      toast.success(`Produto "${product.name}" atualizado!`);
    } else {
      setProducts(prev => [...prev, product]);
      toast.success(`Produto "${product.name}" cadastrado com sucesso!`);
    }

    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyProductForm);
  };

  // ---- CRUD de NoteOptions (Adicionais & Observações) ----
  const openCreateOpt = (type: 'note' | 'complement' = 'note') => {
    setEditingOptId(null);
    setOptForm({
      ...emptyNoteOptionForm,
      type,
      categoryIds: categories.map(c => c.id),
    });
    setOptFormOpen(true);
  };

  const openEditOpt = (opt: ProductNoteOption) => {
    setEditingOptId(opt.id);
    setOptForm({
      name: opt.name,
      type: opt.type,
      price: opt.price > 0 ? formatBRLInput(opt.price) : '',
      categoryIds: opt.categoryIds || [],
      active: opt.active ?? true,
      classification: opt.classification || 'additional',
    });
    setOptFormOpen(true);
  };

  const saveOpt = () => {
    if (!optForm.name.trim()) {
      toast.error('Informe o nome da opção.');
      return;
    }
    const opt: ProductNoteOption = {
      id: editingOptId || crypto.randomUUID(),
      name: optForm.name.trim(),
      type: optForm.type,
      price: optForm.type === 'complement' && optForm.price ? parseBRLInput(optForm.price) : 0,
      categoryIds: optForm.categoryIds,
      active: optForm.active,
      classification: optForm.type === 'complement' ? optForm.classification : undefined,
    };
    if (editingOptId) {
      setNoteOptions(prev => prev.map(o => (o.id === editingOptId ? opt : o)));
      toast.success('Opção atualizada!');
    } else {
      setNoteOptions(prev => [...prev, opt]);
      toast.success('Opção cadastrada!');
    }
    setOptFormOpen(false);
  };

  const deleteOpt = (id: string) => {
    setNoteOptions(prev => prev.filter(o => o.id !== id));
    toast.success('Opção removida.');
  };

  // Complementos vinculados à categoria atual do formulário
  const currentCategoryNoteOptions = useMemo(() => {
    if (!form.categoryId) return [];
    return noteOptions.filter(o => o.categoryIds.includes(form.categoryId));
  }, [noteOptions, form.categoryId]);

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Produtos</h1>
              <p className="text-sm text-muted-foreground">
                Cardápio de itens, controle de preços, estoque e setores de produção.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/categorias')}
            className="gap-2"
            title="Ir para a página de gerenciamento de categorias"
          >
            <Layers className="h-4 w-4" />
            Categorias ({categories.length})
          </Button>
          <Button
            variant="outline"
            onClick={() => setOptsDialogOpen(true)}
            className="gap-2"
            title="Gerenciar adicionais e observações vinculadas"
          >
            <Tag className="h-4 w-4" />
            Observações & Adicionais
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Total no Cardápio</p>
          <p className="text-xl font-bold text-foreground mt-0.5">{totalProducts}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Estoque Regular</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {totalProducts - lowStockCount - untrackedStockCount}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Estoque Baixo</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{lowStockCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Não Controlados</p>
          <p className="text-xl font-bold text-muted-foreground mt-0.5">{untrackedStockCount}</p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Busca textual */}
          <div className="relative w-full sm:max-w-md shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por nome, código ou descrição..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-9 w-full"
            />
            {search && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtro de Estoque */}
          <div className="flex items-center gap-2">
            <Select
              value={filterStockStatus}
              onValueChange={(val: any) => setFilterStockStatus(val)}
            >
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs">
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 opacity-70" />
                <SelectValue placeholder="Situação de estoque" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                <SelectItem value="regular">Estoque regular</SelectItem>
                <SelectItem value="low">Estoque baixo</SelectItem>
                <SelectItem value="untracked">Não controlado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Abas de Categorias */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none min-w-0">
          <Button
            variant={filterCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setFilterCategory('all');
              setSearchParams({});
            }}
            className="rounded-full text-xs shrink-0 h-8 px-3"
          >
            Todos ({products.length})
          </Button>

          {categories.map(cat => {
            const count = categoryCounts[cat.id] || 0;
            const isSelected = filterCategory === cat.id;

            return (
              <Button
                key={cat.id}
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setFilterCategory(cat.id);
                  setSearchParams({ categoria: cat.id });
                }}
                className="rounded-full text-xs shrink-0 h-8 px-3 gap-1.5"
              >
                <span>{cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {count}
                </span>
              </Button>
            );
          })}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/categorias')}
            className="text-xs text-primary hover:text-primary gap-1 shrink-0 h-8"
          >
            <Plus className="h-3.5 w-3.5" />
            Gerenciar Categorias
          </Button>
        </div>
      </div>

      {/* Compact Product Table (Em conformidade com AGENTS.md) */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="w-28 px-4 py-3">Código</th>
                <th className="px-4 py-3">Produto</th>
                <th className="w-40 px-4 py-3">Categoria</th>
                <th className="w-32 px-4 py-3 text-right">Preço Venda</th>
                <th className="w-28 px-4 py-3 text-right">Estoque</th>
                <th className="w-32 px-4 py-3">Situação</th>
                <th className="w-44 px-4 py-3">Imprimir em</th>
                <th className="w-28 px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(product => {
                const cat = getCat(product.categoryId);
                const stockLow = product.controlStock && product.stock <= (product.minStock ?? 0);
                const printDestination =
                  product.printSector === 'none'
                    ? 'Não imprimir'
                    : sectorLabel(product.printSector || cat?.printSector || 'cozinha');

                return (
                  <tr key={product.id} className="transition-colors hover:bg-muted/30">
                    {/* Código de busca */}
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {product.searchCode || '—'}
                    </td>

                    {/* Nome e descrição */}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(product)}
                        className="text-left font-semibold text-foreground hover:text-primary transition-colors block"
                      >
                        {product.name}
                      </button>
                      {product.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1 max-w-sm">
                          {product.description}
                        </p>
                      )}
                    </td>

                    {/* Categoria */}
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="font-normal text-xs">
                        {cat?.name || 'Sem categoria'}
                      </Badge>
                    </td>

                    {/* Preço de venda */}
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-primary">
                      R$ {fmt(product.price)}
                      {product.type === 'weight' ? '/kg' : ''}
                    </td>

                    {/* Estoque */}
                    <td className="px-4 py-3 text-right tabular-nums text-sm">
                      {product.controlStock ? (
                        <span>
                          {product.stock}{' '}
                          <span className="text-xs text-muted-foreground">{product.unit}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Situação */}
                    <td className="px-4 py-3">
                      {!product.controlStock ? (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">
                          Livre
                        </Badge>
                      ) : stockLow ? (
                        <Badge variant="destructive" className="text-[10px] font-semibold">
                          Estoque baixo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold border-emerald-200 dark:border-emerald-900">
                          Regular
                        </Badge>
                      )}
                    </td>

                    {/* Setor de Impressão */}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5 truncate">
                        <Printer className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        <span className="truncate">{printDestination}</span>
                      </div>
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Duplicar produto"
                          aria-label={`Duplicar ${product.name}`}
                          onClick={() => duplicateProduct(product)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Editar produto"
                          aria-label={`Editar ${product.name}`}
                          onClick={() => openEdit(product)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Excluir produto"
                          aria-label={`Excluir ${product.name}`}
                          onClick={() => openDelete(product)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center text-muted-foreground">
            <PackageOpen className="h-8 w-8 opacity-40" />
            <p className="font-medium">
              {search.trim()
                ? `Nenhum produto encontrado para "${search.trim()}".`
                : 'Nenhum produto cadastrado nesta visualização.'}
            </p>
            {search.trim() ? (
              <Button variant="link" size="sm" onClick={() => setSearch('')}>
                Limpar busca
              </Button>
            ) : (
              <Button size="sm" onClick={openCreate} className="mt-2">
                <Plus className="h-4 w-4 mr-1" /> Cadastrar produto
              </Button>
            )}
          </div>
        )}

        <div className="border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            {filtered.length} {filtered.length === 1 ? 'produto exibido' : 'produtos exibidos'}
          </span>
          {filterCategory !== 'all' && (
            <button
              type="button"
              onClick={() => {
                setFilterCategory('all');
                setSearchParams({});
              }}
              className="text-primary hover:underline"
            >
              Ver todas as categorias
            </button>
          )}
        </div>
      </div>

      {/* Modal Estruturado de Criação/Edição de Produto (Dividido em Abas) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b">
            <DialogTitle className="text-lg">
              {editingId ? form.name || 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={saveProduct} className="flex-1 flex flex-col min-h-0">
            <Tabs
              value={activeTab}
              onValueChange={(val: any) => setActiveTab(val)}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="px-5 pt-2 border-b bg-muted/20 shrink-0">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="dados" className="text-xs">
                    Dados Principais
                  </TabsTrigger>
                  <TabsTrigger value="impressao" className="text-xs">
                    Impressão
                  </TabsTrigger>
                  <TabsTrigger value="estoque" className="text-xs">
                    Estoque
                  </TabsTrigger>
                  <TabsTrigger value="adicionais" className="text-xs">
                    Adicionais
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* ABA 1: DADOS PRINCIPAIS */}
                <TabsContent value="dados" className="m-0 space-y-4 focus-visible:outline-none">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <Label htmlFor="prod-name">Nome do Produto *</Label>
                      <Input
                        id="prod-name"
                        ref={nameInputRef}
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Ex: Hambúrguer Artesanal, Coca-Cola 350ml"
                      />
                    </div>
                    <div>
                      <Label htmlFor="prod-code">Código / SKU</Label>
                      <Input
                        id="prod-code"
                        value={form.searchCode}
                        onChange={e => setForm(f => ({ ...f, searchCode: e.target.value }))}
                        placeholder="Ex: LAN01"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label htmlFor="prod-cat">Categoria *</Label>
                        <button
                          type="button"
                          onClick={() => {
                            setDialogOpen(false);
                            navigate('/categorias');
                          }}
                          className="text-[11px] text-primary hover:underline"
                        >
                          + Gerenciar categorias
                        </button>
                      </div>
                      <select
                        id="prod-cat"
                        className="w-full h-10 rounded-md border bg-background px-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                        value={form.categoryId}
                        onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                      >
                        <option value="">Selecione uma categoria...</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label>Tipo de Venda</Label>
                      <div className="flex gap-2 mt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={form.type === 'unit' ? 'default' : 'outline'}
                          onClick={() => setForm(f => ({ ...f, type: 'unit', unit: 'un' }))}
                          className="flex-1 text-xs"
                        >
                          Unidade (un)
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={form.type === 'weight' ? 'default' : 'outline'}
                          onClick={() => setForm(f => ({ ...f, type: 'weight', unit: 'kg' }))}
                          className="flex-1 text-xs"
                        >
                          Por Quilo (kg)
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="prod-price">Preço de Venda (R$) *</Label>
                      <CurrencyInput
                        id="prod-price"
                        value={form.price}
                        onValueChange={price => setForm(f => ({ ...f, price }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="prod-cost">Preço de Custo (R$)</Label>
                      <CurrencyInput
                        id="prod-cost"
                        value={form.costPrice}
                        onValueChange={costPrice => setForm(f => ({ ...f, costPrice }))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="prod-desc">Descrição do Produto</Label>
                    <Textarea
                      id="prod-desc"
                      rows={2}
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Ingredientes, detalhes e informações para o cliente..."
                    />
                  </div>

                  <Section title="Opções Adicionais">
                    <CheckOption
                      checked={form.serviceFeeExempt}
                      onChange={v => setForm(f => ({ ...f, serviceFeeExempt: v }))}
                      title="Isento da taxa de serviço"
                      hint="não inclui a comissão/taxa de serviço sobre o valor deste item."
                    />
                    <CheckOption
                      checked={form.loyaltyEligible}
                      onChange={v => setForm(f => ({ ...f, loyaltyEligible: v }))}
                      title="Programa de Fidelidade"
                      hint="permite ao cliente acumular pontos ao consumir este produto."
                    />
                  </Section>
                </TabsContent>

                {/* ABA 2: IMPRESSÃO */}
                <TabsContent value="impressao" className="m-0 space-y-4 focus-visible:outline-none">
                  <div className="rounded-lg border p-4 bg-muted/10 space-y-3">
                    <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                      <Printer className="h-4 w-4 text-primary" />
                      Setor de Impressão de Comandas
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="prod-sector">Imprimir comanda em:</Label>
                      <select
                        id="prod-sector"
                        className="w-full h-10 rounded-md border bg-background px-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                        value={form.printSector}
                        onChange={e => setForm(f => ({ ...f, printSector: e.target.value }))}
                      >
                        <option value="">
                          Padrão da categoria (
                          {sectorLabel(getCat(form.categoryId)?.printSector || 'cozinha')})
                        </option>
                        {PRINT_SECTOR_OPTIONS.filter(o => o.key !== 'none').map(o => (
                          <option key={o.key} value={o.key}>
                            {sectorLabel(o.key)}
                          </option>
                        ))}
                        {sectorOptions
                          .filter(o => !PRINT_SECTOR_OPTIONS.some(p => p.key === o.key))
                          .map(o => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                            </option>
                          ))}
                        <option value="none">Não imprimir comanda para este produto</option>
                      </select>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                        Se definido como <strong>Padrão da categoria</strong>, o produto seguirá a configuração
                        da categoria à qual pertence.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* ABA 3: ESTOQUE */}
                <TabsContent value="estoque" className="m-0 space-y-4 focus-visible:outline-none">
                  <Section title="Controle de Quantidade">
                    <CheckOption
                      checked={form.controlStock}
                      onChange={v => setForm(f => ({ ...f, controlStock: v }))}
                      title="Ativar controle de estoque"
                      hint="diminui a quantidade automaticamente a cada venda efetuada."
                    />

                    {form.controlStock && (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <Label htmlFor="prod-stock">Estoque Atual ({form.unit})</Label>
                          <Input
                            id="prod-stock"
                            type="number"
                            step="any"
                            value={form.stock}
                            onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <Label htmlFor="prod-min-stock">Estoque Mínimo (Alerta)</Label>
                          <Input
                            id="prod-min-stock"
                            type="number"
                            step="any"
                            value={form.minStock}
                            onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    )}
                  </Section>

                  <Section title="Fornecedor do Produto">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between mb-1">
                        <Label htmlFor="prod-supplier">Fornecedor</Label>
                        <button
                          type="button"
                          onClick={() => {
                            setSupplierForm({ name: '', contact: '' });
                            setNewSupplierOpen(true);
                          }}
                          className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          <Building2 className="h-3 w-3" /> Novo fornecedor
                        </button>
                      </div>
                      <select
                        id="prod-supplier"
                        className="w-full h-10 rounded-md border bg-background px-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                        value={form.supplierId}
                        onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                      >
                        <option value="">Nenhum fornecedor vinculado</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                            {s.contact ? ` · ${s.contact}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Section>
                </TabsContent>

                {/* ABA 4: ADICIONAIS & OBSERVAÇÕES */}
                <TabsContent value="adicionais" className="m-0 space-y-4 focus-visible:outline-none">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          Opções Vinculadas à Categoria
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Adicionais e sabores disponíveis para a categoria selecionada.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOptsDialogOpen(true)}
                        className="text-xs gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Criar Nova Opção
                      </Button>
                    </div>

                    {currentCategoryNoteOptions.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                        <Tag className="h-6 w-6 mx-auto mb-2 opacity-40" />
                        <p className="text-xs font-medium">
                          Nenhum adicional ou observação vinculada a esta categoria.
                        </p>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => setOptsDialogOpen(true)}
                          className="text-xs mt-1"
                        >
                          Adicionar opções agora
                        </Button>
                      </div>
                    ) : (
                      <div className="divide-y border rounded-lg overflow-hidden bg-card">
                        {currentCategoryNoteOptions.map(opt => (
                          <div
                            key={opt.id}
                            className="p-3 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-semibold text-foreground">{opt.name}</span>
                              <span className="ml-2 text-muted-foreground">
                                {opt.type === 'complement'
                                  ? `+ R$ ${fmt(opt.price)} (${opt.classification === 'flavor' ? 'Sabor' : 'Adicional'})`
                                  : 'Observação livre'}
                              </span>
                            </div>
                            <Badge variant={opt.active ? 'secondary' : 'outline'} className="text-[10px]">
                              {opt.active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>

              <DialogFooter className="p-4 border-t bg-card gap-2 shrink-0">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </Button>
              </DialogFooter>
            </Tabs>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão de Produto */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir Produto
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o produto{' '}
            <strong className="text-foreground">{deleteProduct?.name}</strong>? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete}>
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Central de Observações & Adicionais */}
      <Dialog open={optsDialogOpen} onOpenChange={setOptsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 border-b flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Observações & Adicionais
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 bg-muted/20 border-b flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1 text-xs"
              onClick={() => openCreateOpt('note')}
            >
              <Plus className="h-3.5 w-3.5" /> Nova Observação Livre
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-1 text-xs"
              onClick={() => openCreateOpt('complement')}
            >
              <Plus className="h-3.5 w-3.5" /> Novo Adicional Pago
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Observações Livres */}
            <div>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-secondary" />
                Observações Livres ({noteOptions.filter(o => o.type === 'note').length})
              </h3>
              {noteOptions.filter(o => o.type === 'note').length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                  Nenhuma observação cadastrada.
                </p>
              ) : (
                <div className="grid gap-2">
                  {noteOptions
                    .filter(o => o.type === 'note')
                    .map(opt => (
                      <div
                        key={opt.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-card"
                      >
                        <div>
                          <p className="font-semibold text-sm text-foreground">{opt.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {opt.categoryIds.length === categories.length
                              ? 'Todas as categorias'
                              : `${opt.categoryIds.length} categoria(s)`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditOpt(opt)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteOpt(opt.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Adicionais Pagos */}
            <div>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                Adicionais e Sabores ({noteOptions.filter(o => o.type === 'complement').length})
              </h3>
              {noteOptions.filter(o => o.type === 'complement').length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                  Nenhum adicional cadastrado.
                </p>
              ) : (
                <div className="grid gap-2">
                  {noteOptions
                    .filter(o => o.type === 'complement')
                    .map(opt => (
                      <div
                        key={opt.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-card"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-foreground">{opt.name}</p>
                            <Badge variant="secondary" className="text-[10px]">
                              {opt.classification === 'flavor' ? 'Sabor' : 'Adicional'}
                            </Badge>
                          </div>
                          <p className="text-xs font-bold text-primary tabular-nums mt-0.5">
                            + R$ {fmt(opt.price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditOpt(opt)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteOpt(opt.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Criação / Edição de NoteOption */}
      <Dialog open={optFormOpen} onOpenChange={setOptFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingOptId
                ? 'Editar Opção'
                : optForm.type === 'note'
                ? 'Nova Observação'
                : 'Novo Adicional'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Nome da Opção *</Label>
              <Input
                autoFocus
                value={optForm.name}
                onChange={e => setOptForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Sem Cebola, Bacon Extra, Catupiry..."
              />
            </div>

            {optForm.type === 'complement' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Classificação</Label>
                  <Select
                    value={optForm.classification}
                    onValueChange={(value: 'flavor' | 'additional') =>
                      setOptForm(f => ({ ...f, classification: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="additional">Adicional</SelectItem>
                      <SelectItem value="flavor">Sabor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Preço Adicional (R$)</Label>
                  <CurrencyInput
                    value={optForm.price}
                    onValueChange={price => setOptForm(f => ({ ...f, price }))}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Disponível para as categorias: *</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 grid grid-cols-2 gap-2 bg-muted/30">
                {categories.map(cat => (
                  <label
                    key={cat.id}
                    className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={optForm.categoryIds.includes(cat.id)}
                      onChange={e => {
                        const checked = e.target.checked;
                        setOptForm(f => ({
                          ...f,
                          categoryIds: checked
                            ? [...f.categoryIds, cat.id]
                            : f.categoryIds.filter(id => id !== cat.id),
                        }));
                      }}
                      className="rounded"
                    />
                    <span className="truncate">{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => setOptFormOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={saveOpt}
                disabled={!optForm.name.trim() || optForm.categoryIds.length === 0}
              >
                {editingOptId ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Rápido de Fornecedor */}
      <Dialog open={newSupplierOpen} onOpenChange={setNewSupplierOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Novo Fornecedor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label>Nome do Fornecedor *</Label>
              <Input
                autoFocus
                value={supplierForm.name}
                onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Distribuidora Alimentos S/A"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contato (Telefone / WhatsApp)</Label>
              <Input
                value={supplierForm.contact}
                onChange={e => setSupplierForm(f => ({ ...f, contact: e.target.value }))}
                placeholder="(86) 99999-9999"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setNewSupplierOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!supplierForm.name.trim() || supplierSaving}
              onClick={() => {
                if (!supplierForm.name.trim()) return;
                setSupplierSaving(true);
                const newSupplier: Supplier = {
                  id: crypto.randomUUID(),
                  name: supplierForm.name.trim(),
                  contact: supplierForm.contact.trim() || undefined,
                };
                setSuppliers(prev => [...prev, newSupplier]);
                setForm(f => ({ ...f, supplierId: newSupplier.id }));
                setSupplierForm({ name: '', contact: '' });
                setNewSupplierOpen(false);
                setSupplierSaving(false);
                toast.success(`Fornecedor "${newSupplier.name}" cadastrado!`);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Produtos;
