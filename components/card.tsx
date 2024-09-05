import { Center } from "./center";

export function Card({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="p-4 w-full rounded-xl bg-white/10 md:h-full">
      <div className="text-xl text-gray-100 font-medium pb-2 border-b border-gray-100">{title}</div>
      <div className="w-full h-full text-white">
        <Center>{children}</Center>
      </div>
    </div>
  );
}
