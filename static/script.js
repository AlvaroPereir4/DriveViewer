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
const trailerBtn = document.getElementById('trailer-btn');
const playerInfoArea = document.getElementById('player-info-area');
const modalContent = document.querySelector('.modal-content');
const modalTagline = document.getElementById('modal-tagline');
const modalCollection = document.getElementById('modal-collection');
const modalCrew = document.getElementById('modal-crew');
const modalFinancials = document.getElementById('modal-financials');
const modalProduction = document.getElementById('modal-production');
const heroBillboard = document.getElementById('hero-billboard');
const genreQuickbar = document.getElementById('genre-quickbar');

let navigationStack = [];
let currentModalItem = null;
let allHomeData = [];
let currentList = [];
let lazyLoadObserver;
let currentFeaturedHero = null;

// Helper para escapar HTML contra XSS
function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

function createSlug(text) {
    return text.toString().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

function buildStars(rating) {
    if (!rating) return '';
    const score = Math.min(10, Math.max(0, rating));
    const stars5 = score / 2;
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (stars5 >= i) {
            html += '<span style="color:#e87c03;">★</span>';
        } else if (stars5 >= i - 0.5) {
            html += '<span style="color:#e87c03;opacity:0.7;">★</span>';
        } else {
            html += '<span style="color:rgba(255,255,255,0.2);">☆</span>';
        }
    }
    return html;
}

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    initLazyLoading();
    initApp();

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const term = e.target.value.toLowerCase().trim();
            if (!term) {
                renderGrid(currentList, true);
                return;
            }
            const filtered = (currentList.length > 0 ? currentList : allHomeData).filter(item => 
                (item.title && item.title.toLowerCase().includes(term)) ||
                (item.original_title && item.original_title.toLowerCase().includes(term)) ||
                (item.director && item.director.toLowerCase().includes(term)) ||
                (item.genres && item.genres.some(g => g.toLowerCase().includes(term)))
            );
            renderGrid(filtered, true);
        }, 180);
    });

    window.addEventListener('popstate', router);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });
});

function initLazyLoading() {
    if ('IntersectionObserver' in window) {
        lazyLoadObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) { 
                    loadCardImage(entry.target); 
                    observer.unobserve(entry.target); 
                }
            });
        }, { rootMargin: '250px' });
    } else {
        lazyLoadObserver = { observe: (card) => loadCardImage(card) };
    }
}

