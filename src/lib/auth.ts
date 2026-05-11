import { authClient } from "@/lib/auth-client"
import { buildApiUrl } from "@/lib/api-config"

export type AuthUser = {
  id?: string
  name: string
  email: string
  image?: string | null
}

export type SocialProvider = "github"

type AuthResponse<T = unknown> = {
  data: T | null
  error: {
    message?: string
    status?: number
    statusText?: string
  } | null
}

type SessionData = {
  user?: {
    id?: string
    name?: string | null
    email?: string | null
    image?: string | null
  } | null
}

type SignInData = SessionData & {
  token?: string | null
}

type RegisterResult = {
  user: AuthUser
  requiresEmailVerification: boolean
}

const AUTH_CURRENT_USER_KEY = "rag-web-auth-current-user"
const ACCESS_TOKEN_KEY = "access_token"
const ACCESS_TOKEN_COOKIE = "rag_access_token"
const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24 * 30

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function getCookie(name: string) {
  const prefix = `${encodeURIComponent(name)}=`
  return (
    document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(prefix))
      ?.slice(prefix.length) ?? null
  )
}

function setCookie(name: string, value: string, maxAge: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value,
  )}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
}

function clearCookie(name: string) {
  document.cookie = `${encodeURIComponent(name)}=; Path=/; Max-Age=0; SameSite=Lax`
}

function normalizeUser(user: SessionData["user"]): AuthUser | null {
  if (!user?.email) {
    return null
  }

  return {
    id: user.id,
    name: user.name?.trim() || user.email,
    email: user.email,
    image: user.image,
  }
}

function getAuthErrorMessage(error: AuthResponse["error"]) {
  return error?.message || error?.statusText || "认证请求失败"
}

function storeCurrentUser(user: AuthUser | null) {
  if (user) {
    writeJson(AUTH_CURRENT_USER_KEY, user)
    return
  }

  window.localStorage.removeItem(AUTH_CURRENT_USER_KEY)
}

function storeAccessToken(token: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
  setCookie(ACCESS_TOKEN_COOKIE, token, ACCESS_TOKEN_MAX_AGE)
}

function clearAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  clearCookie(ACCESS_TOKEN_COOKIE)
}

export function getStoredAccessToken() {
  const cookieToken = getCookie(ACCESS_TOKEN_COOKIE)
  if (cookieToken) {
    return decodeURIComponent(cookieToken)
  }

  return window.localStorage.getItem(ACCESS_TOKEN_KEY)
}

