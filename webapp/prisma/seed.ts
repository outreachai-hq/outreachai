import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // ── Demo user ──────────────────────────────────────────────────────────────
  const password = await bcrypt.hash('password123', 12)
  const user = await prisma.user.upsert({
    where: { email: 'akhilesh@demo.com' },
    update: {},
    create: {
      id: 'user_demo',
      email: 'akhilesh@demo.com',
      password,
      name: 'Akhilesh Chauhan',
      plan: 'pro',
    },
  })
  console.log(`User: ${user.email}`)

  // ── LinkedIn Account ───────────────────────────────────────────────────────
  await prisma.linkedInAccount.upsert({
    where: { id: 'linkedin_demo' },
    update: {},
    create: {
      id: 'linkedin_demo',
      userId: user.id,
      name: 'Akhilesh Chauhan',
      email: 'akhilesh@demo.com',
      avatarColor: '#ef4444',
      isDefault: true,
    },
  })
  console.log('LinkedIn account: Akhilesh Chauhan')

  // ── Templates ──────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.template.upsert({
      where: { id: 'tmpl_1' },
      update: {},
      create: {
        id: 'tmpl_1',
        userId: user.id,
        name: 'Initial Outreach',
        message: `Hi {{firstName}},\n\nI've been following {{company}}'s growth and genuinely impressed by what your team has built.\n\nI'm working on OutreachAI — it helps sales teams like yours personalize and automate LinkedIn outreach at scale, so reps spend less time prospecting and more time closing.\n\nWould love to connect and share what we're seeing work in your space.\n\nAkhilesh`,
      },
    }),
    prisma.template.upsert({
      where: { id: 'tmpl_2' },
      update: {},
      create: {
        id: 'tmpl_2',
        userId: user.id,
        name: 'Follow-up #1 (Day 3)',
        message: `Hi {{firstName}},\n\nFollowing up on my earlier message — I know inboxes get busy.\n\nIf a 15-min call this week works, I'd love to share what I'm building and hear your thoughts.\n\nAkhilesh`,
      },
    }),
    prisma.template.upsert({
      where: { id: 'tmpl_3' },
      update: {},
      create: {
        id: 'tmpl_3',
        userId: user.id,
        name: 'Follow-up #2 (Day 7)',
        message: `Hey {{firstName}},\n\nLast follow-up, I promise! I genuinely think what you're doing at {{company}} aligns with what I'm working on.\n\nHappy to share more if you're even slightly curious.\n\nAkhilesh`,
      },
    }),
    prisma.template.upsert({
      where: { id: 'tmpl_4' },
      update: {},
      create: {
        id: 'tmpl_4',
        userId: user.id,
        name: 'Connection Request Note',
        message: `Hi {{firstName}}, I'm Akhilesh — working on AI-powered outreach tools for growth teams. Would love to connect and exchange ideas.`,
      },
    }),
  ])
  console.log('Templates: 4')

  // ─────────────────────────────────────────────────────────────────────────
  // CAMPAIGN 1: LinkedIn SaaS Outreach - Q1 (active)
  // ─────────────────────────────────────────────────────────────────────────

  const seq1Steps = [
    { type: 'visit_profile',         waitDays: 0,  name: 'Visit profile',          message: '' },
    { type: 'connection_request',    waitDays: 1,  name: 'Invitation',             message: 'Hi {{firstName}}, I work on AI-powered outreach tools for sales teams. Would love to connect!' },
    { type: 'wait_until_accepted',   waitDays: 0,  name: 'Wait until accepted',    message: '' },
    { type: 'chat_message',          waitDays: 2,  name: 'Chat message',           message: `Hi {{firstName}},\n\nThanks for connecting! I noticed you're at {{company}} — we help sales teams like yours cut prospecting time by 60% using AI.\n\nWould a quick 15-min call make sense this week?\n\nAkhilesh` },
    { type: 'chat_message',          waitDays: 7,  name: 'Chat message',           message: `Hey {{firstName}},\n\nJust circling back. If timing isn't right, totally understand — happy to reconnect when it makes more sense.\n\nAkhilesh` },
    { type: 'chat_message',          waitDays: 30, name: 'Chat message',           message: `Hi {{firstName}},\n\nOne last note — we just launched AI personalization for LinkedIn outreach. Thought it might be relevant given your role at {{company}}.\n\nLet me know if you'd ever like to see it in action.\n\nAkhilesh` },
  ]

  const seq1 = await prisma.sequence.upsert({
    where: { id: 'seq_campaign1' },
    update: { steps: seq1Steps },
    create: {
      id: 'seq_campaign1',
      userId: user.id,
      name: 'LinkedIn SaaS Outreach - Q1 Sequence',
      steps: seq1Steps,
      active: true,
    },
  })

  const ll1 = await prisma.leadList.upsert({
    where: { id: 'll_campaign1' },
    update: {},
    create: {
      id: 'll_campaign1',
      userId: user.id,
      name: 'LinkedIn SaaS Outreach - Q1 Leads',
    },
  })

  const camp1 = await prisma.campaign.upsert({
    where: { id: 'camp_1' },
    update: { status: 'active', launchedAt: new Date('2026-01-15') },
    create: {
      id: 'camp_1',
      userId: user.id,
      name: 'LinkedIn SaaS Outreach - Q1',
      sequenceId: seq1.id,
      leadListId: ll1.id,
      status: 'active',
      launchedAt: new Date('2026-01-15'),
    },
  })

  // AI-generated personalized openers for demo
  const AI_OPENERS: Record<string, string> = {
    lead_aakash:    "Your work scaling VKL Spices' sales team from the ground up is exactly the kind of growth story I've been researching.",
    lead_rahul:     "PhonePe's 500M+ user growth under your leadership is remarkable — curious how your team handles outbound at that scale.",
    lead_priya:     "The way Cleartrip rebuilt its product post-acquisition is a masterclass in product-led recovery — would love to learn from your approach.",
    lead_anjali:    "Zepto's 10-minute delivery promise requires insane operational coordination — I imagine prospecting for growth partners takes real precision too.",
    lead_arjun:     "CRED's engineering culture under your team has been one of the most talked-about in India's fintech space.",
    lead_vikram:    "Razorpay's payment infrastructure now powers 8M+ businesses — the scale of what your engineering team built is genuinely impressive.",
    lead_neha:      "Meesho's social commerce model is reshaping how Tier-2 India shops — your growth work sits at a really interesting intersection.",
    lead_rohan:     "Swiggy's product evolution from delivery to Instamart to Dining shows a team that's always three moves ahead.",
    lead_kavya:     "Ola's expansion into EV and international markets while running core ops is a logistical challenge most companies wouldn't attempt.",
    lead_siddharth: "Freshworks' self-serve PLG motion in a crowded SaaS market is something not enough people talk about — your sales approach must be unique.",
    lead_manish:    "Paytm's pivot from payments to financial services is one of India's most complex product transformations.",
    lead_deepika:   "Nykaa's beauty + fashion + wellness convergence under your marketing is redefining what a D2C brand can be.",
    lead_kunal:     "Dream11's user acquisition playbook during IPL is legendary — the way you've built a sports-first community is unmatched.",
    lead_ankit:     "Zomato's hyperpure B2B pivot shows a product team willing to go deep into supply chain — curious about the outreach strategy there.",
    lead_shreya:    "BYJU'S content approach under your leadership set the bar for what EdTech learning could look like in India.",
    lead_varun:     "MoEngage's customer engagement platform is one I keep recommending — the way you've positioned against incumbents is smart.",
    lead_pooja:     "CleverTap's developer-first approach to mobile marketing is rare in the enterprise space — your sales motion must be quite technical.",
    lead_amit:      "LeadSquared has quietly become the CRM of choice for Indian enterprises — building that in a market dominated by Salesforce is no small feat.",
    lead_ritu:      "Chargebee's expansion from SaaS billing to revenue management is a product story I reference often.",
    lead_sameer:    "BrowserStack's developer adoption without a traditional sales motion is the kind of PLG case study every SaaS founder should study.",
  }

  const saasLeads = [
    { id: 'lead_aakash',    firstName: 'Aakash',    lastName: 'Kulshreshtha', email: 'aakash.k@vklspices.example.com',      company: 'VKL Spices',     headline: 'VP Sales',              linkedinUrl: 'https://linkedin.com/in/aakash-kulshreshtha', status: 'in_progress' as const },
    { id: 'lead_rahul',     firstName: 'Rahul',     lastName: 'Mehta',         email: 'rahul.m@phonepe.example.com',          company: 'PhonePe',         headline: 'Head of Growth',        linkedinUrl: 'https://linkedin.com/in/rahul-mehta',          status: 'replied' as const },
    { id: 'lead_priya',     firstName: 'Priya',     lastName: 'Sharma',        email: 'priya.s@cleartrip.example.com',        company: 'Cleartrip',       headline: 'Product Manager',       linkedinUrl: 'https://linkedin.com/in/priya-sharma',         status: 'in_progress' as const },
    { id: 'lead_anjali',    firstName: 'Anjali',    lastName: 'Verma',         email: 'anjali.v@zepto.example.com',           company: 'Zepto',           headline: 'Marketing Lead',        linkedinUrl: 'https://linkedin.com/in/anjali-verma',         status: 'pending' as const },
    { id: 'lead_arjun',     firstName: 'Arjun',     lastName: 'Nair',          email: 'arjun.n@cred.example.com',            company: 'CRED',            headline: 'Senior Engineer',       linkedinUrl: 'https://linkedin.com/in/arjun-nair',           status: 'replied' as const },
    { id: 'lead_vikram',    firstName: 'Vikram',    lastName: 'Singh',         email: 'vikram.s@razorpay.example.com',        company: 'Razorpay',        headline: 'VP Engineering',        linkedinUrl: 'https://linkedin.com/in/vikram-singh',         status: 'in_progress' as const },
    { id: 'lead_neha',      firstName: 'Neha',      lastName: 'Gupta',         email: 'neha.g@meesho.example.com',            company: 'Meesho',          headline: 'Growth Manager',        linkedinUrl: 'https://linkedin.com/in/neha-gupta',           status: 'in_progress' as const },
    { id: 'lead_rohan',     firstName: 'Rohan',     lastName: 'Joshi',         email: 'rohan.j@swiggy.example.com',           company: 'Swiggy',          headline: 'Product Lead',          linkedinUrl: 'https://linkedin.com/in/rohan-joshi',          status: 'pending' as const },
    { id: 'lead_kavya',     firstName: 'Kavya',     lastName: 'Reddy',         email: 'kavya.r@ola.example.com',              company: 'Ola',             headline: 'Head of Operations',   linkedinUrl: 'https://linkedin.com/in/kavya-reddy',          status: 'in_progress' as const },
    { id: 'lead_siddharth', firstName: 'Siddharth', lastName: 'Bose',          email: 'siddharth.b@freshworks.example.com',   company: 'Freshworks',      headline: 'Sales Director',        linkedinUrl: 'https://linkedin.com/in/siddharth-bose',       status: 'replied' as const },
    { id: 'lead_manish',    firstName: 'Manish',    lastName: 'Kumar',         email: 'manish.k@paytm.example.com',           company: 'Paytm',           headline: 'CTO',                   linkedinUrl: 'https://linkedin.com/in/manish-kumar',         status: 'in_progress' as const },
    { id: 'lead_deepika',   firstName: 'Deepika',   lastName: 'Agarwal',       email: 'deepika.a@nykaa.example.com',          company: 'Nykaa',           headline: 'CMO',                   linkedinUrl: 'https://linkedin.com/in/deepika-agarwal',      status: 'replied' as const },
    { id: 'lead_kunal',     firstName: 'Kunal',     lastName: 'Shah',          email: 'kunal.s@dream11.example.com',          company: 'Dream11',         headline: 'Founder',               linkedinUrl: 'https://linkedin.com/in/kunal-shah',           status: 'pending' as const },
    { id: 'lead_ankit',     firstName: 'Ankit',     lastName: 'Agarwal',       email: 'ankit.a@zomato.example.com',           company: 'Zomato',          headline: 'VP Product',            linkedinUrl: 'https://linkedin.com/in/ankit-agarwal',        status: 'in_progress' as const },
    { id: 'lead_shreya',    firstName: 'Shreya',    lastName: 'Iyer',          email: 'shreya.i@byju.example.com',            company: "BYJU'S",          headline: 'Head of Content',       linkedinUrl: 'https://linkedin.com/in/shreya-iyer',          status: 'in_progress' as const },
    { id: 'lead_varun',     firstName: 'Varun',     lastName: 'Malhotra',      email: 'varun.m@moengage.example.com',         company: 'MoEngage',        headline: 'Sales Lead',            linkedinUrl: 'https://linkedin.com/in/varun-malhotra',       status: 'pending' as const },
    { id: 'lead_pooja',     firstName: 'Pooja',     lastName: 'Bansal',        email: 'pooja.b@clevertap.example.com',        company: 'CleverTap',       headline: 'Account Executive',     linkedinUrl: 'https://linkedin.com/in/pooja-bansal',         status: 'in_progress' as const },
    { id: 'lead_amit',      firstName: 'Amit',      lastName: 'Sharma',        email: 'amit.s@leadsquared.example.com',       company: 'LeadSquared',     headline: 'CEO',                   linkedinUrl: 'https://linkedin.com/in/amit-sharma',          status: 'pending' as const },
    { id: 'lead_ritu',      firstName: 'Ritu',      lastName: 'Nair',          email: 'ritu.n@chargebee.example.com',         company: 'Chargebee',       headline: 'Customer Success',      linkedinUrl: 'https://linkedin.com/in/ritu-nair',            status: 'in_progress' as const },
    { id: 'lead_sameer',    firstName: 'Sameer',    lastName: 'Gupta',         email: 'sameer.g@browserstack.example.com',    company: 'BrowserStack',    headline: 'VP Sales',              linkedinUrl: 'https://linkedin.com/in/sameer-gupta',         status: 'in_progress' as const },
  ]

  for (const l of saasLeads) {
    await prisma.lead.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id,
        leadListId: ll1.id,
        firstName: l.firstName,
        lastName: l.lastName,
        email: l.email,
        company: l.company,
        headline: l.headline,
        linkedinUrl: l.linkedinUrl,
        status: l.status,
        aiOpener: AI_OPENERS[l.id] ?? `Noticed ${l.firstName}'s work at ${l.company} — impressive growth trajectory in the ${l.headline?.toLowerCase() ?? 'space'}.`,
      },
    })
    // CampaignLead for launched campaign
    const clStatus = l.status === 'pending' ? 'pending' : l.status === 'replied' ? 'replied' : 'in_progress'
    await prisma.campaignLead.upsert({
      where: { campaignId_leadId: { campaignId: camp1.id, leadId: l.id } },
      update: {},
      create: {
        campaignId: camp1.id,
        leadId: l.id,
        currentStep: clStatus === 'replied' ? 2 : clStatus === 'in_progress' ? 1 : 0,
        status: clStatus,
      },
    })
  }
  console.log(`Campaign 1: ${camp1.name} — ${saasLeads.length} leads`)

  // ─────────────────────────────────────────────────────────────────────────
  // CAMPAIGN 2: EdTech Decision Makers (draft)
  // ─────────────────────────────────────────────────────────────────────────

  const seq2Steps = [
    { type: 'visit_profile',      waitDays: 0, name: 'Visit profile' },
    {
      type: 'connection_request',
      waitDays: 1,
      message: 'Hi {{firstName}}, saw your work at {{company}} in the edtech space — would love to connect!',
      name: 'Connection request',
    },
    {
      type: 'chat_message',
      waitDays: 3,
      message: `Hi {{firstName}},\n\nThanks for connecting! Quick question — how does your team currently handle LinkedIn prospecting?\n\nI'm building something that might save you hours each week.\n\nAkhilesh`,
      name: 'Chat message',
    },
  ]

  const seq2 = await prisma.sequence.upsert({
    where: { id: 'seq_campaign2' },
    update: { steps: seq2Steps },
    create: {
      id: 'seq_campaign2',
      userId: user.id,
      name: 'EdTech Decision Makers Sequence',
      steps: seq2Steps,
      active: false,
    },
  })

  const ll2 = await prisma.leadList.upsert({
    where: { id: 'll_campaign2' },
    update: {},
    create: {
      id: 'll_campaign2',
      userId: user.id,
      name: 'EdTech Decision Makers Leads',
    },
  })

  const camp2 = await prisma.campaign.upsert({
    where: { id: 'camp_2' },
    update: {},
    create: {
      id: 'camp_2',
      userId: user.id,
      name: 'EdTech Decision Makers',
      sequenceId: seq2.id,
      leadListId: ll2.id,
      status: 'draft',
    },
  })

  const edtechLeads = [
    { id: 'lead_girish',  firstName: 'Girish',  lastName: 'Gupta',   email: 'girish.g@greatlearning.example.com', company: 'Great Learning', headline: 'Engineering Lead',  linkedinUrl: 'https://linkedin.com/in/girish-gupta', status: 'pending' as const },
    { id: 'lead_mohan',   firstName: 'Mohan',   lastName: 'Lakshmi', email: 'mohan.l@greatlearning.example.com',  company: 'Great Learning', headline: 'VP Education',      linkedinUrl: 'https://linkedin.com/in/mohan-lakshmi', status: 'pending' as const },
    { id: 'lead_abhinav', firstName: 'Abhinav', lastName: 'Badola',  email: 'abhinav.b@upgrad.example.com',      company: 'upGrad',         headline: 'VP Product',        linkedinUrl: 'https://linkedin.com/in/abhinav-badola', status: 'pending' as const },
    { id: 'lead_anil',    firstName: 'Anil',    lastName: 'Kumar',   email: 'anil.k@unacademy.example.com',      company: 'Unacademy',      headline: 'CEO',               linkedinUrl: 'https://linkedin.com/in/anil-kumar',    status: 'pending' as const },
    { id: 'lead_ashish',  firstName: 'Ashish',  lastName: 'Joy',     email: 'ashish.j@coursera.example.com',     company: 'Coursera',       headline: 'India Head',        linkedinUrl: 'https://linkedin.com/in/ashish-joy',    status: 'pending' as const },
  ]

  for (const l of edtechLeads) {
    await prisma.lead.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id,
        leadListId: ll2.id,
        firstName: l.firstName,
        lastName: l.lastName,
        email: l.email,
        company: l.company,
        headline: l.headline,
        linkedinUrl: l.linkedinUrl,
        status: l.status,
      },
    })
  }
  console.log(`Campaign 2: ${camp2.name} — ${edtechLeads.length} leads`)

  // ─────────────────────────────────────────────────────────────────────────
  // CAMPAIGN 3: Fintech Founders (paused)
  // ─────────────────────────────────────────────────────────────────────────

  const seq3Steps = [
    { type: 'visit_profile', waitDays: 0, name: 'Visit profile' },
    {
      type: 'chat_message',
      waitDays: 2,
      message: `Hi {{firstName}},\n\nI saw your work at {{company}} — really impressive what you're building in fintech.\n\nI'm working on AI-powered outreach tools for founder-led sales. Would love to show you how we're helping similar teams.\n\nAkhilesh`,
      name: 'Chat message',
    },
  ]

  const seq3 = await prisma.sequence.upsert({
    where: { id: 'seq_campaign3' },
    update: { steps: seq3Steps },
    create: {
      id: 'seq_campaign3',
      userId: user.id,
      name: 'Fintech Founders Sequence',
      steps: seq3Steps,
      active: false,
    },
  })

  const ll3 = await prisma.leadList.upsert({
    where: { id: 'll_campaign3' },
    update: {},
    create: {
      id: 'll_campaign3',
      userId: user.id,
      name: 'Fintech Founders Leads',
    },
  })

  const camp3 = await prisma.campaign.upsert({
    where: { id: 'camp_3' },
    update: {},
    create: {
      id: 'camp_3',
      userId: user.id,
      name: 'Fintech Founders',
      sequenceId: seq3.id,
      leadListId: ll3.id,
      status: 'paused',
      launchedAt: new Date('2026-03-01'),
    },
  })

  const fintechLeads = [
    { id: 'lead_nikhil', firstName: 'Nikhil', lastName: 'Kamath', email: 'nikhil@zerodha.example.com',     company: 'Zerodha',    headline: 'Co-Founder',   linkedinUrl: 'https://linkedin.com/in/nikhil-kamath',  status: 'in_progress' as const },
    { id: 'lead_harsha', firstName: 'Harsha', lastName: 'Kumar',  email: 'harsha@groww.example.com',         company: 'Groww',      headline: 'CEO',          linkedinUrl: 'https://linkedin.com/in/harsha-kumar',   status: 'replied' as const },
    { id: 'lead_vijay',  firstName: 'Vijay',  lastName: 'Shekhar',email: 'vijay@paytm.example.com',         company: 'Paytm',      headline: 'Founder & CEO',linkedinUrl: 'https://linkedin.com/in/vijay-shekhar',  status: 'pending' as const },
  ]

  for (const l of fintechLeads) {
    await prisma.lead.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id,
        leadListId: ll3.id,
        firstName: l.firstName,
        lastName: l.lastName,
        email: l.email,
        company: l.company,
        headline: l.headline,
        linkedinUrl: l.linkedinUrl,
        status: l.status,
      },
    })
    const clStatus = l.status === 'pending' ? 'pending' : l.status === 'replied' ? 'replied' : 'in_progress'
    await prisma.campaignLead.upsert({
      where: { campaignId_leadId: { campaignId: camp3.id, leadId: l.id } },
      update: {},
      create: {
        campaignId: camp3.id,
        leadId: l.id,
        currentStep: clStatus === 'replied' ? 1 : 0,
        status: clStatus,
      },
    })
  }
  console.log(`Campaign 3: ${camp3.name} — ${fintechLeads.length} leads`)

  // ── Keep existing seq_1 (used by older tests / dashboard) ──────────────────
  await prisma.sequence.upsert({
    where: { id: 'seq_1' },
    update: {},
    create: {
      id: 'seq_1',
      userId: user.id,
      name: 'Standard 3-Step Outreach',
      active: true,
      steps: [
        { day: 1, templateId: 'tmpl_1', templateName: 'Initial Outreach' },
        { day: 3, templateId: 'tmpl_2', templateName: 'Follow-up #1 (Day 3)' },
        { day: 7, templateId: 'tmpl_3', templateName: 'Follow-up #2 (Day 7)' },
      ],
    },
  })

  // ── Sample contacts (legacy / dashboard) ───────────────────────────────────
  const contacts = [
    { profileId: 'girish-gupta',  name: 'Girish Gupta',  company: 'Great Learning', headline: 'Engineering Lead',    status: 'replied',   daysAgo: 5 },
    { profileId: 'priya-sharma',  name: 'Priya Sharma',  company: 'Cleartrip',       headline: 'Product Manager',    status: 'followup',  daysAgo: 3 },
    { profileId: 'rahul-mehta',   name: 'Rahul Mehta',   company: 'PhonePe',         headline: 'VP Growth',          status: 'sent',      daysAgo: 1 },
    { profileId: 'anjali-verma',  name: 'Anjali Verma',  company: 'Zepto',           headline: 'Head of Marketing',  status: 'sent',      daysAgo: 0 },
    { profileId: 'arjun-nair',    name: 'Arjun Nair',    company: 'CRED',            headline: 'Senior Engineer',    status: 'replied',   daysAgo: 10 },
  ]

  for (const c of contacts) {
    const sentAt = new Date()
    sentAt.setDate(sentAt.getDate() - c.daysAgo)
    const followupAt = new Date(sentAt)
    followupAt.setDate(followupAt.getDate() + 3)
    await prisma.contact.upsert({
      where: { id: `contact_${c.profileId}` },
      update: {},
      create: {
        id: `contact_${c.profileId}`,
        userId: user.id,
        profileId: c.profileId,
        name: c.name,
        company: c.company,
        headline: c.headline,
        linkedinUrl: `https://linkedin.com/in/${c.profileId}`,
        status: c.status,
        sentAt,
        followupAt: c.status === 'followup' ? followupAt : null,
      },
    })
  }
  console.log(`Contacts: ${contacts.length}`)

  // ─────────────────────────────────────────────────────────────────────────
  // PLAN 3 — Companies. Seed top accounts that the existing leads work at, then
  //          backfill Lead.companyId so /companies has rollup data to show.
  // ─────────────────────────────────────────────────────────────────────────
  const companySeed = [
    { id: 'co_phonepe',    name: 'PhonePe',       domain: 'phonepe.example.com',       industry: 'Fintech',    size: '5001-10000', country: 'IN', city: 'Bengaluru' },
    { id: 'co_razorpay',   name: 'Razorpay',      domain: 'razorpay.example.com',      industry: 'Fintech',    size: '1001-5000',  country: 'IN', city: 'Bengaluru' },
    { id: 'co_swiggy',     name: 'Swiggy',        domain: 'swiggy.example.com',        industry: 'Foodtech',   size: '5001-10000', country: 'IN', city: 'Bengaluru' },
    { id: 'co_zomato',     name: 'Zomato',        domain: 'zomato.example.com',        industry: 'Foodtech',   size: '5001-10000', country: 'IN', city: 'Gurugram' },
    { id: 'co_cred',       name: 'CRED',          domain: 'cred.example.com',         industry: 'Fintech',    size: '501-1000',   country: 'IN', city: 'Bengaluru' },
    { id: 'co_freshworks', name: 'Freshworks',    domain: 'freshworks.example.com',    industry: 'SaaS',       size: '1001-5000',  country: 'IN', city: 'Chennai' },
    { id: 'co_zerodha',    name: 'Zerodha',       domain: 'zerodha.example.com',       industry: 'Fintech',    size: '1001-5000',  country: 'IN', city: 'Bengaluru' },
    { id: 'co_groww',      name: 'Groww',         domain: 'groww.example.com',          industry: 'Fintech',    size: '501-1000',   country: 'IN', city: 'Bengaluru' },
    { id: 'co_greatlearn', name: 'Great Learning',domain: 'greatlearning.example.com',  industry: 'EdTech',     size: '1001-5000',  country: 'IN', city: 'Gurugram' },
    { id: 'co_upgrad',     name: 'upGrad',        domain: 'upgrad.example.com',        industry: 'EdTech',     size: '1001-5000',  country: 'IN', city: 'Mumbai' },
  ]
  for (const c of companySeed) {
    await prisma.company.upsert({
      where: { id: c.id },
      update: { contactCount: 0, leadCount: 0 },
      create: {
        ...c,
        userId: user.id,
        normalizedName: c.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        market: 'B2B',
        technologies: [],
        tags: [],
      },
    })
  }
  // Link leads by company-name match and refresh aggregates
  for (const c of companySeed) {
    const updated = await prisma.lead.updateMany({
      where: { company: c.name, companyId: null },
      data: { companyId: c.id },
    })
    if (updated.count > 0) {
      await prisma.company.update({
        where: { id: c.id },
        data: { leadCount: updated.count, lastActivityAt: new Date() },
      })
    }
  }
  console.log(`Companies: ${companySeed.length}`)

  // ─────────────────────────────────────────────────────────────────────────
  // Email infrastructure — one SMTP sending account (no real creds; UI demo only)
  // ─────────────────────────────────────────────────────────────────────────
  // Demo EmailAccount — credentials intentionally absent so even if a visitor
  // clicks "Launch campaign" in the demo account, the SMTP send fails with
  // "no credentials configured" instead of contacting a real mail server.
  const emailAccount = await prisma.emailAccount.upsert({
    where: { id: 'ea_demo' },
    update: {},
    create: {
      id: 'ea_demo',
      userId: user.id,
      provider: 'smtp',
      name: 'Demo sending account',
      email: 'demo@example.com',
      smtpHost: null,
      smtpPort: null,
      smtpUser: null,
      smtpPass: null,
      imapHost: null,
      imapPort: null,
      isDefault: true,
      dailyLimit: 100,
      signature: 'Akhilesh Chauhan\nFounder, OutreachAI',
      warmupActive: true,
    },
  })
  console.log(`EmailAccount: ${emailAccount.email}`)

  // ─────────────────────────────────────────────────────────────────────────
  // EmailMessages — a mix of sent / opened / replied / bounced for the active campaign
  // ─────────────────────────────────────────────────────────────────────────
  const day = (d: number) => new Date(Date.now() - d * 86_400_000)
  const emailMessages = [
    { id: 'em_1', to: 'rahul.m@phonepe.example.com',     subject: 'Quick thought on PhonePe outbound', status: 'replied', sentAt: day(8), repliedAt: day(7), openedAt: day(8) },
    { id: 'em_2', to: 'arjun.n@cred.example.com',       subject: 'CRED + AI personalization', status: 'replied', sentAt: day(6), repliedAt: day(5), openedAt: day(6) },
    { id: 'em_3', to: 'vikram.s@razorpay.example.com',   subject: 'Razorpay sales tooling',   status: 'opened',  sentAt: day(3), openedAt: day(2), repliedAt: null },
    { id: 'em_4', to: 'neha.g@meesho.example.com',       subject: 'Meesho growth idea',       status: 'sent',    sentAt: day(1), openedAt: null,  repliedAt: null },
    { id: 'em_5', to: 'rohan.j@swiggy.example.com',      subject: 'Swiggy prospecting playbook', status: 'bounced', sentAt: day(2), openedAt: null, repliedAt: null },
    { id: 'em_6', to: 'kavya.r@ola.example.com',         subject: 'Ola Ops + AI outreach',    status: 'opened',  sentAt: day(4), openedAt: day(3), repliedAt: null },
  ]
  for (const m of emailMessages) {
    await prisma.emailMessage.upsert({
      where: { id: m.id },
      update: {},
      create: {
        id: m.id,
        userId: user.id,
        emailAccountId: emailAccount.id,
        to: m.to,
        subject: m.subject,
        body: `Hi {{firstName}},\n\nQuick thought I wanted to share with you about ${m.subject.toLowerCase()}.\n\n— Akhilesh`,
        status: m.status,
        sentAt: m.sentAt,
        openedAt: m.openedAt,
        repliedAt: m.repliedAt,
        trackingId: m.id + '_tr',
      },
    })
  }
  console.log(`EmailMessages: ${emailMessages.length}`)

  // ─────────────────────────────────────────────────────────────────────────
  // PLAN 2 — Conversations + Messages (channel-agnostic inbox)
  // ─────────────────────────────────────────────────────────────────────────
  type Convo = {
    id: string; channel: 'email' | 'linkedin'; participantName: string;
    participantEmail?: string; participantUrl?: string; linkedinProfileId?: string;
    emailThreadKey?: string; subject?: string; leadId?: string; status: 'open' | 'done';
    unread: boolean; labels?: string[]; lastSenderIsMe: boolean; lastAt: Date;
    messages: { id: string; direction: 'in' | 'out'; body: string; sentAt: Date }[];
  }
  const convos: Convo[] = [
    {
      id: 'conv_email_phonepe', channel: 'email',
      participantName: 'Rahul Mehta', participantEmail: 'rahul.m@phonepe.example.com',
      emailThreadKey: 'rahul.m@phonepe.example.com|quick thought on phonepe outbound',
      subject: 'Quick thought on PhonePe outbound', leadId: 'lead_rahul',
      status: 'open', unread: true, labels: ['interested'], lastSenderIsMe: false, lastAt: day(7),
      messages: [
        { id: 'msg_1', direction: 'out', body: "Hi Rahul,\n\nI've been following PhonePe's growth — your work on the merchant side is incredible.\n\nWe help fintech sales teams cut outbound prospecting time by 60% using AI. Open to a 15-min call this week?\n\nAkhilesh", sentAt: day(8) },
        { id: 'msg_2', direction: 'in',  body: "Hey Akhilesh — thanks for the note. Interesting timing, we're actually scoping outbound tooling this quarter. Can you send over a one-pager?", sentAt: day(7) },
      ],
    },
    {
      id: 'conv_email_cred', channel: 'email',
      participantName: 'Arjun Nair', participantEmail: 'arjun.n@cred.example.com',
      emailThreadKey: 'arjun.n@cred.example.com|cred + ai personalization',
      subject: 'CRED + AI personalization', leadId: 'lead_arjun',
      status: 'open', unread: false, lastSenderIsMe: true, lastAt: day(5),
      messages: [
        { id: 'msg_3', direction: 'out', body: 'Hi Arjun, your team\'s engineering culture is the gold standard — would love to share what we\'re doing on the AI outreach side. Sound interesting?', sentAt: day(6) },
        { id: 'msg_4', direction: 'in',  body: 'Hey Akhilesh, appreciate the message. Send a deck?', sentAt: day(5, ) },
        { id: 'msg_5', direction: 'out', body: 'Just shared a 4-slide overview — let me know what resonates.', sentAt: day(5) },
      ],
    },
    {
      id: 'conv_li_freshworks', channel: 'linkedin',
      participantName: 'Siddharth Bose', linkedinProfileId: 'siddharth-bose',
      participantUrl: 'https://linkedin.com/in/siddharth-bose', leadId: 'lead_siddharth',
      status: 'open', unread: true, labels: ['favorite'], lastSenderIsMe: false, lastAt: day(2),
      messages: [
        { id: 'msg_6', direction: 'out', body: "Hi Siddharth — Freshworks' PLG motion is genuinely one of the most interesting I've followed. Open to chatting about outbound layered on top?", sentAt: day(4) },
        { id: 'msg_7', direction: 'in',  body: 'Hey, intrigued — let me check the calendar and revert.', sentAt: day(3) },
        { id: 'msg_8', direction: 'in',  body: 'Got a slot Friday 4pm IST. Works for you?', sentAt: day(2) },
      ],
    },
    {
      id: 'conv_li_nykaa', channel: 'linkedin',
      participantName: 'Deepika Agarwal', linkedinProfileId: 'deepika-agarwal',
      participantUrl: 'https://linkedin.com/in/deepika-agarwal', leadId: 'lead_deepika',
      status: 'done', unread: false, labels: ['not_interested'], lastSenderIsMe: false, lastAt: day(10),
      messages: [
        { id: 'msg_9',  direction: 'out', body: "Hi Deepika — Nykaa's category convergence is the kind of brand work I keep flagging in our team. Quick chat?", sentAt: day(12) },
        { id: 'msg_10', direction: 'in',  body: 'Hi! Not the right time for us — please re-engage in Q3.', sentAt: day(10) },
      ],
    },
  ]
  for (const c of convos) {
    await prisma.conversation.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id, userId: user.id, channel: c.channel,
        participantName: c.participantName, participantEmail: c.participantEmail ?? null,
        participantUrl: c.participantUrl ?? null, linkedinProfileId: c.linkedinProfileId ?? null,
        emailThreadKey: c.emailThreadKey ?? null, subject: c.subject ?? null,
        leadId: c.leadId ?? null, status: c.status, unread: c.unread,
        labels: c.labels ?? [], lastMessageAt: c.lastAt, lastSenderIsMe: c.lastSenderIsMe,
      },
    })
    for (const m of c.messages) {
      await prisma.message.upsert({
        where: { id: m.id },
        update: {},
        create: { id: m.id, conversationId: c.id, direction: m.direction, body: m.body, sentAt: m.sentAt },
      })
    }
  }
  console.log(`Conversations: ${convos.length} (with ${convos.reduce((a, c) => a + c.messages.length, 0)} messages)`)

  // ─────────────────────────────────────────────────────────────────────────
  // Tasks — a mix of open and completed
  // ─────────────────────────────────────────────────────────────────────────
  const tasks = [
    { id: 'tsk_1', type: 'call',     title: 'Call Rahul (PhonePe) — discovery',  leadId: 'lead_rahul',     dueAt: day(-1), completed: false },
    { id: 'tsk_2', type: 'email',    title: 'Send Razorpay one-pager to Vikram', leadId: 'lead_vikram',    dueAt: day(0),  completed: false },
    { id: 'tsk_3', type: 'linkedin', title: 'Engage with Siddharth\'s recent post', leadId: 'lead_siddharth', dueAt: day(-2), completed: false },
    { id: 'tsk_4', type: 'custom',   title: 'Prep deck for Arjun call',          leadId: 'lead_arjun',     dueAt: day(2),  completed: true, completedAt: day(1) },
  ]
  for (const t of tasks) {
    await prisma.task.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id, userId: user.id, leadId: t.leadId, type: t.type,
        title: t.title, dueAt: t.dueAt, completedAt: t.completed ? (t as any).completedAt ?? day(0) : null,
      },
    })
  }
  console.log(`Tasks: ${tasks.length}`)

  // ─────────────────────────────────────────────────────────────────────────
  // Email warmup — day 12 of a 30-day ramp
  // ─────────────────────────────────────────────────────────────────────────
  const warmup = await prisma.warmupAccount.upsert({
    where: { emailAccountId: emailAccount.id },
    update: {},
    create: {
      id: 'wa_demo', userId: user.id, emailAccountId: emailAccount.id,
      status: 'active', dailyTarget: 15, currentDay: 12,
      totalSent: 84, totalReceived: 76, totalReplied: 41,
      startedAt: day(12), lastRunAt: day(0),
    },
  })
  const warmupSamples = [
    { id: 'we_1', direction: 'out', fromEmail: 'demo@example.com', toEmail: 'pool1@warmup.example.com', subject: 'Re: Quarterly update',  replied: true,  sentAt: day(1) },
    { id: 'we_2', direction: 'in',  fromEmail: 'pool2@warmup.example.com', toEmail: 'demo@example.com', subject: 'Touching base',          replied: false, sentAt: day(1) },
    { id: 'we_3', direction: 'out', fromEmail: 'demo@example.com', toEmail: 'pool3@warmup.example.com', subject: 'Re: Touching base',      replied: true,  sentAt: day(0) },
  ]
  for (const w of warmupSamples) {
    await prisma.warmupEmail.upsert({
      where: { id: w.id },
      update: {},
      create: {
        id: w.id, warmupAccountId: warmup.id, direction: w.direction,
        fromEmail: w.fromEmail, toEmail: w.toEmail, subject: w.subject,
        body: 'Warmup body — exchanged between OutreachAI pool accounts to build sender reputation.',
        replied: w.replied, repliedAt: w.replied ? w.sentAt : null, sentAt: w.sentAt,
      },
    })
  }
  console.log(`WarmupAccount: day ${warmup.currentDay}, ${warmupSamples.length} sample emails`)

  // ─────────────────────────────────────────────────────────────────────────
  // Marketing broadcast — one sent campaign with engagement
  // ─────────────────────────────────────────────────────────────────────────
  const mktCampaign = await prisma.marketingCampaign.upsert({
    where: { id: 'mkt_1' },
    update: {},
    create: {
      id: 'mkt_1', userId: user.id, name: 'OutreachAI v2 launch announcement',
      subject: 'New: AI replies inside your inbox',
      htmlBody: '<h1>OutreachAI v2</h1><p>We just shipped AI reply drafting straight in your unified inbox. {{firstName}}, want a 5-min demo?</p>',
      fromName: 'Akhilesh @ OutreachAI', emailAccountId: emailAccount.id,
      status: 'sent', sentAt: day(7), recipientListId: 'll_campaign1',
      stats: { sent: 20, opened: 14, clicked: 6, bounced: 1, unsubscribed: 1 },
    },
  })
  const mktSendsPlan = [
    { id: 'ms_1', leadId: 'lead_rahul',     status: 'sent', openedAt: day(6), clickedAt: day(6) },
    { id: 'ms_2', leadId: 'lead_arjun',     status: 'sent', openedAt: day(6), clickedAt: null },
    { id: 'ms_3', leadId: 'lead_vikram',    status: 'sent', openedAt: day(5), clickedAt: day(5) },
    { id: 'ms_4', leadId: 'lead_neha',      status: 'sent', openedAt: null,   clickedAt: null },
    { id: 'ms_5', leadId: 'lead_rohan',     status: 'bounced', openedAt: null, clickedAt: null },
    { id: 'ms_6', leadId: 'lead_priya',     status: 'sent', openedAt: day(5), clickedAt: null, unsubscribed: true },
  ]
  for (const s of mktSendsPlan) {
    await prisma.marketingCampaignSend.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id, campaignId: mktCampaign.id, leadId: s.leadId,
        leadEmail: saasLeads.find(l => l.id === s.leadId)?.email ?? 'unknown@x.com',
        status: s.status, sentAt: day(7),
        openedAt: s.openedAt, clickedAt: s.clickedAt,
        unsubscribedAt: (s as any).unsubscribed ? day(5) : null,
        trackingId: s.id + '_tr',
      },
    })
  }
  await prisma.unsubscribe.upsert({
    where: { email_userId: { email: 'priya.s@cleartrip.example.com', userId: user.id } },
    update: {},
    create: { email: 'priya.s@cleartrip.example.com', userId: user.id },
  })
  console.log(`MarketingCampaign: ${mktCampaign.name} (${mktSendsPlan.length} sends, 1 unsubscribe)`)

  // ─────────────────────────────────────────────────────────────────────────
  // CapturedPosts — 3 LinkedIn posts captured via the Chrome extension
  // ─────────────────────────────────────────────────────────────────────────
  const capturedPosts = [
    {
      id: 'cp_1', profileId: 'rahul-mehta', profileName: 'Rahul Mehta',
      profileUrl: 'https://linkedin.com/in/rahul-mehta',
      postText: 'Spent the last quarter rebuilding our outbound playbook. Three things matter more than I realized: (1) timing, (2) signal density, (3) crystal-clear positioning. Tools matter — but mostly they amplify the basics.',
      postUrl: 'https://linkedin.com/posts/rahul-mehta_outbound',
      postedAt: '2026-06-18', likes: 412, comments: 38,
    },
    {
      id: 'cp_2', profileId: 'arjun-nair', profileName: 'Arjun Nair',
      profileUrl: 'https://linkedin.com/in/arjun-nair',
      postText: 'The best engineering cultures aren\'t built on perks — they\'re built on (a) shipping speed, (b) ownership, (c) intellectual honesty. The rest follows.',
      postUrl: 'https://linkedin.com/posts/arjun-nair_engineering-culture',
      postedAt: '2026-06-10', likes: 1840, comments: 124,
    },
    {
      id: 'cp_3', profileId: 'siddharth-bose', profileName: 'Siddharth Bose',
      profileUrl: 'https://linkedin.com/in/siddharth-bose',
      postText: 'PLG in enterprise SaaS only works when self-serve isn\'t a marketing tactic — it\'s the product itself. The moment friction creeps in, the motion dies.',
      postUrl: 'https://linkedin.com/posts/siddharth-bose_plg',
      postedAt: '2026-06-05', likes: 612, comments: 47,
    },
  ]
  for (const p of capturedPosts) {
    await prisma.capturedPost.upsert({
      where: { id: p.id },
      update: {},
      create: { ...p, userId: user.id },
    })
  }
  console.log(`CapturedPosts: ${capturedPosts.length}`)

  // ─────────────────────────────────────────────────────────────────────────
  // Workspace — personal workspace for the demo user
  // ─────────────────────────────────────────────────────────────────────────
  const workspace = await prisma.workspace.upsert({
    where: { id: 'ws_demo' },
    update: {},
    create: { id: 'ws_demo', name: 'Akhilesh\'s Workspace', ownerId: user.id },
  })
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: user.id, role: 'owner' },
  })
  console.log(`Workspace: ${workspace.name}`)

  // ─────────────────────────────────────────────────────────────────────────
  // PLAN 4 — LeadActivity. Cross-cuts everything else; built from the events
  //          above so the timelines feel real. Emitted by hand here (not via
  //          lib/activity.ts) so the seed has no test-time mocking dependency.
  // ─────────────────────────────────────────────────────────────────────────
  type Act = {
    id: string; leadId: string; companyId?: string; type: string;
    channel?: string; source?: string; title: string; body?: string;
    occurredAt: Date; messageId?: string; conversationId?: string;
    campaignId?: string; taskId?: string; actorUserId?: string; payload?: object;
  }
  const acts: Act[] = [
    // Rahul (PhonePe) — full email → replied flow + marketing engagement
    { id: 'la_1',  leadId: 'lead_rahul', companyId: 'co_phonepe', type: 'email.sent',    channel: 'email', source: 'campaign', title: 'Sent email: "Quick thought on PhonePe outbound"', occurredAt: day(8), messageId: 'em_1', campaignId: 'camp_1' },
    { id: 'la_2',  leadId: 'lead_rahul', companyId: 'co_phonepe', type: 'email.opened',  channel: 'email', source: 'system',   title: 'Opened email', occurredAt: day(8), messageId: 'em_1' },
    { id: 'la_3',  leadId: 'lead_rahul', companyId: 'co_phonepe', type: 'email.replied', channel: 'email', source: 'system',   title: 'Replied to email', occurredAt: day(7), messageId: 'em_1', conversationId: 'conv_email_phonepe' },
    { id: 'la_4',  leadId: 'lead_rahul', companyId: 'co_phonepe', type: 'email.opened',  channel: 'email', source: 'system',   title: 'Opened broadcast: "New: AI replies inside your inbox"', occurredAt: day(6) },

    // Arjun (CRED) — email sent + reply + manual note
    { id: 'la_5',  leadId: 'lead_arjun', companyId: 'co_cred', type: 'email.sent',    channel: 'email',  source: 'campaign', title: 'Sent email: "CRED + AI personalization"', occurredAt: day(6), messageId: 'em_2', campaignId: 'camp_1' },
    { id: 'la_6',  leadId: 'lead_arjun', companyId: 'co_cred', type: 'email.replied', channel: 'email',  source: 'system',   title: 'Replied to email', occurredAt: day(5), messageId: 'em_2', conversationId: 'conv_email_cred' },
    { id: 'la_7',  leadId: 'lead_arjun', companyId: 'co_cred', type: 'note.added',    source: 'manual',  title: 'Note added', body: 'Asked for the 4-slide deck. Mentioned Q3 budget freeze — schedule follow-up.', occurredAt: day(5), actorUserId: user.id },
    { id: 'la_8',  leadId: 'lead_arjun', companyId: 'co_cred', type: 'task.completed', source: 'manual', title: 'Completed task: "Prep deck for Arjun call"', occurredAt: day(1), taskId: 'tsk_4', actorUserId: user.id },

    // Vikram (Razorpay) — opened but no reply yet
    { id: 'la_9',  leadId: 'lead_vikram', companyId: 'co_razorpay', type: 'email.sent',   channel: 'email', source: 'campaign', title: 'Sent email: "Razorpay sales tooling"', occurredAt: day(3), messageId: 'em_3', campaignId: 'camp_1' },
    { id: 'la_10', leadId: 'lead_vikram', companyId: 'co_razorpay', type: 'email.opened', channel: 'email', source: 'system',   title: 'Opened email', occurredAt: day(2), messageId: 'em_3' },
    { id: 'la_11', leadId: 'lead_vikram', companyId: 'co_razorpay', type: 'email.clicked',channel: 'email', source: 'system',   title: 'Clicked link: outreachai.in/demo', occurredAt: day(2), messageId: 'em_3', payload: { url: 'https://outreachai.in/demo' } },
    { id: 'la_12', leadId: 'lead_vikram', companyId: 'co_razorpay', type: 'task.created', source: 'manual', title: 'Created task: "Send Razorpay one-pager to Vikram"', occurredAt: day(2), taskId: 'tsk_2', actorUserId: user.id },

    // Rohan (Swiggy) — bounced
    { id: 'la_13', leadId: 'lead_rohan', companyId: 'co_swiggy', type: 'email.sent',    channel: 'email', source: 'campaign', title: 'Sent email: "Swiggy prospecting playbook"', occurredAt: day(2), messageId: 'em_5', campaignId: 'camp_1' },
    { id: 'la_14', leadId: 'lead_rohan', companyId: 'co_swiggy', type: 'email.bounced', channel: 'email', source: 'system',   title: 'Email bounced', body: '550 5.1.1 No such recipient', occurredAt: day(2) },

    // Siddharth (Freshworks) — LinkedIn flow + DM reply
    { id: 'la_15', leadId: 'lead_siddharth', companyId: 'co_freshworks', type: 'linkedin.invite_queued', channel: 'linkedin', source: 'campaign', title: 'Queued LinkedIn invitation', occurredAt: day(5), campaignId: 'camp_1' },
    { id: 'la_16', leadId: 'lead_siddharth', companyId: 'co_freshworks', type: 'linkedin.invite_sent',  channel: 'linkedin', source: 'extension', title: 'Sent LinkedIn invitation', occurredAt: day(4), campaignId: 'camp_1' },
    { id: 'la_17', leadId: 'lead_siddharth', companyId: 'co_freshworks', type: 'linkedin.message_sent', channel: 'linkedin', source: 'extension', title: 'Sent LinkedIn message', occurredAt: day(4), campaignId: 'camp_1' },
    { id: 'la_18', leadId: 'lead_siddharth', companyId: 'co_freshworks', type: 'linkedin.message_received', channel: 'linkedin', source: 'extension', title: 'Received LinkedIn message from Siddharth Bose', occurredAt: day(3), conversationId: 'conv_li_freshworks' },
    { id: 'la_19', leadId: 'lead_siddharth', companyId: 'co_freshworks', type: 'linkedin.message_received', channel: 'linkedin', source: 'extension', title: 'Received LinkedIn message from Siddharth Bose', occurredAt: day(2), conversationId: 'conv_li_freshworks' },

    // Deepika (Nykaa) — LinkedIn polite decline (still a touch)
    { id: 'la_20', leadId: 'lead_deepika', type: 'linkedin.message_sent',     channel: 'linkedin', source: 'campaign',  title: 'Sent LinkedIn message', occurredAt: day(12) },
    { id: 'la_21', leadId: 'lead_deepika', type: 'linkedin.message_received', channel: 'linkedin', source: 'extension', title: 'Received LinkedIn message from Deepika Agarwal', occurredAt: day(10), conversationId: 'conv_li_nykaa' },
    { id: 'la_22', leadId: 'lead_deepika', type: 'status.changed', source: 'system', title: 'Status changed: in_progress → not_interested', payload: { from: 'in_progress', to: 'not_interested' }, occurredAt: day(10) },

    // Enrichment activity
    { id: 'la_23', leadId: 'lead_neha',   companyId: 'co_freshworks', type: 'enrichment.completed', source: 'agent', title: 'Enriched lead via Apollo', occurredAt: day(9) },
    { id: 'la_24', leadId: 'lead_kavya',  type: 'email.opened',  channel: 'email', source: 'system', title: 'Opened email', occurredAt: day(3), messageId: 'em_6' },
  ]
  for (const a of acts) {
    await prisma.leadActivity.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id, userId: user.id, leadId: a.leadId, companyId: a.companyId ?? null,
        type: a.type, channel: a.channel ?? null, source: a.source ?? null,
        title: a.title, body: a.body ?? null, occurredAt: a.occurredAt,
        messageId: a.messageId ?? null, conversationId: a.conversationId ?? null,
        campaignId: a.campaignId ?? null, taskId: a.taskId ?? null,
        actorUserId: a.actorUserId ?? null,
        payload: (a.payload as any) ?? undefined,
      },
    })
  }
  // Refresh per-company lastActivityAt
  for (const c of companySeed) {
    const latest = acts.filter(a => a.companyId === c.id).reduce((m, a) => a.occurredAt > m ? a.occurredAt : m, new Date(0))
    if (latest.getTime() > 0) {
      await prisma.company.update({ where: { id: c.id }, data: { lastActivityAt: latest } })
    }
  }
  console.log(`LeadActivities: ${acts.length}`)

  // ─────────────────────────────────────────────────────────────────────────
  // HOT-LEAD SCORES — patch openCount/clickCount/score on engaged leads
  // (mirrors what recordLeadOpen/recordLeadClick/recordLeadReply would write)
  // ─────────────────────────────────────────────────────────────────────────
  const leadEngagement = [
    // formula: min(openCount*7,35) + min(clickCount*25,25) + (replied?40:0)
    { id: 'lead_rahul',     openCount: 3, clickCount: 1, score: 86 }, // 21+25+40
    { id: 'lead_arjun',     openCount: 2, clickCount: 0, score: 54 }, // 14+0+40
    { id: 'lead_vikram',    openCount: 4, clickCount: 1, score: 53 }, // 28+25+0
    { id: 'lead_siddharth', openCount: 1, clickCount: 0, score: 47 }, // 7+0+40
    { id: 'lead_deepika',   openCount: 2, clickCount: 0, score: 54 }, // 14+0+40
    { id: 'lead_kavya',     openCount: 2, clickCount: 1, score: 39 }, // 14+25+0
    { id: 'lead_manish',    openCount: 3, clickCount: 1, score: 46 }, // 21+25+0
    { id: 'lead_priya',     openCount: 1, clickCount: 1, score: 32 }, // 7+25+0
    { id: 'lead_anjali',    openCount: 1, clickCount: 0, score: 7  }, // 7+0+0
    { id: 'lead_neha',      openCount: 1, clickCount: 0, score: 7  }, // 7+0+0
  ]
  for (const e of leadEngagement) {
    await prisma.lead.update({
      where: { id: e.id },
      data: { openCount: e.openCount, clickCount: e.clickCount, score: e.score, lastOpenedAt: day(2) },
    })
  }
  console.log(`Hot-lead scores: patched ${leadEngagement.length} leads`)

  // ─────────────────────────────────────────────────────────────────────────
  // MARKETING — second campaign in A/B testing phase
  // ─────────────────────────────────────────────────────────────────────────
  const mktCampaign2 = await prisma.marketingCampaign.upsert({
    where: { id: 'mkt_2' },
    update: {},
    create: {
      id: 'mkt_2', userId: user.id,
      name: 'Q3 cold-email benchmark report',
      subject: '2026 cold-email benchmarks — free report',
      abEnabled: true,
      abSubjectB: 'Why your open rates are lower than you think',
      abSplitPercent: 20,
      abWinnerMetric: 'open',
      abTestDurationHours: 4,
      abWinner: null,
      htmlBody: '<h1>Cold Email Benchmarks 2026</h1><p>Hey {{firstName}}, we just published India\'s first cold-email benchmark report. 40+ data points across 15 industries. Grab your free copy below.</p>',
      fromName: 'Akhilesh @ OutreachAI', emailAccountId: emailAccount.id,
      status: 'ab_testing', sentAt: day(1), recipientListId: 'll_campaign1',
      stats: { sent: 40, opened: 8, clicked: 2, bounced: 0, unsubscribed: 0 },
    },
  })
  const mktSends2 = [
    { id: 'ms2_1', leadId: 'lead_aakash', variant: 'A', openedAt: day(1), clickedAt: null },
    { id: 'ms2_2', leadId: 'lead_anjali', variant: 'A', openedAt: null,   clickedAt: null },
    { id: 'ms2_3', leadId: 'lead_kunal',  variant: 'B', openedAt: day(1), clickedAt: day(0) },
    { id: 'ms2_4', leadId: 'lead_varun',  variant: 'B', openedAt: day(0), clickedAt: null },
    { id: 'ms2_5', leadId: 'lead_rohan',  variant: 'A', openedAt: null,   clickedAt: null },
    { id: 'ms2_6', leadId: 'lead_amit',   variant: 'B', openedAt: day(0), clickedAt: null },
  ]
  for (const s of mktSends2) {
    await prisma.marketingCampaignSend.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id, campaignId: mktCampaign2.id, leadId: s.leadId,
        leadEmail: saasLeads.find(l => l.id === s.leadId)?.email ?? 'unknown@x.com',
        status: 'sent', sentAt: day(1),
        openedAt: s.openedAt ?? null, clickedAt: s.clickedAt ?? null,
        unsubscribedAt: null, trackingId: s.id + '_tr',
      },
    })
  }
  console.log(`MarketingCampaign A/B: ${mktCampaign2.name} (${mktSends2.length} sends)`)

  // ─────────────────────────────────────────────────────────────────────────
  // SNIPPETS — quick-insert reusable text blocks
  // ─────────────────────────────────────────────────────────────────────────
  const snippets = [
    { id: 'snip_1', key: 'pricing', label: 'Pricing',    body: 'Our pricing starts at $99/month for the Starter plan (up to 3 email accounts, 500 leads). Pro is $249/month — unlimited accounts + LinkedIn extension. We also offer a 14-day free trial, no card required.' },
    { id: 'snip_2', key: 'demo',    label: 'Demo Link',  body: 'I\'d be happy to run a 20-min live demo tailored to your use case. You can grab time directly here: https://cal.com/akhilesh/demo — or just suggest a slot and I\'ll send an invite.' },
    { id: 'snip_3', key: 'roi',     label: 'ROI Stats',  body: 'Most customers see 3–5x reply rates vs manual outreach within the first 30 days. The biggest gain is time: reps save ~2 hours/day on prospecting, which goes back into live conversations.' },
    { id: 'snip_4', key: 'case',    label: 'Case Study', body: 'One of our customers (EdTech, 12-person sales team) went from 1.2% reply rate to 4.8% in 6 weeks using our AI personalization + LinkedIn extension. Happy to share the full write-up.' },
  ]
  for (const s of snippets) {
    await prisma.snippet.upsert({
      where: { id: s.id },
      update: {},
      create: { id: s.id, userId: user.id, key: s.key, label: s.label, body: s.body },
    })
  }
  console.log(`Snippets: ${snippets.length}`)

  // ─────────────────────────────────────────────────────────────────────────
  // DELIVERABILITY ALERTS — user-defined threshold rules
  // ─────────────────────────────────────────────────────────────────────────
  const delivAlerts = [
    { id: 'da_1', metric: 'bounce_rate',  condition: 'above', threshold: 5.0,  description: 'Alert when bounce rate exceeds 5%' },
    { id: 'da_2', metric: 'open_rate',    condition: 'below', threshold: 15.0, description: 'Alert when open rate falls below 15%' },
    { id: 'da_3', metric: 'reply_rate',   condition: 'below', threshold: 1.0,  description: 'Alert when reply rate falls below 1%' },
  ]
  for (const d of delivAlerts) {
    await prisma.deliverabilityAlert.upsert({
      where: { id: d.id },
      update: {},
      create: { id: d.id, userId: user.id, metric: d.metric, condition: d.condition, threshold: d.threshold, active: true },
    })
  }
  console.log(`DeliverabilityAlerts: ${delivAlerts.length}`)

  // ─────────────────────────────────────────────────────────────────────────
  // MORE CONVERSATIONS — so the inbox feels full
  // ─────────────────────────────────────────────────────────────────────────
  const moreConvos = [
    {
      id: 'conv_li_manish', channel: 'linkedin' as const,
      participantName: 'Manish Kumar', linkedinProfileId: 'manish-kumar',
      participantUrl: 'https://linkedin.com/in/manish-kumar', leadId: 'lead_manish',
      status: 'open' as const, unread: true, labels: ['interested'], lastSenderIsMe: false, lastAt: day(1),
      msgs: [
        { id: 'msg_m1', direction: 'out' as const, body: "Hi Manish — Paytm's pivot into financial services is one of the most ambitious product stories in India. Quick question: how does your outbound team keep up with the scale?", sentAt: day(3) },
        { id: 'msg_m2', direction: 'in'  as const, body: "Hey Akhilesh, great timing — we're evaluating outreach tooling. Can you send a quick overview?", sentAt: day(1) },
      ],
    },
    {
      id: 'conv_email_vikram2', channel: 'email' as const,
      participantName: 'Vikram Singh', participantEmail: 'vikram.s@razorpay.example.com',
      emailThreadKey: 'vikram.s@razorpay.example.com|razorpay sales tooling followup',
      subject: 'Re: Razorpay sales tooling', leadId: 'lead_vikram',
      status: 'open' as const, unread: true, labels: [], lastSenderIsMe: false, lastAt: day(1),
      msgs: [
        { id: 'msg_v1', direction: 'out' as const, body: "Hi Vikram — following up on the one-pager. Any questions I can answer?", sentAt: day(2) },
        { id: 'msg_v2', direction: 'in'  as const, body: "Akhilesh — shared it with the team. We'd like to see a live demo. When are you available?", sentAt: day(1) },
      ],
    },
    {
      id: 'conv_li_kunal', channel: 'linkedin' as const,
      participantName: 'Kunal Shah', linkedinProfileId: 'kunal-shah',
      participantUrl: 'https://linkedin.com/in/kunal-shah', leadId: 'lead_kunal',
      status: 'open' as const, unread: false, labels: ['meeting_booked'], lastSenderIsMe: true, lastAt: day(0),
      msgs: [
        { id: 'msg_k1', direction: 'out' as const, body: "Hi Kunal — Dream11's IPL acquisition playbook is the kind of growth case study every marketer studies. Would love a quick call.", sentAt: day(5) },
        { id: 'msg_k2', direction: 'in'  as const, body: "Sure — let's do it. Friday 3pm IST?", sentAt: day(3) },
        { id: 'msg_k3', direction: 'out' as const, body: "Perfect, sending a calendar invite now. Looking forward to it!", sentAt: day(0) },
      ],
    },
    {
      id: 'conv_email_anjali', channel: 'email' as const,
      participantName: 'Anjali Verma', participantEmail: 'anjali.v@zepto.example.com',
      emailThreadKey: 'anjali.v@zepto.example.com|zepto growth idea',
      subject: 'Re: Zepto growth idea', leadId: 'lead_anjali',
      status: 'open' as const, unread: false, labels: [], lastSenderIsMe: true, lastAt: day(4),
      msgs: [
        { id: 'msg_a1', direction: 'out' as const, body: "Hi Anjali — Zepto's 10-min delivery model is fascinating. Curious how your growth team handles partner outreach at that speed?", sentAt: day(5) },
        { id: 'msg_a2', direction: 'out' as const, body: "Just following up — happy to send over our one-pager if useful!", sentAt: day(4) },
      ],
    },
  ]
  for (const c of moreConvos) {
    await prisma.conversation.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id, userId: user.id, channel: c.channel,
        participantName: c.participantName,
        participantEmail: (c as any).participantEmail ?? null,
        participantUrl: (c as any).participantUrl ?? null,
        linkedinProfileId: (c as any).linkedinProfileId ?? null,
        emailThreadKey: (c as any).emailThreadKey ?? null,
        subject: (c as any).subject ?? null,
        leadId: c.leadId ?? null, status: c.status, unread: c.unread,
        labels: c.labels, lastMessageAt: c.lastAt, lastSenderIsMe: c.lastSenderIsMe,
      },
    })
    for (const m of c.msgs) {
      await prisma.message.upsert({
        where: { id: m.id },
        update: {},
        create: { id: m.id, conversationId: c.id, direction: m.direction, body: m.body, sentAt: m.sentAt },
      })
    }
  }
  console.log(`Additional conversations: ${moreConvos.length}`)

  // ─────────────────────────────────────────────────────────────────────────
  // MORE EMAIL MESSAGES — so campaign stats look meaningful
  // ─────────────────────────────────────────────────────────────────────────
  const moreEmails = [
    { id: 'em_7',  to: 'manish.k@paytm.example.com',       subject: 'Paytm outbound strategy', status: 'opened',  sentAt: day(5), openedAt: day(4), repliedAt: null },
    { id: 'em_8',  to: 'aakash.k@vklspices.example.com',   subject: 'VKL Spices sales team',   status: 'opened',  sentAt: day(4), openedAt: day(3), repliedAt: null },
    { id: 'em_9',  to: 'anjali.v@zepto.example.com',       subject: 'Zepto growth idea',       status: 'opened',  sentAt: day(5), openedAt: day(5), repliedAt: null },
    { id: 'em_10', to: 'kunal.s@dream11.example.com',      subject: 'Dream11 growth playbook', status: 'replied', sentAt: day(6), openedAt: day(5), repliedAt: day(3) },
    { id: 'em_11', to: 'deepika.a@nykaa.example.com',      subject: 'Nykaa brand collab idea', status: 'replied', sentAt: day(11), openedAt: day(10), repliedAt: day(10) },
    { id: 'em_12', to: 'vikram.s@razorpay.example.com',    subject: 'Razorpay follow-up',      status: 'opened',  sentAt: day(1),  openedAt: day(1), repliedAt: null },
  ]
  for (const m of moreEmails) {
    await prisma.emailMessage.upsert({
      where: { id: m.id },
      update: {},
      create: {
        id: m.id, userId: user.id, emailAccountId: emailAccount.id,
        to: m.to, subject: m.subject,
        body: `Hi there,\n\nQuick thought on ${m.subject.toLowerCase()}.\n\n— Akhilesh`,
        status: m.status, sentAt: m.sentAt, openedAt: m.openedAt ?? null,
        repliedAt: m.repliedAt ?? null, trackingId: m.id + '_tr',
      },
    })
  }
  console.log(`Additional EmailMessages: ${moreEmails.length}`)

  // ─────────────────────────────────────────────────────────────────────────
  // SECOND WARMUP ACCOUNT — a second inbox mid-ramp
  // ─────────────────────────────────────────────────────────────────────────
  const emailAccount2 = await prisma.emailAccount.upsert({
    where: { id: 'ea_demo_2' },
    update: {},
    create: {
      id: 'ea_demo_2', userId: user.id,
      name: 'Akhilesh (Outreach)',
      email: 'outreach2@demo.example.com',
      provider: 'smtp',
      smtpHost: 'smtp.gmail.com', smtpPort: 587,
      imapHost: 'imap.gmail.com', imapPort: 993,
      dailyLimit: 50, warmupActive: false,
    },
  })
  await prisma.warmupAccount.upsert({
    where: { emailAccountId: emailAccount2.id },
    update: {},
    create: {
      id: 'wa_demo_2', userId: user.id, emailAccountId: emailAccount2.id,
      status: 'active', dailyTarget: 8, currentDay: 6,
      totalSent: 31, totalReceived: 28, totalReplied: 14,
      startedAt: day(6), lastRunAt: day(0),
    },
  })
  console.log('Second WarmupAccount: outreach2@demo.example.com (day 6)')

  // ─────────────────────────────────────────────────────────────────────────
  // MORE LEAD ACTIVITIES — additional events for the patched engagement leads
  // ─────────────────────────────────────────────────────────────────────────
  const moreActs = [
    { id: 'la_25', leadId: 'lead_manish',    type: 'email.sent',    channel: 'email',    source: 'campaign', title: 'Sent email: "Paytm outbound strategy"',     occurredAt: day(5), messageId: 'em_7',  campaignId: 'camp_1' },
    { id: 'la_26', leadId: 'lead_manish',    type: 'email.opened',  channel: 'email',    source: 'system',   title: 'Opened email (×3)',                         occurredAt: day(4), messageId: 'em_7' },
    { id: 'la_27', leadId: 'lead_manish',    type: 'email.clicked', channel: 'email',    source: 'system',   title: 'Clicked link: outreachai.in/demo',          occurredAt: day(4), messageId: 'em_7', payload: { url: 'https://outreachai.in/demo' } },
    { id: 'la_28', leadId: 'lead_manish',    type: 'linkedin.message_sent',    channel: 'linkedin', source: 'extension', title: 'Sent LinkedIn message', occurredAt: day(3), campaignId: 'camp_1' },
    { id: 'la_29', leadId: 'lead_manish',    type: 'linkedin.message_received', channel: 'linkedin', source: 'extension', title: 'Received LinkedIn reply from Manish Kumar', occurredAt: day(1), conversationId: 'conv_li_manish' },
    { id: 'la_30', leadId: 'lead_kunal',                                type: 'email.sent',    channel: 'email',    source: 'campaign', title: 'Sent email: "Dream11 growth playbook"',     occurredAt: day(6), messageId: 'em_10', campaignId: 'camp_1' },
    { id: 'la_31', leadId: 'lead_kunal',                                type: 'email.opened',  channel: 'email',    source: 'system',   title: 'Opened email',                              occurredAt: day(5), messageId: 'em_10' },
    { id: 'la_32', leadId: 'lead_kunal',                                type: 'email.replied', channel: 'email',    source: 'system',   title: 'Replied to email',                          occurredAt: day(3), messageId: 'em_10' },
    { id: 'la_33', leadId: 'lead_kunal',                                type: 'linkedin.message_received', channel: 'linkedin', source: 'extension', title: 'Received LinkedIn message from Kunal Shah', occurredAt: day(3), conversationId: 'conv_li_kunal' },
    { id: 'la_34', leadId: 'lead_deepika',                              type: 'email.sent',    channel: 'email',    source: 'campaign', title: 'Sent email: "Nykaa brand collab idea"',     occurredAt: day(11), messageId: 'em_11', campaignId: 'camp_1' },
    { id: 'la_35', leadId: 'lead_deepika',                              type: 'email.replied', channel: 'email',    source: 'system',   title: 'Replied to email',                          occurredAt: day(10), messageId: 'em_11' },
    { id: 'la_36', leadId: 'lead_aakash',                               type: 'email.sent',    channel: 'email',    source: 'campaign', title: 'Sent email: "VKL Spices sales team"',       occurredAt: day(4), messageId: 'em_8', campaignId: 'camp_1' },
    { id: 'la_37', leadId: 'lead_aakash',                               type: 'email.opened',  channel: 'email',    source: 'system',   title: 'Opened email',                              occurredAt: day(3), messageId: 'em_8' },
    { id: 'la_38', leadId: 'lead_anjali',                               type: 'email.sent',    channel: 'email',    source: 'campaign', title: 'Sent email: "Zepto growth idea"',           occurredAt: day(5), messageId: 'em_9', campaignId: 'camp_1' },
    { id: 'la_39', leadId: 'lead_anjali',                               type: 'email.opened',  channel: 'email',    source: 'system',   title: 'Opened email',                              occurredAt: day(5), messageId: 'em_9' },
    { id: 'la_40', leadId: 'lead_vikram', companyId: 'co_razorpay',    type: 'email.sent',    channel: 'email',    source: 'campaign', title: 'Sent follow-up email',                       occurredAt: day(1), messageId: 'em_12', campaignId: 'camp_1' },
    { id: 'la_41', leadId: 'lead_vikram', companyId: 'co_razorpay',    type: 'email.opened',  channel: 'email',    source: 'system',   title: 'Opened email',                              occurredAt: day(1), messageId: 'em_12' },
    { id: 'la_42', leadId: 'lead_vikram', companyId: 'co_razorpay',    type: 'linkedin.message_received', channel: 'linkedin', source: 'extension', title: 'Received LinkedIn reply — wants demo', occurredAt: day(1), conversationId: 'conv_email_vikram2' },
  ]
  for (const a of moreActs) {
    await prisma.leadActivity.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id, userId: user.id, leadId: a.leadId,
        companyId: (a as any).companyId ?? null,
        type: a.type, channel: (a as any).channel ?? null, source: (a as any).source ?? null,
        title: a.title, body: null, occurredAt: a.occurredAt,
        messageId: (a as any).messageId ?? null,
        conversationId: (a as any).conversationId ?? null,
        campaignId: (a as any).campaignId ?? null,
        taskId: null, actorUserId: null,
        payload: (a as any).payload ?? undefined,
      },
    })
  }
  console.log(`Additional LeadActivities: ${moreActs.length}`)

  console.log('\nSeed complete!')
  console.log('   Login: akhilesh@demo.com / password123')
}

// Export so the one-shot /api/admin/seed route can call it inside the Vercel
// runtime (where DATABASE_URL is injected by the Neon integration).
export { main as seedDemo }

// Auto-run only when invoked directly via `npm run db:seed` (CJS / ts-node).
// When this file is imported by Next.js as ESM, `require` is undefined and the
// block is skipped — the caller invokes seedDemo() explicitly.
if (typeof require !== 'undefined' && require.main === module) {
  main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => prisma.$disconnect())
}
