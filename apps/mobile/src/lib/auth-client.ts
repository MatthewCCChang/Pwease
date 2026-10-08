import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
    baseURL: "http://localhost:8787", // Base URL of your Better Auth backend.
    plugins: [
        expoClient({
            scheme: "pwease",
            storagePrefix: "pwease",
            storage: SecureStore,
        })
    ]
});
const signInWithProvider = async (provider:string) => {
    return await authClient.signIn.social({
        provider: provider,
        callbackURL: "/home",
    });
};


export default signInWithProvider;


