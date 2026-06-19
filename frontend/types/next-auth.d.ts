import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: "guest" | "host" | "admin"
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    role: "guest" | "host" | "admin"
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub: string
    role: "guest" | "host" | "admin"
  }
}
