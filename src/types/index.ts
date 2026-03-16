export type ProductCategory = 'acai' | 'sorvetes' | 'bebidas' | 'extras';
export type ProductType = 'unit' | 'weight';
export type OrderType = 'balcao' | 'mesa' | 'delivery' | 'retirada';
export type OrderStatus = 'aberto' | 'segurado' | 'finalizado' | 'cancelado' | 'pronto';
export type DeliveryStatus = 'pendente' | 'pronto' | 'finalizado';
export type PaymentMethod = 'pix' | 'cartao' | 'fiado' | 'dinheiro';
export type OrderSource = 'ifood' | 'aiqfome' | 'whatsapp' | 'instagram' | 'telefone' | 'loja' | 'outro';
export type UserRole = 'admin' | 'atendente';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: ProductCategory;
  type: ProductType;
  unit: string;
  stock: number;
  image?: string;
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
  createdAt: string;
  heldAt?: string;
  completedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  creditBalance: number;
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
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
}
