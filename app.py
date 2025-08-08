import streamlit as st
import random
import time
import pandas as pd
from datetime import datetime
from fractions import Fraction
from supabase import create_client
import streamlit.components.v1 as components
import os
import pytz

# ---------------- Supabase setup ----------------
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
            reset_quiz_state()
            st.rerun()
        else:
            st.error("Identifiants incorrects.")

# ---------------- HELPERS ----------------
def now_paris():
    from_zone = pytz.utc
    paris = pytz.timezone("Europe/Paris")
    utc_now = datetime.utcnow().replace(tzinfo=from_zone)
    return utc_now.astimezone(paris)

# Reset quiz-related state keys
def reset_quiz_state():
    for key in [
        "quiz_start_time", "correct", "total", "current_index",
        "quiz_running", "last_feedback", "last_feedback_type", "score_saved",
        "questions", "mode", "review_mode"
    ]:
        st.session_state.pop(key, None)

# Generate a question based on parameters
def generate_question(op, num_type, min_val, max_val):
    # Generate operands
    if num_type == "Entiers":
        a = random.randint(min_val, max_val)
        b = random.randint(min_val, max_val) if op != "Negate" else None
    elif num_type == "Fractions":
        # simple fractions between min_val/max_val over random denom
        denom = random.randint(1, max_val)
        a = Fraction(random.randint(min_val, max_val), denom)
        if op != "Negate":
            denom2 = random.randint(1, max_val)
            b = Fraction(random.randint(min_val, max_val), denom2)
        else:
            b = None
    elif num_type == "Négatifs":
        a = random.choice([-1, 1]) * random.randint(min_val, max_val)
        b = random.choice([-1, 1]) * random.randint(min_val, max_val) if op != "Negate" else None
    else:
        # default
        a, b = 0, 0

    # Compute question and answer
    if op == "Multiply":
        question = f"{a} × {b}"
        answer = a * b
    elif op == "Sum":
        question = f"{a} + {b}"
        answer = a + b
    elif op == "Divide":
        question = f"{a} ÷ {b}"
        # avoid division by zero
        answer = a / b if b != 0 else None
    elif op == "Negate":
        question = f"Négater {a}"
        answer = -a
    else:
        question, answer = "", None
    return question, answer

