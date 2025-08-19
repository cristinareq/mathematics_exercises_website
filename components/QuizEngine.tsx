"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Question, QuizConfig } from "@/lib/types"
import { toFraction, fractionToPretty } from "@/lib/utils"

interface QuizEngineProps {
  user: string
  supabase: SupabaseClient
  questions: Question[]
  config: QuizConfig
  onComplete: (score: { correct: number; total: number; errors: any[] }) => void
  onBack: () => void
}

export default function QuizEngine({ user, supabase, questions, config, onComplete, onBack }: QuizEngineProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [total, setTotal] = useState(0)
  const [timeLeft, setTimeLeft] = useState(config.duration)
  const [answer, setAnswer] = useState("")
  const [feedback, setFeedback] = useState("")
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | "">("")
  const [sessionErrors, setSessionErrors] = useState<any[]>([])
  const [isActive, setIsActive] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (timeLeft > 0 && isActive) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0) {
      handleTimeUp()
    }
  }, [timeLeft, isActive])

  useEffect(() => {
    // Focus input when question changes
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [currentIndex])

  const handleTimeUp = async () => {
    setIsActive(false)
    await saveScore()
    onComplete({ correct, total, errors: sessionErrors })
  }

  const saveScore = async () => {
    const now = new Date().toISOString()
    const readableDate = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })

    try {
      if (config.mode === "training") {
        await supabase.from("scores").insert({
          username: user,
          timestamp: now,
          readable_date: readableDate,
          correct,
          total,
          duration: config.duration,
          tables: `op=${config.operation};typeA=${config.numberTypeA};typeB=${config.numberTypeB}`,
          quiz_mode: "training",
        })
      } else if (config.mode === "homework" && config.homeworkId) {
        await supabase.from("homework_submissions").insert({
          homework_id: config.homeworkId,
          username: user,
          timestamp: now,
          readable_date: readableDate,
          correct,
          total,
          duration: config.duration,
        })
      } else if (config.mode === "review") {
        await supabase.from("scores").insert({
          username: user,
          timestamp: now,
          readable_date: readableDate,
          correct,
          total,
          duration: config.duration,
          tables: "review_errors",
          quiz_mode: "review",
        })
      }
    } catch (error) {
      console.error("Error saving score:", error)
    }
  }

  const markErrorCorrected = async (questionKey: string) => {
    try {
      await supabase
        .from("errors")
        .update({
          corrected: true,
          corrected_at: new Date().toISOString(),
          correction_source: config.mode,
        })
        .eq("username", user)
        .eq("question_key", questionKey)
        .eq("corrected", false)
    } catch (error) {
      console.error("Error marking error as corrected:", error)
    }
  }

  const saveError = async (question: Question, userAnswer: string) => {
    const now = new Date().toISOString()
    const readableDate = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })

    try {
      await supabase.from("errors").insert({
        username: user,
        timestamp: now,
        readable_date: readableDate,
        question: question.prompt,
        correct_answer_text: fractionToPretty(question.correctFraction!),
        user_answer_text: userAnswer,
        question_key: question.key,
        number_type_a: question.numberTypeA,
        number_type_b: question.numberTypeB,
        corrected: false,
      })
    } catch (error) {
      console.error("Error saving error:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isActive) return

    const userFraction = toFraction(answer)
    const question = questions[currentIndex]

    if (!userFraction) {
      setFeedback("Veuillez entrer un nombre valide (entier, fraction a/b, ou décimal).")
      setFeedbackType("error")
      return
    }

    const isCorrect = userFraction.equals(question.correctFraction!)

    if (isCorrect) {
      setCorrect(correct + 1)
      setFeedback(`✅ Correct ! ${question.prompt} = ${fractionToPretty(question.correctFraction!)}`)
      setFeedbackType("success")

      // Mark matching errors as corrected
      if (config.mode === "training" || config.mode === "homework") {
        await markErrorCorrected(question.key)
      }
    } else {
      setFeedback(`❌ Faux. ${question.prompt} = ${fractionToPretty(question.correctFraction!)}`)
      setFeedbackType("error")

      // Save error
      await saveError(question, answer)

      // Add to session errors
      const errorRecord = {
        Question: question.prompt,
        "Ta réponse ❌": answer,
        "Bonne réponse ✅": fractionToPretty(question.correctFraction!),
      }
      setSessionErrors([...sessionErrors, errorRecord])
    }

    setTotal(total + 1)
    setAnswer("")

    // Move to next question
    setTimeout(() => {
      setCurrentIndex((currentIndex + 1) % questions.length)
      setFeedback("")
      setFeedbackType("")
    }, 1500)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  if (!isActive) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Temps écoulé !</h1>
          <div className="text-6xl font-bold text-green-600 mb-4">
            {correct}/{total}
          </div>
          <p className="text-xl text-gray-600">Score final</p>
        </div>

        {sessionErrors.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Tes erreurs durant cette session :</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left">Question</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Ta réponse</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Bonne réponse</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionErrors.map((error, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 px-4 py-2">{error.Question}</td>
                      <td className="border border-gray-300 px-4 py-2 text-red-600">{error["Ta réponse ❌"]}</td>
                      <td className="border border-gray-300 px-4 py-2 text-green-600">{error["Bonne réponse ✅"]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-center">
          <button onClick={onBack} className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-md text-lg">
            ← Retour
          </button>
        </div>
      </div>
    )
  }

  const question = questions[currentIndex]

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header with stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow text-center">
          <div className="text-2xl font-bold text-blue-600">⏳ {formatTime(timeLeft)}</div>
          <div className="text-sm text-gray-600">Temps restant</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow text-center">
          <div className="text-2xl font-bold text-green-600">
            {correct}/{total}
          </div>
          <div className="text-sm text-gray-600">Score</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow text-center">
          <div className="text-2xl font-bold text-purple-600">{config.operation}</div>
          <div className="text-sm text-gray-600">Opération</div>
        </div>
      </div>

      {/* Question */}
      <div className="bg-white p-8 rounded-lg shadow">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Combien fait {question.prompt} ?</h2>
            <input
              ref={inputRef}
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Écris ta réponse ici (ex: 12 ou 3/4)"
              className="text-2xl text-center w-full max-w-md px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
              disabled={!isActive}
            />
          </div>

          {feedback && (
            <div
              className={`text-center p-4 rounded-lg ${
                feedbackType === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              {feedback}
            </div>
          )}

          <div className="text-center">
            <button
              type="submit"
              disabled={!isActive || !answer.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg text-lg font-medium"
            >
              Soumettre
            </button>
          </div>
        </form>
      </div>

      <div className="text-center">
        <button onClick={onBack} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md">
          ← Abandonner
        </button>
      </div>
    </div>
  )
}
