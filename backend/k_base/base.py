import json
import os
import chromadb
from chromadb.utils.embedding_functions import ONNXMiniLM_L6_V2

# --- CONFIGURATION DES CHEMINS ABSOLUS ---
# Dossier de la base : C:\Users\DHM\Downloads\PFE\PFE_Code\backend\chroma_db
DB_PATH = r"C:\Users\DHM\Downloads\PFE\PFE_Code\backend\chroma_db"

# Dossier du modèle : Un sous-dossier de chroma_db (C:\Users\DHM\Downloads\PFE\PFE_Code\backend\chroma_db\onnx_model)
MODEL_PATH = os.path.join(DB_PATH, "onnx_model")

# Création des dossiers s'ils n'existent pas
if not os.path.exists(MODEL_PATH):
    os.makedirs(MODEL_PATH)

# 1. Initialisation de la fonction d'embedding ONNX de Chroma
# On force le téléchargement/lecture dans le dossier spécifique
onnx_ef = ONNXMiniLM_L6_V2()
onnx_ef.DOWNLOAD_PATH = MODEL_PATH 

# 2. Configuration du client ChromaDB avec le chemin absolu
client = chromadb.PersistentClient(path=DB_PATH)

collection = client.get_or_create_collection(
    name="sql_schema_kb",
    embedding_function=onnx_ef
)

def create_knowledge_base(json_path):
    # On s'assure de trouver le shema.json qui est dans le même dossier que ce script
    current_dir = os.path.dirname(os.path.abspath(__file__))
    full_json_path = os.path.join(current_dir, json_path)

    if not os.path.exists(full_json_path):
        print(f"❌ Erreur : Le fichier {full_json_path} est introuvable.")
        return

    with open(full_json_path, 'r', encoding='utf-8') as f:
        schema_data = json.load(f)

    for table in schema_data:
        table_name = table['table_name']
        
        column_details = [f"{col['name']}: {col.get('description', '')}" for col in table['columns']]
        rel_details = [f"Jointure: {rel['purpose']} ({rel['technical_details']})" for rel in table.get('relationships', [])]

        content_to_embed = (
            f"Table: {table_name}. "
            f"Description métier: {table['description']}. "
            f"Colonnes: {', '.join(column_details)}. "
            f"Relations: {'; '.join(rel_details)}."
        )

        collection.add(
            documents=[content_to_embed],
            metadatas=[{"table_json": json.dumps(table)}],
            ids=[table_name]
        )
    
    print(f"✅ Knowledge Base créée avec succès !")
    print(f"📍 Base stockée dans : {DB_PATH}")
    print(f"📍 Modèle stocké dans : {MODEL_PATH}")

if __name__ == "__main__":
    create_knowledge_base("shema.json")