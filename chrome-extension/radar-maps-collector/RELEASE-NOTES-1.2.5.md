# Radar Maps Collector 1.2.5

Esta versão muda a estratégia de descoberta para Cobertura Máxima.

- Cada termo é pesquisado em pelo menos duas passagens independentes.
- Uma terceira passagem roda se ainda surgirem empresas novas.
- O feed do Google Maps é rolado até estabilidade real ou indicação de fim da lista.
- A descoberta completa termina antes do enriquecimento de telefone, site e horário.
- A memória da busca continua preservando a maior lista já encontrada para o mesmo nicho + região.

A busca ficará mais lenta de propósito para reduzir o risco de listas pequenas e inconsistentes.