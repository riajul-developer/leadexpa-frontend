"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import {
  BarChart3,
  Building2,
  FileText,
  Inbox,
  KanbanSquare,
  Plug,
  Search,
  Settings,
  Sparkles,
  Table2,
  User,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { api, unwrap } from "@/shared/lib/api/client";
import { toLatinDigits } from "@/shared/lib/format";
import { useClients } from "@/shared/lib/lookups";
import { useCan } from "@/shared/lib/session";
import { StageBadge } from "@/shared/ui/badges";

const PAGES = [
  { href: "/inbox", key: "inbox", icon: Inbox },
  { href: "/leads", key: "leads", icon: Table2 },
  { href: "/pipeline", key: "pipeline", icon: KanbanSquare },
  { href: "/dashboard", key: "dashboard", icon: BarChart3 },
  { href: "/clients", key: "clients", icon: Building2 },
  { href: "/reports", key: "reports", icon: FileText },
  { href: "/integrations", key: "integrations", icon: Plug },
  { href: "/settings/profile", key: "settings", icon: Settings },
] as const;

export function CommandPaletteDialog({
  open,
  onOpenChange: setOpen,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("shell.palette");
  const tn = useTranslations("nav");
  const router = useRouter();
  const canReadAll = useCan("lead.read");
  const canReadOwn = useCan("lead.read.own");
  const canSearch = canReadAll || canReadOwn;
  const { byId } = useClients();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(toLatinDigits(query.trim())), 250);
    return () => clearTimeout(id);
  }, [query]);

  const leads = useQuery({
    queryKey: ["palette", debounced],
    queryFn: () => unwrap(api.GET("/v1/leads", { params: { query: { q: debounced, limit: 8 } } })),
    enabled: open && canSearch && debounced.length >= 2,
    meta: { silent: true },
  });
  const trimmed = query.trim();
  const canAsk = canSearch && trimmed.length >= 4;
  const looksLikeQuestion = trimmed.split(/\s+/).length >= 3 || /[?？؟]$/.test(trimmed);
  const askGroup = canAsk && (
    <Command.Group
      heading={t("ask")}
      className="[&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs"
    >
      <Command.Item
        value="ask"
        onSelect={() => go(`/ask?q=${encodeURIComponent(trimmed)}`)}
        className="data-[selected=true]:bg-surface-2 flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm"
      >
        <Sparkles className="text-accent size-4" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{t("askItem", { question: trimmed })}</span>
      </Command.Item>
    </Command.Group>
  );
  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="border-border bg-surface shadow-pop fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-md border"
        >
          <DialogPrimitive.Title className="sr-only">{t("title")}</DialogPrimitive.Title>
          <Command shouldFilter={false} label={t("title")}>
            <div className="border-border flex items-center gap-2 border-b px-3">
              <Search className="text-muted size-4" aria-hidden />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={t("placeholder")}
                className="placeholder:text-muted h-12 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="text-muted px-3 py-6 text-center text-sm">{t("empty")}</Command.Empty>
              {looksLikeQuestion && askGroup}
              {leads.data && leads.data.data.length > 0 && (
                <Command.Group
                  heading={t("leads")}
                  className="[&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs"
                >
                  {leads.data.data.map((l) => (
                    <Command.Item
                      key={l.id}
                      value={`lead-${l.id}`}
                      onSelect={() => go(`/leads/${l.id}`)}
                      className="data-[selected=true]:bg-surface-2 flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm"
                    >
                      <User className="text-muted size-4" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">
                        {l.full_name || l.phone?.display || "—"}
                        <span className="text-muted"> · {byId.get(l.client_id)?.name ?? ""}</span>
                      </span>
                      <StageBadge stage={l.stage} />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {!looksLikeQuestion && askGroup}
              <Command.Group
                heading={t("pages")}
                className="[&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs"
              >
                {PAGES.filter((p) => !query || tn(p.key).toLowerCase().includes(query.toLowerCase())).map((p) => (
                  <Command.Item
                    key={p.href}
                    value={p.href}
                    onSelect={() => go(p.href)}
                    className="data-[selected=true]:bg-surface-2 flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm"
                  >
                    <p.icon className="text-muted size-4" aria-hidden />
                    {tn(p.key)}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
