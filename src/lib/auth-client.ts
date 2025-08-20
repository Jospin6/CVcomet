import { mainUrl } from "@/helpers/constants"
import { createAuthClient } from "better-auth/react"
export const authClient = createAuthClient({
    baseURL: "http://localhost:3000/"
})

// mainUrl