"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RegisterForm } from "@/components/register-form";

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches) {
      router.replace("/login");
    }
  }, [router]);

  return <RegisterForm />;
}
