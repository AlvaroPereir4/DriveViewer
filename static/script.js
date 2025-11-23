document.addEventListener('DOMContentLoaded', () => {
    // Vistas principais
    const browserView = document.getElementById('browser-view');
    const videoView = document.getElementById('video-view');
    const detailsView = document.getElementById('details-view');

    // Elementos do Navegador
    const fileBrowser = document.getElementById('file-browser');
    const breadcrumb = document.getElementById('breadcrumb');
    const backToBrowserBtn = document.getElementById('back-to-browser-btn');

    // Elementos da Tela de Detalhes
    const closeDetailsBtn = detailsView.querySelector('.close-btn');
    const detailsTitle = document.getElementById('details-title');
    const detailsSynopsis = document.getElementById('details-synopsis');
    const detailsActionBtn = document.getElementById('details-action-btn');

    // Player de Vídeo
    const playerContainer = document.getElementById('player-container');

    const navigationHistory = [];

    // --- Funções de Exibição de Telas (LÓGICA CORRIGIDA) ---
    const showView = (viewId) => {
        // Esconde todas as telas primeiro
        browserView.classList.add('hidden');
        videoView.classList.add('hidden');
        detailsView.classList.add('hidden');

        // Mostra apenas a tela desejada
        if (viewId === 'browser') {
            browserView.classList.remove('hidden');
        } else if (viewId === 'video') {
            videoView.classList.remove('hidden');
        } else if (viewId === 'details') {
            detailsView.classList.remove('hidden');
        }
    };

    const showBrowser = () => {
        showView('browser');
        if (playerContainer.innerHTML !== '') playerContainer.innerHTML = '';
    };

    // --- Funções de Navegação e Busca de Dados ---
    const browse = async (folderId, folderName) => {
        navigationHistory.push({ id: folderId, name: folderName });
        updateBreadcrumb();
        fileBrowser.innerHTML = '<p>Carregando...</p>';
        try {
            const response = await fetch(`/api/browse/${folderId}`);
            const items = await response.json();
            renderItems(items, false);
        } catch (error) {
            console.error('Erro ao buscar itens da pasta:', error);
            fileBrowser.innerHTML = '<p>Não foi possível carregar o conteúdo da pasta.</p>';
        }
    };

    const loadHomePage = async () => {
        navigationHistory.splice(0, navigationHistory.length);
        updateBreadcrumb();
        fileBrowser.innerHTML = '<p>Carregando catálogo...</p>';
        try {
            const response = await fetch('/api/home');
            const homeItems = await response.json();
            renderItems(homeItems, true);
        } catch (error) {
            console.error('Erro ao carregar a página inicial:', error);
            fileBrowser.innerHTML = '<p>Não foi possível carregar o catálogo.</p>';
        }
    };

    // --- Funções de Renderização ---
    const renderItems = (items, isHomePage) => {
        fileBrowser.innerHTML = '';
        if (items.length === 0) {
            fileBrowser.innerHTML = isHomePage ? '<p>Nenhum item no catálogo.</p>' : '<p>Esta pasta está vazia.</p>';
            return;
        }
        const sortedItems = items.sort((a, b) => {
            const typeA = a.type || a.mimeType;
            const typeB = b.type || b.mimeType;
            if (typeA.includes('folder') && !typeB.includes('folder')) return -1;
            if (!typeA.includes('folder') && typeB.includes('folder')) return 1;
            return (a.title || a.name).localeCompare(b.title || b.name);
        });
        sortedItems.forEach(item => fileBrowser.appendChild(createBrowserItem(item, isHomePage)));
    };

    const createBrowserItem = (item, isHomePage) => {
        const div = document.createElement('div');
        div.className = 'browser-item';
        const iconDiv = document.createElement('div');
        iconDiv.className = 'item-icon';
        const icon = document.createElement('i');
        icon.className = 'fas';
        const nameDiv = document.createElement('div');
        nameDiv.className = 'item-name';
        nameDiv.textContent = item.title || item.name;
        const itemType = isHomePage ? item.type : (item.mimeType.includes('folder') ? 'folder' : 'video');

        if (itemType === 'folder') icon.classList.add('fa-folder');
        else icon.classList.add('fa-file-video');
        
        if (isHomePage) {
            div.addEventListener('click', () => showDetails(item));
        } else {
            if (itemType === 'folder') {
                div.addEventListener('click', () => browse(item.id, item.name));
            } else {
                div.addEventListener('click', () => playVideo(item.id));
            }
        }
        iconDiv.appendChild(icon);
        div.appendChild(iconDiv);
        div.appendChild(nameDiv);
        return div;
    };

    const updateBreadcrumb = () => {
        breadcrumb.innerHTML = '';
        if (navigationHistory.length === 0) {
            breadcrumb.style.display = 'none';
            return;
        }
        breadcrumb.style.display = 'block';
        const homeLink = document.createElement('a');
        homeLink.href = '#';
        homeLink.textContent = 'Início';
        homeLink.addEventListener('click', (e) => { e.preventDefault(); loadHomePage(); });
        breadcrumb.appendChild(homeLink);
        navigationHistory.forEach((item, index) => {
            breadcrumb.appendChild(document.createElement('span')).textContent = '>';
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = item.name;
            if (index < navigationHistory.length - 1) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    navigationHistory.splice(index + 1);
                    browse(item.id, item.name);
                });
            }
            breadcrumb.appendChild(link);
        });
    };

    // --- Funções da Tela de Detalhes e Player ---
    const showDetails = (item) => {
        detailsTitle.textContent = item.title;
        detailsSynopsis.textContent = item.synopsis;
        detailsActionBtn.textContent = item.type === 'folder' ? 'Abrir Pasta' : 'Assistir Agora';
        const newBtn = detailsActionBtn.cloneNode(true);
        detailsActionBtn.parentNode.replaceChild(newBtn, detailsActionBtn);
        
        newBtn.addEventListener('click', () => {
            if (item.type === 'folder') {
                showView('browser');
                browse(item.id, item.title);
            } else {
                playVideo(item.id);
            }
        });
        showView('details');
    };

    const playVideo = (videoId) => {
        showView('video');
        playerContainer.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.src = `https://drive.google.com/file/d/${videoId}/preview`;
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('allow', 'autoplay');
        playerContainer.appendChild(iframe);
    };

    // --- Inicialização ---
    closeDetailsBtn.addEventListener('click', () => showView('browser'));
    backToBrowserBtn.addEventListener('click', showBrowser);
    loadHomePage();
});