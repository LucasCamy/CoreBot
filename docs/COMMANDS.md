# 📖 Manual de Comandos do CoreBot

Todos os comandos do **CoreBot** utilizam a interface moderna de Slash Commands (`/`) do Discord com suporte a subcomandos, opções tipadas e respostas com embeds estilizados.

---

## 1. Módulo: Administração (`/bot`)

Comandos restritos a administradores ou membros com cargos administrativos configurados no banco de dados.

| Comando                            | Descrição                                                                                                  | Permissão |
| :--------------------------------- | :--------------------------------------------------------------------------------------------------------- | :-------- |
| `/bot status`                      | Exibe o status do bot, uptime, latência do WebSocket, consumo de memória e conexão com PostgreSQL e Redis. | Admin     |
| `/bot health`                      | Executa uma checagem de saúde imediata em todos os subsistemas.                                            | Admin     |
| `/bot permissoes`                  | Audita os canais monitorados e avisa se o bot está sem permissão de envio ou visualização.                 | Admin     |
| `/bot config ver`                  | Exibe as configurações atuais do servidor (fuso horário, cargos autorizados, status).                      | Admin     |
| `/bot config fuso <timezone>`      | Altera o fuso horário oficial do servidor (ex: `America/Sao_Paulo`, `UTC`, `America/New_York`).            | Admin     |
| `/bot config cargo-admin <cargo>`  | Adiciona um cargo que poderá gerenciar os comandos administrativos do CoreBot.                             | Admin     |
| `/bot config alternar-bot <ativo>` | Ativa ou desativa o atendimento do bot no servidor.                                                        | Admin     |

---

## 2. Módulo: Notificações de Voz (`/voz-notificar`)

Monitora entradas, saídas e movimentações de usuários em canais de voz específicos.

| Comando                     | Opções                                                                                                                                                                  | Descrição                                                                         |
| :-------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| `/voz-notificar configurar` | `canal_voz` _(obrigatório)_<br>`canal_texto` _(obrigatório)_<br>`msg_entrada`<br>`msg_saida`<br>`msg_troca`<br>`mencionar`<br>`usar_embed`<br>`cor_embed`<br>`cooldown` | Vincula um canal de voz a um canal de texto e define as mensagens personalizadas. |
| `/voz-notificar listar`     | _Nenhuma_                                                                                                                                                               | Lista todas as regras ativas de notificação de canais de voz no servidor.         |
| `/voz-notificar editar`     | `canal_voz` _(obrigatório)_<br>`canal_texto`<br>`ativo`<br>`msg_entrada`<br>`msg_saida`<br>`mencionar`<br>`usar_embed`                                                  | Atualiza parâmetros de um canal de voz monitorado já existente.                   |
| `/voz-notificar remover`    | `canal_voz` _(obrigatório)_                                                                                                                                             | Remove o monitoramento do canal de voz selecionado.                               |
| `/voz-notificar testar`     | `canal_voz` _(obrigatório)_<br>`tipo` (`join`, `leave`, `move`)                                                                                                         | Simula o disparo de uma notificação para validar layout e placeholders.           |

### Placeholders Suportados:

- `{user}` — Nome de exibição do usuário
- `{userMention}` — Menção clicável (`@usuario`)
- `{username}` — Username do Discord
- `{channel}` — Nome do canal de voz
- `{channelMention}` — Menção do canal (`#canal`)
- `{server}` — Nome do servidor Discord
- `{time}` — Hora do evento formatada no timezone do servidor
- `{date}` — Data do evento formatada no timezone do servidor

---

## 3. Módulo: Agenda e Compromissos (`/agenda`)

Gerenciamento de eventos com lembretes automáticos calculados em background via BullMQ.

