# Corrigir "Salvando tudo..." travado nas Configurações

## O que acontece hoje
Ao tocar **Salvar Tudo**, o app faz 4 etapas em sequência: nome da loja, configurações (mesas, taxa, impressão), ajuste da quantidade de mesas e atualização da tela. O botão só volta ao normal quando **todas** terminam. Nenhuma etapa tem limite de tempo: se uma resposta do servidor não chega (sinal fraco, sessão expirando, conexão em segundo plano), o botão fica girando para sempre e o usuário não sabe se salvou.

Conferi o banco agora: não há travas nem consultas presas, então o problema está na espera sem limite dentro do app, não no servidor. A etapa mais provável é o ajuste de mesas, que faz várias consultas seguidas e é aguardada antes de liberar o botão.

## O que vou mudar
1. **Limite de tempo em cada etapa** (15s). Se estourar, o botão volta ao normal e aparece um aviso claro abaixo dele: "Não foi possível confirmar o salvamento. Verifique a conexão e tente de novo."
2. **Ajuste de mesas não segura mais o botão**: assim que nome e configurações forem gravados, o botão mostra "Salvo"; o ajuste de mesas continua em segundo plano e, se falhar, mostra aviso.
3. **Renovar sessão antes de salvar**: se a sessão estiver expirada, renova primeiro em vez de ficar esperando.
4. **Aviso visual sem notificação flutuante** (regra do projeto): mensagem de sucesso/erro fixa ao lado do botão, substituindo os avisos atuais dessa tela.
5. **Log no console** de qual etapa demorou, para confirmar a causa se acontecer de novo.

Vale para todas as lojas.

## Detalhes técnicos
- `Configuracoes.tsx` `handleSaveAll`: helper `withTimeout(promise, 15000, etapa)`; `getSession()` antes; `updateTableCount(count)` sem `await` com `.catch` setando estado de erro; estado `saveStatus` (`idle|saved|error` + mensagem) renderizado junto ao botão; `finally` sempre libera `savingGeneral`.
- `StoreContext.updateTableCount`: filtrar `store_tables` por `tenant_id` nas consultas/delete e checar `error` de cada chamada.
- Validar no Playwright: salvar com sucesso e simular resposta pendente (rota bloqueada) confirmando que o botão destrava em 15s.
