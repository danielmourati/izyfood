import { Product, Customer, Supplier, TableInfo, User, ProductCategory } from '@/types';

export const seedCategories: ProductCategory[] = [
  { id: 'cat1', name: 'Açaí' },
  { id: 'cat2', name: 'Sorvetes' },
  { id: 'cat3', name: 'Bebidas' },
  { id: 'cat4', name: 'Extras' },
];

export const seedProducts: Product[] = [
  { id: 'p1', name: 'Açaí Tradicional', price: 45.00, categoryId: 'cat1', type: 'weight', unit: 'kg', stock: 50 },
  { id: 'p2', name: 'Açaí Premium', price: 55.00, categoryId: 'cat1', type: 'weight', unit: 'kg', stock: 30 },
  { id: 'p3', name: 'Açaí com Banana', price: 50.00, categoryId: 'cat1', type: 'weight', unit: 'kg', stock: 40 },
  { id: 'p4', name: 'Açaí com Granola', price: 52.00, categoryId: 'cat1', type: 'weight', unit: 'kg', stock: 35 },
  { id: 'p5', name: 'Sorvete Chocolate', price: 40.00, categoryId: 'cat2', type: 'weight', unit: 'kg', stock: 25 },
  { id: 'p6', name: 'Sorvete Morango', price: 40.00, categoryId: 'cat2', type: 'weight', unit: 'kg', stock: 25 },
  { id: 'p7', name: 'Sorvete Coco', price: 40.00, categoryId: 'cat2', type: 'weight', unit: 'kg', stock: 20 },
  { id: 'p8', name: 'Picolé Simples', price: 5.00, categoryId: 'cat2', type: 'unit', unit: 'un', stock: 100 },
  { id: 'p9', name: 'Picolé Duplo', price: 8.00, categoryId: 'cat2', type: 'unit', unit: 'un', stock: 80 },
  { id: 'p10', name: 'Água Mineral', price: 3.50, categoryId: 'cat3', type: 'unit', unit: 'un', stock: 200 },
  { id: 'p11', name: 'Refrigerante Lata', price: 6.00, categoryId: 'cat3', type: 'unit', unit: 'un', stock: 150 },
  { id: 'p12', name: 'Suco Natural', price: 8.00, categoryId: 'cat3', type: 'unit', unit: 'un', stock: 50 },
  { id: 'p13', name: 'Água de Coco', price: 7.00, categoryId: 'cat3', type: 'unit', unit: 'un', stock: 60 },
  { id: 'p14', name: 'Granola Extra', price: 3.00, categoryId: 'cat4', type: 'unit', unit: 'un', stock: 100 },
  { id: 'p15', name: 'Leite Condensado', price: 2.50, categoryId: 'cat4', type: 'unit', unit: 'un', stock: 100 },
  { id: 'p16', name: 'Paçoca Triturada', price: 3.00, categoryId: 'cat4', type: 'unit', unit: 'un', stock: 80 },
  { id: 'p17', name: 'Leite em Pó', price: 2.00, categoryId: 'cat4', type: 'unit', unit: 'un', stock: 90 },
  { id: 'p18', name: 'Banana Fatiada', price: 2.50, categoryId: 'cat4', type: 'unit', unit: 'un', stock: 70 },
];

export const seedCustomers: Customer[] = [
  { id: 'c1', name: 'João Silva', phone: '(85) 99999-0001', address: 'Rua A, 123', notes: 'Cliente frequente', creditBalance: 0 },
  { id: 'c2', name: 'Maria Santos', phone: '(85) 99999-0002', address: 'Rua B, 456', notes: '', creditBalance: 25.50 },
  { id: 'c3', name: 'Pedro Oliveira', phone: '(85) 99999-0003', address: 'Rua C, 789', notes: 'Preferência: sem granola', creditBalance: 0 },
];

export const seedSuppliers: Supplier[] = [
  { id: 's1', name: 'Distribuidora Açaí Norte', contact: '(85) 3333-0001' },
  { id: 's2', name: 'Sorvetes Premium LTDA', contact: '(85) 3333-0002' },
  { id: 's3', name: 'Bebidas & Cia', contact: '(85) 3333-0003' },
];

export const seedTables: TableInfo[] = Array.from({ length: 20 }, (_, i) => ({
  number: i + 1,
  status: 'available' as const,
}));

export const seedUsers: User[] = [
  { id: 'u1', name: 'Proprietário', email: 'admin@carnauba.com', role: 'admin', pin: '1234' },
  { id: 'u2', name: 'Atendente', email: 'atendente@carnauba.com', role: 'atendente', pin: '0000' },
];
