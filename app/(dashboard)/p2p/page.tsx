import SendCard from "../../../components/SendCard";

export default function () {
  return (
    <div className="w-screen h-screen">
      <div className="flex flex-col md:w-full">
        <div className="text-4xl font-bold text-violet-500 md:text-left text-center">
          Transfer by phone number
        </div>
        <div className="md:w-1/3 m-5">
          <SendCard />
        </div>
      </div>
    </div>
  );
}
