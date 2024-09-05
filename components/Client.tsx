"use client";

import React, { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

export default function Client({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <div>{children}</div>
    </SessionProvider>
  );
}
