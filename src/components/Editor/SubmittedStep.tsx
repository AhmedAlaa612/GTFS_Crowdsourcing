'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function SubmittedStep() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
          <svg
            className="w-10 h-10 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <div>
          <h2 className="text-2xl font-bold">Contribution Submitted!</h2>
          <p className="text-muted-foreground mt-2">
            Your route contribution is now under review. A reviewer will check
            it and approve it soon. Thank you for helping map Alexandria&apos;s
            transit network!
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button variant="outline" size="lg">
              Back to Map
            </Button>
          </Link>
          <Link href="/contribute">
            <Button size="lg">
              + Add Another Route
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
