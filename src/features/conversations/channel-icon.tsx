"use client";

import { Camera, MessageCircle, MessageSquare, MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";

import type { Channel } from "./api";

const ICON = { whatsapp: MessageCircle, messenger: MessagesSquare, instagram: Camera, sms: MessageSquare } as const;
const TONE = {
  whatsapp: "text-success",
  messenger: "text-primary",
  instagram: "text-danger",
  sms: "text-muted",
} as const;

/** The channel of a conversation, as an icon with its name for screen readers. */
export function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  const t = useTranslations("conversations.channel");
  const Icon = ICON[channel];
  return <Icon className={cn("size-4 shrink-0", TONE[channel], className)} role="img" aria-label={t(channel)} />;
}
