/**
 * Frontend SMS sender (token visible to users - use only for testing).
 * For production create a backend endpoint that stores the token server-side.
 */
import { getCurrencySymbolSync } from "@/lib/utils";

export async function sendOrderConfirmationSms(opts: {
  orderId: string | number;
  total: string | number;
  phone: string | undefined | null;
}) {
  const token = process.env.VITE_GREENWEB_SMS_TOKEN;
  if (!token) {
    console.warn("SMS: Missing VITE_GREENWEB_SMS_TOKEN (define in .env.local and restart dev server).");
    return;
  }
  const normalized = normalizeBdPhone(opts.phone || "");
  if (!normalized) {
    console.warn("SMS: Invalid / missing phone:", opts.phone);
    return;
  }

  const message =
    `[Kitchenhero] প্রিয় গ্রাহক,\n` +
    `আপনার Kitchenhero অর্ডার কনফার্ম হয়েছে! অর্ডার আইডি: ${opts.orderId} ` +
    `টোটাল: ${getCurrencySymbolSync()}${opts.total}\u0964\n` + // \u0964 = Bengali danda "।"
    `Thank you.`;

  const form = new URLSearchParams();
  form.append("token", token);
  form.append("to", normalized);
  form.append("message", message);

  try {
    const res = await fetch("https://api.greenweb.com.bd/api.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form
    });
    await res.text();
  } catch (e) {
    console.error("SMS send failed:", e);
  }
}

/**
 * Normalize Bangladeshi numbers to +8801XXXXXXXXX
 * Accepts: 017XXXXXXXX, +88017XXXXXXX, 88017XXXXXXX
 */
export function normalizeBdPhone(raw: string): string | null {
  if (!raw) return null;
  let p = raw.trim();
  p = p.replace(/\s+/g, "").replace(/[^+\d]/g, "");

  // Remove leading 0 if present after country code patterns
  if (p.startsWith("+8800")) p = "+880" + p.slice(5);
  if (p.startsWith("8800")) p = "880" + p.slice(4);

  if (p.startsWith("+8801") && p.length === 14) return p; // +8801 + 9 digits
  if (p.startsWith("8801") && p.length === 13) return "+" + p;
  if (p.startsWith("01") && p.length === 11) return "+880" + p.slice(1);
  return null;
}
