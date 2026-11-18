/** Customer-facing message templates, American English. Placeholders use {name}. */
export type MessageTemplate = { id: string; title: string; body: string };

export const messageTemplates: MessageTemplate[] = [
  {
    id: "first",
    title: "First reply",
    body: "Hi {name}, thanks for contacting Reverso Works! We're an automotive studio in Fremont focused on dent repair, paint care and headlight restoration. Could you send a few photos of {vehicle} so we can take a look? We work by appointment.",
  },
  {
    id: "photos",
    title: "Photo request",
    body: "Hi {name}! To give you an accurate estimate, please send:\n1. A wide photo of the whole vehicle (front, side and back).\n2. Close-ups of the problem area, in daylight if you can.\n3. A photo from the side at an angle, so we can see the depth of the dent or the haze on the headlight.\n4. Year, make and model, and anything we should know (previous repairs, repainted panels, hail, aftermarket parts).\n\nPhotos give us a starting point. The final quote is confirmed in person.",
  },
  {
    id: "range",
    title: "Price range from photos",
    body: "Hi {name}, based on the photos, this looks like a {service} job. Our estimate range is ${min}-${max}. The final price is confirmed at an in-person evaluation, since we can't see everything in photos. Would you like to schedule a time?",
  },
  {
    id: "notours",
    title: "Service we don't offer",
    body: "Hi {name}, thanks for thinking of us! {service} isn't something we do. For mechanical work we recommend Fremont Foreign Auto. If you ever need dent repair, paint care or headlight restoration, we'd be glad to help.",
  },
  {
    id: "confirm",
    title: "Appointment confirmation",
    body: "Hi {name}, confirming your appointment {day} at {time} for {service} on your {vehicle}. Please remove personal items before you arrive. Reply here if anything changes.",
  },
  {
    id: "followup",
    title: "Estimate follow-up",
    body: "Hi {name}, just checking in on the estimate we sent for your {vehicle}. Happy to answer any questions or adjust the plan. If you'd like to move forward, I can offer {day} at {time}.",
  },
  {
    id: "thanks",
    title: "Thank you after delivery",
    body: "Thank you for trusting Reverso Works with your {vehicle}, {name}. Here are the care instructions for the service we did: {care}. If anything looks off, message me and we'll take a look.",
  },
  {
    id: "review",
    title: "Review request",
    body: "Hi {name}, I hope you're enjoying your {vehicle}. If you have a minute, a review on Google helps a small studio like ours more than you know: {reviewLink}. Thank you!",
  },
  {
    id: "carecheck",
    title: "Care check-in (30-60 days)",
    body: "Hi {name}, checking in on your {vehicle}. {care} No pressure, I'm here when you need it.",
  },
];

/** Unfilled placeholders stay visible as [key] so nothing goes out half-written by accident. */
export function fillTemplate(body: string, values: Record<string, string>) {
  return body.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    return value && value.trim() ? value : `[${key}]`;
  });
}

export function whatsappLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const full = digits.length === 10 ? `1${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
