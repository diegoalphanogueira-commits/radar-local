# Radar Local RC25 — demonstração no Android

Versão da extensão: **1.4.14**

## 1. Atualizar e testar no computador

1. Atualize a pasta `chrome-extension/radar-maps-collector` com a versão mais recente do repositório.
2. Abra `edge://extensions` no Microsoft Edge do computador.
3. Ative **Modo do desenvolvedor**.
4. Recarregue a extensão Radar Maps Collector.
5. Abra `https://radar.metodoflow360.com.br/prospeccao.html` e confirme que existe apenas um botão **Mapear região completa**.
6. Faça uma busca curta antes de empacotar.

## 2. Gerar o arquivo CRX

### Opção rápida

No Windows, clique com o botão direito em `PACK-ANDROID.ps1` e execute com PowerShell. O script tenta gerar:

`Downloads/radar-local-1.4.14-android.crx`

A chave privada usada para manter o mesmo ID da extensão fica fora do repositório, em `%LOCALAPPDATA%\RadarLocal\Keys`.

### Opção manual

1. Abra `edge://extensions` no Edge do computador.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Empacotar extensão**.
4. Selecione a pasta `chrome-extension/radar-maps-collector`.
5. Na primeira vez, deixe o campo de chave vazio. Guarde o `.pem` gerado em local seguro; ele deve ser reutilizado nas próximas versões.

## 3. Instalar no Android para a demonstração

O sideload de extensão própria no Android é experimental. Para o teste, use **Microsoft Edge Canary** ou uma versão Beta que exponha o mesmo menu.

1. Instale/abra o Microsoft Edge Canary no Android.
2. Vá em **Configurações > Sobre o Microsoft Edge**.
3. Toque 5 vezes no número/build da versão para habilitar as opções de desenvolvedor.
4. Volte em **Configurações > Opções do desenvolvedor**.
5. Abra **Extension install by crx**.
6. Escolha o arquivo `radar-local-1.4.14-android.crx` salvo no aparelho.
7. Confirme a instalação.
8. Abra `https://radar.metodoflow360.com.br/prospeccao.html` no próprio Edge Canary.

## 4. Roteiro de validação da demo

Use uma busca controlada, por exemplo um segmento local + um bairro/cidade.

Confirme, nesta ordem:

- somente um CTA de busca aparece;
- os campos e o CTA ocupam a largura correta no celular;
- a barra de progresso muda durante a coleta;
- a primeira passagem carrega empresas até estabilizar/finalizar a lista;
- quando a meta de 30/50/100 já é alcançada no raio, o Radar não repete áreas desnecessariamente;
- nome, endereço, nota e quantidade de avaliações aparecem;
- telefone e site são complementados automaticamente quando faltam no card do Maps;
- o botão WhatsApp usa o telefone coletado para abrir `wa.me`;
- uma nova busca cancela corretamente a busca anterior.

## 5. Limitação importante para a demonstração

O Google Maps não exibe telefone e site de todos os negócios diretamente na lista. Por isso o Radar primeiro coleta a lista inteira e depois abre fichas em paralelo somente para os dados que faltam. Isso é intencional: evita abrir todas as empresas individualmente quando o card da busca já contém os dados.

O botão **WhatsApp** é montado a partir do telefone comercial coletado. Isso permite tentar o contato no WhatsApp, mas não significa que o número foi previamente confirmado como uma conta ativa do WhatsApp. Links explícitos de WhatsApp presentes no site oficial podem ser identificados pelo enriquecimento de site, que é uma etapa diferente e mais lenta.
