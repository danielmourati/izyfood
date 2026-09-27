import React, { useState, useRef } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { fmt } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Plus, Pencil, Trash2, Upload, X, Search, Tag, Building2, 
  FileSpreadsheet, Download, CheckCircle2, LayoutList, LayoutGrid,
  FolderTree, Package, Check, Layers, AlertCircle, Image as ImageIcon
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

  // Layout View mode: 'list' (linhas com thumbs - default) or 'grid' (cards)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Product state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProductForm);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  // Dedicated Category Management Modal state
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [catDeleteOpen, setCatDeleteOpen] = useState(false);

  // Dedicated NoteOption state
  const [optsDialogOpen, setOptsDialogOpen] = useState(false);
  const [optFormOpen, setOptFormOpen] = useState(false);
  const [editingOptId, setEditingOptId] = useState<string | null>(null);
  const [optForm, setOptForm] = useState(emptyNoteOptionForm);
  const [optsTab, setOptsTab] = useState<'all' | 'note' | 'complement'>('all');
  const [optsSearch, setOptsSearch] = useState('');

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
      toast.error('A imagem deve ter no máximo 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, image: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const save = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Informe o nome do produto.');
      return;
    }
    if (!form.price || isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0) {
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
  const handleAddCategory = () => {
    if (!newCatName.trim()) {
      toast.error('Informe o nome da categoria.');
      return;
    }
    const catName = newCatName.trim();
    if (categories.some(c => c.name.toLowerCase() === catName.toLowerCase())) {
      toast.error(`A categoria "${catName}" já existe.`);
      return;
    }
    const newCat: ProductCategory = {
      id: crypto.randomUUID(),
      name: catName,
    };
    setCategories(prev => [...prev, newCat]);
    toast.success(`Categoria "${catName}" criada com sucesso!`);
    setNewCatName('');
  };

  const startEditCategory = (cat: ProductCategory) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
  };

  const saveEditCategory = (id: string) => {
    if (!editingCatName.trim()) {
      toast.error('O nome da categoria não pode ficar em branco.');
      return;
    }
    const name = editingCatName.trim();
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c));
    toast.success('Categoria atualizada!');
    setEditingCatId(null);
    setEditingCatName('');
  };

  const openDeleteCat = (id: string) => {
    const hasProducts = products.some(p => p.categoryId === id);
    if (hasProducts) {
      const prodCount = products.filter(p => p.categoryId === id).length;
      toast.error(`Esta categoria possui ${prodCount} produto(s) vinculado(s). Reavalia a categoria deles antes de excluir.`);
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
      price: String(opt.price),
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
      price: optForm.type === 'complement' ? (parseFloat(optForm.price) || 0) : 0,
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

  const filteredNoteOptions = noteOptions.filter(opt => {
    const matchTab = optsTab === 'all' || opt.type === optsTab;
    const matchSearch = opt.name.toLowerCase().includes(optsSearch.toLowerCase());
    return matchTab && matchSearch;
  });

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Produtos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie o catálogo de produtos, categorias e complementos do seu estabelecimento.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

          {/* Modal Buttons */}
          <Button variant="outline" onClick={() => setOptsDialogOpen(true)} className="bg-card hover:bg-muted">
            <Tag className="h-4 w-4 mr-2 text-amber-500" /> Obs & Complementos
          </Button>

          <Button variant="outline" onClick={() => setCatManagerOpen(true)} className="bg-card hover:bg-muted">
            <FolderTree className="h-4 w-4 mr-2 text-indigo-500" /> Categorias ({categories.length})
          </Button>

          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
            <Plus className="h-4 w-4 mr-2" /> Novo Produto
          </Button>
        </div>
      </div>

      {/* Filters & View Switcher Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/70 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-2 flex-1">
          {/* Search input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar produto por nome..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-9 h-9 text-sm bg-background" 
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Categories Horizontal Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto py-1 max-w-full no-scrollbar">
            <Button 
              variant={filterCategory === 'all' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => setFilterCategory('all')}
              className="h-8 text-xs shrink-0 rounded-lg"
            >
              Todos ({products.length})
            </Button>
            {categories.map(cat => {
              const count = products.filter(p => p.categoryId === cat.id).length;
              const isSelected = filterCategory === cat.id;
              return (
                <Button
                  key={cat.id}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterCategory(cat.id)}
                  className={`h-8 text-xs shrink-0 rounded-lg whitespace-nowrap ${!isSelected ? 'bg-background hover:bg-muted' : ''}`}
                >
                  {cat.name}
                  <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {count}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Layout Switcher (Linhas/List x Grid) */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t md:border-t-0 pt-2 md:pt-0">
          <span className="text-xs text-muted-foreground font-medium">
            Exibindo <strong className="text-foreground">{filtered.length}</strong> de {products.length}
          </span>
          <div className="flex items-center p-1 bg-muted/60 rounded-lg border border-border/50">
            <button
              onClick={() => setViewMode('list')}
              title="Exibir em Linhas com Thumbnails (Lista)"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span>Linhas</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              title="Exibir em Cards (Grid)"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'grid'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Product List Render */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Nenhum produto encontrado</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Tente alterar os termos da busca ou selecionar outra categoria.
            </p>
          </div>
          {(search || filterCategory !== 'all') && (
            <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilterCategory('all'); }}>
              Limpar Filtros
            </Button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        /* LIST LAYOUT (LINHAS COM THUMBS DOS PRODUTOS) */
        <div className="space-y-2">
          {filtered.map(product => {
            const cat = getCat(product.categoryId);
            return (
              <div 
                key={product.id}
                className="group bg-card hover:bg-card/90 rounded-xl border border-border/80 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-150 hover:shadow-md hover:border-primary/30"
              >
                {/* Left section: Thumbnail & Product details */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Thumbnail */}
                  <div className="relative w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-zinc-800/80 border border-border/60 flex items-center justify-center p-1 group-hover:border-primary/40 transition-colors">
                    {product.image ? (
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-full h-full object-contain object-center transition-transform duration-200 group-hover:scale-105" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-lg md:text-xl rounded">
                        {cat?.name?.charAt(0)?.toUpperCase() || product.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Product Title & Info */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm md:text-base text-foreground leading-snug truncate" title={product.name}>
                        {product.name}
                      </h3>

                      {cat && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 font-normal bg-muted/30">
                          {cat.name}
                        </Badge>
                      )}

                      {product.loyaltyEligible && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                          ⭐ Fidelidade
                        </Badge>
                      )}
                    </div>

                    {product.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1" title={product.description}>
                        {product.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground pt-0.5">
                      {/* Stock badge */}
                      {product.controlStock ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[10px] ${
                          product.stock <= 0 
                            ? 'bg-destructive/10 text-destructive border border-destructive/20' 
                            : product.stock <= 5 
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20' 
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            product.stock <= 0 ? 'bg-destructive' : product.stock <= 5 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                          Estoque: {product.stock} {product.unit}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/70">
                          Estoque: ilimitado
                        </span>
                      )}

                      <span className="text-muted-foreground/40">•</span>
                      <span>Tipo: {product.type === 'weight' ? 'Venda por Peso (Kg)' : 'Unidade (un)'}</span>
                    </div>
                  </div>
                </div>

                {/* Right section: Price & Action Buttons */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-medium">Preço</span>
                    <span className="text-base md:text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                      R$ {fmt(product.price)}
                      {product.type === 'weight' && <span className="text-xs text-muted-foreground font-normal ml-0.5">/kg</span>}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 px-2.5 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                      onClick={() => openEdit(product)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">Editar</span>
                    </Button>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                      onClick={() => openDelete(product.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">Excluir</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* GRID LAYOUT (CARDS) */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
          {filtered.map(product => {
            const cat = getCat(product.categoryId);
            return (
              <div key={product.id} className="bg-card rounded-[16px] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)] transition-all flex flex-col border border-border h-full w-full group relative">
                {/* Image area */}
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
                    <p className="text-emerald-600 dark:text-emerald-400 font-bold text-[14px]">
                      R$ {fmt(product.price)}
                      {product.type === 'weight' && <span className="text-[10px] font-medium text-muted-foreground ml-1">/kg</span>}
                    </p>
                  </div>

                  <div className="flex items-center pt-2 flex-wrap gap-1 mt-auto">
                    <Badge variant="outline" className="text-[10px]">
                      {cat ? cat.name : 'Sem categoria'}
                    </Badge>
                    {product.loyaltyEligible && (
                      <Badge variant="secondary" className="text-[10px]">
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. DEDICATED CATEGORY MANAGEMENT MODAL */}
      {/* ========================================================================= */}
      <Dialog open={catManagerOpen} onOpenChange={setCatManagerOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b bg-card">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                <FolderTree className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Gerenciar Categorias</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Crie, edite ou exclua as categorias do seu menu de produtos.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Inline Add Category Bar */}
          <div className="p-4 bg-muted/30 border-b flex gap-2">
            <Input 
              placeholder="Digite o nome da nova categoria..." 
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }}
              className="bg-background h-9 text-sm"
            />
            <Button onClick={handleAddCategory} size="sm" className="h-9 px-4 shrink-0">
              <Plus className="h-4 w-4 mr-1" /> Criar
            </Button>
          </div>

          {/* Category List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {categories.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Nenhuma categoria cadastrada.
              </p>
            ) : (
              categories.map(cat => {
                const prodCount = products.filter(p => p.categoryId === cat.id).length;
                const isEditing = editingCatId === cat.id;

                return (
                  <div 
                    key={cat.id} 
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-card/90 transition-colors"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <Input 
                          value={editingCatName} 
                          onChange={e => setEditingCatName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEditCategory(cat.id); }}
                          autoFocus
                          className="h-8 text-sm bg-background"
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => saveEditCategory(cat.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingCatId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm text-foreground">{cat.name}</span>
                          <Badge variant="secondary" className="text-[11px] font-normal">
                            {prodCount} {prodCount === 1 ? 'produto' : 'produtos'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => startEditCategory(cat)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => openDeleteCat(cat.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 border-t bg-card text-right">
            <Button variant="outline" size="sm" onClick={() => setCatManagerOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Delete Confirmation Dialog */}
      <Dialog open={catDeleteOpen} onOpenChange={setCatDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Categoria</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir esta categoria? Esta ação não poderá ser desfeita.
          </p>
          <div className="flex gap-2 justify-end pt-3">
            <Button variant="outline" size="sm" onClick={() => setCatDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={confirmDeleteCat}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 2. DEDICATED OBS & COMPLEMENTS MANAGEMENT MODAL */}
      {/* ========================================================================= */}
      <Dialog open={optsDialogOpen} onOpenChange={setOptsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b bg-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">Observações e Complementos</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Cadastre opções livres (observações sem custo) e complementos pagos para seus produtos.
                  </DialogDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => openCreateOpt('note')} className="text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1 text-secondary-foreground" /> Nova Obs (Livre)
                </Button>
                <Button size="sm" onClick={() => openCreateOpt('complement')} className="text-xs bg-amber-600 hover:bg-amber-700 text-white">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Novo Complemento
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Modal Filter Controls */}
          <div className="p-4 bg-muted/30 border-b flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Buscar opção..." 
                value={optsSearch} 
                onChange={e => setOptsSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>

            <div className="flex items-center gap-1 bg-background p-1 rounded-lg border text-xs w-full sm:w-auto">
              <button
                onClick={() => setOptsTab('all')}
                className={`flex-1 sm:flex-none px-3 py-1 rounded-md transition-colors ${optsTab === 'all' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Todas ({noteOptions.length})
              </button>
              <button
                onClick={() => setOptsTab('note')}
                className={`flex-1 sm:flex-none px-3 py-1 rounded-md transition-colors ${optsTab === 'note' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Observações ({noteOptions.filter(o => o.type === 'note').length})
              </button>
              <button
                onClick={() => setOptsTab('complement')}
                className={`flex-1 sm:flex-none px-3 py-1 rounded-md transition-colors ${optsTab === 'complement' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Complementos ({noteOptions.filter(o => o.type === 'complement').length})
              </button>
            </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredNoteOptions.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground space-y-2 border border-dashed rounded-xl">
                <Tag className="h-8 w-8 mx-auto opacity-40" />
                <p className="text-sm">Nenhuma opção de observação ou complemento cadastrada.</p>
                <Button size="sm" variant="outline" onClick={() => openCreateOpt('note')}>
                  Cadastrar Primeira Opção
                </Button>
              </div>
            ) : (
              <div className="grid gap-2.5">
                {filteredNoteOptions.map(opt => (
                  <div 
                    key={opt.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border border-border/80 rounded-xl bg-card hover:border-primary/30 transition-all gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {opt.type === 'note' ? (
                          <Badge variant="secondary" className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                            Observação (Livre)
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                            Complemento (+ R$ {fmt(opt.price)})
                          </Badge>
                        )}
                        <span className="font-bold text-sm text-foreground">{opt.name}</span>
                        {!opt.active && (
                          <Badge variant="outline" className="text-[9px] text-destructive border-destructive/30">Inativo</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground pt-1">
                        <span className="text-[11px] font-medium text-muted-foreground/80">Categorias:</span>
                        {opt.categoryIds.length === categories.length ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/40">Todas as categorias</Badge>
                        ) : (
                          opt.categoryIds.map(cid => {
                            const cat = getCat(cid);
                            return cat ? (
                              <Badge key={cid} variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/40">
                                {cat.name}
                              </Badge>
                            ) : null;
                          })
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => openEditOpt(opt)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10" onClick={() => deleteOpt(opt.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t bg-card text-right">
            <Button variant="outline" size="sm" onClick={() => setOptsDialogOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* NoteOption Create/Edit Form Dialog */}
      <Dialog open={optFormOpen} onOpenChange={setOptFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingOptId ? 'Editar Opção' : 'Nova Opção'}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Preencha os detalhes da observação ou complemento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Type selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg border">
              <button
                type="button"
                onClick={() => setOptForm(f => ({ ...f, type: 'note' }))}
                className={`py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                  optForm.type === 'note' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                Observação Livre
              </button>
              <button
                type="button"
                onClick={() => setOptForm(f => ({ ...f, type: 'complement' }))}
                className={`py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                  optForm.type === 'complement' ? 'bg-background text-amber-600 dark:text-amber-400 shadow-sm' : 'text-muted-foreground'
                }`}
              >
                Complemento Pago
              </button>
            </div>

            <div>
              <Label className="text-xs font-semibold">Nome da Opção *</Label>
              <Input 
                value={optForm.name} 
                onChange={e => setOptForm(f => ({ ...f, name: e.target.value }))} 
                placeholder={optForm.type === 'note' ? 'Ex: Sem cebola, Ponto da carne...' : 'Ex: Bacon Extra, Queijo Triplo...'} 
                className="mt-1"
                autoFocus
              />
            </div>

            {optForm.type === 'complement' && (
              <div>
                <Label className="text-xs font-semibold">Preço Adicional (R$) *</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={optForm.price} 
                  onChange={e => setOptForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-semibold">Disponível para as Categorias: *</Label>
                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    className="text-[11px] text-primary hover:underline"
                    onClick={() => setOptForm(f => ({ ...f, categoryIds: categories.map(c => c.id) }))}
                  >
                    Marcar todas
                  </button>
                  <span className="text-muted-foreground text-[10px]">•</span>
                  <button 
                    type="button" 
                    className="text-[11px] text-muted-foreground hover:underline"
                    onClick={() => setOptForm(f => ({ ...f, categoryIds: [] }))}
                  >
                    Desmarcar
                  </button>
                </div>
              </div>
              <div className="max-h-44 overflow-y-auto border rounded-lg p-2.5 grid grid-cols-2 gap-2 bg-muted/20">
                {categories.map(cat => {
                  const checked = optForm.categoryIds.includes(cat.id);
                  return (
                    <label key={cat.id} className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded hover:bg-muted/60 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={checked}
                        onChange={e => {
                          const isChecked = e.target.checked;
                          setOptForm(f => ({
                            ...f, 
                            categoryIds: isChecked 
                              ? [...f.categoryIds, cat.id] 
                              : f.categoryIds.filter(id => id !== cat.id)
                          }));
                        }}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="truncate font-medium">{cat.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={optForm.active} 
                  onChange={e => setOptForm(f => ({ ...f, active: e.target.checked }))} 
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4" 
                />
                <span className="text-xs font-medium">Opção Ativa</span>
              </label>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setOptFormOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={saveOpt} disabled={!optForm.name.trim() || optForm.categoryIds.length === 0}>
                {editingOptId ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div>
              <Label>Foto do Produto</Label>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              {form.image ? (
                <div className="relative mt-2 rounded-lg overflow-hidden aspect-video bg-slate-50 dark:bg-zinc-900/60 p-2 flex items-center justify-center border">
                  <img src={form.image} alt="Preview" className="w-full h-full object-contain object-center" />
                  <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => setForm(f => ({ ...f, image: '' }))}>
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
              <Input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
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
            <div className="flex flex-col gap-2 pt-1">
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
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? 'Salvar' : 'Cadastrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Product Delete Confirmation */}
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
