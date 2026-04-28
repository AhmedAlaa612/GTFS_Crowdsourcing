'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { LoginDialog } from './LoginDialog';
import type { User } from '@supabase/supabase-js';

interface AuthButtonProps {
  initialUser: User | null;
}

const supabase = createClient();

export function AuthButton({ initialUser }: AuthButtonProps) {
  const [showLogin, setShowLogin] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (initialUser) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {initialUser.email}
        </span>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setShowLogin(true)}>
        Login
      </Button>
      <LoginDialog
        open={showLogin}
        onOpenChange={setShowLogin}
        onSuccess={() => {
          setShowLogin(false);
          window.location.reload();
        }}
      />
    </>
  );
}
