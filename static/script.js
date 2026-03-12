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
let lazyLoadObserver;

function createSlug(text) {
    return text.toString().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

document.addEventListener('DOMContentLoaded', () => {
    initLazyLoading();
    initApp();
    
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = currentList.filter(item => item.title.toLowerCase().includes(term));
        renderGrid(filtered);
    });
    window.addEventListener('popstate', router);

    // Efeito de Spotlight Global (Segue o mouse)
    document.addEventListener('mousemove', (e) => {
        document.body.style.setProperty('--mouse-x', `${e.clientX}px`);
        document.body.style.setProperty('--mouse-y', `${e.clientY}px`);
    });

    initBackgroundEffects();
});

// --- EFEITOS VISUAIS DE FUNDO ---
function initBackgroundEffects() {
    const container = document.createElement('div');
    container.className = 'background-effects';
    document.body.appendChild(container);

    // Cria uma nova linha a cada X milissegundos
    setInterval(() => {
        const line = document.createElement('div');
        line.className = 'drift-line';
        
        // Randomização
        const topPos = Math.random() * 100; // Posição vertical (0-100%)
        const width = Math.random() * 150 + 50; // Largura entre 50px e 200px
        const duration = Math.random() * 15 + 10; // Duração entre 10s e 25s (bem lento)
        const opacity = Math.random() * 0.15 + 0.05; // Opacidade entre 0.05 e 0.2 (Sutil)
        const delay = Math.random() * 5; // Atraso inicial

        // Aplica estilos
        line.style.top = `${topPos}%`;
        line.style.width = `${width}px`;
        line.style.opacity = opacity;
        
        // Animação manual via Web Animations API para controle total
        const animation = line.animate([
            { transform: 'translateX(-200px)', opacity: 0 },
            { opacity: opacity, offset: 0.2 },
            { opacity: opacity, offset: 0.8 },
            { transform: 'translateX(100vw)', opacity: 0 }
        ], {
            duration: duration * 1000,
            easing: 'linear'
        });

        // Remove o elemento do DOM quando a animação acabar
        animation.onfinish = () => line.remove();
        
    }, 800); // Tenta criar uma linha a cada 0.8 segundos
}

function initLazyLoading() {
    if ('IntersectionObserver' in window) {
        lazyLoadObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    loadCardImage(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '200px' }); // Carrega a imagem 200px antes de aparecer na tela
    } else {
        // Fallback para navegadores muito antigos
        lazyLoadObserver = { observe: (card) => loadCardImage(card) };
    }
}

