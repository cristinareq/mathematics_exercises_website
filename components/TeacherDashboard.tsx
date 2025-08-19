"use client"

import { useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import CreateHomework from "./CreateHomework"
import TrainingStats from "./TrainingStats"
import HomeworkStats from "./HomeworkStats"

interface TeacherDashboardProps {
  user: string
  supabase: SupabaseClient
  view: string
  setView: (view: string) => void
}

export default function TeacherDashboard({ user, supabase, view, setView }: TeacherDashboardProps) {
  const [activeTab, setActiveTab] = useState("create")

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tableau de bord - Enseignant</h1>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("create")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "create"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Créer un devoir
          </button>
          <button
            onClick={() => setActiveTab("training")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "training"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Stats d'entraînement
          </button>
          <button
            onClick={() => setActiveTab("homework")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "homework"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Stats devoirs par classe
          </button>
        </nav>
      </div>

      <div className="mt-8">
        {activeTab === "create" && <CreateHomework user={user} supabase={supabase} />}
        {activeTab === "training" && <TrainingStats user={user} supabase={supabase} />}
        {activeTab === "homework" && <HomeworkStats user={user} supabase={supabase} />}
      </div>
    </div>
  )
}
