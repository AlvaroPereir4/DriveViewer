const appContainer = document.getElementById('app-container');
const breadcrumbsContainer = document.getElementById('breadcrumbs');
const modal = document.getElementById('video-modal');
const videoFrame = document.getElementById('video-frame');
const modalTitle = document.getElementById('modal-title');
const modalSynopsis = document.getElementById('modal-synopsis');
const searchInput = document.getElementById('search-input');
const itemsCountLabel = document.getElementById('items-count');
const searchContainer = document.querySelector('.search-container');
const detailsView = document.getElementById('details-view');
const playerView = document.getElementById('player-view');
const modalPoster = document.getElementById('modal-poster');
const modalOriginalTitle = document.getElementById('modal-original-title');
const modalGenres = document.getElementById('modal-genres');
const modalMeta = document.getElementById('modal-meta');
const playBtn = document.getElementById('play-btn');
const playerInfoArea = document.getElementById('player-info-area');
const modalContent = document.querySelector('.modal-content');

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
    const getCategoryPoster = (list) => {
        const withPoster = list.filter(i => i.poster);
        return withPoster.length > 0 ? withPoster[0].poster : null;
    };
    const categories = [
        { title: 'Filmes', count: movies.length, type: 'main', filter: 'movie', poster: getCategoryPoster(movies) },
        { title: 'Séries', count: series.length, type: 'main', filter: 'series', poster: getCategoryPoster(series) }
    ];
    const genreMap = {};
    items.forEach(item => {
        if (item.genres && item.genres.length > 0) {
            item.genres.forEach(genre => {
                if (!genreMap[genre]) {
                    genreMap[genre] = { title: genre, count: 0, items: [] };
                }
                genreMap[genre].count++;
                genreMap[genre].items.push(item);
            });
        }
    });
    const sortedGenres = Object.keys(genreMap).map(key => {
        const g = genreMap[key];
        return { title: g.title, count: g.count, type: 'genre', filter: g.title, poster: getCategoryPoster(g.items) };
    }).sort((a, b) => b.count - a.count); // Ordena por quantidade (maior para menor)

    const createCategoryCard = (cat) => {
        const card = document.createElement('div');
        card.className = 'card category-card';
        
        if (cat.poster) {
            card.classList.add('loading');
            const img = new Image();
            img.src = cat.poster;
            img.onload = () => {
                card.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url('${cat.poster}')`;
                card.style.backgroundSize = 'cover';
                card.style.backgroundPosition = 'center';
                card.classList.remove('loading');
            };
            img.onerror = () => {
                card.classList.remove('loading');
            };
        }

        card.innerHTML = `
            <div class="card-content" style="text-align: center; background: none; z-index: 2;">
                <div class="card-title">${cat.title}</div>
                <div class="card-type">${cat.count} Títulos</div>
            </div>
        `;
        card.onclick = () => loadCategory(cat.title, cat.filter, cat.type);
        return card;
    };
    categories.forEach(cat => appContainer.appendChild(createCategoryCard(cat)));
    if (sortedGenres.length > 0) {
        const separator = document.createElement('div');
        separator.style.gridColumn = '1 / -1';
        separator.innerHTML = '<h3 style="color: #8f8681; font-size: 1.1rem; margin-top: 30px; margin-bottom: 10px; font-weight: 400; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">Navegar por Gêneros</h3>';
        appContainer.appendChild(separator);
    }
    sortedGenres.forEach(cat => appContainer.appendChild(createCategoryCard(cat)));
}

function loadCategory(name, filterTag, type = 'main') {
    const lastItem = navigationStack[navigationStack.length - 1];
    if (!lastItem || lastItem.id !== filterTag) {
        navigationStack.push({ name: name, id: filterTag, type: 'category', categoryType: type });
    }
    renderBreadcrumbs();
    
    if (type === 'genre') {
        currentList = allHomeData.filter(i => i.genres && i.genres.includes(filterTag));
    } else {
        if (filterTag === 'movie') {
            currentList = allHomeData.filter(i => i.tag === 'movie');
        } else {
            currentList = allHomeData.filter(i => i.tag === 'series' || (i.type === 'folder' && i.tag !== 'movie'));
        }
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
    items.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
    itemsCountLabel.innerText = `Exibindo ${items.length} iten(s)`;
    if (items.length === 0) {
        appContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">Pasta vazia.</p>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';

        if (item.poster) {
            card.classList.add('loading');
            const img = new Image();
            img.src = item.poster;
            img.onload = () => {
                card.style.backgroundImage = `url('${item.poster}')`;
                card.classList.remove('loading');
            };
            img.onerror = () => {
                card.classList.remove('loading');
            };
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
    modalTitle.innerText = item.title;
    modalOriginalTitle.innerText = item.original_title ? item.original_title : '';
    modalSynopsis.innerText = item.synopsis || 'Sinopse indisponível.';

    // Configura o Backdrop (Imagem de fundo horizontal)
    if (item.backdrop) {
        modalContent.classList.add('loading');
        modalContent.style.backgroundImage = 'none'; // Limpa anterior para ver o spinner
        
        const img = new Image();
        img.src = item.backdrop;
        img.onload = () => {
            modalContent.style.backgroundImage = `linear-gradient(to right, rgba(0,0,0,0.9) 20%, rgba(0,0,0,0.6) 100%), url('${item.backdrop}')`;
            modalContent.style.backgroundSize = 'cover';
            modalContent.style.backgroundPosition = 'center top';
            modalContent.classList.remove('loading');
        };
        img.onerror = () => {
            modalContent.classList.remove('loading');
        };
    } else {
        modalContent.classList.remove('loading');
        modalContent.style.background = '#000';
        modalContent.style.backgroundImage = 'none';
    }

    const posterWrapper = document.querySelector('.details-poster-wrapper');
    if (item.poster) {
        posterWrapper.classList.add('loading');
        modalPoster.style.display = 'none'; // Esconde enquanto carrega
        modalPoster.src = item.poster;
        modalPoster.onload = () => {
            posterWrapper.classList.remove('loading');
            modalPoster.style.display = 'block';
        };
        modalPoster.onerror = () => {
            posterWrapper.classList.remove('loading');
        };
    } else {
        posterWrapper.classList.remove('loading');
        modalPoster.style.display = 'none';
    }

    modalGenres.innerHTML = '';
    if (item.genres && item.genres.length > 0) {
        item.genres.forEach(genre => {
            const span = document.createElement('span');
            span.className = 'genre-tag';
            span.innerText = genre;
            modalGenres.appendChild(span);
        });
    }
    let metaHtml = '';
    if (item.release_date) {
        const dateObj = new Date(item.release_date);
        const dateStr = dateObj.toLocaleDateString('pt-BR');
        metaHtml += `<div class="meta-item"><svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> ${dateStr}</div>`;
    }

    if (item.rating) {
        metaHtml += `<div class="meta-item" title="Nota baseada no TMDB"><svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> ${item.rating.toFixed(1)} (TMDB)</div>`;
    }
    
    modalMeta.innerHTML = metaHtml;
    playBtn.onclick = () => startVideo(item);
    detailsView.style.display = 'flex';
    playerView.classList.add('hidden');
    videoFrame.src = '';
    modal.classList.remove('hidden');
}

function startVideo(item) {
    detailsView.style.display = 'none';
    playerView.classList.remove('hidden');
    const embedUrl = `https://drive.google.com/file/d/${item.id}/preview`;
    videoFrame.src = embedUrl;
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
                loadCategory(navigationStack[index].name, navigationStack[index].id, navigationStack[index].categoryType);
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