function loadCardImage(card) {
    const poster = card.dataset.poster;
    if (!poster) return;
    const img = new Image();
    img.src = poster;
    img.onload = () => {
        const posterLayer = card.querySelector('.poster-layer');
        if (posterLayer) {
            posterLayer.style.backgroundImage = `url('${poster}')`;
        } else if (card.classList.contains('category-card')) {
            card.style.backgroundImage = `linear-gradient(rgba(12,11,11,0.7), rgba(12,11,11,0.92)), url('${poster}')`;
            card.style.backgroundSize = 'cover';
            card.style.backgroundPosition = 'center';
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
        appContainer.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:40px;color:#8f8681;">Erro ao carregar conteúdo do catálogo.</p>';
    }
}

// --- ROTEADOR ---
function router() {
    const path = window.location.pathname;
    searchInput.value = '';
    closeModal();
    videoFrame.src = '';
    updateActiveNavButton(path);

    if (path === '/' || path === '/index') {
        navigationStack = [{ name: 'Início', id: 'home', type: 'root' }];
        renderBreadcrumbs();
        renderHomeView(allHomeData);
    } else if (path.startsWith('/category/')) {
        const filterTag = decodeURIComponent(path.split('/category/')[1]);
        let type = 'main', name = filterTag;
        if (filterTag === 'movie') name = 'Filmes';
        else if (filterTag === 'series') name = 'Séries';
        else type = 'genre';
        _renderCategoryView(name, filterTag, type);
    } else if (path.startsWith('/folder/')) {
        _renderFolderView(path.split('/folder/')[1], 'Pasta');
    } else if (path.startsWith('/watch/')) {
        const param = path.split('/watch/')[1];
        renderHomeView(allHomeData);
        const item = allHomeData.find(i => createSlug(i.title) === param || i.id === param);
        if (item) openDetailsModal(item, false);
    }
}

function updateActiveNavButton(path) {
    document.querySelectorAll('.nav-link-btn').forEach(btn => btn.classList.remove('active'));
    if (path === '/' || path === '/index') {
        const h = document.getElementById('nav-home');
        if (h) h.classList.add('active');
    } else if (path.includes('movie')) {
        const m = document.getElementById('nav-movies');
        if (m) m.classList.add('active');
    } else if (path.includes('series')) {
        const s = document.getElementById('nav-series');
        if (s) s.classList.add('active');
    }
}

function navigateTo(url) { 
    history.pushState(null, null, url); 
    router(); 
}
function loadHome() { navigateTo('/'); }
function loadCategory(name, filterTag, type = 'main') { navigateTo(`/category/${filterTag}`); }
function loadFolder(folderId) { navigateTo(`/folder/${folderId}`); }

// --- HERO BILLBOARD ---
function renderHeroBillboard(items) {
    if (!heroBillboard) return;

    // Encontra os melhores candidatos para o destaque (tem backdrop, nota alta ou popularidade)
    const candidates = items.filter(i => i.backdrop && i.synopsis && i.synopsis.length > 30);
    const heroItem = candidates.length > 0 
        ? (candidates.find(i => i.rating >= 7.5) || candidates[0])
        : items.find(i => i.backdrop) || items[0];

    if (!heroItem) {
        heroBillboard.classList.add('hidden');
        return;
    }

    currentFeaturedHero = heroItem;
    heroBillboard.classList.remove('hidden');

    const backdropImg = document.getElementById('hero-backdrop');
    if (backdropImg) backdropImg.src = heroItem.backdrop || heroItem.poster || '';

    const heroTitle = document.getElementById('hero-title');
    if (heroTitle) heroTitle.textContent = heroItem.title || '';

    const heroSynopsis = document.getElementById('hero-synopsis');
    if (heroSynopsis) heroSynopsis.textContent = heroItem.synopsis || '';

    const heroGenre = document.getElementById('hero-genre');
    if (heroGenre) heroGenre.textContent = (heroItem.genres && heroItem.genres[0]) || (heroItem.tag === 'series' ? 'Série' : 'Filme');

    const heroYear = document.getElementById('hero-year');
    if (heroYear) heroYear.textContent = heroItem.year || '';

    const heroRating = document.getElementById('hero-rating');
    if (heroRating) heroRating.textContent = heroItem.rating ? `★ ${heroItem.rating.toFixed(1)} TMDB` : '';

    const heroPlayBtn = document.getElementById('hero-play-btn');
    if (heroPlayBtn) heroPlayBtn.onclick = () => openDetailsModal(heroItem, true);

    const heroDetailsBtn = document.getElementById('hero-details-btn');
    if (heroDetailsBtn) heroDetailsBtn.onclick = () => openDetailsModal(heroItem, true);
}

// --- GENRE QUICKBAR ---
function renderGenreQuickbar(genres, activeGenre = null) {
    if (!genreQuickbar) return;
    genreQuickbar.innerHTML = '';
    genreQuickbar.classList.remove('hidden');

    // Botão "Todos"
    const allBtn = document.createElement('button');
    allBtn.className = `genre-quick-btn ${!activeGenre ? 'active' : ''}`;
    allBtn.textContent = 'Todos';
    allBtn.onclick = () => loadHome();
    genreQuickbar.appendChild(allBtn);

    genres.slice(0, 10).forEach(g => {
        const btn = document.createElement('button');
        btn.className = `genre-quick-btn ${activeGenre === g.title ? 'active' : ''}`;
        btn.textContent = `${g.title} (${g.count})`;
        btn.onclick = () => loadCategory(g.title, g.title, 'genre');
        genreQuickbar.appendChild(btn);
    });
}

// --- HOME VIEW ---
function renderHomeView(items) {
    appContainer.innerHTML = '';
    itemsCountLabel.innerText = '';
    
    // Renderiza Hero
    renderHeroBillboard(items);

    // Processa Gêneros
    const movies = items.filter(i => i.tag === 'movie');
    const series = items.filter(i => i.tag === 'series' || (i.type === 'folder' && i.tag !== 'movie'));

    const genreMap = {};
    movies.forEach(item => {
        (item.genres || []).forEach(genre => {
            if (!genreMap[genre]) genreMap[genre] = { title: genre, count: 0, items: [] };
            genreMap[genre].count++;
            genreMap[genre].items.push(item);
        });
    });
    const sortedGenres = Object.values(genreMap).sort((a, b) => b.count - a.count);

    renderGenreQuickbar(sortedGenres, null);

    // Seção 1: Adicionados Recentemente / Destaques
    const recentItems = [...items].reverse().slice(0, 10);
    if (recentItems.length > 0) {
        const secHeader = document.createElement('div');
        secHeader.className = 'swimlane-section';
        secHeader.innerHTML = `
            <div class="swimlane-header">
                <div class="swimlane-title">
                    <span class="swimlane-indicator"></span>
                    <span>Adicionados Recentemente</span>
                </div>
                <a href="#" onclick="event.preventDefault(); loadCategory('Filmes', 'movie', 'main');" class="swimlane-more-link">Ver catálogo completo →</a>
            </div>`;
        appContainer.appendChild(secHeader);
        recentItems.forEach((item, idx) => renderCard(item, idx, false));
    }

    // Seção 2: Séries (se houver)
    if (series.length > 0) {
        const secSeries = document.createElement('div');
        secSeries.className = 'swimlane-section';
        secSeries.innerHTML = `
            <div class="swimlane-header">
                <div class="swimlane-title">
                    <span class="swimlane-indicator"></span>
                    <span>Séries de TV & Minisséries</span>
                </div>
                <a href="#" onclick="event.preventDefault(); loadCategory('Séries', 'series', 'main');" class="swimlane-more-link">Ver todas →</a>
            </div>`;
        appContainer.appendChild(secSeries);
        series.slice(0, 5).forEach((item, idx) => renderCard(item, idx, false));
    }
}

function _renderCategoryView(name, filterTag, type) {
    if (heroBillboard) heroBillboard.classList.add('hidden');
    if (navigationStack.length === 0 || navigationStack[0].id !== 'home') {
        navigationStack = [{ name: 'Início', id: 'home', type: 'root' }];
    }
    const lastItem = navigationStack[navigationStack.length - 1];
    if (!lastItem || lastItem.id !== filterTag) {
        navigationStack.push({ name, id: filterTag, type: 'category', categoryType: type });
    }
    renderBreadcrumbs();

    if (type === 'genre') {
        currentList = allHomeData.filter(i => i.tag === 'movie' && i.genres && i.genres.includes(filterTag));
    } else {
        currentList = filterTag === 'movie'
            ? allHomeData.filter(i => i.tag === 'movie')
            : allHomeData.filter(i => i.tag === 'series' || (i.type === 'folder' && i.tag !== 'movie'));
    }

    // Renderiza quickbar para facilitar a troca de gêneros
    const genreMap = {};
    allHomeData.filter(i => i.tag === 'movie').forEach(item => {
        (item.genres || []).forEach(genre => {
            if (!genreMap[genre]) genreMap[genre] = { title: genre, count: 0 };
            genreMap[genre].count++;
        });
    });
    const sortedGenres = Object.values(genreMap).sort((a, b) => b.count - a.count);
    renderGenreQuickbar(sortedGenres, type === 'genre' ? filterTag : null);

    renderGrid(currentList);
}

async function _renderFolderView(folderId, folderName) {
    if (heroBillboard) heroBillboard.classList.add('hidden');
    if (genreQuickbar) genreQuickbar.classList.add('hidden');

    const lastItem = navigationStack[navigationStack.length - 1];
    if (!lastItem || lastItem.id !== folderId) {
        navigationStack.push({ name: folderName, id: folderId, type: 'folder' });
    }
    renderBreadcrumbs();
    appContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#8f8681;">Carregando pasta...</div>';
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
        appContainer.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:40px;color:#8f8681;">Erro ao carregar pasta.</p>';
    }
}

