import streamlit as st
import random
import time
import pandas as pd
from datetime import datetime
from supabase import create_client

# ---------------- CONFIGURATION SUPABASE ---------------- #
SUPABASE_URL = st.secrets["SUPABASE_URL"]
SUPABASE_KEY = st.secrets["SUPABASE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------- AUTHENTIFICATION ---------------- #
def login():
    st.title("🔐 Connexion")
    username = st.text_input("Nom d'utilisateur")
    password = st.text_input("Mot de passe", type="password")
    if st.button("Se connecter"):
        result = supabase.table("users").select("*").eq("username", username).execute()
        if result.data and result.data[0]["password"] == password:
            st.session_state.user = username
            st.session_state.is_teacher = result.data[0]["is_teacher"]
            st.success(f"Bienvenue {username} !")
            st.rerun()
        else:
            st.error("Identifiants incorrects.")

# ---------------- QUIZ ---------------- #
def generate_question(tables):
    return random.choice(tables), random.randint(0, 10)

def save_score(username, correct, total, duration, selected_tables):
    now = datetime.now()
    data = {
        "username": username,
        "timestamp": now.isoformat(),
        "correct": correct,
        "total": total,
        "duration": duration,
        "tables": ",".join(str(t) for t in selected_tables),
        "readable_date": now.strftime("%d/%m/%Y %H:%M")
    }
    supabase.table("scores").insert(data).execute()

def multiplication_quiz():
    st.title("🧮 Entraînement : Tables de multiplication")
    selected_tables = st.multiselect("Sélectionne les tables à réviser :", list(range(2, 11)), default=[2, 3])

    if "quiz_running" not in st.session_state:
        st.session_state.quiz_running = False
    if "quiz_finished" not in st.session_state:
        st.session_state.quiz_finished = False

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
        remaining = max(0, 300 - elapsed)

        timer_placeholder = st.empty()
        score_placeholder = st.empty()

        with timer_placeholder.container():
            st.info(f"⏳ Temps restant : {remaining} sec")

        with score_placeholder.container():
            st.success(f"Score en direct : {st.session_state.correct}/{st.session_state.total}")

        if remaining <= 0:
            st.session_state.quiz_running = False
            st.session_state.quiz_finished = True
            st.rerun()
            return

        a, b = st.session_state.current_q
        answer = st.number_input(f"Combien fait {a} × {b} ?", key=f"q-{a}-{b}-{st.session_state.total}", step=1)

        if st.button("Soumettre", key=f"submit-{st.session_state.total}"):
            if answer == a * b:
                st.success("✅ Correct !")
                st.session_state.correct += 1
            else:
                st.error(f"❌ Faux. La bonne réponse était {a*b}")
            st.session_state.total += 1
            st.session_state.current_q = generate_question(selected_tables)
            st.rerun()

        time.sleep(1)
        st.rerun()

    elif st.session_state.quiz_finished:
        st.title("🗞️ Résultats")
        st.success(f"Score final : {st.session_state.correct}/{st.session_state.total}")
        st.info("Temps écoulé : 5 minutes")

        if not st.session_state.get("score_saved", False):
            save_score(
                st.session_state.user,
                st.session_state.correct,
                st.session_state.total,
                300,
                st.session_state.selected_tables
            )
            st.session_state.score_saved = True

# ---------------- ENSEIGNANT ---------------- #
def teacher_dashboard():
    st.title("📊 Tableau de bord - Enseignant")
    result = supabase.table("scores").select("*").execute()
    if not result.data:
        st.info("Aucun score enregistré pour le moment.")
        return

    df = pd.DataFrame(result.data).sort_values(by="timestamp", ascending=False)
    st.subheader("Tous les résultats enregistrés")

    for user in df["username"].unique():
        st.markdown(f"### 👤 Élève : {user}")
        user_df = df[df["username"] == user][["readable_date", "correct", "total", "duration", "tables"]]
        user_df.columns = ["Date", "Bonnes réponses", "Total", "Durée (s)", "Tables choisies"]
        st.dataframe(user_df, use_container_width=True)

# ---------------- MAIN ---------------- #
def main():
    if "user" not in st.session_state:
        login()
    else:
        if st.button("🔒 Se déconnecter"):
            for key in list(st.session_state.keys()):
                del st.session_state[key]
            st.rerun()

        if st.session_state.get("is_teacher", False):
            teacher_dashboard()
        else:
            multiplication_quiz()

if __name__ == "__main__":
    main()
