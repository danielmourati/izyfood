# Architecture decisions

- Use the shared `CurrencyInput` and BRL helpers for every editable monetary amount, so display and numeric parsing remain consistent across the app.
- Use `OrderItemDetails` and `getOrderItemNoteLines` for item customization display, so carts and receipts handle structured and legacy notes consistently.
- Product administration uses a compact, image-free table while the existing StoreContext setters remain the single CRUD synchronization path.
- On mobile browsers, the tenant root opens Mesas when the signed-in user has table access; desktop keeps Home as the root.