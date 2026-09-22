# Radar Maps Collector 1.2.4

Esta versão separa a coleta atual da memória de busca. Para a mesma combinação de nicho + região, o coletor preserva a melhor lista já encontrada e soma os resultados novos, evitando que uma repetição que retorne menos empresas apague contatos já mapeados.

## Instalação
1. Baixe o ZIP da branch `release/radar-maps-collector-v1.2.4`.
2. Extraia a pasta.
3. Abra `chrome://extensions`.
4. Ative **Modo do desenvolvedor**.
5. Remova/desative a versão anterior e clique em **Carregar sem compactação**.
6. Selecione a pasta que contém `manifest.json`.
7. Recarregue o Radar Local com `Ctrl + F5`.

A memória de resultados é limitada às 12 buscas recentes, até 400 empresas por busca, com validade de 30 dias. O histórico comercial do Radar continua separado e só é persistido quando você altera o status de uma empresa.