import { Card } from "./card";

export function OnRampTransactions({
  transactions,
}: {
  transactions: {
    time: Date;
    amount: number;
    status: "Success" | "Failure" | "Processing";
    provider: string;
  }[];
}) {
  return (
    <Card title="Recent Transactions">
      {!transactions.length ? (
        <div className="text-center pb-8 pt-8 w-full">No Recent Transactions</div>
      ) : (
        <div className="w-full">
          {transactions.map((t) => (
            <div className="flex justify-between py-2 border-b border-gray-300 items-center">
              <div>
                <div className="text-sm">Received INR</div>
                <div className="text-slate-600 text-xs">
                  {t.time.toDateString()}
                </div>
              </div>
              <div className="flex justify-center">
                + Rs {t.amount / 100}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
