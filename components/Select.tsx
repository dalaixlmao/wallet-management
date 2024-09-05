"use client"
//
export const Select = ({ options, onSelect }: {
    onSelect: (value: string) => void;
    options: {
        key: string;
        value: string;
    }[];
}) => {
    return <select onChange={(e) => {
        onSelect(e.target.value)
    }} className="bg-transparent border-2 border-gray-400 text-gray-100/50 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
        {options.map(option => <option key={option.key} value={option.key}>{option.value}</option>)}
  </select>
}
