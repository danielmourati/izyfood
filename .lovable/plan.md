# Corrigir tela branca ao recarregar (F5)

## O que acontece hoje

Ao apertar F5 em qualquer tela interna (por exemplo `/minha-loja/pdv`), o app abre em branco. Só volta a funcionar entrando pela página inicial e navegando pelos menus.

Causa: o app foi configurado para carregar seus arquivos em "caminho relativo" (necessário para a versão instalável em desktop). Quando a página recarregada tem duas ou mais barras no endereço, o navegador procura os arquivos na pasta errada, não encontra nada e mostra a tela branca.

## Correção

1. Voltar a usar caminho absoluto na versão web (site publicado e pré-visualização), mantendo o caminho relativo apenas na geração do aplicativo desktop, através de uma variável de build dedicada.
2. Ajustar o script de empacotamento desktop para usar essa variável, para que o app instalável continue funcionando como hoje.
3. Verificar após a correção: recarregar `/{loja}/pdv`, `/{loja}/caixa`, `/{loja}/configuracoes` e `/superadmin` diretamente, confirmando que a tela carrega normalmente e sem erros no console.

## Detalhes técnicos

- `vite.config.ts`: trocar `base: "./"` por `base: process.env.BUILD_TARGET === "desktop" ? "./" : "/"`.
- `package.json`: nos scripts de build do Electron, definir `BUILD_TARGET=desktop` antes do `vite build`.
- Nenhuma mudança em rotas, autenticação ou lógica de negócio; `HashRouter` continua ativo em `file:`/desktop.
- Validação com Playwright: carregar rotas profundas com `wait_until="domcontentloaded"` e checar ausência de 404 em `/assets/*`.
