import React, { useState, useRef } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { fmt } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Upload, X, Search, Tag } from 'lucide-react';
import { Product, ProductType, ProductCategory } from '@/types';


const emptyProductForm = {
  name: '',
  description: '',
  price: '',
  categoryId: '',
  type: 'unit' as ProductType,
  unit: 'un',
  stock: '',
  image: '',
};

const emptyCategoryForm = { name: '' };

const Produtos = () => {
  const { products, setProducts, categories, setCategories } = useStore();

  // Product state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProductForm);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  // Category state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catDeleteOpen, setCatDeleteOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState(emptyCategoryForm);

  const getCat = (id: string) => categories.find(c => c.id === id);

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
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
      price: String(p.price),
      categoryId: p.categoryId,
      type: p.type,
      unit: p.unit,
      stock: String(p.stock),
      image: p.image || '',
    });
    setDialogOpen(true);
  };

  const openDelete = (id: string) => { setDeleteId(id); setDeleteOpen(true); };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      return;
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, image: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!form.name.trim() || !form.price || !form.categoryId) {
      toast({ title: 'Preencha nome, preço e categoria', variant: 'destructive' });
      return;
    }
    const product: Product = {
      id: editingId || crypto.randomUUID(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price: parseFloat(form.price),
      categoryId: form.categoryId,
      type: form.type,
      unit: form.type === 'weight' ? 'kg' : 'un',
      stock: parseFloat(form.stock) || 0,
      image: form.image || undefined,
    };
    if (editingId) {
      setProducts(prev => prev.map(p => p.id === editingId ? product : p));
      toast({ title: 'Produto atualizado' });
    } else {
      setProducts(prev => [...prev, product]);
      toast({ title: 'Produto cadastrado' });
    }
    setDialogOpen(false);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    setProducts(prev => prev.filter(p => p.id !== deleteId));
    toast({ title: 'Produto excluído' });
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
    setCatForm({ name: cat.name });
    setCatDialogOpen(true);
  };

  const openDeleteCat = (id: string) => { setDeleteCatId(id); setCatDeleteOpen(true); };

  const saveCat = () => {
    if (!catForm.name.trim()) {
      toast({ title: 'Preencha o nome da categoria', variant: 'destructive' });
      return;
    }
    const cat: ProductCategory = {
      id: editingCatId || crypto.randomUUID(),
      name: catForm.name.trim(),
    };
    if (editingCatId) {
      setCategories(prev => prev.map(c => c.id === editingCatId ? cat : c));
      toast({ title: 'Categoria atualizada' });
    } else {
      setCategories(prev => [...prev, cat]);
      toast({ title: 'Categoria cadastrada' });
    }
    setCatDialogOpen(false);
  };

  const confirmDeleteCat = () => {
    if (!deleteCatId) return;
    const hasProducts = products.some(p => p.categoryId === deleteCatId);
    if (hasProducts) {
      toast({ title: 'Não é possível excluir', description: 'Existem produtos vinculados a esta categoria', variant: 'destructive' });
      setCatDeleteOpen(false);
      return;
    }
    setCategories(prev => prev.filter(c => c.id !== deleteCatId));
    if (filterCategory === deleteCatId) setFilterCategory('all');
    toast({ title: 'Categoria excluída' });
    setCatDeleteOpen(false);
    setDeleteCatId(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
        <div className="flex gap-2">
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

      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
        {filtered.map(product => {
          const cat = getCat(product.categoryId);
          return (
            <Card key={product.id} className="overflow-hidden group">
              <div className="aspect-square bg-muted relative overflow-hidden">
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl">
                    {cat?.name?.charAt(0) || '?'}
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="secondary" size="icon" className="h-8 w-8 shadow-md" onClick={() => openEdit(product)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="destructive" size="icon" className="h-8 w-8 shadow-md" onClick={() => openDelete(product.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="p-3 space-y-1.5">
                <h3 className="font-semibold text-sm text-foreground leading-tight line-clamp-2">{product.name}</h3>
                <p className="text-primary font-bold text-base">
                  R$ {fmt(product.price)}
                  {product.type === 'weight' && <span className="text-xs text-muted-foreground font-normal">/kg</span>}
                </p>
                {product.description && <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>}
                <div className="flex items-center justify-between pt-1">
                  <Badge variant="outline" className="text-[10px]">
                    {cat ? cat.name : 'Sem categoria'}
                  </Badge>
                  <Badge variant={product.stock <= 5 ? 'destructive' : 'secondary'} className="text-[10px]">
                    {product.stock} {product.unit}
                  </Badge>
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">Nenhum produto encontrado</div>
        )}
      </div>

      {/* Product Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Foto do Produto</Label>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              {form.image ? (
                <div className="relative mt-2 rounded-lg overflow-hidden aspect-video bg-muted">
                  <img src={form.image} alt="Preview" className="w-full h-full object-cover" />
                  <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => setForm(f => ({ ...f, image: '' }))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Clique para enviar uma foto</p>
                  <p className="text-xs text-muted-foreground/60">Máx. 2MB • JPG, PNG</p>
                </div>
              )}
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Descrição opcional..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preço (R$) *</Label>
                <Input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div>
                <Label>Estoque</Label>
                <Input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria *</Label>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={form.categoryId}
                  onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Tipo</Label>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as ProductType }))}
                >
                  <option value="unit">Unidade</option>
                  <option value="weight">Peso (kg)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={save}>{editingId ? 'Salvar' : 'Cadastrar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir Produto</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.</p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Create/Edit Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCatId ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Pizzas" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancelar</Button>
              {editingCatId && (
                <Button variant="destructive" onClick={() => { setCatDialogOpen(false); openDeleteCat(editingCatId); }}>
                  Excluir
                </Button>
              )}
              <Button onClick={saveCat}>{editingCatId ? 'Salvar' : 'Cadastrar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Delete Confirmation */}
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
    </div>
  );
};

export default Produtos;