// --- HOVER INTENT INTELIGENTE (Sem acidentes ao passar o mouse!) ---
function setupCardHoverIntent(wrapper) {
    let hoverTimer = null;

    wrapper.addEventListener('mouseenter', () => {
        hoverTimer = setTimeout(() => {
            wrapper.classList.add('hover-intent-active');
        }, 260); // 260ms de intenção: só ativa se o usuário realmente parou sobre o card!
    });

    wrapper.addEventListener('mouseleave', () => {
        if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }
        wrapper.classList.remove('hover-intent-active');
    });
}

// --- RENDER GRID ---
function renderGrid(items, skipAnimation = false) {
    appContainer.innerHTML = '';
    items.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
    itemsCountLabel.innerText = `Exibindo ${items.length} título(s)`;

    if (items.length === 0) {
        appContainer.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:40px;color:#8f8681;">Nenhum item encontrado.</p>';
        return;
    }

    const PAGE_SIZE = 40;
    let renderedCount = 0;

    function renderBatch(startIndex, skip) {
        const batch = items.slice(startIndex, startIndex + PAGE_SIZE);
        batch.forEach((item, i) => renderCard(item, startIndex + i, skip));
        renderedCount = startIndex + batch.length;

        const old = appContainer.querySelector('.grid-sentinel');
        if (old) old.remove();

        if (renderedCount < items.length) {
            const sentinel = document.createElement('div');
            sentinel.className = 'grid-sentinel';
            sentinel.style.cssText = 'grid-column:1/-1;height:1px;';
            appContainer.appendChild(sentinel);

            const gridScrollObserver = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    gridScrollObserver.disconnect();
                    renderBatch(renderedCount, true);
                }
            }, { rootMargin: '250px' });
            gridScrollObserver.observe(sentinel);
        }
    }

    renderBatch(0, skipAnimation);
}

