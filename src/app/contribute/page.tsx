import { Suspense } from 'react';
import { ContributeWizard } from '@/components/Editor/ContributeWizard';
import Link from 'next/link';

export const metadata = {
  title: 'Contribute a Route — Alexandria Transit',
  description: 'Add a missing public transport route to the network',
};

export default function ContributePage() {
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border/50 bg-background/95 backdrop-blur-xl flex items-center justify-between px-4 z-30 relative flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-bold text-lg hidden sm:inline">
              Alexandria Transit
            </span>
          </Link>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="text-sm font-medium">Contribute</span>
        </div>

        <Link
          href="/"
          className="text-sm px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
        >
          Back to Map
        </Link>
      </header>

      {/* Wizard */}
      <div className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <ContributeWizard />
        </Suspense>
      </div>
    </div>
  );
}
