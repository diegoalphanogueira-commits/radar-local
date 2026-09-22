# Radar Local V1 RC13 — Collector 1.4.2

## Objetivo
Fechar a regressão em que o Google Maps exibia dezenas de negócios nas abas de coleta, mas poucos chegavam ao Radar.

## Discovery Engine V3
- Um único service worker passa a controlar descoberta, memória e enriquecimento.
- O scanner do Google Maps acumula cada card visto durante toda a rolagem virtual.
- O scanner monitora mutações do feed e faz verificações adicionais no fim da lista.
- Coordenadas precisas do estabelecimento (`!3d/!4d`) têm prioridade sobre coordenadas de câmera do mapa.
- Coordenadas apenas aproximadas de câmera não podem remover um lead pelo filtro de raio.

## Cobertura controlável
Novo seletor no Radar:
- 30+ empresas
- 50+ empresas
- 100+ empresas
- Máxima

O valor representa uma meta de cobertura/esforço, não uma garantia matemática de quantidade no banco interno do Google. Em `Máxima`, o Radar continua variando termos e áreas do raio até o plano terminar ou a descoberta estabilizar.

## Cobertura espacial
Para uma região com centro geográfico disponível, a busca percorre centro e diferentes pontos do raio (norte, sul, leste, oeste e diagonais), combinados com variações de palavras-chave do segmento.

## Memória por mercado
A melhor base fica vinculada à chave:
`segmento + região + raio`.

Uma nova execução do mesmo mercado atualiza e acrescenta empresas; uma busca de outra região não pode reutilizar seus leads ou centro.

## Compatibilidade
- Mantidos enriquecimento de telefone/site/horário.
- Mantido enriquecimento público por site.
- Mantidas exportações CSV e JSON.
- Mantida priorização comercial do Radar.