| Comando            | Opções                                                                                                                                                    | Descrição                                                   |
| :----------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| `/agenda criar`    | `titulo` _(obrigatório)_<br>`data` _(DD/MM/AAAA)_<br>`hora` _(HH:MM)_<br>`canal_aviso` _(obrigatório)_<br>`descricao`<br>`lembretes` _(ex: `60,30,10,5`)_ | Agenda um novo evento com avisos prévios configurados.      |
| `/agenda listar`   | _Nenhuma_                                                                                                                                                 | Lista os próximos eventos agendados ainda ativos.           |
| `/agenda ver`      | `id` _(obrigatório)_                                                                                                                                      | Exibe todos os detalhes e status de um evento específico.   |
| `/agenda editar`   | `id` _(obrigatório)_<br>`titulo`<br>`data`<br>`hora`<br>`descricao`<br>`canal_aviso`                                                                      | Edita dados de um evento agendado.                          |
| `/agenda cancelar` | `id` _(obrigatório)_                                                                                                                                      | Cancela um evento existente e suspende lembretes futuros.   |
| `/agenda lembrar`  | `id` _(obrigatório)_                                                                                                                                      | Dispara manualmente um lembrete imediato no canal de aviso. |

---

## 4. Módulo: Listas de Presença (`/lista`)

Cria mensagens interativas com botões para inscrições em atividades, torneios, raids e eventos com limite opcional de vagas.

| Comando           | Opções                                                                                                     | Descrição                                                              |
| :---------------- | :--------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| `/lista criar`    | `titulo` _(obrigatório)_<br>`canal` _(obrigatório)_<br>`descricao`<br>`vagas` _(limite numérico opcional)_ | Cria a lista e envia a mensagem interativa com botões.                 |
| `/lista ver`      | `id` _(obrigatório)_                                                                                       | Exibe no chat os participantes e dados da lista.                       |
| `/lista fechar`   | `id` _(obrigatório)_                                                                                       | Encerra as inscrições e desativa os botões de entrada.                 |
| `/lista reabrir`  | `id` _(obrigatório)_                                                                                       | Reabre as inscrições e reativa os botões.                              |
| `/lista remover`  | `id` _(obrigatório)_                                                                                       | Exclui permanentemente a lista do banco de dados.                      |
| `/lista exportar` | `id` _(obrigatório)_                                                                                       | Gera e envia um arquivo `.csv` com todos os participantes confirmados. |

### Botões Interativos na Mensagem:

- **Entrar na lista**: Inscreve o usuário instantaneamente e atualiza a mensagem original no Discord. Impede duplicidade e valida limite de vagas.
- **Sair da lista**: Remove a inscrição do usuário e atualiza a mensagem original.
- **Ver participantes**: Abre uma resposta temporária (ephemeral) listando todos os membros confirmados.

---

## 5. Módulo: Aniversariantes (`/aniversario`)

Celebração automática de aniversários baseada no timezone do servidor.

| Comando                   | Opções                                                                                                   | Descrição                                                              |
| :------------------------ | :------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| `/aniversario definir`    | `data` _(DD/MM/AAAA, obrigatório)_<br>`canal_aviso` _(obrigatório)_<br>`usuario` _(Admin)_<br>`mensagem` | Cadastra o aniversário do próprio usuário (ou de outro, se for admin). |
| `/aniversario remover`    | `usuario` _(Admin para terceiros)_                                                                       | Remove o aniversário cadastrado.                                       |
| `/aniversario listar`     | _Nenhuma_                                                                                                | Lista todos os aniversariantes cadastrados e as respectivas datas.     |
| `/aniversario configurar` | `canal_padrao` _(obrigatório)_                                                                           | Atualiza o canal padrão de anúncios para todos os aniversários.        |
| `/aniversario testar`     | `usuario` _(obrigatório)_                                                                                | Dispara um teste imediato com a mensagem e cálculo de idade.           |

### Placeholders Suportados:

- `{user}` — Nome do aniversariante
- `{userMention}` — Menção (`<@id>`)
- `{idade}` — Idade calculada a partir do ano de nascimento
- `{data}` — Data formatada (`DD/MM`)

---

## 6. Módulo: Temp Voice Hubs (`/voice-hub`)

Criação e gerenciamento de canais de voz dinâmicos e temporários ("Join to Create") sob demanda.

