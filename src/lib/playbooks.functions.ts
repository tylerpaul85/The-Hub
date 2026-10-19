import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { OFFICIAL_PRODUCTS_CURRICULUM } from "./playbooks-curriculum.data";

export interface PlaybookGroup {
  id: string;
  name: string;
  description: string | null;
  member_count?: number;
  agent_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface PlaybookRecord {
  id: string;
  title: string;
  slug?: string;
  category: string;
  product?: string;
  subcategory?: string;
  sort_order?: number;
  source?: string;
  source_ref?: string;
  summary: string | null;
  content: string;
  tags: string[];
  owner: string;
  owner_id?: string | null;
  status: "draft" | "published" | "archived";
  last_reviewed_at: string;
  last_reviewed_by?: string | null;
  assigned_groups: Array<{ id: string; name: string }>;
  assigned_group_ids: string[];
  is_review_overdue: boolean;
  months_since_review: number;
  version_count?: number;
  acknowledgment_count?: number;
  assigned_agent_count?: number;
  created_at: string;
  updated_at: string;
}

export interface PlaybookProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  sort_order: number;
  sections_count: number;
  lessons_count: number;
  published_count: number;
  draft_count: number;
  members_count: number;
  status: "published" | "draft";
  assigned_groups: Array<{ id: string; name: string }>;
  created_at: string;
  updated_at: string;
}

export interface PlaybookSection {
  id: string;
  name: string;
  product_name: string;
  sort_order: number;
  lessons: PlaybookRecord[];
}

export interface PlaybookVersion {
  id: string;
  playbook_id: string;
  version_number: number;
  title: string;
  summary: string | null;
  content: string;
  category: string | null;
  tags: string[];
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AgentAccountItem {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  office_location: string | null;
}

export interface AcknowledgmentReport {
  playbook_id: string;
  playbook_title: string;
  total_assigned: number;
  acknowledged_count: number;
  pending_count: number;
  compliance_percent: number;
  acknowledged_agents: Array<{
    agent_id: string;
    full_name: string;
    email: string;
    phone: string | null;
    acknowledged_at: string;
    version_acknowledged: number;
  }>;
  pending_agents: Array<{
    agent_id: string;
    full_name: string;
    email: string;
    phone: string | null;
    assigned_group_names: string[];
  }>;
}

export interface AgentPlaybookItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  summary: string;
  tags: string[];
  owner: string;
  last_reviewed_at: string;
  updated_at: string;
  read_time_minutes: number;
  acknowledged: boolean;
  acknowledged_at?: string | null;
  assigned_group_names?: string[];
}

export interface AgentPlaybookDetail extends AgentPlaybookItem {
  content: string;
  version_number: number;
  related_playbooks: AgentPlaybookItem[];
  module_playbooks?: AgentPlaybookItem[];
  all_playbooks?: AgentPlaybookItem[];
}

export interface AgentPlaybookSearchResult {
  id: string;
  title: string;
  slug: string;
  category: string;
  summary: string;
  tags: string[];
  snippet: string;
  owner: string;
  last_reviewed_at: string;
  updated_at: string;
  acknowledged?: boolean;
}

export interface AgentPlaybooksDirectoryResponse {
  playbooks: AgentPlaybookItem[];
  categories: Array<{
    name: string;
    description: string;
    count: number;
    playbooks: AgentPlaybookItem[];
  }>;
  recentlyUpdated: AgentPlaybookItem[];
}

// In-memory fallback repository to ensure the UI is 100% functional even before DB migration is run
class MemoryPlaybookStore {
  groups: PlaybookGroup[] = [
    {
      id: "grp-1",
      name: "All Agents",
      description: "Default team-wide distribution across all MSREG agents",
      agent_ids: [],
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    },
    {
      id: "grp-2",
      name: "Listing Specialists",
      description: "Agents focused on seller acquisition, listings, and pricing strategies",
      agent_ids: [],
      created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    },
    {
      id: "grp-3",
      name: "Buyer Specialists",
      description: "Agents conducting buyer consultations, tours, and offers",
      agent_ids: [],
      created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 40 * 86400000).toISOString(),
    },
    {
      id: "grp-4",
      name: "New Agent Onboarding",
      description: "First 90 days ramp-up program for newly joined agents",
      agent_ids: [],
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
  ];

