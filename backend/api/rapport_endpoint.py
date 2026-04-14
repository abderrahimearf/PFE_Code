import json
import re
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

# Tes imports de composants
from adapters.llm_client import LLMCloud 
from adapters.db_client import PostgreSqlClient 

router = APIRouter(prefix="/api/report", tags=["PDF Report Analysis"])

# --- MODÈLES DE DONNÉES ---
class AnalysisRequest(BaseModel):
    question: str
    sql: str

# ============================================================
# ENDPOINT : ANALYSE DES DONNÉES POUR LE RAPPORT
# ============================================================
@router.post("/analyze")
async def analyze_for_report(request: AnalysisRequest):
    """
    Prend une question et du SQL, exécute la requête sur Postgres,
    et utilise Gemini (via LLMCloud) pour rédiger l'analyse du rapport.
    """
    try:
        db = PostgreSqlClient()
        llm = LLMCloud()

        # 1. Extraction des données réelles depuis la base de données
        result = db.execute_query(request.sql)
        
        if not result.get("success"):
            return {
                "success": False,
                "analysis": f"Erreur lors de l'exécution SQL : {result.get('error')}"
            }
        
        data = result.get("data", [])

        # 2. Préparation du prompt pour l'IA
        # On fournit les 15 premières lignes pour donner du contexte à l'IA
        sample_data = json.dumps(data[:15], indent=2)
        
        prompt = (
            f"Tu es un expert analyste de données .\n"
            f"Analyse les résultats suivants pour le rapport décisionnel.\n\n"
            f"Question : {request.question}\n"
            f"Données (échantillon) : {sample_data}\n\n"
            "Consignes :\n"
            "- Rédige une analyse professionnelle de 3 à 5 lignes.\n"
            "- Identifie les tendances ou les points d'attention majeurs.\n"
            "- Ne parle jamais de 'SQL', de 'colonnes' ou de 'base de données'.\n"
            "- Utilise un ton formel et décisionnel."
        )

        # 3. Appel au LLM Cloud (Gemini)
        analysis_text = llm.chat([{"role": "user", "content": prompt}])

        return {
            "success": True,
            "analysis": analysis_text,
            "data_count": len(data)
        }

    except Exception as e:
        print(f"🚨 Erreur lors de la génération de l'analyse : {str(e)}")
        return {
            "success": False,
            "analysis": "Impossible de générer l'analyse automatique pour le moment.",
            "error": str(e)
        }