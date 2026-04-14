import uvicorn
import os
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --- IMPORTS DES ROUTERS ---
from api.generation_endpoint import router as gen_router
from api.execution_endpoint import router as exe_router
# On suppose que tu as enregistré le fichier précédent sous api/report_endpoint.py
from api.partage_endpoint import router as partage_router 
from api.rapport_endpoint import router as report_router

app = FastAPI(
    title="PFE : Multi-Agent Text-to-SQL System",
    version="1.0.0"
)

# --- CONFIGURATION CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- VÉRIFICATION DYNAMIQUE DES CHEMINS ---
@app.on_event("startup")
async def startup_event():
    # Détecte automatiquement le dossier racine du backend
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    # Définit les chemins par rapport à main.py
    DB_PATH = os.path.join(BASE_DIR, "chroma_db")
    MODEL_PATH = os.path.join(DB_PATH, "onnx_model")
    
    print("\n" + "="*50)
    print("🚀 DÉMARRAGE DU SERVEUR PFE")
    print("="*50)
    
    # 1. Test de la base
    if not os.path.exists(DB_PATH):
        print(f"❌ ERREUR : Dossier '{DB_PATH}' introuvable.")
    else:
        print(f"✅ Base de connaissances détectée : {DB_PATH}")
    
    # 2. Test du modèle
    if not os.path.exists(MODEL_PATH):
        print(f"❌ ERREUR : Modèle ONNX introuvable dans : {MODEL_PATH}")
    else:
        print(f"✅ Modèle d'embedding prêt : {MODEL_PATH}")
    
    print(f"✅ Système de partage par Email activé (Gmail)")
    print("="*50 + "\n")

# --- INCLUSION DES ROUTES ---
app.include_router(gen_router)    # Génération SQL
app.include_router(exe_router)    # Exécution SQL
app.include_router(partage_router) # Partage & IA Email (Nouveau)
app.include_router(report_router)
@app.get("/api/health")
def health():
    return {"status": "online", "system": "Ready"}

if __name__ == "__main__":
    # Lancement du serveur
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)