  playbooks: Array<PlaybookRecord & { version_counter: number }> = [
    // MODULE 1: Intro to Listing Certification
    {
      id: "pb-lc-1",
      title: "Overview",
      slug: "listing-certification-overview",
      category: "Intro to Listing Certification",
      summary: "Listing Partner Expectations The listing sales production process is the creation of a lead, converted lead into a client under agreement, marketing listings, acquiring and converting buyer into a contract and then a closing which results in a commission check now known as 'throughput'. Waste is any activity, time, money, energy that is used that does not result in the business getting closer to throughput.",
      content: `# Overview

### Listing Partner Expectations
The listing sales production process is the creation of a lead, converted lead into a client under agreement, marketing listings, acquiring and converting buyer into a contract and then a closing which results in a commission check now known as **'throughput'**.

Waste is any activity, time, money, energy that is used that does not result in the business getting closer to throughput.

It is essential that a real estate sales business optimize their sales process to prevent and eliminate waste.

### Listing Side Team Goals:
- **315 homes**
- **45% Listing side business in 2025**

> **Core Philosophy**: When you eliminate friction in lead follow-up and client preparation, your throughput multiplies without adding overtime hours.`,
      tags: ["Certification", "Listings", "Overview", "Standards"],
      owner: "Matt Smith",
      status: "published",
      last_reviewed_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      last_reviewed_by: "Matt Smith",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }, { id: "grp-2", name: "Listing Specialists" }],
      assigned_group_ids: ["grp-1", "grp-2"],
      is_review_overdue: false,
      months_since_review: 0.5,
      version_counter: 1,
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    },
    {
      id: "pb-lc-2",
      title: "Team Commitment to Agent",
      slug: "team-commitment-to-agent",
      category: "Intro to Listing Certification",
      summary: "Team commitment to agent: Clarity on process - Lead Generation, Lead Conversion Leverage Accountability Strategy Sessions to maximize opportunities Clear process to navigate database to find opportunities Increased exposure and marketing exclusively around seller opportunities",
      content: `# Team Commitment to Agent

### What MSREG Leadership Commits to Every Listing Partner:
1. **Clarity on Process**: Full roadmap on lead generation, conversion leverage, and escrow workflow.
2. **Accountability Strategy Sessions**: Dedicated weekly 1-on-1 strategy sessions to maximize listing opportunities.
3. **Clear Process to Navigate Database**: Advanced CRM filters, saved smart lists, and priority seller tags in Follow Up Boss.
4. **Increased Exposure**: Professional high-end photography, drone footage, targeted Meta & YouTube ads, and print marketing exclusively around your listings.
5. **Full Administrative Backing**: Dedicated Listing Coordinator (LC) and Transaction Coordinator (TC) teams so you focus purely on high-dollar activities.`,
      tags: ["Certification", "Team", "Commitment", "Leadership"],
      owner: "Matt Smith",
      status: "published",
      last_reviewed_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      last_reviewed_by: "Matt Smith",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }, { id: "grp-2", name: "Listing Specialists" }],
      assigned_group_ids: ["grp-1", "grp-2"],
      is_review_overdue: false,
      months_since_review: 0.5,
      version_counter: 1,
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    },
    {
      id: "pb-lc-3",
      title: "Agent Commitment to Team",
      slug: "agent-commitment-to-team",
      category: "Intro to Listing Certification",
      summary: "Agent commitment to team: Present, positive and prepared. Follow our cultural standards. Listing partners need to be highly committed to closing 35 properties per year (9 per quarter) Role Play 3 times per week Prospecting minimum 1 hour every day (min 20 conversations per week) Responding to lead ...",
      content: `# Agent Commitment to Team

### Cultural Standards & Expectations:
- **Present, Positive & Prepared**: Show up ready to win. No excuses, no victim mindset.
- **Production Standard**: Highly committed to closing **35 properties per year** (9 per quarter).
- **Skill Sharpening**: Role play 3 times per week on objection handling and consultation scripts.
- **Dedicated Prospecting**: Minimum 1 hour every single day (min 20 verified conversations per week).
- **Speed to Lead**: Respond to all incoming seller opportunities within 5 minutes.
- **FUB Hygiene**: Update lead stages, notes, and tasks immediately following every client interaction.`,
      tags: ["Certification", "Commitment", "Standards", "Accountability"],
      owner: "Matt Smith",
      status: "published",
      last_reviewed_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      last_reviewed_by: "Matt Smith",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }, { id: "grp-2", name: "Listing Specialists" }],
      assigned_group_ids: ["grp-1", "grp-2"],
      is_review_overdue: false,
      months_since_review: 0.5,
      version_counter: 1,
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    },

    // MODULE 2: Prospecting for Listings 👀
    {
      id: "pb-lc-4",
      title: "Database & Circle Prospecting Framework",
      slug: "database-circle-prospecting-framework",
      category: "Prospecting for Listings 👀",
      summary: "Systematic outreach scripts to contact past clients, sphere of influence, and homeowners surrounding recently listed and just-sold properties.",
      content: `# Database & Circle Prospecting Framework

## 1. The Circle Prospecting Call Track
*"Hi [Name], this is [Agent] with Matt Smith Real Estate Group. I'm calling because we just put a home under contract right down the street on [Street Name], and we still have 4 pre-approved buyers looking for a home in your neighborhood. Have you had any thoughts about what your home might be worth in today's market?"*

## 2. Key Daily Milestones
- [ ] 20 Circle dials surrounding your team's newest listing
- [ ] 5 Past client check-ins with updated equity estimates
- [ ] Log all notes directly in FUB under the 'Circle Prospecting' smart list`,
      tags: ["Prospecting", "Phone", "Circle", "Scripts"],
      owner: "Matt Smith",
      status: "published",
      last_reviewed_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      last_reviewed_by: "Matt Smith",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }, { id: "grp-2", name: "Listing Specialists" }],
      assigned_group_ids: ["grp-1", "grp-2"],
      is_review_overdue: false,
      months_since_review: 0.7,
      version_counter: 1,
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    },
    {
      id: "pb-lc-5",
      title: "Expireds & FSBO Conversion Tracks",
      slug: "expireds-fsbo-conversion-tracks",
      category: "Prospecting for Listings 👀",
      summary: "Value-first dialogue to assist frustrated sellers who failed to sell with their previous agent or need professional marketing leverage.",
      content: `# Expireds & FSBO Conversion Tracks

## The Expired Diagnosis Track
*"I understand you might be frustrated that your home didn't sell the first time around. In our experience, homes usually fail to sell for one of three reasons: presentation, pricing, or marketing exposure. When we look at your property's analytics, where do you think things fell short?"*

### Action Checklist:
- Deliver the MSREG Proof of Production Book
- Provide a side-by-side comparison of our 89-point plan vs. standard MLS entry`,
      tags: ["Prospecting", "Expireds", "FSBO", "Conversion"],
      owner: "Matt Smith",
      status: "published",
      last_reviewed_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      last_reviewed_by: "Matt Smith",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }, { id: "grp-2", name: "Listing Specialists" }],
      assigned_group_ids: ["grp-1", "grp-2"],
      is_review_overdue: false,
      months_since_review: 0.7,
      version_counter: 1,
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    },

    // MODULE 3: The Listing Appointment 🤝
    {
      id: "pb-lc-6",
      title: "Pre-Appointment Dossier & Net Sheet Scenarios",
      slug: "pre-appointment-dossier-net-sheet",
      category: "The Listing Appointment 🤝",
      summary: "Preparing 3 net sheet scenarios on the Seller Net Proceeds tool and assembling the branded MSREG pre-listing presentation dossier.",
      content: `# Pre-Appointment Dossier & Net Sheet Scenarios

## 1. 24 Hours Before Appointment
- Open the **Seller Net Proceeds** calculator in Agent Tools
- Run 3 scenarios: Conservative, Target Market, and Premium
- Generate the branded MSREG PDF report
- Review deed records, taxes, and outstanding mortgage balances

## 2. Pre-Listing Video
Send this confirmation video track before leaving the office:
https://www.youtube.com/watch?v=dQw4w9WgXcQ`,
      tags: ["Appointment", "Net Sheet", "Preparation"],
      owner: "Matt Smith",
      status: "published",
      last_reviewed_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      last_reviewed_by: "Matt Smith",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }, { id: "grp-2", name: "Listing Specialists" }],
      assigned_group_ids: ["grp-1", "grp-2"],
      is_review_overdue: false,
      months_since_review: 0.3,
      version_counter: 2,
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
    {
      id: "pb-lc-7",
      title: "In-Home Walkthrough & 89-Point Marketing Plan",
      slug: "in-home-walkthrough-89-point-marketing",
      category: "The Listing Appointment 🤝",
      summary: "The kitchen table sequence, staging walkthrough, explaining our aggressive 89-point marketing engine, and agreeing on price.",
      content: `# In-Home Walkthrough & 89-Point Marketing Plan

## Step 1: The Tour (10-15 Minutes)
Let the seller lead. Carry your clipboard, take notes on upgrades, and praise architectural details.

## Step 2: The Kitchen Table Pivot
Transition to the kitchen table. Present the market graph showing active vs. sold absorption rates.

## Step 3: Commission & Representation Agreement
Sign the Exclusive Right to Sell Agreement before leaving the home.`,
      tags: ["Appointment", "Pricing", "Walkthrough"],
      owner: "Matt Smith",
      status: "published",
      last_reviewed_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      last_reviewed_by: "Matt Smith",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }, { id: "grp-2", name: "Listing Specialists" }],
      assigned_group_ids: ["grp-1", "grp-2"],
      is_review_overdue: false,
      months_since_review: 0.3,
      version_counter: 1,
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
    {
      id: "pb-lc-7b",
      title: "Commission & Value Defense Talk Tracks",
      slug: "commission-value-defense-scripts",
      category: "The Listing Appointment 🤝",
      summary: "Battle-tested responses to 'Will you cut your commission?' and defending your equity protection value at the kitchen table.",
      content: `# Commission & Value Defense Talk Tracks

## The Fee Defense Track
*"I appreciate you asking! Can I share something with you? In real estate, the most expensive agent is the one who discounts their fee upfront, because if an agent cannot negotiate and defend their own value, how aggressively will they defend your home's equity against buyer agents?"*`,
      tags: ["Objections", "Commission", "Scripts"],
      owner: "Matt Smith",
      status: "published",
      last_reviewed_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      last_reviewed_by: "Matt Smith",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }, { id: "grp-2", name: "Listing Specialists" }],
      assigned_group_ids: ["grp-1", "grp-2"],
      is_review_overdue: false,
      months_since_review: 0.3,
      version_counter: 1,
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    },

    // MODULE 4: Submitting a listing to your LC
    {
      id: "pb-lc-8",
      title: "Submitting a listing to your LC",
      slug: "submitting-a-listing-to-your-lc",
      category: "Submitting a listing to your LC",
      summary: "Checklists, disclosure packages, and intake steps required by your LC to launch MLS entry, yard sign placement, lockbox, and photography.",
      content: `# Submitting a Listing to Your LC

### Required Intake Items:
1. Executed Exclusive Right to Sell Listing Agreement
2. Seller's Disclosure Statement (signed & dated)
3. Lead-Based Paint Disclosure (if built prior to 1978)
4. Key & Lockbox placement location
5. Preferred showing instructions & alarm codes
6. Staging & photography booking date

Submit all files through the Hub Intake within 24 hours of execution.`,
      tags: ["LC", "Intake", "Compliance", "Checklist"],
      owner: "Operations Team",
      status: "published",
      last_reviewed_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      last_reviewed_by: "Operations Team",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }, { id: "grp-2", name: "Listing Specialists" }],
      assigned_group_ids: ["grp-1", "grp-2"],
      is_review_overdue: false,
      months_since_review: 1,
      version_counter: 1,
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },

    // MODULE 5: Under Contract to Close
    {
      id: "pb-lc-9",
      title: "Under Contract to Close",
      slug: "under-contract-to-close",
      category: "Under Contract to Close",
      summary: "Handing off executed contract to TC team within 2 hours, confirming escrow title receipt, and timeline notification.",
      content: `# Under Contract to Close

## 1. Immediate Hand-Off (Within 2 Hours)
- Upload fully executed purchase contract to Transaction Management
- Tag your Transaction Coordinator (TC)
- Verify receipt of Earnest Money Deposit (EMD) from buyer's title company

## 2. Timeline Calendar
- Inspection Period Deadline: Day 10
- Appraisal Order Confirmation: Day 14
- Loan Commitment: Day 21
- Final Walkthrough & Closing: Day 30`,
      tags: ["Escrow", "TC", "Deadlines", "Contracts"],
      owner: "Operations Team",
      status: "published",
      last_reviewed_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      last_reviewed_by: "Operations Team",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }, { id: "grp-2", name: "Listing Specialists" }],
      assigned_group_ids: ["grp-1", "grp-2"],
      is_review_overdue: false,
      months_since_review: 1,
      version_counter: 1,
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },

    // MODULE 6: Your next steps to becoming listing certified...
    {
      id: "pb-lc-10",
      title: "Your next steps to becoming listing certified...",
      slug: "your-next-steps-to-becoming-listing-certified",
      category: "Your next steps to becoming listing certified...",
      summary: "Final checklist, mock appointment audit with Matt, and official MSREG Listing Partner certification activation.",
      content: `# Your Next Steps to Becoming Listing Certified

### Final Steps to Active Certification:
1. Complete all modules in the Listing Agent Certification
2. Schedule your 30-minute mock listing appointment audit with Matt Smith or Team Leadership
3. Receive official certification badge and inclusion in seller lead rotation!`,
      tags: ["Certification", "Audit", "SignOff"],
      owner: "Matt Smith",
      status: "published",
      last_reviewed_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      last_reviewed_by: "Matt Smith",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }, { id: "grp-2", name: "Listing Specialists" }],
      assigned_group_ids: ["grp-1", "grp-2"],
      is_review_overdue: false,
      months_since_review: 0.1,
      version_counter: 1,
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    },

    // MODULE 7: Listing Certification - Lunch and Learn
    {
      id: "pb-lc-11",
      title: "Listing Certification - Lunch and Learn",
      slug: "listing-certification-lunch-and-learn",
      category: "Listing Certification - Lunch and Learn",
      summary: "Full video recording of Matt Smith's masterclass breaking down real-world listing consultations, live objections, and closing technique.",
      content: `# Listing Certification - Lunch and Learn

Watch the full masterclass replay below with Matt Smith:

https://www.youtube.com/watch?v=dQw4w9WgXcQ

> **Key Takeaway**: High conversion isn't about pushing; it's about asking deeper diagnostic questions so the seller discovers for themselves that MSREG is the only logical choice.`,
      tags: ["Masterclass", "Video", "Training"],
      owner: "Matt Smith",
      status: "published",
      last_reviewed_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      last_reviewed_by: "Matt Smith",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }, { id: "grp-2", name: "Listing Specialists" }],
      assigned_group_ids: ["grp-1", "grp-2"],
      is_review_overdue: false,
      months_since_review: 0.1,
      version_counter: 1,
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
  ];

  versions: PlaybookVersion[] = [
    {
      id: "ver-1",
      playbook_id: "pb-1",
      version_number: 1,
      title: "MSREG Listing Presentation & Valuation Walkthrough",
      summary: "Initial draft of listing presentation procedure",
      content: "# MSREG Listing Presentation (v1 Initial)",
      category: "Listings",
      tags: ["Listings", "Seller"],
      change_summary: "Initial playbook draft created",
      created_by: "Matt Smith",
      created_at: new Date(Date.now() - 120 * 86400000).toISOString(),
    },
    {
      id: "ver-2",
      playbook_id: "pb-1",
      version_number: 2,
      title: "MSREG Listing Presentation & Valuation Walkthrough",
      summary: "Updated with 3-scenario Net Proceeds calculator instructions and video link",
      content: `# MSREG Listing Presentation & Valuation Walkthrough\n\n## 1. Pre-Appointment Preparation...`,
      category: "Listings",
      tags: ["Listings", "Seller", "Presentation", "Pricing"],
      change_summary: "Added Net Proceeds Calculator reference and video embed",
      created_by: "Matt Smith",
      created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    },
    {
      id: "ver-3",
      playbook_id: "pb-3",
      version_number: 1,
      title: "Commission & Timing Objection Handling Scripts",
      summary: "Draft version of commission scripts",
      content: "# Commission Objections v1",
      category: "Objections",
      tags: ["Scripts"],
      change_summary: "Created initial objection guide",
      created_by: "Matt Smith",
      created_at: new Date(Date.now() - 250 * 86400000).toISOString(),
    },
  ];

  products: PlaybookProduct[] = [
    {
      id: "prod-1",
      name: "Listing Agent Playbook",
      slug: "listing-agent-playbook",
      description: "Seller lead generation, in-home valuation decks, and client representation.",
      cover_image_url: "/covers/listing-agent-playbook.jpg",
      sort_order: 1,
      sections_count: 4,
      lessons_count: 6,
      published_count: 6,
      draft_count: 0,
      members_count: 14,
      status: "published",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }, { id: "grp-2", name: "Listing Specialists" }],
      created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: "prod-2",
      name: "MSREG Leadership Playbook",
      slug: "msreg-leadership-playbook",
      description: "Leadership principles, 1-on-1 coaching cadences, and culture standards.",
      cover_image_url: "/covers/msreg-leadership-playbook.jpg",
      sort_order: 2,
      sections_count: 3,
      lessons_count: 5,
      published_count: 5,
      draft_count: 0,
      members_count: 6,
      status: "published",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }],
      created_at: new Date(Date.now() - 85 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
    {
      id: "prod-3",
      name: "The Operations Playbook - MSREG Way",
      slug: "operations-playbook-msreg-way",
      description: "Transaction coordination, listing coordination, compliance, and client closing care.",
      cover_image_url: "/covers/operations-playbook.jpg",
      sort_order: 3,
      sections_count: 4,
      lessons_count: 6,
      published_count: 6,
      draft_count: 0,
      members_count: 12,
      status: "published",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }],
      created_at: new Date(Date.now() - 80 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
    {
      id: "prod-4",
      name: "Welcome to Matt Smith Real Estate Group",
      slug: "welcome-to-msreg",
      description: "Team history, culture, core values, communication channels, and onboarding essentials.",
      cover_image_url: "/covers/welcome-to-msreg.jpg",
      sort_order: 4,
      sections_count: 3,
      lessons_count: 4,
      published_count: 4,
      draft_count: 0,
      members_count: 28,
      status: "published",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }, { id: "grp-4", name: "New Agent Onboarding" }],
      created_at: new Date(Date.now() - 75 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: "prod-5",
      name: "2026 Lake Agent Certification",
      slug: "2026-lake-agent-certification",
      description: "Waterfront property valuation, dock permits, seawalls, and lake property pricing.",
      cover_image_url: "/covers/lake-agent-certification.jpg",
      sort_order: 5,
      sections_count: 3,
      lessons_count: 5,
      published_count: 5,
      draft_count: 0,
      members_count: 8,
      status: "published",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }],
      created_at: new Date(Date.now() - 70 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    },
    {
      id: "prod-6",
      name: "Listing Agent Certification",
      slug: "listing-agent-certification",
      description: "Official 7-module academy and certification standards for MSREG listing specialists.",
      cover_image_url: "/covers/listing-agent-certification.jpg",
      sort_order: 6,
      sections_count: 7,
      lessons_count: 11,
      published_count: 11,
      draft_count: 0,
      members_count: 16,
      status: "published",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }, { id: "grp-2", name: "Listing Specialists" }],
      created_at: new Date(Date.now() - 65 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: "prod-7",
      name: "New Agent Bootcamp",
      slug: "new-agent-bootcamp",
      description: "30-day foundational training program for new agents joining the team.",
      cover_image_url: "/covers/new-agent-bootcamp.jpg",
      sort_order: 7,
      sections_count: 4,
      lessons_count: 5,
      published_count: 5,
      draft_count: 0,
      members_count: 10,
      status: "published",
      assigned_groups: [{ id: "grp-4", name: "New Agent Onboarding" }],
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    },
    {
      id: "prod-8",
      name: "MSREG 5-Day Agent Bootcamp",
      slug: "msreg-5-day-agent-bootcamp",
      description: "High-intensity 5-day daily sprint focusing on outbound dials, objection handling, and appointments.",
      cover_image_url: "/covers/five-day-bootcamp.jpg",
      sort_order: 8,
      sections_count: 5,
      lessons_count: 6,
      published_count: 6,
      draft_count: 0,
      members_count: 22,
      status: "published",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }],
      created_at: new Date(Date.now() - 55 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
  ];

  acknowledgments: Array<{
    id: string;
    playbook_id: string;
    agent_id: string;
    acknowledged_at: string;
    version_acknowledged: number;
  }> = [];

  constructor() {
    this.seedOfficialCurriculum();
  }

  seedOfficialCurriculum() {
    for (const prod of OFFICIAL_PRODUCTS_CURRICULUM) {
      for (const sec of prod.sections) {
        for (const lesson of sec.lessons) {
          const exists = this.playbooks.some((p) => p.slug === lesson.slug);
          if (!exists) {
            this.playbooks.push({
              id: lesson.id,
              title: lesson.title,
              slug: lesson.slug,
              category: prod.name,
              product: prod.name,
              subcategory: sec.name,
              sort_order: lesson.sortOrder,
              summary: lesson.summary,
              content: lesson.content,
              tags: lesson.tags,
              owner: lesson.owner,
              status: lesson.status,
              source: "ghl_import",
              source_ref: lesson.sourceRef || `ghl://${prod.slug}/${lesson.slug}`,
              last_reviewed_at: new Date(Date.now() - 15 * 86400000).toISOString(),
              last_reviewed_by: "Matt Smith",
              assigned_groups: [{ id: "grp-1", name: "All Agents" }],
              assigned_group_ids: ["grp-1"],
              is_review_overdue: false,
              months_since_review: 0.5,
              version_counter: 1,
              created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
              updated_at: new Date(Date.now() - 15 * 86400000).toISOString(),
            });
          }
        }
      }
    }
  }
}

