import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Simple Fraction class implementation
class Fraction {
  n: number // numerator
  d: number // denominator

  constructor(numerator: number | string, denominator = 1) {
    if (typeof numerator === "string") {
      if (numerator.includes("/")) {
        const parts = numerator.split("/")
        this.n = Number.parseInt(parts[0])
        this.d = Number.parseInt(parts[1])
      } else {
        this.n = Number.parseFloat(numerator)
        this.d = 1
      }
    } else {
      this.n = numerator
      this.d = denominator
    }

    // Simplify the fraction
    this.simplify()
  }

  private gcd(a: number, b: number): number {
    a = Math.abs(a)
    b = Math.abs(b)
    while (b !== 0) {
      const temp = b
      b = a % b
      a = temp
    }
    return a
  }

  private simplify(): void {
    if (this.d === 0) throw new Error("Denominator cannot be zero")

    const gcd = this.gcd(this.n, this.d)
    this.n = this.n / gcd
    this.d = this.d / gcd

    // Keep denominator positive
    if (this.d < 0) {
      this.n = -this.n
      this.d = -this.d
    }
  }

  add(other: Fraction): Fraction {
    return new Fraction(this.n * other.d + other.n * this.d, this.d * other.d)
  }

  sub(other: Fraction): Fraction {
    return new Fraction(this.n * other.d - other.n * this.d, this.d * other.d)
  }

  mul(other: Fraction): Fraction {
    return new Fraction(this.n * other.n, this.d * other.d)
  }

  div(other: Fraction): Fraction {
    return new Fraction(this.n * other.d, this.d * other.n)
  }

  equals(other: Fraction): boolean {
    return this.n * other.d === other.n * this.d
  }

  compare(other: Fraction): number {
    const diff = this.n * other.d - other.n * this.d
    return diff > 0 ? 1 : diff < 0 ? -1 : 0
  }

  valueOf(): number {
    return this.n / this.d
  }

  toFraction(): string {
    return this.d === 1 ? this.n.toString() : `${this.n}/${this.d}`
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatParisTime(isoString: string): string {
  if (!isoString) return "-"
  try {
    const date = new Date(isoString)
    return date
      .toLocaleString("fr-FR", {
        timeZone: "Europe/Paris",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(",", "")
  } catch {
    return isoString
  }
}

export function toFraction(text: string): Fraction | null {
  const s = (text || "").trim().replace(/\s/g, "")
  if (!s) return null

  try {
    // Handle negative fractions
    if (s.includes("/")) {
      const parts = s.split("/")
      if (parts.length === 2) {
        const num = Number.parseInt(parts[0])
        const den = Number.parseInt(parts[1])
        if (den === 0) return null
        return new Fraction(num, den)
      }
    }
    return new Fraction(Number.parseFloat(s))
  } catch {
    return null
  }
}

export function fractionToPretty(fr: Fraction): string {
  if (fr.d === 1) return fr.n.toString()
  return `${fr.n}/${fr.d}`
}

export function opSymbol(op: string): string {
  const symbols = {
    Multiply: "×",
    Divide: "÷",
    Sum: "+",
    Negate: "−",
  }
  return symbols[op as keyof typeof symbols] || "?"
}

export function applyOperation(a: Fraction, b: Fraction, operation: string): Fraction {
  switch (operation) {
    case "Multiply":
      return a.mul(b)
    case "Divide":
      return a.div(b)
    case "Sum":
      return a.add(b)
    case "Negate":
      return a.sub(b)
    default:
      throw new Error(`Unknown operation: ${operation}`)
  }
}

export function generateOperand(numberType: string, min: number, max: number): { value: Fraction; display: string } {
  if (numberType === "Entiers positifs") {
    const value = Math.floor(Math.random() * (max - min + 1)) + min
    return { value: new Fraction(value), display: value.toString() }
  }

  if (numberType === "Entiers négatifs") {
    const value = -(Math.floor(Math.random() * (max - min + 1)) + min)
    return { value: new Fraction(value), display: value.toString() }
  }

  if (numberType === "Fractions") {
    const den = Math.floor(Math.random() * (Math.min(max, 10) - 2)) + 2
    const num = Math.floor(Math.random() * (max - min + 1)) + min

    // Ensure we don't get improper fractions that are whole numbers
    const finalNum = num
    let finalDen = den

    // Avoid cases where num is divisible by den
    while (finalNum % finalDen === 0 && finalDen > 1) {
      finalDen = Math.floor(Math.random() * (Math.min(max, 10) - 2)) + 2
    }

    const value = new Fraction(finalNum, finalDen)
    return { value, display: `${finalNum}/${finalDen}` }
  }

  throw new Error(`Invalid number type: ${numberType}`)
}

export function generateQuestion(config: any): any {
  const aResult = generateOperand(config.numberTypeA, config.rangeMinA, config.rangeMaxA)
  let bResult: { value: Fraction; display: string }

  // For division, avoid zero divisors
  if (config.operation === "Divide") {
    do {
      bResult = generateOperand(config.numberTypeB, config.rangeMinB, config.rangeMaxB)
    } while (bResult.value.equals(new Fraction(0)))
  } else {
    bResult = generateOperand(config.numberTypeB, config.rangeMinB, config.rangeMaxB)
  }

  let a = aResult.value
  let b = bResult.value
  let aDisplay = aResult.display
  let bDisplay = bResult.display

  // Apply comparison constraint
  if (config.comparison === "a_greater" && a.compare(b) <= 0) {
    ;[a, b] = [b, a]
    ;[aDisplay, bDisplay] = [bDisplay, aDisplay]
  } else if (config.comparison === "a_smaller" && a.compare(b) >= 0) {
    ;[a, b] = [b, a]
    ;[aDisplay, bDisplay] = [bDisplay, aDisplay]
  }

  const result = applyOperation(a, b, config.operation)
  const prompt = `${aDisplay} ${opSymbol(config.operation)} ${bDisplay}`
  const key = `${config.operation}|${a.toFraction()}|${b.toFraction()}|${config.numberTypeA}|${config.numberTypeB}`

  return {
    a: a.valueOf(),
    b: b.valueOf(),
    op: config.operation,
    numberTypeA: config.numberTypeA,
    numberTypeB: config.numberTypeB,
    key,
    prompt,
    correct: result.valueOf(),
    correctFraction: result,
    aFraction: a,
    bFraction: b,
  }
}

export function generateQuestions(config: any, count = 100): any[] {
  const questions: any[] = []
  for (let i = 0; i < count; i++) {
    questions.push(generateQuestion(config))
  }
  return questions
}