| Comando                 | Opções                                                                                                                                         | Descrição                                                                                                               |
| :---------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| `/voice-hub configurar` | `canal_gerador` _(obrigatório)_<br>`categoria` _(obrigatório)_<br>`modelo_nome`<br>`limite_padrao`<br>`bitrate`<br>`privado` _(Padrão: false)_ | Configura um canal gatilho. Quando alguém entra nele, um novo canal (público ou privado) é criado e o usuário é movido. |
| `/voice-hub listar`     | _Nenhuma_                                                                                                                                      | Lista os hubs de voz ativos, modo (Público/Privado) e quantidade de salas abertas.                                      |
| `/voice-hub remover`    | `canal_gerador` _(obrigatório)_                                                                                                                | Desativa o hub do canal selecionado.                                                                                    |

### Painel Interativo no Chat da Sala Temporária:

Assim que a sala é criada, o CoreBot publica um painel de controle exclusivo para o criador:

- **Row 1:**
  - 🔒/🔓 **Trancar / Destrancar**: Alterna a permissão de conexão do `@everyone` entre público e privado, atualizando o emoji do canal (`🔒` ou `🔊`).
  - ➕ **Convidar Amigo**: Abre menu `UserSelectMenu` para conceder acesso explícito a amigos na sala privada.
  - 🚫 **Expulsar**: Abre menu `UserSelectMenu` para desconectar e bloquear membros indesejados da sala.
- **Row 2:**
  - 👥 **Definir Limite**: Abre um modal interativo para definir o limite de participantes (0 a 99).
  - ✏️ **Renomear**: Abre um modal para alterar o nome da sala temporária.
  - 👑 **Passar Liderança**: Abre menu de seleção de usuários para transferir o status de líder da sala.

### Comandos de Atalho de Membros (`/sala`):

Comandos disponíveis para o dono da sala temporária atual:

| Comando            | Opções                      | Descrição                                                                        |
| :----------------- | :-------------------------- | :------------------------------------------------------------------------------- |
| `/sala trancar`    | _Nenhuma_                   | Tranca a sala atual tornando-a privada (impede novas conexões de `@everyone`).   |
| `/sala destrancar` | _Nenhuma_                   | Destranca a sala atual tornando-a pública para todos os membros.                 |
| `/sala convidar`   | `usuario` _(obrigatório)_   | Concede permissão de conexão para um amigo específico mesmo com a sala trancada. |
| `/sala expulsar`   | `usuario` _(obrigatório)_   | Desconecta o membro da chamada e bloqueia seu acesso à sala temporária.          |
| `/sala limite`     | `numero` _(obrigatório)_    | Ajusta a lotação máxima da sala (entre 0 e 99).                                  |
| `/sala renomear`   | `novo_nome` _(obrigatório)_ | Altera o nome da sala (mantendo o ícone de privacidade `🔒` ou `🔊`).            |

---

## 7. Módulo: Game Server Monitor (`/server`)

Monitoramento contínuo de status, jogadores online e latência com embeds atualizados automaticamente via BullMQ.

| Comando             | Opções                                                                                                                                                                                           | Descrição                                                   |
| :------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| `/server cadastrar` | `nome` _(obrigatório)_<br>`tipo` (`minecraft`, `source`, `generic_tcp`)<br>`host` _(obrigatório)_<br>`porta` _(obrigatório)_<br>`canal_exibicao` _(obrigatório)_<br>`porta_query`<br>`intervalo` | Adiciona um servidor para monitoramento com mensagem fixa.  |
| `/server listar`    | _Nenhuma_                                                                                                                                                                                        | Lista todos os servidores de jogos cadastrados no servidor. |
| `/server remover`   | `id` _(obrigatório)_                                                                                                                                                                             | Remove o servidor e apaga a mensagem fixa no Discord.       |
| `/server status`    | `id` _(obrigatório)_                                                                                                                                                                             | Realiza uma consulta imediata e responde via ephemeral.     |

---

## 8. Módulo: Internal Webhooks (`/webhook`)

Recepção de notificações de CI/CD e alertas de monitoramento via endpoints HTTP Fastify autenticados.

| Comando                  | Opções                                     | Descrição                                                               |
| :----------------------- | :----------------------------------------- | :---------------------------------------------------------------------- |
| `/webhook canais`        | `canal_deploy`<br>`canal_alertas`          | Define os canais do Discord onde os deploys e alertas serão publicados. |
| `/webhook status`        | _Nenhuma_                                  | Exibe os canais configurados e detalhes dos endpoints.                  |
| `/webhook testar-deploy` | _Nenhuma_                                  | Dispara uma simulação de notificação de deploy no canal configurado.    |
| `/webhook testar-alerta` | `criticidade` (`INFO`, `WARN`, `CRITICAL`) | Dispara uma simulação de alerta de infraestrutura.                      |

