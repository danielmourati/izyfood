## Remover se\u00e7\u00e3o 'Tela de Login' de Configura\u00e7\u00f5es

Escopo: remover apenas o card 'Tela de Login' (\u00edcone + carrossel) em `src/pages/Configuracoes.tsx`. A tela de login p\u00fablica do tenant continua funcionando com defaults (o banco mant\u00e9m as colunas, mas o admin n\u00e3o poder\u00e1 mais edit\u00e1-las pela UI).

### Altera\u00e7\u00f5es em `src/pages/Configuracoes.tsx`
- Remover o `<Card>` inteiro (linhas 490\u2013540) contendo \u00edcone do login e imagens do carrossel.
- Remover states relacionados: `loginIcon`, `carouselImages`, `uploadingIcon`, `uploadingCarousel`.
- Remover handlers: `handleLoginIconUpload`, `handleCarouselUpload`, `removeCarouselImage`.
- Remover `login_icon` e `login_carousel_images` do `.select()` inicial (linha 157) e do listener realtime (linhas 253\u2013254).
- Limpar imports n\u00e3o utilizados (ex.: `Image`, `Upload`, `Plus`, `X` se n\u00e3o forem usados em outros lugares do arquivo).

### N\u00e3o alterar
- Colunas `tenants.login_icon` e `tenants.login_carousel_images` no banco (mantidas para n\u00e3o quebrar a tela de login p\u00fablica que ainda pode l\u00ea-las; se estiverem nulas, cai no default).
- Bucket de storage e demais telas.
