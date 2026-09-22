# Radar Maps Collector 1.2.0

Extensão Chromium (Manifest V3) que funciona como braço do Radar Local dentro do Google Maps.

## O que mudou na 1.2.0

- busca regional completa com várias palavras-chave relacionadas;
- acumula resultados de várias buscas e remove duplicados;
- carrega automaticamente o Workspace Comercial V4 dentro do Radar Prospecção;
- envia progresso da busca completa para o Radar;
- mantém a busca rápida antiga;
- separa descoberta rápida de enriquecimento de telefone/site/horário.

## Fluxo recomendado

1. abra `https://radar.metodoflow360.com.br/prospeccao.html`;
2. informe o segmento e a região;
3. escolha o raio desejado;
4. clique em **Mapear região completa**;
5. o Radar gera variações de busca do segmento;
6. a extensão abre cada busca no Google Maps em segundo plano, percorre os resultados e acumula as empresas;
7. o Radar remove duplicados, aplica o raio geográfico e monta o mapa comercial;
8. use **Completar dados (até 50)** quando quiser abrir fichas individuais para telefone, site e horário;
9. os cards permitem WhatsApp personalizado, roteiro de ligação, Diagnóstico e acompanhamento por status.

## Status comerciais do Radar

O Workspace Comercial usa cinco estados:

- Não prospectado;
- Tentei / sem contato;
- Contato realizado;
- Deu certo / oportunidade;
- Não ligar novamente.

O histórico é associado à identidade da empresa (CNPJ quando disponível, Google Maps, telefone e nome/endereço como fallback), reduzindo o risco de prospectar a mesma empresa novamente em outra busca.

## Dados coletados do Google Maps carregado no navegador

- nome;
- categoria;
- nota média;
- quantidade de avaliações;
- endereço;
- coordenadas e link do Maps;
- telefone, site e horário quando a ficha é aberta na etapa de enriquecimento.

## Instalação local

1. abra `chrome://extensions` no Chrome, Edge ou Brave;
2. ative **Modo do desenvolvedor**;
3. clique em **Carregar sem compactação**;
4. selecione a pasta que contém `manifest.json`;
5. se já havia uma versão anterior, remova/recarregue a extensão;
6. recarregue a página do Radar Local;
7. confirme que a Prospecção reconhece o coletor.

## Fallback manual

Se o coletor parar temporariamente após alguma mudança do Google Maps:

1. use a ferramenta de extração que você já utiliza;
2. exporte CSV ou JSON;
3. importe o arquivo no Radar;
4. o mapa, filtros, histórico e ações comerciais continuam disponíveis quando o Workspace V4 estiver carregado.

## Observações

A extensão não usa Google Places API, não armazena credenciais e não tenta contornar CAPTCHA ou mecanismos de bloqueio. Ela atua sobre a página carregada no navegador. A coleta e reutilização de conteúdo do Google Maps podem estar sujeitas aos termos do Google; valide o uso pretendido antes de operar em escala.
