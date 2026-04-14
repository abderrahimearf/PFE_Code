import os
import pyodbc
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any
from core.interfaces import ISQLClient

class SQLServerClient(ISQLClient):
    def __init__(self):
        server = os.getenv("SQL_SERVER_HOST", "localhost")
        db = os.getenv("SQL_SERVER_DB", "Tier")
        self.conn_str = f"Driver={{SQL Server}};Server={server};Database={db};Trusted_Connection=yes;"

    def execute_query(self, sql: str) -> Dict[str, Any]:
        try:
            with pyodbc.connect(self.conn_str) as conn:
                cursor = conn.cursor()
                cursor.execute(sql)
                if cursor.description:
                    cols = [c[0] for c in cursor.description]
                    rows = [dict(zip(cols, r)) for r in cursor.fetchall()]
                    return {"success": True, "data": rows}
                return {"success": True, "data": "OK"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def validate_sql(self, sql: str) -> Dict[str, Any]:
        try:
            with pyodbc.connect(self.conn_str) as conn:
                cursor = conn.cursor()
                cursor.execute("SET PARSEONLY ON;")
                cursor.execute(sql)
                return {"is_valid": True, "error": None}
        except Exception as e:
            return {"is_valid": False, "error": str(e)}

class PostgreSqlClient(ISQLClient):
    def __init__(self):
        self.conn_params = {
            "host": os.getenv("POSTGRES_HOST", "localhost"),
            "database": os.getenv("POSTGRES_DB", "clm"),
            "user": os.getenv("POSTGRES_USER", "postgres"),
            "password": os.getenv("POSTGRES_PASSWORD", "admin"),
            "port": os.getenv("POSTGRES_PORT", "5432")
        }

    def execute_query(self, sql: str) -> Dict[str, Any]:
        try:
            with psycopg2.connect(**self.conn_params) as conn:
                # RealDictCursor permet de récupérer directement des dictionnaires
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute(sql)
                    if cursor.description:
                        return {"success": True, "data": [dict(r) for r in cursor.fetchall()]}
                    return {"success": True, "data": "OK"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def validate_sql(self, sql: str) -> Dict[str, Any]:
        try:
            with psycopg2.connect(**self.conn_params) as conn:
                with conn.cursor() as cursor:
                    # Sur Postgres, on utilise EXPLAIN pour valider sans exécuter
                    cursor.execute(f"EXPLAIN {sql}")
                    return {"is_valid": True, "error": None}
        except Exception as e:
            return {"is_valid": False, "error": str(e)}