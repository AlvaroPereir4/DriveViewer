# DriveViewer

Um visualizador web para filmes, séries e arquivos hospedados no Google Drive. O projeto oferece uma interface estilo streaming para navegar em pastas e assistir a vídeos diretamente no navegador.

## Funcionalidades

- Interface visual para navegação de arquivos.
- Separação automática entre Filmes e Séries.
- Navegação por pastas do Google Drive.
- Busca em tempo real na lista exibida.
- Player de vídeo integrado.

## Configuração

1. Instale as dependências necessárias:
   pip install flask google-auth google-api-python-client

2. Coloque o arquivo de credenciais do Google renomeado como 'api_key.json' na raiz do projeto.

3. Crie uma pasta chamada 'data' e adicione o arquivo 'links.json' contendo a estrutura inicial do catálogo.

## Como rodar

Execute o arquivo principal:
python app.py