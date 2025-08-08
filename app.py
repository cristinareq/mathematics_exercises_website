import os
import random
import time
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from fractions import Fraction
from typing import List, Optional, Tuple, Union

import pandas as pd
import pytz
import streamlit as st
import streamlit.components.v1 as components
from supabase import create_client

# ------------- CONFIG / SUPABASE -------------
SUPABASE_URL = st.secrets["SUPABASE_URL"]
SUPABASE_KEY = st.secrets["SUPABASE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ------------- CONSTANTS / TYPES -------------
OPERATIONS = ["Multiply", "Divide", "Sum", "Negate"]
NUMBER_TYPES = ["Entiers", "Fractions", "Négatifs"]

DEFAULT_TRAINING_DURATION = 180  # 3 min par défaut pour entrainement
DEFAULT_RANGE_MIN = 1
DEFAULT_RANGE_MAX = 10

PARIS_TZ = pytz.timezone("Europe/Paris")


@dataclass
class QuizConfig:
    mode: str  # "training" | "review" | "homework"
    operation: str  # one of OPERATIONS
    number_type: str  # one of NUMBER_TYPES
    range_min: int
    range_max: int
    duration_sec: int
    homework_id: Optional[int] = None  # only for homework


@dataclass
class Question:
    a: Union[int, Fraction]
    b: Union[int, Fraction]
    op: str  # operation
    number_type: str
    # canonical key to match errors across sessions (e.g. "Sum|3|5|Entiers")
    key: str
    # human display of the prompt (e.g. "3 + 5")
    prompt: str
    # correct result as Fraction
    correct: Fraction


# ------------- AUTH -------------
def login():
    st.title("Connexion")
    username = st.text_input("Nom d'utilisateur").strip().lower()
    password = st.text_input("Mot de passe", type="password")
    if st.button("Se connecter"):
        result = supabase.table("users").select("*").eq("username", username).execute()
        if result.data and result.data[0]["password"] == password:
            st.session_state.user = username
            st.session_state.is_teacher = bool(result.data[0]["is_teacher"])
            # Landing pages depend on role
            st.session_state.view = "dashboard"
            st.rerun()
        else:
            st.error("Identifiants incorrects.")


# ------------- TIME / UTILS -------------
def now_paris():
    return datetime.utcnow().replace(tzinfo=pytz.utc).astimezone(PARIS_TZ)


def to_fraction(text: str) -> Optional[Fraction]:
    """
    Parse user answer string into Fraction:
    - integer "5" -> Fraction(5,1)
    - fraction "3/4" or "-2/3"
    - decimal "0.25"
    Returns None if parsing fails.
    """
    s = (text or "").strip().replace(" ", "")
    if not s:
        return None
    # fraction a/b
    if "/" in s:
        parts = s.split("/")
        if len(parts) != 2:
            return None
        try:
            num = int(parts[0])
            den = int(parts[1])
            if den == 0:
                return None
            return Fraction(num, den)
        except Exception:
            return None
    # integer or decimal
    try:
        # As integer first
        if s.lstrip("-").isdigit():
            return Fraction(int(s), 1)
        # Decimal
        dec = Decimal(s)
        return Fraction(dec)
    except (InvalidOperation, ValueError):
        return None


def fraction_to_pretty(fr: Fraction) -> str:
    if fr.denominator == 1:
        return str(fr.numerator)
    return f"{fr.numerator}/{fr.denominator}"


def canonical_term(x: Union[int, Fraction]) -> str:
    if isinstance(x, Fraction):
        return fraction_to_pretty(x)
    return str(int(x))


def make_question_key(op: str, a: Union[int, Fraction], b: Union[int, Fraction], number_type: str) -> str:
    return f"{op}|{canonical_term(a)}|{canonical_term(b)}|{number_type}"


def op_symbol(op: str) -> str:
    return {"Multiply": "×", "Divide": "÷", "Sum": "+", "Negate": "−"}.get(op, "?")


def apply_operation(a: Fraction, b: Fraction, operation: str) -> Fraction:
    if operation == "Multiply":
        return a * b
    if operation == "Divide":
        # avoid division by zero at generation time
        return a / b
    if operation == "Sum":
        return a + b
    if operation == "Negate":
        # Treat "Negate" as subtraction (a - b)
        return a - b
    raise ValueError(f"Unknown operation {operation}")


# ------------- DATA ACCESS HELPERS -------------
def errors_pending_count(username: str) -> int:
    res = (
        supabase.table("errors")
        .select("id", count="exact")
        .eq("username", username)
        .eq("corrected", False)
        .execute()
    )
    # Some clients return count in res.count; fallback to len
    if getattr(res, "count", None) is not None:
        return res.count or 0
    return len(res.data or [])


def mark_matching_errors_corrected(username: str, q: Question, source: str):
    """
    Mark as corrected any non-corrected error rows matching the question key for this user.
    Only called in training or homework flows.
    """
    now = now_paris().isoformat()
    # Update rows where corrected is false and question_key matches.
    try:
        supabase.table("errors").update(
            {"corrected": True, "corrected_at": now, "correction_source": source}
        ).eq("username", username).eq("corrected", False).eq("question_key", q.key).execute()
    except Exception:
        # best-effort
        pass


def insert_error_row(username: str, q: Question, user_ans: Optional[Fraction]):
    """
    Insert a new error row. Keep backward compatibility with legacy integer columns
    but prefer *_text fields and a stable question_key.
    """
    now = now_paris()
    correct_txt = fraction_to_pretty(q.correct)
    user_txt = "" if user_ans is None else fraction_to_pretty(user_ans)

    # Legacy integer fields when possible
    correct_int = q.correct.numerator if q.correct.denominator == 1 else None
    user_int = (
        user_ans.numerator if (user_ans and user_ans.denominator == 1) else None
    )

    try:
        supabase.table("errors").insert(
            {
                "username": username,
                "timestamp": now.isoformat(),
                "readable_date": now.strftime("%d/%m/%Y %H:%M"),
                "question": q.prompt,  # human readable
                "correct_answer": correct_int,  # legacy
                "user_answer": user_int,  # legacy
                "correct_answer_text": correct_txt,
                "user_answer_text": user_txt,
                "table_value": int(q.a) if isinstance(q.a, int) else None,
                "question_key": q.key,
                "corrected": False,
            }
        ).execute()
    except Exception as e:
        st.warning(f"Erreur lors de l'enregistrement de l'erreur: {e}")


def save_training_score(username: str, cfg: QuizConfig, correct: int, total: int):
    now = now_paris()
    # Serialize settings into 'tables' column for backward compatibility
    settings_text = f"op={cfg.operation};type={cfg.number_type};min={cfg.range_min};max={cfg.range_max}"
    supabase.table("scores").insert(
        {
            "username": username,
            "timestamp": now.isoformat(),
            "readable_date": now.strftime("%d/%m/%Y %H:%M"),
            "correct": correct,
            "total": total,
            "duration": cfg.duration_sec,
            "tables": settings_text,
            "quiz_mode": "training",
        }
    ).execute()


def save_review_score(username: str, duration_sec: int, correct: int, total: int):
    now = now_paris()
    supabase.table("scores").insert(
        {
            "username": username,
            "timestamp": now.isoformat(),
            "readable_date": now.strftime("%d/%m/%Y %H:%M"),
            "correct": correct,
            "total": total,
            "duration": duration_sec,
            "tables": "review_errors",
            "quiz_mode": "review",
        }
    ).execute()


def save_homework_submission(username: str, homework_id: int, duration_sec: int, correct: int, total: int):
    now = now_paris()
    supabase.table("homework_submissions").insert(
        {
            "homework_id": homework_id,
            "username": username,
            "timestamp": now.isoformat(),
            "readable_date": now.strftime("%d/%m/%Y %H:%M"),
            "correct": correct,
            "total": total,
            "duration": duration_sec,
        }
    ).execute()


def list_student_homeworks(username: str):
    """
    Return all homeworks + whether this user has any submission.
    """
    hws = supabase.table("homeworks").select("*").order("created_at", desc=True).execute().data or []
    subs = (
        supabase.table("homework_submissions")
        .select("homework_id, correct, total, timestamp")
        .eq("username", username)
        .execute()
        .data
        or []
    )
    subs_by_hw = {}
    for s in subs:
        hid = s["homework_id"]
        subs_by_hw.setdefault(hid, []).append(s)
    return hws, subs_by_hw


def list_teacher_homeworks(teacher_username: str):
    return (
        supabase.table("homeworks")
        .select("*")
        .eq("created_by", teacher_username)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )


def list_teacher_classes(teacher_username: str):
    return (
        supabase.table("classes")
        .select("*")
        .eq("created_by", teacher_username)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )


def list_class_members(class_id: int):
    rows = supabase.table("class_members").select("username").eq("class_id", class_id).execute().data or []
    return [r["username"] for r in rows]


# ------------- QUESTION GENERATION -------------
def rand_int_nonzero(min_v: int, max_v: int) -> int:
    while True:
        x = random.randint(min_v, max_v)
        if x != 0:
            return x


def generate_operand_b(number_type: str, rng: Tuple[int, int]) -> Union[int, Fraction]:
    lo, hi = rng
    if number_type == "Entiers":
        return random.randint(lo, hi)
    if number_type == "Négatifs":
        # generate negative integer
        return -random.randint(lo, hi)
    if number_type == "Fractions":
        # a simple fraction within range: num in [lo,hi], den in [1,hi]
        num = random.randint(lo, hi)
        den = random.randint(1, hi)
        return Fraction(num, den)
    raise ValueError("Invalid number_type")


def generate_question(cfg: QuizConfig) -> Question:
    # By spec: operations are done between an integer (a) and a value of the selected number_type (b).
    a = random.randint(cfg.range_min, cfg.range_max)
    # For divide, ensure b isn't 0
    if cfg.operation == "Divide":
        if cfg.number_type == "Fractions":
            # keep division simpler: divide by a non-zero integer instead of fraction for UX
            b = rand_int_nonzero(cfg.range_min, cfg.range_max)
        else:
            b = rand_int_nonzero(cfg.range_min, cfg.range_max)
    else:
        b = generate_operand_b(cfg.number_type, (cfg.range_min, cfg.range_max))

    aF = Fraction(a, 1)
    bF = b if isinstance(b, Fraction) else Fraction(int(b), 1)

    result = apply_operation(aF, bF, cfg.operation)
    sym = op_symbol(cfg.operation)
    prompt = f"{canonical_term(a)} {sym} {canonical_term(b)}"
    key = make_question_key(cfg.operation, a, b, cfg.number_type)
    return Question(a=a, b=b, op=cfg.operation, number_type=cfg.number_type, key=key, prompt=prompt, correct=result)


def generate_questions(cfg: QuizConfig, n: int = 100) -> List[Question]:
    # Generate a big pool; with timer we will cycle within time.
    return [generate_question(cfg) for _ in range(n)]


# ------------- QUIZ ENGINE -------------
def reset_quiz_state():
    for key in [
        "quiz_start_time",
        "correct",
        "total",
        "current_index",
        "quiz_running",
        "last_feedback",
        "last_feedback_type",
        "score_saved",
        "questions",
        "quiz_config",
    ]:
        st.session_state.pop(key, None)


def render_countdown(seconds: int):
    js_code = f"""
    <div style="font-size: 32px; font-weight: bold;">
        ⏳ Temps restant : <span id="countdown">00:00</span>
    </div>
    <script>
    let duration = {seconds};
    const countdown = document.getElementById('countdown');
    function updateTimer() {{
        let minutes = Math.floor(duration / 60);
        let seconds = duration % 60;
        countdown.textContent =
            (minutes < 10 ? '0' : '') + minutes + ':' +
            (seconds < 10 ? '0' : '') + seconds;
        if (duration <= 0) {{
            clearInterval(interval);
        }}
        duration--;
    }}
    const interval = setInterval(updateTimer, 1000);
    updateTimer();
    </script>
    """
    components.html(js_code, height=60)


def run_quiz_engine(questions: List[Question], cfg: QuizConfig):
    st.session_state.setdefault("last_feedback", "")
    st.session_state.setdefault("last_feedback_type", "")
    st.session_state.setdefault("score_saved", False)
    st.session_state.setdefault("quiz_running", True)
    st.session_state.setdefault("quiz_config", cfg)

    if "quiz_start_time" not in st.session_state:
        st.session_state.quiz_start_time = time.time()
        st.session_state.correct = 0
        st.session_state.total = 0
        st.session_state.current_index = 0

    elapsed = int(time.time() - st.session_state.quiz_start_time)
    remaining = max(0, cfg.duration_sec - elapsed)

    if remaining <= 0:
        st.session_state.quiz_running = False

    if st.session_state.quiz_running:
        render_countdown(remaining)
        st.success(f"Score en direct : {st.session_state.correct}/{st.session_state.total}")
        q = questions[st.session_state.current_index]

        with st.form(key=f"form_{st.session_state.current_index}_{st.session_state.total}"):
            answer = st.text_input(f"Combien fait {q.prompt} ?", key=f"q-{q.key}", placeholder="Écris ta réponse ici (ex: 12 ou 3/4)")
            # last feedback
            if st.session_state.last_feedback_type == "success":
                st.success(st.session_state.last_feedback)
            elif st.session_state.last_feedback_type == "error":
                st.error(st.session_state.last_feedback)
            elif st.session_state.last_feedback_type == "warning":
                st.warning(st.session_state.last_feedback)

            submitted = st.form_submit_button("Soumettre")

        # focus input
        components.html(
            """
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
        """,
            height=0,
        )

        if submitted:
            user_frac = to_fraction(answer)
            if user_frac is None:
                st.session_state.last_feedback = "Veuillez entrer un nombre valide (entier, fraction a/b, ou décimal)."
                st.session_state.last_feedback_type = "warning"
            else:
                if user_frac == q.correct:
                    st.session_state.correct += 1
                    st.session_state.last_feedback = "✅ Correct !"
                    st.session_state.last_feedback_type = "success"
                    # Mark correction only in training/homework (NOT in review)
                    if cfg.mode in ("training", "homework"):
                        mark_matching_errors_corrected(st.session_state.user, q, cfg.mode)
                else:
                    st.session_state.last_feedback = f"❌ Faux. La bonne réponse était {fraction_to_pretty(q.correct)}"
                    st.session_state.last_feedback_type = "error"
                    # record error
                    insert_error_row(st.session_state.user, q, user_frac)

            st.session_state.total += 1
            st.session_state.current_index = (st.session_state.current_index + 1) % len(questions)
            st.rerun()

    else:
        st.title("Temps écoulé")
        st.success(f"Score final : {st.session_state.correct}/{st.session_state.total}")

        # save score/submission once
        if not st.session_state.score_saved:
            if cfg.mode == "training":
                save_training_score(st.session_state.user, cfg, st.session_state.correct, st.session_state.total)
            elif cfg.mode == "homework" and cfg.homework_id:
                save_homework_submission(st.session_state.user, cfg.homework_id, cfg.duration_sec, st.session_state.correct, st.session_state.total)
            elif cfg.mode == "review":
                save_review_score(st.session_state.user, cfg.duration_sec, st.session_state.correct, st.session_state.total)

            st.session_state.score_saved = True

        # Show recent errors inserted during this run (best-effort)
        st.markdown("### Tes erreurs durant cette session :")
        recent_errors = (
            supabase.table("errors")
            .select("*")
            .eq("username", st.session_state.user)
            .order("timestamp", desc=True)
            .limit(20)
            .execute()
            .data
        )

        if recent_errors:
            # Prefer text columns
            def format_ans(row):
                return row.get("user_answer_text") or (str(row.get("user_answer")) if row.get("user_answer") is not None else "")

            def format_cor(row):
                return row.get("correct_answer_text") or (str(row.get("correct_answer")) if row.get("correct_answer") is not None else "")

            rows = [
                {
                    "Question": r.get("question", ""),
                    "Ta réponse ❌": format_ans(r),
                    "Bonne réponse ✅": format_cor(r),
                }
                for r in recent_errors
            ]
            st.table(pd.DataFrame(rows))
        else:
            st.info("Aucune erreur enregistrée pendant cette session.")

        if st.button("⬅ Retour"):
            reset_quiz_state()
            st.session_state.view = "dashboard"
            st.rerun()


# ------------- STUDENT UI -------------
def student_main_menu():
    st.title(f"Bienvenue, {st.session_state.user.capitalize()}")
    # Three large actions
    cols = st.columns(3)
    pending = errors_pending_count(st.session_state.user)
    with cols[0]:
        if st.button("➡ Entraînement libre", use_container_width=True):
            st.session_state.view = "student_training_setup"
            st.rerun()
    with cols[1]:
        if st.button("➡ Revoir erreurs", use_container_width=True, disabled=(pending == 0)):
            st.session_state.view = "student_review"
            st.rerun()
        if pending == 0:
            st.caption("Aucune erreur à réviser.")
        else:
            st.caption(f"{pending} erreur(s) à réviser.")
    with cols[2]:
        if st.button("➡ Devoirs", use_container_width=True):
            st.session_state.view = "student_homeworks"
            st.rerun()

    # Quick stats (separated)
    with st.expander("Mes statistiques d'entraînement"):
        show_user_training_scores(st.session_state.user)
    with st.expander("Mes statistiques de devoirs"):
        show_user_homework_scores(st.session_state.user)


def student_training_setup():
    st.title("Entraînement libre - Paramètres")
    # Operation (single choice)
    operation = st.selectbox("Type d'opération", OPERATIONS, index=0, help="Une seule opération à la fois.")
    number_type = st.selectbox("Type de nombres", NUMBER_TYPES, index=0, help="Une seule option (entiers, fractions, ou négatifs).")
    c1, c2, c3 = st.columns(3)
    with c1:
        rmin = st.number_input("Valeur minimale (entier a)", value=DEFAULT_RANGE_MIN, step=1)
    with c2:
        rmax = st.number_input("Valeur maximale (entier a)", value=DEFAULT_RANGE_MAX, step=1)
    with c3:
        duration = st.number_input("Durée (secondes)", value=DEFAULT_TRAINING_DURATION, step=15)
    if rmax < rmin:
        st.error("Le maximum doit être supérieur ou égal au minimum.")
        return

    if st.button("Commencer l'entraînement"):
        cfg = QuizConfig(
            mode="training",
            operation=operation,
            number_type=number_type,
            range_min=int(rmin),
            range_max=int(rmax),
            duration_sec=int(duration),
        )
        reset_quiz_state()
        st.session_state.questions = generate_questions(cfg, n=150)
        st.session_state.view = "quiz"
        st.session_state.quiz_config = cfg
        st.rerun()

    if st.button("⬅ Retour"):
        st.session_state.view = "dashboard"
        st.rerun()


def student_review():
    st.title("Revoir mes erreurs")
    # Build questions from non-corrected errors
    rows = (
        supabase.table("errors")
        .select("*")
        .eq("username", st.session_state.user)
        .eq("corrected", False)
        .order("timestamp", desc=True)
        .execute()
        .data
        or []
    )
    if not rows:
        st.info("Aucune erreur à réviser.")
        if st.button("⬅ Retour"):
            st.session_state.view = "dashboard"
            st.rerun()
        return

    # We will reconstruct Question objects from stored question_key if available,
    # otherwise parse from question text (best effort).
    qs: List[Question] = []
    for r in rows:
        # Try to rebuild from question_key
        qk = r.get("question_key")
        if qk:
            try:
                op, a_str, b_str, ntype = qk.split("|")
                # parse a, b to Fraction or int
                def parse_term(s: str) -> Union[int, Fraction]:
                    if "/" in s or "." in s or "-" in s:
                        fr = to_fraction(s)
                        if fr is None:
                            # fallback int
                            return int(s)
                        return fr
                    # digit
                    return int(s)

                a_term = parse_term(a_str)
                b_term = parse_term(b_str)
                aF = Fraction(a_term, 1) if isinstance(a_term, int) else a_term
                bF = Fraction(b_term, 1) if isinstance(b_term, int) else b_term
                correct = apply_operation(Fraction(int(aF.numerator), int(aF.denominator)), Fraction(int(bF.numerator), int(bF.denominator)), op)
                prompt = f"{canonical_term(a_term)} {op_symbol(op)} {canonical_term(b_term)}"
                qs.append(
                    Question(
                        a=a_term,
                        b=b_term,
                        op=op,
                        number_type=ntype,
                        key=qk,
                        prompt=prompt,
                        correct=correct,
                    )
                )
                continue
            except Exception:
                pass

        # Fallback: parse the human "question" like "3 × 5"
        prompt = r.get("question", "")
        # Very simple parse: split by spaces
        try:
            parts = prompt.split()
            a_str, sym, b_str = parts[0], parts[1], parts[2]
            sym_to_op = {"×": "Multiply", "÷": "Divide", "+": "Sum", "−": "Negate", "-": "Negate"}
            op = sym_to_op.get(sym, "Sum")
            a_term = to_fraction(a_str) or Fraction(int(a_str), 1)
            b_term = to_fraction(b_str) or Fraction(int(b_str), 1)
            corr = apply_operation(a_term, b_term, op)
            qk = make_question_key(op, a_term, b_term, r.get("number_type", "Entiers"))
            qs.append(
                Question(
                    a=a_term if a_term.denominator == 1 else a_term,
                    b=b_term if b_term.denominator == 1 else b_term,
                    op=op,
                    number_type=r.get("number_type", "Entiers"),
                    key=qk,
                    prompt=prompt,
                    correct=corr,
                )
            )
        except Exception:
            # skip unparsable
            continue

    if not qs:
        st.info("Aucune erreur exploitable à réviser.")
        if st.button("⬅ Retour"):
            st.session_state.view = "dashboard"
            st.rerun()
        return

    # Configure duration (optional small session)
    dur = st.number_input("Durée (secondes)", value=120, step=15)
    if st.button("Commencer la révision"):
        cfg = QuizConfig(
            mode="review",
            operation="review",  # informational only
            number_type="review",
            range_min=0,
            range_max=0,
            duration_sec=int(dur),
        )
        reset_quiz_state()
        st.session_state.questions = qs
        st.session_state.view = "quiz"
        st.session_state.quiz_config = cfg
        st.rerun()

    if st.button("⬅ Retour"):
        st.session_state.view = "dashboard"
        st.rerun()


def student_homeworks():
    st.title("Mes devoirs")
    homeworks, subs_by_hw = list_student_homeworks(st.session_state.user)
    if not homeworks:
        st.info("Aucun devoir n'est disponible pour le moment.")
    else:
        for hw in homeworks:
            hwid = hw["id"]
            label = f"{hw['name']} • {hw['operation']} • {hw['number_type']} • {hw['range_min']}-{hw['range_max']} • {hw['duration']}s"
            st.markdown(f"#### {label}")
            attempts = subs_by_hw.get(hwid, [])
            if attempts:
                last = max(attempts, key=lambda x: x["timestamp"])
                st.caption(f"Dernière tentative: {last['correct']}/{last['total']} le {last['timestamp']}")
            cols = st.columns(2)
            with cols[0]:
                if st.button("Démarrer", key=f"start-hw-{hwid}"):
                    cfg = QuizConfig(
                        mode="homework",
                        operation=hw["operation"],
                        number_type=hw["number_type"],
                        range_min=int(hw["range_min"]) if hw.get("range_min") is not None else DEFAULT_RANGE_MIN,
                        range_max=int(hw["range_max"]) if hw.get("range_max") is not None else DEFAULT_RANGE_MAX,
                        duration_sec=int(hw["duration"]),
                        homework_id=int(hwid),
                    )
                    reset_quiz_state()
                    st.session_state.questions = generate_questions(cfg, n=200)
                    st.session_state.view = "quiz"
                    st.session_state.quiz_config = cfg
                    st.rerun()
            with cols[1]:
                st.write("Tentatives: ", len(attempts))

    if st.button("⬅ Retour"):
        st.session_state.view = "dashboard"
        st.rerun()


# ------------- TEACHER UI -------------
def teacher_dashboard():
    st.title("Tableau de bord - Enseignant")

    tab1, tab2, tab3 = st.tabs(["Créer un devoir", "Stats d'entraînement", "Stats devoirs par classe"])

    with tab1:
        teacher_create_homework()
        st.divider()
        teacher_list_homeworks()

    with tab2:
        teacher_training_stats()

    with tab3:
        teacher_homework_class_stats()


def teacher_create_homework():
    st.subheader("Créer un devoir")
    name = st.text_input("Nom du devoir", value="Devoir " + now_paris().strftime("%d/%m"))
    operation = st.selectbox("Type d'opération", OPERATIONS, index=0)
    number_type = st.selectbox("Type de nombres", NUMBER_TYPES, index=0)
    c1, c2, c3 = st.columns(3)
    with c1:
        rmin = st.number_input("Valeur minimale (entier a)", value=DEFAULT_RANGE_MIN, step=1)
    with c2:
        rmax = st.number_input("Valeur maximale (entier a)", value=DEFAULT_RANGE_MAX, step=1)
    with c3:
        duration = st.number_input("Durée (secondes)", value=180, step=15)

    if rmax < rmin:
        st.error("Le maximum doit être supérieur ou égal au minimum.")
        return

    if st.button("Créer le devoir"):
        try:
            supabase.table("homeworks").insert(
                {
                    "name": name,
                    "operation": operation,
                    "number_type": number_type,
                    "range_min": int(rmin),
                    "range_max": int(rmax),
                    "duration": int(duration),
                    "created_by": st.session_state.user,
                }
            ).execute()
            st.success("Devoir créé avec succès.")
            st.experimental_rerun()
        except Exception as e:
            st.error(f"Erreur lors de la création du devoir: {e}")


def teacher_list_homeworks():
    st.subheader("Mes devoirs")
    rows = list_teacher_homeworks(st.session_state.user)
    if not rows:
        st.caption("Aucun devoir trouvé.")
        return
    df = pd.DataFrame(rows)
    df = df[["id", "name", "operation", "number_type", "range_min", "range_max", "duration", "created_at"]]
    st.dataframe(df, use_container_width=True)


def teacher_training_stats():
    st.subheader("Statistiques d'entraînement (par élève)")
    result = supabase.table("scores").select("*").eq("quiz_mode", "training").order("timestamp", desc=True).execute()
    data = result.data or []
    if not data:
        st.caption("Aucune donnée d'entraînement.")
        return

    df = pd.DataFrame(data)
    # Aggregate per user
    users = sorted(df["username"].unique())
    for user in users:
        u = df[df["username"] == user]
        best = u["correct"].max()
        avg = round(u["correct"].mean(), 2)
        count = len(u)
        last = u["timestamp"].max()
        st.markdown(f"**{user.capitalize()}** | Max: {best} | Moy: {avg} | Sessions: {count} | Dernier: {last}")
        with st.expander(f"Détails {user}"):
            st.dataframe(u[["readable_date", "correct", "total", "duration", "tables"]], use_container_width=True)


def teacher_homework_class_stats():
    st.subheader("Statistiques des devoirs par classe")
    classes = list_teacher_classes(st.session_state.user)
    if not classes:
        st.caption("Aucune classe associée.")
        return

    class_options = {f"{c['name']} (#{c['id']})": c["id"] for c in classes}
    class_label = st.selectbox("Choisir une classe", list(class_options.keys()))
    class_id = class_options[class_label]
    members = list_class_members(class_id)
    st.caption(f"Élèves dans la classe: {len(members)}")

    # Homeworks created by this teacher
    hws = list_teacher_homeworks(st.session_state.user)
    if not hws:
        st.caption("Aucun devoir créé.")
        return

    # Submissions for those homeworks from class members
    hw_ids = [h["id"] for h in hws]
    subs = (
        supabase.table("homework_submissions")
        .select("*")
        .in_("homework_id", hw_ids)
        .in_("username", members)
        .execute()
        .data
        or []
    )

    # Build completion matrix
    for hw in hws:
        hid = hw["id"]
        s_for_hw = [s for s in subs if s["homework_id"] == hid]
        done_users = {s["username"] for s in s_for_hw}
        st.markdown(f"### {hw['name']} • {hw['operation']} • {hw['number_type']} • {hw['range_min']}-{hw['range_max']} • {hw['duration']}s")
        st.write(f"Complété par {len(done_users)}/{len(members)} élèves")
        rows = []
        for u in members:
            attempts = [s for s in s_for_hw if s["username"] == u]
            if attempts:
                last = max(attempts, key=lambda x: x["timestamp"])
                rows.append(
                    {"Élève": u, "Tentatives": len(attempts), "Dernier score": f"{last['correct']}/{last['total']}", "Dernier": last["readable_date"]}
                )
            else:
                rows.append({"Élève": u, "Tentatives": 0, "Dernier score": "-", "Dernier": "-"})
        st.dataframe(pd.DataFrame(rows), use_container_width=True)


# ------------- LEGACY STATS (Student views) -------------
def show_user_training_scores(username: str):
    res = supabase.table("scores").select("*").eq("username", username).eq("quiz_mode", "training").order("timestamp", desc=True).execute()
    data = res.data or []
    if not data:
        st.caption("Aucune session d'entraînement pour le moment.")
        return
    df = pd.DataFrame(data)
    st.dataframe(df[["readable_date", "correct", "total", "duration", "tables"]].rename(columns={"tables": "Paramètres"}), use_container_width=True)


def show_user_homework_scores(username: str):
    res = supabase.table("homework_submissions").select("*").eq("username", username).order("timestamp", desc=True).execute()
    data = res.data or []
    if not data:
        st.caption("Aucun devoir réalisé pour le moment.")
        return
    df = pd.DataFrame(data)
    st.dataframe(df[["readable_date", "correct", "total", "duration", "homework_id"]], use_container_width=True)


# ------------- MAIN ROUTER -------------
def main():
    st.set_page_config(page_title="Math Trainer", page_icon="🧮", layout="wide")

    if "user" not in st.session_state:
        login()
        return

    # Sidebar with account and role
    st.sidebar.success(f"Connecté en tant que {st.session_state.user}")
    if st.sidebar.button("Se déconnecter"):
        for key in list(st.session_state.keys()):
            del st.session_state[key]
        st.rerun()

    if st.session_state.get("is_teacher", False):
        teacher_dashboard()
        return

    # Student flows
    view = st.session_state.get("view", "dashboard")
    if view == "dashboard":
        student_main_menu()
    elif view == "student_training_setup":
        student_training_setup()
    elif view == "student_review":
        student_review()
    elif view == "student_homeworks":
        student_homeworks()
    elif view == "quiz":
        cfg: QuizConfig = st.session_state.get("quiz_config")
        questions: List[Question] = st.session_state.get("questions", [])
        if not cfg or not questions:
            # safety fallback
            st.session_state.view = "dashboard"
            st.rerun()
        run_quiz_engine(questions, cfg)
    else:
        # default
        student_main_menu()


if __name__ == "__main__":
    main()