function loadCardImage(card) {
    const poster = card.dataset.poster;
    if (!poster) return;

    const img = new Image();
    img.src = poster;
    img.onload = () => {
        if (card.classList.contains('category-card')) {
            card.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url('${poster}')`;
            card.style.backgroundSize = 'cover';
            card.style.backgroundPosition = 'center';
        } else {
            card.style.backgroundImage = `url('${poster}')`;
        }
        card.classList.remove('loading');
    };
    img.onerror = () => card.classList.remove('loading');
}

async function initApp() {
    try {
        const response = await fetch('/api/home');
        allHomeData = await response.json();
        router();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        appContainer.innerHTML = '<p>Erro ao carregar conteúdo.</p>';
    }
}

function router() {
    const path = window.location.pathname;
    searchInput.value = '';
    searchContainer.style.display = 'none';
    closeModal(); // Garante que o modal feche ao navegar (voltar/avançar)
    videoFrame.src = '';

    if (path === '/' || path === '/index') {
        navigationStack = [{ name: 'Início', id: 'home', type: 'root' }];
        renderBreadcrumbs();
        renderCategories(allHomeData);
    }
    else if (path.startsWith('/category/')) {
        const filterTag = decodeURIComponent(path.split('/category/')[1]);
        let type = 'main';
        let name = filterTag;

        if (filterTag === 'movie') name = 'Filmes';
        else if (filterTag === 'series') name = 'Séries';
        else type = 'genre';
        _renderCategoryView(name, filterTag, type);
    }
    else if (path.startsWith('/folder/')) {
        const folderId = path.split('/folder/')[1];
        _renderFolderView(folderId, 'Pasta');
    }
    else if (path.startsWith('/watch/')) {
        const param = path.split('/watch/')[1];
        renderCategories(allHomeData);
        const item = allHomeData.find(i => createSlug(i.title) === param || i.id === param);
        if (item) {
            openDetailsModal(item, false);
        }
    }
}

function navigateTo(url) {
    history.pushState(null, null, url);
    router();
}

function loadHome() {
    navigateTo('/');
}

function loadCategory(name, filterTag, type = 'main') {
    navigateTo(`/category/${filterTag}`);
}

function loadFolder(folderId, folderName) {
    navigateTo(`/folder/${folderId}`);
}

function _renderCategoryView(name, filterTag, type) {
    if (navigationStack.length === 0 || navigationStack[0].id !== 'home') {
        navigationStack = [{ name: 'Início', id: 'home', type: 'root' }];
    }

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
    }).sort((a, b) => b.count - a.count);

    const createCategoryCard = (cat) => {
        const card = document.createElement('div');
        card.className = 'card category-card';
        
        if (cat.poster) {
            card.classList.add('loading');
            card.dataset.poster = cat.poster;
            if (lazyLoadObserver) lazyLoadObserver.observe(card);
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

async function _renderFolderView(folderId, folderName) {
    const lastItem = navigationStack[navigationStack.length - 1];
    if (!lastItem || lastItem.id !== folderId) {
        navigationStack.push({ name: folderName, id: folderId, type: 'folder' });
    }
    renderBreadcrumbs();
    
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
            card.dataset.poster = item.poster;
            if (lazyLoadObserver) lazyLoadObserver.observe(card);
        }
        
        const icon = item.poster ? '' : (item.type === 'folder' ? '📁' : '▶️');
        
        let metaInfo = '';
        if (item.year) {
            metaInfo = `<div class="card-type">${item.year}</div>`;
        } else if (item.type === 'folder') {
            metaInfo = '<div class="card-type">Pasta</div>';
        }

        // Prepara dados para o hover (Netflix Style)
        const synopsis = item.synopsis ? (item.synopsis.length > 90 ? item.synopsis.substring(0, 90) + '...' : item.synopsis) : '';
        const rating = item.rating ? `★ ${item.rating.toFixed(1)}` : '';
        const genres = item.genres ? item.genres.slice(0, 2).join(' • ') : '';

        card.innerHTML = `
            <div class="card-content">
                <div class="card-title">${item.title}</div>
                ${metaInfo}
            </div>
            <div class="card-hover-info">
                <div class="hover-details">
                    <div class="hover-actions">
                        <div class="play-icon-circle">▶</div>
                    </div>
                    <div class="hover-title">${item.title}</div>
                    <div class="hover-meta">
                        <span class="hover-match">${rating}</span>
                        <span class="hover-year">${item.year || ''}</span>
                    </div>
                    <div class="hover-genres">${genres}</div>
                    <p class="hover-desc">${synopsis}</p>
                </div>
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
        const slug = createSlug(item.title);
        history.pushState(null, null, `/watch/${slug}`);
        openDetailsModal(item, false);
    }
}

function openDetailsModal(item, updateUrl = true) {
    if (updateUrl) history.pushState(null, null, `/watch/${createSlug(item.title)}`);

    document.body.style.overflow = 'hidden';
    modalTitle.innerText = item.title;
    modalOriginalTitle.innerText = item.original_title ? item.original_title : '';
    modalSynopsis.innerText = item.synopsis || 'Sinopse indisponível.';
    if (item.backdrop) {
        modalContent.classList.add('loading');
        modalContent.style.backgroundImage = 'none';
        
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
        modalPoster.style.display = 'none';
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

    // Link Letterboxd
    let lbUrl;
    if (item.letterboxd_slug) {
        lbUrl = `https://letterboxd.com/film/${item.letterboxd_slug}/`;
    } else {
        const lbSlug = createSlug(item.original_title || item.title);
        lbUrl = `https://letterboxd.com/film/${lbSlug}/`;
    }
    
    metaHtml += `
        <a href="${lbUrl}" target="_blank" class="meta-item letterboxd-link" title="Ver no Letterboxd">
            <svg class="meta-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="3.5"/><circle cx="12" cy="12" r="3.5"/><circle cx="19" cy="12" r="3.5"/></svg>
            Letterboxd
        </a>`;
    
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

    // Reconstrói TODAS as informações para o modo Player
    let lbUrl;
    if (item.letterboxd_slug) {
        lbUrl = `https://letterboxd.com/film/${item.letterboxd_slug}/`;
    } else {
        const lbSlug = createSlug(item.original_title || item.title);
        lbUrl = `https://letterboxd.com/film/${lbSlug}/`;
    }
    
    // Gera HTML dos gêneros
    let genresHtml = '';
    if (item.genres && item.genres.length > 0) {
        genresHtml = `<div class="modal-genres" style="margin-top: 10px;">` + 
            item.genres.map(g => `<span class="genre-tag">${g}</span>`).join('') + 
            `</div>`;
    }

    // Gera HTML dos Metadados (Data, Nota, Letterboxd)
    let metaHtml = '<div class="modal-meta-tags">';
    if (item.release_date) {
        const dateStr = new Date(item.release_date).toLocaleDateString('pt-BR');
        metaHtml += `<div class="meta-item"><svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> ${dateStr}</div>`;
    }
    if (item.rating) {
        metaHtml += `<div class="meta-item"><svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> ${item.rating.toFixed(1)}</div>`;
    }
    metaHtml += `
        <a href="${lbUrl}" target="_blank" class="meta-item letterboxd-link" title="Ver no Letterboxd">
            <svg class="meta-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="3.5"/><circle cx="12" cy="12" r="3.5"/><circle cx="19" cy="12" r="3.5"/></svg>
            Letterboxd
        </a>`;
    metaHtml += '</div>';

    // Injeta no container abaixo do vídeo
    playerInfoArea.innerHTML = `
        <div class="details-info" style="width: 100%;">
            <h2 id="modal-title" style="margin-top: 20px;">${item.title}</h2>
            <h3 id="modal-original-title">${item.original_title || ''}</h3>
            ${genresHtml}
            ${metaHtml}
            <p class="modal-synopsis">${item.synopsis || ''}</p>
        </div>
    `;
}

function closeModal() {
    modal.classList.add('hidden');
    videoFrame.src = '';
    
    document.body.style.overflow = '';

    if (window.location.pathname.startsWith('/watch/')) {
        const lastPage = navigationStack[navigationStack.length - 1];
        let targetUrl = '/';
        
        if (lastPage) {
            if (lastPage.type === 'category') {
                targetUrl = `/category/${lastPage.id}`;
            } else if (lastPage.type === 'folder') {
                targetUrl = `/folder/${lastPage.id}`;
            }
        }
        navigateTo(targetUrl);
    }
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