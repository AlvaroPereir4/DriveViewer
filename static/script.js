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

// --- HELPERS ---
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

/**
 * Gera HTML de estrelas a partir de nota TMDB (0–10)
 * Converte para escala 0–5 com meia-estrela
 */
function buildStars(rating) {
    if (!rating) return '';
    const score = Math.min(10, Math.max(0, rating));
    const stars5 = score / 2; // converte 0-10 → 0-5
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (stars5 >= i) {
            html += '<span class="star star-full">★</span>';
        } else if (stars5 >= i - 0.5) {
            html += '<span class="star star-half">★</span>';
        } else {
            html += '<span class="star star-empty">☆</span>';
        }
    }
    return html;
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

    // Spotlight global
    document.addEventListener('mousemove', (e) => {
        document.body.style.setProperty('--mouse-x', `${e.clientX}px`);
        document.body.style.setProperty('--mouse-y', `${e.clientY}px`);
    });

    // ESC fecha modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });

    initBackgroundEffects();
});

// --- EFEITOS DE FUNDO ---
function initBackgroundEffects() {
    const container = document.createElement('div');
    container.className = 'background-effects';
    document.body.appendChild(container);

    function spawnMeteor() {
        // Só cria meteoro se o modal estiver fechado
        if (!document.getElementById('video-modal').classList.contains('hidden')) return;

        const meteor = document.createElement('div');
        meteor.className = 'meteor';

        // Comprimento variado — bem maior que antes
        const len = Math.random() * 180 + 80;
        meteor.style.width = `${len}px`;

        // Diagonal ~30–50 graus caindo da esquerda para direita e para baixo
        const angle = Math.random() * 20 + 30; // 30° a 50°
        meteor.style.transform = `rotate(${angle}deg)`;
        meteor.style.transformOrigin = 'left center';

        // Posição inicial — começa fora da tela pelo topo ou esquerda
        const startFromTop = Math.random() > 0.4;
        if (startFromTop) {
            meteor.style.top  = `${-20}px`;
            meteor.style.left = `${Math.random() * 120}vw`;
        } else {
            meteor.style.top  = `${Math.random() * 60}vh`;
            meteor.style.left = `-${len + 20}px`;
        }

        // Opacidade sutil
        const opacity = Math.random() * 0.45 + 0.2;

        // Distância percorrida proporcional ao ângulo
        const dist = window.innerWidth * 1.3;
        const dy   = dist * Math.tan(angle * Math.PI / 180);

        // Duração bem lenta: 18–38 segundos
        const duration = (Math.random() * 20 + 18) * 1000;

        const anim = meteor.animate([
            { opacity: 0,       transform: `rotate(${angle}deg) translateX(0)` },
            { opacity,          transform: `rotate(${angle}deg) translateX(${dist * 0.15}px)`, offset: 0.08 },
            { opacity,          transform: `rotate(${angle}deg) translateX(${dist * 0.85}px)`, offset: 0.92 },
            { opacity: 0,       transform: `rotate(${angle}deg) translateX(${dist}px)` },
        ], { duration, easing: 'linear', fill: 'forwards' });

        anim.onfinish = () => { meteor.remove(); };
        container.appendChild(meteor);
    }

    // Cria meteoros de forma espaçada
    setInterval(spawnMeteor, 2200);
    // Alguns iniciais para não começar vazio
    setTimeout(spawnMeteor, 400);
    setTimeout(spawnMeteor, 1200);
    setTimeout(spawnMeteor, 2000);
}

// --- LAZY LOADING ---
function initLazyLoading() {
    if ('IntersectionObserver' in window) {
        lazyLoadObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) { loadCardImage(entry.target); observer.unobserve(entry.target); }
            });
        }, { rootMargin: '200px' });
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
    closeModal();
    videoFrame.src = '';

    if (path === '/' || path === '/index') {
        navigationStack = [{ name: 'Início', id: 'home', type: 'root' }];
        renderBreadcrumbs();
        renderCategories(allHomeData);
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
        renderCategories(allHomeData);
        const item = allHomeData.find(i => createSlug(i.title) === param || i.id === param);
        if (item) openDetailsModal(item, false);
    }
}

