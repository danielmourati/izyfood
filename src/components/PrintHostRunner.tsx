import { usePrintHost } from '@/hooks/use-print-host';

/**
 * Componente invisível: mantém o loop do aparelho "Caixa" rodando enquanto o app
 * estiver aberto, imprimindo os cupons enviados pelos atendentes.
 */
export default function PrintHostRunner() {
  usePrintHost();
  return null;
}
