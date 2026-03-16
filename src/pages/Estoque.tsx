import React, { useState } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { fmt } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import { Supplier, StockEntry } from '@/types';
import { toast } from '@/hooks/use-toast';

const Estoque = () => {
  const { products, setProducts, suppliers, setSuppliers, stockEntries, setStockEntries } = useStore();
  const [entryOpen, setEntryOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [entryForm, setEntryForm] = useState({ productId: '', quantity: '', supplierId: '' });
  const [supplierForm, setSupplierForm] = useState({ name: '', contact: '' });

  const addEntry = () => {
    const qty = parseFloat(entryForm.quantity);
    if (!entryForm.productId || !qty || !entryForm.supplierId) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    const entry: StockEntry = {
      id: crypto.randomUUID(),
      productId: entryForm.productId,
      quantity: qty,
      supplierId: entryForm.supplierId,
      date: new Date().toISOString(),
    };
    setStockEntries(prev => [...prev, entry]);
    setProducts(prev => prev.map(p => p.id === entryForm.productId ? { ...p, stock: p.stock + qty } : p));
    toast({ title: 'Entrada registrada' });
    setEntryForm({ productId: '', quantity: '', supplierId: '' });
    setEntryOpen(false);
  };

  const addSupplier = () => {
    if (!supplierForm.name.trim()) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    setSuppliers(prev => [...prev, { id: crypto.randomUUID(), ...supplierForm }]);
    toast({ title: 'Fornecedor cadastrado' });
    setSupplierForm({ name: '', contact: '' });
    setSupplierOpen(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 text-foreground">Estoque</h1>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
          <TabsTrigger value="entries">Entradas</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="capitalize">{p.category}</TableCell>
                    <TableCell>{p.type === 'weight' ? 'Peso' : 'Unidade'}</TableCell>
                    <TableCell>R$ {fmt(p.price)}{p.type === 'weight' ? '/kg' : ''}</TableCell>
                    <TableCell>
                      <Badge variant={p.stock <= 5 ? 'destructive' : 'secondary'}>
                        {p.stock} {p.unit}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button className="mt-4" onClick={() => setEntryOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Entrada
          </Button>
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Contato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.contact}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button className="mt-4" onClick={() => setSupplierOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Fornecedor
          </Button>
        </TabsContent>

        <TabsContent value="entries" className="mt-4">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockEntries.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sem entradas</TableCell></TableRow>
                ) : stockEntries.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>{products.find(p => p.id === e.productId)?.name || '-'}</TableCell>
                    <TableCell>{e.quantity}</TableCell>
                    <TableCell>{suppliers.find(s => s.id === e.supplierId)?.name || '-'}</TableCell>
                    <TableCell>{new Date(e.date).toLocaleString('pt-BR')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Stock Entry Dialog */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Entrada de Estoque</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Produto</Label>
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={entryForm.productId} onChange={e => setEntryForm(f => ({ ...f, productId: e.target.value }))}>
                <option value="">Selecionar...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><Label>Quantidade</Label><Input type="number" value={entryForm.quantity} onChange={e => setEntryForm(f => ({ ...f, quantity: e.target.value }))} /></div>
            <div>
              <Label>Fornecedor</Label>
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={entryForm.supplierId} onChange={e => setEntryForm(f => ({ ...f, supplierId: e.target.value }))}>
                <option value="">Selecionar...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEntryOpen(false)}>Cancelar</Button>
              <Button onClick={addEntry}>Registrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supplier Dialog */}
      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Fornecedor</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Contato</Label><Input value={supplierForm.contact} onChange={e => setSupplierForm(f => ({ ...f, contact: e.target.value }))} /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSupplierOpen(false)}>Cancelar</Button>
              <Button onClick={addSupplier}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Estoque;
