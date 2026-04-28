'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function SidebarDrawer({ open, onClose, title, children }: SidebarDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[420px] p-0 bg-background/95 backdrop-blur-xl border-l border-border/50 overflow-y-auto"
      >
        {title && (
          <SheetHeader className="px-6 py-4 border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur-xl z-10">
            <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
          </SheetHeader>
        )}
        <div className="px-6 py-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
