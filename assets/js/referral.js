// --- CONFIG ---
const SITE_URL = "https://bantustreamconnect.com"; // change if testing locally
const REF_STORAGE_KEY = "bsc_referral_code";
const REF_VISITS_KEY = "bsc_referral_visits";

// --- Generate a unique referral code (simple but effective) ---
function generateReferralCode(email) {
  const prefix = email.split("@")[0].substring(0, 5);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${random}`.toLowerCase();
}

// --- Save referral data locally (or later via Supabase) ---
function saveReferral(email) {
  const code = generateReferralCode(email);
  localStorage.setItem(REF_STORAGE_KEY, code);

  // TODO: Supabase integration (save referral in table)
  // await supabase.from("referrals").insert([{ email, code }]);

  return code;
}

// --- Get referral code from localStorage ---
function getReferralCode() {
  return localStorage.getItem(REF_STORAGE_KEY);
}

// --- Handle referral visit (someone clicked a ?ref= link) ---
function handleReferralVisit() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref) {
    const visits = JSON.parse(localStorage.getItem(REF_VISITS_KEY) || "{}");
    visits[ref] = (visits[ref] || 0) + 1;
    localStorage.setItem(REF_VISITS_KEY, JSON.stringify(visits));

    // TODO: Supabase integration (increment referral count)
    // await supabase.from("referrals").update({ count: count + 1 }).eq("code", ref);
  }
}

// --- Display referral info on thank-you page ---
function displayReferralInfo() {
  const code = getReferralCode();
  if (!code) return;

  const link = `${SITE_URL}/?ref=${code}`;
  document.getElementById("ref-link").value = link;

  // Calculate local referral count
  const visits = JSON.parse(localStorage.getItem(REF_VISITS_KEY) || "{}");
  const count = visits[code] || 0;
  document.getElementById("ref-count").textContent = count;
}

// --- Copy referral link ---
function copyReferralLink() {
  const input = document.getElementById("ref-link");
  input.select();
  input.setSelectionRange(0, 99999);
  document.execCommand("copy");

  const btn = document.getElementById("copy-btn");
  btn.textContent = "Copied!";
  setTimeout(() => (btn.textContent = "Copy Link"), 2000);
}

// --- Export globally ---
window.BSCReferral = {
  saveReferral,
  getReferralCode,
  handleReferralVisit,
  displayReferralInfo,
  copyReferralLink,
};
