// Triggered by a Database Webhook on INSERT into public.user_profiles.
// Adds the new user to the Resend "All contacts" audience so announcement
// Broadcasts reach them without a manual CSV re-export.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_AUDIENCE_NAME = "All contacts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getAudienceId(): Promise<string | null> {
  const resp = await fetch("https://api.resend.com/audiences", {
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}` },
  });
  if (!resp.ok) {
    console.error("Failed to list audiences:", await resp.text());
    return null;
  }
  const body = await resp.json();
  const audience = body.data?.find((a: { name: string }) => a.name === RESEND_AUDIENCE_NAME);
  return audience?.id ?? null;
}

Deno.serve(async (req) => {
  const payload = await req.json();
  const record = payload.record;

  if (!record?.id) {
    return new Response("No record id", { status: 400 });
  }

  if (record.marketing_opt_in === false) {
    return new Response("User opted out, skipped", { status: 200 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error } = await supabaseAdmin.auth.admin.getUserById(record.id);

  if (error || !userData?.user?.email) {
    console.error("Could not resolve user email for", record.id, error);
    return new Response("No email found, skipped", { status: 200 });
  }

  const audienceId = await getAudienceId();
  if (!audienceId) {
    console.error(`Could not find Resend audience named "${RESEND_AUDIENCE_NAME}"`);
    return new Response("Audience not found", { status: 500 });
  }

  const firstName = record.full_name || record.username || "";

  const resendResp = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: userData.user.email,
      first_name: firstName,
      unsubscribed: false,
    }),
  });

  if (!resendResp.ok) {
    console.error("Resend contact sync failed:", await resendResp.text());
    return new Response("Resend sync failed", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