// --- RENDER CARD INDIVIDUAL ---
function renderCard(item, index, skipAnimation = false) {
    const wrapper = document.createElement('div');
    wrapper.className = skipAnimation ? 'card-wrapper no-entrance' : 'card-wrapper';
    if (!skipAnimation) wrapper.style.setProperty('--item-index', Math.min(index, 20));

    const card = document.createElement('div');
    card.className = 'card';

    if (item.poster) {
        card.classList.add('loading');
        card.dataset.poster = item.poster;
        if (lazyLoadObserver) lazyLoadObserver.observe(card);
    }

    let metaInfo = '';
    if (item.year) metaInfo = `<div class="card-type">${esc(String(item.year))}</div>`;
    else if (item.type === 'folder') metaInfo = '<div class="card-type">Pasta</div>';

    const ratingBadge = item.rating 
        ? `<span class="card-rating-chip">★ ${item.rating.toFixed(1)}</span>`
        : '';

    const genreText = (item.genres && item.genres.length > 0)
        ? item.genres.slice(0, 2).join(' • ')
        : (item.tag === 'series' ? 'Série' : '');

    card.innerHTML = `
        <div class="poster-layer"></div>
        <div class="card-content">
            <div class="card-title">${esc(item.title)}</div>
            ${metaInfo}
        </div>
        <div class="card-hover-overlay">
            <div class="card-hover-top">
                ${ratingBadge}
            </div>
            <div class="card-hover-bottom">
                <div class="card-hover-play-btn" title="Assistir">▶</div>
                <div class="card-hover-title">${esc(item.title)}</div>
                <div class="card-hover-meta">
                    ${item.year ? `<span>${item.year}</span>` : ''}
                    ${genreText ? `<span>•</span><span>${esc(genreText)}</span>` : ''}
                </div>
            </div>
        </div>`;

    if (item.type === 'folder' || item.type === 'drive_folders') {
        card.onclick = () => loadFolder(item.id);
    } else {
        card.onclick = () => openDetailsModal(item, true);
    }

    const playBtnEl = card.querySelector('.card-hover-play-btn');
    if (playBtnEl && item.type !== 'folder') {
        playBtnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            openDetailsModal(item, true);
        });
    }

    setupCardHoverIntent(wrapper);
    wrapper.appendChild(card);
    appContainer.appendChild(wrapper);
}

// --- MODAL DE DETALHES ---
const SVG_CALENDAR = `<svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
const SVG_STAR     = `<svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const SVG_CLOCK    = `<svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const SVG_LB       = `<svg class="meta-icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="3.5"/><circle cx="12" cy="12" r="3.5"/><circle cx="19" cy="12" r="3.5"/></svg>`;

function formatMoney(val) {
    if (!val || val === 0) return null;
    if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000)     return `$${(val / 1_000_000).toFixed(0)}M`;
    return `$${val.toLocaleString()}`;
}

function applyModalBackdrop(item) {
    modalContent.classList.remove('loading');
    modalContent.style.backgroundImage = 'none';
    modalContent.style.background = '#110f0e';

    if (item.backdrop) {
        const img = new Image();
        img.src = item.backdrop;
        img.onload = () => {
            modalContent.style.backgroundImage =
                `linear-gradient(to right, rgba(17,15,14,0.96) 30%, rgba(17,15,14,0.7) 65%, rgba(17,15,14,0.4) 100%),
                 linear-gradient(to top, rgba(17,15,14,0.98) 0%, transparent 40%),
                 url('${item.backdrop}')`;
            modalContent.style.backgroundSize = 'cover';
            modalContent.style.backgroundPosition = 'center 20%';
        };
    }
}

