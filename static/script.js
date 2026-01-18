const appContainer = document.getElementById('app-container');
const breadcrumbsContainer = document.getElementById('breadcrumbs');
const modal = document.getElementById('video-modal');
const videoFrame = document.getElementById('video-frame');
const modalTitle = document.getElementById('modal-title');
const modalSynopsis = document.getElementById('modal-synopsis');
const searchInput = document.getElementById('search-input');
const itemsCountLabel = document.getElementById('items-count');
const searchContainer = document.querySelector('.search-container');

// Elementos novos do Modal
const detailsView = document.getElementById('details-view');
const playerView = document.getElementById('player-view');
const modalPoster = document.getElementById('modal-poster');
const modalOriginalTitle = document.getElementById('modal-original-title');
const modalGenres = document.getElementById('modal-genres');
const modalMeta = document.getElementById('modal-meta');
const playBtn = document.getElementById('play-btn');
const playerInfoArea = document.getElementById('player-info-area');

let navigationStack = [];
let allHomeData = [];
let currentList = [];

document.addEventListener('DOMContentLoaded', () => {
    loadHome();
    
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
    searchContainer.style.display = 'none';
    
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
    itemsCountLabel.innerText = '';

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
    const lastItem = navigationStack[navigationStack.length - 1];
    if (!lastItem || lastItem.id !== filterTag) {
        navigationStack.push({ name: name, id: filterTag, type: 'category' });
    }
    renderBreadcrumbs();
    
    if (filterTag === 'movie') {
        currentList = allHomeData.filter(i => i.tag === 'movie');
    } else {
        currentList = allHomeData.filter(i => i.tag === 'series' || (i.type === 'folder' && i.tag !== 'movie'));
    }
    
    searchContainer.style.display = 'block';
    searchInput.disabled = false;
    renderGrid(currentList);
}

async function loadFolder(folderId, folderName) {
    navigationStack.push({ name: folderName, id: folderId, type: 'folder' });
    renderBreadcrumbs();
    searchInput.value = '';
    searchContainer.style.display = 'block';
    searchInput.disabled = false;
    
    appContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">Carregando...</div>';

    try {
        const response = await fetch(`/api/browse/${folderId}`);
        const items = await response.json();
        
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
    
    // Garante que os itens estejam sempre em ordem alfabética
    items.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));

    itemsCountLabel.innerText = `Exibindo ${items.length} iten(s)`;

    if (items.length === 0) {
        appContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">Pasta vazia.</p>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        
        // Se tiver poster, usa como background. Se não, usa estilo padrão.
        if (item.poster) {
            card.style.backgroundImage = `url('${item.poster}')`;
        }
        
        const icon = item.poster ? '' : (item.type === 'folder' ? '📁' : '▶️');
        
        let metaInfo = '';
        if (item.year) {
            metaInfo = `<div class="card-type">${item.year}</div>`;
        } else if (item.type === 'folder') {
            metaInfo = '<div class="card-type">Pasta</div>';
        }

        card.innerHTML = `
            <div class="card-content">
                <div class="card-title">${item.title}</div>
                ${metaInfo}
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
        openDetailsModal(item);
    }
}

function openDetailsModal(item) {
    // 1. Preenche os dados da View de Detalhes
    modalTitle.innerText = item.title;
    modalOriginalTitle.innerText = item.original_title ? item.original_title : '';
    modalSynopsis.innerText = item.synopsis || 'Sinopse indisponível.';
    
    // Poster
    if (item.poster) {
        modalPoster.src = item.poster;
        modalPoster.style.display = 'block';
    } else {
        modalPoster.style.display = 'none';
    }

    // Gêneros
    modalGenres.innerHTML = '';
    if (item.genres && item.genres.length > 0) {
        item.genres.forEach(genre => {
            const span = document.createElement('span');
            span.className = 'genre-tag';
            span.innerText = genre;
            modalGenres.appendChild(span);
        });
    }

    // Metadados (Data Completa, Nota TMDB)
    let metaHtml = '';
    
    // Data formatada
    if (item.release_date) {
        const dateObj = new Date(item.release_date);
        const dateStr = dateObj.toLocaleDateString('pt-BR');
        // Ícone SVG de Calendário
        metaHtml += `<div class="meta-item"><svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> ${dateStr}</div>`;
    }

    // Nota TMDB
    if (item.rating) {
        // Ícone SVG de Estrela
        metaHtml += `<div class="meta-item" title="Nota baseada no TMDB"><svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> ${item.rating.toFixed(1)} (TMDB)</div>`;
    }
    
    modalMeta.innerHTML = metaHtml;

    // 2. Configura o botão de Play
    playBtn.onclick = () => startVideo(item);

    // 3. Reseta as views (Mostra detalhes, esconde player)
    detailsView.style.display = 'flex';
    playerView.classList.add('hidden');
    videoFrame.src = ''; // Garante que não tem nada tocando

    // 4. Abre o modal
    modal.classList.remove('hidden');
}

function startVideo(item) {
    // 1. Esconde detalhes, mostra player
    detailsView.style.display = 'none';
    playerView.classList.remove('hidden');

    // 2. Carrega o vídeo
    const embedUrl = `https://drive.google.com/file/d/${item.id}/preview`;
    videoFrame.src = embedUrl;

    // 3. Replica as infos abaixo do player (conforme pedido)
    playerInfoArea.innerHTML = `
        <h2 style="margin-top: 15px; font-size: 1.2rem;">${item.title}</h2>
        <p class="modal-synopsis">${item.synopsis || ''}</p>
    `;
}

function closeModal() {
    modal.classList.add('hidden');
    videoFrame.src = '';
}

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
            if (index === 0) {
                loadHome();
            } else if (navigationStack[index].type === 'category') {
                while(navigationStack.length > index + 1) { navigationStack.pop(); }
                loadCategory(navigationStack[index].name, navigationStack[index].id);
            }
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