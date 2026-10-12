/*! Recov web-form embed v1 — no dependencies, no cookies set.
 * <form data-recov-form="https://api.example.com/v1/ingest/forms/KEY"> … </form>
 * <script src="https://app.example.com/embed/v1.js" async></script>
 * Optional: data-recov-success="Thanks!" on the form; a consent checkbox with data-recov-consent (its label
 * text is sent as consent_text); data-recov-lang="en|bn|ar" for default messages (else the page language);
 * data-recov-otp="1" asks for an SMS code before sending (the OTP step loads on demand from embed/otp-v1.js).
 */
(function () {
  "use strict";
  var KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
  var STORE = "recov_attr";
  var BASE = ((document.currentScript || {}).src || "").replace(/[^/]*$/, "");
  var otpLoading = null;
  function loadOTP() {
    otpLoading = otpLoading || new Promise(function (ok, fail) {
      var s = document.createElement("script");
      s.src = BASE + "otp-v1.js";
      s.onload = function () { ok(window.RecovOTP); };
      s.onerror = fail;
      document.head.appendChild(s);
    });
    return otpLoading;
  }
  var MSG = {
    bn: { ok: "ধন্যবাদ! আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব।", fail: "পাঠানো যায়নি। আবার চেষ্টা করুন।", sending: "পাঠানো হচ্ছে…" },
    en: { ok: "Thank you! We'll contact you shortly.", fail: "Couldn't send. Please try again.", sending: "Sending…" },
    ar: { ok: "شكرًا لك! سنتواصل معك قريبًا.", fail: "تعذّر الإرسال. حاول مرة أخرى.", sending: "جارٍ الإرسال…" },
  };

  function read(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }

  // First touch of the browsing session wins (click ids can't be recovered later; sessionStorage, no cookies).
  function attribution() {
    var saved = {};
    try {
      saved = JSON.parse(sessionStorage.getItem(STORE) || "{}");
    } catch (e) {}
    var q = new URLSearchParams(location.search);
    var fresh = false;
    KEYS.forEach(function (k) {
      var v = q.get(k);
      if (v && !saved[k]) {
        saved[k] = v;
        fresh = true;
      }
    });
    if (!saved.landing_page) {
      saved.landing_page = location.href.slice(0, 2000);
      saved.referrer = document.referrer.slice(0, 2000);
      fresh = true;
    }
    if (fresh) {
      try {
        sessionStorage.setItem(STORE, JSON.stringify(saved));
      } catch (e) {}
    }
    return saved;
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  function status(form, text, kind) {
    var el = form.querySelector("[data-recov-status]");
    if (!el) {
      el = document.createElement("p");
      el.setAttribute("data-recov-status", "");
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      form.appendChild(el);
    }
    el.textContent = text;
    el.style.color = kind === "fail" ? "#b42318" : kind === "ok" ? "#0f7a3d" : "";
  }

  function attach(form) {
    if (form.__recov) return;
    form.__recov = true;
    var attr = attribution();
    var lang = (form.getAttribute("data-recov-lang") || document.documentElement.lang || "en").slice(0, 2);
    var msg = MSG[lang] || MSG.en;
    // Honeypot: invisible to people, tempting to bots.
    var hp = document.createElement("input");
    hp.type = "text";
    hp.name = "_hp";
    hp.tabIndex = -1;
    hp.autocomplete = "off";
    hp.setAttribute("aria-hidden", "true");
    hp.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;opacity:0";
    form.appendChild(hp);
    var submissionId = uuid(); // stable across retries of the same submission → no duplicates

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var button = form.querySelector("[type=submit]");
      var data = {};
      new FormData(form).forEach(function (v, k) {
        if (typeof v === "string") data[k] = v;
      });
      Object.keys(attr).forEach(function (k) {
        if (!data[k]) data[k] = attr[k];
      });
      var fbc = read("_fbc"), fbp = read("_fbp");
      if (fbc) data.fbc = fbc;
      if (fbp) data.fbp = fbp;
      var consent = form.querySelector("[data-recov-consent]");
      if (consent) {
        data.whatsapp_opt_in = consent.checked ? "true" : "false";
        var label = consent.id && form.querySelector('label[for="' + consent.id + '"]');
        data.consent_text = ((label || consent.closest("label") || {}).textContent || "").trim().slice(0, 500);
      }
      data._submission_id = submissionId;
      var endpoint = form.getAttribute("data-recov-form");
      if (form.hasAttribute("data-recov-otp") && !data._otp_proof) {
        // Phone verification first; the step calls back with a one-time proof.
        loadOTP().then(function (otp) {
          otp(form, endpoint, data.phone || data.mobile || "", lang, function (proof) {
            var hidden = form.querySelector("input[name=_otp_proof]") || document.createElement("input");
            hidden.type = "hidden";
            hidden.name = "_otp_proof";
            hidden.value = proof;
            form.appendChild(hidden);
            form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
          });
        }, function () {
          status(form, msg.fail, "fail");
        });
        return;
      }
      if (button) button.disabled = true;
      status(form, msg.sending);
      // text/plain keeps this a simple CORS request (no preflight); the API parses it as JSON.
      fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(data), keepalive: true })
        .then(function (r) {
          if (!r.ok) throw new Error(String(r.status));
          form.reset();
          var used = form.querySelector("input[name=_otp_proof]");
          if (used) used.remove(); // a proof is spent once
          submissionId = uuid();
          status(form, form.getAttribute("data-recov-success") || msg.ok, "ok");
          form.dispatchEvent(new CustomEvent("recov:submitted", { bubbles: true }));
        })
        .catch(function () {
          status(form, msg.fail, "fail"); // values stay in the form for a retry
        })
        .then(function () {
          if (button) button.disabled = false;
        });
    });
  }

  function scan() {
    var forms = document.querySelectorAll("form[data-recov-form]");
    for (var i = 0; i < forms.length; i++) attach(forms[i]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
  window.Recov = { scan: scan };
})();
