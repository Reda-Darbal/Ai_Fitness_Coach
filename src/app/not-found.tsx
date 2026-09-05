import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { dict } = await getI18n();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-display font-semibold text-muted-foreground tabular-nums">
        404
      </p>
      <h1 className="text-xl font-semibold text-foreground">{dict.errors.notFound}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {dict.errors.notFoundBody}
      </p>
      <Button asChild size="xl">
        <Link href="/">{dict.errors.backHome}</Link>
      </Button>
    </div>
  );
}
