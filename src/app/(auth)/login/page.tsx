import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="w-full flex min-h-svh flex-col items-center justify-center gap-6 py-6 md:py-10">
      <div className="flex md:w-4/12 w-11/12 m-auto flex-col gap-6">
        <LoginForm />
      </div>
    </div>
  )
}
