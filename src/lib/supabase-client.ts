/**
 * Coco VIP - Supabase Client for Frontend
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hrsjwpbamfszaldctbgv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc2p3cGJhbWZzemFsZGN0Ymd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjY0NzMsImV4cCI6MjA4OTcwMjQ3M30.a7kbfUdnsbJlLdiX401F42E3S9r0d3-8JiYG0ODPWPw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export default supabase;
