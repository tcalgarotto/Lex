import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/app/(auth)/login/login-form";

export default function LoginPage() {
 return (
 <Suspense
 fallback={
 <div className="flex min-h-screen items-center justify-center p-6">
 <Skeleton className="h-[400px] w-full max-w-md rounded-xl" />
 </div>
 }
 >
 <LoginForm />
 </Suspense>
 );
}
