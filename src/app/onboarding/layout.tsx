import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";

// Authed but chrome-free: onboarding is a focused flow, no app shell.
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8">
      <Logo />
      <div className="flex flex-1 flex-col justify-center py-10">{children}</div>
    </div>
  );
}
