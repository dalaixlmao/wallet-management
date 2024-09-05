import { Card } from "@/components/card";
import BalanceChart from "../../../components/BalanceChart";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
const prisma = new PrismaClient();

export default async function () {
  const session = await getServerSession(authOptions);
  if(!session?.user)
  {
    redirect("/signin");
  }
  const userId = Number(session.user?.id);

  const balance = await prisma.balance.findUnique({
    where: { userId: userId },
  });
  const currentBalance = balance?.amount || 0;
  const transactions = await prisma.p2pTransfer.findMany({
    where: {
      OR: [{ fromUserId: userId }, { toUserId: userId }],
    },
    select: {
      fromUserId: true,
      toUserId: true,
      amount: true,
      timestamp: true,
    },
  });

  transactions.sort((a:any, b:any) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const onRamp = await prisma.onRampTransaction.findMany({
    where: { userId: userId, status: "Success" },
    select: { startTime: true, amount: true },
  });

  function receiveOrSend(a: Number, b: Number) {
    if (b == userId) return "sent";
    return "received";
  }

  return (
    <div className="w-screen h-screen">
      <div className="flex flex-col w-full h-full md:items-start items-center">
        <div className="w-full text-4xl font-bold text-violet-500 md:text-left text-center">Dashboard</div>
        <div className="md:w-4/5 w-11/12 md:h-4/5 md:m-5 flex flex-row md:justify-start justify-center mt-4">
          <BalanceChart
            balances={transactions}
            currentBalance={currentBalance}
            userId={userId}
            onRamp={onRamp}
          />
        </div>
      </div>
    </div>
  );
}
