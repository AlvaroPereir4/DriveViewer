from flask import Flask, jsonify, render_template, send_from_directory
import os

# --- INFORMAÇÕES IMPORTANTES ---
# (As mesmas de antes)

app = Flask(__name__, template_folder='templates', static_folder='static')

DRIVE_FOLDER_ID = 'COLOQUE_O_ID_DA_SUA_PASTA_DO_DRIVE_AQUI'

def get_videos_from_drive():
    """
    Esta função irá se conectar à API do Google Drive e buscar os vídeos.
    Por enquanto, ela retorna dados de exemplo.
    """
    example_videos = [
        {'id': '1_DRIVE_FILE_ID_1', 'name': 'Meu Vídeo de Férias.mp4'},
        {'id': '1_DRIVE_FILE_ID_2', 'name': 'Aniversário.mov'},
        {'id': '1_DRIVE_FILE_ID_3', 'name': 'Projeto Final.webm'},
    ]
    return example_videos

@app.route('/')
def index():
    """
    Serve a página principal da aplicação.
    """
    return render_template('index.html')

@app.route('/api/videos')
def list_videos():
    """
    Endpoint da API que o nosso frontend (JavaScript) vai chamar.
    """
    videos = get_videos_from_drive()
    return jsonify(videos)

if __name__ == '__main__':
    # Rodar o servidor Flask em modo de desenvolvimento.
    app.run(debug=True, port=5001)