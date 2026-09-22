# Radar Local V1 RC15 — 1.4.4

Correções críticas do motor de descoberta:

- Nova pesquisa cancela imediatamente descoberta e enriquecimento anteriores.
- Sessão isolada por segmento + região + raio; queries antigas não podem contaminar a busca atual.
- Modo 50+ usa até 8 varreduras e 2 abas de descoberta em paralelo.
- Scanner adaptativo com teto de tempo por aba: ~22s (30+), ~32s (50+), ~44s (100+) e ~56s (Máxima).
- Resultado parcial é sincronizado ao Radar após cada varredura concluída.
- Enriquecimento continua em até 3 fichas paralelas somente depois da descoberta.
- Cache de mercado V4 separado das versões anteriores, evitando reaproveitamento de listas contaminadas.

Teste recomendado:
1. Fechar abas antigas do Google Maps abertas por versões anteriores.
2. Instalar a extensão 1.4.4.
3. Ctrl+F5 no Radar.
4. Pesquisar `barbearia` em uma região com cobertura `50+`.
5. Confirmar que só aparecem variações do nicho atual (barbearia, barbeiro, barber shop etc.).
6. Confirmar que a descoberta termina em poucos minutos e depois inicia o enriquecimento em 3 abas paralelas.
