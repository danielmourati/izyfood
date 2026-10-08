# Architecture decisions

- Use the shared `CurrencyInput` and BRL helpers for every editable monetary amount, so display and numeric parsing remain consistent across the app.
- Use `OrderItemDetails` and `getOrderItemNoteLines` for item customization display, so carts and receipts handle structured and legacy notes consistently.
- Present legacy observations and current complements together as Adicionais via `getOrderItemAdditionalLines`, while keeping Observações available in product administration.
- Product administration uses a compact, image-free table while the existing StoreContext setters remain the single CRUD synchronization path.
- On mobile browsers, the tenant root opens Mesas when the signed-in user has table access; desktop keeps Home as the root.
- Production printing carries an explicit `new` or `reprint` intent, so per-printer duplicate-copy settings never affect manual reprints.
- Receipt generation and preview share one UTF-8 column-width rule: 27 columns for 58mm and 42 for 80mm, so on-screen wrapping matches printed output.