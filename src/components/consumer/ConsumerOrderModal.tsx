import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Search, Plus, Printer, CreditCard, User, Menu, ChevronLeft, Trash2, Edit3, X, Lock, Send, RefreshCw, AlertTriangle, Check, LockKeyhole } from 'lucide-react';
import { Order, OrderItem, Product, TableInfo } from '@/types';
import { useStore } from '@/contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { ConsumerProductFinderModal } from './ConsumerProductFinderModal';
import { ConsumerItemCustomizeModal } from './ConsumerItemCustomizeModal';
import { CheckoutModal } from '@/components/CheckoutModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
  onDiscardEmptyOrder?: (orderId: string, tableNumber?: number) => void;
  onDeleteOrder?: (orderId: string, tableNumber?: number) => void;
}

export function ConsumerOrderModal({
  open,
  onClose,
  tableNumber,
  order,
  onSaveOrder,
  onPrintOrder,
  onDiscardEmptyOrder,
  onDeleteOrder,
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

  // Modals for Print Options, Mais Opções and Sub-menus
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [changeTypeOpen, setChangeTypeOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (open && order) {
      setCurrentOrder(order);
      setGeneralNotes(order.pickupNotes || '');
      setAssignedWaiter(order.customerName || user?.name || 'Daniel');
    }
  }, [open, order, user]);

  const items = currentOrder?.items || [];
  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  // Centralized close handler: Auto-saves & prints to kitchen if items exist, or discards if empty
  const handleCloseAndSaveOrDiscard = () => {
    if (!currentOrder) {
      onClose();
      return;
    }

    const hasItems = items.length > 0 && totalAmount > 0;

    if (hasItems) {
      onSaveOrder(currentOrder);
      if (onPrintOrder) {
        onPrintOrder(currentOrder);
      }
      toast.success('Pedido salvo e enviado para a cozinha!');
    } else {
      if (onDiscardEmptyOrder) {
        onDiscardEmptyOrder(currentOrder.id, currentOrder.tableNumber);
      }
      toast.info('Pedido vazio descartado.');
    }
    onClose();
  };

  // Keyboard shortcut handler for ESC key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (customizeOpen) { setCustomizeOpen(false); return; }
        if (finderOpen) { setFinderOpen(false); return; }
        if (customerModalOpen) { setCustomerModalOpen(false); return; }
        if (checkoutOpen) { setCheckoutOpen(false); return; }
        if (printMenuOpen) { setPrintMenuOpen(false); return; }
        if (changeTypeOpen) { setChangeTypeOpen(false); return; }
        if (deleteConfirmOpen) { setDeleteConfirmOpen(false); return; }
        if (moreOptionsOpen) { setMoreOptionsOpen(false); return; }

        e.preventDefault();
        handleCloseAndSaveOrDiscard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    open, currentOrder, items, totalAmount,
    finderOpen, customizeOpen, customerModalOpen, checkoutOpen,
    printMenuOpen, changeTypeOpen, deleteConfirmOpen, moreOptionsOpen
  ]);

  if (!open || !currentOrder) return null;

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(itemSearchQuery.toLowerCase())
  );

  const unprintedCount = items.filter(i => !i.printed).length;

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

  // Handlers for Print Menu (Anexo 1)
  const handlePrintAccount = () => {
    if (onPrintOrder) onPrintOrder(currentOrder);
    toast.success('Imprimindo Conta do Cliente...');
    setPrintMenuOpen(false);
  };

  const handlePrintAccountAndLock = () => {
    setIsLocked(true);
    if (onPrintOrder) onPrintOrder(currentOrder);
    toast.success('Conta impressa e pedido bloqueado!');
    setPrintMenuOpen(false);
  };

  const handlePrintKitchenNew = () => {
    if (unprintedCount === 0) {
      toast.info('Não há itens novos para imprimir na Cozinha.');
      return;
    }
    const updatedItems = items.map(i => ({ ...i, printed: true }));
    const updatedOrder: Order = { ...currentOrder, items: updatedItems };
    setCurrentOrder(updatedOrder);
    onSaveOrder(updatedOrder);
    if (onPrintOrder) onPrintOrder(updatedOrder);
    toast.success('Itens novos enviados e impressos na cozinha!');
    setPrintMenuOpen(false);
  };

  const handleReprintKitchen = () => {
    if (onPrintOrder) onPrintOrder(currentOrder);
    toast.success('Cozinha: Reimpressão enviada com sucesso!');
    setPrintMenuOpen(false);
  };

  // Actions for "Mais Opções"
  const handlePrintConsumptionTickets = () => {
    if (items.length === 0) {
      toast.error('Nenhum item no pedido para imprimir.');
      return;
    }
    const updatedItems = items.map(i => ({ ...i, printed: true }));
    const updatedOrder: Order = { ...currentOrder, items: updatedItems };
    setCurrentOrder(updatedOrder);
    onSaveOrder(updatedOrder);
    if (onPrintOrder) onPrintOrder(updatedOrder);
    toast.success('Fichas de consumo impressas com sucesso!');
    setMoreOptionsOpen(false);
  };

  const handleSendWhatsApp = () => {
    const phone = currentOrder.customerPhone || '5500000000000';
    let text = `*PEDIDO #${currentOrder.id.slice(0, 4)}*\n`;
    text += `Mesa/Comanda: ${currentOrder.tableNumber || tableNumber || 1}\n\n`;
    text += `*ITENS:*\n`;
    items.forEach(i => {
      text += `• ${i.quantity}x ${i.name} - R$ ${fmt(i.subtotal)}\n`;
    });
    text += `\n*TOTAL: R$ ${fmt(totalAmount)}*`;

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`, '_blank');
    toast.success('Abrindo WhatsApp...');
    setMoreOptionsOpen(false);
  };

  const handleRecalculateOrder = () => {
    const updatedItems = items.map(i => ({
      ...i,
      subtotal: i.price * i.quantity,
    }));
    const newTotal = updatedItems.reduce((s, i) => s + i.subtotal, 0);
    const updatedOrder: Order = { ...currentOrder, items: updatedItems, total: newTotal };
    setCurrentOrder(updatedOrder);
    onSaveOrder(updatedOrder);
    toast.success('Pedido recalculado com sucesso!');
    setMoreOptionsOpen(false);
  };

  const handleChangeOrderType = (newType: 'mesa' | 'balcao' | 'caixa' | 'delivery') => {
    const updatedOrder: Order = { ...currentOrder, orderType: newType };
    setCurrentOrder(updatedOrder);
    onSaveOrder(updatedOrder);
    setChangeTypeOpen(false);
    setMoreOptionsOpen(false);
    toast.success(`Tipo de pedido alterado para: ${newType.toUpperCase()}`);
  };

  const handleConfirmDeleteOrder = () => {
    if (onDeleteOrder) {
      onDeleteOrder(currentOrder.id, currentOrder.tableNumber);
    } else if (onDiscardEmptyOrder) {
      onDiscardEmptyOrder(currentOrder.id, currentOrder.tableNumber);
    }
    toast.success('Pedido excluído com sucesso!');
    setDeleteConfirmOpen(false);
    setMoreOptionsOpen(false);
    onClose();
  };

  const formattedDate = currentOrder.createdAt
    ? format(new Date(currentOrder.createdAt), "dd-MM 'às' HH:mm")
    : format(new Date(), "dd-MM 'às' HH:mm");

  const displayMesaNum = currentOrder.tableNumber || tableNumber || 1;
  const shortOrderId = currentOrder.id.slice(0, 4);

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 font-sans">
        <div className="bg-card text-card-foreground w-full max-w-6xl rounded-md shadow-2xl overflow-hidden border border-border flex flex-col h-[92vh] max-h-[800px] animate-in zoom-in-95 duration-150">
          
          {/* Consumer Window Titlebar */}
          <div className="bg-muted/70 px-4 py-2 flex justify-between items-center border-b border-border shrink-0">
            <span className="text-sm font-semibold text-foreground">
              {currentOrder.orderType === 'mesa'
                ? `Comanda: ${displayMesaNum} (Pedido #${shortOrderId})`
                : `Pedido #${shortOrderId} (${currentOrder.orderType.toUpperCase()})`}
            </span>
            <button
              onClick={handleCloseAndSaveOrDiscard}
              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
              title="Fechar (ESC)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Top Inside Control Bar */}
          <div className="bg-muted/30 px-4 py-2.5 border-b border-border flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              {/* Green Table/Badge Icon */}
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 px-1">
                {String(displayMesaNum).padStart(2, '0')}
              </div>

              {/* Status Badge */}
              <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded">
                Em Aberto
              </span>

              <span className="text-sm font-bold text-foreground opacity-90">
                Pedido #{shortOrderId}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-1 max-w-md justify-end">
              {/* Search Bar */}
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar item..."
                  value={itemSearchQuery}
                  onChange={e => setItemSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                />
              </div>

              {/* + Produtos Button */}
              <Button
                onClick={() => setFinderOpen(true)}
                variant="outline"
                className="bg-card hover:bg-muted text-foreground border-border text-xs h-8 px-3 font-bold flex items-center gap-1.5 shadow-xs active:scale-95"
              >
                <Plus className="h-4 w-4 text-primary" /> Produtos
              </Button>
            </div>
          </div>

          {/* Body Split (Left Info Panel vs Right Order Items Panel) */}
          <div className="flex-1 flex overflow-hidden bg-background">
            
            {/* Left Info Panel */}
            <div className="w-72 bg-muted/20 border-r border-border p-4 flex flex-col justify-between overflow-y-auto shrink-0 text-xs gap-4">
              <div className="space-y-4">
                
                {/* Time & Creator */}
                <div className="space-y-1.5 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>🕒</span>
                    <span>Iniciado em {formattedDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>👤</span>
                    <span>Criado por: <strong className="text-foreground">{user?.name || 'Edvaldo'}</strong></span>
                  </div>
                </div>

                {/* Waiter Select Dropdown */}
                <div>
                  <select
                    value={assignedWaiter}
                    onChange={e => setAssignedWaiter(e.target.value)}
                    className="w-full bg-background border border-input text-foreground text-xs rounded p-2 focus:outline-none focus:border-primary"
                  >
                    <option value="Daniel">Daniel</option>
                    <option value="Edvaldo">Edvaldo</option>
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
                    className="bg-background border-input text-xs text-foreground placeholder:text-muted-foreground h-9"
                  />
                </div>

                <hr className="border-border" />

                {/* Table Indicator */}
                <div className="space-y-2">
                  <label className="text-muted-foreground font-medium block">
                    🪑 Mesa onde a comanda está
                  </label>
                  <Input
                    placeholder="Núm. da Mesa (Opcional)"
                    value={displayMesaNum}
                    readOnly
                    className="bg-background border-input text-xs text-foreground h-8"
                  />
                  <button
                    type="button"
                    onClick={() => toast.info('Funcionalidade de transferência disponível em Mais Opções > Trocar para...')}
                    className="text-primary hover:underline text-[11px] block mt-1"
                  >
                    Outras comandas nesta mesa
                  </button>
                </div>

                {/* Lock Order Toggle */}
                <div className="flex items-center gap-3 pt-2">
                  <Switch
                    checked={isLocked}
                    onCheckedChange={setIsLocked}
                    className="data-[state=checked]:bg-primary"
                  />
                  <span className="font-semibold text-foreground">Bloquear Pedido</span>
                </div>
              </div>

              {/* Bottom Action Links in Left Panel */}
              <div className="space-y-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCustomerModalOpen(true)}
                  className="w-full flex items-center gap-2 py-2 px-3 rounded hover:bg-muted text-foreground transition-colors text-left font-medium"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{currentOrder.customerName ? `Cliente: ${currentOrder.customerName}` : 'Vincular Cliente'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMoreOptionsOpen(true)}
                  className="w-full flex items-center gap-2 py-2 px-3 rounded hover:bg-muted text-foreground transition-colors text-left font-medium"
                >
                  <Menu className="h-4 w-4 text-muted-foreground" />
                  <span>Mais Opções</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseAndSaveOrDiscard}
                  className="w-full flex items-center gap-2 py-2 px-3 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-left font-medium"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Voltar</span>
                </button>
              </div>
            </div>

            {/* Right Panel: Launched Order Items */}
            <div className="flex-1 flex flex-col justify-between overflow-hidden bg-background">
              
              {/* Items List Table / Empty state */}
              <div className="flex-1 overflow-y-auto p-4">
                {filteredItems.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
                    Nenhum item lançado.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-muted/60 text-foreground border-b border-border shadow-xs">
                      <tr>
                        <th className="py-2 px-3 font-bold w-12 text-center">Qtd</th>
                        <th className="py-2 px-3 font-bold">Item / Descrição</th>
                        <th className="py-2 px-3 font-bold text-right w-24">Unitário</th>
                        <th className="py-2 px-3 font-bold text-right w-24">Subtotal</th>
                        <th className="py-2 px-3 font-bold text-center w-20">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-foreground">
                      {filteredItems.map(item => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3 text-center font-bold text-primary">
                            {item.quantity}x
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-foreground text-sm">{item.name}</div>

                            {/* Complements & Notes Detail */}
                            {item.selectedComplements && item.selectedComplements.length > 0 && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {item.selectedComplements.map((c, ci) => (
                                  <span key={ci} className="mr-2">
                                    + {c.quantity}x {c.name} ({fmt(c.price)})
                                  </span>
                                ))}
                              </div>
                            )}

                            {item.notes && (
                              <div className="text-[11px] text-amber-600 dark:text-amber-400 italic mt-0.5">
                                Obs: {item.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-muted-foreground">
                            R$ {fmt(item.price)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            R$ {fmt(item.subtotal)}
                          </td>

                          {/* Item Actions */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditItemCustomization(item)}
                                className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted"
                                title="Editar item"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
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
              <div className="bg-muted/40 p-4 border-t border-border flex justify-between items-center shrink-0 gap-4">
                
                {/* Total Summary */}
                <div>
                  <span className="text-xs text-muted-foreground block font-medium">TOTAL DO PEDIDO</span>
                  <span className="text-2xl font-extrabold text-foreground">R$ {fmt(totalAmount)}</span>
                </div>

                {/* Main Action Buttons */}
                <div className="flex items-center gap-3">
                  {/* Imprimir Button -> Opens Print Menu (Anexo 1) */}
                  <Button
                    variant="outline"
                    onClick={() => setPrintMenuOpen(true)}
                    className="bg-card border-border text-foreground hover:bg-muted h-11 px-4 text-xs font-bold flex items-center gap-2 shadow-xs"
                  >
                    <Printer className="h-4 w-4" /> Imprimir
                  </Button>

                  {/* PAGAMENTO Button */}
                  <Button
                    onClick={() => setCheckoutOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white h-11 px-6 text-sm font-extrabold flex items-center gap-2 shadow-lg tracking-wider active:scale-95 transition-all"
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

      {/* Print Options Dialog (Matching Anexo 1) */}
      <Dialog open={printMenuOpen} onOpenChange={setPrintMenuOpen}>
        <DialogContent className="bg-card text-card-foreground border-border max-w-sm p-4 font-sans shadow-xl">
          <div className="space-y-1 py-2">
            {/* Imprimir Conta */}
            <button
              type="button"
              onClick={handlePrintAccount}
              className="w-full text-center py-3 px-3 rounded bg-muted/60 hover:bg-muted text-sm font-bold text-foreground transition-colors"
            >
              Imprimir Conta
            </button>

            {/* Imprimir Conta e Bloquear */}
            <button
              type="button"
              onClick={handlePrintAccountAndLock}
              className="w-full text-center py-2.5 px-3 rounded hover:bg-muted text-sm text-foreground transition-colors"
            >
              Imprimir Conta e Bloquear
            </button>

            <hr className="border-border my-2" />

            {/* Imprimir na Cozinha */}
            <button
              type="button"
              onClick={handlePrintKitchenNew}
              disabled={unprintedCount === 0}
              className={`w-full text-center py-2.5 px-3 rounded text-sm transition-colors ${
                unprintedCount > 0
                  ? 'hover:bg-muted text-foreground font-medium'
                  : 'text-muted-foreground/60 cursor-not-allowed'
              }`}
            >
              {unprintedCount > 0 ? `Imprimir na Cozinha (${unprintedCount} novos)` : 'Não há itens novos para imprimir na Cozinha'}
            </button>

            {/* Reimprimir na Cozinha */}
            <button
              type="button"
              onClick={handleReprintKitchen}
              className="w-full text-center py-2.5 px-3 rounded hover:bg-muted text-sm text-foreground transition-colors"
            >
              Reimprimir na Cozinha
            </button>

            <hr className="border-border my-2" />

            {/* Cancelar */}
            <button
              type="button"
              onClick={() => setPrintMenuOpen(false)}
              className="w-full text-center py-2 px-3 rounded hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Selector Dialog */}
      <Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen}>
        <DialogContent className="bg-card text-card-foreground border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {customers.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum cliente cadastrado.</p>
            ) : (
              customers.map(c => (
                <div
                  key={c.id}
                  onClick={() => handleSelectCustomer(c)}
                  className="p-3 bg-muted/30 hover:bg-muted border border-border rounded cursor-pointer transition-colors flex justify-between items-center"
                >
                  <div>
                    <h5 className="font-bold text-sm text-foreground">{c.name}</h5>
                    <p className="text-xs text-muted-foreground">{c.phone || 'Sem telefone'}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs text-primary">
                    Selecionar
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mais Opções Dialog (Matching Anexo 3) */}
      <Dialog open={moreOptionsOpen} onOpenChange={setMoreOptionsOpen}>
        <DialogContent className="bg-card text-card-foreground border-border max-w-sm p-4 font-sans shadow-xl">
          <div className="space-y-1 py-2">
            <button
              type="button"
              onClick={() => setChangeTypeOpen(true)}
              className="w-full text-center py-2.5 px-3 rounded hover:bg-muted text-sm text-foreground transition-colors font-normal"
            >
              Trocar para...
            </button>

            <button
              type="button"
              onClick={handlePrintConsumptionTickets}
              className="w-full text-center py-2.5 px-3 rounded hover:bg-muted text-sm text-foreground transition-colors font-normal"
            >
              Imprimir Fichas de Consumo ({unprintedCount > 0 ? `${unprintedCount} Itens novos` : '0 Itens novos'})
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="w-full text-center py-2.5 px-3 rounded hover:bg-muted text-sm text-foreground transition-colors font-normal"
            >
              Enviar para WhatsApp
            </button>

            <button
              type="button"
              onClick={handleRecalculateOrder}
              className="w-full text-center py-2.5 px-3 rounded hover:bg-muted text-sm text-foreground transition-colors font-normal"
            >
              Recalcular Pedido
            </button>

            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded hover:bg-muted text-sm text-foreground transition-colors font-normal"
            >
              <Trash2 className="h-4 w-4 text-destructive" /> Excluir Pedido
            </button>

            <div className="pt-2">
              <hr className="border-border mb-2" />
              <button
                type="button"
                onClick={() => setMoreOptionsOpen(false)}
                className="w-full text-center py-2 px-3 rounded hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trocar Para... Sub-Menu Dialog (Matching Anexo 4) */}
      <Dialog open={changeTypeOpen} onOpenChange={setChangeTypeOpen}>
        <DialogContent className="bg-card text-card-foreground border-border max-w-sm p-4 font-sans shadow-xl">
          <div className="space-y-1 py-2">
            <button
              type="button"
              onClick={() => handleChangeOrderType('mesa')}
              className={`w-full text-center py-2.5 px-3 rounded hover:bg-muted text-sm transition-colors ${currentOrder.orderType === 'mesa' ? 'text-muted-foreground cursor-default font-semibold' : 'text-foreground'}`}
            >
              Mesa/Comanda {currentOrder.orderType === 'mesa' ? '(Atual)' : ''}
            </button>

            <button
              type="button"
              onClick={() => handleChangeOrderType('balcao')}
              className={`w-full text-center py-2.5 px-3 rounded hover:bg-muted text-sm transition-colors ${currentOrder.orderType === 'balcao' ? 'text-muted-foreground cursor-default font-semibold' : 'text-foreground'}`}
            >
              Balcão {currentOrder.orderType === 'balcao' ? '(Atual)' : ''}
            </button>

            <button
              type="button"
              onClick={() => handleChangeOrderType('caixa')}
              className={`w-full text-center py-2.5 px-3 rounded hover:bg-muted text-sm transition-colors ${currentOrder.orderType === 'caixa' ? 'text-muted-foreground cursor-default font-semibold' : 'text-foreground'}`}
            >
              Pedido no Caixa
            </button>

            <button
              type="button"
              onClick={() => handleChangeOrderType('delivery')}
              className={`w-full text-center py-2.5 px-3 rounded hover:bg-muted text-sm transition-colors ${currentOrder.orderType === 'delivery' ? 'text-muted-foreground cursor-default font-semibold' : 'text-foreground'}`}
            >
              Delivery {currentOrder.orderType === 'delivery' ? '(Atual)' : ''}
            </button>

            <div className="pt-2">
              <hr className="border-border mb-2" />
              <button
                type="button"
                onClick={() => setChangeTypeOpen(false)}
                className="w-full text-center py-2 px-3 rounded hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar (ESC)
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-card text-card-foreground border-border max-w-md p-5 font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Excluir Pedido #{shortOrderId}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-2">
              Tem certeza que deseja excluir este pedido? A comanda/mesa será liberada e esta ação não poderá ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="border-border text-foreground hover:bg-muted text-xs"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteOrder}
              className="text-xs font-bold"
            >
              Sim, Excluir Pedido
            </Button>
          </DialogFooter>
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
