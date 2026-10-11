# Impressão desativada por atendente e aparelho

## Objetivo
Garantir que a opção **Usar impressora neste dispositivo** comece desativada para atendentes, sem herdar a escolha de outra pessoa que utilizou o mesmo navegador.

## Implementação
- Salvar a preferência localmente com uma chave separada por usuário, mantendo também a separação natural por aparelho/navegador.
- Inicializar a opção como desativada quando um atendente ainda não tiver uma escolha salva naquele aparelho.
- Ao trocar de usuário no mesmo aparelho, recarregar imediatamente a preferência correspondente ao novo usuário.
- Preservar o comportamento atual dos administradores e do computador configurado como caixa/servidor de impressão.
- Tratar o Gustavo, atendente do **Pastelão Sousa**, como ainda não inicializado: no próximo acesso em cada aparelho, a opção aparecerá desativada. Isso também elimina a herança da antiga preferência genérica do navegador.

## Validação
- Simular dois usuários no mesmo navegador e confirmar que ativar a impressão para um não ativa para o outro.
- Confirmar que um atendente novo inicia com a chave desligada.
- Confirmar que Gustavo inicia com a chave desligada e pode ativá-la manualmente apenas no aparelho desejado.
- Confirmar que a impressão do caixa e o comportamento de administradores continuam inalterados.
