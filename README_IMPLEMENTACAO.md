# Radar Local V4 — Diagnóstico de Oportunidade Local

## O que muda

O relatório deixa de ser uma proposta comercial e passa a ter um único objetivo: aumentar a consciência do lead e gerar uma conversa de 10 minutos.

Fluxo do PDF:
1. Contexto personalizado
2. Demanda local estimada
3. Score de Captura Local
4. Principal ponto onde a oportunidade pode escapar
5. CTA para conversa de 10 minutos no WhatsApp

Não há preço, pacote, plano ou descrição explícita da solução no PDF.

## Arquivos para substituir no GitHub

- `index.html`
- `css/style.css`
- `css/proposta.css`
- `js/data.js`
- `js/app.js`
- `js/proposta.js`
- `proposta.html`

Faça um backup/commit antes de substituir.

## Snapshot estável

A identidade da análise é formada por:

`empresa + região + segmento + raio`

Exemplo:

`Clínica Aurora Podologia + Guarulhos - SP + podologia + 3 km`

O `app.js` usa duas camadas para estabilidade:

1. Seed determinística — os mesmos inputs reproduzem os mesmos indicadores.
2. `localStorage` (`radarLocalSnapshotsV1`) — o primeiro diagnóstico fica salvo no navegador e é reutilizado.

O relatório aberto fica em `radarProposal` para que `proposta.html` utilize exatamente aquele snapshot.

## Como testar após publicar

1. Rode uma análise de teste.
2. Anote demanda mensal, semanal e score geral.
3. Clique em `Nova análise`.
4. Pesquise exatamente a mesma empresa, região, segmento e raio.
5. Confirme que os números são os mesmos.
6. Clique em `Abrir diagnóstico`.
7. Confirme que o PDF tem 5 páginas e não mostra preços/pacotes.
8. Clique em `Salvar em PDF`.
9. Abra o PDF e teste o botão final do WhatsApp.

Mensagem final esperada:

`Oi Diego, vi o diagnóstico da [EMPRESA] e quero entender como corrigir os pontos que vocês encontraram.`

## Observação metodológica

Os volumes desta versão continuam sendo estimativas simuladas para uso estratégico/comercial. O PDF deixa isso indicado de forma discreta. Quando o Radar passar a usar uma fonte real de volume de busca, mantenha o snapshot, mas substitua a camada de simulação pela fonte real.

## Próxima evolução recomendada

GitHub Pages é estático. Para histórico centralizado e acesso aos diagnósticos em qualquer dispositivo, a próxima etapa é salvar snapshots em um banco (por exemplo Supabase/Firebase/API própria). Isso não é necessário para colocar esta V4 em prospecção agora.