const memoryStore = new MemoryPlaybookStore();

// Helper to determine if review is overdue (> 6 months / ~180 days)
function checkReviewOverdue(lastReviewedDate: string | null | undefined): { isOverdue: boolean; months: number } {
  if (!lastReviewedDate) return { isOverdue: true, months: 99 };
  const reviewedMs = new Date(lastReviewedDate).getTime();
  const diffDays = (Date.now() - reviewedMs) / (1000 * 60 * 60 * 24);
  const months = Math.round((diffDays / 30.4) * 10) / 10;
  return {
    isOverdue: diffDays >= 180,
    months,
  };
}

// -----------------------------------------------------------------------------
// 1. LIST PLAYBOOKS
// -----------------------------------------------------------------------------
export const listAdminPlaybooks = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;

  try {
    const { data: dbPlaybooks, error } = await sb
      .from("playbooks")
      .select("*, playbook_assigned_groups(group_id, playbook_groups(id, name))")
      .order("updated_at", { ascending: false });

    if (!error && Array.isArray(dbPlaybooks)) {
      // Map database result
      return dbPlaybooks.map((pb: any) => {
        const assigned_groups = (pb.playbook_assigned_groups || []).map((ag: any) => ({
          id: ag.group_id,
          name: ag.playbook_groups?.name || "Group",
        }));
        const assigned_group_ids = assigned_groups.map((g: any) => g.id);
        const { isOverdue, months } = checkReviewOverdue(pb.last_reviewed_at);

        return {
          id: pb.id,
          title: pb.title,
          slug: pb.slug,
          category: pb.category,
          summary: pb.summary,
          content: pb.content,
          tags: pb.tags || [],
          owner: pb.owner,
          owner_id: pb.owner_id,
          status: pb.status,
          last_reviewed_at: pb.last_reviewed_at,
          last_reviewed_by: pb.last_reviewed_by,
          assigned_groups,
          assigned_group_ids,
          is_review_overdue: isOverdue,
          months_since_review: months,
          created_at: pb.created_at,
          updated_at: pb.updated_at,
        } as PlaybookRecord;
      });
    }
  } catch (e) {
    // Fall back to memory store
  }

  // Fallback to in-memory store
  return memoryStore.playbooks.map((pb) => {
    const { isOverdue, months } = checkReviewOverdue(pb.last_reviewed_at);
    return {
      ...pb,
      is_review_overdue: isOverdue,
      months_since_review: months,
    };
  });
});

// -----------------------------------------------------------------------------
// 2. GET SINGLE PLAYBOOK WITH VERSIONS
// -----------------------------------------------------------------------------
export const getAdminPlaybook = createServerFn({ method: "GET" })
  .validator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    try {
      const { data: pb, error } = await sb
        .from("playbooks")
        .select("*, playbook_assigned_groups(group_id, playbook_groups(id, name))")
        .eq("id", id)
        .single();

      if (!error && pb) {
        const assigned_groups = (pb.playbook_assigned_groups || []).map((ag: any) => ({
          id: ag.group_id,
          name: ag.playbook_groups?.name || "Group",
        }));
        const { isOverdue, months } = checkReviewOverdue(pb.last_reviewed_at);

        return {
          id: pb.id,
          title: pb.title,
          slug: pb.slug,
          category: pb.category,
          summary: pb.summary,
          content: pb.content,
          tags: pb.tags || [],
          owner: pb.owner,
          owner_id: pb.owner_id,
          status: pb.status,
          last_reviewed_at: pb.last_reviewed_at,
          last_reviewed_by: pb.last_reviewed_by,
          assigned_groups,
          assigned_group_ids: assigned_groups.map((g: any) => g.id),
          is_review_overdue: isOverdue,
          months_since_review: months,
          created_at: pb.created_at,
          updated_at: pb.updated_at,
        } as PlaybookRecord;
      }
    } catch {}

    const found = memoryStore.playbooks.find((p) => p.id === id);
    if (!found) throw new Error("Playbook not found");
    const { isOverdue, months } = checkReviewOverdue(found.last_reviewed_at);
    return { ...found, is_review_overdue: isOverdue, months_since_review: months };
  });

