// src/lib/gtm.ts

import { getCurrencyCodeSync, getCurrencyCodeAsync } from './utils';

// This is our currency. Pulled from store context or fallback.
export const GTM_CURRENCY = getCurrencyCodeSync() || "BDT";
export const getGtmCurrencyAsync = async () => (await getCurrencyCodeAsync()) || "BDT";

/**
 * This function creates the "secret handshake" (event_id).
 * It makes a unique code for every single message we send to prevent duplicates.
 */
export const generateEventId = () => {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2)}`;
};

// Define proper type for GTM payload
interface GTMPayload {
  ecommerce?: {
    currency?: string;
    value?: number;
    transaction_id?: string;
    payment_type?: string;
    items?: Array<{
      item_id: string;
      item_name?: string;
      price?: number;
      quantity?: number;
      item_category?: string;
      google_business_vertical?: string;
    }>;
  };
  event_id?: string;
  [key: string]: unknown;
}

/**
 * This is our personal mailman. It puts messages into the `dataLayer`.
 * The dataLayer is a special list that Google Tag Manager is always watching.
 */
export const pushDL = (event: string, payload: GTMPayload) => {
  // Make sure the dataLayer exists, just in case.
  window.dataLayer = window.dataLayer || [];
  
  // GTM events are pushed to dataLayer (no console logging)

  // Here's the magic: we push the event and its details to the list.
  window.dataLayer.push({
    event,
    ...payload,
  });
};
