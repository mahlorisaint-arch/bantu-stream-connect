// Triggered by a Postgres trigger on INSERT into public.copyright_reports.
// Emails support@ so a submitted takedown request doesn't just sit invisible
// in the database - the admin review page is the follow-up action, this is
// the notification that one is waiting.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

Deno.serve(async (req) => {
  const payload = await req.json();
  const record = payload.record;

  if (!record?.id) {
    return new Response("No record id", { status: 400 });
  }

  const subject = `New copyright takedown request #${record.id}`;
  const html = `
    <h2>New copyright takedown request</h2>
    <p><strong>Reporter:</strong> ${record.reporter_name} (${record.reporter_email})</p>
    ${record.reporter_organization ? `<p><strong>Organization:</strong> ${record.reporter_organization}</p>` : ""}
    <p><strong>Reported content:</strong> <a href="${record.content_url}">${record.content_url}</a></p>
    <p><strong>Copyrighted work:</strong><br>${record.copyrighted_work_description}</p>
    <p><strong>Claimed infringement:</strong><br>${record.infringement_description}</p>
    <p><strong>Electronic signature:</strong> ${record.electronic_signature}</p>
    <p>Review and action this request in the admin panel.</p>
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
    console.error("Failed to send copyright report notification email:", await resendResp.text());
    return new Response("Email send failed", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
