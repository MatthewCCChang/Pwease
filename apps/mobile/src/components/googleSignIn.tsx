import { signInWithProvider }  from "../lib/auth-client";
import { Button } from "./ui";


export default function GoogleSignIn() {
    return(
        <Button onPress={() => {
        signInWithProvider("google")
    }} label="google auth"/>
    )
};