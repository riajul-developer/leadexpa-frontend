import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Inbox } from "lucide-react";
import { Toaster } from "sonner";

import { toast } from "../lib/toast";

import { Button } from "./button";
import { Avatar, Badge, Card, EmptyState, Skeleton, Spinner } from "./primitives";

const meta = { title: "UI/Primitives" } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => (
    <Card>
      <EmptyState
        icon={Inbox}
        title="সব লিডের উত্তর দেওয়া হয়েছে"
        description="নতুন লিড এলে এখানে দেখাবে।"
        action={<Button variant="secondary">Add a test lead</Button>}
      />
    </Card>
  ),
};

/** Skeletons keep the final layout's size, so first paint never shifts. */
export const Skeletons: Story = {
  render: () => (
    <div className="grid max-w-md gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  ),
};

/** Bangla names keep whole grapheme clusters as initials. */
export const Avatars: Story = {
  render: () => (
    <div className="flex gap-2">
      {["রহিমা খাতুন", "ক্ষমা রায়", "Tanvir Hasan", "শাহরিয়ার"].map((n) => (
        <Avatar key={n} name={n} />
      ))}
      <Avatar name="Nusrat Jahan" size="sm" />
    </div>
  ),
};

export const Badges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(["neutral", "primary", "success", "warning", "danger", "info"] as const).map((tone) => (
        <Badge key={tone} tone={tone}>
          {tone}
        </Badge>
      ))}
    </div>
  ),
};

export const Loading: Story = { render: () => <Spinner label="লোড হচ্ছে…" /> };

export const Toast: Story = {
  render: () => (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => toast.success("Outcome logged")}>Success</Button>
        <Button variant="danger" onClick={() => toast.error("Can't reach the server.")}>
          Error
        </Button>
        <Button variant="secondary" onClick={() => toast.info("৩টি নতুন লিড")}>
          Info
        </Button>
      </div>
      <Toaster position="top-center" richColors closeButton />
    </>
  ),
};