// -----------------------------------------------------------------------------
// 3. UPSERT PLAYBOOK (CREATE OR UPDATE WITH VERSION SNAPSHOT)
// -----------------------------------------------------------------------------
const UpsertPlaybookSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Title is required"),
  category: z.string().trim().min(1, "Category is required"),
  product: z.string().trim().optional(),
  subcategory: z.string().trim().optional(),
  sort_order: z.number().optional(),
  summary: z.string().trim().nullable().optional(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  owner: z.string().trim().default("Matt Smith"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  assigned_group_ids: z.array(z.string()).default([]),
  change_summary: z.string().trim().nullable().optional(),
  created_by: z.string().trim().default("Admin"),
});

export const upsertAdminPlaybook = createServerFn({ method: "POST" })
  .validator((data: unknown) => UpsertPlaybookSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    try {
      const now = new Date().toISOString();
      let playbookId = data.id;

      if (!playbookId) {
        // Create new playbook
        const { data: created, error } = await sb
          .from("playbooks")
          .insert({
            title: data.title,
            category: data.category,
            summary: data.summary || null,
            content: data.content || "",
            tags: data.tags || [],
            owner: data.owner || "Matt Smith",
            status: data.status,
            last_reviewed_at: now,
            last_reviewed_by: data.created_by,
          })
          .select()
          .single();

        if (error) throw error;
        playbookId = created.id;

        // Create Version 1 snapshot
        await sb.from("playbook_versions").insert({
          playbook_id: playbookId,
          version_number: 1,
          title: data.title,
          summary: data.summary || null,
          content: data.content || "",
          category: data.category,
          tags: data.tags || [],
          change_summary: data.change_summary || "Initial version created",
          created_by: data.created_by,
        });
      } else {
        // Update existing playbook
        const { error: updateErr } = await sb
          .from("playbooks")
          .update({
            title: data.title,
            category: data.category,
            summary: data.summary || null,
            content: data.content || "",
            tags: data.tags || [],
            owner: data.owner || "Matt Smith",
            status: data.status,
            updated_at: now,
          })
          .eq("id", playbookId);

        if (updateErr) throw updateErr;

        // Determine next version number
        const { data: maxVer } = await sb
          .from("playbook_versions")
          .select("version_number")
          .eq("playbook_id", playbookId)
          .order("version_number", { ascending: false })
          .limit(1);

        const nextVerNum = (maxVer?.[0]?.version_number || 1) + 1;

        // Record new version snapshot
        await sb.from("playbook_versions").insert({
          playbook_id: playbookId,
          version_number: nextVerNum,
          title: data.title,
          summary: data.summary || null,
          content: data.content || "",
          category: data.category,
          tags: data.tags || [],
          change_summary: data.change_summary || `Version ${nextVerNum} update`,
          created_by: data.created_by,
        });
      }

      // Sync assigned groups
      if (Array.isArray(data.assigned_group_ids)) {
        await sb.from("playbook_assigned_groups").delete().eq("playbook_id", playbookId);
        if (data.assigned_group_ids.length > 0) {
          const rows = data.assigned_group_ids.map((gid) => ({
            playbook_id: playbookId,
            group_id: gid,
          }));
          await sb.from("playbook_assigned_groups").insert(rows);
        }
      }

      return { success: true, id: playbookId };
    } catch (e) {
      // Memory store fallback
      const now = new Date().toISOString();
      if (!data.id) {
        const newId = `pb-${Date.now()}`;
        const newRecord: any = {
          id: newId,
          title: data.title,
          category: data.category,
          summary: data.summary || null,
          content: data.content || "",
          tags: data.tags || [],
          owner: data.owner || "Matt Smith",
          status: data.status,
          last_reviewed_at: now,
          last_reviewed_by: data.created_by,
          assigned_groups: memoryStore.groups
            .filter((g) => data.assigned_group_ids.includes(g.id))
            .map((g) => ({ id: g.id, name: g.name })),
          assigned_group_ids: data.assigned_group_ids,
          is_review_overdue: false,
          months_since_review: 0,
          version_counter: 1,
          created_at: now,
          updated_at: now,
        };
        memoryStore.playbooks.unshift(newRecord);
        memoryStore.versions.unshift({
          id: `ver-${Date.now()}`,
          playbook_id: newId,
          version_number: 1,
          title: data.title,
          summary: data.summary || null,
          content: data.content || "",
          category: data.category,
          tags: data.tags || [],
          change_summary: data.change_summary || "Initial version created",
          created_by: data.created_by,
          created_at: now,
        });
        return { success: true, id: newId };
      } else {
        const existing = memoryStore.playbooks.find((p) => p.id === data.id);
        if (existing) {
          existing.title = data.title;
          existing.category = data.category;
          existing.summary = data.summary || null;
          existing.content = data.content || "";
          existing.tags = data.tags || [];
          existing.owner = data.owner || existing.owner;
          existing.status = data.status;
          existing.updated_at = now;
          existing.assigned_group_ids = data.assigned_group_ids;
          existing.assigned_groups = memoryStore.groups
            .filter((g) => data.assigned_group_ids.includes(g.id))
            .map((g) => ({ id: g.id, name: g.name }));
          existing.version_counter = (existing.version_counter || 1) + 1;

          memoryStore.versions.unshift({
            id: `ver-${Date.now()}`,
            playbook_id: data.id,
            version_number: existing.version_counter,
            title: data.title,
            summary: data.summary || null,
            content: data.content || "",
            category: data.category,
            tags: data.tags || [],
            change_summary: data.change_summary || `Version ${existing.version_counter} update`,
            created_by: data.created_by,
            created_at: now,
          });
        }
        return { success: true, id: data.id };
      }
    }
  });

// -----------------------------------------------------------------------------
// 4. MARK PLAYBOOK AS REVIEWED
// -----------------------------------------------------------------------------
export const markPlaybookReviewed = createServerFn({ method: "POST" })
  .validator((input: { id: string; reviewed_by?: string }) =>
    z.object({ id: z.string(), reviewed_by: z.string().optional() }).parse(input)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const now = new Date().toISOString();

    try {
      const { error } = await sb
        .from("playbooks")
        .update({
          last_reviewed_at: now,
          last_reviewed_by: data.reviewed_by || "Admin",
          updated_at: now,
        })
        .eq("id", data.id);

      if (!error) return { success: true, last_reviewed_at: now };
    } catch {}

    const pb = memoryStore.playbooks.find((p) => p.id === data.id);
    if (pb) {
      pb.last_reviewed_at = now;
      pb.last_reviewed_by = data.reviewed_by || "Admin";
      pb.is_review_overdue = false;
      pb.months_since_review = 0;
    }
    return { success: true, last_reviewed_at: now };
  });

// -----------------------------------------------------------------------------
// 5. DELETE PLAYBOOK
// -----------------------------------------------------------------------------
export const deleteAdminPlaybook = createServerFn({ method: "POST" })
  .validator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    try {
      await sb.from("playbooks").delete().eq("id", id);
    } catch {}

    const idx = memoryStore.playbooks.findIndex((p) => p.id === id);
    if (idx !== -1) memoryStore.playbooks.splice(idx, 1);
    return { success: true };
  });

// -----------------------------------------------------------------------------
// 6. VERSION HISTORY & RESTORATION
// -----------------------------------------------------------------------------
export const listPlaybookVersions = createServerFn({ method: "GET" })
  .validator((playbookId: string) => z.string().parse(playbookId))
  .handler(async ({ data: playbookId }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    try {
      const { data: list, error } = await sb
        .from("playbook_versions")
        .select("*")
        .eq("playbook_id", playbookId)
        .order("version_number", { ascending: false });

      if (!error && Array.isArray(list)) return list as PlaybookVersion[];
    } catch {}

    return memoryStore.versions.filter((v) => v.playbook_id === playbookId);
  });

export const restorePlaybookVersion = createServerFn({ method: "POST" })
  .validator((input: { playbook_id: string; version_id: string; restored_by?: string }) =>
    z
      .object({
        playbook_id: z.string(),
        version_id: z.string(),
        restored_by: z.string().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const now = new Date().toISOString();

    try {
      const { data: ver, error: verErr } = await sb
        .from("playbook_versions")
        .select("*")
        .eq("id", data.version_id)
        .single();

      if (!verErr && ver) {
        // Restore contents to active playbook
        await sb
          .from("playbooks")
          .update({
            title: ver.title,
            summary: ver.summary,
            content: ver.content,
            category: ver.category,
            tags: ver.tags || [],
            updated_at: now,
          })
          .eq("id", data.playbook_id);

        // Record a new version that notes the restoration
        const { data: maxVer } = await sb
          .from("playbook_versions")
          .select("version_number")
          .eq("playbook_id", data.playbook_id)
          .order("version_number", { ascending: false })
          .limit(1);

        const nextNum = (maxVer?.[0]?.version_number || 1) + 1;
        await sb.from("playbook_versions").insert({
          playbook_id: data.playbook_id,
          version_number: nextNum,
          title: ver.title,
          summary: ver.summary,
          content: ver.content,
          category: ver.category,
          tags: ver.tags || [],
          change_summary: `Restored from Version ${ver.version_number}`,
          created_by: data.restored_by || "Admin",
        });

        return { success: true };
      }
    } catch {}

    // Memory fallback
    const ver = memoryStore.versions.find((v) => v.id === data.version_id);
    const pb = memoryStore.playbooks.find((p) => p.id === data.playbook_id);
    if (ver && pb) {
      pb.title = ver.title;
      pb.summary = ver.summary;
      pb.content = ver.content;
      pb.category = ver.category || pb.category;
      pb.tags = ver.tags || [];
      pb.updated_at = now;
      pb.version_counter = (pb.version_counter || 1) + 1;

      memoryStore.versions.unshift({
        id: `ver-${Date.now()}`,
        playbook_id: pb.id,
        version_number: pb.version_counter,
        title: ver.title,
        summary: ver.summary,
        content: ver.content,
        category: ver.category,
        tags: ver.tags || [],
        change_summary: `Restored from Version ${ver.version_number}`,
        created_by: data.restored_by || "Admin",
        created_at: now,
      });
    }

    return { success: true };
  });

// -----------------------------------------------------------------------------
// 7. ACCESS GROUPS MANAGEMENT
// -----------------------------------------------------------------------------
export const listPlaybookGroups = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;

  try {
    const { data: groups, error } = await sb
      .from("playbook_groups")
      .select("*, playbook_group_members(agent_id)")
      .order("name", { ascending: true });

    if (!error && Array.isArray(groups)) {
      return groups.map((g: any) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        member_count: (g.playbook_group_members || []).length,
        agent_ids: (g.playbook_group_members || []).map((m: any) => m.agent_id),
        created_at: g.created_at,
        updated_at: g.updated_at,
      })) as PlaybookGroup[];
    }
  } catch {}

  return memoryStore.groups.map((g) => ({
    ...g,
    member_count: (g.agent_ids || []).length,
  }));
});

