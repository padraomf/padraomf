# Painel local do portfólio

Abra `ABRIR-PAINEL.bat` na pasta principal. O runtime e dependências ficam em `E:\SERVIDOR\projetos\padrao-mf\portfolio\aplicacao\painel`; temporários, configurações, logs e backups ficam nas respectivas pastas desse serviço. O repositório de autoria continua na pasta escolhida pelo usuário. O painel inicia manualmente, somente em `127.0.0.1:3000`.

O iniciador verifica a porta antes de iniciar, instala exatamente as versões do lockfile e registra a instalação no cadastro do servidor. Não encerra nem altera outros serviços. Requer Node, Git, FFmpeg e Python com Pillow; `PANEL_PYTHON` identifica o Python usado pelo gerador e `PANEL_FFMPEG` permite escolher o FFmpeg. Usa o FFmpeg já instalado, sem depender do wrapper descontinuado ou de um binário antigo embutido.

O painel valida origem e endereço local e usa uma autorização aleatória de sessão para alterar dados. Sites externos não podem enviar alterações. Não há senha a digitar; o acesso é restrito ao próprio computador. Quem tem acesso ao computador tem acesso ao painel.

Os envios aceitam MP4/MOV/WebM/M4V (até 512 MB) e PNG/JPG/WebP (até 20 MB). As capas são decodificadas e convertidas para WebP. Arquivos temporários são descartados após sucesso ou falha. A compressão e os previews mantêm os parâmetros anteriores.

Alterações simultâneas são recusadas enquanto há uma operação em andamento. O site é gerado e verificado em uma pasta isolada antes de substituir os arquivos. Uma falha de geração preserva o site anterior; uma falha ao copiar arquivos aciona restauração. Cada alteração salva versões anteriores em `backups`, junto de `operacao.json`. Para recuperar, feche o painel e copie os arquivos dessa operação de volta ao repositório; os arquivos listados que não tinham versão anterior podem ser removidos após conferir o manifesto.

Excluir um projeto retira sua página e o redirecionamento antigo. As mídias ficam preservadas para recuperação. Para voltar à versão publicada, o histórico do Git também está disponível.

Publicar verifica o SEO, prepara somente os arquivos do portfólio e interrompe em erros de commit ou push. Confirmações do GitHub e do Vercel são distintas: a mensagem informa se a implantação ainda está pendente. Arquivos de ambiente, temporários e dependências não entram na publicação.

O aviso de vídeo na página inicial do Search Console é esperado: ela reúne vários trabalhos, enquanto cada projeto de vídeo tem sua página individual. Não é necessário transformar a página inicial em um player de vídeo.


O salvamento também atualiza `vercel.json`: páginas antigas dos projetos usam HTTP 301 para seus destinos atuais, e a página de erro mantém HTTP 404. Estilos e scripts são versionados pelo conteúdo durante a geração. Depois de atualizar o código do painel, feche a instância anterior e reabra pelo iniciador para carregar a nova versão.
