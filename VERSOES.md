# Padrão MF — histórico

## Base confirmada pelo usuário

PADRAO-MF-ATUALIZADO-v4.zip, reenviado em 14/09/2026.
SHA-256: 9d2e21ffcd421c216b5b33d91da4c1437be5d3bd0cf6b5fb05984d8d7b3e59f5

## Versão 5

Continuação da v4. Adiciona nove motions, favicon MF, Home com alternância
Motion/Drone/Pocket Video e passagem a 66 px/s (1,5 × 44 px/s), setas no
mobile e entrada do título completo. Preserva os 55 projetos anteriores,
players YouTube, Sobre, contatos, logotipos e metadados de compartilhamento.

Os originais dos nove vídeos estão preservados nos anexos; as cópias do
site mantêm toda a duração e o áudio, otimizadas para exibição na web.

## Versão 6

Adiciona seis motions (21 motions e 70 projetos), rolagem suave com Lenis
1.3.26, parallax e blur progressivo, glow neon e cabeçalho fixo compacto.
Preserva a apresentação a 66 px/s, os players, os contatos e todas as rotas
anteriores. Movimento reduzido remove os efeitos e a suavização.

## v7

- Cinco vídeos de Drone; 75 trabalhos (11 de Drone).
- Prévias curtas, carregamento sob demanda e buffers liberados ao sair da seleção.
- Toque/deslizamento com prévia e destaque; navegação horizontal nativa preservada.
- Parallax ampliado com atualizações limitadas às seções próximas à tela.
- Galerias e navegação renderizadas no HTML; metadados, dados estruturados e sitemap de vídeos.
- Acesso público solicitado para permitir descoberta por buscadores.
- Ponte preserva Full HD/60 fps, com compressão para entrega web. Outros completos preservados.

## v8

- Mantém os cinco Drone da v7, cuja publicação online não foi concluída.
- Seis Pocket novos: 9 Pocket, 11 Drone, 81 trabalhos no total.
- Player compacto com mini player dentro da página e detalhes recolhíveis.
- Compartilhamento de serviços e trabalhos com alternativas para cópia do link.
- Menu com rolagem própria, glow e parallax; título da Home sem sobreposição.
- Prévias, mídia integral, metadados e rotas semânticas preservados.


## Versão 8.1 — player em tela cheia

Continuação da V8 com visual inspirado na referência de Reels enviada pelo usuário.
O diálogo ocupa todo o viewport; o vídeo preserva suas proporções, sem recortar o
trabalho. WhatsApp e compartilhar ficam na lateral direita; título e descrição
aparecem sobre a mídia, com expansão “mais” / “menos”. A descrição longa tem
rolagem própria. Mantém controles nativos, links por projeto, anterior/próximo,
fechar com Escape e o mini player opcional. Arquivos de mídia da V8 inalterados.

Publicação adiada explicitamente pelo usuário; fonte e ZIP atualizados.
Verificação: estrutura estática, referências, sintaxe e comportamento de expansão,
compartilhamento e minimização com simulação de DOM. Sem teste em aparelho real.

## Versão 8.2 — popup sobre o site

Ajuste da interpretação de “tela cheia”: restaura o diálogo centralizado sobre
o portfólio visível, com margem em todos os lados no desktop e no celular.
Mantém a sobreposição de título/descrição e “mais”/“menos”; simplifica os ícones
de ação, fecha com X e preserva o mini player. Nenhuma mídia foi recomprimida.

## Versão 8.3 — proporções, degradê e títulos

Corrige a interrupção do degradê 64px antes da base e remove o fundo de descrição
expandida com margens negativas. O popup usa as dimensões naturais da mídia.
Artes estáticas usam área própria, com controles e descrição fora da imagem,
sempre dentro do popup; vídeos mantêm a sobreposição.

A formatação dos títulos segue o peso Regular e a Home em duas linhas. A fonte
New Science não veio nos anexos: local() está preparado, com Arial temporário.
A incorporação da fonte para todos depende do arquivo ou Web Project do usuário.

## Versão 8.4 — fonte enviada e composição da Home

Incorpora New Science Regular Extended fornecida pelo usuário, com WOFF de
38.612 bytes e cópia do OTF original. Todos os títulos usam a fonte Regular.
A Home posiciona “SUA IDEIA.” e “NOSSO PADRÃO” no centro dos vídeos, dentro da
mesma camada de parallax. A antiga faixa separada do título foi removida.

O bloco entre Cards estáticos e Audiovisual passa a seguir o segundo print:
“Ideias que / ganham vida.” à esquerda e a descrição completa em três linhas
à direita. Em telas pequenas, as colunas se empilham. Preserva os 81 trabalhos,
prévias, popup, compartilhamento, rotas e metadados; nenhuma mídia recomprimida.
