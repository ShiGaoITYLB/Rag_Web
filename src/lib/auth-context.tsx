import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

import { getCurrentUser, refreshCurrentUser, type AuthUser } from "@/lib/auth"

type AuthContextValue = {
  currentUser: AuthUser | null
  setCurrentUser: (user: AuthUser | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getCurrentUser())

  useEffect(() => {
    let active = true

    void refreshCurrentUser().then((user) => {
      if (active) {
        setCurrentUser(user)
      }
    })

    return () => {
      active = false
    }
  }, [])

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider")
  }
  return context
}
