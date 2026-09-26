# Architecture decisions

- Use the shared `CurrencyInput` and BRL helpers for every editable monetary amount, so display and numeric parsing remain consistent across the app.
- Use `OrderItemDetails` and `getOrderItemNoteLines` for item customization display, so carts and receipts handle structured and legacy notes consistently.