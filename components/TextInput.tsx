"use client"

export const TextInput = ({
    placeholder,
    onChange,
    label
}: {
    placeholder: string;
    onChange: (value: string) => void;
    label: string;
}) => {
    return <div className="pt-2 w-full">
        <label className="block mb-2 text-sm font-medium text-gray-100">{label}</label>
        <input onChange={(e) => onChange(e.target.value)} type="text" id="first_name" className="border-2 bg-transparent border-gray-100 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder={placeholder} />
    </div>
}