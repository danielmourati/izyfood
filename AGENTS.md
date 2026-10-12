# Architecture decisions

- Use the shared `CurrencyInput` and BRL helpers for every editable monetary amount, so display and numeric parsing remain consistent across the app.
- Use `OrderItemDetails` and `getOrderItemNoteLines` for item customization display, so carts and receipts handle structured and legacy notes consistently.
- Present legacy observations and current complements together as Adicionais via `getOrderItemAdditionalLines`, while keeping Observações available in product administration.
- Product administration uses a compact, image-free table while the existing StoreContext setters remain the single CRUD synchronization path.
- On mobile browsers, the tenant root opens Mesas when the signed-in user has table access; desktop keeps Home as the root.
- Production printing carries an explicit `new` or `reprint` intent, so per-printer duplicate-copy settings never affect manual reprints.
- Kitchen tickets identify table orders by table number and omit order IDs; headings stay enlarged while products, additions, and notes follow each printer's font-size setting and active column width.
- Receipt generation and preview use the shared receiptColumnsForWidth rule, and double-width text halves that capacity, so preview wrapping matches printed output at every paper size.
- Thermal receipts are the single layout source for HTML and text previews; receipt-layout provides Menuzin-style hanging indents, while receipt-renderer interprets formatting commands using UTF-8 only for browser output to preserve calibrated physical printing.
- Printed text is encoded with each printer's calibrated `char_encoding` (single-byte table + its `ESC t n`, from `src/lib/escpos-encoding.ts`), never with the ESC/POS profile, because table indexes differ across brands/firmwares and only the printed calibration page can confirm the right one.- Balcão orders use the Mesas order modal on the `/balcao` page and are paid or discarded in the same session (no PDV page, no lock), so the counter never stays occupied.
- Orders persist the original opener's ID and name, and all kitchen tickets and bills resolve the attendant from that immutable attribution with legacy item-author fallback.
- Printer activation is stored per attendant and browser device, so shared devices never transfer one attendant's local printing choice to another.
- QZ Tray readiness requires a completed handshake (not `qz.websocket.isActive()`, which is true while CONNECTING) and connects through one shared in-flight promise, so concurrent print jobs never call the socket before it can send.
- Store custom character calibration as validated table@index IDs in printer_configs.char_encoding, so direct and queued receipt builders share it without parallel configuration; native UTF-8 must never assume ESC t 8 enables Unicode.
- Build QZ payloads through qzRawData with format=command and flavor=hex, matching QZ 2.x binary semantics instead of the obsolete format=hex shape.
