# Radar Maps Collector 1.2.2

Corrige a descoberta incompleta em buscas locais.

## Mudanças
- `Mapear no Google` passa a executar busca regional completa em vez de uma única consulta.
- Varia palavras-chave por segmento, junta resultados e remove duplicados.
- Calcula o centro do raio usando endereços/resultados da própria região, evitando reaproveitar centro de uma busca anterior.
- Completa telefone, site e horário automaticamente após a descoberta.
- Mantém prioridade de enriquecimento para negócios sem telefone/site.

Teste de regressão recomendado: `Petshop` + `Jardim Presidente Dutra` + `5 km`.