# Radar Local V1 — RC5

## Etapa 4 — Inteligência empresarial definitiva

- Empresa e decisor passaram a ser camadas independentes.
- O Radar pode salvar CNPJ, razão social, CNAE, e-mail e telefone empresarial mesmo quando o QSA não entrega um decisor utilizável.
- CNPJ já conhecido recebe prioridade máxima no cruzamento.
- O match usa nome, telefone, CEP, endereço, número e bairro.
- Decisor segue separado entre QSA identificado, QSA provável e não identificado.
- Cards passam a sinalizar também `Empresa identificada · sem QSA` quando o CNPJ é seguro mas não há tomador de decisão disponível.
- Novo resumo visual mostra CNPJ identificado, QSA seguro, QSA provável e empresas sem decisor.
- O fingerprint de reprocessamento passa a considerar telefone, CNPJ e enriquecimento do site para permitir nova tentativa quando surgem sinais melhores.

Versão da extensão: 1.3.4.
