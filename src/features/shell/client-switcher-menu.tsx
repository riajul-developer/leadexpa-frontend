"use client";

import { Check } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useClients } from "@/shared/lib/lookups";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown";

import { ClientSwitcherButton } from "./client-switcher";

export function ClientSwitcherMenu({ defaultOpen }: { defaultOpen?: boolean }) {
  const t = useTranslations("shell");
  const active = useActiveClient();
  const { clients } = useClients();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const select = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("client", id);
    else next.delete("client");
    next.delete("cursor");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
  const visible = clients.filter((c) => c.status === "active");
  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>
        <ClientSwitcherButton />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[60dvh] overflow-y-auto">
        <DropdownMenuItem onSelect={() => select(null)}>
          {!active ? <Check aria-hidden /> : <span className="size-4" />}
          {t("allClients")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {visible.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => select(c.id)}>
            {c.id === active ? <Check aria-hidden /> : <span className="size-4" />}
            <span className="truncate">{c.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
