"use client";

import { Button } from "./button";
import { Card } from "./card";
import { TextInput } from "./TextInput";
import { useState } from "react";
import { p2pTransfer } from "../app/lib/actions/p2pTransfer";
import { useRouter } from "next/navigation";

export default function SendCard() {
    const [number, setNumber] = useState("");
    const [amount, setAmount] = useState(0);
    const router = useRouter();
  return (
    <Card title="Send">
      <TextInput
        label="Number"
        placeholder="Enter receiver's phone number"
        onChange={(val) => {
            setNumber(val);
          console.log("changed", val);
        }}
      />
      <TextInput
        label="Amount"
        placeholder="Enter the amount"
        onChange={(val) => {
            setAmount(Number(val));
          console.log("changed", val);
        }}
      />
      <div className="w-full mt-3 flex justify-center items-center">
        <Button onClick={async () => {
            await p2pTransfer(number, (amount)*100);
            alert("transaction successful");
        }}>Send</Button>
      </div>
    </Card>
  );
}
