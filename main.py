from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI()
#configuration de CORS  pour autoriser le front-end à communiquer avec FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], #permet toutes les origines(utile en développement)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
import database as db
import schemas

# Configuration Sécurité
SECRET_KEY = "SECRET_KEY_CAMERSANTE_EXPRESS_CHANGE_ME_IN_PRODUCTION"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# Initialisation DB
db.Base.metadata.create_all(bind=db.engine)

app = FastAPI(
    title="CamerSanté Express API",
    description="Backend de géolocalisation des pharmacies de garde et services d'urgence au Cameroun",
    version="1.0.0"
)

# Configuration CORS pour connecter le Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- UTILITAIRES SÉCURITÉ ---
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(db.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Session expirée ou invalide",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = session.query(db.User).filter(db.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# --- ENDPOINTS AUTHENTIFICATION ---
@app.post("/api/auth/signup", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def signup(user_data: schemas.UserCreate, session: Session = Depends(db.get_db)):
    existing_user = session.query(db.User).filter(db.User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Un compte existe déjà avec cet email.")

    new_user = db.User(
        full_name=user_data.full_name,
        email=user_data.email,
        phone=user_data.phone,
        city=user_data.city,
        hashed_password=hash_password(user_data.password)
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    access_token = create_access_token(data={"sub": new_user.email})
    return {"access_token": access_token, "token_type": "bearer", "user": new_user}

@app.post("/api/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(db.get_db)):
    user = session.query(db.User).filter(db.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Email ou mot de passe incorrect.")

    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer", "user": user}

# --- ENDPOINTS PHARMACIES ---
@app.get("/api/pharmacies", response_model=List[schemas.PharmacyOut])
def get_pharmacies(
    ville: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    garde_only: bool = Query(False),
    session: Session = Depends(db.get_db)
):
    query = session.query(db.Pharmacy)

    if ville and ville != "Toutes":
        query = query.filter(db.Pharmacy.ville == ville)

    if garde_only:
        query = query.filter(db.Pharmacy.est_de_garde == True)

    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (db.Pharmacy.nom.ilike(search_fmt)) | (db.Pharmacy.quartier.ilike(search_fmt))
        )

    return query.all()

@app.post("/api/pharmacies", response_model=schemas.PharmacyOut, status_code=201)
def add_pharmacy(
    pharmacy: schemas.PharmacyCreate,
    current_user: db.User = Depends(get_current_user),
    session: Session = Depends(db.get_db)
):
    new_pharmacy = db.Pharmacy(**pharmacy.dict())
    session.add(new_pharmacy)
    session.commit()
    session.refresh(new_pharmacy)
    return new_pharmacy

# --- ENDPOINTS URGENCE ---
@app.get("/api/urgences", response_model=List[schemas.EmergencyOut])
def get_urgences(session: Session = Depends(db.get_db)):
    return session.query(db.EmergencyService).all()