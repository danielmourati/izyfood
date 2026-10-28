# Architecture decisions

- Print-server ownership is a server-timed per-tenant lease acquired atomically and enforced on legacy writes; only the confirmed owning device processes the queue, preventing competing servers.
- Forced or failed print jobs are claimed only from pending/error; a job once claimed (printing) is never reissued — stale ones are finalized as probably printed — and the host records "sent" locally before printing and retries the done mark, so a job prints at most once without an admin reprint.

- Use the shared `CurrencyInput` and BRL helpers for every editable monetary amount, so display and numeric parsing remain consistent across the app.
- Use `OrderItemDetails` and `getOrderItemNoteLines` for item customization display, so carts and receipts handle structured and legacy notes consistently.
- Group item customization through getOrderItemCustomizationGroups and formatCustomizationLine, snapshot each selected option's classification, and treat unclassified legacy options as additions so history never changes when the catalog is edited.
- Product administration uses a compact, image-free table while the existing StoreContext setters remain the single CRUD synchronization path.
- On mobile browsers, the tenant root opens Mesas when the signed-in user has table access; desktop keeps Home as the root.
- Production printing carries an explicit `new` or `reprint` intent, so per-printer duplicate-copy settings never affect manual reprints.
- Kitchen tickets identify table orders by table number and omit order IDs; headings stay enlarged while products, additions, and notes follow each printer's font-size setting and active column width.
- Receipt generation and preview use the shared receiptColumnsForWidth rule, and double-width text halves that capacity, so preview wrapping matches printed output at every paper size.
- Thermal receipts are the single layout source for HTML and text previews; receipt-layout provides Menuzin-style hanging indents, while receipt-renderer interprets formatting commands using UTF-8 only for browser output to preserve calibrated physical printing.
- Printed text is encoded with each printer's calibrated `char_encoding` (single-byte table + its `ESC t n`, from `src/lib/escpos-encoding.ts`), never with the ESC/POS profile, because table indexes differ across brands/firmwares and only the printed calibration page can confirm the right one.
- Every single-byte receipt sends `FS .` (cancel Chinese/Kanji mode) after each `ESC @` and before `ESC t n` via encodingSetupCommand, because generic printers boot into double-byte mode where accents swallow the next byte and table selection is ignored.
- Balcão orders use the Mesas order modal on the `/balcao` page and are paid or discarded in the same session (no PDV page, no lock), so the counter never stays occupied.
- Orders persist the original opener's ID and name, and all kitchen tickets and bills resolve the attendant from that immutable attribution with legacy item-author fallback.
- Printer activation is stored per attendant and browser device, so shared devices never transfer one attendant's local printing choice to another.
- QZ Tray readiness requires a completed handshake (not `qz.websocket.isActive()`, which is true while CONNECTING) and connects through one shared in-flight promise, so concurrent print jobs never call the socket before it can send.
- Store custom character calibration as validated table@index IDs in printer_configs.char_encoding, so direct and queued receipt builders share it without parallel configuration; native UTF-8 must never assume ESC t 8 enables Unicode.
- Build QZ payloads through qzRawData with format=command and flavor=hex, matching QZ 2.x binary semantics instead of the obsolete format=hex shape.
- A mesa has at most one open order (unique partial index); a second device's order is absorbed into the existing one, and orders with items/value are deleted only after allowOrderDelete marks an explicit user action, so sync gaps never erase tables.
- Order deletions, item removals/quantity reductions and non-terminal table releases are audited by database triggers, so every loss is traceable even when the app path skipped logging.
- Tables are released only through `release_table(number, order_id)`/`move_order_table`, and DB triggers refuse to free a table whose open order still has content and recolocate items dropped outside `save_order_items`, so stale devices or old app versions can never make tables or items disappear.
- Tenant users sign in with a private per-tenant auth address stored in tenant_members.login_email, while the real e-mail lives in tenant_members.email/profiles.email and is unique only per tenant; login resolves slug+e-mail via resolve_tenant_login, so one e-mail can exist in several tenants.
