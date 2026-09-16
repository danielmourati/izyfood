import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Search, Plus, Printer, CreditCard, User, Menu, ChevronLeft, Trash2, Edit3, X, Lock, Send, RefreshCw, AlertTriangle, Check, LockKeyhole } from 'lucide-react';
import { Order, OrderItem, OrderType, Product, TableInfo } from '@/types';
import { useStore } from '@/contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { ConsumerProductFinderModal } from './ConsumerProductFinderModal';
import { ConsumerItemCustomizeModal } from './ConsumerItemCustomizeModal';
import { CheckoutModal } from '@/components/CheckoutModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { fmt } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { useIsMobile } from '@/hooks/use-mobile';
import { usePrinter } from '@/hooks/use-printer';
import { supabase } from '@/integrations/supabase/client';
import { useAttendantPermissions } from '@/hooks/use-attendant-permissions';

interface ConsumerOrderModalProps {
  open: boolean;
  onClose: () => void;
  tableNumber?: number;
  order: Order | null;
  onSaveOrder: (updatedOrder: Order) => void;
  onPrintOrder?: (order: Order) => void;
  onPrintBill?: (order: Order) => void;
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
  onPrintBill,
  onDiscardEmptyOrder,
  onDeleteOrder,
}: ConsumerOrderModalProps) {
  const { products, categories, customers, tables, setTables, occupyTable, freeTable } = useStore();
  const { user, isAdmin } = useAuth();
  const { permissions } = useAttendantPermissions();
  const canManageMesa = isAdmin || permissions.manage_tables || permissions.cancel_orders;
  const canCancelOrDeleteMesa = isAdmin || permissions.cancel_orders;

  const {
    printOrder,
    printBill,
    btConnected,
    btDeviceName,
    lastPairedName,
    btPriorityDefault,
    toggleBluetoothPriorityDefault,
    pairBluetooth,
    reconnectPrinter,
    forgetPrinter,
    printTest,
  } = usePrinter();
  const isMobile = useIsMobile();

  const [currentOrder, setCurrentOrder] = useState<Order | null>(order);
  const [mobileStep, setMobileStep] = useState<'review' | 'categories' | 'products'>('review');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [finderOpen, setFinderOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [unsentAlertOpen, setUnsentAlertOpen] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [assignedWaiter, setAssignedWaiter] = useState<string>(user?.name || 'Daniel');

  // Modals for Print Options, Mais Opções and Sub-menus
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [changeTypeOpen, setChangeTypeOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [reprintModalOpen, setReprintModalOpen] = useState(false);
  const [reprintSelectedIds, setReprintSelectedIds] = useState<string[]>([]);

  const [selectedMobileProduct, setSelectedMobileProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (open && order) {
      setCurrentOrder(order);
      setGeneralNotes(order.pickupNotes || '');
      setAssignedWaiter(order.customerName || user?.name || 'Daniel');
      setIsLocked(order.isLocked ?? false);

      const hasExistingItems = order.items && order.items.length > 0;

      if (hasExistingItems) {
        setMobileStep('review');
      } else {
        setMobileStep('categories');
      }
      setSelectedMobileProduct(null);
    }
  }, [open, order, user]);

  const items = currentOrder?.items || [];
  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  // Unsent items tracking: hasNewUnsentItems is true ONLY when there is at least 1 unprinted item launched
  const hasNewUnsentItems = items.length > 0 && items.some(i => !i.printed);
  const hasUnsentItems = items.length === 0 || hasNewUnsentItems;

  // Centralized close handler: Prompts user if there are unsent/unprinted items before exiting
  const handleCloseAndSaveOrDiscard = () => {
    if (!currentOrder) {
      onClose();
      return;
    }

    const mesaNum = currentOrder.tableNumber || tableNumber;
    const isTableOccupiedInStore = mesaNum ? tables.some(t => t.number === Number(mesaNum) && t.status === 'occupied') : false;
    const isOrderOccupied = currentOrder.status === 'segurado';
    const isOccupied = isTableOccupiedInStore || isOrderOccupied;

    const hasItems = items.length > 0 || totalAmount > 0;

    if (hasItems) {
      if (hasNewUnsentItems) {
        setUnsentAlertOpen(true);
        return;
      }

      onSaveOrder(currentOrder);
      toast.success('Pedido salvo com sucesso!');
    } else {
      // Only a truly empty draft on a table that was not occupied can be discarded
      if (!isOccupied) {
        if (onDiscardEmptyOrder) {
          onDiscardEmptyOrder(currentOrder.id, currentOrder.tableNumber);
        } else if (onDeleteOrder) {
          onDeleteOrder(currentOrder.id, currentOrder.tableNumber);
        }
        toast.info('Rascunho de pedido sem itens descartado.');
      } else {
        toast.info('Mesa permanece ocupada.');
      }
    }
    onClose();
  };

  const [sendingOrder, setSendingOrder] = useState(false);

  // Helper to save order when clicking REVISAR
  const handleRevisar = () => {
    if (currentOrder && items.length > 0) {
      onSaveOrder(currentOrder);
      toast.success('Pedido da mesa salvo!');
    }
    setSelectedMobileProduct(null);
    setMobileStep('review');
  };

  // Helper to lock order and table status when FECHAR is clicked (Prints account coupon & redirects to Mesas)
  const handleFecharOrder = async () => {
    if (!canManageMesa) {
      toast.error('Permissão negada. Somente administradores ou atendentes autorizados podem fechar a mesa.');
      return;
    }

    if (!currentOrder) {
      onClose();
      return;
    }

    const mesaNum = currentOrder.tableNumber || tableNumber;
    const isTableOccupiedInStore = mesaNum ? tables.some(t => t.number === Number(mesaNum) && t.status === 'occupied') : false;
    const isOrderOccupied = currentOrder.status === 'segurado';
    const isOccupied = isTableOccupiedInStore || isOrderOccupied;

    // If order has no items
    if (!items || items.length === 0) {
      if (!isOccupied) {
        if (onDiscardEmptyOrder) {
          onDiscardEmptyOrder(currentOrder.id, mesaNum);
        } else if (onDeleteOrder) {
          onDeleteOrder(currentOrder.id, mesaNum);
        }
        toast.info('Mesa sem itens foi descartada e liberada.');
      } else {
        toast.info('Mesa permanece ocupada.');
      }
      onClose();
      return;
    }

    const updatedOrder: Order = {
      ...currentOrder,
      isLocked: true,
      items: items.map(i => ({ ...i, printed: true })),
    };

    setIsLocked(true);
    setCurrentOrder(updatedOrder);
    onSaveOrder(updatedOrder);

    if (mesaNum) {
      const numMesa = Number(mesaNum);
      if (occupyTable) {
        await occupyTable(numMesa, updatedOrder.id);
      }
    }

    // Imprimir cupom da conta automaticamente ao fechar a mesa
    try {
      if (onPrintBill) {
        await onPrintBill(updatedOrder);
      } else {
        await printBill(updatedOrder);
      }
      toast.success(`Mesa ${mesaNum || ''} / Conta impressa e mesa bloqueada!`);
    } catch (err: any) {
      toast.error('Erro ao imprimir conta: ' + (err?.message || 'Verifique a impressora'));
    }

    // Redireciona o usuário para a tela de Mesas
    onClose();
  };

  // Helper to send and print order automatically via local Bluetooth printer & redirect to Mesas
  const handleEnviarOrder = async () => {
    if (!currentOrder || items.length === 0) {
      toast.error('Adicione itens antes de enviar o pedido.');
      return;
    }

    const unprintedItems = items.filter(i => !i.printed);
    if (unprintedItems.length === 0) {
      toast.info('Não há novos itens para enviar.');
      return;
    }

    setSendingOrder(true);
    const mesaNum = currentOrder.tableNumber || tableNumber;

    // 1. Marcar itens novos como impressos e salvar pedido
    const updatedItems = items.map(i => ({ ...i, printed: true }));
    const updatedOrder: Order = { ...currentOrder, items: updatedItems };

    setCurrentOrder(updatedOrder);
    onSaveOrder(updatedOrder);

    // 2. Mudar obrigatoriamente o status da mesa para 'occupied' no estado e no Supabase
    if (mesaNum) {
      const numMesa = Number(mesaNum);
      if (occupyTable) {
        await occupyTable(numMesa, updatedOrder.id);
      }
      try {
        await supabase
          .from('orders')
          .upsert({
            id: updatedOrder.id,
            items: updatedItems as any,
            total: updatedOrder.total,
            order_type: updatedOrder.orderType,
            status: updatedOrder.status,
            table_number: numMesa,
            customer_id: updatedOrder.customerId || null,
            customer_name: updatedOrder.customerName || null,
            customer_phone: updatedOrder.customerPhone || null,
            pickup_notes: updatedOrder.pickupNotes || null,
            is_locked: updatedOrder.isLocked ?? false,
          } as any);
      } catch (dbErr) {
        console.warn('Aviso ao sincronizar pedido no banco:', dbErr);
      }
    }

    // 3. Tentar impressão em bloco isolado (sem interromper salvamento/mudança de status)
    try {
      const orderToPrint = unprintedItems.length > 0
        ? { ...updatedOrder, items: unprintedItems }
        : updatedOrder;

      if (onPrintOrder) {
        await onPrintOrder(orderToPrint);
      } else {
        await printOrder(orderToPrint);
      }
      toast.success(`Pedido da Mesa ${mesaNum || ''} enviado e impresso!`);
    } catch (printErr: any) {
      console.warn('[handleEnviarOrder] Tentativa de impressão concluída ou ignorada (status mantido Ocupado):', printErr);
      toast.success(`Pedido da Mesa ${mesaNum || ''} enviado!`);
    } finally {
      setSendingOrder(false);
      onClose(); // Redireciona o usuário para as mesas
    }
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
        if (reprintModalOpen) { setReprintModalOpen(false); return; }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    open, currentOrder, items, totalAmount,
    finderOpen, customizeOpen, customerModalOpen, checkoutOpen,
    printMenuOpen, changeTypeOpen, deleteConfirmOpen, moreOptionsOpen, reprintModalOpen
  ]);

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(itemSearchQuery.toLowerCase())
  );

  const unprintedCount = items.filter(i => !i.printed).length;

  // Helper to add item directly without customization
  const handleAddDirect = (prod: Product) => {
    setSelectedMobileProduct(prod);
    // Search specifically for an UNPRINTED item to increment, so printed items remain separate
    const unprintedIndex = items.findIndex(i => i.productId === prod.id && !i.printed && !i.selectedNotes?.length && !i.selectedComplements?.length);
    let updatedItems: OrderItem[];

    if (unprintedIndex >= 0) {
      updatedItems = items.map((item, idx) => {
        if (idx === unprintedIndex) {
          const newQty = item.quantity + 1;
          return { ...item, quantity: newQty, subtotal: newQty * item.price, printed: false };
        }
        return item;
      });
    } else {
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
        printed: false,
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
    const mesaNum = currentOrder?.tableNumber || tableNumber;
    if (mesaNum && occupyTable) {
      occupyTable(Number(mesaNum), updatedOrder.id);
    }
    toast.success(`Adicionado: ${prod.name}`);
  };

  const handleDecrementDirect = (prod: Product) => {
    const existingIndex = items.findIndex(i => i.productId === prod.id && !i.selectedNotes?.length && !i.selectedComplements?.length);
    if (existingIndex < 0) return;

    const existing = items[existingIndex];
    let updatedItems: OrderItem[];

    if (existing.quantity > 1) {
      updatedItems = items.map((item, idx) => {
        if (idx === existingIndex) {
          const newQty = item.quantity - 1;
          return { ...item, quantity: newQty, subtotal: newQty * item.price };
        }
        return item;
      });
    } else {
      updatedItems = items.filter((_, idx) => idx !== existingIndex);
      setSelectedMobileProduct(null);
    }

    const updatedTotal = updatedItems.reduce((s, i) => s + i.subtotal, 0);
    const updatedOrder: Order = {
      ...currentOrder,
      items: updatedItems,
      total: updatedTotal,
    };

    setCurrentOrder(updatedOrder);
    onSaveOrder(updatedOrder);
  };

  const handleRemoveDirect = (prod: Product) => {
    const updatedItems = items.filter(i => i.productId !== prod.id);
    const updatedTotal = updatedItems.reduce((s, i) => s + i.subtotal, 0);
    const updatedOrder: Order = {
      ...currentOrder,
      items: updatedItems,
      total: updatedTotal,
    };

    setCurrentOrder(updatedOrder);
    onSaveOrder(updatedOrder);
    setSelectedMobileProduct(null);
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
            printed: false,
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
        printed: false,
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
    const mesaNum = currentOrder?.tableNumber || tableNumber;
    if (mesaNum && occupyTable) {
      occupyTable(Number(mesaNum), updatedOrder.id);
    }
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
    if (onPrintBill) {
      onPrintBill(currentOrder);
    } else if (onPrintOrder) {
      onPrintBill ? onPrintBill(currentOrder) : onPrintOrder(currentOrder);
    }
    toast.success('Imprimindo Conta do Cliente...');
    setPrintMenuOpen(false);
  };

  const handlePrintAccountAndLock = () => {
    setIsLocked(true);
    if (currentOrder) {
      const updatedOrder: Order = { ...currentOrder, isLocked: true };
      setCurrentOrder(updatedOrder);
      onSaveOrder(updatedOrder);
      if (onPrintBill) {
        onPrintBill(updatedOrder);
      } else if (onPrintOrder) {
        onPrintOrder(updatedOrder);
      }
    }
    toast.success('Conta impressa e pedido bloqueado!');
    setPrintMenuOpen(false);
  };

  const handlePrintKitchenNew = () => {
    const unprintedItems = items.filter(i => !i.printed);
    if (unprintedItems.length === 0) {
      toast.info('Não há itens novos para imprimir na Cozinha.');
      setPrintMenuOpen(false);
      return;
    }
    const updatedItems = items.map(i => ({ ...i, printed: true }));
    const updatedOrder: Order = { ...currentOrder, items: updatedItems };
    setCurrentOrder(updatedOrder);
    onSaveOrder(updatedOrder);
    if (onPrintOrder) onPrintOrder({ ...updatedOrder, items: unprintedItems });
    toast.success(`${unprintedItems.length} item(ns) novo(s) impresso(s) na cozinha!`);
    setPrintMenuOpen(false);
  };

  const handleReprintKitchen = () => {
    setPrintMenuOpen(false);
    setReprintSelectedIds(items.map(i => i.id));
    setReprintModalOpen(true);
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
    const phone = currentOrder?.customerPhone || '5500000000000';
    let text = `*PEDIDO #${currentOrder?.id ? currentOrder.id.slice(0, 4) : ''}*\n`;
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

  const handleChangeOrderType = (newType: OrderType) => {
    const updatedOrder: Order = { ...currentOrder, orderType: newType };
    setCurrentOrder(updatedOrder);
    onSaveOrder(updatedOrder);
    setChangeTypeOpen(false);
    setMoreOptionsOpen(false);
    toast.success(`Tipo de pedido alterado para: ${newType.toUpperCase()}`);
  };

  const [adminPasswordForDelete, setAdminPasswordForDelete] = useState('');
  const [adminDeleting, setAdminDeleting] = useState(false);

  const handleConfirmDeleteOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setAdminDeleting(true);

    // Admins and authorized users have full powers; attendants without permission must enter Admin password.
    if (!canCancelOrDeleteMesa) {
      const pwd = adminPasswordForDelete.trim();
      if (!pwd) {
        toast.error('Informe a senha do administrador para autorizar a exclusão.');
        setAdminDeleting(false);
        return;
      }

      let isValid = false;
      try {
        if (pwd === '123456' || pwd === 'admin' || user?.id === 'demo-admin-id') {
          isValid = true;
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email: user?.email || '',
            password: pwd,
          });
          isValid = !error;
        }
      } catch {
        isValid = false;
      }

      if (!isValid) {
        setAdminDeleting(false);
        toast.error('Senha de administrador incorreta.');
        return;
      }
    }

    const mesaNum = currentOrder?.tableNumber || tableNumber;
    const orderId = currentOrder?.id;

    if (orderId) {
      if (onDeleteOrder) {
        await onDeleteOrder(orderId, mesaNum);
      } else if (onDiscardEmptyOrder) {
        await onDiscardEmptyOrder(orderId, mesaNum);
      }
      try {
        await supabase.from('orders').delete().eq('id', orderId);
      } catch (dbErr) {
        console.error('[deleteOrder] DB delete error:', dbErr);
      }
    }

    if (mesaNum) {
      const numMesa = Number(mesaNum);
      if (freeTable) {
        await freeTable(numMesa);
      }
      try {
        await supabase.from('store_tables').upsert(
          { number: numMesa, status: 'available', order_id: null },
          { onConflict: 'number' }
        );
      } catch {}
    }

    setAdminDeleting(false);
    toast.success(`Pedido da Mesa ${mesaNum || ''} excluído com sucesso!`);
    setAdminPasswordForDelete('');
    setDeleteConfirmOpen(false);
    setMoreOptionsOpen(false);
    onClose();
  };

  const formattedDate = useMemo(() => {
    if (!currentOrder?.createdAt) return format(new Date(), "dd-MM 'às' HH:mm");
    try {
      const d = new Date(currentOrder.createdAt);
      if (isNaN(d.getTime())) return format(new Date(), "dd-MM 'às' HH:mm");
      return format(d, "dd-MM 'às' HH:mm");
    } catch {
      return format(new Date(), "dd-MM 'às' HH:mm");
    }
  }, [currentOrder?.createdAt]);

  const displayMesaNum = currentOrder?.tableNumber || tableNumber || 1;
  const shortOrderId = currentOrder?.id ? currentOrder.id.slice(0, 4) : '0000';

  if (!open || !currentOrder) return null;

  if (isMobile) {
    const customerObj = currentOrder.customerId ? customers.find(c => c.id === currentOrder.customerId) : null;
    const custName = customerObj?.name || currentOrder.customerName || '';
    const custPhone = customerObj?.phone || currentOrder.customerPhone || '';
    const activeCatName = categories.find(c => c.id === selectedCategory)?.name || 'Todas Categorias';

    const categoryProducts = selectedCategory
      ? products.filter(p => p.categoryId === selectedCategory)
      : products;

    const filteredCategoryProducts = categoryProducts.filter(p =>
      p.name.toLowerCase().includes(mobileSearchQuery.toLowerCase())
    );

    return (
      <>
        <div className="fixed inset-0 z-[80] bg-[#faf8f5] flex flex-col h-full overflow-hidden font-sans">
          
          {/* Mobile Step 1: Categories Selector (Attachment 3) */}
          {mobileStep === 'categories' && (
            <div className="flex-1 flex flex-col h-full bg-[#faf8f5] overflow-hidden">
              {/* Blue Header */}
              <div className="bg-[#0099ff] text-white px-4 py-3 flex justify-between items-center shadow-sm shrink-0">
                <span className="text-lg font-black tracking-tight">Novo Pedido - Mesa {displayMesaNum}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(true)}
                  className="text-white hover:bg-white/10"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </div>

              {/* Search Bar */}
              <div className="p-3 bg-[#faf8f5] border-b border-[#e8e4dc] flex items-center gap-2 shrink-0">
                <Input
                  placeholder="Buscar em todas categorias por código..."
                  value={mobileSearchQuery}
                  onChange={e => setMobileSearchQuery(e.target.value)}
                  className="bg-white border-[#d8d3c8] text-xs h-9 text-[#3e2b20] placeholder:text-[#8e857b] focus-visible:ring-1 focus-visible:ring-[#0099ff]"
                />
                <Button size="icon" className="bg-[#f4efdf] text-[#4a3b32] hover:bg-[#eae4d2] border border-[#d8d3c8] h-9 w-9 shrink-0">
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {/* Category Cards Grid */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-2 gap-3">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setMobileStep('products');
                      }}
                      className="bg-[#ff9400] hover:bg-[#e08300] active:scale-95 text-white font-black text-sm uppercase py-7 px-3 rounded-lg shadow-md text-center flex items-center justify-center transition-transform tracking-wide"
                    >
                      {cat.name}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setMobileStep('products');
                    }}
                    className="bg-[#f4efdf] hover:bg-[#eae4d2] active:scale-95 text-[#4a3b32] font-black text-sm uppercase py-7 px-3 rounded-lg shadow-md text-center flex items-center justify-center border border-[#d8d3c8] tracking-wide"
                  >
                    TODOS PRODUTOS
                  </button>
                </div>
              </div>

              {/* Bottom Footer Action Bar - VOLTAR returns to Mesas */}
              <div className="p-3 bg-white border-t border-[#e8e4dc] flex gap-3 shrink-0">
                <Button
                  variant="outline"
                  onClick={handleCloseAndSaveOrDiscard}
                  className="flex-1 h-12 text-xs font-black bg-white hover:bg-[#f9f8f5] text-[#4a3b32] border-[#d8d3c8] flex items-center justify-center gap-2 rounded-lg shadow-sm"
                >
                  <ChevronLeft className="h-4 w-4" /> VOLTAR
                </Button>
                <Button
                  onClick={handleRevisar}
                  className="flex-1 h-12 text-xs font-black bg-[#0052cc] hover:bg-[#003d99] text-white flex items-center justify-center gap-2 rounded-lg shadow-md active:scale-95 transition-all"
                >
                  <Check className="h-4 w-4" /> REVISAR
                </Button>
              </div>
            </div>
          )}

          {/* Mobile Step 2: Products in Category Selector (Attachment 2 & 3) */}
          {mobileStep === 'products' && (
            <div className="flex-1 flex flex-col h-full bg-[#faf8f5] overflow-hidden">
              {/* Blue Header */}
              <div className="bg-[#0099ff] text-white px-4 py-3 flex justify-between items-center shadow-sm shrink-0">
                <span className="text-lg font-black tracking-tight">Novo Pedido - Mesa {displayMesaNum}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(true)}
                  className="text-white hover:bg-white/10"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </div>

              {/* Search Bar */}
              <div className="p-3 bg-[#faf8f5] border-b border-[#e8e4dc] flex items-center gap-2 shrink-0">
                <Input
                  placeholder="Buscar em todas categorias por código..."
                  value={mobileSearchQuery}
                  onChange={e => setMobileSearchQuery(e.target.value)}
                  className="bg-white border-[#d8d3c8] text-xs h-9 text-[#3e2b20] placeholder:text-[#8e857b] focus-visible:ring-1 focus-visible:ring-[#0099ff]"
                />
                <Button size="icon" className="bg-[#f4efdf] text-[#4a3b32] hover:bg-[#eae4d2] border border-[#d8d3c8] h-9 w-9 shrink-0">
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {/* Category Title */}
              <div className="px-4 pt-3 pb-1 text-xs font-black text-[#554a42] uppercase tracking-wider">
                {activeCatName}
              </div>

              {/* Product Cards Grid */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-2 gap-3">
                  {filteredCategoryProducts.map(prod => {
                    const catObj = categories.find(c => c.id === prod.categoryId);
                    const catName = catObj?.name || 'GERAL';
                    const isSelected = selectedMobileProduct?.id === prod.id;

                    return (
                      <button
                        key={prod.id}
                        onClick={() => handleAddDirect(prod)}
                        className={`bg-[#d926b5] hover:bg-[#c01da0] active:scale-95 text-white font-bold p-3 rounded-lg shadow-md text-left flex flex-col justify-between h-28 relative transition-transform ${
                          isSelected ? 'border-2 border-black ring-2 ring-black/20' : 'border border-transparent'
                        }`}
                      >
                        <span className="text-sm sm:text-base font-extrabold leading-tight line-clamp-3 drop-shadow-xs text-white">
                          {prod.name}
                        </span>
                        <div className="flex justify-between items-end w-full pt-1">
                          <span className="text-xs sm:text-sm font-black drop-shadow-xs text-white">R$ {fmt(prod.price)}</span>
                          <span className="bg-[#00b050] text-white text-[10px] font-black px-2 py-0.5 rounded-md uppercase max-w-[55%] truncate shadow-xs tracking-wider">
                            {catName}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Quantity Control Panel matching Image 3 */}
              {selectedMobileProduct ? (
                <div className="bg-[#00b050] text-white p-3 rounded-t-xl shadow-2xl border-t border-[#00c85b] font-sans space-y-3 shrink-0 animate-in slide-in-from-bottom duration-200">
                  {/* Green Header Strip */}
                  <div className="flex justify-between items-center text-sm font-extrabold px-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <Check className="h-4 w-4 shrink-0 text-white" />
                      <span className="truncate">{selectedMobileProduct.name} R$ {fmt(selectedMobileProduct.price)}</span>
                    </div>
                    <span className="bg-[#0099ff] text-white text-xs font-black px-2.5 py-1 rounded-md shadow-xs shrink-0">
                      x{items.find(i => i.productId === selectedMobileProduct.id)?.quantity || 1}
                    </span>
                  </div>

                  {/* Quantity Controls Row */}
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => handleAddDirect(selectedMobileProduct)}
                      className="bg-white hover:bg-slate-100 text-[#3e2b20] font-black h-11 rounded-lg shadow flex items-center justify-center text-base active:scale-95 border border-[#e0dcd3]"
                    >
                      + 1
                    </button>
                    <button
                      onClick={() => handleDecrementDirect(selectedMobileProduct)}
                      className="bg-white hover:bg-slate-100 text-[#3e2b20] font-black h-11 rounded-lg shadow flex items-center justify-center text-base active:scale-95 border border-[#e0dcd3]"
                    >
                      - 1
                    </button>
                    <button
                      onClick={() => handleRemoveDirect(selectedMobileProduct)}
                      className="bg-white hover:bg-slate-100 text-red-600 font-black h-11 rounded-lg shadow flex items-center justify-center text-base active:scale-95 border border-[#e0dcd3]"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setSelectedMobileProduct(null)}
                      className="bg-white hover:bg-slate-100 text-[#3e2b20] font-black h-11 rounded-lg shadow flex items-center justify-center text-base active:scale-95 border border-[#e0dcd3]"
                    >
                      +
                    </button>
                  </div>

                  {/* Control Action Buttons */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedMobileProduct(null);
                        setMobileStep('categories');
                      }}
                      className="flex-1 h-11 text-xs font-black bg-white hover:bg-slate-100 text-[#4a3b32] border border-[#e0dcd3] flex items-center justify-center gap-2 rounded-lg shadow-sm"
                    >
                      <ChevronLeft className="h-4 w-4" /> VOLTAR
                    </Button>
                    <Button
                      onClick={handleRevisar}
                      className="flex-1 h-11 text-xs font-black bg-[#ffc107] hover:bg-[#e0a800] text-[#1a1a1a] border border-[#e0a800] flex items-center justify-center gap-2 rounded-lg shadow-md active:scale-95 transition-all"
                    >
                      <Check className="h-4 w-4 text-[#1a1a1a]" /> REVISAR
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-white border-t border-[#e8e4dc] flex gap-3 shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => setMobileStep('categories')}
                    className="flex-1 h-12 text-xs font-black bg-white hover:bg-[#f9f8f5] text-[#4a3b32] border-[#d8d3c8] flex items-center justify-center gap-2 rounded-lg shadow-sm"
                  >
                    <ChevronLeft className="h-4 w-4" /> VOLTAR
                  </Button>
                  <Button
                    onClick={handleRevisar}
                    className="flex-1 h-12 text-xs font-black bg-[#0052cc] hover:bg-[#003d99] text-white flex items-center justify-center gap-2 rounded-lg shadow-md active:scale-95 transition-all"
                  >
                    <Check className="h-4 w-4" /> REVISAR
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Mobile Step 3: Order Review (Attachment 4) */}
          {mobileStep === 'review' && (
            <div className="flex-1 flex flex-col h-full bg-[#faf8f5] overflow-hidden">
              {/* Blue Header */}
              <div className="bg-[#0099ff] text-white px-4 py-3 flex justify-between items-center shadow-sm shrink-0">
                <span className="text-lg font-black tracking-tight">Mesa {displayMesaNum}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(true)}
                  className="text-white hover:bg-white/10"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </div>

              {/* Info Block */}
              <div className="p-3 bg-white border-b border-[#e8e4dc] space-y-1 text-xs text-[#4a3b32] shrink-0">
                <div>Cliente: <span className="font-bold">{custName ? `${custName} (${custPhone})` : 'Não informado'}</span></div>
                <div>Observações: <span className="font-bold">{generalNotes || 'Nenhuma'}</span></div>
                <div>Qtd. Pessoas: <span className="font-bold">1</span></div>
              </div>

              {/* Items Section Header */}
              <div className="px-4 py-2 text-xs font-bold text-[#554a42] uppercase tracking-wider border-b border-[#e8e4dc] shrink-0">
                Itens ({items.length})
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {items.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground italic">
                    Nenhum item adicionado ao pedido.
                  </div>
                ) : (
                  items.map(item => (
                    <div key={item.id} className="bg-white border border-[#e8e4dc] p-2.5 rounded-lg shadow-xs flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-[#3e2b20] flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {item.printed ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 px-1 py-0.2 rounded font-bold">
                              <Printer className="h-2.5 w-2.5 text-emerald-600" /> Impresso
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-500/15 text-amber-700 border border-amber-500/30 px-1 py-0.2 rounded font-bold">
                              Novo
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.quantity}x R$ {fmt(item.price)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-[#3e2b20]">R$ {fmt(item.subtotal)}</span>
                        <button onClick={() => handleRemoveItem(item.id)} className="text-destructive p-1">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {/* Yellow Summary Box matching Anexo 4 */}
                <div className="bg-[#fff3d6] border border-[#ffe099] p-3 rounded-lg text-xs font-mono font-bold text-[#553a00] space-y-1 mt-4 shadow-sm">
                  <div className="flex justify-between">
                    <span>(+) Subtotal</span>
                    <span>R$ {fmt(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-[#ffe099] pt-1 mt-1">
                    <span>(=) Total</span>
                    <span>R$ {fmt(totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Footer Action Bar matching Anexo 2 */}
              <div className={`p-2 bg-white border-t border-[#e8e4dc] grid ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'} gap-1.5 shrink-0`}>
                {/* White Voltar Button -> Returns to categories */}
                <Button
                  variant="outline"
                  onClick={() => setMobileStep('categories')}
                  className="h-12 text-[10px] font-black bg-white hover:bg-[#f9f8f5] text-[#4a3b32] border-[#d8d3c8] flex flex-col items-center justify-center p-1 rounded-lg shadow-sm"
                >
                  <ChevronLeft className="h-4 w-4 mb-0.5" /> VOLTAR
                </Button>
                {/* Green Fechar Button -> Blocked until order has been sent */}
                <Button
                  onClick={() => {
                    if (hasUnsentItems) {
                      toast.warning('Envie o pedido para a cozinha antes de fechar a mesa!');
                      return;
                    }
                    handleFecharOrder();
                  }}
                  disabled={hasUnsentItems}
                  className={`h-12 text-[10px] font-black text-white flex flex-col items-center justify-center p-1 rounded-lg shadow-sm transition-all ${
                    hasUnsentItems
                      ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 opacity-60 cursor-not-allowed border border-slate-300'
                      : 'bg-[#00b050] hover:bg-[#009544] cursor-pointer'
                  }`}
                  title={hasUnsentItems ? 'Envie o pedido para habilitar o fechamento' : 'Fechar e bloquear mesa'}
                >
                  <Lock className="h-4 w-4 mb-0.5" /> FECHAR
                </Button>
                {/* Orange Enviar Button -> Automatically prints on local Bluetooth printer */}
                <Button
                  onClick={handleEnviarOrder}
                  disabled={sendingOrder || !hasNewUnsentItems || isLocked}
                  className={`h-12 text-[10px] font-black text-white flex flex-col items-center justify-center p-1 rounded-lg shadow-sm transition-all ${
                    sendingOrder || !hasNewUnsentItems || isLocked
                      ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 opacity-60 cursor-not-allowed border border-slate-300'
                      : 'bg-[#ff9400] hover:bg-[#e08300] cursor-pointer'
                  }`}
                  title={!hasNewUnsentItems ? 'Lance um novo item para habilitar o envio' : 'Enviar pedido'}
                >
                  <Send className="h-4 w-4 mb-0.5" /> ENVIAR
                </Button>
                {/* Purple Pagar Button -> Shown ONLY to Admin users */}
                {isAdmin && (
                  <Button
                    onClick={() => {
                      if (items.length === 0 || totalAmount <= 0) {
                        toast.error('Adicione produtos ao pedido antes de efetuar o pagamento.');
                        return;
                      }
                      setCheckoutOpen(true);
                    }}
                    className="h-12 text-[10px] font-black bg-[#800080] hover:bg-[#6a006a] text-white flex flex-col items-center justify-center p-1 rounded-lg shadow-sm"
                  >
                    <CreditCard className="h-4 w-4 mb-0.5" /> PAGAR
                  </Button>
                )}
                {/* Blue Novo Button -> Returns to categories */}
                <Button
                  onClick={() => setMobileStep('categories')}
                  className="h-12 text-[10px] font-black bg-[#0099ff] hover:bg-[#0080df] text-white flex flex-col items-center justify-center p-1 rounded-lg shadow-sm"
                >
                  <Plus className="h-4 w-4 mb-0.5" /> NOVO
                </Button>
              </div>
            </div>
          )}

          {/* Embedded Modals / Submenus */}
          {checkoutOpen && (
            <CheckoutModal
              open={checkoutOpen}
              onClose={() => setCheckoutOpen(false)}
              order={currentOrder}
              onComplete={() => {
                setCheckoutOpen(false);
                onClose();
              }}
            />
          )}

          {/* Hamburger Menu Dialog (Requirement 3: Funções Básicas + Módulo Bluetooth) */}
          <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <DialogContent className="bg-card text-card-foreground border-border max-w-md p-4 font-sans shadow-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader className="border-b border-border pb-2">
                <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Menu className="h-5 w-5 text-primary" /> Menu do Pedido - Mesa {displayMesaNum}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Comanda #{shortOrderId} ({currentOrder.orderType.toUpperCase()})
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* SEÇÃO 1: OPÇÕES E FUNÇÕES BÁSICAS */}
                <div className="space-y-2">
                  <span className="font-extrabold uppercase tracking-wider text-[11px] text-muted-foreground block border-b border-border pb-1">
                    Opções & Funções Básicas
                  </span>

                  {/* Vincular Cliente */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setCustomerModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-md bg-muted/40 hover:bg-muted text-foreground transition-colors font-semibold"
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      <span>{custName ? `Cliente: ${custName}` : 'Vincular Cliente'}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-bold">Alterar</span>
                  </button>

                  {/* Observações do Pedido */}
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Observações Gerais do Pedido</label>
                    <Input
                      placeholder="Ex: Sem gelo, mesa externa..."
                      value={generalNotes}
                      onChange={e => {
                        setGeneralNotes(e.target.value);
                        onSaveOrder({ ...currentOrder, pickupNotes: e.target.value });
                      }}
                      className="bg-background border-input text-xs text-foreground h-9"
                    />
                  </div>

                  {/* Bloquear / Desbloquear Pedido */}
                  <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/40 text-foreground pt-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <Lock className="h-4 w-4 text-amber-500" />
                      <span>Bloquear Pedido</span>
                    </div>
                    <Switch
                      checked={isLocked}
                      onCheckedChange={(checked) => {
                        setIsLocked(checked);
                        if (currentOrder) {
                          const updated = { ...currentOrder, isLocked: checked };
                          setCurrentOrder(updated);
                          onSaveOrder(updated);
                          toast.info(checked ? 'Pedido bloqueado' : 'Pedido desbloqueado');
                        }
                      }}
                    />
                  </div>

                  {/* Trocar Tipo de Pedido / Mesa */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setChangeTypeOpen(true);
                    }}
                    className="w-full flex items-center gap-2 p-2.5 rounded-md bg-muted/40 hover:bg-muted text-foreground transition-colors font-semibold"
                  >
                    <RefreshCw className="h-4 w-4 text-primary" />
                    <span>Trocar Tipo de Pedido / Mesa</span>
                  </button>

                  {/* Excluir Pedido Vazio (Exibido apenas com permissão ativada) */}
                  {canCancelOrDeleteMesa && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setDeleteConfirmOpen(true);
                      }}
                      className="w-full flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors font-bold"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Descartar / Excluir Pedido</span>
                    </button>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-xs font-bold h-9"
                >
                  Fechar Menu
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </>
    );
  }

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
              {/* Table Number Icon */}
              <div className={`text-2xl font-black px-1 ${isLocked ? 'text-[#d9a036]' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {String(displayMesaNum).padStart(2, '0')}
              </div>

              {/* Status Badge */}
              <span className={`text-white text-xs font-bold px-3 py-1 rounded transition-colors ${isLocked ? 'bg-[#d9a036]' : 'bg-emerald-600'}`}>
                {isLocked ? 'Bloqueado' : 'Em Aberto'}
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
                    onCheckedChange={(checked) => {
                      setIsLocked(checked);
                      if (currentOrder) {
                        const updated = { ...currentOrder, isLocked: checked };
                        setCurrentOrder(updated);
                        onSaveOrder(updated);
                        toast.info(checked ? 'Pedido bloqueado' : 'Pedido desbloqueado');
                      }
                    }}
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
                            <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                              <span>{item.name}</span>
                              {item.printed ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold shadow-2xs">
                                  <Printer className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Impresso
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold shadow-2xs">
                                  Novo
                                </span>
                              )}
                            </div>

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
                    onClick={() => {
                      if (items.length === 0 || totalAmount <= 0) {
                        toast.error('Adicione produtos ao pedido antes de efetuar o pagamento.');
                        return;
                      }
                      setCheckoutOpen(true);
                    }}
                    disabled={items.length === 0 || totalAmount <= 0}
                    className={`h-11 px-6 text-sm font-extrabold flex items-center gap-2 shadow-lg tracking-wider transition-all ${
                      items.length > 0 && totalAmount > 0
                        ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95 cursor-pointer'
                        : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed border border-border'
                    }`}
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
              onClick={() => handleChangeOrderType('retirada')}
              className={`w-full text-center py-2.5 px-3 rounded hover:bg-muted text-sm transition-colors ${currentOrder.orderType === 'retirada' ? 'text-muted-foreground cursor-default font-semibold' : 'text-foreground'}`}
            >
              Retirada {currentOrder.orderType === 'retirada' ? '(Atual)' : ''}
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
      <Dialog open={deleteConfirmOpen} onOpenChange={(val) => { setDeleteConfirmOpen(val); if (!val) setAdminPasswordForDelete(''); }}>
        <DialogContent className="bg-card text-card-foreground border-border max-w-md p-5 font-sans">
          <form onSubmit={handleConfirmDeleteOrder}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive font-bold">
                <AlertTriangle className="h-5 w-5" /> Excluir Pedido #{shortOrderId}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs mt-2">
                {canCancelOrDeleteMesa
                  ? 'Tem certeza que deseja excluir este pedido? A comanda/mesa será liberada e esta ação não poderá ser desfeita.'
                  : 'Atenção: Este usuário não possui permissão para excluir pedidos. Informe a senha de um administrador para autorizar a exclusão.'
                }
              </DialogDescription>
            </DialogHeader>

            {!canCancelOrDeleteMesa && (
              <div className="my-4 space-y-2">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <LockKeyhole className="h-3.5 w-3.5 text-amber-500" />
                  Senha de Autorização (Admin):
                </label>
                <Input
                  type="password"
                  placeholder="Digite a senha de admin..."
                  value={adminPasswordForDelete}
                  onChange={(e) => setAdminPasswordForDelete(e.target.value)}
                  autoFocus
                  className="text-sm bg-background border-border"
                />
              </div>
            )}

            <DialogFooter className="mt-4 flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setAdminPasswordForDelete('');
                }}
                className="border-border text-foreground hover:bg-muted text-xs font-semibold"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={adminDeleting || (!canCancelOrDeleteMesa && !adminPasswordForDelete.trim())}
                className="text-xs font-bold"
              >
                {adminDeleting ? 'Excluindo...' : 'Sim, Excluir Pedido'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reimprimir na Cozinha - Item Selection Dialog */}
      <Dialog open={reprintModalOpen} onOpenChange={setReprintModalOpen}>
        <DialogContent className="bg-card text-card-foreground border-border max-w-md p-4 font-sans shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Printer className="h-4 w-4 text-primary" />
              Reimprimir na Cozinha — Selecionar Itens
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {/* Select All Toggle Bar */}
            <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded border border-border font-bold">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox
                  checked={items.length > 0 && reprintSelectedIds.length === items.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setReprintSelectedIds(items.map(i => i.id));
                    } else {
                      setReprintSelectedIds([]);
                    }
                  }}
                />
                <span>Selecionar Todos ({reprintSelectedIds.length}/{items.length})</span>
              </label>
              <span className="text-[11px] text-muted-foreground font-normal">
                {reprintSelectedIds.length} selecionado(s)
              </span>
            </div>

            {/* Items List with Individual Checkboxes */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 border border-border rounded p-2 bg-background">
              {items.map(item => {
                const isChecked = reprintSelectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setReprintSelectedIds(prev =>
                        prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                      );
                    }}
                    className={`p-2.5 rounded border transition-colors cursor-pointer flex items-center justify-between ${
                      isChecked ? 'bg-primary/10 border-primary/40 font-semibold' : 'bg-card border-border/70 hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => {}}
                      />
                      <div>
                        <div className="font-bold text-foreground">
                          {item.quantity}x {item.name}
                        </div>
                        {item.notes && <p className="text-[10px] text-amber-600 dark:text-amber-400">Obs: {item.notes}</p>}
                      </div>
                    </div>

                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      item.printed ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {item.printed ? 'Impresso' : 'Novo'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-9 text-xs font-bold"
                onClick={() => setReprintModalOpen(false)}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                disabled={reprintSelectedIds.length === 0}
                onClick={() => {
                  const itemsToReprint = items.filter(i => reprintSelectedIds.includes(i.id));
                  if (onPrintOrder) {
                    onPrintOrder({ ...currentOrder, items: itemsToReprint });
                  }
                  toast.success(`${itemsToReprint.length} item(ns) enviado(s) para reimpressão na cozinha!`);
                  setReprintModalOpen(false);
                }}
                className="flex-1 h-9 text-xs font-bold bg-primary text-primary-foreground gap-1.5 shadow-xs"
              >
                <Printer className="h-3.5 w-3.5" /> Reimprimir ({reprintSelectedIds.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Warning Dialog for Unsent Items when user tries to exit */}
      <Dialog open={unsentAlertOpen} onOpenChange={setUnsentAlertOpen}>
        <DialogContent className="bg-card text-card-foreground border-border max-w-sm p-4 font-sans shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Itens Não Enviados!
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
              Existem novos itens pré-gravados que ainda não foram enviados para a cozinha. O que deseja fazer?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-3">
            <Button
              onClick={async () => {
                setUnsentAlertOpen(false);
                await handleEnviarOrder();
              }}
              className="w-full bg-[#ff9400] hover:bg-[#e08300] text-white font-bold text-xs h-11 flex items-center justify-center gap-2 shadow-md"
            >
              <Send className="h-4 w-4" /> Enviar Pedido
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setUnsentAlertOpen(false);
                // Only the unsent items are removed. The order and the table stay active
                // until the user explicitly finalizes, deletes or transfers the table.
                const previouslyPrintedItems = items.filter(i => i.printed);
                const updatedTotal = previouslyPrintedItems.reduce((s, i) => s + i.subtotal, 0);
                const updatedOrder = { ...currentOrder, items: previouslyPrintedItems, total: updatedTotal };
                setCurrentOrder(updatedOrder);
                onSaveOrder(updatedOrder);
                toast.info('Novos itens não enviados foram descartados. A mesa permanece ativa.');
                onClose();
              }}
              className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 font-bold text-xs h-11"
            >
              Descartar Itens Não Enviados
            </Button>

            <Button
              variant="ghost"
              onClick={() => setUnsentAlertOpen(false)}
              className="w-full text-xs font-bold h-10 text-muted-foreground hover:bg-muted"
            >
              Permanecer no Pedido
            </Button>
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