---

## 9. Módulo: Custom Roles (`/meucargo`)

Permite que os membros do servidor criem e gerenciem seus próprios cargos estéticos e personalizados com cor hexadecimal exclusiva, respeitando rigorosamente a hierarquia do servidor e sem permissões adicionais (`permissions: 0n`).

| Comando                  | Opções                                                                             | Descrição                                                                           | Permissão |
| :----------------------- | :--------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- | :-------- |
| `/meucargo criar`        | `nome` _(obrigatório, 1-32 chars)_<br>`cor` _(obrigatório, hex ex: `#FF5733`)_     | Cria um cargo personalizado exclusivo, atribui ao membro e posiciona na hierarquia. | Membro    |
| `/meucargo cor`          | `cor` _(obrigatório, hex ex: `#3498DB`)_                                           | Atualiza a cor hexadecimal do seu cargo personalizado.                              | Membro    |
| `/meucargo nome`         | `novo_nome` _(obrigatório, 1-32 chars)_                                            | Atualiza o nome de exibição do seu cargo personalizado.                             | Membro    |
| `/meucargo remover`      | _Nenhuma_                                                                          | Exclui permanentemente o cargo personalizado do Discord e do banco de dados.        | Membro    |
| `/meucargo admin-config` | `cargo_ancora` _(cargo Discord)_<br>`cargo_permitido` _(cargo Discord)_<br>`ativo` | Define a âncora hierárquica, cargos com permissão de uso e ativação do recurso.     | Admin     |

### Regras de Negócio e Segurança:

- **Zero Permissões:** O cargo é criado explicitamente com `permissions: 0n` para impedir qualquer escalada de privilégios.
- **Hierarquia Visual:** O cargo é posicionado automaticamente logo abaixo do cargo âncora (`anchorRoleId`) configurado pela administração.
- **Limite por Membro:** Cada usuário pode possuir no máximo 1 cargo personalizado por servidor (`@@unique([guildId, userId])`).
- **Validação Hexadecimal Estrita:** Validação Zod com regex `/^#[0-9A-F]{6}$/i` (ex: `#FF5733`).
- **Limpeza Automática:** Se o membro sair do servidor (`guildMemberRemove`), o cargo é automaticamente deletado do Discord e do banco de dados.

---

## 10. Módulo: Pérolas & Citações (`/perola` & Apps)

Imortaliza frases memoráveis, gafes e pérolas dos membros com sorteio semanal automatizado todo domingo às 20h.

| Comando / Integração            | Opções                      | Descrição                                                                 | Permissão |
| :------------------------------ | :-------------------------- | :------------------------------------------------------------------------ | :-------- |
| **Apps > Salvar Pérola** (Menu) | _Botão direito na mensagem_ | Captura a mensagem selecionada, autor e salva no banco de dados.          | Membro    |
| `/perola aleatoria`             | _Nenhuma_                   | Retorna uma citação aleatória com embed estilizado.                       | Membro    |
| `/perola autor`                 | `usuario` _(obrigatório)_   | Retorna uma citação do autor selecionado.                                 | Membro    |
| `/perola listar`                | `usuario` _(opcional)_      | Lista citações registradas com paginação interativa por botões (◀️ / ▶️). | Membro    |

---

## 11. Módulo: Painel de Jogatina & Lobbies (`/jogar`)

Organização de lobbies dinâmicos para jogos multiplayer com notificações automáticas em threads dedicadas.

| Comando           | Opções                                                                                             | Descrição                                                                 | Permissão |
| :---------------- | :------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------ | :-------- |
| `/jogar criar`    | `jogo` _(obrigatório)_<br>`horario` _(ex: 21:00, 20h, 15/10 21:00)_<br>`vagas` _(opcional, 2-100)_ | Cria o painel de lobby com botões de inscrição (Confirmar, Talvez, Sair). | Membro    |
| `/jogar listar`   | _Nenhuma_                                                                                          | Lista todos os lobbies abertos e vagas restantes no servidor.             | Membro    |
| `/jogar cancelar` | `id` _(obrigatório)_                                                                               | Cancela um lobby criado por você e atualiza a mensagem original.          | Membro    |