# ---------------- QUIZ ENGINE ----------------
def run_quiz():
    # Initialize session state for quiz
    st.session_state.setdefault("last_feedback", "")
    st.session_state.setdefault("last_feedback_type", "")
    st.session_state.setdefault("score_saved", False)
    st.session_state.setdefault("quiz_running", True)

    if "quiz_start_time" not in st.session_state:
        st.session_state.quiz_start_time = time.time()
        st.session_state.correct = 0
        st.session_state.total = 0
        st.session_state.current_index = 0

    # Countdown in seconds (training fixed to 15 sec, homework uses duration param)
    duration = st.session_state.get("duration_secs", 15)
    elapsed = int(time.time() - st.session_state.quiz_start_time)
    remaining = max(0, duration - elapsed)

    if remaining <= 0:
        st.session_state.quiz_running = False

    if st.session_state.quiz_running:
        # Render countdown
        minutes = remaining // 60
        seconds = remaining % 60
        st.markdown(f"⏳ Temps restant : **{minutes:02d}:{seconds:02d}**")
        st.success(f"Score en direct : {st.session_state.correct}/{st.session_state.total}")
        qdata = st.session_state.questions[st.session_state.current_index]
        question = qdata["question"]
        correct_answer = qdata["answer"]
        error_id = qdata.get("error_id")

        with st.form(key=f"form_{st.session_state.current_index}"):
            user_input = st.text_input(f"{question} = ?", key=f"q-{st.session_state.current_index}")
            if st.session_state.last_feedback_type == "success":
                st.success(st.session_state.last_feedback)
            elif st.session_state.last_feedback_type == "error":
                st.error(st.session_state.last_feedback)
            submitted = st.form_submit_button("Soumettre")

        if submitted:
            try:
                # Cast to appropriate type
                if isinstance(correct_answer, Fraction):
                    user_answer = Fraction(user_input)
                else:
                    user_answer = float(user_input) if "." in user_input else int(user_input)
                if user_answer == correct_answer:
                    st.session_state.correct += 1
                    st.session_state.last_feedback = "✅ Correct !"
                    st.session_state.last_feedback_type = "success"
                    # If in review mode, remove error
                    if st.session_state.review_mode and error_id:
                        supabase.table("errors").delete().eq("id", error_id).execute()
                else:
                    st.session_state.last_feedback = f"❌ Faux. La bonne réponse était {correct_answer}"
                    st.session_state.last_feedback_type = "error"
                    # Log error only in training or homework, not in review
                    if not st.session_state.review_mode:
                        now = now_paris()
                        supabase.table("errors").insert({
                            "username": st.session_state.user,
                            "timestamp": now.isoformat(),
                            "readable_date": now.strftime("%d/%m/%Y %H:%M"),
                            "question": question,
                            "correct_answer": str(correct_answer),
                            "user_answer": str(user_answer)
                        }).execute()
                st.session_state.total += 1
                st.session_state.current_index = (st.session_state.current_index + 1) % len(st.session_state.questions)
                st.rerun()
            except Exception:
                st.session_state.last_feedback = "Entrez un nombre valide."
                st.session_state.last_feedback_type = "error"
    else:
        # Quiz finished
        st.title("Fin du temps")
        st.success(f"Score final : {st.session_state.correct}/{st.session_state.total}")
        # Save score
        if not st.session_state.score_saved:
            now = now_paris()
            data = {
                "username": st.session_state.user,
                "timestamp": now.isoformat(),
                "readable_date": now.strftime("%d/%m/%Y %H:%M"),
                "correct": st.session_state.correct,
                "total": st.session_state.total,
                "duration": duration,
                "mode": st.session_state.mode
            }
            supabase.table("scores").insert(data).execute()
            st.session_state.score_saved = True

        # Display recent errors in this session
        st.markdown("### Vos erreurs pendant cette session :")
        errors = supabase.table("errors").select("*").eq("username", st.session_state.user).order("timestamp", desc=True).limit(20).execute().data
        if errors:
            df = pd.DataFrame(errors)
            df = df[["question", "user_answer", "correct_answer"]]
            df.columns = ["Question", "Votre réponse", "Bonne réponse"]
            st.table(df)
        else:
            st.info("Aucune erreur enregistrée.")

        if st.button("⬅ Retour"):
            reset_quiz_state()
            st.rerun()

# ---------------- STUDENT PAGES ----------------
def student_training():
    st.title("Entraînement libre")
    # Parameters
    op = st.selectbox("Type d'opération :", ["Multiply", "Sum", "Divide", "Negate"])
    num_type = st.selectbox("Type de nombres :", ["Entiers", "Fractions", "Négatifs"])
    min_val, max_val = 1, 10
    if num_type in ["Entiers", "Négatifs"]:
        min_val = st.number_input("Valeur min :", value=1, step=1)
        max_val = st.number_input("Valeur max :", value=10, step=1)
    # Start
    if st.button("Commencer l'entraînement"):
        reset_quiz_state()
        st.session_state.mode = "training"
        st.session_state.review_mode = False
        st.session_state.duration_secs = 15  # fixed training duration
        # Generate questions
        questions = []
        for _ in range(30):
            q, a = generate_question(op, num_type, min_val, max_val)
            questions.append({"question": q, "answer": a})
        st.session_state.questions = questions
        st.rerun()

