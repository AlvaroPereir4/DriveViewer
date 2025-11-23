document.addEventListener('DOMContentLoaded', () => {
    const browserView = document.getElementById('browser-view');
    const videoView = document.getElementById('video-view');
    const playerContainer = document.getElementById('player-container');
    const fileBrowser = document.getElementById('file-browser');
    const breadcrumb = document.getElementById('breadcrumb');
    const backToBrowserBtn = document.getElementById('back-to-browser-btn');

    const navigationHistory = [];

    const showBrowser = () => {
        videoView.classList.add('hidden');
        browserView.classList.remove('hidden');
        // Limpa o iframe para parar o vídeo
        playerContainer.innerHTML = '';
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
        
        // Limpa qualquer player antigo
        playerContainer.innerHTML = '';

        // Cria um novo iframe
        const iframe = document.createElement('iframe');
        
        // Usa a URL de "embed" do Google Drive, que é feita para iframes
        const embedUrl = `https://drive.google.com/file/d/${videoId}/preview`;
        
        iframe.src = embedUrl;
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('allow', 'autoplay'); // Tenta permitir autoplay
        
        playerContainer.appendChild(iframe);
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
        } else if (item.mimeType.startsWith('video/')) { // Verifica se é um tipo de vídeo
            icon.classList.add('fa-file-video');
            div.addEventListener('click', () => playVideo(item.id));
        } else {
            // Para outros tipos de arquivo, podemos usar um ícone genérico e não fazer nada ao clicar
            icon.classList.add('fa-file');
            div.style.cursor = 'default'; 
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
                .sort((a, b) => {
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

    backToBrowserBtn.addEventListener('click', showBrowser);

    navigationHistory.push({ id: ROOT_FOLDER_ID, name: 'Início' });
    browse(ROOT_FOLDER_ID);
});