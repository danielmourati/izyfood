

# POS System — Carnaúba Sorvetes e Açaí

## Overview
A modern, touch-friendly POS system with green/tropical branding, using the Carnaúba logo. Data stored locally (localStorage) with no backend needed for now.

## Pages & Navigation
Sidebar navigation with icons for all sections:

### 1. PDV (Point of Sale) — Main Screen
- **Left panel**: Product grid with category tabs (Açaí, Sorvetes, Bebidas, Extras)
  - Large touch cards showing product image placeholder, name, and price
  - For weight products (açaí/sorvete por kg): tap opens a weight input modal with numeric keypad, auto-calculates price
  - For unit products: tap adds directly to cart
- **Right panel**: Order summary
  - Order type selector at top (Balcão, Mesa, Delivery, Retirada)
  - Cart items with +/- quantity controls and remove button
  - Customer selection (for delivery/fiado)
  - Total display
  - Action buttons: Cancelar, Segurar Pedido, Finalizar

### 2. Mesas (Table Management)
- Grid of numbered tables (1-20)
- Green = available, Red = occupied
- Click occupied table → opens its current order in PDV
- Click available table → starts new order for that table

### 3. Pedidos (Orders)
- List of held/active orders
- Filter by status (aberto, finalizado)
- Click to resume order in PDV

### 4. Clientes (Customers)
- Customer list with search
- Add/edit customer: name, phone, address, notes
- View customer's open credit balance

### 5. Estoque (Inventory)
- Product stock levels table
- Manual stock entry with supplier selection
- Auto-deduction on sale
- Supplier register (name, contact)

### 6. Relatórios (Reports Dashboard)
- Daily sales chart (bar chart with Recharts)
- Sales by product (top sellers)
- Sales by payment method (pie chart)
- Customers with open credit list

### 7. Pagamento (Checkout Modal)
- Payment method selection: PIX, Cartão (Crédito/Débito), Fiado
- For Fiado: requires customer selection, records as open credit
- Confirmation screen with change calculation for cash

### 8. Login Screen
- Simple login with Carnaúba logo
- Two demo accounts: Proprietário (admin) and Atendente
- Admin sees all sections; Atendente sees only PDV, Mesas, Pedidos
- Stored locally (no real auth)

## Design
- Carnaúba logo in sidebar header and login screen
- Green & tropical color palette (dark green primary, light green accents, warm background)
- Large touch-friendly buttons (min 48px height)
- Clean, modern POS aesthetic with rounded cards and clear typography

## Data
All data (products, orders, customers, inventory, tables) managed via localStorage with pre-seeded sample products (açaí bowls, ice cream flavors, drinks).

