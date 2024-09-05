import { OnRampTransactions } from "../../../components/OnRampTransaction";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import Transactions from "../../../components/Transactions";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function () {
  const session = await getServerSession(authOptions);
  const userId = Number(session.user?.id);
  console.log(userId);

  const transaction = await prisma.p2pTransfer.findMany({
    where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
    select: {
      fromUser: true,
      toUser: true,
      amount: true,
      timestamp: true,
    },
  });

  const props = transaction.map((elem:any) => {
    return {
      amount: elem.amount,
      sentOrReceived: receiveOrSend(
        Number(elem.toUser.id),
        Number(elem.fromUser.id)
      ),
      sentOrReceivedUser:
        (receiveOrSend(Number(elem.toUser.id), Number(elem.fromUser.id)) ==
        "sent"
          ? elem.toUser.name
          : elem.fromUser.name) || "",
          date: elem.timestamp
    }
  });

  console.log(props)

  // a ---->  b   (a is sender b is receiver)
  function receiveOrSend(a: Number, b: Number) {
    if (b == userId) return "sent";
    return "received";
  }

  return (
    <div className="w-screen h-screen bg-gray-900">
      <div className="flex flex-col w-full h-full">
        <div className="text-4xl font-bold text-violet-500 md:text-left text-center">Transactions</div>
        <div className="lg:w-1/3 w-full mt-5 md:ml-5">
           <Transactions transactions={props}/>
        </div>
      </div>
    </div>
  );
}
