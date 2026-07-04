## Objetivo
Substituir o logotipo do painel esquerdo do Login pelo logotipo branco enviado (`user-uploads://3-2.png`), removendo o card/fundo em volta.

## Alterações

### 1. Novo asset de logo branco
- Rodar `lovable-assets create --file /mnt/user-uploads/3-2.png --filename degust-logo-white.png > src/assets/degust-logo-white.png.asset.json`.

### 2. `src/pages/Login.tsx`
- Adicionar `import degustLogoWhite from '@/assets/degust-logo-white.png.asset.json';`.
- No painel esquerdo (linhas 94-100): trocar `src={degustLogoHorizontal.url}` por `src={degustLogoWhite.url}` e remover as classes de card (`bg-secondary/95 rounded-lg px-3 py-1.5`), mantendo apenas `h-11 object-contain` (ajustar altura se necessário para boa leitura).
- Painel direito (linha 150-154) permanece com o logo colorido atual.

## Fora de escopo
- Nenhuma outra tela alterada.