- **Mesa Pronta Automática:** Ao atingir o limite de vagas ou no horário marcado via BullMQ, o CoreBot cria automaticamente uma thread no painel do lobby mencionando todos os confirmados!

---

## 12. Módulo: Catálogo de Clipes & Momentos (`/clip`)

Acervo comunitário de jogadas, fails e clipes engraçados gravados pelo grupo.

| Comando        | Opções                                                                                    | Descrição                                                                           | Permissão |
| :------------- | :---------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- | :-------- |
| `/clip salvar` | `titulo` _(obrigatório)_<br>`url` _(Medal, YouTube, Twitch, etc.)_<br>`jogo` _(opcional)_ | Publica o clipe no canal com botões interativos de voto (🔥 Mandou bem, 💀 Cringe). | Membro    |
| `/clip top`    | `jogo` _(opcional)_                                                                       | Exibe os 5 clipes mais votados do servidor com ranking e links diretos.             | Membro    |

- **Clipe do Mês:** Todo 1º dia do mês o CoreBot elege e anuncia automaticamente o clipe mais votado do mês anterior.

---

## 13. Módulo: Tribunal do Servidor (`/tribunal`)

Tribunal público com votações relâmpago de 10 minutos e castigos temporários de alteração de apelido.

| Comando            | Opções                                                                                                                | Descrição                                                             | Permissão |
| :----------------- | :-------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------- | :-------- |
| `/tribunal julgar` | `usuario` _(obrigatório)_<br>`apelido_castigo` _(1-32 chars)_<br>`motivo` _(acusação)_<br>`horas` _(duração, 1-168h)_ | Inicia uma votação de 10 min com botões `⚖️ Culpado` e `🕊️ Inocente`. | Membro    |

- **Execução da Pena:** Se condenado por maioria, o bot altera o apelido do membro no servidor para o castigo e agenda restauração automática via BullMQ ao término do período (com fallback caso o membro possua cargo superior).

---

## 14. Módulo: Soundboard Dinâmico em Call (`/tocar`, `/sons`)

Reprodução de áudios e memes locais curtos gravados pelo grupo diretamente no canal de voz.

| Comando        | Opções                  | Descrição                                                                            | Permissão |
| :------------- | :---------------------- | :----------------------------------------------------------------------------------- | :-------- |
| `/tocar`       | `som` _(nome do áudio)_ | O bot entra no seu canal de voz, toca o áudio até o fim e sai automaticamente.       | Membro    |
| `/sons listar` | _Nenhuma_               | Lista todos os áudios disponíveis na pasta `assets/sounds` com extensões e tamanhos. | Membro    |

- **Controle de Concorrência:** Possui lock em memória que impede múltiplos áudios simultâneos na mesma sala.

---

## 15. Módulo: Wrapped & Contagens Regressivas (`/wrapped`, `/countdown`)

Estatísticas de permanência em call, despedidas bem-humoradas na madrugada e contagens regressivas para viagens/eventos.

| Comando              | Opções                                        | Descrição                                                                     | Permissão |
| :------------------- | :-------------------------------------------- | :---------------------------------------------------------------------------- | :-------- |
| `/wrapped`           | `periodo` _(Últimos 30 Dias ou Mês Anterior)_ | Exibe o retrospecto de voz: Morador do Server, horário de pico e maior dupla. | Membro    |
| `/countdown criar`   | `nome` _(obrigatório)_<br>`data` _(futura)_   | Cadastra contagem regressiva para um evento ou viagem da galera.              | Membro    |
| `/countdown listar`  | _Nenhuma_                                     | Lista as contagens regressivas ativas e dias restantes.                       | Membro    |
| `/countdown remover` | `id` _(obrigatório)_                          | Exclui uma contagem regressiva existente.                                     | Membro    |

