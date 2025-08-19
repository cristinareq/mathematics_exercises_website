"use client"

import { useState, useEffect } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import QuizEngine from "./QuizEngine"
import type { Question, QuizConfig } from "@/lib/types"
import { toFraction, applyOperation, opSymbol } from "@/lib/utils"

interface ReviewErrorsProps {
  user: string
  supabase: SupabaseClient
  onBack: () => void
  setView: (view: string) => void
}

export default function ReviewErrors({ user, supabase, onBack, setView }: ReviewErrorsProps) {
  const [errors, setErrors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [quizStarted, setQuizStarted] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [duration, setDuration] = useState(120)

  useEffect(() => {
    fetchErrors()
  }, [])

  const fetchErrors = async () => {
    try {
      const { data, error } = await supabase
        .from("errors")
        .select("*")
        .eq("username", user)
        .eq("corrected", false)
        .order("timestamp", { ascending: false })

      if (error) throw error
      setErrors(data || [])
    } catch (error) {
      console.error("Error fetching errors:", error)
    } finally {
      setLoading(false)
    }
  }

  const convertErrorsToQuestions = (): Question[] => {
    const questions: Question[] = []

    for (const error of errors) {
      try {
        // Try to parse from question_key first
        if (error.question_key) {
          const parts = error.question_key.split("|")
          if (parts.length >= 4) {
            const [op, aStr, bStr, typeA, typeB] = parts

            const aFrac = toFraction(aStr)
            const bFrac = toFraction(bStr)

            if (aFrac && bFrac) {
              const result = applyOperation(aFrac, bFrac, op)
              const prompt = `${aStr} ${opSymbol(op)} ${bStr}`

              questions.push({
                a: aFrac.valueOf(),
                b: bFrac.valueOf(),
                op,
                numberTypeA: typeA || "Entiers positifs",
                numberTypeB: typeB || "Entiers positifs",
                key: error.question_key,
                prompt,
                correct: result.valueOf(),
                correctFraction: result,
                aFraction: aFrac,
                bFraction: bFrac,
              })
              continue
            }
          }
        }

        // Fallback: parse from question text
        if (error.question) {
          const parts = error.question.split(" ")
          if (parts.length >= 3) {
            const aStr = parts[0]
            const symbol = parts[1]
            const bStr = parts[2]

            const symbolToOp: { [key: string]: string } = {
              "×": "Multiply",
              x: "Multiply",
              X: "Multiply",
              "÷": "Divide",
              "+": "Sum",
              "−": "Negate",
              "-": "Negate",
            }

            const op = symbolToOp[symbol] || "Sum"
            const aFrac = toFraction(aStr)
            const bFrac = toFraction(bStr)

            if (aFrac && bFrac) {
              const result = applyOperation(aFrac, bFrac, op)

              questions.push({
                a: aFrac.valueOf(),
                b: bFrac.valueOf(),
                op,
                numberTypeA: "Entiers positifs",
                numberTypeB: "Entiers positifs",
                key: `${op}|${aStr}|${bStr}|Entiers positifs|Entiers positifs`,
                prompt: error.question,
                correct: result.valueOf(),
                correctFraction: result,
                aFraction: aFrac,
                bFraction: bFrac,
              })
            }
          }
        }
      } catch (err) {
        console.error("Error parsing error:", err)
      }
    }

    return questions
  }

  const handleStartReview = () => {
    const reviewQuestions = convertErrorsToQuestions()
    if (reviewQuestions.length === 0) {
      alert("Aucune erreur exploitable trouvée.")
      return
    }

    setQuestions(reviewQuestions)
    setQuizStarted(true)
  }

  const handleQuizComplete = (score: { correct: number; total: number; errors: any[] }) => {
    setQuizStarted(false)
    // Refresh errors list
    fetchErrors()
    setTimeout(() => {
      onBack()
    }, 3000)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <div className="text-lg">Chargement des erreurs...</div>
        </div>
      </div>
    )
  }

  if (quizStarted && questions.length > 0) {
    const config: QuizConfig = {
      mode: "review",
      operation: "review",
      numberTypeA: "review",
      numberTypeB: "review",
      rangeMinA: 0,
      rangeMaxA: 0,
      rangeMinB: 0,
      rangeMaxB: 0,
      comparison: "any",
      duration,
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
        <h1 className="text-3xl font-bold text-gray-900">Revoir mes erreurs</h1>
        <button onClick={onBack} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md">
          ← Retour
        </button>
      </div>

      {errors.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-green-600 mb-2">Félicitations !</h2>
          <p className="text-gray-600">Aucune erreur à réviser pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">
              {errors.length} erreur{errors.length > 1 ? "s" : ""} à réviser
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Durée de révision (secondes)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number.parseInt(e.target.value))}
                step={15}
                min={30}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={handleStartReview}
              className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-md text-lg font-medium"
            >
              Commencer la révision
            </button>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Aperçu de tes erreurs :</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left">Question</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Ta réponse</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Bonne réponse</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.slice(0, 10).map((error, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 px-4 py-2">{error.question}</td>
                      <td className="border border-gray-300 px-4 py-2 text-red-600">{error.user_answer_text || "-"}</td>
                      <td className="border border-gray-300 px-4 py-2 text-green-600">
                        {error.correct_answer_text || "-"}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-sm text-gray-500">{error.readable_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {errors.length > 10 && (
              <p className="text-sm text-gray-500 mt-2">... et {errors.length - 10} autres erreurs</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
