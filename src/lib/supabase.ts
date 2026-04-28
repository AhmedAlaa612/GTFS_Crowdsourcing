'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('Supabase environment variables are missing!');
    return {} as any; 
  }

  console.log('Supabase client initialized with URL:', url.substring(0, 20) + '...');

  return createBrowserClient<Database>(url, key);
}
