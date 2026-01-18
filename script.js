document.addEventListener('DOMContentLoaded', () => {
    const videoPlayer = document.getElementById('video-player');
    const fileList = document.getElementById('file-list');
    const API_URL = 'http://127.0.0.1:5001/api/videos';

    const playVideo = (videoId) => {
        const embedUrl = `https://drive.google.com/file/d/${videoId}/preview`;
        videoPlayer.src = embedUrl;
        videoPlayer.load();
        videoPlayer.play();
    };

    const addVideoToList = (video) => {
        const listItem = document.createElement('li');
        listItem.textContent = video.name;
        listItem.dataset.videoId = video.id;

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
                throw new Error('Não foi possível conectar ao backend.');
            }
            const videos = await response.json();
            fileList.innerHTML = '';
            videos.forEach(addVideoToList);
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
    fetchVideos();
});