# Radar Local V1 RC14 — Collector 1.4.3

## Correção principal

A página do Radar não controla mais a duração da busca completa por um timeout fixo. A extensão passa a coordenar a coleta diretamente e mantém a operação viva enquanto o Google Maps continua sendo varrido.

## Resultados progressivos

- Cada varredura concluída sincroniza os leads já encontrados para o Radar.
- O mapa e a lista podem reaparecer antes da coleta completa terminar.
- Uma falha posterior preserva a coleta parcial em vez de deixar a tela vazia.
- Uma nova região só substitui a lista anterior quando a primeira parcial da nova sessão estiver disponível.

## Fases

1. Descoberta exaustiva: uma aba por vez, com múltiplos termos e pontos geográficos.
2. Enriquecimento: somente depois da descoberta, até 3 fichas são abertas em paralelo para telefone, site e horário.

## Cobertura

O seletor 30+, 50+, 100+ ou Máxima continua disponível. Ele representa uma meta de esforço e não uma garantia de quantidade, pois o Google Maps pode limitar ou variar resultados.
