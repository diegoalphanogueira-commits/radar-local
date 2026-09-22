# Teste RC14

Validar que a busca em Cobertura Máxima não expira enquanto a extensão continua trabalhando.

Critérios:
- uma aba por vez durante descoberta;
- leads parciais surgem no Radar antes do término;
- mapa/lista não ficam vazios caso ocorra falha posterior;
- ao fim da descoberta, enriquecimento inicia com até 3 abas paralelas;
- repetir a mesma busca não deve reduzir a melhor lista já acumulada para o mesmo nicho + região + raio.
