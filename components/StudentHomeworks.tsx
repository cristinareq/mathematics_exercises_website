"use client"

import { useState, useEffect } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import QuizEngine from "./QuizEngine"
import type { QuizConfig } from "@/lib/types"
import { generateQuestions, formatParisTime } from "@/lib/utils"

interface StudentHomeworksProps {
  user: string
  supabase: SupabaseClient
  onBack: () => void
  setView: (view: string) => void
}

export default function StudentHomeworks({ user, supabase, onBack, setView }: StudentHomeworksProps) {
  const [homeworks, setHomeworks] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<{ [key: number]: any[] }>({})
  const [loading, setLoading] = useState(true)
  const [quizStarted, setQuizStarted] = useState(false)
  const [currentHomework, setCurrentHomework] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])

  useEffect(() => {
    fetchHomeworks()
  }, [])

  const fetchHomeworks = async () => {
    try {
      // Get student's classes
      const { data: classMembers } = await supabase.from("class_members").select("class_id").eq("username", user)

      const classIds = classMembers?.map((cm) => cm.class_id) || []

      // Get homework assignments
      const { data: assignments } = await supabase
        .from("homework_assignments")
        .select("homework_id")
        .or(`username.eq.${user},class_id.in.(${classIds.join(",")})`)

      const assignedHomeworkIds = assignments?.map((a) => a.homework_id) || []

      // Get global homeworks (no assignments)
      const { data: allHomeworks } = await supabase
        .from("homeworks")
        .select("*")
        .order("created_at", { ascending: false })

      // Filter homeworks: assigned ones + global ones
      const { data: assignmentsList } = await supabase.from("homework_assignments").select("homework_id")

      const homeworksWithAssignments = new Set(assignmentsList?.map((a) => a.homework_id) || [])

      const availableHomeworks =
        allHomeworks?.filter((hw) => assignedHomeworkIds.includes(hw.id) || !homeworksWithAssignments.has(hw.id)) || []

      setHomeworks(availableHomeworks)

      // Get submissions
      const { data: submissionsData } = await supabase
        .from("homework_submissions")
        .select("*")
        .eq("username", user)
        .order("timestamp", { ascending: false })

      const submissionsByHomework: { [key: number]: any[] } = {}
      submissionsData?.forEach((sub) => {
        if (!submissionsByHomework[sub.homework_id]) {
          submissionsByHomework[sub.homework_id] = []
        }
        submissionsByHomework[sub.homework_id].push(sub)
      })

      setSubmissions(submissionsByHomework)
    } catch (error) {
      console.error("Error fetching homeworks:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartHomework = (homework: any) => {
    const config: QuizConfig = {
      mode: "homework",
      operation: homework.operation,
      numberTypeA: homework.number_type_a || homework.number_type || "Entiers positifs",
      numberTypeB: homework.number_type_b || homework.number_type || "Entiers positifs",
      rangeMinA: homework.range_min || 1,
      rangeMaxA: homework.range_max || 10,
      rangeMinB: homework.range_min_b || homework.range_min || 1,
      rangeMaxB: homework.range_max_b || homework.range_max || 10,
      comparison: homework.comparison_type || "any",
      duration: homework.duration,
      homeworkId: homework.id,
    }

    const generatedQuestions = generateQuestions(config, 200)
    setCurrentHomework(homework)
    setQuestions(generatedQuestions)
    setQuizStarted(true)
  }

  const handleQuizComplete = (score: { correct: number; total: number; errors: any[] }) => {
    setQuizStarted(false)
    setCurrentHomework(null)
    // Refresh homeworks to update submission status
    fetchHomeworks()
    setTimeout(() => {
      onBack()
    }, 3000)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <div className="text-lg">Chargement des devoirs...</div>
        </div>
      </div>
    )
  }

  if (quizStarted && currentHomework && questions.length > 0) {
    const config: QuizConfig = {
      mode: "homework",
      operation: currentHomework.operation,
      numberTypeA: currentHomework.number_type_a || currentHomework.number_type || "Entiers positifs",
      numberTypeB: currentHomework.number_type_b || currentHomework.number_type || "Entiers positifs",
      rangeMinA: currentHomework.range_min || 1,
      rangeMaxA: currentHomework.range_max || 10,
      rangeMinB: currentHomework.range_min_b || currentHomework.range_min || 1,
      rangeMaxB: currentHomework.range_max_b || currentHomework.range_max || 10,
      comparison: currentHomework.comparison_type || "any",
      duration: currentHomework.duration,
      homeworkId: currentHomework.id,
    }

    return (
      <QuizEngine
        user={user}
        supabase={supabase}
        questions={questions}
        config={config}
        onComplete={handleQuizComplete}
        onBack={() => setQuizStarted(false)}
      />
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Mes devoirs</h1>
        <button onClick={onBack} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md">
          ← Retour
        </button>
      </div>

      {homeworks.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow text-center">
          <div className="text-6xl mb-4">📝</div>
          <h2 className="text-2xl font-bold text-gray-600 mb-2">Aucun devoir disponible</h2>
          <p className="text-gray-500">Aucun devoir n'est disponible pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {homeworks.map((homework) => {
            const hwSubmissions = submissions[homework.id] || []
            const lastSubmission = hwSubmissions[0] // Most recent

            return (
              <div key={homework.id} className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{homework.name}</h3>
                    <div className="text-sm text-gray-600 mt-1">
                      <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2">
                        {homework.operation}
                      </span>
                      <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded mr-2">
                        {homework.number_type_a || homework.number_type || "Entiers positifs"}
                      </span>
                      <span className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded mr-2">
                        {homework.range_min || 1}-{homework.range_max || 10}
                      </span>
                      <span className="inline-block bg-orange-100 text-orange-800 px-2 py-1 rounded">
                        {homework.duration}s
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => handleStartHomework(homework)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium"
                    >
                      Démarrer
                    </button>
                  </div>
                </div>

                {hwSubmissions.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Mes tentatives ({hwSubmissions.length})</h4>
                    {lastSubmission && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Dernière tentative :</span>{" "}
                        <span className="text-green-600 font-medium">
                          {lastSubmission.correct}/{lastSubmission.total}
                        </span>{" "}
                        le {formatParisTime(lastSubmission.timestamp)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
