# Radar Local — Modo Prospecção V1

## Objetivo

Adicionar uma segunda finalidade ao Radar sem alterar a engine atual de diagnóstico:

- **Diagnóstico**: analisa uma empresa e gera o relatório comercial existente.
- **Prospecção**: descobre empresas por CNAE + município, mostra dados cadastrais e QSA e permite enviar um prospect para o Diagnóstico.

## Regra principal

O modo Prospecção **não usa Google Places**.

### Fontes da V1

1. **IBGE — API de Localidades**
   - Resolve o nome da cidade para o código oficial do município.
2. **Minha Receita**
   - API pública baseada nos dados abertos do CNPJ da Receita Federal.
   - Pesquisa paginada por UF, município e CNAE.
   - Consulta direta por CNPJ.
   - Retorna dados cadastrais, CNAE, endereço, porte, telefone, e-mail quando disponível e QSA.

## Fluxo

`Segmento/CNAE + UF + cidade -> IBGE -> código do município -> Minha Receita -> empresas -> filtros -> QSA -> lista -> diagnóstico`

O botão **Gerar diagnóstico** envia a empresa para o fluxo já existente usando os parâmetros aceitos pelo `landing-bridge.js`, sem alterar o algoritmo nem o PDF atual.

## Funcionalidades entregues

- busca por segmento/CNAE;
- CNAE manual;
- busca por cidade e UF;
- consulta direta por CNPJ;
- paginação;
- filtro por bairro;
- filtro por porte;
- filtro para empresas com QSA;
- identificação do decisor provável por qualificação no QSA;
- telefone cadastral do estabelecimento;
- e-mail cadastral quando disponível;
- filtro rápido na lista;
- exportação CSV;
- copiar dados;
- envio para o Diagnóstico;
- autenticação reutilizando `radar-auth.js`.

## Sobre telefone e WhatsApp

A V1 **não rotula o telefone cadastral da Receita como telefone pessoal do sócio**. O telefone retornado pela base é um contato cadastral do estabelecimento e pode ou não pertencer ao decisor.

O link para WhatsApp apenas tenta abrir o número cadastrado no WhatsApp. Isso **não é uma validação** de que o número tenha WhatsApp nem de que pertença ao sócio.

## Enriquecimento do decisor — próxima camada

Para chegar ao comportamento de ferramentas de enrichment B2B (telefone/e-mail profissional do decisor), a arquitetura prevista é:

`CNPJ -> QSA -> sócio/administrador -> backend Korax -> fornecedor de enriquecimento licenciado -> telefone/e-mail + origem + confidence score`

Essa etapa deve rodar no backend, nunca no JavaScript público, porque exige credenciais privadas do fornecedor.

Contrato recomendado:

```http
POST /radar/prospecting/enrich
Authorization: Bearer <radar-session>
Content-Type: application/json

{
  "cnpj": "00000000000100",
  "partnerName": "MARIA DA SILVA"
}
```

Resposta sugerida:

```json
{
  "found": true,
  "decisionMaker": {
    "name": "MARIA DA SILVA",
    "role": "Sócio-Administrador",
    "phones": [
      {
        "number": "5511999999999",
        "type": "mobile",
        "whatsapp": true,
        "source": "licensed-enrichment-provider"
      }
    ],
    "emails": []
  },
  "confidence": 0.92
}
```

## Produção / escala

A instância pública do Minha Receita é adequada como ponte para a V1, mas não possui SLA. Para alto volume, o caminho recomendado é hospedar a base do Minha Receita/Receita em infraestrutura própria e consultar o banco local, mantendo a mesma interface do frontend.

## Arquivos

- `prospeccao.html`
- `css/prospeccao.css`
- `js/prospeccao.js`

O diagnóstico existente (`index.html`, `proposta.html` e módulos atuais) permanece inalterado.
