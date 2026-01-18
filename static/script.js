const appContainer = document.getElementById('app-container');
const breadcrumbsContainer = document.getElementById('breadcrumbs');
const modal = document.getElementById('video-modal');
const videoFrame = document.getElementById('video-frame');
const modalTitle = document.getElementById('modal-title');
const modalSynopsis = document.getElementById('modal-synopsis');
const searchInput = document.getElementById('search-input');
const itemsCountLabel = document.getElementById('items-count');
const searchContainer = document.querySelector('.search-container');

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
        openVideo(item.id, item.title, item.synopsis);
    }
}

function openVideo(fileId, title, synopsis) {
    const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    videoFrame.src = embedUrl;
    modalTitle.innerText = title;
    modalSynopsis.innerText = synopsis || '';
    modal.classList.remove('hidden');
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