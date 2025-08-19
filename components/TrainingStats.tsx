"use client"

import { useState, useEffect } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { formatParisTime } from "@/lib/utils"

interface TrainingStatsProps {
  user: string
  supabase: SupabaseClient
}

export default function TrainingStats({ user, supabase }: TrainingStatsProps) {
  const [stats, setStats] = useState<{ [key: string]: any[] }>({})
  const [userDisplayNames, setUserDisplayNames] = useState<{ [key: string]: string }>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const { data } = await supabase
        .from("scores")
        .select("*")
        .eq("quiz_mode", "training")
        .order("timestamp", { ascending: false })

      const statsByUser: { [key: string]: any[] } = {}
      const usernames = new Set<string>()

      data?.forEach((score) => {
        if (!statsByUser[score.username]) {
          statsByUser[score.username] = []
        }
        statsByUser[score.username].push(score)
        usernames.add(score.username)
      })

      setStats(statsByUser)

      // Fetch display names for all users
      if (usernames.size > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("username, display_name")
          .in("username", Array.from(usernames))

        const displayNamesMap: { [key: string]: string } = {}
        usersData?.forEach((user) => {
          displayNamesMap[user.username] = user.display_name || user.username
        })
        setUserDisplayNames(displayNamesMap)
      }
    } catch (error) {
      console.error("Error fetching training stats:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Statistiques d'entraînement</h2>
        <div className="text-center">Chargement...</div>
      </div>
    )
  }

  const usernames = Object.keys(stats).sort()

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Statistiques d'entraînement (par élève)</h2>

      {usernames.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow text-center">
          <p className="text-gray-500">Aucune donnée d'entraînement disponible.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {usernames.map((username) => {
            const userStats = stats[username]
            const displayName = userDisplayNames[username] || username
            const maxScore = Math.max(...userStats.map((s) => s.correct))
            const avgScore = (userStats.reduce((sum, s) => sum + s.correct, 0) / userStats.length).toFixed(1)
            const sessionCount = userStats.length
            const lastSession = userStats[0] // Most recent

            return (
              <div key={username} className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{displayName}</h3>
                    <div className="text-sm text-gray-500 mb-2">({username})</div>
                    <div className="flex space-x-6 text-sm text-gray-600">
                      <span>
                        Max: <span className="font-medium text-green-600">{maxScore}</span>
                      </span>
                      <span>
                        Moyenne: <span className="font-medium text-blue-600">{avgScore}</span>
                      </span>
                      <span>
                        Sessions: <span className="font-medium text-purple-600">{sessionCount}</span>
                      </span>
                      <span>
                        Dernier:{" "}
                        <span className="font-medium text-gray-800">{formatParisTime(lastSession.timestamp)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <details className="mt-4">
                  <summary className="cursor-pointer text-indigo-600 hover:text-indigo-800 font-medium">
                    Voir le détail des sessions
                  </summary>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Score</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Durée</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Paramètres</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userStats.map((session, index) => (
                          <tr key={index}>
                            <td className="border border-gray-300 px-4 py-2 text-sm">{session.readable_date}</td>
                            <td className="border border-gray-300 px-4 py-2 text-sm">
                              <span
                                className={`font-medium ${
                                  session.correct / session.total >= 0.8
                                    ? "text-green-600"
                                    : session.correct / session.total >= 0.6
                                      ? "text-yellow-600"
                                      : "text-red-600"
                                }`}
                              >
                                {session.correct}/{session.total}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-sm">{session.duration}s</td>
                            <td className="border border-gray-300 px-4 py-2 text-sm">{session.tables}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
