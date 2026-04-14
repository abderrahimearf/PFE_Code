import smtplib
import csv
import io
import json
import re
from email.message import EmailMessage
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

# Imports de tes composants personnalisés
from adapters.llm_client import LLMLocal
from adapters.db_client import PostgreSqlClient 

router = APIRouter(prefix="/api/reports", tags=["Reports & AI Sharing"])

# --- CONFIGURATION GMAIL ---
EMAIL_SENDER = "sqlqueryclm@gmail.com"
EMAIL_PASSWORD = "ztln xamg fypp mdjd"

# --- SCHÉMAS DE DONNÉES ---
class QueryItem(BaseModel):
    id: Optional[str] = None
    question: str
    sql: str

class EmailGenerateRequest(BaseModel):
    items: List[QueryItem]

class SendReportRequest(BaseModel):
    to: List[str]
    subject: str
    content: str
    include_csv: bool
    queries: List[QueryItem]

# ============================================================
# 1. GÉNÉRATION DE L'OBJET ET DU MESSAGE PAR IA
# ============================================================
@router.post("/generate-email")
async def generate_ai_email(request: EmailGenerateRequest):
    try:
        llm = LLMLocal() 
        # Préparation du résumé pour l'IA
        questions_summary = "\n".join([f"- {item.question}" for item in request.items])

        prompt = (
            f"Analyse les requêtes suivantes et génère un objet de mail pro ainsi qu'un corps de mail court "
            f"présentant les analyses à l'équipe :\n{questions_summary}\n\n"
            "Réponds STRICTEMENT en JSON sous ce format: {\"subject\": \"...\", \"text\": \"...\"}"
        )

        ai_raw = llm.chat([{"role": "user", "content": prompt}])
        
        # Extraction du JSON dans la réponse de l'IA (sécurité si l'IA ajoute du texte autour)
        clean_json = re.search(r'\{.*\}', ai_raw, re.DOTALL).group()
        data = json.loads(clean_json)
        
        return {
            "success": True, 
            "text": data.get("text"), 
            "subject": data.get("subject")
        }
    except Exception as e:
        # Fallback en cas d'erreur de l'IA
        return {
            "success": False, 
            "text": "Bonjour, veuillez trouver ci-joint les analyses SQL demandées.", 
            "subject": "Rapport d'analyses SQL"
        }

# ============================================================
# 2. ENVOI DE L'EMAIL (TXT UNIQUE + CSV SÉPARÉS)
# ============================================================
@router.post("/send")
async def send_final_report(request: SendReportRequest):
    try:
        msg = EmailMessage()
        msg['Subject'] = request.subject
        msg['From'] = EMAIL_SENDER
        msg['To'] = ", ".join(request.to)
        msg.set_content(request.content)

        # --- ÉTAPE A : CRÉATION DU FICHIER TXT UNIQUE ---
        # On regroupe toutes les questions et leurs codes SQL dans un seul bloc
        report_text = "RÉCAPITULATIF DES REQUÊTES SQL\n"
        report_text += "="*40 + "\n\n"
        
        for idx, item in enumerate(request.queries, 1):
            report_text += f"ANALYSE N°{idx}\n"
            report_text += f"OBJECTIF : {item.question}\n"
            report_text += f"CODE SQL :\n{item.sql}\n"
            report_text += "-"*30 + "\n\n"
        
        # Ajout du fichier TXT en pièce jointe
        msg.add_attachment(
            report_text.encode('utf-8'), 
            maintype='text', 
            subtype='plain', 
            filename='requetes.txt'
        )

        # --- ÉTAPE B : EXÉCUTION SQL ET GÉNÉRATION DES CSV ---
        if request.include_csv:
            db = PostgreSqlClient()
            
            for idx, item in enumerate(request.queries, 1):
                try:
                    # Exécution de la requête en base de données
                    result = db.execute_query(item.sql)
                    data_list = result.get("data", [])

                    if result.get("success") and isinstance(data_list, list) and len(data_list) > 0:
                        # Création du flux CSV en mémoire
                        output = io.StringIO()
                        headers = data_list[0].keys()
                        writer = csv.DictWriter(output, fieldnames=headers)
                        writer.writeheader()
                        writer.writerows(data_list)
                        
                        # Attachement du CSV spécifique à cette requête
                        # 'utf-8-sig' permet à Excel d'afficher correctement les accents (FR/AR)
                        msg.add_attachment(
                            output.getvalue().encode('utf-8-sig'),
                            maintype='text', 
                            subtype='csv',
                            filename=f"resultats_analyse_{idx}.csv"
                        )
                except Exception as csv_err:
                    print(f"Erreur sur le CSV {idx}: {str(csv_err)}")

        # --- ÉTAPE C : ENVOI VIA GMAIL ---
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(EMAIL_SENDER, EMAIL_PASSWORD)
            smtp.send_message(msg)
        
        return {"success": True, "message": "Email envoyé avec succès."}

    except Exception as e:
        print(f"ERREUR ENVOI: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'envoi : {str(e)}")
    













                                                                                                                                                       