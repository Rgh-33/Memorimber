"use server";

import { redirect } from "next/navigation";
import {
  getSafePostUsernameRedirect,
  USERNAME_ONBOARDING_PATH,
  validateProfileUsername,
} from "@/lib/profile-username";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function onboardingFailurePath(code: string, next: string) {
  return `${USERNAME_ONBOARDING_PATH}?${new URLSearchParams({ error: code, next })}`;
}

export async function setInitialUsername(formData: FormData) {
  const next = getSafePostUsernameRedirect(formData.get("next"));
  if (!isSupabaseConfigured()) redirect(onboardingFailurePath("configuration", next));

  const validation = validateProfileUsername(formData.get("username"));
  if (validation.error) redirect(onboardingFailurePath(validation.error, next));

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect(`/login?${new URLSearchParams({ next })}`);
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: validation.username })
    .eq("id", user.id)
    .select("display_name")
    .single();

  if (error || data?.display_name !== validation.username) {
    redirect(onboardingFailurePath("save_failed", next));
  }

  redirect(next);
}
