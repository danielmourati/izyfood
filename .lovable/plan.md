# Busca de endereço pelo Google

## O que encontrei
Hoje o app não consulta o ViaCEP nem nenhum outro serviço de CEP. Nas telas **Clientes** e **Novo cliente no Checkout**, o endereço é um campo de texto livre. Então não há nada para substituir: o plano cria a busca já usando o Google.

## O que muda para o usuário
- No campo **Endereço**, o atendente digita a rua ou o CEP e aparece uma lista de sugestões do Google, limitada ao Brasil e próxima da cidade da loja.
- Ao escolher uma sugestão, o campo é preenchido com o endereço completo (rua, número, bairro, cidade, CEP). Dá para completar à mão com número e complemento.
- Se o Google não responder, o campo continua aceitando texto digitado à mão, sem travar o cadastro.
- Vale para as duas telas: Clientes e cadastro rápido no Checkout.

## Custos
O Google cobra por uso. Para gastar menos:
- a busca só começa a partir de 3 letras e espera a pessoa parar de digitar (cerca de 300 ms);
- cada escolha de endereço conta como uma única sessão;
- só usuários com login conseguem buscar.

## Detalhes técnicos
- Conectar o Google Maps Platform (gerenciado pelo Lovable) ao projeto.
- Nova função no servidor `address-search`, com login obrigatório:
  - `autocomplete`: POST `places/v1/places:autocomplete` com `includedRegionCodes: ['br']`, `sessionToken` e `locationBias`, se houver;
  - `details`: GET `places/v1/places/{id}?sessionToken=` com a field mask `formattedAddress,addressComponents,location`.
  - Valida o tamanho do texto, trata o erro 403 com uma mensagem clara e repassa os outros erros.
- Novo componente `AddressAutocomplete` (lista própria do app, sem a biblioteca de Places no navegador). Ele mantém um UUID por interação e descarta respostas antigas.
- Substituir o `Input` de endereço em `Clientes.tsx` e `CheckoutModal.tsx`. O formato salvo continua sendo o texto em `customers.address`, sem mudar o banco.
- Avisos aparecem dentro da tela, sem notificações flutuantes.
- Teste unitário: montar o endereço final a partir de `addressComponents`.
- Não dá para testar o Google aqui; a validação fica para a versão publicada.
