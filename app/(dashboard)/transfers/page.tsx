import { getSession } from "next-auth/react";
import { AddMoney } from "../../../components/AddMoneyCard";
import { BalanceCard } from "../../../components/BalanceCard";
import { OnRampTransactions } from "../../../components/OnRampTransaction";
import { authOptions } from "../../lib/auth";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function getBalance() {
  const session = await getServerSession(authOptions);
  const balance = await prisma.balance.findFirst({
    where: {
      userId: Number(session?.user?.id),
    },
  });
  return {
    amount: balance?.amount || 0,
    locked: balance?.locked || 0,
  };
}

async function getOnRampTransactions() {
  const session = await getServerSession(authOptions);
  const txns = await prisma.onRampTransaction.findMany({
    where: {
      userId: Number(session?.user?.id),
    },
  });
  return txns.map((t:any) => ({
    time: t.startTime,
    amount: t.amount,
    status: t.status,
    provider: t.provider,
  }));
}

export default async function () {
  const balance = await getBalance();
  const transaction = await getOnRampTransactions();

  return (
    <div className="w-screen">
      <div className="text-4xl font-bold text-violet-500 md:text-left text-center">
        Transfer
      </div>
      <div className="flex flex-col w-full">
        <div className="flex lg:flex-row flex-col w-full">
          <div className="lg:w-2/5 w-full p-4">
            <AddMoney />
          </div>
          <div className="lg:w-2/5 w-full p-4">
            <div className="pb-8">
              {" "}
              <BalanceCard amount={balance.amount} locked={balance.locked} />
            </div>
            <div>
              <OnRampTransactions transactions={transaction} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
