import { LoginForm } from "@/components/login-form"
import { ModeSwitcher } from "@/components/mode-switcher"

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10 relative">
      <div className="absolute top-4 right-4 z-50">
        <ModeSwitcher />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="#" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-8 items-center justify-center rounded-md overflow-hidden">
            <img 
              src="/syncro.png" 
              alt="POS SYNCRO Logo" 
              className="size-full object-cover rounded-md" 
            />
          </div>
          SYNCRO POS
        </a>
        <LoginForm />
      </div>
    </div>
  )
}
