import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { usePrinter } from '@/hooks/use-printer';
import { fmt, formatBRLInput, parseBRLInput } from '@/lib/utils';
import { sectorLabel, buildSectorOptions } from '@/lib/print-sectors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Search, Tag, Building2, PackageOpen } from 'lucide-react';
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
};

const emptyCategoryForm = { name: '', printSector: 'cozinha' };

// Definidos fora do componente para não remontar os campos (e perder o foco) a cada digitação
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="rounded-lg border p-3 space-y-3">
    <legend className="px-1 text-xs font-semibold uppercase text-muted-foreground">{title}</legend>
    {children}
  </fieldset>
);

const Check = ({ checked, onChange, title, hint }: { checked: boolean; onChange: (v: boolean) => void; title: string; hint: string }) => (
  <label className="flex items-start gap-2 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-1 rounded border-border" />
    <span className="text-sm"><b>{title}</b> <span className="text-muted-foreground">— {hint}</span></span>
  </label>
);

const Produtos = () => {
  const { products, setProducts, categories, setCategories, noteOptions, setNoteOptions, suppliers, setSuppliers } = useStore();
  const { printers } = usePrinter();
  const sectorOptions = buildSectorOptions(printers);

  // Product state
  const [dialogOpen, setDialogOpen] = useState(false);

  // Foca o campo Nome apenas quando o modal abre (autoFocus roubava o foco ao trocar de campo)
  useEffect(() => {
    if (!dialogOpen) return;
    const t = setTimeout(() => nameInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [dialogOpen]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProductForm);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  // Dedicated Category Management Modal state
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [catDeleteOpen, setCatDeleteOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catForm, setCatForm] = useState(emptyCategoryForm);

  // Dedicated NoteOption state
  const [optsDialogOpen, setOptsDialogOpen] = useState(false);
  const [optFormOpen, setOptFormOpen] = useState(false);
  const [editingOptId, setEditingOptId] = useState<string | null>(null);
  const [optForm, setOptForm] = useState(emptyNoteOptionForm);

  // New supplier inline modal
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact: '' });
  const [supplierSaving, setSupplierSaving] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const getCat = (id: string) => categories.find(c => c.id === id);

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) || (p.searchCode || '').toLowerCase().includes(q);
    const matchCat = filterCategory === 'all' || p.categoryId === filterCategory;
    return matchSearch && matchCat;
  });

  // ---- Product CRUD ----
  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyProductForm, categoryId: categories[0]?.id || '' });
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
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

  const openDelete = (id: string) => { setDeleteId(id); setDeleteOpen(true); };

  const save = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Informe o nome do produto.');
      return;
    }
    if (!form.price || parseBRLInput(form.price) < 0) {
      toast.error('Informe um preço válido.');
      return;
    }
    if (!form.categoryId) {
      toast.error('Selecione uma categoria para o produto.');
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
      setProducts(prev => prev.map(p => p.id === editingId ? product : p));
      toast.success(`Produto "${product.name}" atualizado com sucesso!`);
    } else {
      setProducts(prev => [...prev, product]);
      toast.success(`Produto "${product.name}" cadastrado com sucesso!`);
    }
    setForm(emptyProductForm);
    setEditingId(null);
    setDialogOpen(false);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    setProducts(prev => prev.filter(p => p.id !== deleteId));
    toast.success('Produto excluído com sucesso!');
    setDeleteOpen(false);
    setDeleteId(null);
  };

  // ---- Category CRUD ----
  const openCreateCat = () => {
    setEditingCatId(null);
    setCatForm(emptyCategoryForm);
    setCatDialogOpen(true);
  };

  const openEditCat = (cat: ProductCategory) => {
    setEditingCatId(cat.id);
    setCatForm({ name: cat.name, printSector: cat.printSector || 'cozinha' });
    setCatDialogOpen(true);
  };

  const saveCat = (e: React.FormEvent) => {
    e.preventDefault();
    const catName = catForm.name.trim();
    if (!catName) {
      toast.error('Informe o nome da categoria.');
      return;
    }
    const duplicate = categories.some(c => c.name.toLowerCase() === catName.toLowerCase() && c.id !== editingCatId);
    if (duplicate) {
      toast.error(`A categoria "${catName}" já existe.`);
      return;
    }
    if (editingCatId) {
      setCategories(prev => prev.map(c => c.id === editingCatId ? { ...c, name: catName, printSector: catForm.printSector } : c));
      toast.success(`Categoria "${catName}" atualizada com sucesso!`);
    } else {
      setCategories(prev => [...prev, { id: crypto.randomUUID(), name: catName, printSector: catForm.printSector }]);
      toast.success(`Categoria "${catName}" cadastrada com sucesso!`);
    }
    setCatForm(emptyCategoryForm);
    setEditingCatId(null);
    setCatDialogOpen(false);
  };

  const openDeleteCat = (id: string) => {
    const hasProducts = products.some(p => p.categoryId === id);
    if (hasProducts) {
      toast.error('Esta categoria possui produtos vinculados e não pode ser excluída.');
      return;
    }
    setDeleteCatId(id);
    setCatDeleteOpen(true);
  };

  const confirmDeleteCat = () => {
    if (!deleteCatId) return;
    setCategories(prev => prev.filter(c => c.id !== deleteCatId));
    if (filterCategory === deleteCatId) setFilterCategory('all');
    toast.success('Categoria excluída com sucesso!');
    setCatDeleteOpen(false);
    setDeleteCatId(null);
  };

  // ---- NoteOption CRUD ----
  const openCreateOpt = (type: 'note' | 'complement' = 'note') => {
    setEditingOptId(null);
    setOptForm({
      ...emptyNoteOptionForm,
      type,
      categoryIds: categories.map(c => c.id), // select all categories by default
    });
    setOptFormOpen(true);
  };

  const openEditOpt = (opt: ProductNoteOption) => {
    setEditingOptId(opt.id);
    setOptForm({
      name: opt.name,
      type: opt.type,
      price: formatBRLInput(opt.price),
      categoryIds: opt.categoryIds,
      active: opt.active,
    });
    setOptFormOpen(true);
  };

  const deleteOpt = (id: string) => {
    setNoteOptions(prev => prev.filter(o => o.id !== id));
    toast.success('Opção removida com sucesso!');
  };

  const saveOpt = () => {
    if (!optForm.name.trim()) {
      toast.error('Informe o nome da opção.');
      return;
    }
    if (optForm.categoryIds.length === 0) {
      toast.error('Selecione pelo menos uma categoria.');
      return;
    }
    const opt: ProductNoteOption = {
      id: editingOptId || crypto.randomUUID(),
      name: optForm.name.trim(),
      type: optForm.type,
      price: parseBRLInput(optForm.price),
      categoryIds: optForm.categoryIds,
      active: optForm.active,
    };
    if (editingOptId) {
      setNoteOptions(prev => prev.map(o => o.id === editingOptId ? opt : o));
      toast.success('Opção atualizada com sucesso!');
    } else {
      setNoteOptions(prev => [...prev, opt]);
      toast.success('Opção criada com sucesso!');
    }
    setOptFormOpen(false);
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setOptsDialogOpen(true); }}>
            <Tag className="h-4 w-4 mr-2" /> Observações & Adicionais
          </Button>
          <Button variant="outline" onClick={openCreateCat}>
            <Tag className="h-4 w-4 mr-2" /> Nova Categoria
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Novo Produto
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button variant={filterCategory === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilterCategory('all')}>
            Todos
          </Button>
          {categories.map(cat => (
            <Button
              key={cat.id}
              variant={filterCategory === cat.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterCategory(cat.id)}
              className="whitespace-nowrap group/cat"
            >
              {cat.name}
              <span
                className="ml-1 opacity-0 group-hover/cat:opacity-100 transition-opacity cursor-pointer"
                onClick={e => { e.stopPropagation(); openEditCat(cat); }}
              >
                <Pencil className="h-3 w-3 inline" />
              </span>
            </Button>
          ))}
        </div>
      </div>

      {/* Compact product table */}
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="w-28 px-4 py-3">Código</th>
                <th className="px-4 py-3">Produto</th>
                <th className="w-44 px-4 py-3">Categoria</th>
                <th className="w-32 px-4 py-3 text-right">Preço</th>
                <th className="w-28 px-4 py-3 text-right">Estoque</th>
                <th className="w-32 px-4 py-3">Situação</th>
                <th className="w-44 px-4 py-3">Imprimir em</th>
                <th className="w-24 px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(product => {
                const cat = getCat(product.categoryId);
                const stockLow = product.controlStock && product.stock <= (product.minStock ?? 0);
                const printDestination = product.printSector === 'none'
                  ? 'Não imprimir'
                  : sectorLabel(product.printSector || cat?.printSector || 'cozinha');
                return (
                  <tr key={product.id} className="transition-colors hover:bg-muted/35">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{product.searchCode || '—'}</td>
                    <td className="px-4 py-3">
                      <Button type="button" variant="link" className="h-auto max-w-md flex-col items-start whitespace-normal p-0 text-left text-foreground no-underline hover:no-underline" onClick={() => openEdit(product)}>
                        <span className="block font-semibold text-foreground">{product.name}</span>
                        {product.description && <span className="mt-0.5 block max-w-md truncate text-xs text-muted-foreground">{product.description}</span>}
                      </Button>
                    </td>
                    <td className="px-4 py-3 text-foreground">{cat?.name || 'Sem categoria'}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-primary">R$ {fmt(product.price)}{product.type === 'weight' ? '/kg' : ''}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{product.controlStock ? `${product.stock} ${product.unit}` : '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={stockLow ? 'destructive' : 'secondary'} className="whitespace-nowrap text-[10px]">
                        {!product.controlStock ? 'Não controlado' : stockLow ? 'Estoque baixo' : 'Regular'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{printDestination}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar ${product.name}`} title="Editar produto" onClick={() => openEdit(product)}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label={`Excluir ${product.name}`} title="Excluir produto" onClick={() => openDelete(product.id)}>
                          <Trash2 />
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
            <PackageOpen className="h-7 w-7" />
            <p>Nenhum produto encontrado</p>
          </div>
        )}
        <div className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'}
        </div>
      </div>

      {/* Product Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? form.name || 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <Section title="Dados principais">
              <div>
                <Label>Código de busca</Label>
                <Input value={form.searchCode} onChange={e => setForm(f => ({ ...f, searchCode: e.target.value }))} placeholder="Opcional" />
              </div>
              <div>
                <Label>Nome *</Label>
                <Input ref={nameInputRef} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Categoria *</Label>
                <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Preço de venda (R$) *</Label>
                  <CurrencyInput value={form.price} onValueChange={price => setForm(f => ({ ...f, price }))} />
                </div>
                <div>
                  <Label>Preço de custo (R$)</Label>
                  <CurrencyInput value={form.costPrice} onValueChange={costPrice => setForm(f => ({ ...f, costPrice }))} />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Opcional" />
              </div>
            </Section>

            <Section title="Configurações">
              <Check checked={form.type === 'weight'} onChange={v => setForm(f => ({ ...f, type: v ? 'weight' : 'unit' }))} title="Venda por quilo" hint="vende este item por kg." />
              <Check checked={form.serviceFeeExempt} onChange={v => setForm(f => ({ ...f, serviceFeeExempt: v }))} title="Isento da taxa de serviço" hint="não cobra a taxa de serviço sobre este item." />
              <Check checked={form.loyaltyEligible} onChange={v => setForm(f => ({ ...f, loyaltyEligible: v }))} title="Fidelidade" hint="conta pontos no programa de fidelidade." />
              <div>
                <Label>Imprimir em</Label>
                <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.printSector} onChange={e => setForm(f => ({ ...f, printSector: e.target.value }))}>
                  <option value="">Padrão da categoria ({sectorLabel(getCat(form.categoryId)?.printSector || 'cozinha')})</option>
                  {sectorOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  {form.printSector && form.printSector !== 'none' && !sectorOptions.some(o => o.key === form.printSector) && (
                    <option value={form.printSector}>{sectorLabel(form.printSector)} (sem impressora configurada)</option>
                  )}
                  <option value="none">Não imprimir</option>
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">Define em qual impressora a comanda deste item sai. Só aparecem impressoras ativas em Configurações &gt; Impressora.</p>
              </div>
            </Section>

            <Section title="Estoque">
              <Check checked={form.controlStock} onChange={v => setForm(f => ({ ...f, controlStock: v }))} title="Controlar estoque" hint="acompanha a quantidade disponível deste item." />
              {form.controlStock && (
                <div>
                  <Label>Estoque mínimo</Label>
                  <Input type="number" min="0" value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))} placeholder="0" />
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Fornecedor</Label>
                  <button
                    type="button"
                    onClick={() => { setSupplierForm({ name: '', contact: '' }); setNewSupplierOpen(true); }}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <Building2 className="h-3 w-3" /> Novo fornecedor
                  </button>
                </div>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={form.supplierId}
                  onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                >
                  <option value="">Nenhum</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.contact ? ` · ${s.contact}` : ''}</option>
                  ))}
                </select>
              </div>
            </Section>

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? 'Salvar' : 'Cadastrar'}</Button>
            </div>
          </form>
      </DialogContent>
    </Dialog>

      {/* Product Delete Confirmation */ }
  <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
    <DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Excluir Produto</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.</p>
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
        <Button type="button" variant="destructive" onClick={confirmDelete}>Excluir</Button>
      </div>
    </DialogContent>
  </Dialog>

  {/* Category Create/Edit Dialog */ }
  <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{editingCatId ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={saveCat} className="space-y-4">
        <div>
          <Label>Nome *</Label>
          <Input autoFocus value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Refri" />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => setCatDialogOpen(false)}>Cancelar</Button>
          {editingCatId && (
            <Button type="button" variant="destructive" onClick={() => { setCatDialogOpen(false); openDeleteCat(editingCatId); }}>
              Excluir
            </Button>
          )}
          <Button type="submit">{editingCatId ? 'Salvar' : 'Cadastrar'}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>

  {/* Category Delete Confirmation */ }
  <Dialog open={catDeleteOpen} onOpenChange={setCatDeleteOpen}>
    <DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Excluir Categoria</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Tem certeza? Categorias com produtos vinculados não podem ser excluídas.</p>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={() => setCatDeleteOpen(false)}>Cancelar</Button>
        <Button variant="destructive" onClick={confirmDeleteCat}>Excluir</Button>
      </div>
    </DialogContent>
  </Dialog>

  {/* NoteOptions Manager Dialog */ }
  <Dialog open={optsDialogOpen} onOpenChange={setOptsDialogOpen}>
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
      <DialogHeader className="shrink-0 flex flex-row items-center justify-between">
        <DialogTitle>Observações e Adicionais</DialogTitle>
      </DialogHeader>
      <div className="flex gap-2 mb-2 shrink-0">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditingOptId(null); setOptForm({ ...emptyNoteOptionForm, type: 'note' }); setOptFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova Observação
        </Button>
        <Button size="sm" onClick={() => { setEditingOptId(null); setOptForm({ ...emptyNoteOptionForm, type: 'complement' }); setOptFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo Adicional
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-1 space-y-5">
        {/* Observações */}
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 px-1 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-secondary" />
            Observações Livres ({noteOptions.filter(o => o.type === 'note').length})
          </h3>
          {noteOptions.filter(o => o.type === 'note').length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">Nenhuma observação cadastrada.</p>
          ) : (
            <div className="grid gap-2">
              {noteOptions.filter(o => o.type === 'note').map(opt => (
                <div key={opt.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Observação</Badge>
                      <span className="font-bold">{opt.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex gap-1 flex-wrap">
                      {opt.categoryIds.map(cid => {
                        const cat = getCat(cid);
                        return cat ? <Badge key={cid} variant="outline" className="text-[10px] px-1 py-0">{cat.name}</Badge> : null;
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditOpt(opt)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteOpt(opt.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Adicionais */}
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 px-1 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-primary" />
            Adicionais ({noteOptions.filter(o => o.type === 'complement').length})
          </h3>
          {noteOptions.filter(o => o.type === 'complement').length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">Nenhum adicional cadastrado.</p>
          ) : (
            <div className="grid gap-2">
              {noteOptions.filter(o => o.type === 'complement').map(opt => (
                <div key={opt.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">Adicional</Badge>
                      <span className="font-bold">{opt.name}</span>
                      {opt.price > 0 && <span className="text-sm text-primary font-bold">R$ {fmt(opt.price)}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex gap-1 flex-wrap">
                      {opt.categoryIds.map(cid => {
                        const cat = getCat(cid);
                        return cat ? <Badge key={cid} variant="outline" className="text-[10px] px-1 py-0">{cat.name}</Badge> : null;
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditOpt(opt)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteOpt(opt.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DialogContent>
  </Dialog>

  {/* NoteOption Create/Edit Form Dialog */ }
  <Dialog open={optFormOpen} onOpenChange={setOptFormOpen}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{editingOptId ? 'Editar Opção' : 'Nova Opção'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" checked={optForm.type === 'note'} onChange={() => setOptForm(f => ({ ...f, type: 'note' }))} />
            <span>Observação Livre</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={optForm.type === 'complement'} onChange={() => setOptForm(f => ({ ...f, type: 'complement' }))} />
            <span>Adicional</span>
          </label>
        </div>

        <div className="grid gap-3">
          <div>
            <Label>Nome *</Label>
            <Input value={optForm.name} onChange={e => setOptForm(f => ({ ...f, name: e.target.value }))} placeholder={optForm.type === 'note' ? 'Ex: Sem cebola' : 'Ex: Bacon Extra'} />
          </div>
          {optForm.type === 'complement' && (
            <div>
              <Label>Preço Adicional (R$)</Label>
              <CurrencyInput value={optForm.price} onValueChange={price => setOptForm(f => ({ ...f, price }))} />
            </div>
          )}
        </div>

        <div>
          <Label className="mb-2 block">Disponível para as categorias: *</Label>
          <div className="max-h-40 overflow-y-auto border rounded-md p-2 grid grid-cols-2 gap-2 bg-muted/30">
            {categories.map(cat => (
              <label key={cat.id} className="flex items-center gap-2 text-sm cursor-pointer p-1 rounded hover:bg-muted">
                <input
                  type="checkbox"
                  checked={optForm.categoryIds.includes(cat.id)}
                  onChange={e => {
                    const checked = e.target.checked;
                    setOptForm(f => ({
                      ...f,
                      categoryIds: checked ? [...f.categoryIds, cat.id] : f.categoryIds.filter(id => id !== cat.id)
                    }));
                  }}
                />
                <span className="truncate">{cat.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={optForm.active} onChange={e => setOptForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
            <span className="text-sm font-medium">Ativo</span>
          </label>
        </div>

        <div className="flex gap-2 justify-end pt-4">
          <Button variant="outline" onClick={() => setOptFormOpen(false)}>Cancelar</Button>
          <Button onClick={saveOpt} disabled={!optForm.name.trim() || optForm.categoryIds.length === 0}>
            {editingOptId ? 'Salvar' : 'Cadastrar'}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  {/* New Supplier Inline Modal */ }
  <Dialog open={newSupplierOpen} onOpenChange={setNewSupplierOpen}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Novo Fornecedor
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Nome *</Label>
          <Input
            autoFocus
            value={supplierForm.name}
            onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ex: Distribuidora ABC"
            className="mt-1"
          />
        </div>
        <div>
          <Label>Contato <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
          <Input
            value={supplierForm.contact}
            onChange={e => setSupplierForm(f => ({ ...f, contact: e.target.value }))}
            placeholder="Telefone, e-mail ou WhatsApp"
            className="mt-1"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={() => setNewSupplierOpen(false)}>
          Cancelar
        </Button>
        <Button
          className="flex-1"
          disabled={!supplierForm.name.trim() || supplierSaving}
          onClick={() => {
            if (!supplierForm.name.trim()) return;
            setSupplierSaving(true);
            const newSupplier: Supplier = {
              id: crypto.randomUUID(),
              name: supplierForm.name.trim(),
              contact: supplierForm.contact.trim(),
            };
            setSuppliers(prev => [...prev, newSupplier]);
            setForm(f => ({ ...f, supplierId: newSupplier.id }));
            setSupplierForm({ name: '', contact: '' });
            setNewSupplierOpen(false);
            setSupplierSaving(false);
          }}
        >
          Salvar
        </Button>
      </div>
    </DialogContent>
  </Dialog>

    </div >
  );
};

export default Produtos;
