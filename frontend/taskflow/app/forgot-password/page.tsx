"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail } from "lucide-react"
import { forgotPassword } from "@/api/userProvider"
import axios from "axios"
import { BUTTON_PRIMARY } from "@/lib/buttonStyles"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage("")
    setError("")

    try {
      setLoading(true)
      await forgotPassword({ email })
      setMessage("If the email exists, a reset link has been sent.")
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? ((err.response?.data?.detail as string) || err.message)
        : "Failed to send reset email"
      setError(detail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Forgot Password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your email to receive a reset link.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {message && <p className="text-sm text-emerald-600">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`${BUTTON_PRIMARY} w-full`}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          Back to{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            login
          </Link>
        </p>
      </div>
    </div>
  )
}
