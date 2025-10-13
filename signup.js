// ------------------ CONFIG ------------------
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { BSCReferral } from './referral.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const SIGNUPS_TABLE = 'signups';
const REFERRALS_TABLE = 'referrals';
const SITE_URL = "https://bantustreamconnect.com";

// ✅ Google Sheets Web App endpoint
const GOOGLE_SHEET_URL =
  "https://script.google.com/macros/s/AKfycbxzeAevE3TwQBsRZ7uDAobEB0779iRClKo_rlyM3bfA5nmFLAQmxkvMBeIO6h2xitKDrw/exec";

// ------------------ HELPER FUNCTIONS ------------------

// Generate a unique referral code
function generateReferralCode(email) {
  const prefix = email.split("@")[0].substring(0, 5);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${random}`.toLowerCase();
}

// Insert or update referral if not exists
async function upsertReferral(email, code) {
  const { data, error } = await supabase
    .from(REFERRALS_TABLE)
    .upsert(
      { email, code, count: 0, created_at: new Date().toISOString() },
      { onConflict: ['email'] }
    );
  if (error) console.error('❌ Error upserting referral:', error);
  return data;
}

// Increment referral count if referred_by exists
async function incrementReferral(referredByCode) {
  if (!referredByCode) return;
  const { data, error } = await supabase.rpc('increment_referral_count', { ref_code: referredByCode });
  if (error) console.error('❌ Error incrementing referral count:', error);
  return data;
}

// ✅ Export signup data to Google Sheets
async function exportToSheet(signupData) {
  try {
    const res = await fetch(GOOGLE_SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signupData),
    });
    const result = await res.json();
    console.log("✅ Exported to Google Sheet:", result);
  } catch (e) {
    console.error("❌ Sheet export failed:", e);
  }
}

// ------------------ ANALYTICS TRACKING ------------------

// Google Analytics 4 tracking helper
function trackGA4Event(eventName, params = {}) {
  if (typeof gtag === "function") {
    gtag("event", eventName, params);
    console.log("📊 GA4 Event:", eventName, params);
  } else {
    console.warn("⚠️ GA4 not initialized on this page");
  }
}

// Meta Pixel tracking helper
function trackMetaEvent(eventName, params = {}) {
  if (typeof fbq === "function") {
    fbq("track", eventName, params);
    console.log("📈 Meta Pixel Event:", eventName, params);
  } else {
    console.warn("⚠️ Meta Pixel not initialized on this page");
  }
}

// ------------------ MAIN FORM SUBMISSION HANDLER ------------------
export async function handleSignupForm(formId) {
  const form = document.getElementById(formId);
  if (!form) {
    console.error(`Form with ID "${formId}" not found.`);
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const name = formData.get("name");
    const email = formData.get("email");
    const userType = formData.get("user_type"); // "user" or "creator"

    // Check for referral in URL (?ref=xxxxx)
    const urlParams = new URLSearchParams(window.location.search);
    const referredBy = urlParams.get("ref");

    // Generate referral code for this new user
    const myCode = generateReferralCode(email);

    // --- 1️⃣ Save to Supabase signups ---
    const { data: signupData, error: signupError } = await supabase
      .from(SIGNUPS_TABLE)
      .insert([
        {
          name,
          email,
          user_type: userType,
          referral_code: myCode,
          referred_by: referredBy || null,
          created_at: new Date().toISOString(),
        },
      ]);

    if (signupError) {
      console.error("❌ Error saving signup:", signupError);
      alert("There was an error submitting your sign-up. Please try again.");
      return;
    }

    // --- 2️⃣ Save referral in local storage & Supabase ---
    BSCReferral.saveReferral(email);
    await upsertReferral(email, myCode);

    // --- 3️⃣ Increment referral count if they were referred ---
    if (referredBy) await incrementReferral(referredBy);

    // --- 4️⃣ Export signup to Google Sheets ---
    const signupExportData = {
      name,
      email,
      user_type: userType,
      referral_code: myCode,
      referred_by: referredBy || "",
    };
    await exportToSheet(signupExportData);

    // --- 5️⃣ Fire Analytics Events ---
    const eventParams = { name, email, user_type: userType, referral_code: myCode };
    trackGA4Event("signup_submitted", eventParams);
    trackMetaEvent("CompleteRegistration", { user_type: userType });

    // --- 6️⃣ Redirect to Thank You page ---
    window.location.href = `${SITE_URL}/thank-you.html?ref=${myCode}`;
  });
}
