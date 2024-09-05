import React from "react";

export default function InputBox({
    placeholder,
    label,
    type,
    setValue,
  }: {
    placeholder: string;
    label: string;
    type: string;
    setValue:(a:string)=>void
  }) {
    return (
      <div className="flex flex-col w-full">
        <label className="font-medium mb-1">{label}</label>
        <input className="bg-white/20 px-3 py-1 border-white/50 border rounded-md" type={type} placeholder={placeholder} onChange={(e)=>{setValue(e.target.value)}} />
      </div>
    );
  }