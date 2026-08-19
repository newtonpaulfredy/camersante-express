import os
import psycopg2
from dotenv import load_dotenv
from flask import Flask, jsonify

# Charger les variables du fichier .env
load_dotenv()

app = Flask(__name__)


# Fonction pour établir la connexion à PostgreSQL
def get_db_connection():
    conn = psycopg2.connect(
    host=os.getenv("DB_HOST"),
    database=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    port=os.getenv("DB_PORT"),
)
    return conn


# Route de test
@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Bienvenue sur l'API CamerSanté Express !"})


# Route pour tester la connexion à PostgreSQL
@app.route("/test-db", methods=["GET"])
def test_db():
    try:
        conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT version();")
    db_version = cur.fetchone()
    cur.close()
    conn.close()
    return jsonify(
        {
            "status": "Succès",
            "message": "Connexion réussie à PostgreSQL !",
            "version": db_version[0],
        }
    )
    except Exception as e:
    return jsonify({"status": "Erreur", "details": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)