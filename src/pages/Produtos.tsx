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
import { Plus, Pencil, Trash2, Search, Building2, FileSpreadsheet, Download, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buildSectorOptions, sectorLabel } from '@/lib/print-sectors';
import { usePrinter } from '@/hooks/use-printer';
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

/** Flag para ativar/desativar botões e dialog de importação via CSV (Mudar para true quando desejar reativar) */
const ENABLE_CSV_IMPORT = false;

const Produtos = () => {
  const { products, setProducts, categories, setCategories, noteOptions, setNoteOptions, suppliers, setSuppliers } = useStore();
  const { printers } = usePrinter();
  const sectorOptions = buildSectorOptions(printers);

  // Product state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProductForm);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [catDeleteBlocked, setCatDeleteBlocked] = useState(false);

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
      price: String(p.price),
      categoryId: p.categoryId,
      type: p.type,
      unit: p.unit,
      stock: String(p.stock),
      loyaltyEligible: p.loyaltyEligible,
      controlStock: p.controlStock,
      supplierId: p.supplierId || '',
      searchCode: p.searchCode || '',
      costPrice: p.costPrice != null ? String(p.costPrice) : '',
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
      image: editingId ? products.find(p => p.id === editingId)?.image : undefined,
      loyaltyEligible: form.loyaltyEligible,
      controlStock: form.controlStock,
      supplierId: form.supplierId || undefined,
      searchCode: form.searchCode.trim() || undefined,
      costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
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

  const openDeleteCat = (id: string) => { setDeleteCatId(id); setCatDeleteOpen(true); };

  const saveCat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!catForm.name.trim()) {
      toast.error('Informe o nome da categoria.');
      return;
    }
    const catName = catForm.name.trim();
    const cat: ProductCategory = {
      id: editingCatId || crypto.randomUUID(),
      name: catName,
      printSector: catForm.printSector || 'cozinha',
    };
    if (editingCatId) {
      setCategories(prev => prev.map(c => c.id === editingCatId ? cat : c));
      toast.success(`Categoria "${catName}" atualizada com sucesso!`);
    } else {
      setCategories(prev => [...prev, cat]);
      toast.success(`Categoria "${catName}" cadastrada com sucesso!`);
    }
    setCatForm(emptyCategoryForm);
    setEditingCatId(null);
    setCatDialogOpen(false);
  };

  const confirmDeleteCat = () => {
    if (!deleteCatId) return;
    const hasProducts = products.some(p => p.categoryId === deleteCatId);
    if (hasProducts) {
      setCatDeleteBlocked(true);
      setCatDeleteOpen(false);
      setCatDeleteOpen(false);
      return;
    }
    setCatDeleteBlocked(false);
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

  const stockStatus = (p: Product) => {
    if (!p.controlStock) return { label: 'Não controlado', dot: 'bg-muted-foreground/40' };
    if (p.stock <= (p.minStock ?? 0)) return { label: 'Baixo', dot: 'bg-destructive' };
    return { label: 'Regular', dot: 'bg-primary' };
  };

  const groupedRows = groupByCategory
    ? [...categories.map(c => ({ cat: c as ProductCategory | undefined, items: filtered.filter(p => p.categoryId === c.id) })),
       { cat: undefined, items: filtered.filter(p => !getCat(p.categoryId)) }].filter(g => g.items.length > 0)
    : [{ cat: undefined, items: filtered }];

  const productSectorLabel = (p: Product) =>
    p.printSector ? sectorLabel(p.printSector) : `${sectorLabel(getCat(p.categoryId)?.printSector || 'cozinha')} (categoria)`;

  const OptList = ({ type }: { type: 'note' | 'complement' }) => {
    const list = noteOptions.filter(o => o.type === type);
    return (
      <div className="rounded-lg border bg-card flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          <div>
            <h3 className="font-semibold text-sm">{type === 'note' ? 'Observações' : 'Complementos'}</h3>
            <p className="text-xs text-muted-foreground">
              {type === 'note' ? 'Observações comuns para agilizar o lançamento dos pedidos.' : 'Adicionais cobrados para montar lanches, pratos ou bebidas.'}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { setEditingOptId(null); setOptForm({ ...emptyNoteOptionForm, type }); setOptFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              {type === 'complement' && <TableHead className="text-right">Valor</TableHead>}
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Nada cadastrado.</TableCell></TableRow>
            ) : list.map(opt => (
              <TableRow key={opt.id} className={!opt.active ? 'opacity-50' : ''}>
                <TableCell>
                  <div className="font-medium">{opt.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate max-w-[240px]">
                    {opt.categoryIds.map(cid => getCat(cid)?.name).filter(Boolean).join(', ')}
                  </div>
                </TableCell>
                {type === 'complement' && <TableCell className="text-right font-mono">{fmt(opt.price)}</TableCell>}
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditOpt(opt)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteOpt(opt.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

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

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
        {ENABLE_CSV_IMPORT && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadCSVModel}><Download className="h-4 w-4 mr-2" /> Modelo CSV</Button>
            <Button variant="outline" onClick={() => csvInputRef.current?.click()}><FileSpreadsheet className="h-4 w-4 mr-2" /> Importar CSV</Button>
            <input type="file" ref={csvInputRef} accept=".csv,text/csv" className="hidden" onChange={handleCSVFileSelect} />
          </div>
        )}
      </div>

      <Tabs defaultValue="produtos">
        <TabsList>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="obs">Observações e Complementos</TabsTrigger>
        </TabsList>

        {/* PRODUTOS */}
        <TabsContent value="produtos" className="mt-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou código..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={groupByCategory} onChange={e => setGroupByCategory(e.target.checked)} className="rounded border-border" />
              Agrupar por categoria
            </label>
            <div className="md:ml-auto flex gap-2">
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo Produto</Button>
            </div>
          </div>

          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Imprimir em</TableHead>
                  <TableHead className="text-right">Preço de Venda</TableHead>
                  <TableHead className="text-right">Est. Mínimo</TableHead>
                  <TableHead className="text-right">Estoque Atual</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum produto encontrado</TableCell></TableRow>
                )}
                {groupedRows.map((g, gi) => (
                  <React.Fragment key={g.cat?.id || `g${gi}`}>
                    {groupByCategory && (
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={8} className="font-semibold text-foreground py-2">
                          {g.cat?.name || 'Sem categoria'} <span className="text-xs font-normal text-muted-foreground">({g.items.length})</span>
                        </TableCell>
                      </TableRow>
                    )}
                    {g.items.map(p => {
                      const st = stockStatus(p);
                      return (
                        <TableRow key={p.id} className="cursor-pointer" onDoubleClick={() => openEdit(p)}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{p.searchCode || '-'}</TableCell>
                          <TableCell className="font-medium">
                            {p.name}
                            {p.loyaltyEligible && <span className="ml-1 text-[10px] text-muted-foreground">★</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{productSectorLabel(p)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(p.price)}{p.type === 'weight' ? '/kg' : ''}</TableCell>
                          <TableCell className="text-right font-mono">{p.controlStock ? fmt(p.minStock ?? 0) : '-'}</TableCell>
                          <TableCell className="text-right font-mono">{p.controlStock ? fmt(p.stock) : '-'}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-xs"><span className={`h-2.5 w-2.5 rounded-full ${st.dot}`} />{st.label}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => openDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">{filtered.length} produto(s)</p>
        </TabsContent>

        {/* CATEGORIAS */}
        <TabsContent value="categorias" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button onClick={openCreateCat}><Plus className="h-4 w-4 mr-2" /> Nova Categoria</Button>
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Impressora padrão</TableHead>
                  <TableHead className="text-right">Produtos</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma categoria</TableCell></TableRow>
                )}
                {categories.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{sectorLabel(c.printSector || 'cozinha')}</TableCell>
                    <TableCell className="text-right">{products.filter(p => p.categoryId === c.id).length}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCat(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => openDeleteCat(c.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {catDeleteBlocked && <p className="text-sm text-destructive">Esta categoria tem produtos vinculados e não pode ser excluída.</p>}
        </TabsContent>

        {/* OBSERVAÇÕES E COMPLEMENTOS */}
        <TabsContent value="obs" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <OptList type="note" />
            <OptList type="complement" />
          </div>
        </TabsContent>
      </Tabs>

      {/* Product Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? form.name || 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <Section title="Dados principais">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Código de busca</Label>
                  <Input value={form.searchCode} onChange={e => setForm(f => ({ ...f, searchCode: e.target.value }))} placeholder="Ex: 101" />
                </div>
                <div className="col-span-2">
                  <Label>Nome *</Label>
                  <Input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
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
                  <Input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                </div>
                <div>
                  <Label>Preço de custo (R$)</Label>
                  <Input type="number" step="0.01" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} />
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
                  {PRINT_SECTOR_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">Define em qual impressora a comanda deste item sai.</p>
              </div>
            </Section>

            <Section title="Estoque">
              <Check checked={form.controlStock} onChange={v => setForm(f => ({ ...f, controlStock: v }))} title="Estoque controlado" hint="controla o estoque deste item." />
              {form.controlStock && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Estoque mínimo</Label>
                    <Input type="number" value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Estoque atual</Label>
                    <Input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Fornecedor</Label>
                  <button type="button" onClick={() => { setSupplierForm({ name: '', contact: '' }); setNewSupplierOpen(true); }} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                    <Building2 className="h-3 w-3" /> Novo fornecedor
                  </button>
                </div>
                <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}>
                  <option value="">Nenhum</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.contact ? ` · ${s.contact}` : ''}</option>)}
                </select>
              </div>
            </Section>

            <div className="flex gap-2 justify-end pt-1">
              {editingId && (
                <Button type="button" variant="destructive" className="mr-auto" onClick={() => { setDialogOpen(false); openDelete(editingId); }}>Excluir</Button>
              )}
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Voltar</Button>
              <Button type="submit">Salvar</Button>
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

      {/* Category Create/Edit Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCatId ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveCat} className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input autoFocus value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Refrigerantes" />
            </div>
            <div>
              <Label>Impressora padrão</Label>
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={catForm.printSector} onChange={e => setCatForm(f => ({ ...f, printSector: e.target.value }))}>
                {PRINT_SECTOR_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">Os itens desta categoria saem nesta impressora, salvo se o produto indicar outra.</p>
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
