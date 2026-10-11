import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
// import { drizzleAdapter } from "better-auth/adapters/drizzle";
// import type { Database } from "../db";

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    socialProviders: {
        google: {
            prompt: "select_account",
            clientId: [
                process.env.GOOGLE_WEB_CLIENT_ID as string, 
                // process.env.GOOGLE_IOS_CLIENT_ID as string, 
                // process.env.GOOGLE_ANDROID_CLIENT_ID as string, 
            ],
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
    },
    trustedOrigins: [
        "pwease://",
        "http://localhost:8081",
        // Development mode - Expo's exp:// scheme with local IP ranges
        ...(process.env.NODE_ENV === "development" ? [
            "exp://",                      // Trust any host of the exp:// scheme
            "exp://**",                    // Trust all Expo URLs (wildcard matching)
            "exp://192.168.*.*:*/**",      // Trust 192.168.x.x IP range with any port and path
        ] : [])
    ],
    plugins: [expo()],
})