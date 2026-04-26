import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fmt } from '@/lib/utils';
import { Order, OrderType, DeliveryStatus, OrderSource } from '@/types';
import { toast } from 'sonner';

import { Plus, Phone, MapPin, User, Truck, Package, CheckCircle2, Clock, Search, ChevronRight, Bike, XCircle, Ban } from 'lucide-react';

const statusConfig: Record<DeliveryStatus, { label: string; color: string; icon: React.ElementType }> = {
  pendente: { label: 'Pendente', color: 'bg-warning text-warning-foreground', icon: Clock },
  pronto: { label: 'Pronto', color: 'bg-primary text-primary-foreground', icon: Package },
  finalizado: { label: 'Finalizado', color: 'bg-muted text-muted-foreground', icon: CheckCircle2 },
};

const orderSourceLabels: Record<OrderSource, string> = {
  ifood: '🟥 iFood',
  aiqfome: '🟪 AiqFome',
  whatsapp: '💬 WhatsApp',
  instagram: '📸 Instagram',
  telefone: '📞 Telefone',
  loja: '🏪 Loja',
  outro: '📋 Outro',
};

const Entregas = () => {
  const { orders, setOrders, customers } = useStore();
  const { user, isAdmin } = useAuth();
  const navigate = useTenantNavigate();
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'delivery' | 'retirada'>('delivery');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [motoboyName, setMotoboyName] = useState('');
  const [orderSource, setOrderSource] = useState<OrderSource>('whatsapp');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<DeliveryStatus | 'todos'>('todos');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const [statusDialogOrder, setStatusDialogOrder] = useState<Order | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // Retirada-specific fields
  const [pickupPerson, setPickupPerson] = useState('');
  const [productionTime, setProductionTime] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');
  // Cancel dialog state
  const [cancelDialogOrder, setCancelDialogOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    const s = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(s) || c.phone.includes(s)
    ).slice(0, 5);
  }, [customers, customerSearch]);

  const selectCustomer = (c: typeof customers[0]) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setCustomerAddress(c.address);
    setSelectedCustomerId(c.id);
    setCustomerSearch('');
    setShowCustomerDropdown(false);
  };

  const deliveryOrders = useMemo(() => {
    return orders
      .filter(o => (o.orderType === 'delivery' || o.orderType === 'retirada') && o.status !== 'cancelado')
      .filter(o => {
        if (filterStatus !== 'todos' && o.deliveryStatus !== filterStatus) return false;
        if (search) {
          const s = search.toLowerCase();
          return (
            o.customerName?.toLowerCase().includes(s) ||
            o.customerPhone?.includes(s) ||
            o.id.slice(0, 6).includes(s)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, filterStatus, search]);

  const handleCreateOrder = () => {
    if (!customerName.trim()) {
      return;
    }
    if (!customerPhone.trim()) {
      return;
    }
    if (selectedType === 'delivery' && !customerAddress.trim()) {
      return;
    }

    const fee = parseFloat(deliveryFee.replace(',', '.')) || 0;

    const newOrder: Order = {
      id: crypto.randomUUID(),
      items: [],
      total: 0,
      orderType: selectedType,
      status: 'aberto',
      customerId: selectedCustomerId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: selectedType === 'delivery' ? customerAddress.trim() : undefined,
      deliveryFee: selectedType === 'delivery' ? fee : 0,
      deliveryStatus: 'pendente',
      orderSource,
      motoboyName: motoboyName.trim() || undefined,
      pickupPerson: selectedType === 'retirada' ? pickupPerson.trim() || undefined : undefined,
      productionTime: selectedType === 'retirada' ? productionTime || undefined : undefined,
      pickupTime: selectedType === 'retirada' ? pickupTime || undefined : undefined,
      pickupNotes: selectedType === 'retirada' ? pickupNotes.trim() || undefined : undefined,
      createdAt: new Date().toISOString(),
    };

    setOrders(prev => [...prev, newOrder]);

    // Reset form
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setDeliveryFee('');
    setMotoboyName('');
    setOrderSource('whatsapp');
    setSelectedCustomerId(undefined);
    setCustomerSearch('');
    setPickupPerson('');
    setProductionTime('');
    setPickupTime('');
    setPickupNotes('');
    setNewOrderOpen(false);

    navigate(`/pdv?pedido=${newOrder.id}`);
  };

  const changeStatus = (orderId: string, newStatus: DeliveryStatus) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        deliveryStatus: newStatus,
        status: newStatus === 'finalizado' ? 'finalizado' as const : o.status === 'finalizado' ? 'aberto' as const : o.status,
        completedAt: newStatus === 'finalizado' ? new Date().toISOString() : undefined,
      };
    }));
    setStatusDialogOrder(null);
    
  };

  const updateOrderField = (orderId: string, field: 'motoboyName' | 'orderSource', value: string) => {
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, [field]: value } : o
    ));
  };

  const handleCancelOrder = async () => {
    if (!cancelDialogOrder) return;
    if (!cancelReason.trim()) {
      toast.error('Informe o motivo do cancelamento');
      return;
    }
    if (!adminEmail.trim() || !adminPassword.trim()) {
      toast.error('Informe email e senha do administrador');
      return;
    }

    setCancelLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-admin-password', {
        body: { email: adminEmail.trim(), password: adminPassword },
      });

      if (error || !data?.success) {
        toast.error(data?.error || 'Falha na verificação do administrador');
        setCancelLoading(false);
        return;
      }

      setOrders(prev => prev.map(o =>
        o.id === cancelDialogOrder.id ? {
          ...o,
          status: 'cancelado' as const,
          deliveryStatus: undefined,
          pickupNotes: `${o.pickupNotes ? o.pickupNotes + ' | ' : ''}CANCELADO: ${cancelReason.trim()}`,
        } : o
      ));

      toast.success(`Pedido #${cancelDialogOrder.id.slice(0, 6)} cancelado`);
      setCancelDialogOrder(null);
      setCancelReason('');
      setAdminEmail('');
      setAdminPassword('');
    } catch (err: any) {
      toast.error('Erro ao verificar credenciais');
    } finally {
      setCancelLoading(false);
    }
  };

  const pendingCount = orders.filter(o => (o.orderType === 'delivery' || o.orderType === 'retirada') && o.deliveryStatus === 'pendente').length;
  const readyCount = orders.filter(o => (o.orderType === 'delivery' || o.orderType === 'retirada') && o.deliveryStatus === 'pronto').length;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Delivery & Retirada</h1>
          <div className="flex gap-3 mt-1">
            {pendingCount > 0 && (
              <span className="text-sm text-warning font-medium">{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
            )}
            {readyCount > 0 && (
              <span className="text-sm text-primary font-medium">{readyCount} pronto{readyCount > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        <Button onClick={() => setNewOrderOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Pedido
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou código..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['todos', 'pendente', 'pronto', 'finalizado'] as const).map(s => (
            <Button
              key={s}
              variant={filterStatus === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus(s)}
              className="capitalize"
            >
              {s === 'todos' ? 'Todos' : statusConfig[s].label}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {deliveryOrders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Truck className="h-16 w-16 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Nenhum pedido encontrado</p>
          <p className="text-sm">Crie um novo pedido de delivery ou retirada</p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          {/* List header */}
          <div className="hidden sm:grid grid-cols-[2rem_7rem_1fr_6rem_7rem_auto] gap-3 px-4 py-2 bg-muted/50 border-b text-[11px] font-semibold uppercase text-muted-foreground tracking-wide">
            <span></span>
            <span>Pedido</span>
            <span>Cliente / Itens</span>
            <span className="text-center">Status</span>
            <span className="text-right">Total</span>
            <span className="text-right">Ações</span>
          </div>

          {deliveryOrders.map((order, idx) => {
            const ds = order.deliveryStatus || 'pendente';
            const cfg = statusConfig[ds];
            const StatusIcon = cfg.icon;
            const totalWithFee = order.total + (order.deliveryFee || 0);
            const time = new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const itemsSummary = order.items.length === 0
              ? 'Sem itens'
              : order.items.slice(0, 2).map(i => `${i.quantity}× ${i.name}`).join(', ') + (order.items.length > 2 ? ` +${order.items.length - 2}` : '');

            return (
              <div
                key={order.id}
                className={`flex flex-col sm:grid sm:grid-cols-[2rem_7rem_1fr_6rem_7rem_auto] gap-2 sm:gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors ${idx > 0 ? 'border-t' : ''}`}
                onClick={() => setSelectedOrderDetail(order)}
              >
                {/* Type icon */}
                <div className="hidden sm:flex items-center justify-center text-xl" title={order.orderType === 'delivery' ? 'Delivery' : 'Retirada'}>
                  {order.orderType === 'delivery' ? '🛵' : '📦'}
                </div>

                {/* Code + Time */}
                <div className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-1">
                  <div className="flex items-center gap-1.5 sm:gap-1">
                    <span className="sm:hidden text-lg">{order.orderType === 'delivery' ? '🛵' : '📦'}</span>
                    <span className="font-bold text-sm text-foreground">#{order.id.slice(0, 6)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{time}</span>
                </div>

                {/* Customer + Items */}
                <div className="flex flex-col justify-center min-w-0">
                  <span className="font-semibold text-sm text-foreground truncate">{order.customerName || '—'}</span>
                  <span className="text-xs text-muted-foreground truncate">{itemsSummary}</span>
                </div>

                {/* Status badge */}
                <div className="flex sm:items-center sm:justify-center">
                  <Badge
                    className={`${cfg.color} gap-1 text-[10px] cursor-pointer hover:opacity-80 transition-opacity w-fit`}
                    onClick={(e) => { e.stopPropagation(); setStatusDialogOrder(order); }}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                  </Badge>
                </div>

                {/* Total */}
                <div className="hidden sm:flex items-center justify-end">
                  <span className="font-bold text-primary text-sm">R$ {fmt(totalWithFee)}</span>
                </div>

                {/* Actions */}
                <div
                  className="flex items-center justify-end gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {ds !== 'finalizado' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => navigate(`/pdv?pedido=${order.id}`)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-[11px] gap-1"
                        onClick={() => {
                          if (ds === 'pendente') {
                            changeStatus(order.id, 'pronto');
                          } else if (ds === 'pronto' && !order.paymentMethod) {
                            navigate(`/pdv?pedido=${order.id}`);
                          } else {
                            changeStatus(order.id, 'finalizado');
                          }
                        }}
                      >
                        {ds === 'pendente' ? 'Pronto' : 'Finalizar'}
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => setCancelDialogOrder(order)}
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {ds === 'finalizado' && (
                    <span className="text-xs text-muted-foreground italic">Finalizado</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Status Change Dialog */}
      <Dialog open={!!statusDialogOrder} onOpenChange={(open) => !open && setStatusDialogOrder(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar Status — #{statusDialogOrder?.id.slice(0, 6)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(['pendente', 'pronto', 'finalizado'] as DeliveryStatus[]).map(s => {
              const cfg = statusConfig[s];
              const Icon = cfg.icon;
              const isActive = statusDialogOrder?.deliveryStatus === s;
              return (
                <Button
                  key={s}
                  variant={isActive ? 'default' : 'outline'}
                  className="w-full justify-start gap-3 h-12"
                  onClick={() => {
                    if (!statusDialogOrder) return;
                    if (s === 'finalizado' && !statusDialogOrder.paymentMethod) {
                      setStatusDialogOrder(null);
                      navigate(`/pdv?pedido=${statusDialogOrder.id}`);
                      return;
                    }
                    changeStatus(statusDialogOrder.id, s);
                  }}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{cfg.label}</span>
                  {isActive && <span className="ml-auto text-xs opacity-70">Atual</span>}
                </Button>
              );
            })}
          </div>

          {/* Edit motoboy inline */}
          {statusDialogOrder && (statusDialogOrder.orderType === 'delivery') && (
            <div className="space-y-2 pt-2 border-t">
              <Label>Motoboy</Label>
              <Input
                placeholder="Nome do motoboy"
                value={statusDialogOrder.motoboyName || ''}
                onChange={e => {
                  updateOrderField(statusDialogOrder.id, 'motoboyName', e.target.value);
                  setStatusDialogOrder(prev => prev ? { ...prev, motoboyName: e.target.value } : null);
                }}
              />
            </div>
          )}

          {/* Edit order source inline */}
          {statusDialogOrder && (
            <div className="space-y-2 pt-2 border-t">
              <Label>Origem do pedido</Label>
              <Select
                value={statusDialogOrder.orderSource || 'outro'}
                onValueChange={v => {
                  updateOrderField(statusDialogOrder.id, 'orderSource', v);
                  setStatusDialogOrder(prev => prev ? { ...prev, orderSource: v as OrderSource } : null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(orderSourceLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Order Dialog */}
      <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Pedido</DialogTitle>
          </DialogHeader>

          {/* Type selector */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={selectedType === 'delivery' ? 'default' : 'outline'}
              className="h-14 flex-col gap-1"
              onClick={() => setSelectedType('delivery')}
            >
              <Truck className="h-5 w-5" />
              <span className="text-sm">🛵 Delivery</span>
            </Button>
            <Button
              variant={selectedType === 'retirada' ? 'default' : 'outline'}
              className="h-14 flex-col gap-1"
              onClick={() => setSelectedType('retirada')}
            >
              <Package className="h-5 w-5" />
              <span className="text-sm">📦 Retirada</span>
            </Button>
          </div>

          <div className="space-y-3">
            {/* Customer search */}
            <div className="space-y-1.5 relative">
              <Label htmlFor="name">Nome do cliente *</Label>
              <Input
                id="name"
                ref={nameInputRef}
                placeholder="Buscar cliente ou digitar nome..."
                value={customerName}
                onChange={e => {
                  setCustomerName(e.target.value);
                  setCustomerSearch(e.target.value);
                  setShowCustomerDropdown(true);
                  setSelectedCustomerId(undefined);
                }}
                onFocus={() => customerSearch && setShowCustomerDropdown(true)}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                autoComplete="off"
              />
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden">
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                      onMouseDown={() => selectCustomer(c)}
                    >
                      <div>
                        <p className="font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.phone} • {c.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone *</Label>
              <Input
                id="phone"
                placeholder="(00) 00000-0000"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
              />
            </div>

            {selectedType === 'delivery' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="address">Endereço de entrega *</Label>
                  <Input
                    id="address"
                    placeholder="Rua, número, bairro..."
                    value={customerAddress}
                    onChange={e => setCustomerAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fee">Taxa de entrega (R$)</Label>
                  <Input
                    id="fee"
                    placeholder="0,00"
                    inputMode="decimal"
                    value={deliveryFee}
                    onChange={e => setDeliveryFee(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="motoboy">Motoboy</Label>
                  <Input
                    id="motoboy"
                    placeholder="Nome do motoboy (opcional)"
                    value={motoboyName}
                    onChange={e => setMotoboyName(e.target.value)}
                  />
                </div>
              </>
            )}

            {selectedType === 'retirada' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="pickupPerson">Responsável pela retirada</Label>
                  <Input
                    id="pickupPerson"
                    placeholder="Nome de quem vai retirar (opcional)"
                    value={pickupPerson}
                    onChange={e => setPickupPerson(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="productionTime">Horário de produção</Label>
                    <Input
                      id="productionTime"
                      type="time"
                      value={productionTime}
                      onChange={e => setProductionTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pickupTime">Horário previsto de retirada</Label>
                    <Input
                      id="pickupTime"
                      type="time"
                      value={pickupTime}
                      onChange={e => setPickupTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pickupNotes">Observações</Label>
                  <Input
                    id="pickupNotes"
                    placeholder="Ex: cliente paga na retirada, preparar às 15h..."
                    value={pickupNotes}
                    onChange={e => setPickupNotes(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Order source */}
            <div className="space-y-1.5">
              <Label>Origem do pedido</Label>
              <Select value={orderSource} onValueChange={v => setOrderSource(v as OrderSource)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(orderSourceLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setNewOrderOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleCreateOrder}>
              Criar e Adicionar Itens
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Detail Modal */}
      <Dialog open={!!selectedOrderDetail} onOpenChange={(open) => !open && setSelectedOrderDetail(null)}>
        <DialogContent className="max-w-md">
          {selectedOrderDetail && (() => {
            const o = selectedOrderDetail;
            const ds = o.deliveryStatus || 'pendente';
            const cfg = statusConfig[ds];
            const StatusIcon = cfg.icon;
            const totalWithFee = o.total + (o.deliveryFee || 0);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="text-xl">{o.orderType === 'delivery' ? '🛵' : '📦'}</span>
                    <span>Pedido #{o.id.slice(0, 6)}</span>
                    <Badge className={`${cfg.color} gap-1 ml-auto`}>
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Customer info */}
                  <div className="bg-muted/40 rounded-lg p-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wide">Cliente</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-semibold">{o.customerName || '—'}</span>
                      </div>
                      {o.customerPhone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{o.customerPhone}</span>
                        </div>
                      )}
                      {o.customerAddress && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span>{o.customerAddress}</span>
                        </div>
                      )}
                      {o.motoboyName && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Bike className="h-3.5 w-3.5 shrink-0" />
                          <span>Motoboy: {o.motoboyName}</span>
                        </div>
                      )}
                      {o.pickupPerson && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-3.5 w-3.5 shrink-0" />
                          <span>Retirar: {o.pickupPerson}</span>
                        </div>
                      )}
                      {(o.productionTime || o.pickupTime) && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {o.productionTime && `Produção: ${o.productionTime}`}
                            {o.productionTime && o.pickupTime && ' • '}
                            {o.pickupTime && `Retirada: ${o.pickupTime}`}
                          </span>
                        </div>
                      )}
                      {o.orderSource && (
                        <p className="text-xs text-muted-foreground pl-5">{orderSourceLabels[o.orderSource]}</p>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wide mb-2">Itens do pedido</p>
                    {o.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Sem itens — abra no PDV para adicionar</p>
                    ) : (
                      <div className="space-y-1">
                        {o.items.map(item => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-foreground">
                              {item.quantity}× {item.name}
                              {item.notes && <span className="text-xs text-muted-foreground ml-1">({item.notes})</span>}
                            </span>
                            <span className="font-medium text-foreground">R$ {fmt(item.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="border-t pt-3 space-y-1">
                    {o.deliveryFee ? (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Taxa de entrega</span>
                        <span>R$ {fmt(o.deliveryFee)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-base">Total</span>
                      <span className="font-bold text-primary text-xl">R$ {fmt(totalWithFee)}</span>
                    </div>
                    <p className={`text-xs ${o.paymentMethod ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                      {o.paymentMethod
                        ? `✅ Pago (${o.paymentMethod === 'pix' ? 'PIX' : o.paymentMethod === 'cartao' ? 'Cartão' : o.paymentMethod === 'dinheiro' ? 'Dinheiro' : 'Fiado'})`
                        : o.orderType === 'retirada' ? 'Paga na retirada' : 'Paga na entrega'}
                    </p>
                    {o.pickupNotes && !o.pickupNotes.startsWith('CANCELADO') && (
                      <p className="text-xs text-muted-foreground italic">{o.pickupNotes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  {ds !== 'finalizado' && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => { setSelectedOrderDetail(null); navigate(`/pdv?pedido=${o.id}`); }}
                      >
                        Editar Pedido
                      </Button>
                      <Button
                        className="flex-1 gap-1"
                        onClick={() => {
                          if (ds === 'pendente') {
                            changeStatus(o.id, 'pronto');
                          } else if (ds === 'pronto' && !o.paymentMethod) {
                            setSelectedOrderDetail(null);
                            navigate(`/pdv?pedido=${o.id}`);
                          } else {
                            changeStatus(o.id, 'finalizado');
                          }
                          setSelectedOrderDetail(null);
                        }}
                      >
                        {ds === 'pendente' ? 'Marcar Pronto' : 'Finalizar'}
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={!!cancelDialogOrder} onOpenChange={(open) => {
        if (!open) {
          setCancelDialogOrder(null);
          setCancelReason('');
          setAdminEmail('');
          setAdminPassword('');
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Cancelar Pedido #{cancelDialogOrder?.id.slice(0, 6)}
            </DialogTitle>
          </DialogHeader>

          {cancelDialogOrder && (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              <p><strong>Cliente:</strong> {cancelDialogOrder.customerName || '—'}</p>
              <p><strong>Tipo:</strong> {cancelDialogOrder.orderType === 'delivery' ? '🛵 Delivery' : '📦 Retirada'}</p>
              <p><strong>Total:</strong> R$ {fmt(cancelDialogOrder.total + (cancelDialogOrder.deliveryFee || 0))}</p>
              <p><strong>Status:</strong> {cancelDialogOrder.deliveryStatus || 'pendente'}</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cancelReason">Motivo do cancelamento *</Label>
              <Textarea
                id="cancelReason"
                placeholder="Informe o motivo do cancelamento..."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>

            <div className="border-t pt-3 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Autorização do Administrador</p>
              <div className="space-y-1.5">
                <Label htmlFor="adminEmail">Email do admin *</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  placeholder="admin@email.com"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminPass">Senha *</Label>
                <Input
                  id="adminPass"
                  type="password"
                  placeholder="••••••"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCancelDialogOrder(null)} disabled={cancelLoading}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleCancelOrder}
              disabled={cancelLoading || !cancelReason.trim() || !adminEmail.trim() || !adminPassword.trim()}
            >
              {cancelLoading ? 'Verificando...' : 'Confirmar Cancelamento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Entregas;
