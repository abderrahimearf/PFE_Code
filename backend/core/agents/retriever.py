import json
import chromadb
from chromadb.utils.embedding_functions import ONNXMiniLM_L6_V2
from core.models import AgentState

class RetrieverAgent:
    def __init__(self, db_path: str, model_path: str):
        self.onnx_ef = ONNXMiniLM_L6_V2()
        self.onnx_ef.DOWNLOAD_PATH = model_path
        self.client = chromadb.PersistentClient(path=db_path)
        self.collection = self.client.get_collection(
            name="sql_schema_kb", 
            embedding_function=self.onnx_ef
        )

    def __call__(self, state: AgentState) -> dict:
        print(f"--- RETRIEVER: Recherche dynamique du contexte ---")
        
        # On augmente n_results à 5 pour couvrir les jointures complexes
        # ChromaDB retourne aussi les 'distances' (plus c'est petit, plus c'est pertinent)
        results = self.collection.query(
            query_texts=[state["question"]],
            n_results=4,
            include=["metadatas", "distances"]
        )
        
        relevant_schemas = []
        # On définit un seuil de distance (à ajuster selon tes tests, ex: 1.2 ou 1.5)
        # Cela permet de prendre 1 table si c'est simple, ou 4 si la question est large
        threshold = 1.4 
        
        for i, dist in enumerate(results['distances'][0]):
            if dist < threshold:
                relevant_schemas.append(json.loads(results['metadatas'][0][i]['table_json']))

        # Si aucune table ne passe le seuil, on prend au moins la plus proche
        if not relevant_schemas:
            relevant_schemas.append(json.loads(results['metadatas'][0][0]['table_json']))

        # Construction du contexte enrichi
        context_str = "SCHÉMAS SQL RÉCUPÉRÉS :\n"
        for schema in relevant_schemas:
            context_str += f"\n--- TABLE: {schema['table_name']} ---\n"
            context_str += f"Description: {schema['description']}\n"
            context_str += f"Colonnes clés & Mappings:\n"
            # On ne donne que les colonnes avec description (mappings) pour ne pas saturer le prompt
            for col in schema['columns']:
                if "Mapping" in col.get('description', '') or "Valeurs" in col.get('description', ''):
                    context_str += f"  - {col['name']}: {col['description']}\n"
            
            context_str += f"DDL complet: {schema['ddl']}\n"

        return {
            "schema_context": context_str,
            "status_update": f"{len(relevant_schemas)} tables trouvées pour répondre à la question."
        }