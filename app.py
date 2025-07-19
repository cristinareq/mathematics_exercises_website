import streamlit as st
import random
import time
import pandas as pd
from datetime import datetime
from supabase import create_client
import os

# Supabase setup
SUPABASE_URL = st.secrets["SUPABASE_URL"]
SUPABASE_KEY = st.secrets["SUPABASE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------- HELPERS ----------------
def generate_question(tables):
    a = random.choice(tables)
    b = random.randint(0, 10)
    return a, b

def get_user_stats(username):
    result = supabase.table("scores").select("*").eq("username", username).execute()
    scores = result.data
    if not scores:
        return 0, 0, 0
    total_attempts = len(scores)
    best_score = max(s["correct"] for s in scores)
    avg_score = round(sum(s["correct"] for s in scores) / total_attempts, 2)
    return best_score, avg_score, total_attempts

# ---------------- DISPLAY ----------------
def show_user_scores(username):
    result = supabase.table("scores").select("*").eq("username", username).order("timestamp", desc=True).execute()
    if result.data:
        st.markdown("### Résultats d'entraînement")
        df = pd.DataFrame(result.data)
        df = df[["readable_date", "correct", "total", "tables"]]
        df.columns = ["Date", "Bonnes", "Total", "Tables"]
        df.index += 1
        st.dataframe(df, use_container_width=True)

def show_user_errors(username):
    result = supabase.table("errors").select("*").eq("username", username).order("timestamp", desc=True).execute()
    if result.data:
        st.markdown("### Tes erreurs précédentes")
        df = pd.DataFrame(result.data)
        df = df[["readable_date", "question", "user_answer", "correct_answer"]]
        df.columns = ["Date", "Question", "Réponse élève", "Bonne réponse"]
        df.index += 1
        st.dataframe(df, use_container_width=True)

# ---------------- QUIZ ----------------
def run_quiz(questions, origin="normal"):
    st.session_state.quiz_start_time = time.time()
    st.session_state.correct = 0
    st.session_state.total = 0
    st.session_state.quiz_running = True
    st.session_state.quiz_finished = False
    st.session_state.questions = questions
    st.session_state.current_index = 0
    st.session_state.score_saved = False

    progress = st.progress(0)

    while st.session_state.quiz_running:
        current_index = st.session_state.current_index
        elapsed = int(time.time() - st.session_state.quiz_start_time)
        remaining = max(0, 15 - elapsed)
        progress.progress(min(elapsed / 15, 1.0))

        st.info(f"Temps restant : {remaining} sec")
        st.success(f"Score en direct : {st.session_state.correct}/{st.session_state.total}")

        if remaining <= 0 or current_index >= len(st.session_state.questions):
            st.session_state.quiz_running = False
            st.session_state.quiz_finished = True
            break

        a, b = st.session_state.questions[current_index]

        with st.form(key=f"form_{current_index}_{random.randint(0, 1e9)}"):
            answer = st.text_input(f"Combien fait {a} × {b} ?", key=f"q-{a}-{b}", placeholder="Écris ta réponse ici")
            submitted = st.form_submit_button("Soumettre")

        if submitted:
            try:
                answer_int = int(answer)
                if answer_int == a * b:
                    st.success("Correct !")
                    st.session_state.correct += 1
                else:
                    st.error(f"Faux. La bonne réponse était {a * b}")
                    now = datetime.now()
                    supabase.table("errors").insert({
                        "username": st.session_state.user,
                        "timestamp": now.isoformat(),
                        "readable_date": now.strftime("%d/%m/%Y %H:%M"),
                        "question": f"{a} x {b}",
                        "correct_answer": a * b,
                        "user_answer": answer_int,
                        "table_value": a
                    }).execute()
            except:
                st.warning("Veuillez entrer un nombre valide.")
            st.session_state.total += 1
            st.session_state.current_index += 1
            st.rerun()

    if st.session_state.quiz_finished:
        st.title("Résultats")
        st.success(f"Score final : {st.session_state.correct}/{st.session_state.total}")

        if not st.session_state.score_saved:
            now = datetime.now()
            data = {
                "username": st.session_state.user,
                "timestamp": now.isoformat(),
                "readable_date": now.strftime("%d/%m/%Y %H:%M"),
                "correct": st.session_state.correct,
                "total": st.session_state.total,
                "duration": 15,
                "tables": ",".join(str(t) for t in st.session_state.selected_tables),
                "mode": origin
            }
            supabase.table("scores").insert(data).execute()
            st.session_state.score_saved = True

# ---------------- PAGES ----------------
def student_dashboard():
    st.title("Bienvenue, élève")
    best, avg, count = get_user_stats(st.session_state.user)
    st.markdown(f"**Meilleur score :** {best} | **Moyenne :** {avg} | **Entraînements :** {count}")

    selected_tables = st.multiselect("Choisis les tables à réviser :", list(range(2, 11)), default=[2, 3])
    if selected_tables:
        rows = [[f"{t}×{i}={t*i}" for i in range(1, 11)] for t in selected_tables]
        df = pd.DataFrame(rows, index=[f"Table de {t}" for t in selected_tables]).transpose()
        df.index += 1
        st.dataframe(df)

    if st.button("Commencer l'entraînement"):
        st.session_state.page = "quiz"
        st.session_state.origin = "normal"
        st.session_state.selected_tables = selected_tables
        st.rerun()

    if st.button("Réviser mes erreurs"):
        st.session_state.page = "quiz"
        st.session_state.origin = "errors"
        st.rerun()

    show_user_scores(st.session_state.user)
    show_user_errors(st.session_state.user)

def quiz_page():
    if st.session_state.origin == "normal":
        questions = [generate_question(st.session_state.selected_tables) for _ in range(30)]
        run_quiz(questions, origin="normal")
    else:
        errors = supabase.table("errors").select("*").eq("username", st.session_state.user).execute().data
        if errors:
            questions = [(int(e["question"].split(" x ")[0]), int(e["question"].split(" x ")[1])) for e in errors]
            st.session_state.selected_tables = list(set(q[0] for q in questions))
            run_quiz(questions, origin="errors")
        else:
            st.warning("Aucune erreur enregistrée.")

# ---------------- PROFESSEUR ----------------
def teacher_dashboard():
    st.title("Tableau de bord - Enseignant")
    result = supabase.table("scores").select("*").order("timestamp", desc=True).execute()
    if result.data:
        df = pd.DataFrame(result.data)
        users = df["username"].unique()
        for user in users:
            best, avg, count = get_user_stats(user)
            if st.button(f"👤 {user} | 🎯 Max: {best} | 📊 Moy: {avg} | 🧮 Exos: {count}", key=user):
                st.session_state.selected_student = user
                st.rerun()

    if "selected_student" in st.session_state:
        st.title(f"📈 Statistiques de {st.session_state.selected_student}")
        show_user_scores(st.session_state.selected_student)
        show_user_errors(st.session_state.selected_student)
        if st.button("⬅️ Retour"):
            del st.session_state.selected_student
            st.rerun()

# ---------------- MAIN ----------------
def login():
    st.title("Connexion")
    username = st.text_input("Nom d'utilisateur").strip().lower()
    password = st.text_input("Mot de passe", type="password")
    if st.button("Se connecter"):
        result = supabase.table("users").select("*").eq("username", username).execute()
        if result.data and result.data[0]["password"] == password:
            st.session_state.user = username
            st.session_state.is_teacher = result.data[0]["is_teacher"]
            st.session_state.page = "dashboard"
            st.rerun()
        else:
            st.error("Identifiants incorrects.")

def main():
    if "user" not in st.session_state:
        login()
    else:
        st.sidebar.success(f"Connecté en tant que {st.session_state.user}")
        if st.sidebar.button("Se déconnecter"):
            for key in list(st.session_state.keys()):
                del st.session_state[key]
            st.rerun()

        if st.session_state.get("is_teacher", False):
            teacher_dashboard()
        else:
            if st.session_state.get("page") == "quiz":
                quiz_page()
            else:
                student_dashboard()

if __name__ == "__main__":
    main()
