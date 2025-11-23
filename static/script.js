document.addEventListener('DOMContentLoaded', () => {
    const browserView = document.getElementById('browser-view');
    const videoView = document.getElementById('video-view');
    const fileBrowser = document.getElementById('file-browser');
    const videoPlayer = document.getElementById('video-player');
    const breadcrumb = document.getElementById('breadcrumb');
    const backToBrowserBtn = document.getElementById('back-to-browser-btn');

    // Pilha para gerenciar o histórico de navegação (para o "voltar")
    const navigationHistory = [];

    const showBrowser = () => {
        videoView.classList.add('hidden');
        browserView.classList.remove('hidden');
        videoPlayer.pause();
        videoPlayer.src = '';
    };

    const showPlayer = () => {
        browserView.classList.add('hidden');
        videoView.classList.remove('hidden');
    };

    const updateBreadcrumb = () => {
        breadcrumb.innerHTML = '';
        navigationHistory.forEach((item, index) => {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = item.name;
            link.dataset.folderId = item.id;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                // Remove todos os itens da pilha a partir do clicado
                navigationHistory.splice(index + 1);
                browse(item.id);
            });
            breadcrumb.appendChild(link);
            if (index < navigationHistory.length - 1) {
                breadcrumb.appendChild(document.createElement('span')).textContent = '>';
            }
        });
    };

    const playVideo = (videoId) => {
        console.log(`Tocando vídeo com ID: ${videoId}`);
        showPlayer();
        const embedUrl = `https://drive.google.com/file/d/${videoId}/preview`;
        videoPlayer.src = embedUrl;
        videoPlayer.play().catch(e => console.error("Erro ao tocar vídeo:", e));
    };

    const createBrowserItem = (item) => {
        const div = document.createElement('div');
        div.className = 'browser-item';
        div.dataset.id = item.id;
        div.dataset.name = item.name;

        const iconDiv = document.createElement('div');
        iconDiv.className = 'item-icon';
        const icon = document.createElement('i');
        icon.className = 'fas';

        if (item.mimeType === 'application/vnd.google-apps.folder') {
            icon.classList.add('fa-folder');
            div.addEventListener('click', () => {
                navigationHistory.push({ id: item.id, name: item.name });
                browse(item.id);
            });
        } else {
            icon.classList.add('fa-file-video');
            div.addEventListener('click', () => playVideo(item.id));
        }
        
        iconDiv.appendChild(icon);

        const nameDiv = document.createElement('div');
        nameDiv.className = 'item-name';
        nameDiv.textContent = item.name;

        div.appendChild(iconDiv);
        div.appendChild(nameDiv);
        return div;
    };

    const browse = async (folderId) => {
        console.log(`Navegando para a pasta: ${folderId}`);
        fileBrowser.innerHTML = '<p>Carregando...</p>';
        updateBreadcrumb();

        try {
            const response = await fetch(`/api/browse/${folderId}`);
            if (!response.ok) {
                throw new Error(`Erro na API: ${response.statusText}`);
            }
            const items = await response.json();
            fileBrowser.innerHTML = '';

            if (items.length === 0) {
                fileBrowser.innerHTML = '<p>Esta pasta está vazia.</p>';
                return;
            }

            items
                .sort((a, b) => { // Ordena: pastas primeiro, depois por nome
                    if (a.mimeType.includes('folder') && !b.mimeType.includes('folder')) return -1;
                    if (!a.mimeType.includes('folder') && b.mimeType.includes('folder')) return 1;
                    return a.name.localeCompare(b.name);
                })
                .forEach(item => {
                    fileBrowser.appendChild(createBrowserItem(item));
                });

        } catch (error) {
            console.error('Erro ao buscar itens:', error);
            fileBrowser.innerHTML = '<p>Não foi possível carregar os itens. Verifique o console.</p>';
        }
    };

    // Event Listeners
    backToBrowserBtn.addEventListener('click', showBrowser);

    // Início da aplicação
    navigationHistory.push({ id: ROOT_FOLDER_ID, name: 'Início' });
    browse(ROOT_FOLDER_ID);
});