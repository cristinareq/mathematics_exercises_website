"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import LoginForm from "@/components/LoginForm"
import StudentDashboard from "@/components/StudentDashboard"
import TeacherDashboard from "@/components/TeacherDashboard"

// Get environment variables with fallback for development
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://brvvbowvccgbaodtbnxo.supabase.co"
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJydnZib3d2Y2NnYmFvZHRibnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5ODgxMzcsImV4cCI6MjA2NzU2NDEzN30.lwmDZ5X1IYZnLEdRaZg3w-JN1uKkPDDHR2e7rCDpbi8"

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables. Please check your .env.local file.")
}

const supabase = createClient(supabaseUrl, supabaseKey)

export default function Home() {
  const [user, setUser] = useState<string | null>(null)
  const [isTeacher, setIsTeacher] = useState(false)
  const [view, setView] = useState("dashboard")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem("math_trainer_user")
    const savedIsTeacher = localStorage.getItem("math_trainer_is_teacher")

    if (savedUser) {
      setUser(savedUser)
      setIsTeacher(savedIsTeacher === "true")
    }
    setLoading(false)
  }, [])

  const handleLogin = (username: string, isTeacherUser: boolean) => {
    setUser(username)
    setIsTeacher(isTeacherUser)
    localStorage.setItem("math_trainer_user", username)
    localStorage.setItem("math_trainer_is_teacher", isTeacherUser.toString())
    setView("dashboard")
  }

  const handleLogout = () => {
    setUser(null)
    setIsTeacher(false)
    localStorage.removeItem("math_trainer_user")
    localStorage.removeItem("math_trainer_is_teacher")
    setView("dashboard")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Chargement...</div>
      </div>
    )
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} supabase={supabase} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">🧮 Math Trainer</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Connecté en tant que {user} {isTeacher ? "(Enseignant)" : "(Élève)"}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isTeacher ? (
          <TeacherDashboard user={user} supabase={supabase} view={view} setView={setView} />
        ) : (
          <StudentDashboard user={user} supabase={supabase} view={view} setView={setView} />
        )}
      </main>
    </div>
  )
}
