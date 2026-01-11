import os
import re
import json
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, jsonify, render_template, request, session, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from werkzeug.security import check_password_hash, generate_password_hash
from dotenv import load_dotenv

load_dotenv()  # Carrega variáveis do arquivo .env localmente

SERVICE_ACCOUNT_FILE = 'api_key.json'
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
DATA_FILE = os.path.join('data', 'links.json')

app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = os.environ.get('SECRET_KEY', 'chave_nova_para_forcar_logout_v2') # Alterado para invalidar sessões anteriores
app.permanent_session_lifetime = timedelta(hours=2) # Define a duração da sessão para 2 horas

# --- Configuração do Banco de Dados ---
# Usa SQLite localmente se DATABASE_URL não estiver definido, ou PostgreSQL no Vercel
db_url = os.environ.get('DATABASE_URL', 'sqlite:///users.db')
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1) # Correção para SQLAlchemy

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Modelo de Usuário
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)

# Modelo de Log de Registro (Rate Limiting)
class RegistrationLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ip_address = db.Column(db.String(50), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# Modelo de Mídia (Filmes e Séries Enriquecidos)
class Media(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    drive_id = db.Column(db.String(100), unique=True, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    original_title = db.Column(db.String(200))
    overview = db.Column(db.Text) # Sinopse
    poster_path = db.Column(db.String(200)) # URL da capa
    backdrop_path = db.Column(db.String(200)) # URL do fundo
    release_date = db.Column(db.String(20)) # Ano/Data
    vote_average = db.Column(db.Float) # Nota
    media_type = db.Column(db.String(20)) # 'movie' ou 'tv'
    genres = db.Column(db.String(200)) # Gêneros separados por vírgula

def get_drive_service():
    try:
        # Tenta ler do arquivo local primeiro, se não existir, tenta da variável de ambiente
        if os.path.exists(SERVICE_ACCOUNT_FILE):
            print(f"DEBUG: Usando arquivo local em: {os.path.abspath(SERVICE_ACCOUNT_FILE)}")
            creds = service_account.Credentials.from_service_account_file(
                SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        else:
            # Lê do Vercel Environment Variable
            env_creds = os.environ.get('api_key')
            if env_creds:
                creds_json = json.loads(env_creds)
                creds = service_account.Credentials.from_service_account_info(
                    creds_json, scopes=SCOPES)
                print("DEBUG: Usando Variáveis de Ambiente (Vercel/Sistema)")
            else:
                print("ERRO CRÍTICO: Arquivo 'api_key.json' não encontrado e variável de ambiente não definida.")
                return None

        service = build('drive', 'v3', credentials=creds)
        print("Serviço do Google Drive conectado com sucesso.")
        return service
    except Exception as e:
        print(f"ERRO ao conectar com o Google Drive: {e}")
    return None

def extract_id_from_link(link):
    if not link: return None
    match = re.search(r'(?:folders/|file/d/|id=)([a-zA-Z0-9_-]{28,})', link)
    if match:
        return match.group(1)
    return None

# Função antiga de ler JSON (Mantida como fallback ou para migração, mas a API vai usar o DB)
def get_home_items():
    # Busca itens do Banco de Dados
    medias = Media.query.all()
    home_items = [
        {
            "id": m.drive_id,
            "title": m.title,
            "synopsis": m.overview,
            "type": "folder" if m.media_type == 'tv' else "video", # Assumindo que séries são pastas
            "tag": 'series' if m.media_type == 'tv' else 'movie',
            "poster": f"https://image.tmdb.org/t/p/w500{m.poster_path}" if m.poster_path else None,
            "backdrop": f"https://image.tmdb.org/t/p/original{m.backdrop_path}" if m.backdrop_path else None,
            "rating": m.vote_average,
            "year": m.release_date[:4] if m.release_date else ""
        } for m in medias
    ]
    return home_items

def get_drive_items(service, folder_id):
    if not service: return []
    try:
        query = f"'{folder_id}' in parents and trashed=false"
        fields = "files(id, name, mimeType, shortcutDetails)"
        results = service.files().list(q=query, pageSize=200, fields=fields, supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
        files = results.get('files', [])
        for item in files:
            mime_type = item.get('mimeType')

            # Se for atalho, resolve o ID e o MIME do alvo
            if mime_type == 'application/vnd.google-apps.shortcut':
                details = item.get('shortcutDetails', {})
                target_id = details.get('targetId')
                target_mime = details.get('targetMimeType')
                
                if target_id:
                    item['id'] = target_id
                
                if target_mime:
                    mime_type = target_mime
                    item['mimeType'] = target_mime  # Atualiza o mimeType real para o frontend não se confundir

            # Classificação: Se for vídeo, marca como vídeo. Todo o resto vira pasta.
            if mime_type and mime_type.startswith('video/'):
                item['type'] = 'video'
            else:
                item['type'] = 'folder'
            
        return files
    except HttpError as error:
        print(f"Ocorreu um erro ao buscar itens do Drive: {error}")
        return []

# --- Decorator de Login ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# --- Utilitários de Template ---
def get_app_version():
    """Lê a versão atual do arquivo CHANGELOG.md"""
    try:
        with open('CHANGELOG.md', 'r', encoding='utf-8') as f:
            content = f.read()
            match = re.search(r'## \[(\d+\.\d+\.\d+)\]', content)
            if match:
                return match.group(1)
    except Exception:
        pass
    return '0.0.1'

@app.context_processor
def inject_globals():
    return dict(version=get_app_version(), github_url="https://github.com/AlvaroPereir4/DriveViewer")

DRIVE_SERVICE = get_drive_service()

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password_hash, password):
            session.permanent = True
            session['user'] = user.username
            return redirect(url_for('index'))
        else:
            flash('Usuário ou senha inválidos', 'error')
            
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        if client_ip and ',' in client_ip:
            client_ip = client_ip.split(',')[0].strip()

        last_reg = RegistrationLog.query.filter_by(ip_address=client_ip).order_by(RegistrationLog.timestamp.desc()).first()
        
        if last_reg and (datetime.utcnow() - last_reg.timestamp) < timedelta(hours=24):
            flash('Limite de criação de contas atingido. Tente novamente em 24 horas.', 'error')
            return render_template('register.html')

        username = request.form.get('username')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')

        if password != confirm_password:
            flash('As senhas não coincidem.', 'error')
            return render_template('register.html')

        if User.query.filter_by(username=username).first():
            flash('Nome de usuário já existe.', 'error')
            return render_template('register.html')

        hashed_password = generate_password_hash(password)
        new_user = User(username=username, password_hash=hashed_password)
        
        try:
            db.session.add(new_user)
            db.session.add(RegistrationLog(ip_address=client_ip))
            db.session.commit()
            flash('Conta criada com sucesso! Faça login.', 'success')
            return redirect(url_for('login'))
        except Exception as e:
            flash('Erro ao criar conta. Tente novamente.', 'error')
            print(e)

    return render_template('register.html')

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    return render_template('index.html')

@app.route('/api/home')
@login_required
def home_content():
    items = get_home_items()
    return jsonify(items)

@app.route('/api/browse/<path:folder_id>')
@login_required
def browse_folder(folder_id):
    if not DRIVE_SERVICE:
        return jsonify({"error": "Serviço do Drive não está disponível."}), 500
    items = get_drive_items(DRIVE_SERVICE, folder_id)
    return jsonify(items)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5001)