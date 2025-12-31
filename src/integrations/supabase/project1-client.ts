/**
 * Secondary Supabase client for Project 1 (FreshTrack Pro - the other project)
 *
 * This client is used to query the profiles table in Project 1 to auto-fill
 * the Multi-Tenant Test Context form with user data.
 *
 * Environment Variables Required:
 * - VITE_P1_URL: The Supabase URL for Project 1
 * - VITE_P1_ANON_KEY: The anon/public key for Project 1
 *
 * Note: Make sure the profiles table in Project 1 has RLS policies
 * that allow public read access with the anon key.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const P1_URL = import.meta.env.VITE_P1_URL;
const P1_ANON_KEY = import.meta.env.VITE_P1_ANON_KEY;

let project1Client: SupabaseClient | null = null;

/**
 * Check if Project 1 credentials are configured
 */
export function isProject1Configured(): boolean {
  return Boolean(P1_URL && P1_ANON_KEY);
}

/**
 * Get the Project 1 Supabase client
 * Returns null if credentials are not configured
 */
export function getProject1Client(): SupabaseClient | null {
  if (!isProject1Configured()) {
    return null;
  }

  if (!project1Client) {
    project1Client = createClient(P1_URL, P1_ANON_KEY, {
      auth: {
        // Disable auth features since we're just using the anon key for public reads
        persistSession: false,
        autoRefreshToken: false,
      }
    });
  }

  return project1Client;
}

/**
 * Profile type for search results from Project 1
 */
export interface Project1Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  organization_id: string | null;
  site_id: string | null;
  unit_id: string | null;
}
