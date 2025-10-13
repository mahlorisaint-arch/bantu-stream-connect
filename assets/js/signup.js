// ------------------ CONFIG ------------------
import { supabase } from './config.js'; // uses your config.js exports
const SIGNUPS_TABLE = 'signups';
const REFERRALS_TABLE = 'referrals';
const SITE_URL = "https://bantustreamconnect.com";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxzeAevE3TwQBsRZ7uDAobEB0779iRClKo_rlyM3bfA5nmFLAQmxkvMBeIO6h2xitKDrw/exec";

// ------------------ HELPER FUNCTIONS ------------------

// Generate a unique referral code
function generateReferralCode(email) {
  const prefix = (email?.split("@")[0] || "anon").substring(0, 5);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${random}`.toLowerCase();
}

// Insert referral if not exists
async function upsertReferral(email, code) {
  try {
    const { data, error } = await supabase
      .from(REFERRALS_TABLE)
      .upsert(
        { email, code, count: 0, created_at: new Date().toISOString() },
        { onConflict: ['email'] }
      );
    if (error) console.error('Error upserting referral:', error);
    return data;
  } catch (err) {
    console.error('Supabase upsert exception:', err);
  }
}

// Increment referral count (if someone used a referral)
async function incrementReferral(referredByCode) {
  if (!referredByCode) return;
  try {
    const { data, error } = await supabase
      .from(REFERRALS_TABLE)
      .select('count')
      .eq('code', referredByCode)
      .single();

    if (!error && data) {
      const newCount = (data.count || 0) + 1;
      await supabase
        .from(REFERRALS_TABLE)
        .update({ count: newCount })
        .eq('code', referredByCode);
    }
  } catch (err) {
    console.error("Error incrementing referral count:", err);
  }
}

// Export signup data to Google Sheets
async function exportToSheet(signupData) {
  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signupData)
    });
    const result = await res.json();
    console.log("Export success:", result);
  } catch (e) {
    console.error("Sheet export failed", e);
  }
}

// ------------------ FORM HANDLER ------------------
export function handleSignupForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const name = formData.get('name')?.trim();
    const email = formData.get('email')?.trim();
    const userType = formData.get('user_type')?.trim();

    if (!name || !email || !userType) {
      alert("Please fill in all required fields.");
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const referredBy = urlParams.get('ref');

    const myCode = generateReferralCode(email);

    // 1️⃣ Save to Supabase signups table
    try {
      const { data, error } = await supabase
        .from(SIGNUPS_TABLE)
        .insert([{
          name,
          email,
          user_type: userType,
          referral_code: myCode,
          referred_by: referredBy || null,
          created_at: new Date().toISOString()
        }]);
      if (error) throw error;
    } catch (err) {
      console.error('Error saving signup:', err);
      alert('There was an error submitting your sign-up. Please try again.');
      return;
    }

    // 2️⃣ Save to referrals table
    await upsertReferral(email, myCode);

    // 3️⃣ Increment referrer count (if applicable)
    if (referredBy) await incrementReferral(referredBy);

    // 4️⃣ Export to Google Sheets
    await exportToSheet({ name, email, user_type: userType, referral_code: myCode, referred_by: referredBy });

    // 5️⃣ Fire Analytics Events
    try {
      // Google Analytics 4
      if (typeof gtag === 'function') {
        gtag('event', 'signup_submitted', {
          method: 'Website Form',
          user_type: userType,
          email_domain: email.split('@')[1]
        });
      }

      // Meta Pixel
      if (typeof fbq === 'function') {
        fbq('track', 'CompleteRegistration', {
          content_name: userType,
          status: 'success',
        });
      }
    } catch (err) {
      console.warn("Analytics tracking failed:", err);
    }

    // 6️⃣ Redirect to thank-you page with referral code
    window.location.href = `${SITE_URL}/thank-you.html?ref=${myCode}`;
  });
}