function navigateTo(url) { history.pushState(null, null, url); router(); }
function loadHome() { navigateTo('/'); }
function loadCategory(name, filterTag, type = 'main') { navigateTo(`/category/${filterTag}`); }
function loadFolder(folderId) { navigateTo(`/folder/${folderId}`); }

function _renderCategoryView(name, filterTag, type) {
    if (navigationStack.length === 0 || navigationStack[0].id !== 'home') {
        navigationStack = [{ name: 'Início', id: 'home', type: 'root' }];
    }
    const lastItem = navigationStack[navigationStack.length - 1];
    if (!lastItem || lastItem.id !== filterTag) {
        navigationStack.push({ name, id: filterTag, type: 'category', categoryType: type });
    }
    renderBreadcrumbs();
    if (type === 'genre') {
        currentList = allHomeData.filter(i => i.genres && i.genres.includes(filterTag));
    } else {
        currentList = filterTag === 'movie'
            ? allHomeData.filter(i => i.tag === 'movie')
            : allHomeData.filter(i => i.tag === 'series' || (i.type === 'folder' && i.tag !== 'movie'));
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
    const getCategoryPoster = (list) => list.find(i => i.poster)?.poster || null;

    const categories = [
        { title: 'Filmes', count: movies.length, type: 'main', filter: 'movie',  poster: getCategoryPoster(movies) },
        { title: 'Séries', count: series.length, type: 'main', filter: 'series', poster: getCategoryPoster(series) }
    ];

    const genreMap = {};
    items.forEach(item => {
        (item.genres || []).forEach(genre => {
            if (!genreMap[genre]) genreMap[genre] = { title: genre, count: 0, items: [] };
            genreMap[genre].count++;
            genreMap[genre].items.push(item);
        });
    });
    const sortedGenres = Object.values(genreMap)
        .map(g => ({ title: g.title, count: g.count, type: 'genre', filter: g.title, poster: getCategoryPoster(g.items) }))
        .sort((a, b) => b.count - a.count);

    const createCategoryCard = (cat) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper category-wrapper';

        const card = document.createElement('div');
        card.className = 'card category-card';
        if (cat.poster) {
            card.classList.add('loading');
            card.dataset.poster = cat.poster;
            if (lazyLoadObserver) lazyLoadObserver.observe(card);
        }
        card.innerHTML = `
            <div class="card-content" style="text-align:center; background: linear-gradient(to top, rgba(12,11,11,0.95), transparent); z-index:2;">
                <div class="card-title">${esc(cat.title)}</div>
                <div class="card-type">${esc(String(cat.count))} Títulos</div>
            </div>`;
        card.onclick = () => loadCategory(cat.title, cat.filter, cat.type);
        wrapper.appendChild(card);
        return wrapper;
    };

    categories.forEach(cat => appContainer.appendChild(createCategoryCard(cat)));

    if (sortedGenres.length > 0) {
        const sep = document.createElement('div');
        sep.style.gridColumn = '1 / -1';
        sep.innerHTML = '<h3 style="color:#8f8681;font-size:1.1rem;margin-top:30px;margin-bottom:10px;font-weight:400;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:10px;">Navegar por Gêneros</h3>';
        appContainer.appendChild(sep);
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
    appContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;">Carregando...</div>';
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

// ============================================================
// RENDER GRID — cards de filmes com delay de 1.5s
// ============================================================
function renderGrid(items) {
    appContainer.innerHTML = '';
    items.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
    itemsCountLabel.innerText = `Exibindo ${items.length} iten(s)`;

    if (items.length === 0) {
        appContainer.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#666;">Pasta vazia.</p>';
        return;
    }

    const EXPAND_DELAY = 0; // sem delay
    const EDGE_MARGIN  = 100;  // px antes da borda da tela

    items.forEach((item, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper';
        wrapper.style.setProperty('--item-index', Math.min(index, 25));

        const card = document.createElement('div');
        card.className = 'card';

        if (item.poster) {
            card.classList.add('loading');
            card.dataset.poster = item.poster;
            if (lazyLoadObserver) lazyLoadObserver.observe(card);
        }

        // Metadado simples (estado não-expandido)
        let metaInfo = '';
        if (item.year)             metaInfo = `<div class="card-type">${esc(String(item.year))}</div>`;
        else if (item.type === 'folder') metaInfo = '<div class="card-type">Pasta</div>';

        // ---- Conteúdo do painel expandido ----
        const starsHtml = buildStars(item.rating);

        const ratingRow = item.rating ? `
            <div class="hover-rating-row">
                <div class="hover-stars">
                    ${starsHtml}
                    <span class="hover-score-num">${item.rating.toFixed(1)}</span>
                    <span class="hover-score-src">TMDB</span>
                </div>
                ${item.year ? `<span class="hover-year-badge">${item.year}</span>` : ''}
            </div>` : (item.year ? `<div class="hover-rating-row"><span class="hover-year-badge">${item.year}</span></div>` : '');

        const genreTagsHtml = (item.genres || []).slice(0, 4)
            .map(g => `<span class="hover-genre-tag">${g}</span>`).join('');

        const synopsis = item.synopsis
            ? (item.synopsis.length > 160 ? item.synopsis.substring(0, 160) + '…' : item.synopsis)
            : '';

        const releaseStr = item.release_date
            ? new Date(item.release_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
            : '';

        const originalTitleHtml = (item.original_title && item.original_title !== item.title)
            ? `<div class="hover-original-title">${esc(item.original_title)}</div>`
            : '';

        // Carrega backdrop no primeiro hover
        if (item.backdrop) {
            card.addEventListener('mouseenter', () => {
                const bd = card.querySelector('.card-backdrop');
                if (bd && !bd.dataset.loaded) {
                    const img = new Image();
                    img.src = item.backdrop;
                    img.onload = () => {
                        bd.style.backgroundImage = `url('${item.backdrop}')`;
                        bd.dataset.loaded = 'true';
                        requestAnimationFrame(() => bd.classList.add('loaded'));
                    };
                }
            }, { passive: true });
        }

        card.innerHTML = `
            <div class="card-backdrop"></div>
            <div class="poster-layer"></div>
            <div class="card-content">
                <div class="card-title">${esc(item.title)}</div>
                ${metaInfo}
            </div>
            <div class="card-details-panel">
                <div class="details-content">
                    <div class="hover-title-block">
                        <div class="hover-title">${esc(item.title)}</div>
                        ${originalTitleHtml}
                    </div>

                    <div class="hover-divider"></div>

                    ${ratingRow}

                    ${genreTagsHtml ? `<div class="hover-genres">${genreTagsHtml}</div>` : ''}

                    ${synopsis ? `<div class="hover-synopsis-wrap"><p class="hover-desc">${esc(synopsis)}</p></div>` : ''}

                    ${releaseStr ? `<div class="hover-release">${esc(releaseStr)}</div>` : ''}
                </div>
            </div>
            <button class="corner-play-btn" title="Assistir">▶</button>`;

        // Pastas navegam no clique; filmes: só o botão de play faz algo
        if (item.type === 'folder' || item.type === 'drive_folders') {
            card.onclick = () => loadFolder(item.id);
        }
        // Nenhum card.onclick para filmes — só o botão abaixo

        // Botão play: abre o modal de detalhes direto
        const cornerPlay = card.querySelector('.corner-play-btn');
        if (cornerPlay) {
            cornerPlay.addEventListener('click', (e) => {
                e.stopPropagation();
                openDetailsModal(item, true);
            });
        }

        wrapper.appendChild(card);
        appContainer.appendChild(wrapper);
    });

    // ---- HOVER: Netflix-style (colapso instantâneo ao trocar) + baralho + borda ----
    const allWrappers = [...appContainer.querySelectorAll('.card-wrapper:not(.category-wrapper)')];
    let currentExpanded = null;

    function collapseCard(w, instant = false) {
        if (!w) return;
        if (instant) {
            w.classList.add('no-transition');
            w.classList.remove('is-expanded');
            // força reflow para aplicar no-transition antes de remover a classe
            w.offsetWidth;
            w.classList.remove('no-transition');
        } else {
            w.classList.remove('is-expanded');
        }
    }

    allWrappers.forEach((w, i) => {
        w.addEventListener('mouseenter', () => {
            // Se há outro card expandido, colapsa instantaneamente
            if (currentExpanded && currentExpanded !== w) {
                collapseCard(currentExpanded, true);
                // Limpa baralho do card anterior
                allWrappers.forEach(wr => wr.classList.remove(
                    'neighbor-left-1','neighbor-left-2',
                    'neighbor-right-1','neighbor-right-2'
                ));
            }
            currentExpanded = w;

            // Detecta borda
            const rect = w.getBoundingClientRect();
            const expandedW = rect.width * 1.85;
            w.classList.remove('expand-left', 'expand-right');
            if (rect.left + rect.width / 2 - expandedW / 2 < EDGE_MARGIN) {
                w.classList.add('expand-right');
            } else if (rect.right - rect.width / 2 + expandedW / 2 > window.innerWidth - EDGE_MARGIN) {
                w.classList.add('expand-left');
            }

            // Baralho
            [[i-1,'neighbor-left-1'],[i-2,'neighbor-left-2'],
             [i+1,'neighbor-right-1'],[i+2,'neighbor-right-2']]
                .forEach(([idx, cls]) => { if (allWrappers[idx]) allWrappers[idx].classList.add(cls); });

            w.classList.add('is-expanded');
        });

        w.addEventListener('mouseleave', () => {
            if (currentExpanded === w) currentExpanded = null;
            collapseCard(w, false);
            w.classList.remove('expand-left', 'expand-right');
            allWrappers.forEach(wr => wr.classList.remove(
                'neighbor-left-1','neighbor-left-2',
                'neighbor-right-1','neighbor-right-2'
            ));
        });
    });
}

function handleItemClick(item) {
    if (item.type === 'folder' || item.type === 'drive_folders') {
        loadFolder(item.id);
    } else {
        history.pushState(null, null, `/watch/${createSlug(item.title)}`);
        openDetailsModal(item, false);
    }
}

function applyModalBackdrop(item) {
    if (item.backdrop) {
        const img = new Image();
        img.src = item.backdrop;
        img.onload = () => {
            modalContent.style.backgroundImage =
                `linear-gradient(to right, rgba(6,5,4,0.92) 25%, rgba(6,5,4,0.45) 55%, rgba(6,5,4,0.15) 100%),
                 linear-gradient(to top, rgba(6,5,4,0.95) 0%, transparent 35%),
                 url('${item.backdrop}')`;
            modalContent.style.backgroundSize = 'cover';
            modalContent.style.backgroundPosition = 'center 20%';
        };
    } else {
        modalContent.style.backgroundImage = 'none';
        modalContent.style.background = '#060504';
    }
}

function openDetailsModal(item, updateUrl = true) {
    if (updateUrl) history.pushState(null, null, `/watch/${createSlug(item.title)}`);
    document.body.style.overflow = 'hidden';
    modalTitle.textContent = item.title;
    modalOriginalTitle.textContent = item.original_title || '';
    modalSynopsis.textContent = item.synopsis || 'Sinopse indisponível.';

    applyModalBackdrop(item);

    const posterWrapper = document.querySelector('.details-poster-wrapper');
    if (item.poster) {
        posterWrapper.classList.add('loading');
        modalPoster.style.display = 'none';
        modalPoster.src = item.poster;
        modalPoster.onload = () => { posterWrapper.classList.remove('loading'); modalPoster.style.display = 'block'; };
        modalPoster.onerror = () => posterWrapper.classList.remove('loading');
    } else {
        posterWrapper.classList.remove('loading');
        modalPoster.style.display = 'none';
    }

    modalGenres.innerHTML = '';
    (item.genres || []).forEach(genre => {
        const span = document.createElement('span');
        span.className = 'genre-tag';
        span.innerText = genre;
        modalGenres.appendChild(span);
    });

    let metaHtml = '';
    if (item.release_date) {
        const dateStr = new Date(item.release_date).toLocaleDateString('pt-BR');
        metaHtml += `<div class="meta-item"><svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> ${dateStr}</div>`;
    }
    if (item.rating) {
        metaHtml += `<div class="meta-item" title="Nota TMDB"><svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> ${item.rating.toFixed(1)} (TMDB)</div>`;
    }

    const lbSlug = item.letterboxd_slug || createSlug(item.original_title || item.title);
    metaHtml += `
        <a href="https://letterboxd.com/film/${lbSlug}/" target="_blank" class="meta-item letterboxd-link" title="Ver no Letterboxd">
            <svg class="meta-icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="3.5"/><circle cx="12" cy="12" r="3.5"/><circle cx="19" cy="12" r="3.5"/></svg>
            Letterboxd
        </a>`;
    modalMeta.innerHTML = metaHtml;

    playBtn.onclick = () => startVideo(item);
    detailsView.style.display = 'flex';
    playerView.classList.add('hidden');
    videoFrame.src = '';
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function startVideo(item) {
    detailsView.style.display = 'none';
    playerView.classList.remove('hidden');
    videoFrame.src = `https://drive.google.com/file/d/${item.id}/preview`;

    // Mantém o backdrop de fundo no player também
    applyModalBackdrop(item);

    const lbSlug = item.letterboxd_slug || createSlug(item.original_title || item.title);
    const genresHtml = (item.genres || []).length
        ? `<div class="modal-genres" style="margin-top:10px;">${item.genres.map(g => `<span class="genre-tag">${g}</span>`).join('')}</div>`
        : '';

    let metaHtml = '<div class="modal-meta-tags">';
    if (item.release_date) {
        const dateStr = new Date(item.release_date).toLocaleDateString('pt-BR');
        metaHtml += `<div class="meta-item"><svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> ${dateStr}</div>`;
    }
    if (item.rating) {
        metaHtml += `<div class="meta-item"><svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> ${item.rating.toFixed(1)}</div>`;
    }
    metaHtml += `<a href="https://letterboxd.com/film/${lbSlug}/" target="_blank" class="meta-item letterboxd-link"><svg class="meta-icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="3.5"/><circle cx="12" cy="12" r="3.5"/><circle cx="19" cy="12" r="3.5"/></svg> Letterboxd</a>`;
    metaHtml += '</div>';

    playerInfoArea.innerHTML = `
        <div class="details-info" style="width:100%;">
            <h2 style="margin-top:20px;">${esc(item.title)}</h2>
            <h3 style="font-size:1rem;font-weight:400;color:var(--text-secondary);font-style:italic;">${esc(item.original_title || '')}</h3>
            ${genresHtml}
            ${metaHtml}
            <p class="modal-synopsis">${esc(item.synopsis || '')}</p>
        </div>`;
}

function closeModal() {
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    videoFrame.src = '';
    document.body.style.overflow = '';
    // Volta a URL sem re-renderizar nada — grid continua no mesmo estado
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

window.onclick = (e) => { if (e.target === modal) closeModal(); };

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
