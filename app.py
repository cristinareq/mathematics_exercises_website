import streamlit as st
import random
import time
import pandas as pd
from datetime import datetime
from supabase import create_client
import streamlit.components.v1 as components
import os
import pytz

# Supabase setup
SUPABASE_URL = st.secrets["SUPABASE_URL"]
SUPABASE_KEY = st.secrets["SUPABASE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

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
            st.session_state.page = "dashboard"
            st.rerun()
        else:
            st.error("Identifiants incorrects.")

# ---------------- HELPERS ----------------
def generate_question(tables):
    a = random.choice(tables)
    b = random.randint(0, 10)
    return a, b

# ---------------- SCORES ----------------
def show_user_scores(username):
    result = supabase.table("scores").select("*").eq("username", username).order("timestamp", desc=True).execute()
    if result.data:
        st.markdown("### Scores des entraînements")
        df = pd.DataFrame(result.data)
        df = df[["readable_date", "correct", "total", "tables"]]
        df.columns = ["Date", "Bonnes", "Total", "Tables"]
        df.index += 1
        st.dataframe(df, use_container_width=True)

def show_user_errors(username):
    result = supabase.table("errors").select("*").eq("username", username).order("timestamp", desc=True).execute()
    if result.data:
        st.markdown("### Erreurs précédentes")
        df = pd.DataFrame(result.data)
        df = df[["readable_date", "question", "user_answer", "correct_answer"]]
        df.columns = ["Date", "Question", "Réponse élève", "Bonne réponse"]
        df.index += 1
        st.dataframe(df, use_container_width=True)

def get_user_stats(username):
    result = supabase.table("scores").select("*").eq("username", username).execute()
    scores = result.data
    if not scores:
        return 0, 0, 0, None
    total_attempts = len(scores)
    best_score = max(s["correct"] for s in scores)
    avg_score = round(sum(s["correct"] for s in scores) / total_attempts, 2)
    last_date = max(s["timestamp"] for s in scores)
    last_dt = datetime.fromisoformat(last_date)
    return best_score, avg_score, total_attempts, last_dt

def now_paris():
    from_zone = pytz.utc
    paris = pytz.timezone("Europe/Paris")
    utc_now = datetime.utcnow().replace(tzinfo=from_zone)
    return utc_now.astimezone(paris)

def render_countdown():
    js_code = """
    <div style="font-size: 32px; font-weight: bold;">
        ⏳ Temps restant : <span id="countdown">00:15</span>
    </div>

    <script>
    let duration = 15;
    const countdown = document.getElementById('countdown');

    function updateTimer() {
        let minutes = Math.floor(duration / 60);
        let seconds = duration % 60;

        countdown.textContent =
            (minutes < 10 ? '0' : '') + minutes + ':' +
            (seconds < 10 ? '0' : '') + seconds;

        if (duration <= 0) {
            clearInterval(interval);
        }
        duration--;
    }

    const interval = setInterval(updateTimer, 1000);
    updateTimer();
    </script>
    """
    components.html(js_code, height=60)


def reset_quiz_state():
    for key in [
        "quiz_start_time", "correct", "total", "current_index",
        "quiz_running", "last_feedback", "last_feedback_type", "score_saved", "questions"
    ]:
        st.session_state.pop(key, None)


# ---------------- QUIZ ----------------
def run_quiz(questions):
    if "quiz_start_time" not in st.session_state:
        st.session_state.quiz_start_time = time.time()
        st.session_state.correct = 0
        st.session_state.total = 0
        st.session_state.current_index = 0
        st.session_state.quiz_running = True
        st.session_state.last_feedback = ""
        st.session_state.score_saved = False

    elapsed = int(time.time() - st.session_state.quiz_start_time)
    remaining = max(0, 15 - elapsed)

    if remaining <= 0:
        st.session_state.quiz_running = False

    if st.session_state.quiz_running:
        render_countdown()
        st.success(f"🌟 Score en direct : {st.session_state.correct}/{st.session_state.total}")

        a, b = questions[st.session_state.current_index]

        with st.form(key=f"form_{st.session_state.current_index}_{st.session_state.total}"):
            answer = st.text_input(
                f"Combien fait {a} × {b} ?",
                key=f"q-{a}-{b}",
                placeholder="Écris ta réponse ici"
            )
        
            # Afficher feedback directement sous le champ réponse
            if st.session_state.last_feedback_type == "success":
                st.success(st.session_state.last_feedback)
            elif st.session_state.last_feedback_type == "error":
                st.error(st.session_state.last_feedback)
            elif st.session_state.last_feedback_type == "warning":
                st.warning(st.session_state.last_feedback)
        
            submitted = st.form_submit_button("Soumettre")

        components.html("""
        <script>
          window.addEventListener('load', function() {
            setTimeout(function() {
              const iframe = window.parent.document.querySelector('iframe');
              if (iframe) {
                const input = iframe.contentDocument.querySelector('input[data-testid="stTextInput"]');
                if (input) input.focus();
              }
            }, 200);
          });
        </script>
        """, height=0)

        if submitted:
            try:
                user_answer = int(answer)
                correct_answer = a * b
                if user_answer == correct_answer:
                    st.session_state.correct += 1
                    st.session_state.last_feedback = "✅ Correct !"
                    st.session_state.last_feedback_type = "success"

                else:
                    st.session_state.last_feedback = f"❌ Faux. La bonne réponse était {correct_answer}"
                    st.session_state.last_feedback_type = "error"

                    now = now_paris()
                    supabase.table("errors").insert({
                        "username": st.session_state.user,
                        "timestamp": now.isoformat(),
                        "readable_date": now.strftime("%d/%m/%Y %H:%M"),
                        "question": f"{a} x {b}",
                        "correct_answer": correct_answer,
                        "user_answer": user_answer,
                        "table_value": a
                    }).execute()
            except:
                st.session_state.last_feedback = "⛔ Veuillez entrer un nombre valide."

            st.session_state.total += 1
            st.session_state.current_index = (st.session_state.current_index + 1) % len(questions)
            st.rerun()

    else:
        st.title("📎 Temps écoulé")
        st.success(f"Score final : {st.session_state.correct}/{st.session_state.total}")

        if not st.session_state.score_saved:
            now = now_paris()
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

        st.markdown("### 📃 Récapitulatif des erreurs de cette session")
        recent_errors = supabase.table("errors").select("*").eq("username", st.session_state.user).order("timestamp", desc=True).limit(10).execute().data
        if recent_errors:
            df = pd.DataFrame(recent_errors)
            df = df["question"].astype(str) + " | ❌ " + df["user_answer"].astype(str) + " ✅ " + df["correct_answer"].astype(str)
            st.write("\n".join(df))
        else:
            st.write("Pas d'erreurs enregistrées pour cette session.")

        if st.button("⬅️ Retour"):
            reset_quiz_state()
            st.session_state.page = "dashboard"
            st.rerun()


# ---------------- PAGES ----------------
def student_dashboard():
    st.title(f"Bienvenue, {st.session_state.user}")
    best, avg, count, last_dt = get_user_stats(st.session_state.user)
    last_str = last_dt.strftime("%d/%m/%Y %H:%M") if last_dt else "—"
    st.markdown(f"**Meilleur score :** {best} | **Moyenne :** {avg} | **Entraînements :** {count} | **Dernier :** {last_str}")

    selected_tables = st.multiselect("Choisis les tables à réviser :", list(range(2, 11)), default=[2, 3])
    if selected_tables:
        rows = [[f"{t}×{i}={t*i}" for i in range(1, 11)] for t in selected_tables]
        df = pd.DataFrame(rows, index=[f"Table de {t}" for t in selected_tables]).transpose()
        df.index += 1
        st.dataframe(df)

    if st.button("Commencer l'entraînement"):
        reset_quiz_state()
        questions = [generate_question(selected_tables) for _ in range(30)]
        st.session_state.selected_tables = selected_tables
        st.session_state.page = "quiz"
        st.session_state.questions = questions
        st.rerun()

    if st.button("Réviser mes erreurs"):
        errors = supabase.table("errors").select("*").eq("username", st.session_state.user).execute().data
        if errors:
            reset_quiz_state()
            questions = [(int(e["question"].split(" x ")[0]), int(e["question"].split(" x ")[1])) for e in errors]
            st.session_state.selected_tables = list(set(q[0] for q in questions))
            st.session_state.page = "quiz"
            st.session_state.questions = questions
            st.rerun()
        else:
            st.warning("Aucune erreur enregistrée.")

    show_user_scores(st.session_state.user)
    show_user_errors(st.session_state.user)

def quiz_page():
    run_quiz(st.session_state.questions)

def teacher_dashboard():
    st.title("Tableau de bord - Enseignant")
    result = supabase.table("scores").select("*").order("timestamp", desc=True).execute()

    if result.data:
        df = pd.DataFrame(result.data)
        users = df["username"].unique()

        for user in users:
            best, avg, count, last_dt = get_user_stats(user)
            last_str = last_dt.strftime("%d/%m/%Y %H:%M") if last_dt else "—"
            if st.button(f"{user} | Max: {best} | Moy: {avg} | Exos: {count} | Dernier : {last_str}", key=f"btn-{user}"):
                st.session_state.selected_student = user
                st.rerun()


    if "selected_student" in st.session_state:
        st.title(f"Statistiques de {st.session_state.selected_student}")
        show_user_scores(st.session_state.selected_student)
        show_user_errors(st.session_state.selected_student)
        if st.button("⬅ Retour"):
            del st.session_state.selected_student
            st.rerun()

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
            if st.session_state.get("page") == "quiz":
                quiz_page()
            else:
                student_dashboard()

if __name__ == "__main__":
    main()
