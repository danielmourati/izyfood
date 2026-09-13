import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Search, Plus, Printer, CreditCard, User, Menu, ChevronLeft, Trash2, Edit3, X, Lock } from 'lucide-react';
import { Order, OrderItem, Product, TableInfo } from '@/types';
import { useStore } from '@/contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { ConsumerProductFinderModal } from './ConsumerProductFinderModal';
import { ConsumerItemCustomizeModal } from './ConsumerItemCustomizeModal';
import { CheckoutModal } from '@/components/CheckoutModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fmt } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ConsumerOrderModalProps {
  open: boolean;
  onClose: () => void;
  tableNumber?: number;
  order: Order | null;
  onSaveOrder: (updatedOrder: Order) => void;
  onPrintOrder?: (order: Order) => void;
}

export function ConsumerOrderModal({
  open,
  onClose,
  tableNumber,
  order,
  onSaveOrder,
  onPrintOrder,
}: ConsumerOrderModalProps) {
  const { products, customers, tables, setTables } = useStore();
  const { user } = useAuth();

  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [finderOpen, setFinderOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [assignedWaiter, setAssignedWaiter] = useState<string>(user?.name || 'Daniel');

  useEffect(() => {
    if (open && order) {
      setCurrentOrder(order);
      setGeneralNotes(order.pickupNotes || '');
      setAssignedWaiter(order.customerName || user?.name || 'Daniel');
    }
  }, [open, order, user]);

  if (!open || !currentOrder) return null;

  const items = currentOrder.items || [];
  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(itemSearchQuery.toLowerCase())
  );

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  // Helper to add item directly without customization
  const handleAddDirect = (prod: Product) => {
    const newId = crypto.randomUUID();
    const newItem: OrderItem = {
      id: newId,
      productId: prod.id,
      name: prod.name,
      price: prod.price,
      quantity: 1,
      subtotal: prod.price,
      addedBy: user?.id,
      addedByName: user?.name,
    };

    const updatedItems = [...items, newItem];
    const updatedTotal = updatedItems.reduce((s, i) => s + i.subtotal, 0);

    const updatedOrder: Order = {
      ...currentOrder,
      items: updatedItems,
      total: updatedTotal,
    };

    setCurrentOrder(updatedOrder);
    onSaveOrder(updatedOrder);
    toast.success(`Adicionado: ${prod.name}`);
  };

  // Open customization modal
  const handlePersonalizeProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setEditingItem(null);
    setCustomizeOpen(true);
  };

  // Edit existing item customization
  const handleEditItemCustomization = (item: OrderItem) => {
    const prod = products.find(p => p.id === item.productId) || {
      id: item.productId,
      name: item.name,
      price: item.price,
      categoryId: '',
      type: 'unit' as const,
      unit: 'un',
      stock: 999,
      loyaltyEligible: false,
      controlStock: false,
    };
    setSelectedProduct(prod as Product);
    setEditingItem(item);
    setCustomizeOpen(true);
  };

  // Confirm item customization
  const handleConfirmCustomization = (payload: {
    quantity: number;
    selectedNotes: string[];
    otherNotes: string;
    selectedComplements: { name: string; price: number; quantity: number }[];
  }) => {
    if (!selectedProduct) return;

    const compsTotal = payload.selectedComplements.reduce((acc, c) => acc + c.price * c.quantity, 0);
    const unitPrice = selectedProduct.price + compsTotal;
    const itemSubtotal = unitPrice * payload.quantity;

    const notesParts = [...payload.selectedNotes];
    if (payload.otherNotes) notesParts.push(payload.otherNotes);
    const formattedNotes = notesParts.join(' | ');

    let updatedItems: OrderItem[];

    if (editingItem) {
      updatedItems = items.map(i => {
        if (i.id === editingItem.id) {
          return {
            ...i,
            quantity: payload.quantity,
            selectedNotes: payload.selectedNotes,
            otherNotes: payload.otherNotes,
            selectedComplements: payload.selectedComplements,
            notes: formattedNotes,
            subtotal: itemSubtotal,
          };
        }
        return i;
      });
    } else {
      const newItem: OrderItem = {
        id: crypto.randomUUID(),
        productId: selectedProduct.id,
        name: selectedProduct.name,
        price: selectedProduct.price,
        quantity: payload.quantity,
        selectedNotes: payload.selectedNotes,
        otherNotes: payload.otherNotes,
        selectedComplements: payload.selectedComplements,
        notes: formattedNotes,
        subtotal: itemSubtotal,
        addedBy: user?.id,
        addedByName: user?.name,
      };
      updatedItems = [...items, newItem];
    }

    const updatedTotal = updatedItems.reduce((s, i) => s + i.subtotal, 0);
    const updatedOrder: Order = {
      ...currentOrder,
      items: updatedItems,
      total: updatedTotal,
    };

    setCurrentOrder(updatedOrder);
    onSaveOrder(updatedOrder);
    setCustomizeOpen(false);
    toast.success(editingItem ? 'Item atualizado!' : `Adicionado: ${selectedProduct.name}`);
  };

  const handleRemoveItem = (id: string) => {
    const updatedItems = items.filter(i => i.id !== id);
    const updatedTotal = updatedItems.reduce((s, i) => s + i.subtotal, 0);
    const updatedOrder: Order = { ...currentOrder, items: updatedItems, total: updatedTotal };
    setCurrentOrder(updatedOrder);
    onSaveOrder(updatedOrder);
    toast.info('Item removido do pedido');
  };

  const handleSelectCustomer = (cust: any) => {
    const updatedOrder: Order = {
      ...currentOrder,
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      customerAddress: cust.address,
    };
    setCurrentOrder(updatedOrder);
    onSaveOrder(updatedOrder);
    setCustomerModalOpen(false);
    toast.success(`Cliente ${cust.name} vinculado!`);
  };

  const formattedDate = currentOrder.createdAt
    ? format(new Date(currentOrder.createdAt), "dd-MM 'às' HH:mm")
    : format(new Date(), "dd-MM 'às' HH:mm");

  const displayMesaNum = currentOrder.tableNumber || tableNumber || 1;
  const shortOrderId = currentOrder.id.slice(0, 4);

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs font-sans">
        <div className="bg-[#1e1e1e] text-white w-full max-w-6xl rounded-md shadow-2xl overflow-hidden border border-[#3c3c3c] flex flex-col h-[92vh] max-h-[800px] animate-in zoom-in-95 duration-150">
          
          {/* Consumer Window Titlebar */}
          <div className="bg-[#181818] px-4 py-2 flex justify-between items-center border-b border-[#2d2d2d] shrink-0">
            <span className="text-sm font-semibold text-gray-200">
              {currentOrder.orderType === 'mesa'
                ? `Comanda: ${displayMesaNum} (Pedido #${shortOrderId})`
                : `Pedido #${shortOrderId} (${currentOrder.orderType.toUpperCase()})`}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#333333] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Top Inside Control Bar */}
          <div className="bg-[#242424] px-4 py-2.5 border-b border-[#333333] flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              {/* Green Table/Badge Icon */}
              <div className="text-2xl font-black text-[#22c55e] px-1">
                {String(displayMesaNum).padStart(2, '0')}
              </div>

              {/* Status Badge */}
              <span className="bg-[#15803d] text-white text-xs font-bold px-3 py-1 rounded">
                Em Aberto
              </span>

              <span className="text-sm font-bold text-gray-300">
                Pedido #{shortOrderId}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-1 max-w-md justify-end">
              {/* Search Bar */}
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Buscar item..."
                  value={itemSearchQuery}
                  onChange={e => setItemSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-[#181818] border-[#383838] text-white placeholder:text-gray-400 focus-visible:ring-blue-500"
                />
              </div>

              {/* + Produtos Button */}
              <Button
                onClick={() => setFinderOpen(true)}
                className="bg-[#2e2e2e] hover:bg-[#383838] text-white border border-[#444444] text-xs h-8 px-3 font-bold flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Plus className="h-4 w-4 text-blue-400" /> Produtos
              </Button>
            </div>
          </div>

          {/* Body Split (Left Info Panel vs Right Order Items Panel) */}
          <div className="flex-1 flex overflow-hidden bg-[#181818]">
            
            {/* Left Info Panel */}
            <div className="w-72 bg-[#252526] border-r border-[#333333] p-4 flex flex-col justify-between overflow-y-auto shrink-0 text-xs gap-4">
              <div className="space-y-4">
                
                {/* Time & Creator */}
                <div className="space-y-1.5 text-gray-300">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">🕒</span>
                    <span>Iniciado em {formattedDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">👤</span>
                    <span>Criado por: <strong className="text-white">{user?.name || 'Daniel'}</strong></span>
                  </div>
                </div>

                {/* Waiter Select Dropdown */}
                <div>
                  <select
                    value={assignedWaiter}
                    onChange={e => setAssignedWaiter(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-[#3c3c3c] text-gray-200 text-xs rounded p-2 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Daniel">Daniel</option>
                    <option value="Atendente 1">Atendente 1</option>
                    <option value="Caixa">Caixa</option>
                  </select>
                </div>

                {/* General Observation Input */}
                <div>
                  <Input
                    placeholder="Anotar observação..."
                    value={generalNotes}
                    onChange={e => {
                      setGeneralNotes(e.target.value);
                      onSaveOrder({ ...currentOrder, pickupNotes: e.target.value });
                    }}
                    className="bg-[#1e1e1e] border-[#3c3c3c] text-xs text-white placeholder:text-gray-500 h-9"
                  />
                </div>

                <hr className="border-[#383838]" />

                {/* Table Indicator */}
                <div className="space-y-2">
                  <label className="text-gray-400 font-medium block">
                    🪑 Mesa onde a comanda está
                  </label>
                  <Input
                    placeholder="Núm. da Mesa (Opcional)"
                    value={displayMesaNum}
                    readOnly
                    className="bg-[#1e1e1e] border-[#3c3c3c] text-xs text-gray-300 h-8"
                  />
                  <button
                    type="button"
                    onClick={() => toast.info('Funcionalidade de transferência disponível no menu principal')}
                    className="text-blue-400 hover:underline text-[11px] block mt-1"
                  >
                    Outras comandas nesta mesa
                  </button>
                </div>

                {/* Lock Order Toggle */}
                <div className="flex items-center gap-3 pt-2">
                  <Switch
                    checked={isLocked}
                    onCheckedChange={setIsLocked}
                    className="data-[state=checked]:bg-blue-600"
                  />
                  <span className="font-semibold text-gray-300">Bloquear Pedido</span>
                </div>
              </div>

              {/* Bottom Action Links in Left Panel */}
              <div className="space-y-2 pt-4 border-t border-[#333333]">
                <button
                  type="button"
                  onClick={() => setCustomerModalOpen(true)}
                  className="w-full flex items-center gap-2 py-2 px-3 rounded hover:bg-[#333333] text-gray-200 transition-colors text-left font-medium"
                >
                  <User className="h-4 w-4 text-gray-400" />
                  <span>{currentOrder.customerName ? `Cliente: ${currentOrder.customerName}` : 'Vincular Cliente'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => toast.info('Opções adicionais')}
                  className="w-full flex items-center gap-2 py-2 px-3 rounded hover:bg-[#333333] text-gray-200 transition-colors text-left font-medium"
                >
                  <Menu className="h-4 w-4 text-gray-400" />
                  <span>Mais Opções</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full flex items-center gap-2 py-2 px-3 rounded hover:bg-[#333333] text-gray-400 hover:text-white transition-colors text-left font-medium"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Voltar</span>
                </button>
              </div>
            </div>

            {/* Right Panel: Launched Order Items */}
            <div className="flex-1 flex flex-col justify-between overflow-hidden bg-[#181818]">
              
              {/* Items List Table / Empty state */}
              <div className="flex-1 overflow-y-auto p-4">
                {filteredItems.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-sm italic">
                    Nenhum item lançado.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#242424] text-gray-300 border-b border-[#383838] shadow-sm">
                      <tr>
                        <th className="py-2 px-3 font-bold w-12 text-center">Qtd</th>
                        <th className="py-2 px-3 font-bold">Item / Descrição</th>
                        <th className="py-2 px-3 font-bold text-right w-24">Unitário</th>
                        <th className="py-2 px-3 font-bold text-right w-24">Subtotal</th>
                        <th className="py-2 px-3 font-bold text-center w-20">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#282828] text-gray-200">
                      {filteredItems.map(item => (
                        <tr key={item.id} className="hover:bg-[#222222] transition-colors">
                          <td className="py-3 px-3 text-center font-bold text-blue-400">
                            {item.quantity}x
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-white text-sm">{item.name}</div>

                            {/* Complements & Notes Detail */}
                            {item.selectedComplements && item.selectedComplements.length > 0 && (
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                {item.selectedComplements.map((c, ci) => (
                                  <span key={ci} className="mr-2">
                                    + {c.quantity}x {c.name} ({fmt(c.price)})
                                  </span>
                                ))}
                              </div>
                            )}

                            {item.notes && (
                              <div className="text-[11px] text-amber-400/90 italic mt-0.5">
                                Obs: {item.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-gray-400">
                            R$ {fmt(item.price)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-green-400">
                            R$ {fmt(item.subtotal)}
                          </td>

                          {/* Item Actions */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditItemCustomization(item)}
                                className="p-1 rounded text-gray-400 hover:text-blue-400 hover:bg-[#333333]"
                                title="Editar item"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-[#333333]"
                                title="Remover item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Bottom Right Actions (Imprimir & PAGAMENTO) */}
              <div className="bg-[#242424] p-4 border-t border-[#333333] flex justify-between items-center shrink-0 gap-4">
                
                {/* Total Summary */}
                <div>
                  <span className="text-xs text-gray-400 block font-medium">TOTAL DO PEDIDO</span>
                  <span className="text-2xl font-extrabold text-white">R$ {fmt(totalAmount)}</span>
                </div>

                {/* Main Action Buttons */}
                <div className="flex items-center gap-3">
                  {/* Imprimir Button */}
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (onPrintOrder) onPrintOrder(currentOrder);
                      else toast.success('Comanda impressa com sucesso!');
                    }}
                    className="bg-[#2e2e2e] border-[#444444] text-gray-200 hover:bg-[#383838] hover:text-white h-11 px-4 text-xs font-bold flex items-center gap-2 shadow-sm"
                  >
                    <Printer className="h-4 w-4" /> Imprimir
                  </Button>

                  {/* PAGAMENTO Button */}
                  <Button
                    onClick={() => setCheckoutOpen(true)}
                    className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white h-11 px-6 text-sm font-extrabold flex items-center gap-2 shadow-lg tracking-wider active:scale-95 transition-all"
                  >
                    <CreditCard className="h-5 w-5" /> PAGAMENTO
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 2: Product Finder */}
      <ConsumerProductFinderModal
        open={finderOpen}
        onClose={() => setFinderOpen(false)}
        onAddDirect={handleAddDirect}
        onPersonalize={handlePersonalizeProduct}
      />

      {/* Modal 3: Item Customization */}
      <ConsumerItemCustomizeModal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        product={selectedProduct}
        itemToEdit={editingItem}
        onConfirm={handleConfirmCustomization}
      />

      {/* Customer Selector Dialog */}
      <Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen}>
        <DialogContent className="bg-[#252526] text-white border-[#383838]">
          <DialogHeader>
            <DialogTitle>Vincular Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {customers.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">Nenhum cliente cadastrado.</p>
            ) : (
              customers.map(c => (
                <div
                  key={c.id}
                  onClick={() => handleSelectCustomer(c)}
                  className="p-3 bg-[#1e1e1e] hover:bg-[#333333] border border-[#3c3c3c] rounded cursor-pointer transition-colors flex justify-between items-center"
                >
                  <div>
                    <h5 className="font-bold text-sm text-white">{c.name}</h5>
                    <p className="text-xs text-gray-400">{c.phone || 'Sem telefone'}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs text-blue-400">
                    Selecionar
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Existing Checkout Modal */}
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        order={currentOrder}
        onComplete={() => {
          setCheckoutOpen(false);
          onClose();
          toast.success('Pedido finalizado com sucesso!');
        }}
      />
    </>
  );
}
