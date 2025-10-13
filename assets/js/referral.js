// --- CONFIG ---
const SITE_URL = "https://bantustreamconnect.com"; // Change if testing locally
const REF_STORAGE_KEY = "bsc_referral_code";
const REF_VISITS_KEY = "bsc_referral_visits";

// --- SUPABASE SETUP ---
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Generate referral code ---
function generateReferralCode(email) {
  const prefix = email.split("@")[0].substring(0, 5);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${random}`.toLowerCase();
}

// --- Save referral for new user ---
async function saveReferral(email) {
  const code = generateReferralCode(email);
  localStorage.setItem(REF_STORAGE_KEY, code);

  try {
    await supabase.from("referrals").insert([{ email, code, count: 0 }]);
  } catch (err) {
    console.warn("Supabase insert skipped or failed:", err.message);
  }

  return code;
}

// --- Get referral code from localStorage ---
function getReferralCode() {
  return localStorage.getItem(REF_STORAGE_KEY);
}

// --- Handle referral visit (?ref=code) ---
async function handleReferralVisit() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (!ref) return;

  // Save visit locally
  const visits = JSON.parse(localStorage.getItem(REF_VISITS_KEY) || "{}");
  visits[ref] = (visits[ref] || 0) + 1;
  localStorage.setItem(REF_VISITS_KEY, JSON.stringify(visits));

  // Increment count in Supabase
  try {
    const { data, error } = await supabase
      .from("referrals")
      .select("count")
      .eq("code", ref)
      .single();

    if (!error && data) {
      const newCount = (data.count || 0) + 1;
      await supabase.from("referrals").update({ count: newCount }).eq("code", ref);
    }
  } catch (err) {
    console.warn("Referral count update skipped:", err.message);
  }
}

// --- Display referral info on thank-you page ---
async function displayReferralInfo() {
  const code = getReferralCode();
  if (!code) return;

  const link = `${SITE_URL}/?ref=${code}`;
  const linkInput = document.getElementById("referralLink");
  const countDisplay = document.getElementById("referralCount");

  if (linkInput) linkInput.value = link;

  // Local fallback
  const visits = JSON.parse(localStorage.getItem(REF_VISITS_KEY) || "{}");
  let count = visits[code] || 0;

  // Try Supabase fetch
  try {
    const { data, error } = await supabase.from("referrals").select("count").eq("code", code).single();
    if (!error && data && typeof data.count === "number") count = data.count;
  } catch (err) {
    console.warn("Referral count fetch skipped:", err.message);
  }

  if (countDisplay) countDisplay.textContent = count;
}

// --- Copy referral link ---
function copyReferralLink() {
  const input = document.getElementById("referralLink");
  input.select();
  input.setSelectionRange(0, 99999);
  document.execCommand("copy");

  const btn = document.getElementById("copyLink");
  btn.textContent = "Copied!";
  setTimeout(() => (btn.textContent = "Copy"), 2000);
}

// --- Share buttons ---
function setupShareButtons() {
  const link = document.getElementById("referralLink")?.value || `${SITE_URL}`;
  document.getElementById("shareWhatsApp")?.addEventListener("click", () => {
    window.open(`https://wa.me/?text=Join%20Bantu%20Stream%20Connect!%20${encodeURIComponent(link)}`, "_blank");
  });
  document.getElementById("shareTwitter")?.addEventListener("click", () => {
    window.open(`https://twitter.com/intent/tweet?text=Join%20Bantu%20Stream%20Connect!%20${encodeURIComponent(link)}`, "_blank");
  });
  document.getElementById("copyLink")?.addEventListener("click", copyReferralLink);
}

// --- Initialize Thank-You Page ---
export async function initReferralPage() {
  await displayReferralInfo();
  setupShareButtons();
}

// --- Auto-run referral tracking on every page load ---
handleReferralVisit();

// --- Export for other pages ---
export {
  saveReferral,
  getReferralCode,
  handleReferralVisit,
  displayReferralInfo,
  copyReferralLink,
};
