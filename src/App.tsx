import { useMemo } from "react"
import { RouterProvider } from "react-router-dom"

import { AuthProvider } from "@/lib/auth-context"
import router from "@/routers"

function AppRoutes() {
  const appRouter = useMemo(() => router(), [])

  return <RouterProvider router={appRouter} />
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
