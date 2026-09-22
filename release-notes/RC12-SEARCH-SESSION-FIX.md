# Radar Local V1 RC12 — isolamento de sessão de busca

- Corrige contaminação entre regiões (ex.: Vila Olímpia reaparecendo em Jardim Presidente Dutra).
- Cada nova pesquisa cria uma sessão isolada por segmento + região + raio.
- Centro salvo anterior não é reutilizado como entrada da nova coleta; a região é geocodificada novamente.
- Leads da pesquisa anterior saem da tela no início da nova sessão e ficam somente na memória compatível.
- Nova memória V2 é passiva: só grava resultados de sessões válidas e não altera o mapa por conta própria.
- Remove a rotina Geo Sync da RC11 que podia renomear coordenadas antigas com a nova região antes do fim da coleta.
- Mantém coleta resiliente, scroll V2, priorização e enriquecimento.

Versão: 1.4.1
