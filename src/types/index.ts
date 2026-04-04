export type ProductType = 'unit' | 'weight';

export interface ProductCategory {
  id: string;
  name: string;
}
export type OrderType = 'balcao' | 'mesa' | 'delivery' | 'retirada';
export type OrderStatus = 'aberto' | 'segurado' | 'finalizado' | 'cancelado' | 'pronto';
export type DeliveryStatus = 'pendente' | 'pronto' | 'finalizado';
export type PaymentMethod = 'pix' | 'cartao' | 'fiado' | 'dinheiro';
export type OrderSource = 'ifood' | 'aiqfome' | 'whatsapp' | 'instagram' | 'telefone' | 'loja' | 'outro';
export type UserRole = 'admin' | 'atendente' | 'motoboy';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  type: ProductType;
  unit: string;
  stock: number;
  image?: string;
  loyaltyEligible: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  weight?: number;
  subtotal: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  orderType: OrderType;
  status: OrderStatus;
  tableNumber?: number;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  deliveryFee?: number;
  deliveryStatus?: DeliveryStatus;
  orderSource?: OrderSource;
  motoboyName?: string;
  paymentMethod?: PaymentMethod;
  paymentSplits?: PaymentSplit[];
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  couponId?: string;
  createdAt: string;
  heldAt?: string;
  completedAt?: string;
  loyaltyRedemptions?: number;
  pickupPerson?: string;
  productionTime?: string;
  pickupTime?: string;
  pickupNotes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  creditBalance: number;
  loyaltyPoints: number;
}

export interface TableInfo {
  number: number;
  status: 'available' | 'occupied';
  orderId?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
}

export interface StockEntry {
  id: string;
  productId: string;
  quantity: number;
  supplierId: string;
  date: string;
}

export interface Sale {
  id: string;
  orderId: string;
  total: number;
  paymentMethod: PaymentMethod;
  customerId?: string;
  date: string;
  items: OrderItem[];
  paymentSplits?: PaymentSplit[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  pin: string;
}

export interface PaymentSplit {
  method: PaymentMethod;
  amount: number;
}

export interface DiscountCoupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  active: boolean;
  minOrder?: number;
  expiresAt?: string;
}

export interface StoreSettings {
  tableCount: number;
}

export interface CashRegister {
  id: string;
  openedBy: string;
  openedAt: string;
  closedAt?: string;
  initialAmount: number;
  totalCash: number;
  totalPix: number;
  totalCard: number;
  totalFiado: number;
  totalSales: number;
  notes: string;
}
