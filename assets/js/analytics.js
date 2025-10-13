// ====== GOOGLE ANALYTICS (GA4) ======
(function() {
  const GA_ID = "G-JZXZCYRJYV";

  // Inject Google tag script dynamically
  const gtagScript = document.createElement("script");
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(gtagScript);

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", GA_ID);

  console.log("✅ GA4 initialized with ID:", GA_ID);
})();


// ====== META PIXEL (FACEBOOK) ======
(function() {
  const PIXEL_ID = "1331891561809016";

  // Inject Meta Pixel script dynamically
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  fbq("init", PIXEL_ID);
  fbq("track", "PageView");

  console.log("✅ Meta Pixel initialized with ID:", PIXEL_ID);
})();


// ====== CUSTOM EVENT TRACKING ======
export function trackEvent(eventName, eventParams = {}) {
  // Google Analytics event
  if (typeof gtag === "function") {
    gtag("event", eventName, eventParams);
  }

  // Meta Pixel event
  if (typeof fbq === "function") {
    fbq("trackCustom", eventName, eventParams);
  }

  console.log(`📊 Event tracked: ${eventName}`, eventParams);
}

// Common tracked events
export function trackSignupSuccess(userType, email) {
  trackEvent("signup_success", {
    user_type: userType,
    email: email,
    source: "landing_page"
  });
}

export function trackReferralUsed(referralCode) {
  trackEvent("referral_used", { referral_code: referralCode });
}

export function trackPageView(pageName) {
  trackEvent("page_view", { page_name: pageName });
}

// Optional: Auto track page view
document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;
  trackPageView(path);
});
