from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from adapters.db_client import PostgreSqlClient

router = APIRouter(prefix="/api/database", tags=["Execution"])

class SQLRequest(BaseModel):
    sql: str

@router.post("/execute")
async def execute_sql(request: SQLRequest):
    try:
        # SQLServerClient doit implémenter la logique de connexion à ta DB
        db = PostgreSqlClient()
        result = db.execute_query(request.sql)
        
        if not result.get("success"):
            # Si le SQL est syntaxiquement faux ou table manquante
            return {
                "success": False, 
                "error": result.get("error"),
                "details": "L'exécution SQL a échoué. Vérifiez la syntaxe générée."
            }
        
        # Succès : on renvoie les lignes de données pour ton tableau au front
        return {
            "success": True, 
            "data": result.get("data"),
            "row_count": len(result.get("data", []))
        }
        
    except Exception as e:
        return {"success": False, "error": f"Erreur serveur : {str(e)}"}