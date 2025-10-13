// ------------------ CONFIG ------------------
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { BSCReferral } from './referral.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const SIGNUPS_TABLE = 'signups';
const REFERRALS_TABLE = 'referrals';
const SITE_URL = "https://bantustreamconnect.com";

// ------------------ HELPER FUNCTIONS ------------------

// Generate a unique referral code
function generateReferralCode(email) {
  const prefix = email.split("@")[0].substring(0, 5);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${random}`.toLowerCase();
}

// Insert referral if not exists
async function upsertReferral(email, code) {
  const { data, error } = await supabase
    .from(REFERRALS_TABLE)
    .upsert({ email, code, count: 0, created_at: new Date().toISOString() }, { onConflict: ['email'] });
  if (error) console.error('Error upserting referral:', error);
  return data;
}

// Increment referral count if referred_by exists
async function incrementReferral(referredByCode) {
  if (!referredByCode) return;

  const { data, error } = await supabase.rpc('increment_referral_count', { ref_code: referredByCode });
  if (error) console.error('Error incrementing referral count:', error);
  return data;
}

// ------------------ FORM SUBMISSION HANDLER ------------------
export async function handleSignupForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const name = formData.get('name');
    const email = formData.get('email');
    const userType = formData.get('user_type'); // "user" or "creator"
    
    // Check for referral in URL
    const urlParams = new URLSearchParams(window.location.search);
    const referredBy = urlParams.get('ref'); // code from ?ref=

    // Generate referral code for this new user
    const myCode = generateReferralCode(email);

    // Save to Supabase signups
    const { data: signupData, error: signupError } = await supabase
      .from(SIGNUPS_TABLE)
      .insert([{
        name,
        email,
        user_type: userType,
        referral_code: myCode,
        referred_by: referredBy || null,
        created_at: new Date().toISOString()
      }]);

    if (signupError) {
      console.error('Error saving signup:', signupError);
      alert('There was an error submitting your sign-up. Please try again.');
      return;
    }

    // Save referral in local storage & Supabase
    BSCReferral.saveReferral(email); // localStorage
    await upsertReferral(email, myCode);

    // Increment referral count if applicable
    if (referredBy) await incrementReferral(referredBy);

    // Redirect to thank-you page with their referral code
    window.location.href = `${SITE_URL}/thank-you.html?ref=${myCode}`;
  });
}