def student_review():
    st.title("Revoir mes erreurs")
    # Fetch errors
    result = supabase.table("errors").select("*","id").eq("username", st.session_state.user).execute()
    errors = result.data
    if not errors:
        st.warning("Aucune erreur à réviser.")
        return
    if st.button("Commencer la révision" ):
        reset_quiz_state()
        st.session_state.mode = "review"
        st.session_state.review_mode = True
        st.session_state.duration_secs = 15
        questions = []
        for e in errors:
            questions.append({"question": e["question"], "answer": Fraction(e["correct_answer"]) if "/" in e["correct_answer"] else float(e["correct_answer"]) , "error_id": e["id"]})
        st.session_state.questions = questions
        st.rerun()

def student_homeworks():
    st.title("Devoirs")
    # List available homeworks
    hw = supabase.table("homeworks").select("*").order("created_at", desc=True).execute().data
    if not hw:
        st.info("Aucun devoir disponible.")
        return
    for h in hw:
        created = datetime.fromisoformat(h["created_at"]).strftime("%d/%m/%Y %H:%M")
        label = f"{h['name']} - Ops: {h['operation']} | Nombres: {h['number_type']} | Durée: {h['duration']}s | Créé le {created}"
        if st.button(f"Faire le devoir: {label}"):
            reset_quiz_state()
            st.session_state.mode = "homework"
            st.session_state.review_mode = False
            st.session_state.duration_secs = h["duration"]
            # Generate questions based on hw settings
            questions = []
            for _ in range(30):  # questions count arbitrary, quiz ends on time
                q, a = generate_question(h["operation"], h["number_type"],
                                          h.get("range_min",1), h.get("range_max",10))
                questions.append({"question": q, "answer": a})
            st.session_state.questions = questions
            st.rerun()

# ---------------- TEACHER PAGES ----------------
def teacher_create_homework():
    st.title("Créer un devoir")
    name = st.text_input("Nom du devoir")
    op = st.selectbox("Type d'opération :", ["Multiply", "Sum", "Divide", "Negate"])
    num_type = st.selectbox("Type de nombres :", ["Entiers", "Fractions", "Négatifs"])
    range_min, range_max = 1, 10
    if num_type in ["Entiers", "Négatifs"]:
        range_min = st.number_input("Valeur min :", value=1, step=1, key="min_hw")
        range_max = st.number_input("Valeur max :", value=10, step=1, key="max_hw")
    duration = st.number_input("Durée (secondes) :", value=60, step=10)
    if st.button("Créer le devoir"):
        now = now_paris()
        supabase.table("homeworks").insert({
            "name": name,
            "operation": op,
            "number_type": num_type,
            "range_min": range_min,
            "range_max": range_max,
            "duration": int(duration),
            "created_at": now.isoformat()
        }).execute()
        st.success("Devoir créé !")

def teacher_stats(mode='training'):
    st.title(f"Statistiques {'entraînement' if mode=='training' else 'devoirs'}")
    data = supabase.table("scores").select("*").eq("mode", mode).execute().data
    if not data:
        st.info("Aucune donnée.")
        return
    df = pd.DataFrame(data)
    st.dataframe(df)

# ---------------- MAIN ----------------
def main():
    if "user" not in st.session_state:
        login()
        return
    # Sidebar and logout
    st.sidebar.success(f"Connecté: {st.session_state.user}")
    if st.sidebar.button("Se déconnecter"):
        for key in list(st.session_state.keys()): del st.session_state[key]
        st.rerun()

    if st.session_state.is_teacher:
        section = st.sidebar.selectbox("Section enseignant", ["Stats entraînement","Stats devoirs","Créer devoir"])
        if section == "Stats entraînement":
            teacher_stats('training')
        elif section == "Stats devoirs":
            teacher_stats('homework')
        else:
            teacher_create_homework()
    else:
        section = st.sidebar.selectbox("Section", ["Entraînement libre","Revoir erreurs","Devoirs"])
        if section == "Entraînement libre":
            student_training()
        elif section == "Revoir erreurs":
            student_review()
        else:
            student_homeworks()
    # If a quiz is active
    if "questions" in st.session_state:
        run_quiz()

if __name__ == "__main__":
    main()
