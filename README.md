# DriveViewer

**DriveViewer** é uma aplicação web Full-Stack projetada para atuar como um Media Center centralizado. O sistema abstrai a complexidade do armazenamento em nuvem, oferecendo uma interface de streaming moderna e responsiva.

A arquitetura utiliza o **Google Drive** como infraestrutura de armazenamento de objetos, enquanto o **Supabase** gerencia a persistência de dados relacionais e metadados enriquecidos. O orquestrador central é um backend desenvolvido em **Python (Flask)**, servindo uma interface Frontend construída sob o conceito de Single Page Application (SPA).

---

## Stack Tecnológico

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

---

## Arquitetura de Backend

O backend atua como uma API RESTful e controlador de renderização, gerenciando a lógica de negócios e a segurança.

### Core Framework (Flask)
É utilizado o Flask por sua leveza e flexibilidade. Ele gerencia as rotas da aplicação, servindo tanto os templates HTML quanto os endpoints JSON consumidos pelo frontend.

### Banco de Dados (Supabase & SQLAlchemy)
O **Supabase** é utilizado como a camada de persistência em produção. Ele fornece um banco de dados **PostgreSQL** escalável na nuvem.
- **ORM:** Utilizamos o SQLAlchemy para abstração das queries SQL.
- **Modelagem:**
  - `User`: Armazena credenciais (hash), e-mail, logs de criação e metadados de recuperação.
  - `Media`: Armazena o catálogo enriquecido (IDs do Drive mapeados para metadados do TMDB).
  - `RegistrationLog`: Tabela de auditoria para controle de Rate Limiting.

### Integração com Google Drive API
A comunicação com o armazenamento é feita via **Service Accounts** do Google Cloud Platform.
- **Autenticação Server-to-Server:** O backend utiliza credenciais JSON para se autenticar silenciosamente, sem necessidade de interação do usuário final com o login do Google.
- **Escopo Read-Only:** Por segurança, a aplicação possui permissão estrita de leitura (`drive.readonly`).
- **Streaming:** O conteúdo de vídeo não passa pela banda do servidor da aplicação; ele é entregue diretamente do Google para o cliente via `iframe`, reduzindo custos de infraestrutura.

---

## Arquitetura de Frontend (SPA)

O Frontend foi desenvolvido utilizando **Vanilla JavaScript** e **CSS3**, sem dependência de frameworks pesados, garantindo performance máxima e controle total sobre o DOM.

### Roteamento Client-Side (Custom Router)
Implementamos um sistema de roteamento próprio baseado na **History API** do navegador.
- **Navegação sem Reload:** A aplicação intercepta cliques e utiliza `history.pushState()` para alterar a URL.
- **Deep Linking:** URLs como `/watch/nome-do-filme` ou `/category/acao` são interpretadas pelo JavaScript ao carregar a página, renderizando o estado correto imediatamente.
- **Gestão de Estado:** Um `navigationStack` mantém o histórico de navegação interna (pastas, categorias), permitindo que o botão "Voltar" do navegador funcione conforme esperado dentro da aplicação.

### Design System & UX
- **Estética A24:** Identidade visual baseada em alto contraste, utilizando preto profundo e acentos em laranja/terra cotta.
- **Efeitos Visuais:**
  - *Scanline & Flicker:* Simulação de monitores CRT antigos via CSS Animations.
  - *Loading States:* Implementação de spinners minimalistas e pré-carregamento de imagens (`new Image()`) para evitar layout shifts.
- **Modal Imersivo:** Visualização de detalhes com suporte a Backdrops (imagens de fundo horizontais) e Posters verticais.

---

## Pipeline de Dados e Enriquecimento

O sistema transforma arquivos brutos em um catálogo de streaming profissional através de um processo de enriquecimento de dados.

### 1. Ingestão e Busca (TMDB API)
Utilizamos a API do **The Movie Database (TMDB)** como fonte da verdade para metadados.
- O script `enrich_catalog.py` atua como uma CLI (Command Line Interface) para o administrador.
- Ele permite a busca manual de títulos, retornando sinopses, datas de lançamento, notas e URLs de imagens (Posters e Backdrops).

### 2. Processamento e Mapeamento
- **Tradução de Gêneros:** IDs numéricos de gêneros vindos da API são convertidos automaticamente para strings legíveis (ex: `28` -> `Ação`).
- **Associação:** O ID único do arquivo no Google Drive é vinculado permanentemente aos metadados coletados.

### 3. Persistência
- Os dados processados são salvos na tabela `Media` do Supabase.
- O Frontend consome esses dados para gerar cards, modais e categorias dinâmicas, substituindo a visualização padrão de arquivos por uma experiência rica.

---

## Segurança e Controle

A segurança foi implementada em múltiplas camadas, desde o banco de dados até a interface do usuário.

### Autenticação e Sessão
- **Password Hashing:** Senhas nunca são salvas em texto plano. Utilizamos algoritmos de hash robustos (`werkzeug.security`) antes da persistência.
- **Proteção de Rotas:** Decorators `@login_required` no Flask interceptam requisições não autorizadas, protegendo endpoints de API e visualização.

### Rate Limiting (Anti-Spam)
Implementamos um sistema customizado de limitação de taxa para o registro de usuários.
- O sistema registra o IP e o Timestamp de cada criação de conta.
- Antes de processar um novo registro, verifica-se se aquele IP realizou uma operação nas últimas 24 horas.
- Isso previne a criação massiva de contas automatizadas.

### Recuperação de Conta (SMTP)
Fluxo seguro para redefinição de credenciais:
1.  Geração de Token criptograficamente seguro (`secrets.token_urlsafe`).
2.  Envio do token via servidor SMTP (Gmail) autenticado.
3.  Substituição temporária da senha pelo hash do token, permitindo acesso único para redefinição.

---

## Enrichment Libraries

The catalog is enriched through external APIs, turning raw Drive files into full media entries.

### TMDB — The Movie Database
**Endpoint:** `https://api.themoviedb.org/3`

Primary source for movie and series metadata. The following fields are fetched and persisted:

| Field | Description |
|---|---|
| `title` | Localized title (pt-BR) |
| `original_title` | Original release title |
| `overview` | Plot synopsis |
| `poster_path` | Vertical poster image path (2:3 ratio) |
| `backdrop_path` | Horizontal backdrop image path |
| `release_date` / `first_air_date` | Theatrical or premiere date |
| `vote_average` | Community rating (0–10 scale) |
| `genre_ids` | Numeric genre IDs mapped to human-readable strings via `GENRE_MAP` |
| `media_type` | Content type: `movie` or `tv` |

Images are not stored locally — only paths are saved and full URLs are assembled at runtime using the official TMDB CDN (`https://image.tmdb.org/t/p/`).

### Letterboxd
No API is consumed — the integration is a **direct deep-link** to the film's page using the slug derived from the original title. Gives users quick access to community reviews and ratings without additional API calls.

---

## 🌐 Demo ao Vivo

O projeto está implantado e rodando na Vercel! Sinta-se à vontade para acessar, criar uma conta e explorar as funcionalidades:

👉 [**Acessar DriveViewer**](https://drive-viewer.vercel.app/)

Fique à vontade para testar o fluxo de cadastro, login e navegação. 🍿
