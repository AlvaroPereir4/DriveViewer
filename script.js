document.addEventListener('DOMContentLoaded', () => {
    const videoPlayer = document.getElementById('video-player');
    const fileList = document.getElementById('file-list');
    const API_URL = 'http://127.0.0.1:5001/api/videos'; // URL do nosso backend Python

    const playVideo = (videoId) => {
        // O Google Drive usa um link especial para visualização (embed)
        const embedUrl = `https://drive.google.com/file/d/${videoId}/preview`;
        videoPlayer.src = embedUrl;
        videoPlayer.load(); // Carrega o novo vídeo
        videoPlayer.play(); // Tenta tocar o vídeo automaticamente
    };

    const addVideoToList = (video) => {
        const listItem = document.createElement('li');
        listItem.textContent = video.name;
        listItem.dataset.videoId = video.id; // Armazena o ID do vídeo do Drive

        listItem.addEventListener('click', () => {
            // Remove a classe 'active' de outros itens
            document.querySelectorAll('#file-list li').forEach(item => {
                item.classList.remove('active');
            });
            // Adiciona a classe 'active' ao item clicado
            listItem.classList.add('active');

            // Toca o vídeo correspondente
            playVideo(video.id);
        });

        fileList.appendChild(listItem);
    };

    const fetchVideos = async () => {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) {
                throw new Error('Não foi possível conectar ao backend.');
            }
            const videos = await response.json();

            // Limpa a lista de exemplo
            fileList.innerHTML = '';

            // Adiciona os vídeos recebidos do backend
            videos.forEach(addVideoToList);

            // Se houver vídeos, seleciona e toca o primeiro
            if (videos.length > 0) {
                const firstItem = fileList.firstChild;
                firstItem.classList.add('active');
                playVideo(videos[0].id);
            }

        } catch (error) {
            console.error('Erro ao buscar vídeos:', error);
            fileList.innerHTML = '<li>Erro ao carregar vídeos. Verifique se o backend está rodando.</li>';
        }
    };

    // Inicia a busca pelos vídeos assim que a página carrega
    fetchVideos();
});