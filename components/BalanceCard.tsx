import { Card } from "./card";

export function BalanceCard({
  amount,
  locked,
}: {
  amount: number;
  locked: number;
}) {
  return (
    <Card title={"Balance"}>
      <div className="flex flex-col w-full">
        <div className="flex flex-row justify-between border-gray-300 border-b py-2 items-center">
          <div>Unlocked balance</div>
          <div>{amount /100} INR</div>
        </div>
        <div className="flex flex-row justify-between border-gray-300 border-b py-2 items-center">
          <div>Total Locked Balance</div>
          <div>{locked /100} INR</div>
        </div>
        <div className="flex flex-row justify-between border-b border-gray-300 py-2 items-center">
          <div>Total Balance</div>
          <div>{(locked+amount)/100} INR</div>
        </div>
      </div>
    </Card>
  );
}
