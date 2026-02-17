"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Mail, Lock, Eye, EyeOff, CircleUserRound, CheckCircle2, XCircle } from "lucide-react"
import { checkEmailAvailability, register } from "@/api/userProvider"
import axios from "axios"
import Link from "next/link"
import { BUTTON_PRIMARY } from "@/lib/buttonStyles"

const PASSWORD_RULE =
  "At least 8 chars, including uppercase, lowercase, number, and special character."
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type EmailStatus = "idle" | "invalid" | "checking" | "available" | "taken" | "error"

export default function RegisterPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle")
  const latestEmailRequestId = useRef(0)

  const passwordChecks = useMemo(() => {
    return [
      { label: "At least 8 characters", valid: password.length >= 8 },
      { label: "At least one uppercase letter", valid: /[A-Z]/.test(password) },
      { label: "At least one lowercase letter", valid: /[a-z]/.test(password) },
      { label: "At least one number", valid: /\d/.test(password) },
      { label: "At least one special character", valid: /[^A-Za-z\d]/.test(password) },
    ]
  }, [password])

  const passwordChecksCompleted = passwordChecks.filter((item) => item.valid).length
  const passwordStrengthPercent = (passwordChecksCompleted / passwordChecks.length) * 100

  useEffect(() => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setEmailStatus("idle")
      return
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setEmailStatus("invalid")
      return
    }

    const timeoutId = window.setTimeout(async () => {
      const requestId = ++latestEmailRequestId.current
      setEmailStatus("checking")
      try {
        const res = await checkEmailAvailability(normalizedEmail)
        if (latestEmailRequestId.current !== requestId) return
        setEmailStatus(res.data?.available ? "available" : "taken")
      } catch {
        if (latestEmailRequestId.current !== requestId) return
        setEmailStatus("error")
      }
    }, 450)

    return () => window.clearTimeout(timeoutId)
  }, [email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage("")

    const normalizedEmail = email.trim().toLowerCase()

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setErrorMessage("Please enter a valid email address.")
      return
    }

    if (emailStatus === "taken") {
      setErrorMessage("Email already in use.")
      return
    }

    if (!PASSWORD_PATTERN.test(password)) {
      setErrorMessage(PASSWORD_RULE)
      return
    }

    try {
      setIsSubmitting(true)
      await register({ name: name.trim(), email: normalizedEmail, password })
      router.push("/login")
    } catch (err) {
      const isConflict = axios.isAxiosError(err) && err.response?.status === 409
      if (isConflict) {
        setEmailStatus("taken")
      }
      const detail = isConflict
        ? "Email already in use."
        : axios.isAxiosError(err)
          ? ((err.response?.data?.detail as string) || err.message)
          : "Registration failed"
      setErrorMessage(detail)
    } finally {
      setIsSubmitting(false)
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

          <h1 className="text-3xl font-semibold mb-3">Create your account</h1>
          <p className="text-muted-foreground mb-8">Register to start organizing your teams and tasks.</p>

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
              <p
                className={`mt-2 text-xs ${
                  emailStatus === "available"
                    ? "text-emerald-600"
                    : emailStatus === "taken" || emailStatus === "invalid" || emailStatus === "error"
                      ? "text-red-600"
                      : "text-muted-foreground"
                }`}
              >
                {emailStatus === "idle" && "Use a valid email you can access."}
                {emailStatus === "invalid" && "Enter a valid email format."}
                {emailStatus === "checking" && "Checking email availability..."}
                {emailStatus === "available" && "Email is available."}
                {emailStatus === "taken" && "Email is already in use."}
                {emailStatus === "error" && "Could not verify email right now. You can still try submitting."}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <div className="relative">
                <CircleUserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  placeholder="Create a password"
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
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all ${
                    passwordStrengthPercent < 50
                      ? "bg-red-500"
                      : passwordStrengthPercent < 100
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${passwordStrengthPercent}%` }}
                />
              </div>
              <div className="mt-3 space-y-1">
                {passwordChecks.map((rule) => (
                  <div
                    key={rule.label}
                    className={`flex items-center gap-2 text-xs ${
                      rule.valid ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {rule.valid ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <span>{rule.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{PASSWORD_RULE}</p>
            </div>

            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

            <button
              type="submit"
              disabled={isSubmitting || emailStatus === "checking"}
              className={`${BUTTON_PRIMARY} w-full`}
            >
              {isSubmitting ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <p className="text-center text-muted-foreground mt-8">
            Already have an account?{" "}
            <Link href="/login" className="font-medium hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-12 items-center justify-center text-white">
        <div className="text-center">
          <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-white/85">
            Task Management
          </span>
          <h2 className="mt-5 text-5xl font-extrabold leading-tight tracking-tight">Taskflow</h2>
          <p className="mx-auto mt-4 max-w-md text-base text-white/80">
            Plan clearly. Move faster.
          </p>
        </div>
      </div>
    </div>
  )
}
