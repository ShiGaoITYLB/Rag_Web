import { createAuthClient } from "better-auth/react";
import { emailOTPClient, jwtClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // 如果用 Vite proxy 代理 /api/auth，可以不填 baseURL
  // 如果直接请求 auth-server，则填：
  // baseURL: "http://localhost:3005",
  plugins: [
    emailOTPClient(),
    jwtClient()
  ]
});

export const { useSession } = authClient;
