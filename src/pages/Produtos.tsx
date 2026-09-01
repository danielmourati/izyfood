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
import { Plus, Pencil, Trash2, Upload, X, Search, Tag, Building2, FileSpreadsheet, Download, CheckCircle2 } from 'lucide-react';
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
  image: '',
  loyaltyEligible: false,
  controlStock: true,
  supplierId: '',
};

const emptyNoteOptionForm = {
  name: '',
  type: 'note' as 'note' | 'complement',
  price: '',
  categoryIds: [] as string[],
  active: true,
};

const emptyCategoryForm = { name: '' };

/** Flag para ativar/desativar botões e dialog de importação via CSV (Mudar para true quando desejar reativar) */
const ENABLE_CSV_IMPORT = false;

const Produtos = () => {
  const { products, setProducts, categories, setCategories, noteOptions, setNoteOptions, suppliers, setSuppliers } = useStore();

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

  // NoteOption state
  const [optsDialogOpen, setOptsDialogOpen] = useState(false);
  const [optFormOpen, setOptFormOpen] = useState(false);
  const [editingOptId, setEditingOptId] = useState<string | null>(null);
  const [optForm, setOptForm] = useState(emptyNoteOptionForm);

  // New supplier inline modal
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact: '' });
  const [supplierSaving, setSupplierSaving] = useState(false);

  // CSV Import state
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvPreviewOpen, setCsvPreviewOpen] = useState(false);
  const [csvItems, setCsvItems] = useState<{
    categoryName: string;
    name: string;
    description: string;
    price: number;
    type: ProductType;
    unit: string;
    stock: number;
    controlStock: boolean;
    loyaltyEligible: boolean;
    image: string;
    action: 'create_product' | 'update_product';
    productId?: string;
    categoryId?: string;
  }[]>([]);
  const [csvNewCategories, setCsvNewCategories] = useState<string[]>([]);
  const [csvStats, setCsvStats] = useState({ newProds: 0, updateProds: 0, newCats: 0 });

  const handleCSVFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) return;

        let cleanText = content.replace(/^\uFEFF/, '');
        const lines = cleanText.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) {
          toast.error('O arquivo CSV parece estar vazio ou não possui cabeçalho.');
          return;
        }

        const headerLine = lines[0];
        const semiCount = (headerLine.match(/;/g) || []).length;
        const commaCount = (headerLine.match(/,/g) || []).length;
        const delimiter = semiCount >= commaCount ? ';' : ',';

        const splitLine = (line: string): string[] => {
          const res: string[] = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
              res.push(cur.trim());
              cur = '';
            } else {
              cur += char;
            }
          }
          res.push(cur.trim());
          return res.map(s => s.replace(/^"|"$/g, '').trim());
        };

        const rawHeaders = splitLine(lines[0]);
        const headers = rawHeaders.map(h =>
          h.toLowerCase()
           .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
           .replace(/\s+/g, "_")
        );

        const existingCatMap = new Map<string, string>();
        categories.forEach(c => existingCatMap.set(c.name.toLowerCase().trim(), c.id));

        const existingProdMap = new Map<string, Product>();
        products.forEach(p => existingProdMap.set(p.name.toLowerCase().trim(), p));

        const newCategoriesSet = new Set<string>();
        const parsedItems: typeof csvItems = [];
        let newProdsCount = 0;
        let updateProdsCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const cols = splitLine(lines[i]);
          if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

          const row: Record<string, string> = {};
          headers.forEach((h, idx) => {
            row[h] = cols[idx] || '';
          });

          const categoryName = (row['categoria'] || row['category'] || row['cat'] || 'Geral').trim();
          const productName = (row['produto'] || row['product'] || row['nome'] || row['name'] || '').trim();
          if (!productName) continue;

          const description = (row['descricao'] || row['description'] || row['detalhes'] || '').trim();
          const priceStr = (row['preco'] || row['price'] || row['valor'] || '0').replace(',', '.');
          const price = parseFloat(priceStr) || 0;

          const rawType = (row['tipo'] || row['type'] || '').toLowerCase();
          const type: ProductType = (rawType.includes('weight') || rawType.includes('peso') || rawType === 'kg') ? 'weight' : 'unit';

          const unit = (row['unidade'] || row['unit'] || (type === 'weight' ? 'kg' : 'un')).trim();

          const stockStr = (row['estoque'] || row['stock'] || row['qtd'] || '0').replace(',', '.');
          const stock = parseFloat(stockStr) || 0;

          const rawControlStock = (row['controla_estoque'] || row['control_stock'] || 'SIM').trim();
          const controlStock = !/^(nao|não|n|false|0)$/i.test(rawControlStock);

          const rawLoyalty = (row['fidelidade'] || row['loyalty'] || row['fidelidade_elegivel'] || 'NAO').trim();
          const loyaltyEligible = /^(sim|s|true|1)$/i.test(rawLoyalty);

          const image = (row['imagem_url'] || row['imagem'] || row['image'] || row['image_url'] || '').trim();

          const lowerCat = categoryName.toLowerCase();
          if (!existingCatMap.has(lowerCat)) {
            newCategoriesSet.add(categoryName);
          }

          const lowerProd = productName.toLowerCase();
          const existingProd = existingProdMap.get(lowerProd);

          if (existingProd) {
            updateProdsCount++;
            parsedItems.push({
              categoryName,
              name: productName,
              description,
              price,
              type,
              unit,
              stock,
              controlStock,
              loyaltyEligible,
              image,
              action: 'update_product',
              productId: existingProd.id,
              categoryId: existingProd.categoryId,
            });
          } else {
            newProdsCount++;
            parsedItems.push({
              categoryName,
              name: productName,
              description,
              price,
              type,
              unit,
              stock,
              controlStock,
              loyaltyEligible,
              image,
              action: 'create_product',
            });
          }
        }

        if (parsedItems.length === 0) {
          toast.error('Nenhum produto válido encontrado no arquivo CSV.');
          return;
        }

        setCsvItems(parsedItems);
        const newCatsList = Array.from(newCategoriesSet);
        setCsvNewCategories(newCatsList);
        setCsvStats({
          newProds: newProdsCount,
          updateProds: updateProdsCount,
          newCats: newCatsList.length,
        });
        setCsvPreviewOpen(true);
      } catch (err) {
        console.error(err);
        toast.error('Erro ao processar o arquivo CSV.');
      } finally {
        if (e.target) e.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  const handleConfirmCSVImport = () => {
    try {
      const updatedCategories = [...categories];
      const catNameToIdMap = new Map<string, string>();

      updatedCategories.forEach(c => catNameToIdMap.set(c.name.toLowerCase().trim(), c.id));

      csvNewCategories.forEach(catName => {
        const newCatId = crypto.randomUUID();
        const newCat: ProductCategory = { id: newCatId, name: catName };
        updatedCategories.push(newCat);
        catNameToIdMap.set(catName.toLowerCase().trim(), newCatId);
      });

      if (csvNewCategories.length > 0) {
        setCategories(updatedCategories);
      }

      const updatedProducts = [...products];

      csvItems.forEach(item => {
        const catId = catNameToIdMap.get(item.categoryName.toLowerCase().trim()) || updatedCategories[0]?.id || '';

        if (item.action === 'update_product' && item.productId) {
          const idx = updatedProducts.findIndex(p => p.id === item.productId);
          if (idx !== -1) {
            updatedProducts[idx] = {
              ...updatedProducts[idx],
              name: item.name,
              description: item.description || updatedProducts[idx].description,
              price: item.price,
              categoryId: catId,
              type: item.type,
              unit: item.unit,
              stock: item.stock,
              controlStock: item.controlStock,
              loyaltyEligible: item.loyaltyEligible,
              image: item.image || updatedProducts[idx].image,
            };
          }
        } else {
          const newProduct: Product = {
            id: crypto.randomUUID(),
            name: item.name,
            description: item.description,
            price: item.price,
            categoryId: catId,
            type: item.type,
            unit: item.unit,
            stock: item.stock,
            controlStock: item.controlStock,
            loyaltyEligible: item.loyaltyEligible,
            image: item.image,
          };
          updatedProducts.push(newProduct);
        }
      });

      setProducts(updatedProducts);

      toast.success(`Importação concluída! ${csvStats.newProds} novos produtos, ${csvStats.updateProds} atualizados e ${csvStats.newCats} novas categorias.`);
      setCsvPreviewOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Ocorreu um erro ao salvar a importação.');
    }
  };

  const downloadCSVModel = () => {
    const content = `\uFEFFcategoria;produto;descricao;preco;tipo;unidade;estoque;controla_estoque;fidelidade;imagem_url
Bebidas;Coca-Cola 2L;Refrigerante garrafa 2 Litros;12.50;unit;un;50;SIM;SIM;https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500
Bebidas;Suco de Laranja 500ml;Suco natural de laranja sem açúcar;8.00;unit;un;30;SIM;NAO;
Lanches;X-Salada Especial;Hambúrguer artesanal 150g com queijo e salada;24.90;unit;un;0;NAO;SIM;
Porções;Batata Frita Tradicional;Porção de 500g de batata frita;25.00;unit;un;100;SIM;NAO;
Sobremesas;Pudim de Leite Condensado;Fatia de pudim de leite condensado;9.90;unit;un;25;SIM;NAO;
Hortifruti / KG;Queijo Muçarela (KG);Queijo muçarela fatiado (venda por peso);45.00;weight;kg;12.5;SIM;NAO;`;

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_importacao_produtos_categorias.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      loyaltyEligible: p.loyaltyEligible,
      controlStock: p.controlStock,
      supplierId: p.supplierId || '',
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
      return;
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
      loyaltyEligible: form.loyaltyEligible,
      controlStock: form.controlStock,
      supplierId: form.supplierId || undefined,
    };
    if (editingId) {
      setProducts(prev => prev.map(p => p.id === editingId ? product : p));
      
    } else {
      setProducts(prev => [...prev, product]);
      
    }
    setDialogOpen(false);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    setProducts(prev => prev.filter(p => p.id !== deleteId));
    
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
      return;
      return;
    }
    const cat: ProductCategory = {
      id: editingCatId || crypto.randomUUID(),
      name: catForm.name.trim(),
    };
    if (editingCatId) {
      setCategories(prev => prev.map(c => c.id === editingCatId ? cat : c));
      
    } else {
      setCategories(prev => [...prev, cat]);
      
    }
    setCatDialogOpen(false);
  };

  const confirmDeleteCat = () => {
    if (!deleteCatId) return;
    const hasProducts = products.some(p => p.categoryId === deleteCatId);
    if (hasProducts) {
      setCatDeleteOpen(false);
      setCatDeleteOpen(false);
      return;
    }
    setCategories(prev => prev.filter(c => c.id !== deleteCatId));
    if (filterCategory === deleteCatId) setFilterCategory('all');
    
    setCatDeleteOpen(false);
    setCatDeleteOpen(false);
    setDeleteCatId(null);
  };

  // ---- NoteOption CRUD ----
  const openCreateOpt = () => {
    setEditingOptId(null);
    setOptForm(emptyNoteOptionForm);
    setOptFormOpen(true);
  };

  const openEditOpt = (opt: ProductNoteOption) => {
    setEditingOptId(opt.id);
    setOptForm({
      name: opt.name,
      type: opt.type,
      price: String(opt.price),
      categoryIds: opt.categoryIds,
      active: opt.active,
    });
    setOptFormOpen(true);
  };

  const deleteOpt = (id: string) => {
    if (confirm('Deseja excluir esta opção?')) {
      setNoteOptions(prev => prev.filter(o => o.id !== id));
    }
  };

  const saveOpt = () => {
    if (!optForm.name.trim() || optForm.categoryIds.length === 0) return;
    const opt: ProductNoteOption = {
      id: editingOptId || crypto.randomUUID(),
      name: optForm.name.trim(),
      type: optForm.type,
      price: parseFloat(optForm.price) || 0,
      categoryIds: optForm.categoryIds,
      active: optForm.active,
    };
    if (editingOptId) {
      setNoteOptions(prev => prev.map(o => o.id === editingOptId ? opt : o));
    } else {
      setNoteOptions(prev => [...prev, opt]);
    }
    setOptFormOpen(false);
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
        <div className="flex flex-wrap gap-2">
          {ENABLE_CSV_IMPORT && (
            <>
              <Button variant="outline" onClick={downloadCSVModel} title="Baixar arquivo modelo .CSV">
                <Download className="h-4 w-4 mr-2 text-muted-foreground" /> Modelo CSV
              </Button>
              <Button variant="outline" onClick={() => csvInputRef.current?.click()} title="Importar categorias e produtos de arquivo CSV">
                <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600 dark:text-emerald-400" /> Importar CSV
              </Button>
              <input
                type="file"
                ref={csvInputRef}
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleCSVFileSelect}
              />
            </>
          )}
          <Button variant="outline" onClick={() => { setOptsDialogOpen(true); }}>
            <Tag className="h-4 w-4 mr-2" /> Obs & Complementos
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

      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
        {filtered.map(product => {
          const cat = getCat(product.categoryId);
          return (
            <div key={product.id} className="bg-card rounded-[16px] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)] transition-all flex flex-col border border-border h-full w-full group relative">
              {/* Image area - Full width top header */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-50 dark:bg-zinc-900/60 shrink-0 p-2 flex items-center justify-center">
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-full object-contain object-center transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/5">
                    <span className="text-4xl opacity-30 font-bold text-muted-foreground">
                      {cat?.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <Button variant="secondary" size="icon" className="h-8 w-8 shadow-md" onClick={() => openEdit(product)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="destructive" size="icon" className="h-8 w-8 shadow-md" onClick={() => openDelete(product.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Info */}
              <div className="p-3 flex flex-col flex-1 justify-between">
                <div>
                  <h3 className="font-semibold text-[13px] leading-tight text-foreground line-clamp-2 mb-1" title={product.name}>
                    {product.name}
                  </h3>
                  <p className="text-[#4CAF50] dark:text-emerald-400 font-bold text-[14px]">
                    R$ {fmt(product.price)}
                    {product.type === 'weight' && <span className="text-[10px] font-medium text-muted-foreground ml-1">/kg</span>}
                  </p>
                </div>

                <div className="flex items-center pt-2 flex-wrap gap-1 mt-auto">
                  <Badge variant="outline" className="text-[10px]">
                    {cat ? cat.name : 'Sem categoria'}
                  </Badge>
                  {product.loyaltyEligible && (
                    <Badge variant="secondary" className="text-[10px] bg-success/10 text-success dark:bg-success/30 dark:text-success">
                      ⭐ Fidelidade
                    </Badge>
                  )}
                  {product.controlStock && (
                    <Badge variant={product.stock <= 5 ? 'destructive' : 'secondary'} className="text-[9px] px-1">
                      {product.stock} {product.unit}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
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
                <div className="relative mt-2 rounded-lg overflow-hidden aspect-video bg-slate-50 dark:bg-zinc-900/60 p-2 flex items-center justify-center">
                  <img src={form.image} alt="Preview" className="w-full h-full object-contain object-center" />
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
            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.controlStock}
                  onChange={e => setForm(f => ({ ...f, controlStock: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm">Controlar Estoque</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.loyaltyEligible}
                  onChange={e => setForm(f => ({ ...f, loyaltyEligible: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm">⭐ Elegível para pontuação fidelidade</span>
              </label>
            </div>

            {/* Supplier field */}
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

      {/* NoteOptions Manager Dialog */}
      <Dialog open={optsDialogOpen} onOpenChange={setOptsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0 flex flex-row items-center justify-between">
          <DialogTitle>Observações e Complementos</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-2 shrink-0">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditingOptId(null); setOptForm({...emptyNoteOptionForm, type: 'note'}); setOptFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova Observação
            </Button>
            <Button size="sm" onClick={() => { setEditingOptId(null); setOptForm({...emptyNoteOptionForm, type: 'complement'}); setOptFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo Complemento
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

            {/* Complementos */}
            <div>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 px-1 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                Complementos Pagos ({noteOptions.filter(o => o.type === 'complement').length})
              </h3>
              {noteOptions.filter(o => o.type === 'complement').length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">Nenhum complemento cadastrado.</p>
              ) : (
                <div className="grid gap-2">
                  {noteOptions.filter(o => o.type === 'complement').map(opt => (
                    <div key={opt.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="default">Complemento</Badge>
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

      {/* NoteOption Create/Edit Form Dialog */}
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
                <span>Complemento Pago</span>
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
                  <Input type="number" step="0.01" value={optForm.price} onChange={e => setOptForm(f => ({ ...f, price: e.target.value }))} />
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

      {/* New Supplier Inline Modal */}
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

      {/* CSV Import Preview Modal */}
      {ENABLE_CSV_IMPORT && (
        <Dialog open={csvPreviewOpen} onOpenChange={setCsvPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Confirmar Importação CSV
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1 my-2">
              {/* Action Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
                  <span className="block text-2xl font-bold text-emerald-600 dark:text-emerald-400">{csvStats.newProds}</span>
                  <span className="text-xs text-muted-foreground font-medium">Novos Produtos</span>
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                  <span className="block text-2xl font-bold text-amber-600 dark:text-amber-400">{csvStats.updateProds}</span>
                  <span className="text-xs text-muted-foreground font-medium">Produtos a Atualizar</span>
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
                  <span className="block text-2xl font-bold text-blue-600 dark:text-blue-400">{csvStats.newCats}</span>
                  <span className="text-xs text-muted-foreground font-medium">Novas Categorias</span>
                </div>
              </div>

              {csvNewCategories.length > 0 && (
                <div className="bg-muted/50 p-3 rounded-lg border text-sm space-y-1">
                  <span className="font-semibold text-foreground">Novas Categorias que serão criadas:</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {csvNewCategories.map(cat => (
                      <Badge key={cat} variant="secondary" className="bg-blue-500/15 text-blue-700 dark:text-blue-300">
                        + {cat}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Table Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Lista de Produtos para Importação ({csvItems.length} itens):</h4>
                </div>
                <div className="border rounded-md overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted text-muted-foreground sticky top-0 border-b">
                      <tr>
                        <th className="p-2">Ação</th>
                        <th className="p-2">Categoria</th>
                        <th className="p-2">Produto</th>
                        <th className="p-2">Preço</th>
                        <th className="p-2">Estoque</th>
                        <th className="p-2">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {csvItems.map((item, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="p-2">
                            {item.action === 'create_product' ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Criar</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">Atualizar</Badge>
                            )}
                          </td>
                          <td className="p-2 font-medium">{item.categoryName}</td>
                          <td className="p-2 font-semibold">{item.name}</td>
                          <td className="p-2 font-mono">{fmt(item.price)}</td>
                          <td className="p-2">{item.stock} {item.unit}</td>
                          <td className="p-2">{item.type === 'weight' ? 'Peso (Kg)' : 'Unidade'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t">
              <Button variant="outline" className="flex-1" onClick={() => setCsvPreviewOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleConfirmCSVImport}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar Importação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Produtos;