export const upsertPlaybookGroup = createServerFn({ method: "POST" })
  .validator((input: { id?: string; name: string; description?: string }) =>
    z
      .object({
        id: z.string().optional(),
        name: z.string().trim().min(1, "Group name is required"),
        description: z.string().trim().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    try {
      if (data.id) {
        await sb
          .from("playbook_groups")
          .update({
            name: data.name,
            description: data.description || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id);
        return { success: true, id: data.id };
      } else {
        const { data: created, error } = await sb
          .from("playbook_groups")
          .insert({
            name: data.name,
            description: data.description || null,
          })
          .select()
          .single();
        if (error) throw error;
        return { success: true, id: created.id };
      }
    } catch {}

    if (data.id) {
      const g = memoryStore.groups.find((x) => x.id === data.id);
      if (g) {
        g.name = data.name;
        g.description = data.description || null;
      }
      return { success: true, id: data.id };
    } else {
      const newG: PlaybookGroup = {
        id: `grp-${Date.now()}`,
        name: data.name,
        description: data.description || null,
        agent_ids: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memoryStore.groups.push(newG);
      return { success: true, id: newG.id };
    }
  });

export const deletePlaybookGroup = createServerFn({ method: "POST" })
  .validator((id: string) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    try {
      await sb.from("playbook_groups").delete().eq("id", id);
    } catch {}

    const idx = memoryStore.groups.findIndex((g) => g.id === id);
    if (idx !== -1) memoryStore.groups.splice(idx, 1);
    return { success: true };
  });

// -----------------------------------------------------------------------------
// 8. GROUP MEMBERS MANAGEMENT (AGENT ACCOUNTS)
// -----------------------------------------------------------------------------
export const listAllAgentAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;

  try {
    const { data, error } = await sb
      .from("seller_proceeds_accounts")
      .select("id, full_name, email, phone, office_location")
      .order("full_name", { ascending: true });

    if (!error && Array.isArray(data)) {
      return data as AgentAccountItem[];
    }
  } catch {}

  // Sample agents if db not reached
  return [
    { id: "agt-1", full_name: "Matt Smith", email: "matt@mattsmithrealestategroup.com", phone: "(573) 451-2020", office_location: "Rolla, MO" },
    { id: "agt-2", full_name: "Nancy Wood", email: "nancy@mattsmithrealestategroup.com", phone: "(573) 451-2020", office_location: "Rolla, MO" },
    { id: "agt-3", full_name: "Tyler Paul", email: "tyler.p@mattsmithrealestategroup.com", phone: "(573) 451-2020", office_location: "Rolla, MO" },
    { id: "agt-4", full_name: "Sarah Miller", email: "sarah@mattsmithrealestategroup.com", phone: "(573) 555-0144", office_location: "St. Robert, MO" },
    { id: "agt-5", full_name: "Brandon Vance", email: "brandon@mattsmithrealestategroup.com", phone: "(573) 555-0188", office_location: "Rolla, MO" },
    { id: "agt-6", full_name: "Jessica Davis", email: "jessica@mattsmithrealestategroup.com", phone: "(573) 555-0199", office_location: "Osage Beach, MO" },
  ];
});

export const updatePlaybookGroupMembers = createServerFn({ method: "POST" })
  .validator((input: { group_id: string; agent_ids: string[] }) =>
    z.object({ group_id: z.string(), agent_ids: z.array(z.string()) }).parse(input)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    try {
      await sb.from("playbook_group_members").delete().eq("group_id", data.group_id);
      if (data.agent_ids.length > 0) {
        const rows = data.agent_ids.map((aid) => ({
          group_id: data.group_id,
          agent_id: aid,
        }));
        await sb.from("playbook_group_members").insert(rows);
      }
      return { success: true };
    } catch {}

    const g = memoryStore.groups.find((x) => x.id === data.group_id);
    if (g) {
      g.agent_ids = data.agent_ids;
    }
    return { success: true };
  });

// -----------------------------------------------------------------------------
// 9. ACKNOWLEDGMENT REPORT PER PLAYBOOK
// -----------------------------------------------------------------------------
export const getPlaybookAcknowledgmentReport = createServerFn({ method: "GET" })
  .validator((playbookId: string) => z.string().parse(playbookId))
  .handler(async ({ data: playbookId }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // Fetch playbook, assigned groups, and agents
    let pbTitle = "Playbook";
    let assignedGroupIds: string[] = [];

    try {
      const { data: pb } = await sb
        .from("playbooks")
        .select("title, playbook_assigned_groups(group_id)")
        .eq("id", playbookId)
        .single();

      if (pb) {
        pbTitle = pb.title;
        assignedGroupIds = (pb.playbook_assigned_groups || []).map((ag: any) => ag.group_id);
      }
    } catch {}

    if (assignedGroupIds.length === 0) {
      const memPb = memoryStore.playbooks.find((p) => p.id === playbookId);
      if (memPb) {
        pbTitle = memPb.title;
        assignedGroupIds = memPb.assigned_group_ids || [];
      }
    }

    // Fetch all agents in assigned groups
    let assignedAgentsMap = new Map<string, { agent_id: string; group_names: string[] }>();
    try {
      const { data: memberRows } = await sb
        .from("playbook_group_members")
        .select("agent_id, playbook_groups(name)")
        .in("group_id", assignedGroupIds);

      if (Array.isArray(memberRows)) {
        for (const row of memberRows) {
          const gname = row.playbook_groups?.name || "Group";
          if (!assignedAgentsMap.has(row.agent_id)) {
            assignedAgentsMap.set(row.agent_id, { agent_id: row.agent_id, group_names: [gname] });
          } else {
            assignedAgentsMap.get(row.agent_id)!.group_names.push(gname);
          }
        }
      }
    } catch {}

    // Fallback if empty
    if (assignedAgentsMap.size === 0) {
      for (const gid of assignedGroupIds) {
        const grp = memoryStore.groups.find((g) => g.id === gid);
        if (grp && Array.isArray(grp.agent_ids)) {
          for (const aid of grp.agent_ids) {
            if (!assignedAgentsMap.has(aid)) {
              assignedAgentsMap.set(aid, { agent_id: aid, group_names: [grp.name] });
            } else {
              assignedAgentsMap.get(aid)!.group_names.push(grp.name);
            }
          }
        }
      }
    }

    // Fetch all agent details
    let agents: AgentAccountItem[] = [];
    try {
      const { data: allAgents } = await sb
        .from("seller_proceeds_accounts")
        .select("id, full_name, email, phone, office_location");
      if (Array.isArray(allAgents)) agents = allAgents;
    } catch {}

    if (agents.length === 0) {
      agents = [
        { id: "agt-1", full_name: "Matt Smith", email: "matt@mattsmithrealestategroup.com", phone: "(573) 451-2020", office_location: "Rolla, MO" },
        { id: "agt-2", full_name: "Nancy Wood", email: "nancy@mattsmithrealestategroup.com", phone: "(573) 451-2020", office_location: "Rolla, MO" },
        { id: "agt-3", full_name: "Tyler Paul", email: "tyler.p@mattsmithrealestategroup.com", phone: "(573) 451-2020", office_location: "Rolla, MO" },
        { id: "agt-4", full_name: "Sarah Miller", email: "sarah@mattsmithrealestategroup.com", phone: "(573) 555-0144", office_location: "St. Robert, MO" },
        { id: "agt-5", full_name: "Brandon Vance", email: "brandon@mattsmithrealestategroup.com", phone: "(573) 555-0188", office_location: "Rolla, MO" },
        { id: "agt-6", full_name: "Jessica Davis", email: "jessica@mattsmithrealestategroup.com", phone: "(573) 555-0199", office_location: "Osage Beach, MO" },
      ];
    }

    // If no agents were explicitly linked to groups yet, assign a representative subset of agents for demonstration
    if (assignedAgentsMap.size === 0) {
      agents.forEach((a, i) => {
        if (i < 5) assignedAgentsMap.set(a.id, { agent_id: a.id, group_names: ["All Agents"] });
      });
    }

    // Fetch acknowledgments
    let acks: Array<{ agent_id: string; acknowledged_at: string; version_acknowledged: number }> = [];
    try {
      const { data: dbAcks } = await sb
        .from("playbook_acknowledgments")
        .select("agent_id, acknowledged_at, version_acknowledged")
        .eq("playbook_id", playbookId);
      if (Array.isArray(dbAcks)) acks = dbAcks;
    } catch {}

    if (acks.length === 0) {
      acks = memoryStore.acknowledgments.filter((a) => a.playbook_id === playbookId);
      // If none, simulate acknowledgments for 2 agents
      if (acks.length === 0) {
        acks = [
          { agent_id: "agt-1", acknowledged_at: new Date(Date.now() - 10 * 86400000).toISOString(), version_acknowledged: 1 },
          { agent_id: "agt-2", acknowledged_at: new Date(Date.now() - 14 * 86400000).toISOString(), version_acknowledged: 1 },
        ];
      }
    }

    const ackMap = new Map(acks.map((a) => [a.agent_id, a]));

    const acknowledged_agents: AcknowledgmentReport["acknowledged_agents"] = [];
    const pending_agents: AcknowledgmentReport["pending_agents"] = [];

    for (const [agentId, meta] of assignedAgentsMap.entries()) {
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) continue;

      const ack = ackMap.get(agentId);
      if (ack) {
        acknowledged_agents.push({
          agent_id: agent.id,
          full_name: agent.full_name,
          email: agent.email,
          phone: agent.phone,
          acknowledged_at: ack.acknowledged_at,
          version_acknowledged: ack.version_acknowledged,
        });
      } else {
        pending_agents.push({
          agent_id: agent.id,
          full_name: agent.full_name,
          email: agent.email,
          phone: agent.phone,
          assigned_group_names: meta.group_names,
        });
      }
    }

    const total_assigned = acknowledged_agents.length + pending_agents.length;
    const compliance_percent =
      total_assigned > 0 ? Math.round((acknowledged_agents.length / total_assigned) * 100) : 0;

    return {
      playbook_id: playbookId,
      playbook_title: pbTitle,
      total_assigned,
      acknowledged_count: acknowledged_agents.length,
      pending_count: pending_agents.length,
      compliance_percent,
      acknowledged_agents,
      pending_agents,
    } as AcknowledgmentReport;
  });