export async function getJwtToken(options?: { forceRefresh?: boolean }) {
  const cachedToken = getStoredAccessToken()
  if (cachedToken && !options?.forceRefresh) {
    return cachedToken
  }

  const response = await fetch(buildApiUrl("/api/auth/token"), {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    if (options?.forceRefresh) {
      clearAccessToken()
      return null
    }
    return cachedToken
  }

  const data = (await response.json()) as { token?: string | null }
  if (data.token) {
    storeAccessToken(data.token)
    return data.token
  }

  return cachedToken
}

export async function getAuthHeaders(options?: { forceRefresh?: boolean }): Promise<Record<string, string>> {
  const token = await getJwtToken(options)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function syncAccessToken() {
  await getJwtToken({ forceRefresh: true })
}

export function getCurrentUser() {
  return readJson<AuthUser | null>(AUTH_CURRENT_USER_KEY, null)
}

export async function refreshCurrentUser() {
  const response = (await authClient.getSession()) as AuthResponse<SessionData>
  if (response.error || !response.data) {
    storeCurrentUser(null)
    clearAccessToken()
    return null
  }

  const user = normalizeUser(response.data.user)
  storeCurrentUser(user)
  await syncAccessToken()
  return user
}

export async function logoutUser() {
  await authClient.signOut()
  storeCurrentUser(null)
  clearAccessToken()
}

export async function registerUser(input: {
  name: string
  email: string
  password: string
}): Promise<RegisterResult> {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  const password = input.password

  if (!name) {
    throw new Error("请输入用户名")
  }
  if (!email) {
    throw new Error("请输入邮箱")
  }
  if (password.length < 6) {
    throw new Error("密码至少需要 6 位")
  }

  const signUpPayload = {
    name,
    email,
    password,
    rememberMe: true,
  }

  const response = (await authClient.signUp.email(signUpPayload)) as AuthResponse<SignInData>

  if (response.error) {
    throw new Error(getAuthErrorMessage(response.error))
  }

  const user = normalizeUser(response.data?.user)
  if (!user) {
    throw new Error("注册成功，但无法获取用户信息")
  }

  if (!response.data?.token) {
    return {
      user,
      requiresEmailVerification: true,
    }
  }

  storeCurrentUser(user)
  await syncAccessToken()
  return {
    user,
    requiresEmailVerification: false,
  }
}

export async function loginUser(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase()
  const password = input.password

  if (!email) {
    throw new Error("请输入邮箱")
  }
  if (!password) {
    throw new Error("请输入密码")
  }

  const response = (await authClient.signIn.email({
    email,
    password,
    rememberMe: true,
  })) as AuthResponse<SignInData>

  if (response.error) {
    throw new Error(getAuthErrorMessage(response.error))
  }

  const user = normalizeUser(response.data?.user) ?? (await refreshCurrentUser())
  if (!user) {
    throw new Error("登录成功，但无法获取用户信息")
  }

  storeCurrentUser(user)
  await syncAccessToken()
  return user
}

export async function sendLoginEmailOtp(input: { email: string }) {
  const email = input.email.trim().toLowerCase()

  if (!email) {
    throw new Error("请输入邮箱")
  }

  const response = (await authClient.emailOtp.sendVerificationOtp({
    email,
    type: "sign-in",
  })) as AuthResponse

  if (response.error) {
    throw new Error(getAuthErrorMessage(response.error))
  }
}

export async function loginWithEmailOtp(input: { email: string; otp: string }) {
  const email = input.email.trim().toLowerCase()
  const otp = input.otp.trim()

  if (!email) {
    throw new Error("请输入邮箱")
  }
  if (!otp) {
    throw new Error("请输入验证码")
  }
  if (!/^\d{6}$/.test(otp)) {
    throw new Error("请输入 6 位数字验证码")
  }

  const response = (await authClient.signIn.emailOtp({
    email,
    otp,
    name: email.split("@")[0] || email,
  })) as AuthResponse<SignInData>

  if (response.error) {
    throw new Error(getAuthErrorMessage(response.error))
  }

  const user = normalizeUser(response.data?.user) ?? (await refreshCurrentUser())
  if (!user) {
    throw new Error("登录成功，但无法获取用户信息")
  }

  storeCurrentUser(user)
  await syncAccessToken()
  return user
}

export async function verifyEmailWithOtp(input: { email: string; otp: string }) {
  const email = input.email.trim().toLowerCase()
  const otp = input.otp.trim()

  if (!email) {
    throw new Error("请输入邮箱")
  }
  if (!otp) {
    throw new Error("请输入验证码")
  }
  if (!/^\d{6}$/.test(otp)) {
    throw new Error("请输入 6 位数字验证码")
  }

  const response = (await authClient.emailOtp.verifyEmail({
    email,
    otp,
  })) as AuthResponse<SignInData & { status?: boolean }>

  if (response.error) {
    throw new Error(getAuthErrorMessage(response.error))
  }

  const user = normalizeUser(response.data?.user) ?? (await refreshCurrentUser())
  if (!user) {
    throw new Error("邮箱验证成功，但无法获取用户信息")
  }

  storeCurrentUser(user)
  await syncAccessToken()
  return user
}

export async function loginWithSocialProvider(provider: SocialProvider) {
  const response = (await authClient.signIn.social({
    provider,
    callbackURL: window.location.origin,
    errorCallbackURL: `${window.location.origin}/login`,
  })) as AuthResponse

  if (response?.error) {
    throw new Error(getAuthErrorMessage(response.error))
  }
}
