export const INTAKE_TEMPLATE_IDS = ["new_build", "remodel", "retroactive", "addition"] as const;
export type IntakeTemplateId = (typeof INTAKE_TEMPLATE_IDS)[number];

export type IntakeTemplate = {
  id: IntakeTemplateId;
  label: string;
  subjectOptions: string[];
  body: string;
};

export type IntakeFillVars = {
  customerFirstName: string;
  customerName: string;
  projectAddress: string;
  salesRepName: string;
  phone: string;
  email: string;
};

export const INTAKE_TEMPLATES: Record<IntakeTemplateId, IntakeTemplate> = {
  new_build: {
    id: "new_build",
    label: "New Build",
    subjectOptions: [
      "Next steps for your new build drawings — [Project Address]",
      "Info we need to start your new construction plans — [Customer Name]",
    ],
    body: `Hi [Customer First Name],

Thank you for choosing Apex Drafting for your new build. We’re excited to get your drawings started.

To keep your project on schedule, we need a few items and answers before our drafting team begins modeling. Please reply with the information below (photos and files can be attached).

━━━━━━━━━━━━━━━━━━━━
1) Project & contact confirmation
━━━━━━━━━━━━━━━━━━━━
• Project address / parcel (confirm exact spelling / APN if known):
• Preferred phone & email for questions:
• Best times to reach you:
• Who else should be copied (builder, designer, engineer, etc.)?

━━━━━━━━━━━━━━━━━━━━
2) What we’re drawing (scope)
━━━━━━━━━━━━━━━━━━━━
• Building type (single-family, ADU, commercial, accessory structure, etc.):
• Number of stories / levels:
• Approximate conditioned sq ft (or overall footprint if known):
• Program: bedrooms, baths, garage, porch, shop, etc.:
• Plans for permit, construction, or both?
• Target city / county for the permit:
• Any known HOA design review requirements?

━━━━━━━━━━━━━━━━━━━━
3) Site & survey (critical for new builds)
━━━━━━━━━━━━━━━━━━━━
Please send whatever you have:
• Survey / site plan / plot plan (preferred)
• Topo if available
• Known setbacks, easements, building envelope
• Septic / well / utility locations or constraints
• Slope, drainage, or flood-zone notes
• Driveway / access preferences
• Placement preference on the lot (attach a sketch if helpful)

━━━━━━━━━━━━━━━━━━━━
4) Design intent & references
━━━━━━━━━━━━━━━━━━━━
• Sketches, floor-plan concepts, or builder markups (attach):
• Inspiration images / links:
• Preferred exterior style and materials:
• Roof type / pitch preferences if known:
• Window / door selections if already chosen:
• Ceiling height goals:
• Structural engineer already involved? Name / contact if yes:
• Anything the city or HOA has already required in writing?

━━━━━━━━━━━━━━━━━━━━
5) Timeline & access
━━━━━━━━━━━━━━━━━━━━
• Ideal date for initial concept drawings:
• Hard deadline (permit appointment, builder start, etc.) if any:
• Site visit needed, or do you have accurate survey/dimensions already?
• Gate codes / access notes if we need to visit:

━━━━━━━━━━━━━━━━━━━━
How to send files
━━━━━━━━━━━━━━━━━━━━
Reply with attachments or a link (Google Drive, Dropbox, etc.). PDFs and clear photos/sketches work best. Include the project address in file names if you can.

Once we have this package, we’ll confirm your IC (initial concept) due date and our drafter will begin. If anything doesn’t apply, note “N/A.”

Thanks again — we’re looking forward to working with you.

Best regards,
[Sales Rep Name]
Apex Drafting
[Phone]
[Email]`,
  },
  remodel: {
    id: "remodel",
    label: "Remodel",
    subjectOptions: [
      "Next steps for your remodel drawings — [Project Address]",
      "Info we need to start your remodel plans — [Customer Name]",
    ],
    body: `Hi [Customer First Name],

Thank you for choosing Apex Drafting for your remodel. We’re excited to get your drawings started.

To keep your project on schedule and avoid rework, we need a few items and answers before our drafting team begins. Please reply with the information below (photos and files can be attached).

━━━━━━━━━━━━━━━━━━━━
1) Project & contact confirmation
━━━━━━━━━━━━━━━━━━━━
• Project address (confirm exact spelling / unit #):
• Preferred phone & email for questions:
• Best times to reach you:
• Who else should be copied (builder, designer, etc.)?

━━━━━━━━━━━━━━━━━━━━
2) What we’re remodeling (scope)
━━━━━━━━━━━━━━━━━━━━
• Areas included (kitchen, baths, whole-house, garage conversion, etc.):
• What stays vs what changes (walls, openings, structure, finishes):
• Are we moving or removing any load-bearing walls? (if known)
• Adding square footage, or remodel within existing footprint only?
• Plans for permit, construction, or both?
• Target city / county for the permit:

━━━━━━━━━━━━━━━━━━━━
3) Existing conditions (critical)
━━━━━━━━━━━━━━━━━━━━
Please send whatever you have:
• Existing floor plans (PDF, CAD, or clear photos of paper plans)
• Photos of every affected room + overall exterior elevations
• Photos of areas where walls/openings will change
• Foundation type if known (slab, crawlspace, basement)
• Ceiling heights if known
• Prior permits, as-builts, or earlier remodel drawings

If you don’t have plans: a simple sketch with rough dimensions plus clear photos still helps a lot. Tell us if a field measure is needed.

━━━━━━━━━━━━━━━━━━━━
4) Design intent & preferences
━━━━━━━━━━━━━━━━━━━━
• Sketches, markups, or inspiration links:
• Desired layout outcome in plain language:
• Window / door changes (sizes or products if selected):
• Finish preferences that affect drawings (if any):
• Structural engineer already involved? Name / contact if yes:
• Anything the city or HOA has already required?

━━━━━━━━━━━━━━━━━━━━
5) Timeline & access
━━━━━━━━━━━━━━━━━━━━
• Ideal date for initial concept drawings:
• Hard deadline if any:
• Can we schedule a site measure if needed? Best days/times:
• Gate codes / access / pet notes:

━━━━━━━━━━━━━━━━━━━━
How to send files
━━━━━━━━━━━━━━━━━━━━
Reply with attachments or a link. PDFs and clear photos work best. Include the project address in file names if you can.

Once we have this package, we’ll confirm your IC due date and our drafter will begin. If something doesn’t apply, note “N/A.”

Thanks again — we’re looking forward to working with you.

Best regards,
[Sales Rep Name]
Apex Drafting
[Phone]
[Email]`,
  },
  retroactive: {
    id: "retroactive",
    label: "Retroactive",
    subjectOptions: [
      "Next steps for your retroactive / as-built drawings — [Project Address]",
      "Info we need to document your existing structure — [Customer Name]",
    ],
    body: `Hi [Customer First Name],

Thank you for choosing Apex Drafting for your retroactive / as-built drawings. We’re excited to help get your existing work documented correctly.

For these projects, accuracy of what is already built is everything. Please reply with the information below so we can start cleanly (photos and files can be attached).

━━━━━━━━━━━━━━━━━━━━
1) Project & contact confirmation
━━━━━━━━━━━━━━━━━━━━
• Project address (confirm exact spelling / unit #):
• Preferred phone & email for questions:
• Best times to reach you:
• Who else should be copied (contractor, designer, etc.)?
• Who will meet us on site if a measure is needed?

━━━━━━━━━━━━━━━━━━━━
2) What needs to be documented (scope)
━━━━━━━━━━━━━━━━━━━━
• What was built or changed (addition, ADU, garage conversion, interior remodel, etc.):
• Roughly when was it built / completed (if known)?
• Is the work fully complete, partially complete, or in progress?
• Number of buildings / structures to document:
• Stories / levels involved:
• Approximate size if known:
• Purpose of the drawings (city legalization, permit, records, sale, other):
• Target city / county:
• Any open code enforcement / stop-work / notice letters? (Please attach)

━━━━━━━━━━━━━━━━━━━━
3) Existing evidence (please send everything you have)
━━━━━━━━━━━━━━━━━━━━
• Any original or prior plans
• Photos of all exterior sides
• Photos of interiors for spaces in scope
• Photos of foundations, roof edges, and attachments to other structures
• Surveys, plot plans, or prior permits
• Engineer letters or inspection reports if any

If you have no plans, that is common for retroactive work — clear photos + site access for measuring are usually enough to begin.

━━━━━━━━━━━━━━━━━━━━
4) Site access & measure
━━━━━━━━━━━━━━━━━━━━
• Confirm we can measure on site (date windows that work):
• Gate codes / lockbox / parking / pet notes:
• Any areas that are unsafe or inaccessible?
• Tenant / occupant notice needed?

━━━━━━━━━━━━━━━━━━━━
5) Known conditions & constraints
━━━━━━━━━━━━━━━━━━━━
• Foundation type if known:
• Utilities / septic / easement issues we should know:
• Neighbor / property-line concerns:
• Anything the city has already asked you to show on the drawings?

━━━━━━━━━━━━━━━━━━━━
How to send files
━━━━━━━━━━━━━━━━━━━━
Reply with attachments or a link. PDFs, notices, and clear photos work best. Include the project address in file names if you can.

Once we have access and this package, we’ll confirm your IC due date and schedule measure if needed. If something doesn’t apply, note “N/A.”

Thanks again — we’re looking forward to working with you.

Best regards,
[Sales Rep Name]
Apex Drafting
[Phone]
[Email]`,
  },
  addition: {
    id: "addition",
    label: "Addition",
    subjectOptions: [
      "Next steps for your addition drawings — [Project Address]",
      "Info we need to start your addition plans — [Customer Name]",
    ],
    body: `Hi [Customer First Name],

Thank you for choosing Apex Drafting for your addition. We’re excited to get your drawings started.

To keep your project on schedule and avoid rework, we need a few items and answers before our drafting team begins modeling. Please reply to this email with the information below (photos and files can be attached).

━━━━━━━━━━━━━━━━━━━━
1) Project & contact confirmation
━━━━━━━━━━━━━━━━━━━━
• Project address (confirm exact spelling / unit #):
• Preferred phone & email for questions:
• Best times to reach you:
• Who else should be copied on updates (builder, designer, etc.)?

━━━━━━━━━━━━━━━━━━━━
2) What we’re drawing (scope)
━━━━━━━━━━━━━━━━━━━━
• Brief description of the addition (e.g. bedroom/bath, ADU-style, kitchen expand, porch enclosure):
• Number of stories / levels in the addition:
• Approximate size (sq ft or overall dimensions if known):
• Is this attached to the existing house, or detached?
• Will the addition share a roof with the existing structure, or have a separate roof?
• Any rooms / spaces that must be included or excluded?
• Are we preparing plans for permit, construction, or both?
• Target jurisdiction / city or county for the permit:

━━━━━━━━━━━━━━━━━━━━
3) Existing structure (critical for additions)
━━━━━━━━━━━━━━━━━━━━
Please send whatever you have of the following:
• Existing floor plans (PDF, CAD, or clear photos of paper plans)
• Existing elevation drawings or exterior photos of every side of the house
• Foundation type if known (slab, crawlspace, basement)
• Roof type / pitch if known
• Wall construction if known (e.g. 2x4 / 2x6, stucco, siding)
• Any prior permits, surveys, or as-built drawings

If you don’t have plans: clear, well-lit photos of the attachment wall(s), overall exteriors, and the area where the addition will sit are still very helpful.

━━━━━━━━━━━━━━━━━━━━
4) Site & survey
━━━━━━━━━━━━━━━━━━━━
• Do you have a survey / site plan / plot plan? (Please attach)
• Known setbacks or easements we must respect?
• Septic, well, or utility constraints we should know about?
• Slope or drainage concerns at the addition location?

━━━━━━━━━━━━━━━━━━━━
5) Design intent & preferences
━━━━━━━━━━━━━━━━━━━━
• Sketches, Pinterest/inspiration, or builder markups (attach or link):
• Preferred exterior finishes to match existing? (siding, roofing, windows)
• Window / door preferences or sizes if already selected:
• Ceiling height goals (match existing / taller / other):
• Any structural engineer already involved? Name / contact if yes:
• Anything the city or HOA has already told you is required?

━━━━━━━━━━━━━━━━━━━━
6) Timeline & access
━━━━━━━━━━━━━━━━━━━━
• Ideal date you’d like initial concept drawings for review:
• Hard deadline (permit appointment, builder start, etc.) if any:
• Is a site visit / field measure needed, or do you already have accurate dimensions?
• Gate codes / access notes if we need to measure:

━━━━━━━━━━━━━━━━━━━━
How to send files
━━━━━━━━━━━━━━━━━━━━
Reply to this email with attachments, or share a link (Google Drive, Dropbox, etc.). PDFs and clear photos work best. Please include the project address in the file names if you can.

Once we have this package, we’ll confirm your IC (initial concept) due date and our drafter will begin. If anything above doesn’t apply, just note “N/A.”

Thanks again — we’re looking forward to working with you.

Best regards,
[Sales Rep Name]
Apex Drafting
[Phone]
[Email]`,
  },
};

