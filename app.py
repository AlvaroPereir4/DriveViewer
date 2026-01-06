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

def get_home_items():
    home_items = []
    try:
        # Tenta ler arquivo local, senão lê da variável de ambiente
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
        else:
            # Lê do Vercel Environment Variable
            data = json.loads(os.environ.get('links', '{}'))

        # Suporte para JSON como lista direta ou dicionário
        if isinstance(data, list):
            iterator = [('all', data)]
        else:
            iterator = data.items()

        for category, item_list in iterator:
            for item in item_list:
                link = item.get('link')
                drive_id = extract_id_from_link(link)
                title = item.get('title') or item.get('tittle') or 'Título Desconhecido'
                
                if drive_id:
                    # Detecta se é pasta ou vídeo baseado no link
                    is_folder = 'folders/' in link if link else False
                    home_items.append({
                        "id": drive_id,
                        "title": title,
                        "synopsis": item.get('sinopse', 'Sem sinopse disponível.'),
                        "type": "folder" if is_folder else "video",
                        "tag": item.get('tag', 'outros')
                    })
                else:
                    print(f"AVISO: Não foi possível extrair um ID de Drive válido do link para '{title}'. Link: {link}")

    except FileNotFoundError:
        print(f"ERRO: Arquivo de dados '{DATA_FILE}' não encontrado.")
    except json.JSONDecodeError:
        print(f"ERRO: O arquivo '{DATA_FILE}' não é um JSON válido.")
    
    return home_items

def get_drive_items(service, folder_id):
    if not service: return []
    try:
        query = f"'{folder_id}' in parents and trashed=false"
        fields = "files(id, name, mimeType)"
        results = service.files().list(q=query, pageSize=200, fields=fields, supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
        return results.get('files', [])
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
            # Procura pelo padrão ## [X.X.X]
            match = re.search(r'## \[(\d+\.\d+\.\d+)\]', content)
            if match:
                return match.group(1)
    except Exception:
        pass
    return '0.0.1' # Fallback

@app.context_processor
def inject_globals():
    return dict(version=get_app_version(), github_url="https://github.com/AlvaroPereir4/DriveViewer")

# --- Endpoints da API e Rotas ---

DRIVE_SERVICE = get_drive_service()

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        # Busca usuário no Banco de Dados
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password_hash, password):
            session.permanent = True  # Ativa a expiração definida em permanent_session_lifetime
            session['user'] = user.username
            return redirect(url_for('index'))
        else:
            flash('Usuário ou senha inválidos', 'error')
            
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        # --- Proteção contra Spam (Rate Limiting) ---
        # No Vercel, o IP real vem no header X-Forwarded-For
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        if client_ip and ',' in client_ip:
            client_ip = client_ip.split(',')[0].strip()

        # Verifica se esse IP criou conta nas últimas 24 horas
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

        # Verifica se usuário já existe
        if User.query.filter_by(username=username).first():
            flash('Nome de usuário já existe.', 'error')
            return render_template('register.html')

        # Cria novo usuário
        hashed_password = generate_password_hash(password)
        new_user = User(username=username, password_hash=hashed_password)
        
        try:
            db.session.add(new_user)
            
            # Registra o IP e a hora da criação
            db.session.add(RegistrationLog(ip_address=client_ip))
            
            db.session.commit()
            flash('Conta criada com sucesso! Faça login.', 'success') # Você pode criar um estilo .alert-success no CSS
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
        db.create_all() # Cria as tabelas no banco local (sqlite) se não existirem
    app.run(debug=True, port=5001)