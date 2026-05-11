import { createAuthClient } from "better-auth/react";
import { emailOTPClient, jwtClient } from "better-auth/client/plugins";

import { API_BASE_URL } from "@/lib/api-config";

export const authClient = createAuthClient({
  baseURL: API_BASE_URL || undefined,
  plugins: [
    emailOTPClient(),
    jwtClient()
  ]
});

export const { useSession } = authClient;
