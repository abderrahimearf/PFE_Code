import json
import asyncio
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from core.workflow import create_workflow
from adapters.llm_client import LLMLocal
from adapters.llm_client import LLMCloud

router = APIRouter(prefix="/api/query", tags=["Generation"])

# Instanciation unique du client pour réutiliser la session
llm_client = LLMCloud()

class QueryRequest(BaseModel):
    question: str
    thread_id: str = "session_1"

@router.post("/generate")
async def generate_sql(request: QueryRequest):
    # --- SYNCHRONISATION DES CHEMINS ---
    # On récupère le dossier racine du projet (backend/)
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DB_PATH = os.path.join(BASE_DIR, "chroma_db")
    MODEL_PATH = os.path.join(DB_PATH, "onnx_model")

    # Initialisation du workflow avec les chemins validés
    workflow = create_workflow(
        llm_client, 
        db_path=DB_PATH, 
        model_path=MODEL_PATH
    )

    async def event_generator():
        initial_state = {
            "question": request.question,
            "messages": [],
            "plan": [],
            "schema_context": "",
            "generated_sql": "",
            "status_update": " Initialisation de l'agent orchestrateur...",
            "next_step": "planner",
            "errors": []
        }

        try:
            # Streaming des événements du graphe
            async for event in workflow.astream(initial_state):
                for node_name, output in event.items():
                    # Extraction des données de l'agent courant
                    data = {
                        "agent": node_name,
                        "status": output.get("status_update", "Traitement en cours..."),
                        "sql": output.get("generated_sql") if node_name == "generator" else None
                    }
                    
                    # Envoi au format SSE (indispensable pour le reader.read() du Front)
                    yield f"data: {json.dumps(data)}\n\n"
                    
                    # Pause pour fluidifier l'affichage UI
                    await asyncio.sleep(0.4)
                    
        except Exception as e:
            # En cas d'erreur, on envoie le détail au front pour le debug
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")