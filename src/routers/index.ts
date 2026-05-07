import { createElement } from "react"
import { Navigate, createBrowserRouter } from "react-router-dom"

export default function router() {
  return createBrowserRouter([
    {
      path: "/",
      lazy: () => import("@/pages/home/home").then((module) => ({ Component: module.default })),
    },
    {
      path: "/login",
      lazy: () => import("@/pages/login/login").then((module) => ({ Component: module.default })),
    },
    {
      path: "*",
      element: createElement(Navigate, { to: "/", replace: true }),
    },
  ])
}