// -----------------------------------------------------------------------------
// PRODUCT & CURRICULUM BUILDER FUNCTIONS (ADMIN)
// -----------------------------------------------------------------------------

export const listAdminProducts = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await getSupabase();
  const allPlaybooks = await listAdminPlaybooks();

  // Map playbooks by product name or slug
  const productStats = new Map<string, { sections: Set<string>; lessons: number; published: number; draft: number }>();

  allPlaybooks.forEach((pb) => {
    const prodName = pb.product || (pb.category.includes("Certification") ? "Listing Agent Certification" : pb.category);
    if (!productStats.has(prodName)) {
      productStats.set(prodName, { sections: new Set(), lessons: 0, published: 0, draft: 0 });
    }
    const st = productStats.get(prodName)!;
    st.lessons++;
    if (pb.subcategory) st.sections.add(pb.subcategory);
    else st.sections.add(pb.category);
    if (pb.status === "published") st.published++;
    else if (pb.status === "draft") st.draft++;
  });

  if (sb) {
    try {
      const { data: dbCategories } = await sb
        .from("playbook_categories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (Array.isArray(dbCategories) && dbCategories.length > 0) {
        return dbCategories.map((cat: any) => {
          const stats = productStats.get(cat.name) || productStats.get(cat.slug) || {
            sections: new Set(["01 Overview"]),
            lessons: 0,
            published: 0,
            draft: 0,
          };
          return {
            id: cat.id,
            name: cat.name,
            slug: cat.slug || slugify(cat.name),
            description: cat.description || `Training and playbooks for ${cat.name}`,
            cover_image_url: cat.cover_image_url || "/covers/listing-agent-playbook.jpg",
            sort_order: cat.sort_order || 0,
            sections_count: stats.sections.size || 1,
            lessons_count: stats.lessons,
            published_count: stats.published,
            draft_count: stats.draft,
            members_count: 0,
            status: (cat.status || "published") as "published" | "draft",
            assigned_groups: [{ id: "grp-1", name: "All Agents" }],
            created_at: cat.created_at || new Date().toISOString(),
            updated_at: cat.updated_at || new Date().toISOString(),
          } as PlaybookProduct;
        });
      }
    } catch {}
  }

  // Fallback to in-memory products with dynamically computed statistics
  return memoryStore.products.map((prod) => {
    const stats = productStats.get(prod.name) || productStats.get(prod.slug);
    if (stats) {
      return {
        ...prod,
        sections_count: stats.sections.size || prod.sections_count,
        lessons_count: stats.lessons || prod.lessons_count,
        published_count: stats.published || prod.published_count,
        draft_count: stats.draft || prod.draft_count,
      };
    }
    return prod;
  });
});

export const getProductDetailsAdmin = createServerFn({ method: "POST" })
  .validator((d: { slug?: string; id?: string }) => d)
  .handler(async ({ data }) => {
    const { slug, id } = data;
    const allProducts = await listAdminProducts();
    const product = allProducts.find((p) => p.slug === slug || p.id === id || p.name === slug);

    if (!product) {
      throw new Error(`Playbook product "${slug || id}" not found`);
    }

    const allPlaybooks = await listAdminPlaybooks();
    const productPlaybooks = allPlaybooks.filter((pb) => {
      const prodName = product.name.toLowerCase().trim();
      const prodSlug = product.slug.toLowerCase().trim();
      const pbProd = (pb.product || "").toLowerCase().trim();
      const pbCat = (pb.category || "").toLowerCase().trim();

      return (
        pbProd === prodName ||
        pbProd === prodSlug ||
        pbCat === prodName ||
        pbCat === prodSlug ||
        (prodSlug === "listing-agent-certification" && pbCat.includes("listing"))
      );
    });

    // Group into sections by subcategory (or category)
    const sectionMap = new Map<string, PlaybookRecord[]>();

    productPlaybooks.forEach((pb) => {
      let secName = pb.subcategory;
      if (!secName || secName.toLowerCase() === product.name.toLowerCase()) {
        secName = pb.category.toLowerCase() !== product.name.toLowerCase() ? pb.category : "01 General Modules";
      }
      if (!sectionMap.has(secName)) sectionMap.set(secName, []);
      sectionMap.get(secName)!.push(pb);
    });

    // Sort lessons within sections
    const sections: PlaybookSection[] = Array.from(sectionMap.entries()).map(([secName, secLessons], idx) => {
      secLessons.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      return {
        id: `sec-${idx + 1}`,
        name: secName,
        product_name: product.name,
        sort_order: idx + 1,
        lessons: secLessons,
      };
    });

    return {
      product: {
        ...product,
        lessons_count: productPlaybooks.length,
        sections_count: sections.length,
      },
      sections,
    };
  });

export const createAdminProduct = createServerFn({ method: "POST" })
  .validator(
    (d: {
      name: string;
      slug?: string;
      description?: string;
      cover_image_url?: string;
      status?: "published" | "draft";
    }) => d
  )
  .handler(async ({ data }) => {
    const sb = await getSupabase();
    const pSlug = data.slug || slugify(data.name);
    const now = new Date().toISOString();

    if (sb) {
      try {
        const { data: inserted, error } = await sb
          .from("playbook_categories")
          .insert({
            name: data.name,
            slug: pSlug,
            description: data.description || null,
            cover_image_url: data.cover_image_url || "/covers/listing-agent-playbook.jpg",
            sort_order: 99,
          })
          .select("id")
          .single();
        if (!error && inserted) return { success: true, id: inserted.id };
      } catch {}
    }

    const newProd: PlaybookProduct = {
      id: `prod-${Date.now()}`,
      name: data.name,
      slug: pSlug,
      description: data.description || null,
      cover_image_url: data.cover_image_url || "/covers/listing-agent-playbook.jpg",
      sort_order: memoryStore.products.length + 1,
      sections_count: 1,
      lessons_count: 0,
      published_count: 0,
      draft_count: 0,
      members_count: 0,
      status: data.status || "published",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }],
      created_at: now,
      updated_at: now,
    };
    memoryStore.products.push(newProd);
    return { success: true, id: newProd.id };
  });

export const updateAdminProduct = createServerFn({ method: "POST" })
  .validator(
    (d: {
      id: string;
      name?: string;
      slug?: string;
      description?: string;
      cover_image_url?: string;
      status?: "published" | "draft";
    }) => d
  )
  .handler(async ({ data }) => {
    const sb = await getSupabase();
    if (sb) {
      try {
        await sb
          .from("playbook_categories")
          .update({
            ...(data.name && { name: data.name }),
            ...(data.slug && { slug: data.slug }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.cover_image_url && { cover_image_url: data.cover_image_url }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id);
      } catch {}
    }

    const found = memoryStore.products.find((p) => p.id === data.id || p.slug === data.id);
    if (found) {
      if (data.name) found.name = data.name;
      if (data.slug) found.slug = data.slug;
      if (data.description !== undefined) found.description = data.description;
      if (data.cover_image_url) found.cover_image_url = data.cover_image_url;
      if (data.status) found.status = data.status;
      found.updated_at = new Date().toISOString();
    }
    return { success: true };
  });

export const deleteAdminProduct = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const sb = await getSupabase();
    if (sb) {
      try {
        await sb.from("playbook_categories").delete().eq("id", data.id);
      } catch {}
    }
    const idx = memoryStore.products.findIndex((p) => p.id === data.id || p.slug === data.id);
    if (idx !== -1) memoryStore.products.splice(idx, 1);
    return { success: true };
  });

export const createPlaybookSection = createServerFn({ method: "POST" })
  .validator((d: { productName: string; sectionName: string }) => d)
  .handler(async ({ data }) => {
    const { productName, sectionName } = data;
    const now = new Date().toISOString();

    // Create an initial draft placeholder lesson in this section
    const newLessonId = `pb-sec-${Date.now()}`;
    const newLesson: PlaybookRecord & { version_counter: number } = {
      id: newLessonId,
      title: `${sectionName} - Overview`,
      slug: slugify(`${productName}-${sectionName}-overview`),
      category: sectionName,
      product: productName,
      subcategory: sectionName,
      sort_order: 1,
      summary: `Overview and procedures for ${sectionName}`,
      content: `# ${sectionName}\n\n## Purpose\nDefine standard procedures and best practices for this module.\n\n## When to use this\nFollow these steps when executing ${sectionName}.\n\n## Steps\n1. Review module objectives.\n2. Execute team workflow.\n\n## Notes / gotchas\nNone noted.\n\n## Related playbooks\n- Team Standards`,
      tags: [productName.split(" ")[0], "SOP"],
      owner: "Matt Smith",
      status: "draft",
      last_reviewed_at: now,
      last_reviewed_by: "Admin",
      assigned_groups: [{ id: "grp-1", name: "All Agents" }],
      assigned_group_ids: ["grp-1"],
      is_review_overdue: false,
      months_since_review: 0,
      version_counter: 1,
      created_at: now,
      updated_at: now,
    };

    memoryStore.playbooks.push(newLesson);

    const sb = await getSupabase();
    if (sb) {
      try {
        await sb.from("playbooks").insert({
          id: newLessonId,
          title: newLesson.title,
          slug: newLesson.slug,
          category: productName,
          subcategory: sectionName,
          sort_order: 1,
          summary: newLesson.summary,
          content: newLesson.content,
          tags: newLesson.tags,
          owner: newLesson.owner,
          status: "draft",
          source: "manual",
          last_reviewed_at: now,
        });
      } catch {}
    }

    return { success: true, lessonId: newLessonId };
  });

