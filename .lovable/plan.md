Ocultar a seção **Prévia do cupom** da aba Impressora, mantendo os arquivos do componente para uso futuro.

## Técnico

1. Em `src/components/ImpressoraTab.tsx`:
   - Remover a importação `import { ReceiptPreview } from '@/components/ReceiptPreview';`.
   - Remover o bloco JSX comentado como `{/* Card 4b — Preview */}` e o componente `<ReceiptPreview ... />` logo após o card "Imprimir Teste".

2. Manter inalterados:
   - `src/components/ReceiptPreview.tsx`
   - `src/lib/receipt-preview.ts`

3. Verificar build/typecheck para confirmar que não há imports não utilizados ou erros de TypeScript.
