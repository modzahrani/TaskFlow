"use client"

import { useState } from "react"
import { Mail, Lock, Eye, EyeOff } from "lucide-react"
import { login, resendConfirmation } from "@/api/userProvider"
import { useRouter } from "next/navigation"
import axios from "axios"
import Link from "next/link"
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "@/lib/buttonStyles"

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [showResend, setShowResend] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage("")
    setSuccessMessage("")
    setShowResend(false)

    try {
      setIsSubmitting(true)
      const response = await login({ email, password })

      if (response.data?.access_token) {
        // Backend sets secure HttpOnly cookie in production mode.
        localStorage.removeItem("authToken")
        router.push("/dashboard")
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data?.detail as string) || err.message
        setErrorMessage(detail)

        if (detail.toLowerCase().includes("email not confirmed")) {
          setShowResend(true)
        }
      } else {
        setErrorMessage("Login failed")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendConfirmation = async (): Promise<void> => {
    if (!email.trim()) {
      setErrorMessage("Enter your email first.")
      return
    }

    try {
      setIsResending(true)
      await resendConfirmation({ email: email.trim() })
      setSuccessMessage("Confirmation email sent. Please check your inbox.")
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? ((err.response?.data?.detail as string) || err.message)
        : "Failed to resend confirmation email"
      setErrorMessage(detail)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-card">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-12">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-mono text-sm">
              {"< >"}
            </div>
            <span className="text-2xl font-semibold">Taskflow</span>
          </div>

          <h1 className="text-3xl font-semibold mb-3">Welcome Back</h1>
          <p className="text-muted-foreground mb-8">Sign in to access your tasks and manage your workflow.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-border bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-border bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
            {successMessage && <p className="text-sm text-emerald-600">{successMessage}</p>}

            {showResend && (
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={isResending}
                className={`${BUTTON_SECONDARY} w-full`}
              >
                {isResending ? "Sending confirmation..." : "Resend confirmation email"}
              </button>
            )}

            <div className="text-right">
              <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground font-medium">
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`${BUTTON_PRIMARY} w-full`}
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-muted-foreground mt-8">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 to-slate-700 p-12 flex-col justify-between text-white">
        <h2 className="text-4xl font-bold leading-tight">taskflow</h2>
      </div>
    </div>
  )
}