async function openDetailsModal(item, updateUrl = true) {
    if (!item._detailLoaded) {
        try {
            const res = await fetch(`/api/media/${encodeURIComponent(item.id)}`);
            if (res.ok) {
                const full = await res.json();
                Object.assign(item, full);
                item._detailLoaded = true;
            }
        } catch(e) { /* usa os dados existentes */ }
    }

    currentModalItem = item;
    if (updateUrl) history.pushState(null, null, `/watch/${createSlug(item.title)}`);
    document.body.style.overflow = 'hidden';

    modalTitle.textContent = item.title;
    modalOriginalTitle.textContent = item.original_title && item.original_title !== item.title ? item.original_title : '';

    modalTagline.textContent = item.tagline ? `"${item.tagline}"` : '';
    modalTagline.style.display = item.tagline ? 'block' : 'none';

    modalCollection.innerHTML = item.belongs_to_collection
        ? `<span class="collection-badge">${esc(item.belongs_to_collection)}</span>`
        : '';

    modalSynopsis.textContent = item.synopsis || 'Sinopse indisponível.';

    applyModalBackdrop(item);

    const posterWrapper = document.querySelector('.details-poster-wrapper');
    if (item.poster) {
        posterWrapper.classList.add('loading');
        modalPoster.style.display = 'none';
        modalPoster.src = item.poster;
        modalPoster.onload  = () => { posterWrapper.classList.remove('loading'); modalPoster.style.display = 'block'; };
        modalPoster.onerror = () => posterWrapper.classList.remove('loading');
    } else {
        posterWrapper.classList.remove('loading');
        modalPoster.style.display = 'none';
    }

    modalGenres.innerHTML = '';
    (item.genres || []).forEach(genre => {
        const span = document.createElement('span');
        span.className = 'genre-tag';
        span.textContent = genre;
        modalGenres.appendChild(span);
    });

    const lbSlug = item.letterboxd_slug || createSlug(item.original_title || item.title);
    let metaHtml = '';
    if (item.certification) metaHtml += `<span class="cert-badge">${esc(item.certification)}</span>`;
    if (item.year)    metaHtml += `<div class="meta-item">${SVG_CALENDAR} ${esc(String(item.year))}</div>`;
    if (item.runtime) metaHtml += `<div class="meta-item">${SVG_CLOCK} ${esc(item.runtime)}</div>`;
    if (item.rating)  metaHtml += `<div class="meta-item" title="${item.vote_count ? item.vote_count.toLocaleString() + ' votos' : ''}">
                                        ${SVG_STAR} ${item.rating.toFixed(1)}
                                   </div>`;
    if (item.number_of_seasons) metaHtml += `<div class="meta-item">📺 ${item.number_of_seasons} Temporada${item.number_of_seasons > 1 ? 's' : ''}</div>`;
    metaHtml += `<a href="https://letterboxd.com/film/${lbSlug}/" target="_blank" class="meta-item letterboxd-link" title="Ver no Letterboxd">${SVG_LB} Letterboxd</a>`;
    modalMeta.innerHTML = metaHtml;

    let crewHtml = '';
    if (item.director) crewHtml += `<div class="crew-row"><span class="crew-label">Direção</span><span class="crew-value">${esc(item.director)}</span></div>`;
    if (item.cast_list) {
        const chips = item.cast_list.split(',').map(n => `<span class="cast-chip">${esc(n.trim())}</span>`).join('');
        crewHtml += `<div class="crew-row"><span class="crew-label">Elenco</span><div class="cast-chips">${chips}</div></div>`;
    }
    modalCrew.innerHTML = crewHtml;

    const budget  = formatMoney(item.budget);
    const revenue = formatMoney(item.revenue);
    if (budget || revenue) {
        modalFinancials.innerHTML = `<div class="financials-row">
            ${budget  ? `<div class="financial-item"><span class="financial-label">Orçamento</span><span class="financial-value">${budget}</span></div>` : ''}
            ${revenue ? `<div class="financial-item"><span class="financial-label">Bilheteria</span><span class="financial-value">${revenue}</span></div>` : ''}
        </div>`;
        modalFinancials.style.display = 'block';
    } else {
        modalFinancials.style.display = 'none';
    }

    const prodParts = [item.production_companies, item.production_countries].filter(Boolean);
    modalProduction.innerHTML = prodParts.length
        ? `<div class="production-row">${prodParts.map(p => `<span>${esc(p)}</span>`).join('<span class="prod-sep">·</span>')}</div>`
        : '';

    if (item.trailer_key) {
        trailerBtn.classList.remove('hidden');
        trailerBtn.onclick = () => startVideo(item, 'trailer');
    } else {
        trailerBtn.classList.add('hidden');
    }
    playBtn.onclick = () => startVideo(item, 'drive');

    detailsView.style.display = 'flex';
    playerView.classList.add('hidden');
    videoFrame.src = '';
    modal.classList.remove('hidden');
}

