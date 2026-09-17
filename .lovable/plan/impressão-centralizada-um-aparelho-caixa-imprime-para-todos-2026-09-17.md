# Impressão centralizada: um aparelho "Caixa" imprime para todos

Hoje cada celular tenta falar direto com a impressora Bluetooth — e é aí que trava. A ideia é ter **um único aparelho ligado à impressora** (o Caixa) e todos os outros apenas enviando os cupons para ele pela internet, mesmo em 4G ou Wi-Fi diferente.

## Como fica no dia a dia

**No aparelho do Caixa (o que fica com a impressora):**
- Nova chave em Configurações > Impressora: **"Este aparelho imprime para os outros (Caixa)"**.
- Enquanto essa tela/aplicativo estiver aberto, ele recebe os cupons enviados pelos atendentes e imprime sozinho, em segundos.
- Um painel curto mostra a fila: cupom, quem mandou, horário e situação (Na fila / Imprimindo / Impresso / Falhou).
- Botão **Tentar novamente** para cupons que falharam (impressora desligada, sem papel) e **Limpar impressos**.

**No aparelho do atendente:**
- Não precisa mais parear impressora. Ao enviar pedido, reimprimir ou pedir a conta, aparece **"Cupom enviado para o caixa"** e, quando sai o papel, muda para **"Impresso no caixa"**.
- Se nenhum caixa estiver online (ninguém com a chave ligada e aplicativo aberto), o atendente é avisado na hora: o cupom fica na fila e sai quando o caixa voltar — com opção de imprimir ali mesmo, se aquele aparelho tiver impressora.

**Prioridade de impressão em cada aparelho:** impressora local (Bluetooth/USB) quando existir e estiver conectada; senão, envia para o caixa; senão, visualização pelo navegador (como já é hoje).

**Falhas previstas:** impressora sem resposta em até 20 segundos vira "Falhou" com o motivo; o caixa tenta cada cupom até 3 vezes antes de marcar falha; cupons impressos são apagados automaticamente após 24 horas.

## Detalhes técnicos

**Banco (migração):** tabela `public.print_jobs`
- `id uuid`, `tenant_id uuid not null`, `created_by uuid`, `device_label text`
- `kind text` ('order' | 'bill' | 'cash_close' | 'test'), `payload jsonb not null` (dados do cupom, não bytes — o host reconstrói com `escpos.ts` usando as configurações e largura de papel do próprio host)
- `paper_width int`, `copies int default 1`
- `status text default 'pending'` ('pending' | 'printing' | 'done' | 'error'), `attempts int default 0`, `error text`
- `claimed_by text`, `claimed_at timestamptz`, `printed_at timestamptz`, `created_at timestamptz default now()`
- GRANTs: `SELECT, INSERT, UPDATE` para `authenticated`; `ALL` para `service_role`. RLS por `tenant_id = get_user_tenant_id()`. `ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;` + `REPLICA IDENTITY FULL`.
- Função `public.claim_print_job(_job_id uuid)` (security definer): faz `UPDATE ... SET status='printing', claimed_by, claimed_at, attempts = attempts + 1 WHERE id = _job_id AND status IN ('pending','error') RETURNING *` — trava atômica que impede dois hosts imprimirem o mesmo cupom.
- Função `public.purge_print_jobs()` chamada pelo host ao iniciar: apaga `status='done'` com mais de 24h.

**Cliente (emissor)** — `src/hooks/use-printer.ts`
- Novo `enqueuePrintJob(kind, payload)` que faz o `INSERT` e devolve o `id`.
- `printOrder`/`printBill`/`printCashClose` ganham o passo intermediário: se não há impressora local utilizável (`hasPrinterAvailable === false`) e existe host online, enfileiram e retornam `{ ok: true, queued: true, jobId }`; o `PrintResult` recebe `queued?`, `jobId?`.
- Presença de host: canal Realtime `presence` `print-host:<tenant_id>` — o host entra no canal enquanto ativo; clientes leem `presenceState()` para saber se há caixa online.
- Acompanhamento: assinatura pontual do `UPDATE` da linha para trocar o aviso inline de "enviado" para "impresso"/"falhou" (sem toast, seguindo o padrão atual).

**Host** — novo `src/hooks/use-print-host.ts` + `src/components/PrintQueuePanel.tsx`
- Ativado por chave local (`localStorage`, mesmo padrão de `enable_printer_device` em `src/lib/printer.ts`, disparando `printer_prefs_changed`).
- Monta no `Layout`, entra na presença, assina `INSERT`/`UPDATE` de `print_jobs` do tenant e faz um `SELECT` inicial dos pendentes (para o que chegou com o app fechado). Processa **em série** por uma fila interna.
- Para cada job: `claim_print_job` → monta ESC/POS (`buildOrderReceipt`/`buildBillReceipt`/`buildCashCloseReceipt`) → `printViaBluetooth`/`printViaQzTray` com timeout de 20s → `status='done'`, `printed_at`; em erro, `status='error'` + `error`, com retentativa automática até `attempts >= 3`.
- Painel da fila na aba Impressora (`src/components/ImpressoraTab.tsx`): lista das últimas 20 linhas, "Tentar novamente" (volta para `pending`) e "Limpar impressos".

**Chamadas existentes** — `src/pages/PDV.tsx`, `src/pages/Mesas.tsx`, `src/components/consumer/ConsumerOrderModal.tsx` passam a tratar `queued` no `PrintResult`, reaproveitando os avisos inline e o `PrintPreviewModal` já existentes.

Nada de NFC-e neste escopo: a fila carrega os cupons (comanda, conta, fechamento) que o sistema já gera hoje.
