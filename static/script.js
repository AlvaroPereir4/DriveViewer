document.addEventListener('DOMContentLoaded', () => {
    const videoPlayer = document.getElementById('video-player');
    const fileList = document.getElementById('file-list');
    // A API agora está na mesma origem, então podemos usar um caminho relativo.
    const API_URL = '/api/videos';

    const playVideo = (videoId) => {
        // O Google Drive usa um link especial para visualização (embed)
        const embedUrl = `https://drive.google.com/file/d/${videoId}/preview`;
        videoPlayer.src = embedUrl;
        videoPlayer.load(); // Carrega o novo vídeo
        videoPlayer.play().catch(error => {
            // A reprodução automática pode ser bloqueada pelo navegador.
            console.log("A reprodução automática foi impedida. O usuário precisa interagir com a página primeiro.", error);
        });
    };

    const addVideoToList = (video) => {
        const listItem = document.createElement('li');
        listItem.textContent = video.name;
        listItem.dataset.videoId = video.id; // Armazena o ID do vídeo do Drive

        listItem.addEventListener('click', () => {
            document.querySelectorAll('#file-list li').forEach(item => {
                item.classList.remove('active');
            });
            listItem.classList.add('active');
            playVideo(video.id);
        });

        fileList.appendChild(listItem);
    };

    const fetchVideos = async () => {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) {
                throw new Error(`Erro na rede: ${response.statusText}`);
            }
            const videos = await response.json();

            fileList.innerHTML = ''; // Limpa a lista

            if (videos.length === 0) {
                fileList.innerHTML = '<li>Nenhum vídeo encontrado.</li>';
                return;
            }

            videos.forEach(addVideoToList);

            // Seleciona e tenta tocar o primeiro vídeo
            if (fileList.firstChild) {
                const firstItem = fileList.firstChild;
                firstItem.classList.add('active');
                playVideo(videos[0].id);
            }

        } catch (error) {
            console.error('Erro ao buscar vídeos:', error);
            fileList.innerHTML = '<li>Erro ao carregar vídeos. Verifique o console do backend.</li>';
        }
    };

    fetchVideos();
});