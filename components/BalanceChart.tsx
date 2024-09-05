"use client";

import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Card } from "./card";

Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function BalanceChart({
  balances,
  currentBalance,
  userId,
  onRamp,
}: {
  balances: {
    fromUserId: number;
    toUserId: number;
    timestamp: Date;
    amount: Number;
  }[];
  currentBalance: number;
  userId: number;
  onRamp: {
    amount: number;
    startTime: Date;
  }[];
}) {
  interface balance {
    [key: string]: number;
  }

  const obj: balance = {};

  balances.map((elem) => {
    if (elem.timestamp.toDateString())
      return (obj[elem.timestamp.toDateString()] =
        (obj[elem.timestamp.toDateString()] || 0) +
        (receiveOrSend(elem.toUserId, elem.fromUserId) == "sent" ? 1 : -1) *
          Number(elem.amount));
    return (obj[elem.timestamp.toDateString()] =
      (receiveOrSend(elem.toUserId, elem.fromUserId) == "sent" ? 1 : -1) *
      Number(elem.amount));
  });

  onRamp.map((elem) => {
    if (elem.startTime.toDateString())
      return (obj[elem.startTime.toDateString()] =
        (obj[elem.startTime.toDateString()] || 0) - elem.amount);
    return (obj[elem.startTime.toDateString()] = -elem.amount);
  });

  const dataArray = Object.entries(obj);

  dataArray.sort((a, b) => {
    const p = new Date(a[0]);
    const q = new Date(b[0]);
    return p.getTime() - q.getTime();
  });

  const obj2 = Object.fromEntries(dataArray);

  function receiveOrSend(a: Number, b: Number) {
    if (b == userId) return "sent";
    return "received";
  }

  const labels = Object.keys(obj2);
  const data = Object.values(obj2);
  const chk = new Date();

  if (labels[labels.length - 1] == chk.toDateString())
    data[data.length - 1] = currentBalance;
  else data.push(currentBalance);
  const d = data.map((elem) => {
    return elem / 100;
  });
  for (let i = d.length - 2; i >= 0; i--) {
    const a = d[i] || 0;
    const b = d[i + 1] || 0;
    d[i] = a + b;
  }
  if (labels[labels.length - 1] != chk.toDateString()) d.shift();

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: "Balances",
        data: d,
        borderColor: "white", // Set the line color to white
        borderWidth: 2,
        pointBackgroundColor: "white", // Set point color to white
        fill: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: "white", // Set legend label color to white
        },
      },
      title: {
        display: true,
        text: "Balance Chart",
        color: "white", // Set title color to white
      },
    },
    scales: {
      x: {
        ticks: {
          color: "gray", // Set x-axis labels color to gray
        },
        grid: {
          color: "gray", // Set x-axis grid color to gray
        },
      },
      y: {
        ticks: {
          color: "gray", // Set y-axis labels color to gray
        },
        grid: {
          color: "gray", // Set y-axis grid color to gray
        },
      },
    },
  };

  return (
    <Card title={"Balance Chart"}>
      <div className="font-medium my-2 flex md:flex-row flex-col md:justify-start justify-center items-end">
        Current Balance:&nbsp;
        <a className="font-bold text-violet-500 md:text-2xl text-lg text-center">
          INR {currentBalance / 100}
        </a>
      </div>
      <div className="h-full md:h-4/5 m-2 w-full md:w-4/5">
        <Line data={chartData} options={chartOptions} />
      </div>
    </Card>
  );
}
