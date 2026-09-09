import { jsPDF } from "jspdf";
import type { Vendor, VendorCategory } from "./vendors";
import { getRegionShortLabel, formatPhoneNumber } from "./vendors";

export interface VendorPdfOptions {
  vendors: Vendor[];
  categories: VendorCategory[];
  title?: string;
  regionFilter?: string;
  categoryFilter?: string;
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
}

export async function generateVendorGuidePdf(options: VendorPdfOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  let currentY = margin;
  let pageNumber = 1;

  // Filter vendors by region and category if specified
  let list = options.vendors.filter((v) => v.status === "active");
  if (options.regionFilter && options.regionFilter !== "all") {
    list = list.filter((v) => v.region === options.regionFilter);
  }
  if (options.categoryFilter && options.categoryFilter !== "all") {
    list = list.filter((v) => v.category_id === options.categoryFilter);
  }

  // Group by Category
  const catMap = new Map(options.categories.map((c) => [c.id, c]));
  const grouped = new Map<string, Vendor[]>();

  // Ensure categories are sorted by sort_order
  const sortedCategories = [...options.categories].sort((a, b) => a.sort_order - b.sort_order);

  for (const cat of sortedCategories) {
    const catVendors = list.filter((v) => v.category_id === cat.id);
    if (catVendors.length > 0) {
      grouped.set(cat.id, catVendors);
    }
  }

  // Include any uncategorized vendors
  const uncategorized = list.filter((v) => !catMap.has(v.category_id));
  if (uncategorized.length > 0) {
    grouped.set("other", uncategorized);
  }

  const regionTitle =
    options.regionFilter && options.regionFilter !== "all"
      ? getRegionShortLabel(options.regionFilter)
      : "All Service Areas";

  const mainTitle = options.title || "Trusted Local Home Services & Vendor Guide";

  // Helper to draw Header
  const drawHeader = (isFirstPage: boolean) => {
    // Header background banner
    doc.setFillColor(15, 23, 42); // Navy #0F172A
    doc.rect(0, 0, pageWidth, isFirstPage ? 85 : 55, "F");

    // Gold accent bar
    doc.setFillColor(212, 175, 55); // Gold #D4AF37
    doc.rect(0, isFirstPage ? 85 : 55, pageWidth, 3, "F");

    // Brand text
    doc.setTextColor(212, 175, 55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(isFirstPage ? 14 : 11);
    doc.text("MATT SMITH REAL ESTATE GROUP", margin, isFirstPage ? 32 : 24);

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(isFirstPage ? 18 : 13);
    doc.text(mainTitle, margin, isFirstPage ? 56 : 42);

    if (isFirstPage) {
      doc.setTextColor(203, 213, 225); // Slate-300
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Region: ${regionTitle}  •  Verified Local Partners`, margin, 74);
    }

    currentY = isFirstPage ? 110 : 75;
  };

  // Helper to draw Footer
  const drawFooter = () => {
    const footerY = pageHeight - 25;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate-400

    let agentText = "Matt Smith Real Estate Group  •  www.mattsmithrealestategroup.com";
    if (options.agentName) {
      agentText = `Provided by: ${options.agentName}${options.agentPhone ? ` (${options.agentPhone})` : ""}  •  Matt Smith Real Estate Group`;
    }

    doc.text(agentText, margin, footerY);

    const pageStr = `Page ${pageNumber}`;
    const pageStrWidth = doc.getTextWidth(pageStr);
    doc.text(pageStr, pageWidth - margin - pageStrWidth, footerY);
  };

  // Start Page 1
  drawHeader(true);

  if (grouped.size === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text("No vendors found matching the selected filter criteria.", margin, currentY + 20);
    drawFooter();
    doc.save("MSREG_Vendor_Guide.pdf");
    return;
  }

  // Iterate categories
  for (const [catId, vendorList] of grouped.entries()) {
    const cat = catMap.get(catId);
    const catName = cat ? cat.name : "Other Services";

    // Category Header Height estimate
    const catHeaderHeight = 28;
    const vendorEstimatedHeight = 44; // per vendor card

    // Check if we need a new page for category header + at least 1 vendor
    if (currentY + catHeaderHeight + vendorEstimatedHeight > pageHeight - 50) {
      drawFooter();
      doc.addPage();
      pageNumber++;
      drawHeader(false);
    }

    // Draw Category Header Bar
    doc.setFillColor(241, 245, 249); // Slate-100
    doc.roundedRect(margin, currentY, contentWidth, 22, 3, 3, "F");

    doc.setFillColor(212, 175, 55); // Gold left strip
    doc.roundedRect(margin, currentY, 4, 22, 2, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42); // Navy
    doc.text(catName.toUpperCase(), margin + 12, currentY + 15);

    const countText = `${vendorList.length} ${vendorList.length === 1 ? "provider" : "providers"}`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const countWidth = doc.getTextWidth(countText);
    doc.text(countText, pageWidth - margin - countWidth - 8, currentY + 15);

    currentY += 30;

    // Render vendors in 2-column or single column layout
    // 2-column layout for clean, compact readability
    const colWidth = (contentWidth - 14) / 2;

    for (let i = 0; i < vendorList.length; i += 2) {
      const v1 = vendorList[i];
      const v2 = vendorList[i + 1];

      // Calculate row height
      const h1 = calculateVendorCardHeight(doc, v1, colWidth);
      const h2 = v2 ? calculateVendorCardHeight(doc, v2, colWidth) : 0;
      const rowHeight = Math.max(h1, h2);

      if (currentY + rowHeight > pageHeight - 45) {
        drawFooter();
        doc.addPage();
        pageNumber++;
        drawHeader(false);
      }

      // Draw Col 1
      drawVendorCard(doc, v1, margin, currentY, colWidth, rowHeight);

      // Draw Col 2 (if exists)
      if (v2) {
        drawVendorCard(doc, v2, margin + colWidth + 14, currentY, colWidth, rowHeight);
      }

      currentY += rowHeight + 8;
    }

    currentY += 10;
  }

  drawFooter();

  // Trigger browser download
  const filename = `MSREG_Vendor_Guide_${regionTitle.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(filename);
}

function calculateVendorCardHeight(doc: jsPDF, v: Vendor, width: number): number {
  let h = 34; // Base height for title, contact, phone
  if (v.specialty_notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const lines = doc.splitTextToSize(`Note: ${v.specialty_notes}`, width - 16);
    h += lines.length * 9 + 4;
  }
  if (v.email || v.website) {
    h += 12;
  }
  return Math.max(46, h);
}

function drawVendorCard(
  doc: jsPDF,
  v: Vendor,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  // Card Border & Background
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.75);
  doc.roundedRect(x, y, width, height, 4, 4, "FD");

  // Preferred Tag / Indicator
  if (v.is_preferred) {
    doc.setFillColor(212, 175, 55); // Gold
    doc.circle(x + width - 10, y + 10, 3.5, "F");
  }

  let textY = y + 13;

  // Vendor Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42); // Navy
  const nameTrimmed = doc.splitTextToSize(v.name, width - 24)[0] || v.name;
  doc.text(nameTrimmed, x + 8, textY);

  textY += 12;

  // Primary Contact & Phone line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85); // Slate-700

  const phoneStr = formatPhoneNumber(v.phone);
  const contactStr = v.primary_contact ? `${v.primary_contact}  •  ${phoneStr}` : phoneStr;
  doc.text(contactStr, x + 8, textY);

  // Email / Website line
  if (v.email || v.website) {
    textY += 11;
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // Slate-500
    const webOrEmail = [v.email, v.website].filter(Boolean).join("  •  ");
    const webTrimmed = doc.splitTextToSize(webOrEmail, width - 16)[0];
    doc.text(webTrimmed, x + 8, textY);
  }

  // Specialty Notes
  if (v.specialty_notes) {
    textY += 11;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105); // Slate-600
    const noteLines = doc.splitTextToSize(v.specialty_notes, width - 16);
    doc.text(noteLines.slice(0, 2), x + 8, textY);
  }
}
