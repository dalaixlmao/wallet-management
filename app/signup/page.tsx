"use client";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import React from "react";
import InputBox from "../../components/InputBox";
import { useState } from "react";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassowrd] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const balance = Math.random()*1000000;

  return (
    <div className="text-white bg-black w-screen h-screen flex justify-center items-center">
      <div className="w-full md:w-1/3 bg-white/10 flex flex-col items-center py-3 rounded-lg px-10">
        <div className="text-3xl font-bold mb-2">Sign Up</div>
        <div className="text-xs text-white/50 mb-3">
          Already have an accout?{" "}
          <a className="underline hover:text-white" href="/signup">
            Login.
          </a>
        </div>
        <InputBox type="text" placeholder="John Stark" label="Name" setValue={setName} />
        <InputBox type="text" placeholder="9876543210" label="Phone" setValue={setPhone} />
        <InputBox
          type={"email"}
          placeholder="john@abc.com"
          label="Email"
          setValue={setEmail}
        />
        <InputBox
          type="password"
          placeholder="password"
          label="Password"
          setValue={setPassowrd}
        />
        <button onClick={async()=>{
            console.log(email, password);
            await signIn("credentials", {
                email: email,
                password: password,
                phone:phone,
                name:name,
                redirect: false,
              });
            router.push("/dashboard");

        }} className="mt-3 py-1 w-full bg-black rounded-md hover:border hover:border-blue-500 mb-6">Sign Up</button>
      </div>
    </div>
  );
}