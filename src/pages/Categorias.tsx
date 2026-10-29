import React, { useState } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { usePrinter } from '@/hooks/use-printer';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { sectorLabel, buildSectorOptions, PRINT_SECTOR_OPTIONS } from '@/lib/print-sectors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Layers, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Search, UtensilsCrossed, Printer, AlertTriangle, ExternalLink, X
} from 'lucide-react';
import { toast } from 'sonner';
import type { ProductCategory } from '@/types';

const emptyCategoryForm = {
  name: '',
  printSector: 'cozinha',
};

const Categorias = () => {
  const { categories, setCategories, products } = useStore();
  const { printers } = usePrinter();
  const navigate = useTenantNavigate();
  const sectorOptions = buildSectorOptions(printers);

  // Estados locais
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyCategoryForm);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductCategory | null>(null);

  // Busca e filtragem
  const normalize = (s?: string | null) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const q = normalize(search.trim());
  const filteredCategories = categories.filter(c => !q || normalize(c.name).includes(q));

  // Contagem de produtos por categoria
  const getProductCount = (categoryId: string) => {
    return products.filter(p => p.categoryId === categoryId).length;
  };

  // Reordenação
  const moveCategory = (indexInFiltered: number, direction: 'up' | 'down') => {
    const currentCat = filteredCategories[indexInFiltered];
    if (!currentCat) return;

    const originalIndex = categories.findIndex(c => c.id === currentCat.id);
    if (originalIndex === -1) return;

    const targetIndex = direction === 'up' ? originalIndex - 1 : originalIndex + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const nextCategories = [...categories];
    const [removed] = nextCategories.splice(originalIndex, 1);
    nextCategories.splice(targetIndex, 0, removed);

    setCategories(nextCategories);
    toast.success(`Categoria "${currentCat.name}" reordenada.`);
  };

  // Criação e Edição
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyCategoryForm);
    setDialogOpen(true);
  };

  const openEdit = (cat: ProductCategory) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      printSector: cat.printSector || 'cozinha',
    });
    setDialogOpen(true);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const catName = form.name.trim();

    if (!catName) {
      toast.error('Informe o nome da categoria.');
      return;
    }

    const duplicate = categories.some(
      c => c.name.toLowerCase() === catName.toLowerCase() && c.id !== editingId
    );
    if (duplicate) {
      toast.error(`A categoria "${catName}" já existe.`);
      return;
    }

    if (editingId) {
      setCategories(prev =>
        prev.map(c =>
          c.id === editingId
            ? { ...c, name: catName, printSector: form.printSector || 'cozinha' }
            : c
        )
      );
      toast.success(`Categoria "${catName}" atualizada com sucesso!`);
    } else {
      const newCategory: ProductCategory = {
        id: crypto.randomUUID(),
        name: catName,
        printSector: form.printSector || 'cozinha',
      };
      setCategories(prev => [...prev, newCategory]);
      toast.success(`Categoria "${catName}" criada com sucesso!`);
    }

    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyCategoryForm);
  };

  // Exclusão
  const openDelete = (cat: ProductCategory) => {
    setDeleteTarget(cat);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;

    const count = getProductCount(deleteTarget.id);
    if (count > 0) {
      toast.error(`Esta categoria possui ${count} produto(s) vinculado(s) e não pode ser excluída.`);
      return;
    }

    setCategories(prev => prev.filter(c => c.id !== deleteTarget.id));
    toast.success(`Categoria "${deleteTarget.name}" excluída.`);
    setDeleteOpen(false);
    setDeleteTarget(null);
  };

  // Estatísticas
  const totalCategories = categories.length;
  const categoriesWithProducts = categories.filter(c => getProductCount(c.id) > 0).length;
  const totalProducts = products.length;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Categorias do Cardápio</h1>
              <p className="text-sm text-muted-foreground">
                Defina a ordem das categorias no cardápio e vincule o setor de impressão de cada uma.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/produtos')} className="gap-2">
            <UtensilsCrossed className="h-4 w-4" />
            Ver Produtos ({totalProducts})
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Categoria
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase">Total de Categorias</p>
          <p className="text-2xl font-bold text-foreground mt-1">{totalCategories}</p>
          <p className="text-xs text-muted-foreground mt-1">Categorias ativas no sistema</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase">Com Produtos Cadastrados</p>
          <p className="text-2xl font-bold text-foreground mt-1">{categoriesWithProducts}</p>
          <p className="text-xs text-muted-foreground mt-1">Categorias com pelo menos 1 item</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase">Total de Produtos</p>
          <p className="text-2xl font-bold text-primary mt-1">{totalProducts}</p>
          <p className="text-xs text-muted-foreground mt-1">Itens distribuídos no cardápio</p>
        </div>
      </div>

      {/* Search and List */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar categoria por nome..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-9"
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

          <p className="text-xs text-muted-foreground self-start sm:self-auto">
            {filteredCategories.length} {filteredCategories.length === 1 ? 'categoria listada' : 'categorias listadas'}
          </p>
        </div>

        {/* Tabela de Categorias */}
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b bg-muted/60 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="w-20 px-4 py-3 text-center">Ordem</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="w-64 px-4 py-3">Setor de Impressão</th>
                  <th className="w-36 px-4 py-3 text-center">Produtos</th>
                  <th className="w-28 px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCategories.map((category, index) => {
                  const productCount = getProductCount(category.id);
                  const isFirst = index === 0;
                  const isLast = index === filteredCategories.length - 1;
                  const sector = category.printSector || 'cozinha';

                  return (
                    <tr key={category.id} className="transition-colors hover:bg-muted/30">
                      {/* Reordenação */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                            disabled={isFirst || search.trim().length > 0}
                            title={search ? 'Limpe a busca para reordenar' : 'Mover para cima'}
                            onClick={() => moveCategory(index, 'up')}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                            disabled={isLast || search.trim().length > 0}
                            title={search ? 'Limpe a busca para reordenar' : 'Mover para baixo'}
                            onClick={() => moveCategory(index, 'down')}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>

                      {/* Nome */}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openEdit(category)}
                          className="font-semibold text-foreground hover:text-primary transition-colors text-left"
                        >
                          {category.name}
                        </button>
                      </td>

                      {/* Setor de Impressão */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Printer className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                          <span className="text-xs">
                            {sector === 'none' ? 'Não imprimir comanda' : sectorLabel(sector)}
                          </span>
                        </div>
                      </td>

                      {/* Produtos Vinculados */}
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 font-medium hover:bg-muted"
                          onClick={() => navigate(`/produtos?categoria=${category.id}`)}
                          title="Clique para filtrar produtos desta categoria"
                        >
                          <Badge variant={productCount > 0 ? 'secondary' : 'outline'} className="text-[11px] font-semibold">
                            {productCount} {productCount === 1 ? 'item' : 'itens'}
                          </Badge>
                          <ExternalLink className="h-3 w-3 opacity-60 ml-0.5" />
                        </Button>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Editar categoria ${category.name}`}
                            title="Editar categoria"
                            onClick={() => openEdit(category)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            aria-label={`Excluir categoria ${category.name}`}
                            title="Excluir categoria"
                            onClick={() => openDelete(category)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredCategories.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <Layers className="h-8 w-8 opacity-40" />
              <p className="font-medium">
                {search.trim() ? `Nenhuma categoria encontrada para "${search.trim()}".` : 'Nenhuma categoria cadastrada.'}
              </p>
              {search.trim() ? (
                <Button variant="link" size="sm" onClick={() => setSearch('')}>
                  Limpar busca
                </Button>
              ) : (
                <Button size="sm" onClick={openCreate} className="mt-2">
                  <Plus className="h-4 w-4 mr-1" /> Criar primeira categoria
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Criação / Edição de Categoria */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={save} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="category-name">Nome da Categoria *</Label>
              <Input
                id="category-name"
                autoFocus
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Lanches, Bebidas, Pizzas..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category-sector">Setor de Impressão Padrão</Label>
              <select
                id="category-sector"
                className="w-full h-10 rounded-md border bg-background px-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                value={form.printSector}
                onChange={e => setForm(f => ({ ...f, printSector: e.target.value }))}
              >
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
                <option value="none">Não imprimir comandas</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                Os produtos cadastrados nesta categoria utilizarão este setor por padrão, a menos que especificado individualmente.
              </p>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingId ? 'Salvar Alterações' : 'Cadastrar Categoria'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir Categoria
            </DialogTitle>
          </DialogHeader>

          {deleteTarget && (
            <div className="space-y-3 pt-1">
              {getProductCount(deleteTarget.id) > 0 ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground space-y-2">
                  <p className="font-semibold text-destructive">
                    Não é possível excluir esta categoria!
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A categoria <strong>{deleteTarget.name}</strong> possui{' '}
                    <strong>{getProductCount(deleteTarget.id)} produto(s)</strong> vinculado(s).
                    Reatribua ou exclua os produtos antes de remover esta categoria.
                  </p>
                  <div className="pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDeleteOpen(false);
                        navigate(`/produtos?categoria=${deleteTarget.id}`);
                      }}
                      className="text-xs gap-1"
                    >
                      <UtensilsCrossed className="h-3.5 w-3.5" />
                      Ver os produtos vinculados
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tem certeza que deseja excluir a categoria <strong>{deleteTarget.name}</strong>? Esta ação não pode ser desfeita.
                </p>
              )}

              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                  Cancelar
                </Button>
                {getProductCount(deleteTarget.id) === 0 && (
                  <Button variant="destructive" onClick={confirmDelete}>
                    Confirmar Exclusão
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Categorias;
