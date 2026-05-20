"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RegisterForm } from "@/components/register-form"

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches) {
      router.replace("/");
    }
  }, [router]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-8 items-center justify-center rounded-md overflow-hidden">
            <img 
              src="/syncro.png" 
              alt="POS SYNCRO Logo" 
              className="size-full object-cover rounded-md" 
            />
          </div>
          SYNCRO POS
        </a>
        <RegisterForm />
      </div>
    </div>
  )
}
