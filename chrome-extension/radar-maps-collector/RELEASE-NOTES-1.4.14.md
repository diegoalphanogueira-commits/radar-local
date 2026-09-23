# Radar Maps Collector 1.4.14 — RC25

Release voltada à demonstração do modo Prospecção do Radar Local.

## Interface

- Um único CTA visível: **Mapear região completa**.
- O CTA superior agora dispara o fluxo moderno completo.
- Botão duplicado de lote, botão manual de enriquecimento e status legado com ponto foram removidos da interface.
- Barra de progresso moderna permanece ativa.
- Ajustes responsivos para telas de celular.

## Velocidade

- Scanner do feed do Google Maps passou de esperas fixas para espera adaptativa baseada em mudanças reais no feed.
- Passos de rolagem maiores e detecção de fim/estabilidade.
- A cobertura começa pelo centro e só varre áreas adicionais quando a meta dentro do raio ainda não foi atingida.
- Modo **Máxima** continua cobrindo todos os pontos planejados.
- Enriquecimento de telefone/site continua abrindo somente fichas com dados faltantes, em até 5 fichas paralelas.

## Contatos

- Telefones comerciais coletados agora geram `whatsappCandidate` (`wa.me`) no armazenamento.
- Link explícito de WhatsApp é distinguido de candidato derivado do telefone.
- Exportação CSV inclui **WhatsApp** e **StatusWhatsApp**.

## Android

- Incluído `PACK-ANDROID.ps1` para gerar um CRX de demonstração no Windows.
- Incluído `MOBILE-DEMO-RC25.md` com o fluxo de sideload no Edge Canary/Beta Android.
- O sideload de extensões próprias no Android continua experimental e precisa ser validado no aparelho usado na demonstração.

## Arquivos principais ativos

- `background-v10.js`
- `content-v11.js`
- `radar-runtime-v8.js`
- `radar-progress-v2.js`
- `radar-single-search-v1.js`
- `radar-single-search-v1.css`