export function isIntakeTemplateId(value: unknown): value is IntakeTemplateId {
  return typeof value === "string" && (INTAKE_TEMPLATE_IDS as readonly string[]).includes(value);
}

export function customerFirstName(customerName: string): string {
  return customerName.trim().split(/\s+/)[0] || customerName;
}

export function composeProjectAddress(lead: {
  fullAddress?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string {
  if (lead.fullAddress?.trim()) return lead.fullAddress.trim();
  const cityState = [lead.city, lead.state]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  return [lead.addressLine1, cityState, lead.zip]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

export function fillPlaceholders(text: string, vars: IntakeFillVars): string {
  return text
    .replaceAll("[Customer First Name]", vars.customerFirstName)
    .replaceAll("[Customer Name]", vars.customerName)
    .replaceAll("[Project Address]", vars.projectAddress)
    .replaceAll("[Sales Rep Name]", vars.salesRepName)
    .replaceAll("[Phone]", vars.phone)
    .replaceAll("[Email]", vars.email);
}

export function fillIntakeMessage(template: IntakeTemplate, vars: IntakeFillVars): { subject: string; body: string } {
  const subjectSource = template.subjectOptions[0] ?? "";
  return {
    subject: fillPlaceholders(subjectSource, vars),
    body: fillPlaceholders(template.body, vars),
  };
}

export function intakeVarsForLead(
  lead: {
    customerName: string;
    fullAddress?: string | null;
    addressLine1?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  },
  mailbox: { displayName: string; phone: string; from: string }
): IntakeFillVars {
  return {
    customerFirstName: customerFirstName(lead.customerName),
    customerName: lead.customerName,
    projectAddress: composeProjectAddress(lead),
    salesRepName: mailbox.displayName,
    phone: mailbox.phone,
    email: mailbox.from,
  };
}