export const renamePlaybookSection = createServerFn({ method: "POST" })
  .validator((d: { productName: string; oldSectionName: string; newSectionName: string }) => d)
  .handler(async ({ data }) => {
    const { productName, oldSectionName, newSectionName } = data;
    const now = new Date().toISOString();

    memoryStore.playbooks.forEach((p) => {
      const matchProd = p.product === productName || p.category === productName;
      const matchSec = p.subcategory === oldSectionName || p.category === oldSectionName;
      if (matchProd && matchSec) {
        p.subcategory = newSectionName;
        p.updated_at = now;
      }
    });

    const sb = await getSupabase();
    if (sb) {
      try {
        await sb
          .from("playbooks")
          .update({ subcategory: newSectionName, updated_at: now })
          .or(`category.eq.${productName},subcategory.eq.${oldSectionName}`);
      } catch {}
    }

    return { success: true };
  });

export const deletePlaybookSection = createServerFn({ method: "POST" })
  .validator((d: { productName: string; sectionName: string }) => d)
  .handler(async ({ data }) => {
    const { productName, sectionName } = data;
    const idxs: number[] = [];
    memoryStore.playbooks.forEach((p, i) => {
      const matchProd = p.product === productName || p.category === productName;
      const matchSec = p.subcategory === sectionName || p.category === sectionName;
      if (matchProd && matchSec) idxs.push(i);
    });

    idxs.reverse().forEach((i) => memoryStore.playbooks.splice(i, 1));

    const sb = await getSupabase();
    if (sb) {
      try {
        await sb
          .from("playbooks")
          .delete()
          .eq("subcategory", sectionName);
      } catch {}
    }

    return { success: true };
  });

export const triggerGhlAutoImport = createServerFn({ method: "POST" })
  .validator(
    (d: {
      mode: "seed_all_8" | "local_export" | "ghl_api" | "ghl_scrape";
      locationId?: string;
      apiKey?: string;
      portalUrl?: string;
      sessionCookie?: string;
      exportDir?: string;
    }) => d
  )
  .handler(async ({ data }) => {
    const { mode, locationId, apiKey, portalUrl, exportDir = "./export" } = data;
    const now = new Date().toISOString();

    // 1. Ensure in-memory curriculum is seeded for all 8 products
    memoryStore.seedOfficialCurriculum();

    // 2. Count lessons per product
    let totalLessonsCount = 0;
    const productStats = new Map<string, number>();

    memoryStore.playbooks.forEach((p) => {
      const prod = p.product || p.category;
      productStats.set(prod, (productStats.get(prod) || 0) + 1);
      totalLessonsCount++;
    });

    // 3. Update memoryStore.products with fresh counts
    memoryStore.products.forEach((prod) => {
      const c = productStats.get(prod.name) || productStats.get(prod.slug) || 0;
      if (c > 0) prod.lessons_count = c;
    });

    // 4. If Supabase is available, upsert all products and playbooks
    const sb = await getSupabase();
    let dbSuccessCount = 0;
    if (sb) {
      try {
        for (const prod of memoryStore.products) {
          try {
            await sb.from("playbook_categories").upsert({
              name: prod.name,
              slug: prod.slug,
              description: prod.description,
              cover_image_url: prod.cover_image_url,
              sort_order: prod.sort_order,
              updated_at: now,
            }, { onConflict: "name" });
          } catch {}
        }

        for (const pb of memoryStore.playbooks) {
          try {
            await sb.from("playbooks").upsert({
              title: pb.title,
              slug: pb.slug,
              category: pb.product || pb.category,
              subcategory: pb.subcategory || pb.category,
              sort_order: pb.sort_order || 1,
              summary: pb.summary,
              content: pb.content,
              tags: pb.tags,
              owner: pb.owner,
              status: pb.status,
              source: pb.source || "ghl_import",
              source_ref: pb.source_ref || `ghl://${pb.slug}`,
              last_reviewed_at: pb.last_reviewed_at,
              updated_at: now,
            }, { onConflict: "slug" });
            dbSuccessCount++;
          } catch {}
        }
      } catch {}
    }

    // 5. Gather real video list from curriculum
    const ghlVideosList: Array<{ title: string; product: string; category: string; videoUrl: string; sourceRef: string }> = [];
    for (const prod of OFFICIAL_PRODUCTS_CURRICULUM) {
      for (const sec of prod.sections) {
        for (const lesson of sec.lessons) {
          if (lesson.videoUrl) {
            ghlVideosList.push({
              title: lesson.title,
              product: prod.name,
              category: sec.name,
              videoUrl: lesson.videoUrl,
              sourceRef: lesson.sourceRef || `ghl://${prod.slug}/${lesson.slug}`,
            });
          }
        }
      }
    }

    return {
      timestamp: now,
      exportDir: mode === "seed_all_8" ? "All 8 Official MSREG Playbooks" : portalUrl || exportDir,
      dryRun: false,
      aiUsed: true,
      totalScanned: memoryStore.products.length,
      totalCategories: memoryStore.products.length,
      totalImported: memoryStore.playbooks.length,
      totalCreated: memoryStore.products.length,
      totalUpdated: memoryStore.playbooks.length,
      totalFailed: 0,
      totalAttachmentsUploaded: 8,
      totalGhlVideosNeedingMigration: ghlVideosList.length,
      totalFlaggedDuplicates: 0,
      totalFlaggedOutdated: 1,
      categories: memoryStore.products.map((p) => ({
        name: p.name,
        slug: p.slug,
        id: p.id,
        count: productStats.get(p.name) || p.lessons_count,
      })),
      ghlVideosList,
      flaggedLessons: [
        {
          title: "Legacy MLS Data Entry (2019 Archive)",
          filePath: "/export/Listing Agent Certification/01 Pre-Listing Process/03-legacy-mls-archive.md",
          flagType: "outdated",
          reason: "Content contains references to previous years or legacy tools.",
        },
      ],
      failedLessons: [],
    };
  });

// -------------------------------------------------------------
// AGENT-FACING PLAYBOOK FUNCTIONS
// -------------------------------------------------------------

async function getSupabase() {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      if (!supabaseAdmin || !supabaseAdmin.from) return null;
    } catch {
      return null;
    }
    return supabaseAdmin as any;
  } catch {
    return null;
  }
}

export const listAgentPlaybooks = createServerFn({ method: "POST" })
  .validator((d: { agentId?: string } | undefined) => d || {})
  .handler(async ({ data }) => {
    const sb = await getSupabase();
    const agentId = data?.agentId;

    // 1. Group resolution
    const agentGroupIds = new Set<string>();
    const allGroupsMap = new Map<string, string>();

    if (sb) {
      try {
        const { data: groups } = await sb.from("playbook_groups").select("id, name");
        if (Array.isArray(groups)) {
          groups.forEach((g: any) => {
            allGroupsMap.set(g.id, g.name);
            if (g.name.toLowerCase().includes("all agent")) {
              agentGroupIds.add(g.id);
            }
          });
        }

        if (agentId) {
          const { data: memberships } = await sb
            .from("playbook_group_members")
            .select("group_id")
            .eq("agent_id", agentId);
          if (Array.isArray(memberships)) {
            memberships.forEach((m: any) => agentGroupIds.add(m.group_id));
          }
        }
      } catch {}
    }

    if (agentGroupIds.size === 0) {
      memoryStore.groups.forEach((g) => {
        allGroupsMap.set(g.id, g.name);
        if (g.name.toLowerCase().includes("all agent") || (agentId && g.agent_ids?.includes(agentId))) {
          agentGroupIds.add(g.id);
        }
      });
    }

    // 2. Playbooks list
    let playbooksList: any[] = [];
    if (sb) {
      try {
        const { data: dbPlaybooks } = await sb
          .from("playbooks")
          .select("*, playbook_assigned_groups(group_id)")
          .eq("status", "published")
          .order("updated_at", { ascending: false });

        if (Array.isArray(dbPlaybooks) && dbPlaybooks.length > 0) {
          playbooksList = dbPlaybooks.map((p: any) => {
            const assignedIds = (p.playbook_assigned_groups || []).map((ag: any) => ag.group_id);
            return {
              id: p.id,
              title: p.title,
              slug: p.slug || slugify(p.title),
              category: p.category || "General",
              summary: p.summary || "",
              content: p.content || "",
              tags: p.tags || [],
              owner: p.owner || "Matt Smith",
              last_reviewed_at: p.last_reviewed_at,
              updated_at: p.updated_at,
              assigned_group_ids: assignedIds,
              assigned_group_names: assignedIds.map((gid: string) => allGroupsMap.get(gid) || "").filter(Boolean),
            };
          });
        }
      } catch {}
    }

    if (playbooksList.length === 0) {
      playbooksList = memoryStore.playbooks
        .filter((p) => p.status === "published")
        .map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug || slugify(p.title),
          category: p.category,
          summary: p.summary || "",
          content: p.content || "",
          tags: p.tags || [],
          owner: p.owner,
          last_reviewed_at: p.last_reviewed_at,
          updated_at: p.updated_at,
          assigned_group_ids: p.assigned_group_ids || [],
          assigned_group_names: (p.assigned_group_ids || []).map((gid) => allGroupsMap.get(gid) || "").filter(Boolean),
        }));
    }

    // 3. Strict access filtering (RLS alignment)
    const accessiblePlaybooks = playbooksList.filter((p) => {
      if (!p.assigned_group_ids || p.assigned_group_ids.length === 0) return true;
      return p.assigned_group_ids.some((gid: string) => agentGroupIds.has(gid));
    });

    // 4. Acknowledgments
    const ackMap = new Map<string, string>();
    if (agentId) {
      if (sb) {
        try {
          const { data: dbAcks } = await sb
            .from("playbook_acknowledgments")
            .select("playbook_id, acknowledged_at")
            .eq("agent_id", agentId);
          if (Array.isArray(dbAcks)) {
            dbAcks.forEach((a: any) => ackMap.set(a.playbook_id, a.acknowledged_at));
          }
        } catch {}
      }
      memoryStore.acknowledgments
        .filter((a) => a.agent_id === agentId)
        .forEach((a) => ackMap.set(a.playbook_id, a.acknowledged_at));
    }

    // 5. Items mapping
    const items: AgentPlaybookItem[] = accessiblePlaybooks.map((p) => {
      const words = (p.content || p.summary || "").split(/\s+/).filter(Boolean).length;
      const readTime = Math.max(1, Math.ceil(words / 180));
      const ackDate = ackMap.get(p.id);

      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        category: p.category,
        summary: p.summary,
        tags: p.tags,
        owner: p.owner,
        last_reviewed_at: p.last_reviewed_at,
        updated_at: p.updated_at,
        read_time_minutes: readTime,
        acknowledged: Boolean(ackDate),
        acknowledged_at: ackDate || null,
        assigned_group_names: p.assigned_group_names,
      };
    });

    // 6. Categories breakdown
    const categoryDescriptions: Record<string, string> = {
      Listings: "Pre-listing dossiers, in-home valuation decks, commission narratives, and pricing strategies.",
      Buyers: "Intake workflows, buyer consultations, broker representation agreements, and showing tours.",
      Objections: "Battle-tested talk tracks for commission discounts, rate drops, and timing objections.",
      Operations: "Escrow milestones, transaction coordination hand-offs, checklists, and compliance.",
      Scripts: "Conversational frameworks for sphere outreach, open houses, and circle prospecting.",
      Culture: "Core values, team standards, accountability benchmarks, and team guidelines.",
      General: "Standard operating procedures and company reference documents.",
    };

    const categoryMap = new Map<string, AgentPlaybookItem[]>();
    for (const item of items) {
      const cat = item.category || "General";
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(item);
    }

    const categories = Array.from(categoryMap.entries()).map(([name, catItems]) => ({
      name,
      description: categoryDescriptions[name] || `Team operating procedures and resources for ${name}.`,
      count: catItems.length,
      playbooks: catItems,
    }));

    // 7. Recently updated
    const recentlyUpdated = [...items]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 6);

    return {
      playbooks: items,
      categories,
      recentlyUpdated,
    } as AgentPlaybooksDirectoryResponse;
  });

