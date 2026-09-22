# Radar Maps Collector

Extensão Chromium (Manifest V3) que funciona como braço do Radar Local dentro do Google Maps.

## Fluxo principal

Depois de instalada, você não precisa abrir a extensão para iniciar uma coleta:

1. abra `https://radar.metodoflow360.com.br/prospeccao.html`;
2. informe o segmento e a região;
3. clique em **Mapear no Google**;
4. o Radar envia a busca para a extensão;
5. a extensão abre o Google Maps em segundo plano, percorre o feed e coleta os negócios carregados;
6. opcionalmente abre as fichas em segundo plano para completar telefone, site e horário;
7. devolve os registros diretamente ao Radar;
8. o Radar monta o mapa, os cards e tenta cruzar cada negócio com Receita/CNPJ/QSA.

CSV/JSON continua disponível como fallback para importar dados de outras extensões.

## O que coleta do Maps carregado no navegador

- nome;
- categoria;
- nota média;
- quantidade de avaliações;
- endereço;
- coordenadas e link do Maps;
- telefone;
- site;
- horário, quando disponível na ficha.

## O que o Radar adiciona

Quando existe correspondência suficientemente segura com a base pública do CNPJ:

- CNPJ;
- razão social;
- CNAE;
- e-mail cadastral;
- QSA;
- sócio/administrador provável;
- indicador de confiança do match.

## Instalação local

1. abra `chrome://extensions` no Chrome, Edge ou Brave;
2. ative **Modo do desenvolvedor**;
3. clique em **Carregar sem compactação**;
4. selecione a pasta `chrome-extension/radar-maps-collector`;
5. recarregue a página do Radar Local;
6. a Prospecção deve mostrar **Coletor do Radar conectado**.

## Fallback manual

Se o Google alterar a interface e o coletor parar temporariamente:

1. use sua extensão atual de extração;
2. exporte CSV ou JSON;
3. no Radar, clique em **Importar coleta**;
4. o mapa, filtros e cruzamento CNPJ/QSA continuam funcionando.

## Observações

A extensão não usa Google Places API, não armazena credenciais e não tenta contornar CAPTCHA ou mecanismos de bloqueio. Ela atua somente sobre a página carregada no navegador. O uso e a extração de conteúdo do Google Maps podem estar sujeitos aos termos do Google; valide o uso pretendido antes de operar em escala.
