"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { equipmentLabelFrom } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

const ANY = "any";

/**
 * Filters live in the URL, so results are shareable, survive a refresh, and
 * are rendered on the server. Search is debounced; selects apply immediately.
 */
export function ExerciseFilters({
  bodyParts,
  targets,
  equipment,
  difficulties,
}: {
  bodyParts: string[];
  targets: string[];
  equipment: string[];
  difficulties: readonly string[];
}) {
  const { dict } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const currentSearch = params.get("q") ?? "";
  const [search, setSearch] = useState(currentSearch);
  const [syncedSearch, setSyncedSearch] = useState(currentSearch);

  // Keep the box in step when the URL changes from elsewhere (e.g. Clear).
  // Adjusting state during render is React's documented way to do this — an
  // effect here would cause a cascading render.
  if (currentSearch !== syncedSearch) {
    setSyncedSearch(currentSearch);
    setSearch(currentSearch);
  }

  function apply(next: Record<string, string | null>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "" || value === ANY) query.delete(key);
      else query.set(key, value);
    }
    query.delete("limit"); // a changed filter starts from the first page
    const qs = query.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  useEffect(() => {
    if (search === currentSearch) return;
    const timer = setTimeout(() => apply({ q: search }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const hasFilters =
    Boolean(currentSearch) ||
    ["bodyPart", "target", "equipment", "difficulty"].some((k) => params.get(k));

  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={dict.exercises.search}
          aria-label={dict.exercises.search}
          className="h-11 ps-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <Label htmlFor="f-body" className="sr-only">
            {dict.exercises.bodyPart}
          </Label>
          <Select
            value={params.get("bodyPart") ?? ANY}
            onValueChange={(v) => apply({ bodyPart: v })}
          >
            <SelectTrigger id="f-body" className="h-11 w-full capitalize">
              <SelectValue placeholder={dict.exercises.bodyPart} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{dict.exercises.allBodyParts}</SelectItem>
              {bodyParts.map((b) => (
                <SelectItem key={b} value={b}>
                  {(dict.bodyParts as Record<string, string>)[b] ?? b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="f-equip" className="sr-only">
            {dict.exercises.equipment}
          </Label>
          <Select
            value={params.get("equipment") ?? ANY}
            onValueChange={(v) => apply({ equipment: v })}
          >
            <SelectTrigger id="f-equip" className="h-11 w-full capitalize">
              <SelectValue placeholder={dict.exercises.equipment} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{dict.exercises.allEquipment}</SelectItem>
              {equipment.map((e) => (
                <SelectItem key={e} value={e}>
                  {equipmentLabelFrom(dict, e).title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="f-target" className="sr-only">
            {dict.exercises.muscle}
          </Label>
          <Select
            value={params.get("target") ?? ANY}
            onValueChange={(v) => apply({ target: v })}
          >
            <SelectTrigger id="f-target" className="h-11 w-full capitalize">
              <SelectValue placeholder={dict.exercises.muscle} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{dict.exercises.allMuscles}</SelectItem>
              {targets.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="f-diff" className="sr-only">
            {dict.exercises.difficulty}
          </Label>
          <Select
            value={params.get("difficulty") ?? ANY}
            onValueChange={(v) => apply({ difficulty: v })}
          >
            <SelectTrigger id="f-diff" className="h-11 w-full capitalize">
              <SelectValue placeholder={dict.exercises.difficulty} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{dict.exercises.anyDifficulty}</SelectItem>
              {difficulties.map((d) => (
                <SelectItem key={d} value={d}>
                  {(dict.experience as Record<string, { title: string }>)[d]?.title ?? d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() =>
            apply({
              q: null,
              bodyPart: null,
              target: null,
              equipment: null,
              difficulty: null,
            })
          }
        >
          <X className="size-3.5" aria-hidden="true" />
          {dict.exercises.clearFilters}
        </Button>
      ) : null}
    </div>
  );
}
