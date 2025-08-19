"use client"

import { useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import QuizEngine from "./QuizEngine"
import {
  OPERATIONS,
  NUMBER_TYPES,
  COMPARISON_OPTIONS,
  DEFAULT_TRAINING_DURATION,
  DEFAULT_RANGE_MIN,
  DEFAULT_RANGE_MAX,
  type QuizConfig,
} from "@/lib/types"
import { generateQuestions } from "@/lib/utils"

interface TrainingSetupProps {
  user: string
  supabase: SupabaseClient
  onBack: () => void
  setView: (view: string) => void
}

export default function TrainingSetup({ user, supabase, onBack, setView }: TrainingSetupProps) {
  const [operation, setOperation] = useState(OPERATIONS[0])
  const [numberTypeA, setNumberTypeA] = useState(NUMBER_TYPES[0])
  const [numberTypeB, setNumberTypeB] = useState(NUMBER_TYPES[0])
  const [rangeMinA, setRangeMinA] = useState(DEFAULT_RANGE_MIN)
  const [rangeMaxA, setRangeMaxA] = useState(DEFAULT_RANGE_MAX)
  const [rangeMinB, setRangeMinB] = useState(DEFAULT_RANGE_MIN)
  const [rangeMaxB, setRangeMaxB] = useState(DEFAULT_RANGE_MAX)
  const [comparison, setComparison] = useState("any")
  const [duration, setDuration] = useState(DEFAULT_TRAINING_DURATION)
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null)
  const [questions, setQuestions] = useState<any[]>([])

  const handleStart = () => {
    if (rangeMaxA < rangeMinA || rangeMaxB < rangeMinB) {
      alert("Les valeurs maximales doivent être supérieures ou égales aux minimales.")
      return
    }

    const config: QuizConfig = {
      mode: "training",
      operation,
      numberTypeA,
      numberTypeB,
      rangeMinA,
      rangeMaxA,
      rangeMinB,
      rangeMaxB,
      comparison: comparison as "any" | "a_greater" | "a_smaller",
      duration,
    }

    const generatedQuestions = generateQuestions(config, 150)
    setQuizConfig(config)
    setQuestions(generatedQuestions)
    setQuizStarted(true)
  }

  const handleQuizComplete = (score: { correct: number; total: number; errors: any[] }) => {
    setQuizStarted(false)
    // Could show a completion screen here
    setTimeout(() => {
      onBack()
    }, 3000)
  }

  if (quizStarted && quizConfig && questions.length > 0) {
    return (
      <QuizEngine
        user={user}
        supabase={supabase}
        questions={questions}
        config={quizConfig}
        onComplete={handleQuizComplete}
        onBack={() => setQuizStarted(false)}
      />
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Entraînement libre - Paramètres</h1>
        <button onClick={onBack} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md">
          ← Retour
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type d'opération</label>
          <select
            value={operation}
            onChange={(e) => setOperation(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {OPERATIONS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Variable A (premier nombre)</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type de nombres pour A</label>
              <select
                value={numberTypeA}
                onChange={(e) => setNumberTypeA(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {NUMBER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valeur min A</label>
                <input
                  type="number"
                  value={rangeMinA}
                  onChange={(e) => setRangeMinA(Number.parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valeur max A</label>
                <input
                  type="number"
                  value={rangeMaxA}
                  onChange={(e) => setRangeMaxA(Number.parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Variable B (deuxième nombre)</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type de nombres pour B</label>
              <select
                value={numberTypeB}
                onChange={(e) => setNumberTypeB(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {NUMBER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valeur min B</label>
                <input
                  type="number"
                  value={rangeMinB}
                  onChange={(e) => setRangeMinB(Number.parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valeur max B</label>
                <input
                  type="number"
                  value={rangeMaxB}
                  onChange={(e) => setRangeMaxB(Number.parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Comparaison A vs B</label>
            <select
              value={comparison}
              onChange={(e) => setComparison(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {COMPARISON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Durée (secondes)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number.parseInt(e.target.value))}
              step={15}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleStart}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-md text-lg font-medium"
          >
            Commencer l'entraînement
          </button>
        </div>
      </div>
    </div>
  )
}
