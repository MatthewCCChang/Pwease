import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

export const authClient = createAuthClient({
    baseURL: process.env.EXPO_PUBLIC_API_URL, // Base URL of your Better Auth backend.
    plugins: [
        expoClient({
            scheme: "pwease",
            storagePrefix: "pwease",
            storage: SecureStore,
        })
    ]
});

export const signInWithProvider = async (provider:string) => {
    //console.log("received ", provider);
        const {error} = await authClient.signIn.social({
        provider: provider,
        callbackURL: "http://localhost:8081/home",
        });
        console.log("got results");
        
        if(error){
            console.log(error);
            return
        }
    
    return 
};




