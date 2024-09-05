"use server"
import { getServerSession } from "next-auth";
import { authOptions } from "../auth";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function p2pTransfer(to: string, amount: number) {
    
    const session = await getServerSession(authOptions);
    const from = session?.user?.id;
    if (!from) {
        return {
            message: "Error while sending"
        }
    }
    const toUser = await prisma.user.findFirst({
        where: {
            number: to
        }
    });
    
    console.log("toUser", toUser);

    if (!toUser) {
        return {
            message: "User not found"
        }
    }

    if(Number(from) == toUser.id)
        {
            return {
                message: "Cant send money to yourself."
            }
        }

    await prisma.$transaction(async (tx:any) => {
        await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${Number(from)} FOR UPDATE`;

        const fromBalance = await tx.balance.findUnique({
            where: { userId: Number(from) },
        });
        if (!fromBalance || fromBalance.amount < amount) {
            throw new Error('Insufficient funds');
        }

        const toUserBalance = await tx.balance.findUnique({
            where: { userId: toUser.id },
        });
        if (!toUserBalance) {
            throw new Error('Recipient balance record not found');
        }

        await tx.balance.update({
            where: { userId: Number(from) },
            data: { amount: { decrement: amount } },
        });
        await tx.balance.update({
            where: { userId: toUser.id },
            data: { amount: { increment: amount } },
        });

        await tx.p2pTransfer.create({
            data: {
                fromUserId: Number(from),
                toUserId: toUser.id,
                amount,
                timestamp: new Date()
            }
        });
        console.log("transaction done");
    });
}
