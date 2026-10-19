import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { Button } from "./button";
import { DialogModal } from "./dialog";
import { SheetModal } from "./sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = { title: "UI/Overlays" } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function DialogDemo() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <DialogModal
        open={open}
        onOpenChange={setOpen}
        title="লিড হারানো হিসেবে চিহ্নিত করবেন?"
        description="কারণ বেছে নিন"
      >
        <div className="flex justify-end gap-2 p-4">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => setOpen(false)}>
            Mark lost
          </Button>
        </div>
      </DialogModal>
    </>
  );
}

function SheetDemo({ side }: { side: "right" | "bottom" }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open sheet</Button>
      <SheetModal open={open} onOpenChange={setOpen} title="রহিমা খাতুন" side={side}>
        <p className="p-4 text-sm">Lead detail goes here.</p>
      </SheetModal>
    </>
  );
}

export const Dialog: Story = { render: () => <DialogDemo /> };
export const SheetRight: Story = { render: () => <SheetDemo side="right" /> };
export const SheetBottom: Story = { render: () => <SheetDemo side="bottom" /> };

export const TabsStory: Story = {
  name: "Tabs",
  render: () => (
    <Tabs defaultValue="timeline">
      <TabsList>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="info">Info</TabsTrigger>
        <TabsTrigger value="sales">Sales</TabsTrigger>
      </TabsList>
      <TabsContent value="timeline" className="p-3 text-sm">
        Timeline
      </TabsContent>
      <TabsContent value="info" className="p-3 text-sm">
        Info
      </TabsContent>
      <TabsContent value="sales" className="p-3 text-sm">
        Sales
      </TabsContent>
    </Tabs>
  ),
};
