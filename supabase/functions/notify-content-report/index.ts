// Triggered by a Postgres trigger on INSERT into public.content_reports.
// Emails support@ so a submitted content report doesn't sit invisible in
// the database, same reasoning as notify-copyright-report. Unlike
// copyright_reports' public anonymous form (which carries full
// human-readable details on the row itself), content_reports only ever
// stores foreign keys (reporter_id, content_id, reported_user_id) - this
// enriches those with the actual content title and reporter/reported
// username via a service-role lookup before emailing, so the report is
// actually useful to read without a separate DB query.
import { createClient } from "npm:@supabase/supabase-js@2.43.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const payload = await req.json();
  const record = payload.record;

  if (!record?.id) {
    return new Response("No record id", { status: 400 });
  }

  const [reporterRes, contentRes, reportedUserRes] = await Promise.all([
    record.reporter_id
      ? supabase.from("user_profiles").select("username, full_name").eq("id", record.reporter_id).maybeSingle()
      : Promise.resolve({ data: null }),
    record.content_id
      ? supabase.from("Content").select("title").eq("id", record.content_id).maybeSingle()
      : Promise.resolve({ data: null }),
    record.reported_user_id
      ? supabase.from("user_profiles").select("username, full_name").eq("id", record.reported_user_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const reporter = reporterRes.data as { username?: string; full_name?: string } | null;
  const content = contentRes.data as { title?: string } | null;
  const reportedUser = reportedUserRes.data as { username?: string; full_name?: string } | null;

  const subject = `New content report #${record.id}${content?.title ? `: "${content.title}"` : ""}`;
  const html = `
    <h2>New content report</h2>
    <p><strong>Reporter:</strong> ${reporter?.username || reporter?.full_name || record.reporter_id || "unknown"}</p>
    ${
      record.content_id
        ? `<p><strong>Reported content:</strong> ${content?.title ? `"${content.title}" ` : ""}(id ${record.content_id})</p>`
        : ""
    }
    ${reportedUser ? `<p><strong>Reported user:</strong> ${reportedUser.username || reportedUser.full_name}</p>` : ""}
    <p><strong>Reason:</strong> ${record.reason}</p>
    ${record.details ? `<p><strong>Details:</strong><br>${record.details}</p>` : ""}
    <p>Review this report in the content_reports table (Supabase dashboard).</p>
  `;

  const resendResp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Bantu Stream Connect <notifications@bantustreamconnect.com>",
      to: "support@bantustreamconnect.com",
      subject,
      html,
    }),
  });

  if (!resendResp.ok) {
    console.error("Failed to send content report notification email:", await resendResp.text());
    return new Response("Email send failed", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
