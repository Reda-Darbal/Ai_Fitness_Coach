import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";
import { Logo } from "@/components/logo";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  const { dict } = await getI18n();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between px-5 lg:px-10">
        <Logo />
        <Button asChild variant="ghost">
          <Link href="/sign-in">{dict.common.signIn}</Link>
        </Button>
      </header>

      <main className="flex flex-1 items-center px-5 lg:px-10">
        <div className="mx-auto w-full max-w-3xl py-16">
          <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
            {dict.landing.eyebrow}
          </p>
          <h1 className="mt-4 text-display-sm font-semibold text-foreground sm:text-display">
            {dict.landing.headline1}
            <br />
            {dict.landing.headline2}
          </h1>
          <p className="mt-5 max-w-md text-base text-muted-foreground">
            {dict.landing.body}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="xl">
              <Link href="/sign-up">{dict.common.getStarted}</Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link href="/sign-in">{dict.common.haveAccount}</Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="flex h-14 items-center px-5 lg:px-10">
        <p className="text-xs text-muted-foreground">
          {dict.app.disclaimer}
        </p>
      </footer>
    </div>
  );
}
