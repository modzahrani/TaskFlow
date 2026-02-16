"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Lock, Eye, EyeOff } from "lucide-react"
import { resetPassword } from "@/api/userProvider"
import axios from "axios"
import { BUTTON_PRIMARY } from "@/lib/buttonStyles"

const PASSWORD_RULE =
  "At least 8 chars, including uppercase, lowercase, number, and special character."
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/

function getAccessTokenFromHash(): string {
  if (typeof window === "undefined") return ""
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.substring(1)
    : window.location.hash
  const params = new URLSearchParams(hash)
  return params.get("access_token") || ""
}

export default function ResetPasswordPage() {
  const [token, setToken] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    setToken(getAccessTokenFromHash())
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")

    if (!token) {
      setError("Missing reset token. Open this page from your email reset link.")
      return
    }

    if (!PASSWORD_PATTERN.test(password)) {
      setError(PASSWORD_RULE)
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    try {
      setLoading(true)
      await resetPassword({ token, new_password: password })
      setMessage("Password reset successful. You can now sign in.")
      setPassword("")
      setConfirmPassword("")
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? ((err.response?.data?.detail as string) || err.message)
        : "Failed to reset password"
      setError(detail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Set your new password below.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-10 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{PASSWORD_RULE}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Confirm Password</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background py-2 px-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {message && <p className="text-sm text-emerald-600">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`${BUTTON_PRIMARY} w-full`}
          >
            {loading ? "Resetting..." : "Reset Password"}
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
