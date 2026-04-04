import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fmt } from '@/lib/utils';
import { Order, OrderType, DeliveryStatus, OrderSource } from '@/types';

import { Plus, Phone, MapPin, User, Truck, Package, CheckCircle2, Clock, Search, ChevronRight, Bike } from 'lucide-react';

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

  const pendingCount = orders.filter(o => (o.orderType === 'delivery' || o.orderType === 'retirada') && o.deliveryStatus === 'pendente').length;
  const readyCount = orders.filter(o => (o.orderType === 'delivery' || o.orderType === 'retirada') && o.deliveryStatus === 'pronto').length;

  return (
    <div className="p-4 md:p-6 space-y-4">
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

      {/* Orders Grid */}
      {deliveryOrders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Truck className="h-16 w-16 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Nenhum pedido encontrado</p>
          <p className="text-sm">Crie um novo pedido de delivery ou retirada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {deliveryOrders.map(order => {
            const ds = order.deliveryStatus || 'pendente';
            const cfg = statusConfig[ds];
            const StatusIcon = cfg.icon;
            const totalWithFee = order.total + (order.deliveryFee || 0);

            return (
              <Card key={order.id} className="overflow-hidden">
                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {order.orderType === 'delivery' ? '🛵' : '📦'}
                        </span>
                        <span className="font-bold text-foreground text-sm">#{order.id.slice(0, 6)}</span>
                        {order.orderSource && (
                          <span className="text-xs text-muted-foreground">{orderSourceLabels[order.orderSource]}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Badge
                      className={`${cfg.color} gap-1 cursor-pointer hover:opacity-80 transition-opacity`}
                      onClick={() => setStatusDialogOrder(order)}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </div>

                  {/* Customer info */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{order.customerName || '—'}</span>
                    </div>
                    {order.customerPhone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{order.customerPhone}</span>
                      </div>
                    )}
                    {order.customerAddress && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="line-clamp-2">{order.customerAddress}</span>
                      </div>
                    )}
                    {order.motoboyName && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Bike className="h-3.5 w-3.5" />
                        <span>{order.motoboyName}</span>
                      </div>
                    )}
                    {order.pickupPerson && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span>Retirar: {order.pickupPerson}</span>
                      </div>
                    )}
                    {(order.productionTime || order.pickupTime) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {order.productionTime && `Produção: ${order.productionTime}`}
                          {order.productionTime && order.pickupTime && ' • '}
                          {order.pickupTime && `Retirada: ${order.pickupTime}`}
                        </span>
                      </div>
                    )}
                    {order.pickupNotes && (
                      <div className="text-xs text-muted-foreground italic mt-1 pl-5">
                        {order.pickupNotes}
                      </div>
                    )}
                  </div>

                  {/* Items summary */}
                  <div className="bg-muted/50 rounded-lg p-2.5">
                    {order.items.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Sem itens — abra no PDV para adicionar</p>
                    ) : (
                      <div className="space-y-0.5">
                        {order.items.slice(0, 3).map(item => (
                          <div key={item.id} className="flex justify-between text-xs">
                            <span className="text-foreground">{item.quantity}× {item.name}</span>
                            <span className="text-muted-foreground">R$ {fmt(item.subtotal)}</span>
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <p className="text-xs text-muted-foreground">+{order.items.length - 3} item(ns)</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center pt-1 border-t">
                    <div>
                      {order.deliveryFee ? (
                        <p className="text-[10px] text-muted-foreground">Taxa: R$ {fmt(order.deliveryFee)}</p>
                      ) : null}
                    </div>
                    <p className="font-bold text-primary text-lg">R$ {fmt(totalWithFee)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {order.items.length === 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/pdv?pedido=${order.id}`)}
                      >
                        Adicionar Itens
                      </Button>
                    ) : ds !== 'finalizado' ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => navigate(`/pdv?pedido=${order.id}`)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 gap-1"
                          onClick={() => changeStatus(order.id, ds === 'pendente' ? 'pronto' : 'finalizado')}
                        >
                          {ds === 'pendente' ? 'Marcar Pronto' : 'Finalizar'}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </Card>
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
                  onClick={() => statusDialogOrder && changeStatus(statusDialogOrder.id, s)}
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
    </div>
  );
};

export default Entregas;
