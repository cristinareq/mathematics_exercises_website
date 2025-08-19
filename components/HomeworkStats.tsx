"use client"

import { useState, useEffect } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { formatParisTime } from "@/lib/utils"

interface HomeworkStatsProps {
  user: string
  supabase: SupabaseClient
}

export default function HomeworkStats({ user, supabase }: HomeworkStatsProps) {
  const [classes, setClasses] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState<number | null>(null)
  const [homeworks, setHomeworks] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [classMembers, setClassMembers] = useState<any[]>([]) // Changed to store full user info
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchClasses()
    fetchHomeworks()
  }, [])

  useEffect(() => {
    if (selectedClass) {
      fetchClassMembers(selectedClass)
      fetchSubmissions()
    }
  }, [selectedClass])

  const fetchClasses = async () => {
    try {
      const { data } = await supabase
        .from("classes")
        .select("*")
        .eq("created_by", user)
        .order("created_at", { ascending: false })

      setClasses(data || [])
      if (data && data.length > 0) {
        setSelectedClass(data[0].id)
      }
    } catch (error) {
      console.error("Error fetching classes:", error)
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
    } finally {
      setLoading(false)
    }
  }

  const fetchClassMembers = async (classId: number) => {
    try {
      // Join with users table to get display names
      const { data } = await supabase
        .from("class_members")
        .select(`
          username,
          users!inner(username, display_name)
        `)
        .eq("class_id", classId)

      const membersWithNames =
        data?.map((member) => ({
          username: member.username,
          display_name: member.users.display_name || member.username,
        })) || []

      setClassMembers(membersWithNames)
    } catch (error) {
      console.error("Error fetching class members:", error)
    }
  }

  const fetchSubmissions = async () => {
    if (!selectedClass) return

    try {
      const homeworkIds = homeworks.map((h) => h.id)
      if (homeworkIds.length === 0) return

      const memberUsernames = classMembers.map((m) => m.username)
      if (memberUsernames.length === 0) return

      const { data } = await supabase
        .from("homework_submissions")
        .select("*")
        .in("homework_id", homeworkIds)
        .in("username", memberUsernames)
        .order("timestamp", { ascending: false })

      setSubmissions(data || [])
    } catch (error) {
      console.error("Error fetching submissions:", error)
    }
  }

  // Update submissions fetch when classMembers changes
  useEffect(() => {
    if (classMembers.length > 0) {
      fetchSubmissions()
    }
  }, [classMembers, homeworks])

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Statistiques des devoirs par classe</h2>
        <div className="text-center">Chargement...</div>
      </div>
    )
  }

  if (classes.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Statistiques des devoirs par classe</h2>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500 mb-4">Aucune classe trouvée. Affichage global par devoir.</p>

          {homeworks.length === 0 ? (
            <p className="text-gray-500">Aucun devoir créé.</p>
          ) : (
            <div className="space-y-6">
              {homeworks.map((homework) => {
                const hwSubmissions = submissions.filter((s) => s.homework_id === homework.id)

                return (
                  <div key={homework.id} className="border-b pb-4">
                    <h3 className="text-lg font-semibold mb-2">{homework.name}</h3>
                    <div className="text-sm text-gray-600 mb-2">
                      {homework.operation} • {homework.number_type_a || homework.number_type} • {homework.range_min}-
                      {homework.range_max} • {homework.duration}s
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Tentatives totales: {hwSubmissions.length}</p>

                    {hwSubmissions.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="border border-gray-300 px-4 py-2 text-left">Élève</th>
                              <th className="border border-gray-300 px-4 py-2 text-left">Score</th>
                              <th className="border border-gray-300 px-4 py-2 text-left">Durée</th>
                              <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {hwSubmissions.map((submission, index) => (
                              <tr key={index}>
                                <td className="border border-gray-300 px-4 py-2">{submission.username}</td>
                                <td className="border border-gray-300 px-4 py-2">
                                  <span
                                    className={`font-medium ${
                                      submission.correct / submission.total >= 0.8
                                        ? "text-green-600"
                                        : submission.correct / submission.total >= 0.6
                                          ? "text-yellow-600"
                                          : "text-red-600"
                                    }`}
                                  >
                                    {submission.correct}/{submission.total}
                                  </span>
                                </td>
                                <td className="border border-gray-300 px-4 py-2">{submission.duration}s</td>
                                <td className="border border-gray-300 px-4 py-2 text-sm">
                                  {formatParisTime(submission.timestamp)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Statistiques des devoirs par classe</h2>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Choisir une classe</label>
          <select
            value={selectedClass || ""}
            onChange={(e) => setSelectedClass(Number.parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} (#{cls.id})
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-500 mt-1">Élèves dans la classe: {classMembers.length}</p>
        </div>

        {homeworks.length === 0 ? (
          <p className="text-gray-500">Aucun devoir créé.</p>
        ) : (
          <div className="space-y-6">
            {homeworks.map((homework) => {
              const hwSubmissions = submissions.filter((s) => s.homework_id === homework.id)
              const completedStudents = new Set(hwSubmissions.map((s) => s.username))

              return (
                <div key={homework.id} className="border-b pb-6">
                  <h3 className="text-lg font-semibold mb-2">{homework.name}</h3>
                  <div className="text-sm text-gray-600 mb-2">
                    {homework.operation} • {homework.number_type_a || homework.number_type} • {homework.range_min}-
                    {homework.range_max} • {homework.duration}s
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Complété par {completedStudents.size}/{classMembers.length} élèves
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">Élève</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Tentatives</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Dernier score</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Dernière tentative</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classMembers.map((member) => {
                          const studentSubmissions = hwSubmissions.filter((s) => s.username === member.username)
                          const lastSubmission = studentSubmissions[0] // Most recent

                          return (
                            <tr key={member.username}>
                              <td className="border border-gray-300 px-4 py-2 font-medium">
                                {member.display_name}
                                <div className="text-xs text-gray-500">({member.username})</div>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">{studentSubmissions.length}</td>
                              <td className="border border-gray-300 px-4 py-2">
                                {lastSubmission ? (
                                  <span
                                    className={`font-medium ${
                                      lastSubmission.correct / lastSubmission.total >= 0.8
                                        ? "text-green-600"
                                        : lastSubmission.correct / lastSubmission.total >= 0.6
                                          ? "text-yellow-600"
                                          : "text-red-600"
                                    }`}
                                  >
                                    {lastSubmission.correct}/{lastSubmission.total}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="border border-gray-300 px-4 py-2 text-sm">
                                {lastSubmission ? (
                                  formatParisTime(lastSubmission.timestamp)
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
