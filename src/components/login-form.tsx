import { useState, type FormEvent } from "react"

import { cn } from "@/lib/utils"
import { loginUser, registerUser, type AuthUser } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Mode = "login" | "register"

export function LoginForm({
  className,
  onSuccess,
  ...props
}: React.ComponentProps<"div"> & {
  onSuccess?: (user: AuthUser) => void
}) {
  const [mode, setMode] = useState<Mode>("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isRegister = mode === "register"

  function resetMessages() {
    setError(null)
    setSuccessMessage(null)
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode)
    setPassword("")
    setConfirmPassword("")
    resetMessages()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetMessages()
    setIsSubmitting(true)

    try {
      if (isRegister) {
        if (password !== confirmPassword) {
          throw new Error("两次输入的密码不一致")
        }

        const user = await registerUser({ name, email, password })
        setSuccessMessage("注册成功，已自动登录")
        onSuccess?.(user)
        return
      }

      const user = await loginUser({ email, password })
      setSuccessMessage("登录成功")
      onSuccess?.(user)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "操作失败")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {isRegister ? "Create an account" : "Welcome back"}
          </CardTitle>
          <CardDescription>
            {isRegister
              ? "使用邮箱创建账号"
              : "使用邮箱和密码登录"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <Button variant="outline" type="button" disabled>
                  Login with Apple
                </Button>
                <Button variant="outline" type="button" disabled>
                  Login with Google
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                {isRegister ? "Create with email" : "Or continue with"}
              </FieldSeparator>
              {isRegister ? (
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="your name"
                    required
                  />
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  {!isRegister ? (
                    <button
                      type="button"
                      className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline"
                      onClick={() => setSuccessMessage("请联系管理员重置密码")}
                    >
                      Forgot your password?
                    </button>
                  ) : null}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </Field>
              {isRegister ? (
                <Field>
                  <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </Field>
              ) : null}
              {error ? <FieldError>{error}</FieldError> : null}
              {successMessage ? (
                <FieldDescription className="text-center text-emerald-600">
                  {successMessage}
                </FieldDescription>
              ) : null}
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "处理中..." : isRegister ? "Sign up" : "Login"}
                </Button>
                <FieldDescription className="text-center">
                  {isRegister ? "Already have an account? " : "Don't have an account? "}
                  <button
                    type="button"
                    className="underline underline-offset-4 hover:text-primary"
                    disabled={isSubmitting}
                    onClick={() => switchMode(isRegister ? "login" : "register")}
                  >
                    {isRegister ? "Login" : "Sign up"}
                  </button>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        登录与注册请求会发送到 /api/auth。
      </FieldDescription>
    </div>
  )
}
