# Architecture decisions

- Use the shared `CurrencyInput` and BRL helpers for every editable monetary amount, so display and numeric parsing remain consistent across the app.
- Use `OrderItemDetails` and `getOrderItemNoteLines` for item customization display, so carts and receipts handle structured and legacy notes consistently.
- Present legacy observations and current complements together as Adicionais via `getOrderItemAdditionalLines`, while keeping Observações available in product administration.
- Product administration uses a compact, image-free table while the existing StoreContext setters remain the single CRUD synchronization path.
- On mobile browsers, the tenant root opens Mesas when the signed-in user has table access; desktop keeps Home as the root.
- Production printing carries an explicit `new` or `reprint` intent, so per-printer duplicate-copy settings never affect manual reprints.
- Kitchen tickets identify table orders by table number, omit order IDs, and always enlarge headings, products, and additions for production readability.
- Receipt generation and preview share one column-width rule: 27 columns for 58mm and 40 for 80mm, so preview wrapping matches printed output.
- Printed text is encoded with each printer's calibrated `char_encoding` (single-byte table + its `ESC t n`, from `src/lib/escpos-encoding.ts`), never with the ESC/POS profile, because table indexes differ across brands/firmwares and only the printed calibration page can confirm the right one.- Balcão orders use the Mesas order modal on the `/balcao` page and are paid or discarded in the same session (no PDV page, no lock), so the counter never stays occupied.
- Orders persist the original opener's ID and name, and all kitchen tickets and bills resolve the attendant from that immutable attribution with legacy item-author fallback.
