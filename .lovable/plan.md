# Bloquear FINALIZAR VENDA até o Falta Pagar zerar

## Situação atual (verificado em `src/components/CheckoutModal.tsx`)
- O botão do celular (linha ~580) e o do computador (linha ~1308) já têm a condição `remaining > 0.01` no `disabled`.
- O `handleFinalize` também revalida e recusa pagamento incompleto.
- Dois pontos fracos encontrados:
  1. **Arredondamento em centavos:** `remaining` é calculado com ponto flutuante (ex.: 33,33 + 33,33 + 33,33 = 99,98999…). Resíduos como 0,010000000005 podem travar o botão com "Falta pagar R$ 0,01" legítimo, ou, em cenários com resíduo menor que o limite, deixar passar saldo de 1 centavo exibido como "R$ 0,00". O valor precisa ser trabalhado em centavos inteiros.
  2. **Botão do computador não considera `finalizing`:** falta `finalizing` no `disabled`, permitindo clique duplo durante a finalização (o celular já tem).

## O que será feito (apenas `src/components/CheckoutModal.tsx`)
1. Calcular `remaining` arredondado em centavos:
   `const remaining = Math.max(0, Math.round((finalTotal - totalAssigned) * 100) / 100)`
   e usar `Math.round(finalTotal * 100)` / `Math.round(totalAssigned * 100)` na comparação, para que "Falta pagar" e o bloqueio usem exatamente o mesmo número.
2. Bloqueio estrito por centavos: o botão fica desabilitado enquanto `Math.round(remaining * 100) > 0` (Falta pagar ≠ R$ 0,00), tanto no celular quanto no computador — substituindo a tolerância de 0,01.
3. Rótulo coerente: "FINALIZAR VENDA" só quando Falta pagar = R$ 0,00; caso contrário "PAGAMENTO INCOMPLETO" (celular) / "Aguardando Pagamento" (computador).
4. Adicionar `finalizing` ao `disabled` do botão do computador (mesma proteção do celular).
5. Manter a revalidação dentro de `handleFinalize` alinhada à mesma comparação em centavos.

## Validação
- `bunx tsgo --noEmit -p tsconfig.app.json` e `bunx vitest run`.
- Teste no navegador (celular 390x844 e desktop): lançar pagamento parcial → botão travado com "Falta pagar" > 0; completar as parcelas (incluindo a última de 0,01) → botão libera exatamente quando o Falta pagar zera; clicar o botão travado para confirmar que nada acontece.
