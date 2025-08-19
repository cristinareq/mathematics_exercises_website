export interface QuizConfig {
  mode: "training" | "review" | "homework"
  operation: string
  numberTypeA: string
  numberTypeB: string
  rangeMinA: number
  rangeMaxA: number
  rangeMinB: number
  rangeMaxB: number
  comparison: "any" | "a_greater" | "a_smaller"
  duration: number
  homeworkId?: number
}

export interface Question {
  a: number
  b: number
  op: string
  numberTypeA: string
  numberTypeB: string
  key: string
  prompt: string
  correct: number
  correctFraction?: any
  aFraction?: any
  bFraction?: any
}

export const OPERATIONS = ["Multiply", "Divide", "Sum", "Negate"]
export const NUMBER_TYPES = ["Entiers positifs", "Entiers négatifs", "Fractions"]
export const COMPARISON_OPTIONS = [
  { value: "any", label: "Peu importe" },
  { value: "a_greater", label: "a > b" },
  { value: "a_smaller", label: "a < b" },
]

export const DEFAULT_TRAINING_DURATION = 180
export const DEFAULT_RANGE_MIN = 1
export const DEFAULT_RANGE_MAX = 10
