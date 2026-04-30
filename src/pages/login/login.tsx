import { Navigate, useNavigate } from "react-router-dom"

import { LoginForm } from "@/components/login-form"
import { useAuth } from "@/lib/auth-context"

export default function LoginPage() {
  const navigate = useNavigate()
  const { currentUser, setCurrentUser } = useAuth()

  if (currentUser) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f6f5f2_0%,#fbfbf8_100%)] px-4 py-12">
      <div className="w-full max-w-md">
        <LoginForm
          onSuccess={(user) => {
            setCurrentUser(user)
            navigate("/", { replace: true })
          }}
        />
      </div>
    </div>
  )
}
