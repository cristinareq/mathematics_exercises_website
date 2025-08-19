"use client"

import type React from "react"

import { useState, useEffect } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { OPERATIONS, NUMBER_TYPES, COMPARISON_OPTIONS } from "@/lib/types"
import { formatParisTime } from "@/lib/utils"

interface CreateHomeworkProps {
  user: string
  supabase: SupabaseClient
}

export default function CreateHomework({ user, supabase }: CreateHomeworkProps) {
  const [name, setName] = useState(`Devoir ${new Date().toLocaleDateString("fr-FR")}`)
  const [operation, setOperation] = useState(OPERATIONS[0])
  const [numberTypeA, setNumberTypeA] = useState(NUMBER_TYPES[0])
  const [numberTypeB, setNumberTypeB] = useState(NUMBER_TYPES[0])
  const [rangeMinA, setRangeMinA] = useState(1)
  const [rangeMaxA, setRangeMaxA] = useState(10)
  const [rangeMinB, setRangeMinB] = useState(1)
  const [rangeMaxB, setRangeMaxB] = useState(10)
  const [comparison, setComparison] = useState("any")
  const [duration, setDuration] = useState(180)
  const [scope, setScope] = useState<"all" | "classes" | "students">("all")
  const [selectedClasses, setSelectedClasses] = useState<number[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [students, setStudents] = useState<string[]>([])
  const [homeworks, setHomeworks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchClasses()
    fetchStudents()
    fetchHomeworks()
  }, [])

  const fetchClasses = async () => {
    try {
      const { data } = await supabase
        .from("classes")
        .select("*")
        .eq("created_by", user)
        .order("created_at", { ascending: false })

      setClasses(data || [])
    } catch (error) {
      console.error("Error fetching classes:", error)
    }
  }

  const fetchStudents = async () => {
    try {
      // Get all students from teacher's classes
      const { data: classData } = await supabase.from("classes").select("id").eq("created_by", user)

      if (!classData || classData.length === 0) {
        setStudents([])
        return
      }

      const classIds = classData.map((c) => c.id)
      const { data: memberData } = await supabase.from("class_members").select("username").in("class_id", classIds)

      const uniqueStudents = [...new Set(memberData?.map((m) => m.username) || [])]
      setStudents(uniqueStudents.sort())
    } catch (error) {
      console.error("Error fetching students:", error)
    }
  }

  const fetchHomeworks = async () => {
    try {
      const { data } = await supabase
        .from("homeworks")
        .select("*")
        .eq("created_by", user)
        .order("created_at", { ascending: false })

      setHomeworks(data || [])
    } catch (error) {
      console.error("Error fetching homeworks:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rangeMaxA < rangeMinA || rangeMaxB < rangeMinB) {
      alert("Les valeurs maximales doivent être supérieures ou égales aux minimales.")
      return
    }

    if (scope === "classes" && selectedClasses.length === 0) {
      alert("Veuillez sélectionner au moins une classe.")
      return
    }

    if (scope === "students" && selectedStudents.length === 0) {
      alert("Veuillez sélectionner au moins un élève.")
      return
    }

    setLoading(true)

    try {
      // Create homework
      const { data: homeworkData, error: homeworkError } = await supabase
        .from("homeworks")
        .insert({
          name,
          operation,
          number_type_a: numberTypeA,
          number_type_b: numberTypeB,
          range_min: rangeMinA,
          range_max: rangeMaxA,
          range_min_b: rangeMinB,
          range_max_b: rangeMaxB,
          comparison_type: comparison,
          duration,
          created_by: user,
        })
        .select()
        .single()

      if (homeworkError) throw homeworkError

      const homeworkId = homeworkData.id

      // Create assignments if needed
      if (scope !== "all") {
        const assignments = []

        if (scope === "classes") {
          for (const classId of selectedClasses) {
            assignments.push({
              homework_id: homeworkId,
              class_id: classId,
              created_by: user,
            })
          }
        } else if (scope === "students") {
          for (const studentUsername of selectedStudents) {
            assignments.push({
              homework_id: homeworkId,
              username: studentUsername,
              created_by: user,
            })
          }
        }

        if (assignments.length > 0) {
          const { error: assignmentError } = await supabase.from("homework_assignments").insert(assignments)

          if (assignmentError) throw assignmentError
        }
      }

      alert("Devoir créé avec succès !")

      // Reset form
      setName(`Devoir ${new Date().toLocaleDateString("fr-FR")}`)
      setScope("all")
      setSelectedClasses([])
      setSelectedStudents([])

      // Refresh homeworks list
      fetchHomeworks()
    } catch (error) {
      console.error("Error creating homework:", error)
      alert("Erreur lors de la création du devoir.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Créer un devoir</h2>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nom du devoir</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

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
              <h3 className="text-lg font-medium text-gray-900">Variable A</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type de nombres A</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min A</label>
                  <input
                    type="number"
                    value={rangeMinA}
                    onChange={(e) => setRangeMinA(Number.parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max A</label>
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
              <h3 className="text-lg font-medium text-gray-900">Variable B</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type de nombres B</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min B</label>
                  <input
                    type="number"
                    value={rangeMinB}
                    onChange={(e) => setRangeMinB(Number.parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max B</label>
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

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Attribution du devoir</h3>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="all"
                  checked={scope === "all"}
                  onChange={(e) => setScope(e.target.value as "all")}
                  className="mr-2"
                />
                Tous les élèves (devoir global)
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="classes"
                  checked={scope === "classes"}
                  onChange={(e) => setScope(e.target.value as "classes")}
                  className="mr-2"
                />
                Classes spécifiques
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="students"
                  checked={scope === "students"}
                  onChange={(e) => setScope(e.target.value as "students")}
                  className="mr-2"
                />
                Élèves spécifiques
              </label>
            </div>

            {scope === "classes" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sélectionner les classes</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3">
                  {classes.map((cls) => (
                    <label key={cls.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(cls.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedClasses([...selectedClasses, cls.id])
                          } else {
                            setSelectedClasses(selectedClasses.filter((id) => id !== cls.id))
                          }
                        }}
                        className="mr-2"
                      />
                      {cls.name}
                    </label>
                  ))}
                </div>
                {classes.length === 0 && (
                  <p className="text-sm text-gray-500">Aucune classe trouvée. Créez d'abord une classe.</p>
                )}
              </div>
            )}

            {scope === "students" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sélectionner les élèves</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3">
                  {students.map((student) => (
                    <label key={student} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudents([...selectedStudents, student])
                          } else {
                            setSelectedStudents(selectedStudents.filter((s) => s !== student))
                          }
                        }}
                        className="mr-2"
                      />
                      {student}
                    </label>
                  ))}
                </div>
                {students.length === 0 && <p className="text-sm text-gray-500">Aucun élève trouvé dans vos classes.</p>}
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-md text-lg font-medium"
            >
              {loading ? "Création..." : "Créer le devoir"}
            </button>
          </div>
        </form>
      </div>

      {/* List of existing homeworks */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-4">Mes devoirs créés</h3>
        {homeworks.length === 0 ? (
          <div className="bg-white p-6 rounded-lg shadow text-center">
            <p className="text-gray-500">Aucun devoir créé pour le moment.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nom
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Opération
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Types
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plages
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Durée
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Créé le
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {homeworks.map((homework) => (
                    <tr key={homework.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{homework.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{homework.operation}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {homework.number_type_a || homework.number_type} /{" "}
                        {homework.number_type_b || homework.number_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {homework.range_min}-{homework.range_max} / {homework.range_min_b || homework.range_min}-
                        {homework.range_max_b || homework.range_max}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{homework.duration}s</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatParisTime(homework.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
