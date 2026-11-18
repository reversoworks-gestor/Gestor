import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import interUrl from "@fontsource/inter/files/inter-latin-400-normal.woff?url";
import { sanitizeFileName } from "./finance";
import { wrapText, type PublicStudio } from "./pdf";

/**
 * Vehicle check-in form, in American English, for the customer to sign before work starts.
 * Draft text: review with an attorney before relying on it. Cancellation, deposit, payment
 * and warranty clauses are intentionally absent until the owner decides them.
 */
export const SERVICE_TERMS_EN = [
  "1. Estimates. Estimates are based on the vehicle's condition at evaluation. If we find additional work is needed, we will tell you and get your approval before proceeding.",
  "2. Vehicle condition. We document the vehicle's condition at check-in. We are not responsible for pre-existing damage, worn or previously repaired paint, or items left in the vehicle.",
  "3. Limits of the work. Results depend on the vehicle's condition. Some damage cannot be fully repaired, for example creased or stretched metal, cracked or previously repainted paint, deep scratches, or headlight damage inside the lens. We will explain the expected outcome before work begins. We do not guarantee a specific result.",
  "4. Paintless Dent Repair. PDR keeps the original paint when the paint is intact. If paint is cracked, chipped or previously refinished, PDR may not be possible or may not be complete. We will tell you before we start.",
  "5. Coatings, PPF and products. Care instructions from the product manufacturer apply after service. Cure and maintenance instructions will be given at delivery.",
  "6. Photos. We photograph vehicles before, during and after service for our records. Use in marketing requires your separate permission.",
];

export const CHECKIN_ACKNOWLEDGMENTS = [
  "I confirm the condition above and the photos taken today are accurate.",
  "I understand the final result depends on the vehicle's existing condition and the limits explained to me.",
  "I understand Reverso Works is not responsible for personal items left in the vehicle.",
  "I authorize the services listed above.",
];

export type CheckinInput = {
  studio?: PublicStudio;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicle: {
    year?: number | string;
    make?: string;
    model?: string;
    color?: string;
    plate?: string;
    vin?: string;
  };
  services?: string;
  date?: string;
};

const PAGE_W = 612,
  PAGE_H = 792,
  LEFT = 40,
  WIDTH = 532;