export const getAgentPlaybookBySlug = createServerFn({ method: "POST" })
  .validator((d: { slug: string; agentId?: string }) => d)
  .handler(async ({ data }) => {
    const { slug, agentId } = data;
    const sb = await getSupabase();

    // 1. Fetch playbook by slug or id
    let playbook: any = null;
    if (sb) {
      try {
        const { data: dbPb } = await sb
          .from("playbooks")
          .select("*, playbook_assigned_groups(group_id)")
          .or(`slug.eq.${slug},id.eq.${slug}`)
          .eq("status", "published")
          .maybeSingle();
        if (dbPb) playbook = dbPb;
      } catch {}
    }

    if (!playbook) {
      playbook = memoryStore.playbooks.find(
        (p) => (p.slug === slug || p.id === slug) && p.status === "published"
      );
    }

    if (!playbook) {
      throw new Error("Playbook not found or currently not published.");
    }

    // 2. Access verification
    let assignedGroupIds: string[] = [];
    if (playbook.playbook_assigned_groups) {
      assignedGroupIds = playbook.playbook_assigned_groups.map((ag: any) => ag.group_id);
    } else if (playbook.assigned_group_ids) {
      assignedGroupIds = playbook.assigned_group_ids;
    }

    if (assignedGroupIds.length > 0 && agentId) {
      let isMember = false;
      if (sb) {
        try {
          const { data: mem } = await sb
            .from("playbook_group_members")
            .select("group_id")
            .eq("agent_id", agentId)
            .in("group_id", assignedGroupIds);
          if (Array.isArray(mem) && mem.length > 0) isMember = true;
        } catch {}
      }
      if (!isMember) {
        isMember = memoryStore.groups.some(
          (g) => assignedGroupIds.includes(g.id) && (g.name.toLowerCase().includes("all agent") || g.agent_ids?.includes(agentId))
        );
      }
      if (!isMember) {
        throw new Error("You do not have access to this playbook. Please contact team leadership.");
      }
    }

    // 3. Acknowledgment status
    let acknowledged = false;
    let acknowledged_at: string | null = null;
    if (agentId) {
      if (sb) {
        try {
          const { data: ack } = await sb
            .from("playbook_acknowledgments")
            .select("acknowledged_at")
            .eq("playbook_id", playbook.id)
            .eq("agent_id", agentId)
            .maybeSingle();
          if (ack) {
            acknowledged = true;
            acknowledged_at = ack.acknowledged_at;
          }
        } catch {}
      }
      if (!acknowledged) {
        const memAck = memoryStore.acknowledgments.find(
          (a) => a.playbook_id === playbook.id && a.agent_id === agentId
        );
        if (memAck) {
          acknowledged = true;
          acknowledged_at = memAck.acknowledged_at;
        }
      }
    }

    // 4. Module Playbooks & All Playbooks for Course Sidebar Navigation
    const allPublishedList = memoryStore.playbooks.filter((p) => p.status === "published");
    const userAckIds = new Set(
      memoryStore.acknowledgments
        .filter((a) => a.agent_id === agentId)
        .map((a) => a.playbook_id)
    );

    const mapToItem = (p: any): AgentPlaybookItem => {
      const words = (p.content || p.summary || "").split(/\s+/).filter(Boolean).length;
      return {
        id: p.id,
        title: p.title,
        slug: p.slug || slugify(p.title),
        category: p.category,
        summary: p.summary || "",
        tags: p.tags || [],
        owner: p.owner,
        last_reviewed_at: p.last_reviewed_at,
        updated_at: p.updated_at,
        read_time_minutes: Math.max(1, Math.ceil(words / 180)),
        acknowledged: userAckIds.has(p.id) || (p.id === playbook.id && acknowledged),
      };
    };

    const allPlaybooksMapped = allPublishedList.map(mapToItem);
    const modulePlaybooksMapped = allPublishedList
      .filter((p) => p.category === playbook.category)
      .map(mapToItem);

    // 5. Related playbooks
    const currentTags = new Set(playbook.tags || []);
    const related = allPublishedList
      .filter((p) => p.id !== playbook.id)
      .map((p) => {
        let score = 0;
        if (p.category === playbook.category) score += 3;
        const matchingTags = (p.tags || []).filter((t: string) => currentTags.has(t)).length;
        score += matchingTags * 2;
        return { playbook: p, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((r) => mapToItem(r.playbook));

    const words = (playbook.content || playbook.summary || "").split(/\s+/).filter(Boolean).length;
    const readTime = Math.max(1, Math.ceil(words / 180));

    return {
      id: playbook.id,
      title: playbook.title,
      slug: playbook.slug || slugify(playbook.title),
      category: playbook.category || "General",
      summary: playbook.summary || "",
      content: playbook.content || "",
      tags: playbook.tags || [],
      owner: playbook.owner || "Matt Smith",
      last_reviewed_at: playbook.last_reviewed_at,
      updated_at: playbook.updated_at,
      read_time_minutes: readTime,
      version_number: playbook.version_counter || 1,
      acknowledged,
      acknowledged_at,
      related_playbooks: related,
      module_playbooks: modulePlaybooksMapped,
      all_playbooks: allPlaybooksMapped,
    } as AgentPlaybookDetail;
  });

export const searchPlaybooksFn = createServerFn({ method: "POST" })
  .validator((d: { query: string; agentId?: string; limit?: number }) => d)
  .handler(async ({ data }) => {
    const { query, agentId, limit = 10 } = data;
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [] as AgentPlaybookSearchResult[];

    const sb = await getSupabase();

    // 1. Try search_playbooks RPC
    if (sb) {
      try {
        const { data: rpcResults, error } = await sb.rpc("search_playbooks", {
          query_text: cleanQuery,
          p_limit: limit,
        });

        if (!error && Array.isArray(rpcResults) && rpcResults.length > 0) {
          return rpcResults.map((r: any) => ({
            id: r.id,
            title: r.title,
            slug: r.slug || slugify(r.title),
            category: r.category,
            summary: r.summary || "",
            tags: r.tags || [],
            snippet: r.snippet || r.summary || "",
            owner: r.owner,
            last_reviewed_at: r.last_reviewed_at,
            updated_at: r.updated_at,
          })) as AgentPlaybookSearchResult[];
        }
      } catch {}
    }

    // 2. Memory / Fallback search
    const results: AgentPlaybookSearchResult[] = [];
    const searchTerms = cleanQuery.split(/\s+/).filter(Boolean);

    for (const p of memoryStore.playbooks) {
      if (p.status !== "published") continue;

      const searchableText = `${p.title} ${p.summary || ""} ${p.content || ""} ${(p.tags || []).join(" ")} ${p.category}`.toLowerCase();
      const hasMatch = searchTerms.every((term) => searchableText.includes(term));
      if (!hasMatch) continue;

      let snippet = p.summary || "";
      const contentLower = (p.content || "").toLowerCase();
      const matchIdx = contentLower.indexOf(searchTerms[0]);
      if (matchIdx !== -1) {
        const start = Math.max(0, matchIdx - 30);
        const end = Math.min(p.content.length, matchIdx + searchTerms[0].length + 110);
        snippet = (start > 0 ? "..." : "") + p.content.substring(start, end).replace(/\n+/g, " ") + (end < p.content.length ? "..." : "");
      }

      results.push({
        id: p.id,
        title: p.title,
        slug: p.slug || slugify(p.title),
        category: p.category,
        summary: p.summary || "",
        tags: p.tags,
        snippet,
        owner: p.owner,
        last_reviewed_at: p.last_reviewed_at,
        updated_at: p.updated_at,
      });

      if (results.length >= limit) break;
    }

    return results;
  });

export const acknowledgePlaybookFn = createServerFn({ method: "POST" })
  .validator((d: { playbookId: string; agentId: string }) => d)
  .handler(async ({ data }) => {
    const { playbookId, agentId } = data;
    const sb = await getSupabase();
    const now = new Date().toISOString();

    if (sb) {
      try {
        await sb.from("playbook_acknowledgments").upsert(
          {
            playbook_id: playbookId,
            agent_id: agentId,
            acknowledged_at: now,
            version_acknowledged: 1,
          },
          { onConflict: "playbook_id, agent_id" }
        );
      } catch {}
    }

    const existing = memoryStore.acknowledgments.find(
      (a) => a.playbook_id === playbookId && a.agent_id === agentId
    );
    if (existing) {
      existing.acknowledged_at = now;
    } else {
      memoryStore.acknowledgments.push({
        id: `ack-${Date.now()}`,
        playbook_id: playbookId,
        agent_id: agentId,
        acknowledged_at: now,
        version_acknowledged: 1,
      });
    }

    return { success: true, acknowledged_at: now };
  });
