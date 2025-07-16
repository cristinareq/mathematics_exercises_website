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

# ---------------- QUIZ ----------------
def generate_question(tables):
    a = random.choice(tables)
    b = random.randint(0, 10)
    return (a, b)

def show_past_errors(username):
    result = supabase.table("errors").select("*").eq("username", username).order("timestamp", desc=True).execute()
    if result.data:
        st.markdown("### Tes erreurs précédentes")
        df = pd.DataFrame(result.data)
        df = df[["readable_date", "question", "user_answer", "correct_answer"]]
        df.columns = ["Date", "Question", "Ta réponse", "Bonne réponse"]
        df.index += 1
        st.dataframe(df, use_container_width=True)

def multiplication_quiz():
    st.title("Entraînement : Tables de multiplication")
    selected_tables = st.multiselect("Choisis les tables à réviser :", list(range(2, 11)), default=[2, 3])

    if "quiz_running" not in st.session_state:
        st.session_state.quiz_running = False
    if "quiz_finished" not in st.session_state:
        st.session_state.quiz_finished = False

    if not st.session_state.quiz_running and not st.session_state.quiz_finished:
        if selected_tables:
            st.markdown("### Tables sélectionnées :")
            rows = []
            for t in selected_tables:
                row = [f"{t}×{i}={t*i}" for i in range(1, 11)]
                rows.append(row)
            df = pd.DataFrame(rows, index=[f"Table de {t}" for t in selected_tables]).transpose()
            df.index += 1
            st.dataframe(df)

        with st.expander("Voir l'historique de tes entraînements"):
            show_user_scores(st.session_state.user)

        with st.expander("Revoir mes erreurs"):
            show_past_errors(st.session_state.user)

    if st.button("Commencer l'entraînement"):
        st.session_state.start_time = time.time()
        st.session_state.correct = 0
        st.session_state.total = 0
        st.session_state.quiz_running = True
        st.session_state.quiz_finished = False
        st.session_state.current_q = generate_question(selected_tables)
        st.session_state.score_saved = False
        st.session_state.selected_tables = selected_tables
        st.rerun()

    if st.session_state.quiz_running:
        elapsed = int(time.time() - st.session_state.start_time)
        remaining = max(0, 15 - elapsed)

        st.info(f"Temps restant : {remaining} sec")
        st.success(f"Score en direct : {st.session_state.correct}/{st.session_state.total}")

        if remaining <= 0:
            st.session_state.quiz_running = False
            st.session_state.quiz_finished = True
            st.rerun()
            return

        a, b = st.session_state.current_q
        with st.form(key="answer_form"):
            answer = st.text_input(
                f"Combien fait {a} × {b} ?",
                value="",
                key=f"q-{a}-{b}-{st.session_state.total}",
                placeholder="Écris ta réponse ici et appuie sur Entrée"
            )
            submit = st.form_submit_button("Soumettre")

        components.html("""
        <script>
          window.addEventListener('load', function() {
            setTimeout(function() {
              const iframe = window.parent.document.querySelector('iframe');
              if (iframe) {
                const input = iframe.contentDocument.querySelector('input[data-testid=\"stTextInput\"]');
                if (input) input.focus();
              }
            }, 200);
          });
        </script>
        """, height=0)

        if submit:
            try:
                answer_int = int(answer)
                if answer_int == a * b:
                    st.success("Correct !")
                    st.session_state.correct += 1
                else:
                    st.error(f"Faux. La bonne réponse était {a*b}")
                    now = datetime.now()
                    error_data = {
                        "username": st.session_state.user,
                        "timestamp": now.isoformat(),
                        "readable_date": now.strftime("%d/%m/%Y %H:%M"),
                        "question": f"{a} x {b}",
                        "correct_answer": a * b,
                        "user_answer": answer_int,
                        "table_value": a
                    }
                    supabase.table("errors").insert(error_data).execute()
            except:
                st.warning("Veuillez entrer un nombre valide.")
            st.session_state.total += 1
            st.session_state.current_q = generate_question(st.session_state.selected_tables)
            st.rerun()

        time.sleep(1)
        st.rerun()

    elif st.session_state.quiz_finished:
        st.title("Résultats")
        st.success(f"Score final : {st.session_state.correct}/{st.session_state.total}")

        if not st.session_state.get("score_saved", False):
            now = datetime.now()
            data = {
                "username": st.session_state.user,
                "timestamp": now.isoformat(),
                "readable_date": now.strftime("%d/%m/%Y %H:%M"),
                "correct": st.session_state.correct,
                "total": st.session_state.total,
                "duration": 15,
                "tables": ",".join(str(t) for t in st.session_state.selected_tables)
            }
            supabase.table("scores").insert(data).execute()
            st.session_state.score_saved = True

        show_leaderboard()
        show_user_scores(st.session_state.user)

# ---------------- SCORES ----------------
def show_user_scores(username):
    result = supabase.table("scores").select("*").eq("username", username).order("timestamp", desc=True).execute()
    if result.data:
        st.markdown("### Historique")
        df = pd.DataFrame(result.data)
        df = df[["readable_date", "correct", "total", "tables"]]
        df.columns = ["Date", "Bonnes", "Total", "Tables"]
        df.index += 1
        st.dataframe(df, use_container_width=True)

def show_leaderboard():
    result = supabase.table("scores").select("*").order("correct", desc=True).limit(5).execute()
    if result.data:
        st.markdown("### 🏆 Meilleurs scores")
        df = pd.DataFrame(result.data)
        df = df[["username", "correct", "total", "readable_date"]]
        df.columns = ["Élève", "Bonnes", "Total", "Date"]
        df.index += 1
        st.dataframe(df, use_container_width=True)

# ---------------- TEACHER ----------------
def teacher_dashboard():
    st.title("Tableau de bord - Enseignant")
    result = supabase.table("scores").select("*").order("timestamp", desc=True).execute()
    if result.data:
        df = pd.DataFrame(result.data)
        for user in df["username"].unique():
            st.markdown(f"### Élève : {user}")
            user_df = df[df["username"] == user][["readable_date", "correct", "total", "duration", "tables"]]
            user_df.columns = ["Date", "Bonnes", "Total", "Durée (s)", "Tables"]
            user_df.index += 1
            st.dataframe(user_df, use_container_width=True)

    show_all_errors_by_user()

def show_all_errors_by_user():
    result = supabase.table("errors").select("*").order("timestamp", desc=True).execute()
    if result.data:
        df = pd.DataFrame(result.data)
        for user in df["username"].unique():
            st.markdown(f"### Erreurs de : {user}")
            user_df = df[df["username"] == user][["readable_date", "question", "user_answer", "correct_answer"]]
            user_df.columns = ["Date", "Question", "Réponse élève", "Bonne réponse"]
            user_df.index += 1
            st.dataframe(user_df, use_container_width=True)

# ---------------- MAIN ----------------
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
            multiplication_quiz()

if __name__ == "__main__":
    main()