export async function createCheckinPdf(
  input: CheckinInput,
  assets?: { fontBytes: Uint8Array }
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Vehicle Check-In · ${input.customerName}`);
  pdf.setAuthor("Reverso Works");
  const fontBytes =
    assets?.fontBytes ??
    new Uint8Array(await (await fetch(interUrl)).arrayBuffer());
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const ink = rgb(0.07, 0.07, 0.07),
    gray = rgb(0.4, 0.4, 0.4),
    line = rgb(0.7, 0.7, 0.7);
  const page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 44;

  page.drawText((input.studio?.studioName || "Reverso Works").toUpperCase(), {
    x: LEFT,
    y,
    size: 18,
    font,
    color: ink,
  });
  page.drawText("Vehicle Check-In Form", {
    x: LEFT,
    y: y - 16,
    size: 10,
    font,
    color: gray,
  });
  const contact = [input.studio?.phone, input.studio?.email]
    .filter(Boolean)
    .join("  ·  ");
  if (contact)
    page.drawText(contact, {
      x: PAGE_W - 40 - font.widthOfTextAtSize(contact, 8.5),
      y: y - 2,
      size: 8.5,
      font,
      color: gray,
    });
  y -= 28;
  page.drawLine({
    start: { x: LEFT, y },
    end: { x: LEFT + WIDTH, y },
    color: ink,
    thickness: 1.2,
  });
  y -= 10;

  function row(cells: Array<[string, string, number]>, height = 30) {
    let x = LEFT;
    const top = y;
    for (const [label, value, share] of cells) {
      const w = WIDTH * share;
      page.drawRectangle({
        x,
        y: top - height,
        width: w,
        height,
        borderColor: line,
        borderWidth: 0.6,
      });
      page.drawText(label.toUpperCase(), {
        x: x + 5,
        y: top - 9,
        size: 6.2,
        font,
        color: gray,
      });
      if (value) {
        const text = wrapText(value, font, 9.5, w - 10)[0] ?? "";
        page.drawText(text, { x: x + 5, y: top - 21, size: 9.5, font, color: ink });
      }
      x += w;
    }
    y -= height + 5;
  }
  function heading(text: string) {
    y -= 6;
    page.drawText(text, { x: LEFT, y, size: 10, font, color: ink });
    y -= 8;
  }

  const v = input.vehicle;
  row([
    ["Date", input.date ?? "", 0.34],
    ["Time in", "", 0.33],
    ["Promised pickup", "", 0.33],
  ]);
  row([
    ["Customer", input.customerName, 0.4],
    ["Phone", input.customerPhone ?? "", 0.25],
    ["Email", input.customerEmail ?? "", 0.35],
  ]);
  row([
    ["Year", v.year ? String(v.year) : "", 0.16],
    ["Make", v.make ?? "", 0.28],
    ["Model", v.model ?? "", 0.34],
    ["Color", v.color ?? "", 0.22],
  ]);
  row([
    ["Plate", v.plate ?? "", 0.25],
    ["VIN", v.vin ?? "", 0.4],
    ["Odometer", "", 0.2],
    ["Fuel", "", 0.15],
  ]);
  row([["Services approved", input.services ?? "", 1]], 34);

  heading("Existing condition (scratches, dents, chips, cracks, loose parts. Write \"ok\" if none)");
  row([
    ["Front", "", 0.34],
    ["Driver side", "", 0.33],
    ["Rear", "", 0.33],
  ]);
  row([
    ["Passenger side", "", 0.34],
    ["Roof / Hood", "", 0.33],
    ["Glass", "", 0.33],
  ]);
  row([
    ["Wheels", "", 0.34],
    ["Interior", "", 0.33],
    ["Headlights", "", 0.33],
  ]);
  row([
    ["Personal items left in vehicle", "", 0.5],
    ["Warning lights on", "", 0.5],
  ]);
  row([
    ["Previous repairs or repainted panels the customer knows about", "", 1],
  ]);

  heading("Customer acknowledgments");
  for (const text of CHECKIN_ACKNOWLEDGMENTS) {
    for (const [i, l] of wrapText(text, font, 8.5, WIDTH - 14).entries()) {
      page.drawText(i === 0 ? `•  ${l}` : l, {
        x: LEFT + (i === 0 ? 0 : 10),
        y,
        size: 8.5,
        font,
        color: ink,
      });
      y -= 11.5;
    }
  }
  const consent = wrapText(
    "[   ]  I allow Reverso Works to use before-and-after photos of my vehicle in marketing, with no plate, VIN or personal information shown. (Optional. Declining does not affect service.)",
    font,
    8.5,
    WIDTH
  );
  for (const l of consent) {
    page.drawText(l, { x: LEFT, y, size: 8.5, font, color: ink });
    y -= 11.5;
  }

  y -= 30;
  for (const [x, label] of [
    [LEFT, "Customer signature / Date"],
    [LEFT + WIDTH / 2 + 15, "Reverso Works representative / Date"],
  ] as Array<[number, string]>) {
    page.drawLine({
      start: { x, y },
      end: { x: x + WIDTH / 2 - 15, y },
      color: ink,
      thickness: 0.7,
    });
    page.drawText(label, { x, y: y - 10, size: 7.5, font, color: gray });
  }
  y -= 30;
  page.drawLine({
    start: { x: LEFT, y },
    end: { x: LEFT + WIDTH, y },
    color: line,
    thickness: 0.5,
  });
  y -= 12;
  page.drawText("Service Terms", { x: LEFT, y, size: 8.5, font, color: ink });
  y -= 11;
  for (const term of SERVICE_TERMS_EN)
    for (const l of wrapText(term, font as PDFFont, 7.2, WIDTH)) {
      page.drawText(l, { x: LEFT, y, size: 7.2, font, color: gray });
      y -= 9.2;
    }

  const bytes = await pdf.save();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: "application/pdf" });
}

export async function downloadCheckinPdf(input: CheckinInput) {
  const blob = await createCheckinPdf(input);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeFileName(input.customerName)}-check-in-${sanitizeFileName(
    [input.vehicle.make, input.vehicle.model].filter(Boolean).join("-") || "vehicle"
  )}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
