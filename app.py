import streamlit as st
import random
import time
import pandas as pd
from datetime import datetime
from supabase import create_client
import streamlit.components.v1 as components
import os

# Supabase setup
SUPABASE_URL = st.secrets["SUPABASE_URL"]
SUPABASE_KEY = st.secrets["SUPABASE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
os.environ['SUPABASE_CLIENT_LOG_LEVEL'] = 'DEBUG'

# ---------------- AUTH ----------------
def login():
    st.title("Connexion")
    username = st.text_input("Nom d'utilisateur").strip().lower()
    password = st.text_input("Mot de passe", type="password")
    if st.button("Se connecter"):
        result = supabase.table("users").select("*").eq("username", username).execute()
        if result.data and result.data[0]["password"] == password:
            st.session_state.user = username
            st.session_state.is_teacher = result.data[0]["is_teacher"]
            st.rerun()
        else:
            st.error("Identifiants incorrects.")

# ---------------- DATA FETCHING ----------------
def fetch_scores(username):
    result = supabase.table("scores").select("*").eq("username", username).order("timestamp", desc=True).execute()
    return result.data if result.data else []

def fetch_errors(username):
    result = supabase.table("errors").select("*").eq("username", username).order("timestamp", desc=True).execute()
    return result.data if result.data else []

# ---------------- STATS DISPLAY ----------------
def display_stats(scores):
    if not scores:
        st.write("Aucune donnée.")
        return
    max_score = max(s["correct"] for s in scores)
    avg_score = sum(s["correct"] for s in scores) / len(scores)
    st.metric("Meilleur score", max_score)
    st.metric("Score moyen", round(avg_score, 1))
    st.metric("Entraînements effectués", len(scores))

def student_details(username):
    st.title(f"📊 Statistiques de {username}")
    scores = fetch_scores(username)
    errors = fetch_errors(username)

    st.subheader("📈 Statistiques")
    display_stats(scores)

    st.subheader("🧾 Historique des entraînements")
    if scores:
        df = pd.DataFrame(scores)[["readable_date", "correct", "total", "tables"]]
        df.columns = ["Date", "Bonnes", "Total", "Tables"]
        df.index += 1
        st.dataframe(df, use_container_width=True)

    st.subheader("❌ Erreurs")
    if errors:
        df = pd.DataFrame(errors)[["readable_date", "question", "user_answer", "correct_answer"]]
        df.columns = ["Date", "Question", "Réponse élève", "Bonne réponse"]
        df.index += 1
        st.dataframe(df, use_container_width=True)

    if st.button("⬅️ Retour"):
        st.session_state.viewing_student = None
        st.rerun()

# ---------------- TEACHER ----------------
def teacher_dashboard():
    st.title("📚 Tableau de bord - Enseignant")
    result = supabase.table("scores").select("*").order("timestamp", desc=True).execute()
    if result.data:
        df = pd.DataFrame(result.data)
        for user in df["username"].unique():
            user_scores = df[df["username"] == user]
            max_score = user_scores["correct"].max()
            avg_score = round(user_scores["correct"].mean(), 1)
            total_attempts = len(user_scores)
            if st.button(f"👤 {user} | 🔢 Max: {max_score} | 📊 Moy: {avg_score} | #️⃣ Essais: {total_attempts}"):
                st.session_state.viewing_student = user
                s
