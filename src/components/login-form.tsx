import { useState, type FormEvent } from "react"
import { GithubIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  loginUser,
  loginWithEmailOtp,
  loginWithSocialProvider,
  registerUser,
  sendLoginEmailOtp,
  verifyEmailWithOtp,
  type AuthUser,
  type SocialProvider,
} from "@/lib/auth"
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
  const [socialProvider, setSocialProvider] = useState<SocialProvider | null>(null)
  const [otp, setOtp] = useState("")
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isOtpSubmitting, setIsOtpSubmitting] = useState(false)
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null)

  const isRegister = mode === "register"
  const isVerifyingRegistration = isRegister && Boolean(pendingVerificationEmail)
  const isBusy = isSubmitting || isSendingOtp || isOtpSubmitting || Boolean(socialProvider)

  function resetMessages() {
    setError(null)
    setSuccessMessage(null)
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode)
    setPassword("")
    setConfirmPassword("")
    setOtp("")
    setPendingVerificationEmail(null)
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

        const result = await registerUser({ name, email, password })
        if (result.requiresEmailVerification) {
          setPendingVerificationEmail(result.user.email)
          setOtp("")
          setSuccessMessage("注册成功，验证码已发送，请验证邮箱")
          return
        }

        setSuccessMessage("注册成功，已自动登录")
        onSuccess?.(result.user)
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

  async function handleSocialLogin(provider: SocialProvider) {
    resetMessages()
    setSocialProvider(provider)

    try {
      await loginWithSocialProvider(provider)
    } catch (socialError) {
      setError(socialError instanceof Error ? socialError.message : "第三方登录失败")
      setSocialProvider(null)
    }
  }

  async function handleSendOtp() {
    resetMessages()
    setIsSendingOtp(true)

    try {
      setOtp("")
      await sendLoginEmailOtp({ email })
      setSuccessMessage("验证码已发送，请查收邮箱")
    } catch (otpError) {
      setError(otpError instanceof Error ? otpError.message : "验证码发送失败")
    } finally {
      setIsSendingOtp(false)
    }
  }

  async function handleOtpLogin() {
    resetMessages()
    setIsOtpSubmitting(true)

    try {
      const user = await loginWithEmailOtp({ email, otp })
      setSuccessMessage("登录成功")
      onSuccess?.(user)
    } catch (otpError) {
      setError(otpError instanceof Error ? otpError.message : "验证码登录失败")
    } finally {
      setIsOtpSubmitting(false)
    }
  }

  async function handleVerifyRegistration() {
    resetMessages()
    setIsOtpSubmitting(true)

    try {
      const user = await verifyEmailWithOtp({ email: pendingVerificationEmail ?? email, otp })
      setSuccessMessage("邮箱验证成功")
      onSuccess?.(user)
    } catch (otpError) {
      setError(otpError instanceof Error ? otpError.message : "邮箱验证失败")
    } finally {
      setIsOtpSubmitting(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {isRegister ? "创建账号" : "欢迎回来"}
          </CardTitle>
          <CardDescription>
            {isVerifyingRegistration
              ? "输入邮箱验证码完成注册"
              : isRegister
              ? "使用邮箱创建账号"
              : "使用邮箱和密码登录"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <Button
                  variant="outline"
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleSocialLogin("github")}
                >
                  <GithubIcon />
                  {socialProvider === "github" ? "正在跳转 GitHub..." : "使用 GitHub 登录"}
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                {isRegister ? "使用邮箱创建" : "或使用邮箱继续"}
              </FieldSeparator>
              {isRegister ? (
                <Field>
                  <FieldLabel htmlFor="name">姓名</FieldLabel>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="请输入姓名"
                    required
                  />
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="email">邮箱</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Field>
              {!isRegister ? (
                <Field>
                  <FieldLabel htmlFor="email-otp">邮箱验证码</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="email-otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="请输入验证码"
                      value={otp}
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                    <Button
                      variant="outline"
                      type="button"
                      className="shrink-0"
                      disabled={isBusy}
                      onClick={() => void handleSendOtp()}
                    >
                      {isSendingOtp ? "发送中..." : "发送验证码"}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleOtpLogin()}
                  >
                    {isOtpSubmitting ? "登录中..." : "验证码登录"}
                  </Button>
                </Field>
              ) : null}
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">密码</FieldLabel>
                  {!isRegister ? (
                    <button
                      type="button"
                      className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline"
                      disabled={isBusy}
                      onClick={() => setSuccessMessage("请联系管理员重置密码")}
                    >
                      忘记密码？
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
                  <FieldLabel htmlFor="confirm-password">确认密码</FieldLabel>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </Field>
              ) : null}
              {isVerifyingRegistration ? (
                <Field>
                  <FieldLabel htmlFor="register-email-otp">邮箱验证码</FieldLabel>
                  <Input
                    id="register-email-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="请输入验证码"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                  />
                  <Button
                    variant="outline"
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleVerifyRegistration()}
                  >
                    {isOtpSubmitting ? "验证中..." : "验证邮箱"}
                  </Button>
                </Field>
              ) : null}
              {error ? <FieldError>{error}</FieldError> : null}
              {successMessage ? (
                <FieldDescription className="text-center text-emerald-600">
                  {successMessage}
                </FieldDescription>
              ) : null}
              <Field>
                <Button type="submit" disabled={isBusy || isVerifyingRegistration}>
                  {isSubmitting ? "处理中..." : isRegister ? "注册" : "登录"}
                </Button>
                <FieldDescription className="text-center">
                  {isRegister ? "已有账号？" : "还没有账号？"}
                  <button
                    type="button"
                    className="underline underline-offset-4 hover:text-primary"
                    disabled={isBusy}
                    onClick={() => switchMode(isRegister ? "login" : "register")}
                  >
                    {isRegister ? "去登录" : "去注册"}
                  </button>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
