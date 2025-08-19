"use client"

import { useState, useEffect } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import TrainingSetup from "./TrainingSetup"
import ReviewErrors from "./ReviewErrors"
import StudentHomeworks from "./StudentHomeworks"

interface StudentDashboardProps {
  user: string
  supabase: SupabaseClient
  view: string
  setView: (view: string) => void
}

export default function StudentDashboard({ user, supabase, view, setView }: StudentDashboardProps) {
  const [pendingErrors, setPendingErrors] = useState(0)

  useEffect(() => {
    fetchPendingErrors()
  }, [])

  const fetchPendingErrors = async () => {
    try {
      const { count } = await supabase
        .from("errors")
        .select("id", { count: "exact" })
        .eq("username", user)
        .eq("corrected", false)

      setPendingErrors(count || 0)
    } catch (error) {
      console.error("Error fetching pending errors:", error)
    }
  }

  if (view === "student_training_setup") {
    return <TrainingSetup user={user} supabase={supabase} onBack={() => setView("dashboard")} setView={setView} />
  }

  if (view === "student_review") {
    return <ReviewErrors user={user} supabase={supabase} onBack={() => setView("dashboard")} setView={setView} />
  }

  if (view === "student_homeworks") {
    return <StudentHomeworks user={user} supabase={supabase} onBack={() => setView("dashboard")} setView={setView} />
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Bienvenue, {user.charAt(0).toUpperCase() + user.slice(1)}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => setView("student_training_setup")}
          className="bg-blue-500 hover:bg-blue-600 text-white p-6 rounded-lg text-center transition-colors"
        >
          <div className="text-2xl mb-2">📚</div>
          <div className="text-lg font-semibold">Entraînement libre</div>
          <div className="text-sm opacity-90">Choisissez vos paramètres</div>
        </button>

        <button
          onClick={() => setView("student_review")}
          disabled={pendingErrors === 0}
          className={`p-6 rounded-lg text-center transition-colors ${
            pendingErrors === 0
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-orange-500 hover:bg-orange-600 text-white"
          }`}
        >
          <div className="text-2xl mb-2">🔄</div>
          <div className="text-lg font-semibold">Revoir erreurs</div>
          <div className="text-sm opacity-90">
            {pendingErrors === 0 ? "Aucune erreur à réviser" : `${pendingErrors} erreur(s) à réviser`}
          </div>
        </button>

        <button
          onClick={() => setView("student_homeworks")}
          className="bg-green-500 hover:bg-green-600 text-white p-6 rounded-lg text-center transition-colors"
        >
          <div className="text-2xl mb-2">📝</div>
          <div className="text-lg font-semibold">Devoirs</div>
          <div className="text-sm opacity-90">Voir mes devoirs</div>
        </button>
      </div>
    </div>
  )
}