- **Despedidas Noturnas:** Membros que saem de um canal de voz entre 01:00 e 06:00 recebem uma despedida aleatória e divertida no chat (ex: _"{user} arriou os pneus e foi nanar 😴"_).
- **Aviso Diário:** Todo dia às 09:00 o bot atualiza o canal com os dias restantes para cada evento.

---

## 16. Módulo: Anúncios e Mensagens (`/anunciar`)

Permite que a equipe administrativa envie mensagens e comunicados pelo bot (regras, avisos, novidades) em formato texto simples ou Embed estilizado, além de editar comunicados já enviados.

| Comando              | Opções                                                                                                                     | Descrição                                                                      | Permissão |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------- | :-------- |
| `/anunciar mensagem` | `canal` _(obrigatório)_<br>`conteudo` _(obrigatório)_                                                                      | Envia uma mensagem em texto simples no canal escolhido.                        | Admin     |
| `/anunciar embed`    | `canal` _(obrigatório)_<br>`titulo`<br>`descricao` _(obrigatório)_<br>`cor`<br>`imagem_url`<br>`miniatura_url`<br>`rodape` | Envia um Embed formatado com cores, imagem, miniatura e rodapé.                | Admin     |
| `/anunciar modal`    | `canal` _(obrigatório)_                                                                                                    | Abre uma janela interativa (Modal) com campos de texto longos para formatação. | Admin     |
| `/anunciar editar`   | `canal` _(obrigatório)_<br>`id_mensagem` _(obrigatório)_<br>`novo_conteudo`                                                | Edita uma mensagem ou Embed enviado anteriormente pelo próprio bot.            | Admin     |

---

## 17. Módulo: Mensagens do Sistema (`/mensagens-sistema`)

Substitui as mensagens padrão do Discord (de novos membros entrando e membros impulsionando o servidor) por mensagens customizadas do bot com suporte a embeds, menções e tags dinâmicas.

| Comando                          | Opções                                                    | Descrição                                                                         | Permissão |
| :------------------------------- | :-------------------------------------------------------- | :-------------------------------------------------------------------------------- | :-------- |
| `/mensagens-sistema boas-vindas` | `canal`<br>`ativo`<br>`mensagem`<br>`usar_embed`<br>`cor` | Configura a mensagem de boas-vindas para novos membros que entram no servidor.    | Admin     |
| `/mensagens-sistema boost`       | `canal`<br>`ativo`<br>`mensagem`<br>`usar_embed`<br>`cor` | Configura a mensagem disparada quando alguém dá Server Boost no servidor.         | Admin     |
| `/mensagens-sistema painel`      | _Nenhuma_                                                 | Exibe o status atual, canais configurados, modelos de mensagem e tags dinâmicas.  | Admin     |
| `/mensagens-sistema testar`      | `tipo` (`boas-vindas` ou `boost`)                         | Dispara uma simulação imediata no canal configurado para validar layout e textos. | Admin     |

### Tags Dinâmicas Suportadas:

- `{user}` — Nome de exibição do membro
- `{userMention}` — Menção direta ao membro (`@membro`)
- `{username}` — Username do membro
- `{server}` — Nome do servidor
- `{memberCount}` — Quantidade total de membros no servidor
- `{boostCount}` — Quantidade total de impulsos (Server Boosts)
- `{boostTier}` — Nível de impulso do servidor (0, 1, 2, 3)

---

## 18. Módulo: Moderação e Limpeza (`/limpar`)

Comandos para limpar mensagens em massa ou recriar canais do zero (nuke), preservando automaticamente todas as permissões, cargos, tópicos e vínculos no banco de dados.

| Comando             | Opções                                                                                 | Descrição                                                                                             | Permissão |
| :------------------ | :------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- | :-------- |
| `/limpar mensagens` | `quantidade` _(1 a 100, obrigatório)_<br>`usuario`<br>`apenas_bots`<br>`apenas_anexos` | Apaga uma quantidade de mensagens recentes no canal atual com opção de filtros por usuário ou mídias. | Admin     |
| `/limpar canal`     | `confirmar` _(obrigatório, True)_<br>`motivo`                                          | **Limpa 100% do canal** recriando-o do zero (apaga todo o histórico, inclusive msgs antigas).         | Admin     |
