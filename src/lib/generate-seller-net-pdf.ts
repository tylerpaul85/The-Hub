import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import logo from "@/assets/msreg-logo.png";

export interface SheetDataForPdf {
  agent_name: string;
  agent_cell: string;
  agent_email: string;
  office_address: string;
  office_phone: string;
  property_address: string;
  num_scenarios: 1 | 2 | 3;
  scenario1_price: number;
  scenario2_price: number;
  scenario3_price: number;
  listing_comm_pct: number;
  selling_comm_pct: number;
  mortgage_payoff_1: number;
  mortgage_payoff_2: number;
  closing_protection_letter: number;
  seller_title_closing_fee: number;
  title_search_fee: number;
  warranty_deed_fee: number;
  termite_letter: number;
  inspections: number;
  home_warranty: number;
  transaction_fee: number;
  estimated_taxes: number;
  miscellaneous: number;
  seller_concessions: number;
}

function formatMoney(amount: number): string {
  if (isNaN(amount)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

async function getBase64ImageFromUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export async function generateSellerNetPdf(data: SheetDataForPdf): Promise<void> {
  const numScenarios = data.num_scenarios || 1;

  const calculateScenario = (salesPrice: number) => {
    const listingComm = salesPrice * ((data.listing_comm_pct || 0) / 100);
    const sellingComm = salesPrice * ((data.selling_comm_pct || 0) / 100);
    const totalComm = listingComm + sellingComm;

    const fixedCosts =
      (data.mortgage_payoff_1 || 0) +
      (data.mortgage_payoff_2 || 0) +
      (data.closing_protection_letter || 0) +
      (data.seller_title_closing_fee || 0) +
      (data.title_search_fee || 0) +
      (data.warranty_deed_fee || 0) +
      (data.termite_letter || 0) +
      (data.inspections || 0) +
      (data.home_warranty || 0) +
      (data.transaction_fee || 0) +
      (data.estimated_taxes || 0) +
      (data.miscellaneous || 0) +
      (data.seller_concessions || 0);

    const totalSellingCosts = totalComm + fixedCosts;
    const cashToSeller = salesPrice - totalSellingCosts;

    return {
      salesPrice,
      listingComm,
      sellingComm,
      totalSellingCosts,
      cashToSeller,
    };
  };

  const c1 = calculateScenario(data.scenario1_price || 0);
  const c2 = calculateScenario(data.scenario2_price || 0);
  const c3 = calculateScenario(data.scenario3_price || 0);

  // Convert logo to Base64 to prevent html2canvas network/CORS issues
  const logoBase64 = await getBase64ImageFromUrl(logo);

  // Build temporary DOM container for Letter portrait layout
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px"; // 8.27" at 96 DPI
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#0f172a";
  container.style.fontFamily = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  container.style.padding = "36px 40px";
  container.style.boxSizing = "border-box";
  container.style.zIndex = "-9999";

  // Render clean, non-form print template
  container.innerHTML = `
    <!-- HEADER BLOCK -->
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #C9A84C; padding-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <img src="${logoBase64}" alt="Matt Smith Real Estate Group" style="height: 64px; width: auto; object-fit: contain;" />
        <div style="border-left: 2px solid #cbd5e1; padding-left: 14px;">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #C9A84C; margin-bottom: 2px;">eXp REALTY</div>
          <div style="font-size: 18px; font-weight: 800; color: #1B2F5B; line-height: 1.1;">SELLER ESTIMATED NET PROCEEDS</div>
        </div>
      </div>
      <div style="text-align: right; font-size: 10px; color: #64748b;">
        <div style="font-weight: 600; color: #1B2F5B;">Matt Smith Real Estate Group</div>
        <div>${data.office_address || "1043 Kingshighway, Rolla, MO 65401"}</div>
        <div>Ph: ${data.office_phone || "(573) 451-2020"}</div>
      </div>
    </div>

    <!-- AGENT & PROPERTY INFORMATION BLOCK -->
    <div style="margin-top: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; font-size: 11px;">
        <div>
          <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #1B2F5B; display: block;">Agent Name</span>
          <span style="font-weight: 600; color: #0f172a;">${data.agent_name || "N/A"}</span>
        </div>
        <div>
          <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #1B2F5B; display: block;">Cell Phone</span>
          <span style="font-weight: 600; color: #0f172a;">${data.agent_cell || "N/A"}</span>
        </div>
        <div>
          <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #1B2F5B; display: block;">Agent Email</span>
          <span style="font-weight: 600; color: #0f172a; word-break: break-all;">${data.agent_email || "N/A"}</span>
        </div>
        <div>
          <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #1B2F5B; display: block;">Office Phone</span>
          <span style="font-weight: 600; color: #0f172a;">${data.office_phone || "(573) 451-2020"}</span>
        </div>
      </div>
    </div>

    <!-- PROPERTY ADDRESS BANNER -->
    <div style="margin-top: 12px; background-color: #1B2F5B; color: #ffffff; padding: 10px 16px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
      <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #C9A84C;">Property Address</span>
      <span style="font-size: 13px; font-weight: 700; color: #ffffff;">${data.property_address || "Untitled Property"}</span>
    </div>

    <!-- COST TABLE -->
    <table style="width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11px;">
      <thead>
        <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #1B2F5B;">
          <th style="padding: 8px 10px; text-align: left; font-weight: 700; font-size: 10px; text-transform: uppercase;">Line Item / Expense</th>
          <th style="padding: 8px 10px; text-align: right; font-weight: 700; font-size: 10px; text-transform: uppercase; border-left: 1px solid #cbd5e1;">Scenario 1</th>
          ${numScenarios >= 2 ? `<th style="padding: 8px 10px; text-align: right; font-weight: 700; font-size: 10px; text-transform: uppercase; border-left: 1px solid #cbd5e1;">Scenario 2</th>` : ""}
          ${numScenarios >= 3 ? `<th style="padding: 8px 10px; text-align: right; font-weight: 700; font-size: 10px; text-transform: uppercase; border-left: 1px solid #cbd5e1;">Scenario 3</th>` : ""}
        </tr>
      </thead>
      <tbody>
        <!-- Sales Price -->
        <tr style="font-weight: 700; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 7px 10px; color: #0f172a;">Sales Price</td>
          <td style="padding: 7px 10px; text-align: right; border-left: 1px solid #e2e8f0; color: #1B2F5B;">${formatMoney(c1.salesPrice)}</td>
          ${numScenarios >= 2 ? `<td style="padding: 7px 10px; text-align: right; border-left: 1px solid #e2e8f0; color: #1B2F5B;">${formatMoney(c2.salesPrice)}</td>` : ""}
          ${numScenarios >= 3 ? `<td style="padding: 7px 10px; text-align: right; border-left: 1px solid #e2e8f0; color: #1B2F5B;">${formatMoney(c3.salesPrice)}</td>` : ""}
        </tr>

        <!-- Listing Agent Commission -->
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 6px 10px; color: #334155;">Listing Agent Commission (${data.listing_comm_pct}%)</td>
          <td style="padding: 6px 10px; text-align: right; border-left: 1px solid #f1f5f9; color: #334155;">${formatMoney(c1.listingComm)}</td>
          ${numScenarios >= 2 ? `<td style="padding: 6px 10px; text-align: right; border-left: 1px solid #f1f5f9; color: #334155;">${formatMoney(c2.listingComm)}</td>` : ""}
          ${numScenarios >= 3 ? `<td style="padding: 6px 10px; text-align: right; border-left: 1px solid #f1f5f9; color: #334155;">${formatMoney(c3.listingComm)}</td>` : ""}
        </tr>

        <!-- Selling Agent Commission -->
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 6px 10px; color: #334155;">Selling Agent Commission (${data.selling_comm_pct}%)</td>
          <td style="padding: 6px 10px; text-align: right; border-left: 1px solid #f1f5f9; color: #334155;">${formatMoney(c1.sellingComm)}</td>
          ${numScenarios >= 2 ? `<td style="padding: 6px 10px; text-align: right; border-left: 1px solid #f1f5f9; color: #334155;">${formatMoney(c2.sellingComm)}</td>` : ""}
          ${numScenarios >= 3 ? `<td style="padding: 6px 10px; text-align: right; border-left: 1px solid #f1f5f9; color: #334155;">${formatMoney(c3.sellingComm)}</td>` : ""}
        </tr>

        <!-- Fixed Cost Items -->
        ${renderPdfRow("Principal Mortgage Payoff", data.mortgage_payoff_1, numScenarios)}
        ${renderPdfRow("Second Mortgage Payoff", data.mortgage_payoff_2, numScenarios)}
        ${renderPdfRow("Closing Protection Letter", data.closing_protection_letter, numScenarios)}
        ${renderPdfRow("Seller's Title Company Closing Fee", data.seller_title_closing_fee, numScenarios)}
        ${renderPdfRow("Title Search Fee", data.title_search_fee, numScenarios)}
        ${renderPdfRow("Warranty Deed Fee", data.warranty_deed_fee, numScenarios)}
        ${renderPdfRow("Termite Letter", data.termite_letter, numScenarios)}
        ${renderPdfRow("Well, Water, Septic, Lagoon Inspection", data.inspections, numScenarios)}
        ${renderPdfRow("Home Warranty (negotiable w/ buyer)", data.home_warranty, numScenarios)}
        ${renderPdfRow("Transaction Fee", data.transaction_fee, numScenarios)}
        ${renderPdfRow("Estimated Taxes", data.estimated_taxes, numScenarios)}
        ${renderPdfRow("Miscellaneous", data.miscellaneous, numScenarios)}
        ${renderPdfRow("Sellers Concessions (negotiable w/ buyer)", data.seller_concessions, numScenarios)}

        <!-- TOTAL SELLING COSTS (BOLD) -->
        <tr style="font-weight: 700; background-color: #f1f5f9; border-top: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1; font-size: 11px;">
          <td style="padding: 8px 10px; color: #1B2F5B; text-transform: uppercase;">TOTAL SELLING COSTS</td>
          <td style="padding: 8px 10px; text-align: right; border-left: 1px solid #cbd5e1; color: #1B2F5B;">${formatMoney(c1.totalSellingCosts)}</td>
          ${numScenarios >= 2 ? `<td style="padding: 8px 10px; text-align: right; border-left: 1px solid #cbd5e1; color: #1B2F5B;">${formatMoney(c2.totalSellingCosts)}</td>` : ""}
          ${numScenarios >= 3 ? `<td style="padding: 8px 10px; text-align: right; border-left: 1px solid #cbd5e1; color: #1B2F5B;">${formatMoney(c3.totalSellingCosts)}</td>` : ""}
        </tr>

        <!-- ESTIMATED CASH TO SELLER (BOLD & LIGHT GREEN HIGHLIGHT) -->
        <tr style="font-weight: 800; background-color: #d1fae5; border-top: 2px solid #10b981; border-bottom: 2px solid #10b981; color: #065f46; font-size: 13px;">
          <td style="padding: 10px; text-transform: uppercase;">ESTIMATED CASH TO SELLER</td>
          <td style="padding: 10px; text-align: right; border-left: 1px solid #a7f3d0;">${formatMoney(c1.cashToSeller)}</td>
          ${numScenarios >= 2 ? `<td style="padding: 10px; text-align: right; border-left: 1px solid #a7f3d0;">${formatMoney(c2.cashToSeller)}</td>` : ""}
          ${numScenarios >= 3 ? `<td style="padding: 10px; text-align: right; border-left: 1px solid #a7f3d0;">${formatMoney(c3.cashToSeller)}</td>` : ""}
        </tr>
      </tbody>
    </table>

    <!-- VERBATIM DISCLAIMER FOOTER -->
    <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="font-size: 8px; color: #64748b; font-family: monospace; margin: 0; line-height: 1.4; max-width: 90%; margin: 0 auto;">
        NOTE: THIS FORM IS INTENDED AS AN ESTIMATE ONLY. IT DOES NOT INCLUDE TAX PRORATION, ESCROW ADJUSTMENTS AND OTHER MISCELLANEOUS COSTS SOMETIMES ASSOCIATED WITH CLOSING. MATT SMITH REAL ESTATE GROUP/EXP REALTY ACCEPTS NO RESPONSIBILITY FOR THIS ESTIMATE.
      </p>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.98);

    // Standard Letter size portrait: 612pt x 792pt
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "letter",
    });

    const pdfWidth = 612;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, Math.min(pdfHeight, 792));

    const cleanAddress = (data.property_address || "Property")
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "_");

    pdf.save(`Seller Net Sheet - ${cleanAddress}.pdf`);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

function renderPdfRow(label: string, value: number, numScenarios: number): string {
  const money = formatMoney(value || 0);
  return `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 5px 10px; color: #475569;">${label}</td>
      <td style="padding: 5px 10px; text-align: right; border-left: 1px solid #f1f5f9; color: #475569;">${money}</td>
      ${numScenarios >= 2 ? `<td style="padding: 5px 10px; text-align: right; border-left: 1px solid #f1f5f9; color: #475569;">${money}</td>` : ""}
      ${numScenarios >= 3 ? `<td style="padding: 5px 10px; text-align: right; border-left: 1px solid #f1f5f9; color: #475569;">${money}</td>` : ""}
    </tr>
  `;
}
