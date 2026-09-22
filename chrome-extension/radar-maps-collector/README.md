# Radar Maps Collector

Extensão Chromium (Manifest V3) para coletar os negócios que o próprio Google Maps carregou no navegador e exportar a lista para o Radar Local.

## O que coleta

- nome;
- categoria;
- nota média;
- quantidade de avaliações;
- endereço;
- coordenadas e link do Google Maps;
- telefone, site e horário quando a etapa de detalhes encontra esses campos na ficha.

## Instalação local

1. Abra `chrome://extensions` no Chrome, Edge ou Brave.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `chrome-extension/radar-maps-collector`.
5. Fixe a extensão na barra do navegador.

## Uso

1. Faça uma busca no Google Maps, por exemplo `clínica de estética Jardim Presidente Dutra Guarulhos`.
2. Abra a extensão.
3. Use **Rolar e capturar mais resultados** para percorrer o feed.
4. Opcionalmente use **Abrir fichas e completar detalhes** para telefone/site/horário.
5. Exporte JSON ou CSV.
6. No Radar Local > Prospecção, clique em **Importar coleta**.

## Arquitetura

O Google Maps é usado como fonte visual de descoberta dentro da sessão do navegador. O Radar recebe apenas o arquivo exportado e usa a coleta para montar mapa, filtros e análise. Receita Federal/QSA continuam sendo uma camada separada.

A extensão não usa Google Places API, não armazena credenciais e não tenta contornar CAPTCHA ou outros mecanismos de controle do Google. Se o Google bloquear/limitar a navegação, a coleta deve ser interrompida e retomada manualmente.
