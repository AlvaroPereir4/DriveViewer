const appContainer = document.getElementById('app-container');
const breadcrumbsContainer = document.getElementById('breadcrumbs');
const modal = document.getElementById('video-modal');
const videoFrame = document.getElementById('video-frame');
const modalTitle = document.getElementById('modal-title');
const searchInput = document.getElementById('search-input');
const itemsCountLabel = document.getElementById('items-count');
const searchContainer = document.querySelector('.search-container');

// Estado da navegação
let navigationStack = [];
let allHomeData = []; // Armazena todos os dados da home para filtrar sem recarregar
let currentList = []; // Lista sendo exibida atualmente (para busca funcionar)

document.addEventListener('DOMContentLoaded', () => {
    loadHome();
    
    // Evento de busca
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = currentList.filter(item => item.title.toLowerCase().includes(term));
        renderGrid(filtered);
    });
});

async function loadHome() {
    navigationStack = [{ name: 'Início', id: 'home', type: 'root' }];
    renderBreadcrumbs();
    searchInput.value = '';
    searchContainer.style.display = 'none'; // Oculta a busca na home
    
    try {
        const response = await fetch('/api/home');
        allHomeData = await response.json();
        renderCategories(allHomeData);
    } catch (error) {
        console.error('Erro ao carregar home:', error);
        appContainer.innerHTML = '<p>Erro ao carregar conteúdo.</p>';
    }
}

function renderCategories(items) {
    appContainer.innerHTML = '';
    itemsCountLabel.innerText = ''; // Limpa contador na home

    // Filtra e conta
    const movies = items.filter(i => i.tag === 'movie');
    const series = items.filter(i => i.tag === 'series' || (i.type === 'folder' && i.tag !== 'movie'));

    const categories = [
        { title: 'Filmes', count: movies.length, type: 'category', filter: 'movie' },
        { title: 'Séries', count: series.length, type: 'category', filter: 'series' }
    ];

    categories.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'card category-card';
        card.innerHTML = `
            <div class="card-content" style="text-align: center; background: none;">
                <div class="card-title">${cat.title}</div>
                <div class="card-type">${cat.count} Títulos</div>
            </div>
        `;
        card.onclick = () => loadCategory(cat.title, cat.filter);
        appContainer.appendChild(card);
    });
}

function loadCategory(name, filterTag) {
    navigationStack.push({ name: name, id: filterTag, type: 'category' });
    renderBreadcrumbs();
    
    // Filtra os dados já carregados
    if (filterTag === 'movie') {
        currentList = allHomeData.filter(i => i.tag === 'movie');
    } else {
        currentList = allHomeData.filter(i => i.tag === 'series' || (i.type === 'folder' && i.tag !== 'movie'));
    }
    
    searchContainer.style.display = 'block'; // Exibe a busca
    renderGrid(currentList);
}

async function loadFolder(folderId, folderName) {
    // Atualiza histórico
    navigationStack.push({ name: folderName, id: folderId, type: 'folder' });
    renderBreadcrumbs();
    searchInput.value = '';
    searchContainer.style.display = 'block';
    
    appContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">Carregando...</div>';

    try {
        const response = await fetch(`/api/browse/${folderId}`);
        const items = await response.json();
        
        // Normaliza os dados vindos do Drive API para o formato da nossa UI
        currentList = items.map(item => ({
            id: item.id,
            title: item.name,
            type: item.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'video',
            mimeType: item.mimeType
        }));

        renderGrid(currentList);
    } catch (error) {
        console.error('Erro ao carregar pasta:', error);
        appContainer.innerHTML = '<p>Erro ao carregar pasta.</p>';
    }
}

function renderGrid(items) {
    appContainer.innerHTML = '';
    
    // Atualiza contador
    itemsCountLabel.innerText = `Exibindo ${items.length} iten(s)`;

    if (items.length === 0) {
        appContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">Pasta vazia.</p>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        
        // Ícone visual baseado no tipo
        const icon = item.type === 'folder' ? '📁' : '▶️';
        
        card.innerHTML = `
            <div class="folder-icon">${icon}</div>
            <div class="card-content">
                <div class="card-title">${item.title}</div>
                <div class="card-type">${item.type === 'folder' ? 'Pasta' : 'Vídeo'}</div>
            </div>
        `;

        card.onclick = () => handleItemClick(item);
        appContainer.appendChild(card);
    });
}

function handleItemClick(item) {
    if (item.type === 'folder' || item.type === 'drive_folders') {
        loadFolder(item.id, item.title);
    } else {
        openVideo(item.id, item.title);
    }
}

function openVideo(fileId, title) {
    // Usa a URL de preview do Google Drive para embed
    const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    videoFrame.src = embedUrl;
    modalTitle.innerText = title;
    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
    videoFrame.src = ''; // Para o vídeo
}

// Fecha modal ao clicar fora
window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
}

function renderBreadcrumbs() {
    breadcrumbsContainer.innerHTML = '';
    
    navigationStack.forEach((crumb, index) => {
        const span = document.createElement('span');
        span.className = 'breadcrumb-item';
        span.innerText = crumb.name;
        
        span.onclick = () => {
            // Lógica simples para voltar: recarrega home se for o primeiro, ou implementa voltar
            if (index === 0) {
                loadHome();
            } else if (navigationStack[index].type === 'category') {
                // Se clicar na categoria (ex: Filmes), recarrega a categoria
                // Para simplificar, vamos reconstruir a stack até este ponto
                while(navigationStack.length > index + 1) { navigationStack.pop(); }
                renderBreadcrumbs();
                // Recarrega a lista baseada no ID da categoria (movie/series)
                loadCategory(navigationStack[index].name, navigationStack[index].id);
                // Nota: loadCategory empilha, então precisamos ajustar a lógica se quisermos voltar perfeitamente,
                // mas para simplificar, clicar no breadcrumb recarrega o estado.
                // Uma correção rápida para evitar loop:
                navigationStack.pop(); // Remove o que acabamos de adicionar no loadCategory
            }
            // Para navegação mais complexa de voltar, precisaríamos refazer a stack
        };

        breadcrumbsContainer.appendChild(span);
        
        if (index < navigationStack.length - 1) {
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.innerText = '/';
            breadcrumbsContainer.appendChild(separator);
        }
    });
}