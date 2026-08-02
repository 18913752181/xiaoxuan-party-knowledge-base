import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-5 py-14 lg:px-8 text-center text-neutral-500">加载中...</div>}>
      <LoginForm />
    </Suspense>
  );
}
