import os
from openai import OpenAI
from typing import List, Dict
from core.interfaces import ILLMClient
from dotenv import load_dotenv

# Charge le fichier .env (recherche récursive vers le haut jusqu'à trouver le fichier)
load_dotenv()

class LLMLocal(ILLMClient):
    """
    Client pour un modèle tournant localement (ex: LM Studio).
    """
    def __init__(self, ip: str = "10.34.162.197", port: str = "1234"):
        self.client = OpenAI(
            base_url=f"http://{ip}:{port}/v1", 
            api_key="lm-studio" # Clé bidon requise par la librairie
        )
        self.model = "local-model"

    def chat(self, messages: List[Dict[str, str]], temperature: float = 0.0) -> str:
        try:
            res = self.client.chat.completions.create(
                model=self.model, 
                messages=messages, 
                temperature=temperature
            )
            return res.choices[0].message.content
        except Exception as e:
            return f"Erreur LLM Local: {str(e)}"

class LLMCloud(ILLMClient):
    """
    Client pour OpenRouter (Gemini, GPT, etc.).
    """
    def __init__(self, model: str = "google/gemini-2.5-flash-lite"):
        api_key = os.getenv("OPENROUTER_API_KEY")
        
        # Sécurité : on vérifie si la clé est bien chargée avant d'instancier
        if not api_key:
            raise ValueError(
                "❌ OPENROUTER_API_KEY non trouvée. "
                "Vérifiez que le fichier .env contient la clé et qu'il est à la racine du projet."
            )

        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key
        )
        self.model = model

    def chat(self, messages: List[Dict[str, str]], temperature: float = 0.0) -> str:
        try:
            res = self.client.chat.completions.create(
                model=self.model, 
                messages=messages, 
                temperature=temperature
            )
            return res.choices[0].message.content
        except Exception as e:
            return f"Erreur LLM Cloud: {str(e)}"