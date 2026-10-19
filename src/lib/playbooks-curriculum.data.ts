/**
 * ============================================================================
 * Official MSREG 8 Playbooks Curriculum Data
 * ============================================================================
 * Defines the complete structure, categories, modules, and lessons for all
 * 8 GoHighLevel products in the Matt Smith Real Estate Group training library.
 */

export interface CurriculumLesson {
  id: string;
  title: string;
  slug: string;
  product: string;
  category: string; // Module / Section name
  sortOrder: number;
  summary: string;
  tags: string[];
  owner: string;
  status: "published" | "draft";
  content: string;
  videoUrl?: string;
  sourceRef?: string;
}

export interface CurriculumProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverImageUrl: string;
  sortOrder: number;
  sections: Array<{
    name: string;
    sortOrder: number;
    lessons: CurriculumLesson[];
  }>;
}

export const OFFICIAL_PRODUCTS_CURRICULUM: CurriculumProduct[] = [
  // ---------------------------------------------------------------------------
  // 1. LISTING AGENT PLAYBOOK
  // ---------------------------------------------------------------------------
  {
    id: "prod-1",
    name: "Listing Agent Playbook",
    slug: "listing-agent-playbook",
    description: "Daily production non-negotiables, prospecting systems, CMA pricing brackets, and listing launch protocols.",
    coverImageUrl: "/covers/listing-agent-playbook.jpg",
    sortOrder: 1,
    sections: [
      {
        name: "01 Standards & Production Commitments",
        sortOrder: 1,
        lessons: [
          {
            id: "pb-lap-1",
            title: "Listing Partner Schedule & Daily Non-Negotiables",
            slug: "listing-partner-schedule-daily-non-negotiables",
            product: "Listing Agent Playbook",
            category: "01 Standards & Production Commitments",
            sortOrder: 1,
            summary: "Core schedule, morning prep, time blocking for lead generation, and team attendance standards.",
            tags: ["Standards", "DailySchedule", "Mindset"],
            owner: "Matt Smith",
            status: "published",
            content: `# Listing Partner Schedule & Daily Non-Negotiables

## Purpose
Establish the high-performance daily structure required for listing specialists to consistently generate and convert listing inventory.

## When to use this
Review daily upon start of work and use as your accountability checklist during weekly 1-on-1 coaching sessions.

## Steps
1. **8:00 AM - 8:30 AM**: Role play scripts & objection handling.
2. **8:30 AM - 11:30 AM**: Protected Lead Generation Time (0 distractions, phones on, Mojo dialer active).
3. **11:30 AM - 12:30 PM**: Administrative follow-up & CRM task clearing in Follow Up Boss.
4. **1:00 PM - 5:00 PM**: In-home listing consultations, property walk-throughs, and CMA deliveries.
5. **5:00 PM - 5:30 PM**: Daily Sisu scorecard logging & end-of-day review.

## Notes / gotchas
- Never schedule non-dollar-producing administrative tasks during the 8:30 AM - 11:30 AM morning prospecting window.

## Related playbooks
- Listing Agent Certification
- Production Standards & 35-Unit Throughput Goal`,
          },
          {
            id: "pb-lap-2",
            title: "Production Standards & 35-Unit Throughput Goal",
            slug: "production-standards-35-unit-goal",
            product: "Listing Agent Playbook",
            category: "01 Standards & Production Commitments",
            sortOrder: 2,
            summary: "Detailed breakdown of the 35 closed listing transactions per year standard and quarterly benchmarks.",
            tags: ["Production", "Goals", "Throughput"],
            owner: "Matt Smith",
            status: "published",
            content: `# Production Standards & 35-Unit Throughput Goal

## Purpose
Define the annual and quarterly throughput expectations for MSREG listing specialists.

## When to use this
Reference when setting quarterly targets in Sisu and tracking pipeline velocity.

## Steps
1. **Annual Target**: 35 Closed Transactions minimum (9 closings per quarter).
2. **Weekly Conversations**: Minimum 20 real estate conversations per week.
3. **Listing Appointments**: Minimum 3 in-home listing presentations completed per week.
4. **Conversion Ratio Benchmark**: Target 75%+ signed listing agreement conversion rate.

## Notes / gotchas
- If appointment volume drops below 2 in any given week, immediately increase outbound circle dialing by 5 hours.

## Related playbooks
- Listing Partner Schedule & Daily Non-Negotiables
- Circle Prospecting Just Listed / Just Sold Calls`,
          },
        ],
      },
      {
        name: "02 Prospecting & Inbound Lead Conversion",
        sortOrder: 2,
        lessons: [
          {
            id: "pb-lap-3",
            title: "Sign Call & Yard Sign Inbound Conversion",
            slug: "sign-call-yard-sign-inbound-conversion",
            product: "Listing Agent Playbook",
            category: "02 Prospecting & Inbound Lead Conversion",
            sortOrder: 1,
            summary: "Script and methodology to convert drive-by sign callers into qualified listing and buyer consultations.",
            tags: ["Prospecting", "Inbound", "Scripts"],
            owner: "Matt Smith",
            status: "published",
            content: `# Sign Call & Yard Sign Inbound Conversion

## Purpose
Maximize conversion on inbound callers inquiring about team yard signs.

## When to use this
Whenever receiving an inbound phone call or text notification generated from a property yard sign or rider.

## Steps
1. Answer enthusiastically within 3 rings: *"Thanks for calling Matt Smith Real Estate Group! This is [Name], which home are you in front of today?"*
2. Confirm property address and provide key highlights (beds/baths/price).
3. Transition into motivation discovery: *"Are you looking for yourself, or checking on the neighborhood values?"*
4. Offer an immediate private walkthrough: *"I can have that door unlocked for you in 20 minutes, or does 5:00 PM work better?"*
5. Bridge to listing opportunity: *"If you're planning to make a move, do you have a home you'd need to sell first?"*

## Notes / gotchas
- Don't give away all details without asking for their contact info to text them the digital floor plan.

## Related playbooks
- In-Home Listing Presentation
- Seller Intake Questionnaire`,
          },
        ],
      },
      {
        name: "03 The In-Home Listing Presentation",
        sortOrder: 3,
        lessons: [
          {
            id: "pb-lap-4",
            title: "The 7-Step In-Home Listing Presentation",
            slug: "7-step-in-home-listing-presentation",
            product: "Listing Agent Playbook",
            category: "03 The In-Home Listing Presentation",
            sortOrder: 1,
            summary: "Comprehensive walkthrough of the kitchen table consultation, rapport building, and closing steps.",
            tags: ["Presentations", "Closing", "Listings"],
            owner: "Matt Smith",
            status: "published",
            videoUrl: "https://cdn.leadconnectorhq.com/courses/videos/lesson102-presentation.mp4",
            content: `# The 7-Step In-Home Listing Presentation

## Purpose
Deliver an unbeatable kitchen-table listing presentation that wins the agreement at full commission.

## When to use this
Execute during every in-person listing consultation.

## Steps
1. **The Arrival & Walkthrough**: Tour the home, taking notes on upgrades while building organic rapport.
2. **Kitchen Table Transition**: Sit at the head of the table; establish the meeting agenda and timing.
3. **Review Seller Motivation**: Validate target moving dates, ideal price, and past agent experiences.
4. **Market Overview**: Review current MLS absorption rate, active competitors, and recently sold comps.
5. **The 3-Tier Marketing Plan**: Present professional media, digital ads, and direct outreach strategies.
6. **Pricing Bracket Strategy**: Present conservative, target, and aggressive pricing scenarios.
7. **The Close**: Present the listing agreement for signature and schedule media capture dates.

## Notes / gotchas
- Never talk pricing while walking through bedrooms; always keep pricing discussions seated at the table.

## Related playbooks
- The 3-Tier Commission Strategy (6% / 7% / 8%)
- Handling Seller Objections at the Kitchen Table`,
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 2. MSREG LEADERSHIP PLAYBOOK
  // ---------------------------------------------------------------------------
  {
    id: "prod-2",
    name: "MSREG Leadership Playbook",
    slug: "msreg-leadership-playbook",
    description: "Culture building, 1-on-1 coaching frameworks, talent recruiting, and performance accountability.",
    coverImageUrl: "/covers/msreg-leadership-playbook.jpg",
    sortOrder: 2,
    sections: [
      {
        name: "01 Culture & Core Values",
        sortOrder: 1,
        lessons: [
          {
            id: "pb-lead-1",
            title: "The MSREG Mission & Team Core Values",
            slug: "msreg-mission-team-core-values",
            product: "MSREG Leadership Playbook",
            category: "01 Culture & Core Values",
            sortOrder: 1,
            summary: "The driving mission, vision, and core cultural values that govern Matt Smith Real Estate Group.",
            tags: ["Leadership", "Culture", "CoreValues"],
            owner: "Matt Smith",
            status: "published",
            content: `# The MSREG Mission & Team Core Values

## Purpose
Instill the foundational values and cultural standards that guide every decision within the organization.

## When to use this
Introduce during agent interviews, onboarding, and reinforce during quarterly team retreats.

## Steps
1. **Serve Selflessly**: Put client and teammate outcomes above personal ego.
2. **Obsess Over Growth**: Continuously develop skills, mindset, and market mastery.
3. **Extreme Ownership**: Take 100% responsibility for your production, calendar, and results.
4. **Energy & Positivity**: Bring contagious optimism and relentless work ethic to the office daily.
5. **Execute with Excellence**: Deliver 5-star experiences on every transaction without exception.

## Notes / gotchas
- Culture is protected by what leaders tolerate. Address cultural breaches swiftly and privately.

## Related playbooks
- Weekly 1-on-1 Coaching Cadence
- Team Meeting Run of Show`,
          },
        ],
      },
      {
        name: "02 1-on-1 Coaching & Accountability",
        sortOrder: 2,
        lessons: [
          {
            id: "pb-lead-2",
            title: "Weekly 1-on-1 Coaching Cadence",
            slug: "weekly-1-on-1-coaching-cadence",
            product: "MSREG Leadership Playbook",
            category: "02 1-on-1 Coaching & Accountability",
            sortOrder: 1,
            summary: "30-minute structured coaching framework to review agent pipeline, metrics, mindset, and blockers.",
            tags: ["Coaching", "Accountability", "1on1"],
            owner: "Matt Smith",
            status: "published",
            content: `# Weekly 1-on-1 Coaching Cadence

## Purpose
Empower team leaders to conduct high-impact 30-minute weekly coaching sessions that drive measurable agent growth.

## When to use this
Conduct weekly for all producing agents on designated coaching days.

## Steps
1. **Minutes 0-5**: Personal connection & mindset check-in.
2. **Minutes 5-15**: Sisu dashboard inspection (Dials, Conversations, Appointments, Pendings).
3. **Minutes 15-25**: Deal review & roadblock problem solving (active listings, price adjustments, stuck escrow).
4. **Minutes 25-30**: Commitments for the next 7 days & mutual accountability sign-off.

## Notes / gotchas
- Never cancel 1-on-1s. If an agent is behind, that is the most critical time to hold the meeting.

## Related playbooks
- Sisu KPI Review & Pipeline Accountability
- The MSREG Mission & Team Core Values`,
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 3. THE OPERATIONS PLAYBOOK - MSREG WAY
  // ---------------------------------------------------------------------------
  {
    id: "prod-3",
    name: "The Operations Playbook - MSREG Way",
    slug: "operations-playbook",
    description: "Transaction coordination checklists, listing media logistics, vendor management, and client delight.",
    coverImageUrl: "/covers/operations-playbook.jpg",
    sortOrder: 3,
    sections: [
      {
        name: "01 Transaction Coordination",
        sortOrder: 1,
        lessons: [
          {
            id: "pb-ops-1",
            title: "Under Contract Handoff & Escrow Timeline Setup",
            slug: "under-contract-handoff-escrow-timeline-setup",
            product: "The Operations Playbook - MSREG Way",
            category: "01 Transaction Coordination",
            sortOrder: 1,
            summary: "Checklist and communication steps when an agent submits a fully executed purchase contract.",
            tags: ["Operations", "TC", "Escrow"],
            owner: "Operations Team",
            status: "published",
            content: `# Under Contract Handoff & Escrow Timeline Setup

## Purpose
Seamlessly transition fully executed contracts from sales agents into the TC escrow pipeline within 2 hours of receipt.

## When to use this
Executed by the TC team immediately when an agent uploads an accepted contract.

## Steps
1. Verify all signatures, initials, and attached addenda in Dotloop / Sisu.
2. Open escrow with title company and request earnest money confirmation.
3. Send formal introductory email to buyers/sellers, co-op agent, and lender with critical milestone calendar.
4. Input all contract milestones into Sisu (Inspection deadline, Appraisal deadline, Loan commitment, Closing date).
5. Schedule calendar reminders for 3 days prior to each contingency deadline.

## Notes / gotchas
- Double-check financing contingency dates against bank holidays to prevent accidental expiration.

## Related playbooks
- Title, Lender & Co-Op Agent Communication Cadence
- Inspection Resolution & Repair Addendum Protocol`,
          },
        ],
      },
      {
        name: "02 Listing Coordination & Media",
        sortOrder: 2,
        lessons: [
          {
            id: "pb-ops-2",
            title: "Listing Photo Vendor Scheduling & Asset Review",
            slug: "listing-photo-vendor-scheduling-asset-review",
            product: "The Operations Playbook - MSREG Way",
            category: "02 Listing Coordination & Media",
            sortOrder: 1,
            summary: "Booking professional photography, drone, floor plans, and reviewing assets for MLS standards.",
            tags: ["Media", "Listings", "Operations"],
            owner: "Operations Team",
            status: "published",
            content: `# Listing Photo Vendor Scheduling & Asset Review

## Purpose
Ensure every MSREG listing receives pristine, high-end photography, cinematic video, and compliant floor plans.

## When to use this
Executed upon receiving signed listing agreement and seller availability.

## Steps
1. Confirm property prep completion with listing agent and seller.
2. Book certified media vendor 48-72 hours prior to scheduled MLS live date.
3. Review raw photos upon delivery: verify correct exterior lighting, drone angles, and blue sky enhancement.
4. Upload high-res media package to Google Drive listing folder and assign to MLS coordinator.

## Notes / gotchas
- Never launch an MLS listing with temporary cell phone photos under any circumstances.

## Related playbooks
- MLS Data Entry & Quality Assurance Checklist
- Under Contract Handoff & Escrow Timeline Setup`,
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 4. WELCOME TO MATT SMITH REAL ESTATE GROUP
  // ---------------------------------------------------------------------------
  {
    id: "prod-4",
    name: "Welcome to Matt Smith Real Estate Group",
    slug: "welcome-to-msreg",
    description: "Team history, culture, core values, communication channels, and onboarding essentials.",
    coverImageUrl: "/covers/welcome-to-msreg.jpg",
    sortOrder: 4,
    sections: [
      {
        name: "01 Team Orientation & Tech Setup",
        sortOrder: 1,
        lessons: [
          {
            id: "pb-wel-1",
            title: "Welcome from Matt Smith & Leadership Team",
            slug: "welcome-from-matt-smith-leadership",
            product: "Welcome to Matt Smith Real Estate Group",
            category: "01 Team Orientation & Tech Setup",
            sortOrder: 1,
            summary: "A personal welcome message, team history, and what to expect during your first 90 days with MSREG.",
            tags: ["Onboarding", "Welcome", "Orientation"],
            owner: "Matt Smith",
            status: "published",
            videoUrl: "https://cdn.leadconnectorhq.com/courses/videos/welcome-msreg-leadership.mp4",
            content: `# Welcome from Matt Smith & Leadership Team

## Purpose
Welcome new team members to the MSREG family, establish the standard of excellence, and outline the onboarding journey.

## When to use this
First video and reading assignment for all newly joined agents and staff on Day 1.

## Steps
1. Watch the welcome message from Founder & CEO Matt Smith.
2. Review our team history: from solo agent to #1 team in Missouri and top nationwide producer.
3. Complete your onboarding survey and headshot submission.
4. Schedule your Day 1 tech onboarding session with Operations.

## Notes / gotchas
- Ask questions early and often. The leadership team and senior agents are here to support your success.

## Related playbooks
- Staff Directory & Emergency Protocol
- Follow Up Boss (FUB) Setup, Tags & Smart Lists`,
          },
          {
            id: "pb-wel-2",
            title: "Staff Directory, Department Contacts & Emergency Protocol",
            slug: "staff-directory-department-contacts",
            product: "Welcome to Matt Smith Real Estate Group",
            category: "01 Team Orientation & Tech Setup",
            sortOrder: 2,
            summary: "Who to contact for operations, marketing, transaction coordination, and broker support.",
            tags: ["Directory", "Contacts", "Support"],
            owner: "Operations Team",
            status: "published",
            content: `# Staff Directory, Department Contacts & Emergency Protocol

## Purpose
Provide instant reference for key personnel across operations, marketing, finance, and coaching.

## When to use this
Whenever you need operational support, marketing assets, or urgent contract review.

## Steps
- **Broker & Contract Urgent Review**: Matt Smith & Lead Broker Team.
- **Transaction Coordination**: TC Team via Slack #tc-support.
- **Listing Media & Signs**: Listing Operations via Slack #listings-ops.
- **Marketing & Social Assets**: Marketing Hub via Slack #marketing-requests.

## Notes / gotchas
- For urgent contract issues happening after hours at an active negotiation, call your designated mentor or broker immediately.

## Related playbooks
- Welcome from Matt Smith & Leadership Team
- Follow Up Boss (FUB) Setup, Tags & Smart Lists`,
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 5. 2026 LAKE AGENT CERTIFICATION
  // ---------------------------------------------------------------------------
  {
    id: "prod-5",
    name: "2026 Lake Agent Certification",
    slug: "2026-lake-agent-certification",
    description: "Waterfront property valuation, dock permits, seawalls, Ameren regulations, and lake pricing.",
    coverImageUrl: "/covers/lake-agent-certification.jpg",
    sortOrder: 5,
    sections: [
      {
        name: "01 Lake Market Dynamics & Waterfront Valuation",
        sortOrder: 1,
        lessons: [
          {
            id: "pb-lake-1",
            title: "Lake Market Overview: Mile Markers, Coves vs Main Channel",
            slug: "lake-market-overview-mile-markers-coves",
            product: "2026 Lake Agent Certification",
            category: "01 Lake Market Dynamics & Waterfront Valuation",
            sortOrder: 1,
            summary: "Understanding Lake of the Ozarks mile markers, cove protection vs main channel views, and pricing implications.",
            tags: ["Lake", "Waterfront", "Certification"],
            owner: "Lake Specialist Team",
            status: "published",
            content: `# Lake Market Overview: Mile Markers, Coves vs Main Channel

## Purpose
Equip agents with expert geographic and micro-market pricing mastery across Lake of the Ozarks waterfront properties.

## When to use this
During buyer and seller consultations involving Lake of the Ozarks real estate.

## Steps
1. **Mile Marker Pricing**: Understand price variances between Osage Arm, Gravois Arm, Niangua Arm, and Grand Glaize.
2. **Main Channel vs Cove**: Main channel properties command premium panoramic views but experience heavy weekend wake. Cove locations offer calm water for swimming and boat protection.
3. **Water Depth**: Always verify year-round water depth under the dock at low pool (winter pool level).

## Notes / gotchas
- Never quote dock water depth based solely on high-summer water levels. Always reference Ameren gauge readings.

## Related playbooks
- Ameren UE Shoreline Management Guidelines (Docks & Seawalls)
- Lake Vacation Rental ROI & STR Ordinances`,
          },
        ],
      },
      {
        name: "02 Docks, Seawalls & Ameren Regulations",
        sortOrder: 2,
        lessons: [
          {
            id: "pb-lake-2",
            title: "Ameren UE Shoreline Management Guidelines (Docks & Seawalls)",
            slug: "ameren-shoreline-management-guidelines",
            product: "2026 Lake Agent Certification",
            category: "02 Docks, Seawalls & Ameren Regulations",
            sortOrder: 1,
            summary: "Complete guide to Ameren permit transfers, non-conforming docks, and seawall compliance checks.",
            tags: ["Ameren", "Docks", "Lake"],
            owner: "Lake Specialist Team",
            status: "published",
            videoUrl: "https://cdn.leadconnectorhq.com/courses/videos/lake-ameren-guidelines.mp4",
            content: `# Ameren UE Shoreline Management Guidelines (Docks & Seawalls)

## Purpose
Ensure all dock permits, seawalls, and shoreline modifications comply with Ameren Project 459 regulations prior to closing.

## When to use this
Mandatory during due diligence on any waterfront property transaction.

## Steps
1. Request Ameren permit number and current permit holder name from seller.
2. Cross-reference Ameren Shoreline GIS map for property boundary lines and project boundaries.
3. Verify dock size: ensure dock length does not exceed 1/3 of cove width or encroach across neighboring setback lines.
4. Verify dock electrical certification: state law requires certified electrician inspection prior to power connection.
5. Submit Ameren Dock Permit Assignment form prior to closing.

## Notes / gotchas
- Non-permitted dock modifications can result in Ameren ordering the complete removal of the dock at buyer expense.

## Related playbooks
- Lake Market Overview: Mile Markers, Coves vs Main Channel
- Central Sewer vs Community Septic at the Lake`,
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 6. LISTING AGENT CERTIFICATION
  // ---------------------------------------------------------------------------
  {
    id: "prod-6",
    name: "Listing Agent Certification",
    slug: "listing-agent-certification",
    description: "Official 7-module academy and certification standards for MSREG listing specialists.",
    coverImageUrl: "/covers/listing-agent-certification.jpg",
    sortOrder: 6,
    sections: [
      {
        name: "01 Pre-Listing Process",
        sortOrder: 1,
        lessons: [
          {
            id: "pb-lc-1",
            title: "Pre-Listing Dossier & Seller Intake",
            slug: "pre-listing-dossier-seller-intake",
            product: "Listing Agent Certification",
            category: "01 Pre-Listing Process",
            sortOrder: 1,
            summary: "Step-by-step procedure for preparing the pre-listing dossier and intake questionnaire prior to meeting sellers.",
            tags: ["Listings", "Intake", "PreListing"],
            owner: "Matt Smith",
            status: "published",
            videoUrl: "https://cdn.leadconnectorhq.com/courses/videos/lesson101-overview.mp4",
            content: `# Pre-Listing Dossier & Seller Intake

## Purpose
Prepare a comprehensive seller intelligence packet to uncover property history, title items, and seller goals before entering the home.

## When to use this
Executed immediately after booking an in-home listing appointment.

## Steps
1. Conduct the 10-minute Seller Intake Phone Questionnaire.
2. Pull MLS history, tax records, deed ownership, and existing deed of trust amounts.
3. Generate competitive market analysis (CMA) bracket.
4. Prepare custom digital pre-listing dossier and text video preview to seller.

## Notes / gotchas
- Always confirm all legal deed owners will be present at the appointment.

## Related playbooks
- The In-Home Listing Consultation
- Defending Commission against Discount Brokers`,
          },
        ],
      },
      {
        name: "02 The In-Home Presentation",
        sortOrder: 2,
        lessons: [
          {
            id: "pb-lc-2",
            title: "The In-Home Listing Consultation",
            slug: "the-in-home-listing-consultation",
            product: "Listing Agent Certification",
            category: "02 The In-Home Presentation",
            sortOrder: 1,
            summary: "Executing the in-home walkthrough, positioning MSREG's media power, and locking in the listing agreement.",
            tags: ["Listings", "InHome", "Presentation"],
            owner: "Matt Smith",
            status: "published",
            content: `# The In-Home Listing Consultation

## Purpose
Standard operating procedure for delivering our championship kitchen-table listing presentation.

## When to use this
At the seller's home during the confirmed listing consultation.

## Steps
1. Punctual arrival (arrive 5 minutes early, park on the street, not the driveway).
2. The 10-minute seller-led walkthrough to establish rapport and discover upgrade details.
3. Seating at the kitchen table; lay out the physical presentation booklet.
4. Demonstrate our digital distribution advantage across Meta, Google, and national buyer networks.
5. Review market stats, pricing strategy, and obtain signatures on the listing agreement.

## Notes / gotchas
- Never leave without asking for the business. Clear, confident closings build client confidence.

## Related playbooks
- Pre-Listing Dossier & Seller Intake
- Defending Commission against Discount Brokers`,
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 7. NEW AGENT BOOTCAMP
  // ---------------------------------------------------------------------------
  {
    id: "prod-7",
    name: "New Agent Bootcamp",
    slug: "new-agent-bootcamp",
    description: "30-day foundational training program for new agents joining the team.",
    coverImageUrl: "/covers/new-agent-bootcamp.jpg",
    sortOrder: 7,
    sections: [
      {
        name: "01 Foundations & Database Mastery",
        sortOrder: 1,
        lessons: [
          {
            id: "pb-nab-1",
            title: "Building Your 150-Person Sphere of Influence (SOI)",
            slug: "building-your-150-person-sphere-of-influence",
            product: "New Agent Bootcamp",
            category: "01 Foundations & Database Mastery",
            sortOrder: 1,
            summary: "How to export, organize, tag, and import your complete personal network into Follow Up Boss.",
            tags: ["Bootcamp", "SOI", "Database"],
            owner: "Team Coach",
            status: "published",
            content: `# Building Your 150-Person Sphere of Influence (SOI)

## Purpose
Build a high-yield foundation of 150 past contacts, friends, family, and vendors in Follow Up Boss within week 1.

## When to use this
Days 1-5 of joining MSREG.

## Steps
1. Export phone contacts, social media networks, and past email address books.
2. Categorize every contact with tags: A+ (immediate advocate), A (good friend), B (acquaintance).
3. Populate address, phone, and birthday data into the MSREG SOI Import CSV.
4. Import into Follow Up Boss and enroll in the 36-Touch Sphere Campaign.

## Notes / gotchas
- Do not filter people out because you 'think they won't buy'. People in your sphere refer friends and family.

## Related playbooks
- The LPMAMA Buyer Qualification Framework
- Speed to Lead & Inbound Call SOP`,
          },
        ],
      },
      {
        name: "02 Buyer Lead Conversion & Scripts",
        sortOrder: 2,
        lessons: [
          {
            id: "pb-nab-2",
            title: "The LPMAMA Buyer Qualification Framework",
            slug: "lpmama-buyer-qualification-framework",
            product: "New Agent Bootcamp",
            category: "02 Buyer Lead Conversion & Scripts",
            sortOrder: 1,
            summary: "Mastering the gold standard framework for qualifying buyers: Location, Price, Motivation, Agent, Mortgage, Appointment.",
            tags: ["LPMAMA", "Buyers", "Qualification"],
            owner: "Team Coach",
            status: "published",
            content: `# The LPMAMA Buyer Qualification Framework

## Purpose
Qualify every inbound buyer lead quickly, professionally, and book an in-person or Zoom consultation.

## When to use this
On every buyer phone call, text inquiry, or open house conversation.

## Steps
1. **L - Location**: *"Which neighborhoods or school districts are you focusing on?"*
2. **P - Price**: *"What price comfort zone are you targeting for monthly payment?"*
3. **M - Motivation**: *"What's motivating this move right now?"*
4. **A - Agent**: *"Are you committed to working with an agent under contract, or still looking around?"*
5. **M - Mortgage**: *"Have you spoken with a preferred local lender yet?"*
6. **A - Appointment**: *"Let's sit down for 15 minutes to review off-market homes. Does Thursday at 4 PM work?"*

## Notes / gotchas
- Always ask for the appointment before getting off the phone.

## Related playbooks
- Building Your 150-Person Sphere of Influence (SOI)
- Showing Etiquette & Route Planning`,
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 8. MSREG 5-DAY AGENT BOOTCAMP
  // ---------------------------------------------------------------------------
  {
    id: "prod-8",
    name: "MSREG 5-Day Agent Bootcamp",
    slug: "msreg-5-day-agent-bootcamp",
    description: "High-intensity 5-day daily sprint focusing on outbound dials, objection handling, and appointments.",
    coverImageUrl: "/covers/five-day-bootcamp.jpg",
    sortOrder: 8,
    sections: [
      {
        name: "Day 1: Mindset, CRM & Sphere of Influence",
        sortOrder: 1,
        lessons: [
          {
            id: "pb-5db-1",
            title: "Day 1: High-Velocity Sprint Kickoff & 20 Conversations",
            slug: "day-1-high-velocity-sprint-kickoff",
            product: "MSREG 5-Day Agent Bootcamp",
            category: "Day 1: Mindset, CRM & Sphere of Influence",
            sortOrder: 1,
            summary: "Day 1 kickoff mission: database scrub and reaching 20 live real estate conversations before 5 PM.",
            tags: ["5DayBootcamp", "Sprint", "Outbound"],
            owner: "Matt Smith",
            status: "published",
            content: `# Day 1: High-Velocity Sprint Kickoff & 20 Conversations

## Purpose
Launch the 5-day bootcamp sprint with immediate massive action, conquering call reluctance on Day 1.

## When to use this
Day 1 of the scheduled MSREG 5-Day Agent Bootcamp.

## Steps
1. **9:00 AM**: Group kick-off, review daily scorecards and set daily targets.
2. **9:30 AM - 12:00 PM**: Block 1 - Sphere of Influence calls (Goal: 10 live conversations).
3. **1:00 PM - 3:30 PM**: Block 2 - Past client & referral calls (Goal: 10 live conversations).
4. **4:00 PM**: Daily debrief, log results in Sisu, and celebrate booked appointments.

## Notes / gotchas
- Count only two-way conversations about real estate. Left voicemails do not count as conversations.

## Related playbooks
- Day 2: Circle Prospecting Machine
- Day 3: Mega Open House Mastery`,
          },
        ],
      },
      {
        name: "Day 2: Circle Prospecting Machine",
        sortOrder: 2,
        lessons: [
          {
            id: "pb-5db-2",
            title: "Day 2: Circle Prospecting Just Listed / Just Sold Talk Track",
            slug: "day-2-circle-prospecting-machine",
            product: "MSREG 5-Day Agent Bootcamp",
            category: "Day 2: Circle Prospecting Machine",
            sortOrder: 1,
            summary: "Setting up Mojo dialer and executing circle calls to neighbors around recent team sales.",
            tags: ["CircleProspecting", "Mojo", "5DayBootcamp"],
            owner: "Matt Smith",
            status: "published",
            videoUrl: "https://storage.googleapis.com/msgsndr/courses/bootcamp/circle-dial-demo.mp4",
            content: `# Day 2: Circle Prospecting Just Listed / Just Sold Talk Track

## Purpose
Master the outbound circle dialing machine around our team's active and recently closed listings.

## When to use this
Day 2 of the 5-Day Bootcamp.

## Steps
1. Select a recently closed MSREG listing with strong sales price metrics.
2. Export a 250-contact radius into Mojo dialer.
3. Execute the script: *"Hi, this is [Name] with Matt Smith Real Estate Group. We just sold your neighbor's home on Oak Street with multiple offers, and we still have 3 buyers looking in your neighborhood. Have you thought about what your home might sell for in today's market?"*
4. Offer free instant equity evaluation and capture email.

## Notes / gotchas
- Tone matters more than words: be curious, neighborly, and relaxed.

## Related playbooks
- Day 1: High-Velocity Sprint Kickoff & 20 Conversations
- Day 3: Mega Open House Mastery`,
          },
        ],
      },
      {
        name: "Day 3: Mega Open House Mastery",
        sortOrder: 3,
        lessons: [
          {
            id: "pb-5db-3",
            title: "Day 3: Mega Open House 5-Day Prep & Sign Blitz",
            slug: "day-3-mega-open-house-mastery",
            product: "MSREG 5-Day Agent Bootcamp",
            category: "Day 3: Mega Open House Mastery",
            sortOrder: 1,
            summary: "The 35-sign placement strategy, door knocking 50 neighbors, and digital registration setup.",
            tags: ["OpenHouse", "MegaOpenHouse", "LeadGen"],
            owner: "Matt Smith",
            status: "published",
            content: `# Day 3: Mega Open House 5-Day Prep & Sign Blitz

## Purpose
Turn an ordinary open house into a high-visibility event that generates 10-20 qualified buyer and seller leads.

## When to use this
Day 3 of the 5-Day Bootcamp.

## Steps
1. Secure the open house listing in Tuesday sales meeting.
2. Door knock 50 surrounding neighbors with the private neighbor preview invitation.
3. Launch targeted Facebook event with professional photo media.
4. Deploy 25-35 high-visibility directional signs at key intersections 2 hours prior to start.
5. Set up digital QR code iPad sign-in station at front door.

## Notes / gotchas
- Never sit on your phone during an open house. Greet every guest at the door with a smile and a property feature sheet.

## Related playbooks
- Day 2: Circle Prospecting Machine
- Day 4: The In-Person Buyer Consultation`,
          },
        ],
      },
    ],
  },
];
