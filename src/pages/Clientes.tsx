import React, { useState } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { fmt, maskPhone } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Customer } from '@/types';
import { Plus, Search, Phone, MapPin, FileText, Star, Pencil, Trash2 } from 'lucide-react';


const Clientes = () => {
  const { customers, setCustomers } = useStore();
  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' });

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', phone: '', address: '', notes: '' });
    setEditOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, address: c.address, notes: c.notes });
    setEditOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) { return; }
    if (editing) {
      setCustomers(prev => prev.map(c => c.id === editing.id ? { ...c, ...form } : c));
      
    } else {
      setCustomers(prev => [...prev, { id: crypto.randomUUID(), ...form, creditBalance: 0, loyaltyPoints: 0 }]);
      
    }
    setEditOpen(false);
  };

  const openDelete = (id: string) => {
    setDeletingId(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deletingId) {
      setCustomers(prev => prev.filter(c => c.id !== deletingId));
    }
    setDeleteConfirmOpen(false);
    setDeletingId(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
        <Button onClick={openNew} className="h-11">
          <Plus className="h-4 w-4 mr-2" /> Novo Cliente
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou telefone..." className="pl-10 h-11" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Fidelidade / Débito</TableHead>
                <TableHead className="w-[100px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground whitespace-nowrap">
                      <Phone className="h-3.5 w-3.5" /> {c.phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-muted-foreground">
                      <span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0" /> {c.address || '-'}</span>
                      {c.notes && <span className="flex items-center gap-2 text-xs"><FileText className="h-3.5 w-3.5 shrink-0" /> {c.notes}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      <div className="flex items-center gap-1.5">
                        <Star className="h-3.5 w-3.5 text-warning-foreground" />
                        <span className="font-semibold text-warning-foreground text-xs">{c.loyaltyPoints || 0} pontos</span>
                        {(c.loyaltyPoints || 0) >= 10 && (
                          <Badge className="bg-success/10 text-success hover:bg-success/10 text-[10px] px-1 py-0 h-4">
                            {Math.floor((c.loyaltyPoints || 0) / 10)} resgate(s)
                          </Badge>
                        )}
                      </div>
                      {c.creditBalance > 0 && (
                        <span className="text-destructive font-semibold text-xs whitespace-nowrap">Débito: R$ {fmt(c.creditBalance)}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => openDelete(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} /></div>
            <div><Label>Endereço</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div><Label>Observações</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            {editing && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <Star className="h-4 w-4 text-warning-foreground" />
                <span className="text-sm font-medium">Pontos de Fidelidade:</span>
                <span className="text-sm font-bold text-warning-foreground">{editing.loyaltyPoints || 0}</span>
                {(editing.loyaltyPoints || 0) >= 10 && (
                  <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-medium ml-auto">
                    {Math.floor((editing.loyaltyPoints || 0) / 10)} resgate(s) disponível(is)
                  </span>
                )}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente este cliente? Todo o histórico de fidelidade e eventuais débitos associados a ele serão perdidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Clientes;