function backToDetails() {
    videoFrame.src = '';
    playerView.classList.add('hidden');
    detailsView.style.display = 'flex';
    document.getElementById('back-to-details-btn').classList.add('hidden');
}

function startVideo(item, type = 'drive') {
    detailsView.style.display = 'none';
    playerView.classList.remove('hidden');

    const backBtn = document.getElementById('back-to-details-btn');
    const blocker = document.querySelector('.iframe-blocker');

    if (type === 'trailer') {
        backBtn.classList.remove('hidden');
        if (blocker) blocker.style.display = 'none';
    } else {
        backBtn.classList.add('hidden');
        if (blocker) blocker.style.display = '';
    }

    videoFrame.src = type === 'trailer'
        ? `https://www.youtube.com/embed/${item.trailer_key}?autoplay=1`
        : `https://drive.google.com/file/d/${item.id}/preview`;

    applyModalBackdrop(item);

    const lbSlug = item.letterboxd_slug || createSlug(item.original_title || item.title);
    const genresHtml = (item.genres || []).length
        ? `<div class="modal-genres">${item.genres.map(g => `<span class="genre-tag">${esc(g)}</span>`).join('')}</div>`
        : '';

    playerInfoArea.innerHTML = `
        <div class="details-info" style="width:100%;margin-top:20px;">
            <h2 style="font-size:1.8rem;font-weight:700;">${esc(item.title)}</h2>
            ${item.original_title && item.original_title !== item.title ? `<h3 style="font-size:0.9rem;color:var(--text-secondary);font-style:italic;">${esc(item.original_title)}</h3>` : ''}
            ${item.tagline ? `<p class="modal-tagline" style="display:block;">"${esc(item.tagline)}"</p>` : ''}
            ${genresHtml}
            <div class="modal-meta-tags">
                ${item.year    ? `<div class="meta-item">${SVG_CALENDAR} ${esc(String(item.year))}</div>` : ''}
                ${item.runtime ? `<div class="meta-item">${SVG_CLOCK} ${esc(item.runtime)}</div>` : ''}
                ${item.rating  ? `<div class="meta-item">${SVG_STAR} ${item.rating.toFixed(1)}</div>` : ''}
                <a href="https://letterboxd.com/film/${lbSlug}/" target="_blank" class="meta-item letterboxd-link">${SVG_LB} Letterboxd</a>
            </div>
            <p class="modal-synopsis" style="margin-top:8px;">${esc(item.synopsis || '')}</p>
        </div>`;
}

function closeModal() {
    modal.classList.add('hidden');
    videoFrame.src = '';
    document.body.style.overflow = '';
    if (window.location.pathname.startsWith('/watch/')) {
        const lastPage = navigationStack[navigationStack.length - 1];
        let targetUrl = '/';
        if (lastPage) {
            if (lastPage.type === 'category') targetUrl = `/category/${lastPage.id}`;
            else if (lastPage.type === 'folder')   targetUrl = `/folder/${lastPage.id}`;
        }
        history.replaceState(null, null, targetUrl);
    }
}

window.onclick = (e) => { 
    if (e.target === modal) closeModal(); 
};

function renderBreadcrumbs() {
    breadcrumbsContainer.innerHTML = '';
    navigationStack.forEach((crumb, index) => {
        const span = document.createElement('span');
        span.className = 'breadcrumb-item';
        span.innerText = crumb.name;
        span.onclick = () => {
            if (index === 0) loadHome();
            else if (navigationStack[index].type === 'category') {
                while (navigationStack.length > index + 1) navigationStack.pop();
                loadCategory(navigationStack[index].name, navigationStack[index].id, navigationStack[index].categoryType);
            }
        };
        breadcrumbsContainer.appendChild(span);
        if (index < navigationStack.length - 1) {
            const sep = document.createElement('span');
            sep.className = 'breadcrumb-separator';
            sep.innerText = '/';
            breadcrumbsContainer.appendChild(sep);
        }
    });
}
