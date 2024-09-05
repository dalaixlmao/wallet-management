import { Card } from "./card";

export default function Transactions({
  transactions,
}: {
  transactions: {
    amount: number;
    sentOrReceived: string;
    sentOrReceivedUser: string;
    date: Date;
  }[];
}) {
  console.log(transactions);
  function getColor(a: string) {
    if (a == "sent") return "text-red-700";
    return "text-green-700";
  }
  return (
    <Card title="Transactions">
      <div className="w-full h-3/5">
        <div className="w-full h-3/5">{transactions.map((transaction, index) => {
          return (
            <div
              key={index}
              className="flex flex-row justify-between w-full items-center border-b border-gray-400 py-2"
            >
              <div className="flex-col flex items-start">
                <div className="font-medium">
                  {transaction.sentOrReceivedUser || "Unknown user"}
                </div>
                <div className="text-xs text-gray-500">
                  {transaction.sentOrReceived == "sent" ? "Sent" : "Received"}{" "}
                  on {transaction.date.toDateString()}
                </div>
              </div>
              <div className="flex-col flex items-end">
                <div
                  className={`${getColor(
                    transaction.sentOrReceived
                  )} md:text-lg font-medium`}
                >
                  {transaction.sentOrReceived == "sent" ? "- " : "+ "} INR{" "}
                  {transaction.amount / 100}
                </div>
              </div>
            </div>
          );
        })}</div>
        
      </div>
    </Card>
  );
}
