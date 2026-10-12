/*! Recov web-form OTP step v1 — loaded by embed/v1.js only for forms with data-recov-otp="1".
 * Sends a 6-digit SMS code to the phone typed into the form, verifies it, and hands the one-time proof back
 * so the form submission carries _otp_proof. No dependencies, no cookies.
 */
(function () {
  "use strict";
  var T = {
    en: { sent: "We sent a 6-digit code to {p}.", code: "Verification code", verify: "Confirm", resend: "Resend code", wait: "Resend in {s}s", bad: "That code isn't right.", fail: "Couldn't send the code. Try again." },
    bn: { sent: "{p} নম্বরে ৬ সংখ্যার কোড পাঠানো হয়েছে।", code: "যাচাই কোড", verify: "নিশ্চিত করুন", resend: "আবার কোড পাঠান", wait: "{s} সেকেন্ড পর আবার পাঠানো যাবে", bad: "কোডটি সঠিক নয়।", fail: "কোড পাঠানো যায়নি। আবার চেষ্টা করুন।" },
    ar: { sent: "أرسلنا رمزًا من 6 أرقام إلى {p}.", code: "رمز التحقق", verify: "تأكيد", resend: "إعادة إرسال الرمز", wait: "إعادة الإرسال بعد {s} ث", bad: "الرمز غير صحيح.", fail: "تعذّر إرسال الرمز. حاول مرة أخرى." },
  };

  function post(url, body) {
    // text/plain keeps it a simple CORS request (no preflight); the API reads the JSON body.
    return fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body) }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw j;
        return j;
      });
    });
  }

  window.RecovOTP = function (form, endpoint, phone, lang, done) {
    var t = T[lang] || T.en;
    var box = form.querySelector("[data-recov-otp-box]");
    if (box) box.remove();
    box = document.createElement("div");
    box.setAttribute("data-recov-otp-box", "");
    box.setAttribute("role", "group");
    box.style.cssText = "margin:8px 0;display:grid;gap:6px";
    var info = document.createElement("p");
    info.setAttribute("aria-live", "polite");
    var input = document.createElement("input");
    input.autocomplete = "one-time-code";
    input.inputMode = "numeric";
    input.maxLength = 6;
    input.setAttribute("aria-label", t.code);
    input.placeholder = "••••••";
    var verify = document.createElement("button");
    verify.type = "button";
    verify.textContent = t.verify;
    var resend = document.createElement("button");
    resend.type = "button";
    box.append(info, input, verify, resend);
    form.appendChild(box);
    var challenge = null, timer = null;

    function countdown() {
      var left = 30;
      resend.disabled = true;
      clearInterval(timer);
      timer = setInterval(function () {
        left -= 1;
        resend.textContent = left > 0 ? t.wait.replace("{s}", left) : t.resend;
        if (left <= 0) {
          clearInterval(timer);
          resend.disabled = false;
        }
      }, 1000);
      resend.textContent = t.wait.replace("{s}", left);
    }

    function send() {
      info.textContent = "…";
      post(endpoint + "/otp", { phone: phone, lang: lang })
        .then(function (r) {
          challenge = r.challenge_id;
          info.textContent = t.sent.replace("{p}", phone);
          input.focus();
          countdown();
        })
        .catch(function () {
          info.textContent = t.fail;
          resend.disabled = false;
          resend.textContent = t.resend;
        });
    }

    verify.addEventListener("click", function () {
      if (!challenge) return;
      verify.disabled = true;
      post(endpoint + "/otp/verify", { challenge_id: challenge, code: input.value })
        .then(function (r) {
          clearInterval(timer);
          box.remove();
          done(r.proof);
        })
        .catch(function () {
          info.textContent = t.bad;
          input.select();
        })
        .then(function () {
          verify.disabled = false;
        });
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        verify.click();
      }
    });
    resend.addEventListener("click", send);
    send();
  };
})();
