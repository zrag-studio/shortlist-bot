import {
  KeywordItem,
  MetricCategory,
  ResumeContent,
  TrackPreset,
  TrackPresetId,
} from '../types/resume';

export const EMPTY_RESUME_CONTENT: ResumeContent = {
  header: {
    fullName: '',
    targetTitle: '',
    phone: '',
    email: '',
    location: '',
    linkedinUrl: '',
  },
  summary: '',
  coreExpertise: [],
  tools: [],
  education: [
    {
      id: 'edu-1',
      institution: '',
      location: '',
      degree: '',
      graduationYear: '',
      gpaOrScore: '',
      highlights: [],
    },
  ],
  experience: [],
  projects: [],
  certifications: [],
  virtualExperience: [],
};

// All 27 quantifiable metric categories grounded in the Equity Research Analyst Numbers guide
export const EQUITY_RESEARCH_METRICS: MetricCategory[] = [
  {
    title: 'Financial & Valuation Metrics',
    prompts: [
      'Percentage increase in accuracy of earnings forecasts',
      'ROI (Return on Investment) or average annualized return for stock picks',
      'Accuracy of price targets vs. actual trading price',
      'Historical accuracy of financial models or % reduction in modeling errors',
    ],
  },
  {
    title: 'Coverage & Market Scope',
    prompts: [
      'Number of companies or stocks analyzed / tracked',
      'Number of sectors, industries, or global regions covered',
      'Number of new companies or sectors where you initiated coverage',
      'Average return of coverage universe vs. benchmark index (Nifty 50 / S&P 500)',
    ],
  },
  {
    title: 'Research Reports & Process Efficiency',
    prompts: [
      'Number of research reports authored or co-authored (e.g., 30+ annually)',
      'Publication frequency (weekly, monthly, quarterly earnings notes)',
      'Reduction in research report turnaround or data gathering time (%)',
      'Automation or Excel/Python templates built to cut manual modeling hours',
    ],
  },
  {
    title: 'Investment Calls & Thesis Validation',
    prompts: [
      'Percentage of buy/sell recommendations that outperformed the market',
      'Average holding period for profitable recommendations',
      'Number of investment theses validated by subsequent earnings/market events',
      'Notable sector or macro calls (interest rates, margins, industry tailwinds)',
    ],
  },
  {
    title: 'Client Engagement, Retention & AUM',
    prompts: [
      'Number of client meetings, pitches, or earnings calls attended',
      'Percentage increase in client portfolio value or AUM influenced',
      'Client satisfaction, subscription retention rate, or report readership',
      'Revenue generated or cost savings linked to research insights',
    ],
  },
  {
    title: 'Team Contribution, Rankings & Development',
    prompts: [
      'Analyst ranking within firm, cohort, or case competition',
      'Leadership role in investment club, team size managed, or mentorship',
      'Number of conferences/events presented at and audience size',
      'Relevant certifications & workshops completed (NISM XV, CFA, Valuation)',
    ],
  },
];

export const MBA_FINANCE_METRICS: MetricCategory[] = [
  {
    title: 'Financial Analysis & Reporting',
    prompts: [
      'Number of company financial statements or client accounts audited/analyzed',
      'Budget size tracked or variance % identified across cost centers',
      'Forecast accuracy improvement (%) from 3-statement Excel models',
      'Working capital days or operating cost savings identified (INR/USD or %)',
    ],
  },
  {
    title: 'Corporate Finance, Credit & FP&A',
    prompts: [
      'Number of credit appraisals, loan proposals, or investment memos prepared',
      'Turnaround time reduced (%) for monthly MIS or variance dashboards',
      'Portfolio or deal size evaluated during internship or capstone project',
      'Discrepancies or reconciliation errors caught and resolved (%)',
    ],
  },
  {
    title: 'Campus, Case Competitions & Certifications',
    prompts: [
      'Class rank or GPA percentile (e.g., Top 5%, GPA 8.8/10)',
      'National finance case competition rank out of total participating teams',
      'Finance club fund size or number of workshops organized for batchmates',
      'Certifications earned (NISM, Financial Modeling, Bloomberg BMC, CFA L1)',
    ],
  },
];

export const MBA_MARKETING_METRICS: MetricCategory[] = [
  {
    title: 'Campaign Reach, Engagement & Conversion',
    prompts: [
      'Campaign impressions, reach, or organic engagement growth (%)',
      'Click-Through Rate (CTR), Cost Per Lead (CPL), or ROAS achieved',
      'Number of qualified leads generated or conversion rate lift (%)',
      'Marketing budget managed or optimized during internship/live project',
    ],
  },
  {
    title: 'Market Research & Consumer Insights',
    prompts: [
      'Sample size of customer surveys, interviews, or focus groups conducted',
      'Number of competitors benchmarked across pricing, positioning & channels',
      'Retail outlets, distributors, or B2B accounts surveyed in field research',
      'Customer satisfaction (NPS/CSAT) or retention insight turned into action',
    ],
  },
  {
    title: 'Brand Growth, Content & Campus Impact',
    prompts: [
      'Social media follower growth (%) or number of creatives/reels shipped',
      'Event footfall, sponsorship revenue raised, or club registrations driven',
      'SEO traffic increase (%) or email open/click rate improved',
      'Sales pitch conversion or revenue uplift contributed during summer internship',
    ],
  },
];

export const MBA_HR_METRICS: MetricCategory[] = [
  {
    title: 'Talent Acquisition & Campus Hiring',
    prompts: [
      'Number of resumes screened, interviews scheduled, or candidates sourced',
      'Reduction in Time-to-Hire or Time-to-Fill (days or %)',
      'Offer acceptance ratio (%) or candidate pipeline conversion rate',
      'Number of job portals/campus drives coordinated and positions closed',
    ],
  },
  {
    title: 'Onboarding, Engagement & Retention',
    prompts: [
      'Number of new hires onboarded or induction sessions coordinated',
      'Employee engagement survey response rate (%) or eNPS improvement',
      'Reduction in early attrition (%) or onboarding turnaround time',
      'Training & L&D workshops designed, hours delivered, and feedback score',
    ],
  },
  {
    title: 'HR Operations, Compliance & People Analytics',
    prompts: [
      'Employee records audited or HRIS/ATS entries cleaned for 100% accuracy',
      'HR policy SOPs drafted or grievance resolution SLA improved (%)',
      'Attendance, payroll, or performance appraisal cycles supported (headcount)',
      'HR dashboards built in Excel/Power BI tracking attrition & hiring funnel',
    ],
  },
];

export const TECH_METRICS: MetricCategory[] = [
  {
    title: 'Performance, Scale & Reliability',
    prompts: [
      'API latency or page load time reduced (ms or %)',
      'Number of users, requests/day, or dataset rows processed',
      'Test coverage achieved (%) or production bugs reduced',
      'Database query execution time improved via indexing/caching (%)',
    ],
  },
  {
    title: 'Delivery, Automation & Analytics',
    prompts: [
      'Number of features, endpoints, or dashboards shipped end-to-end',
      'Manual hours saved per week through scripting or CI/CD automation',
      'Model accuracy, precision/recall, or KPI forecast lift (%)',
      'Hackathon placement (e.g., Top 3 of 120 teams) or open-source PRs merged',
    ],
  },
];

export const TRACK_PRESETS: Record<Exclude<TrackPresetId, 'custom'>, TrackPreset> = {
  'mba-finance': {
    id: 'mba-finance',
    name: 'MBA Finance (Fresher)',
    shortName: 'MBA Finance',
    group: 'MBA & Business',
    tagline: 'Corporate finance, FP&A, credit analysis, banking, and campus finance placements.',
    defaultTargetTitle: 'MBA FINANCE | FINANCIAL ANALYSIS & FP&A',
    beginnerHints: {
      educationExample: 'MBA (Finance), XYZ Business School — GPA 8.7/10 (Top 10%)',
      experienceExample: 'Summer Finance Intern — Audited 40+ vendor ledgers & built Excel MIS dashboard',
      projectExample: '3-Statement Financial Model & Ratio Analysis of FMCG Sector Leaders',
      certificationExample: 'NISM Series V-A / Financial Modeling & Valuation Certificate',
    },
    sampleResumeFresher: {
      header: {
        fullName: 'AARAV MEHTA',
        targetTitle: 'MBA FINANCE | FINANCIAL ANALYSIS & CORPORATE FINANCE',
        phone: '+91 98765 43210',
        email: 'aarav.mehta@email.com',
        location: 'Mumbai, India',
        linkedinUrl: 'linkedin.com/in/aaravmehta',
      },
      summary:
        'MBA Finance candidate with strong analytical foundation in **Financial Statement Analysis**, **Financial Modeling**, **Budgeting & Forecasting**, and **Working Capital Management**. Experienced in building automated Excel MIS dashboards and evaluating corporate credit profiles to support **data-driven financial decision-making**.',
      coreExpertise: [
        'Financial Statement Analysis',
        'Financial Modeling',
        'FP&A & Variance Analysis',
        'Corporate Finance',
        'Credit Appraisal',
        'Ratio Analysis',
        'Working Capital Management',
        'DCF Valuation',
        'Risk Assessment',
      ],
      tools: ['MS Excel (Pivot, VLOOKUP, Macros)', 'Power BI', 'PowerPoint', 'Tally Prime', 'SQL (Basic)'],
      education: [
        {
          id: 'edu-fin-1',
          institution: 'National Institute of Management Studies',
          location: 'Mumbai',
          degree: 'MBA in Finance',
          graduationYear: '2026',
          gpaOrScore: 'CGPA: 8.8/10 (Top 10%)',
          highlights: [
            'Core Committee Member, Campus Finance Club — organized valuation bootcamp for 180+ students',
            'National Finalist (Top 5 of 240 teams) in Corporate Finance Case Challenge',
          ],
        },
        {
          id: 'edu-fin-2',
          institution: 'St. Xavier’s College of Commerce',
          location: 'Mumbai',
          degree: 'Bachelor of Commerce (Accounting & Finance)',
          graduationYear: '2024',
          gpaOrScore: '82.4% (First Class with Distinction)',
          highlights: ['Scored 96/100 in Corporate Accounting and Financial Management'],
        },
      ],
      experience: [
        {
          id: 'exp-fin-1',
          organization: 'Meridian Industrial Components Ltd.',
          location: 'Mumbai, India',
          roleTitle: 'Summer Finance Intern — FP&A',
          duration: "May' 2025 - Jul' 2025",
          bullets: [
            'Analyzed monthly **budget vs. actual variance** across 12 manufacturing cost centers to identify overhead leakages, recommending cost controls worth INR 18 Lakhs annually.',
            'Automated weekly **working capital and receivables aging MIS dashboards** in MS Excel and Power BI, reducing manual reporting time by 35% for the CFO office.',
            'Conducted financial statement and liquidity ratio analysis on 25+ key suppliers to strengthen credit-limit evaluation and reduce payment discrepancies.',
          ],
        },
      ],
      projects: [
        {
          id: 'proj-fin-1',
          title: '3-Statement Financial Model & DCF Valuation — Asian Paints Ltd.',
          subtitle: 'MBA Capstone Project',
          bullets: [
            'Built a dynamic 5-year integrated **3-statement financial model** with sensitivity tables for revenue growth and WACC, mastering intrinsic valuation and margin forecasting.',
            'Benchmarked profitability, ROE, and cash conversion cycle against 4 listed peers to produce a 15-page executive investment memo.',
          ],
        },
      ],
      certifications: [
        {
          id: 'cert-fin-1',
          title: 'Financial Modeling & Valuation Program',
          issuerOrYear: '2025',
          bullets: [
            'Completed hands-on training in DCF valuation, relative multiples, financial statement forecasting, and sensitivity modeling in MS Excel.',
          ],
        },
        {
          id: 'cert-fin-2',
          title: 'NISM Series V-A: Mutual Fund Distributors Certification',
          issuerOrYear: '2024',
          bullets: [
            'Gained solid grounding in Indian capital markets, debt/equity asset classes, risk-return metrics, and regulatory compliance.',
          ],
        },
      ],
      virtualExperience: [
        {
          id: 'virt-fin-1',
          title: 'JPMorgan Chase — Corporate Finance & Investment Banking Simulation (Forage)',
          bullets: [
            'Evaluated M&A target financials using comparable company multiples and prepared a concise client advisory slide deck.',
          ],
        },
      ],
    },
    starterKeywords: [
      { term: 'Financial Statement Analysis', category: 'core', frequency: 10, tier: 'must-have', selected: true },
      { term: 'Financial Modeling', category: 'core', frequency: 9, tier: 'must-have', selected: true },
      { term: 'Variance Analysis', category: 'core', frequency: 9, tier: 'must-have', selected: true },
      { term: 'Budgeting & Forecasting', category: 'core', frequency: 8, tier: 'must-have', selected: true },
      { term: 'Corporate Finance', category: 'core', frequency: 8, tier: 'must-have', selected: true },
      { term: 'Working Capital Management', category: 'core', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'DCF Valuation', category: 'core', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'Credit Appraisal', category: 'core', frequency: 6, tier: 'high-frequency', selected: true },
      { term: 'MIS Reporting', category: 'core', frequency: 6, tier: 'high-frequency', selected: true },
      { term: 'Ratio Analysis', category: 'core', frequency: 6, tier: 'high-frequency', selected: true },
      { term: 'MS Excel', category: 'tool', frequency: 10, tier: 'must-have', selected: true },
      { term: 'Power BI', category: 'tool', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'PowerPoint', category: 'tool', frequency: 8, tier: 'must-have', selected: true },
      { term: 'Tally Prime', category: 'tool', frequency: 5, tier: 'differentiator', selected: true },
      { term: 'SQL', category: 'tool', frequency: 5, tier: 'differentiator', selected: false },
    ],
    sampleJds: [
      {
        company: 'Deloitte Advisory',
        roleTitle: 'Financial Analyst — MBA Fresher',
        rawText:
          'We are seeking MBA Finance graduates for Financial Analyst roles. Responsibilities include financial statement analysis, 3-statement financial modeling, budgeting & forecasting, variance analysis, and preparing executive MIS reporting decks. Proficiency in MS Excel (Pivot Tables, VLOOKUP, Macros), PowerPoint, and Power BI is required. Strong understanding of corporate finance, DCF valuation, and working capital management is preferred.',
      },
      {
        company: 'HDFC Corporate Banking',
        roleTitle: 'Management Trainee — Credit & Finance',
        rawText:
          'Assist relationship managers with credit appraisal notes, ratio analysis, cash flow projections, and risk assessment of corporate borrowers. Analyze balance sheets, P&L statements, and industry benchmarks. Strong analytical skills, MS Excel financial modeling, and stakeholder communication essential.',
      },
      {
        company: 'Tata Consumer Products',
        roleTitle: 'FP&A Finance Trainee',
        rawText:
          'Support commercial finance and FP&A teams on monthly variance analysis, cost center budgeting, gross margin tracking, and working capital optimization. Build automated Excel and Power BI dashboards for leadership decision-making.',
      },
    ],
    metricCategories: MBA_FINANCE_METRICS,
  },

  'equity-research': {
    id: 'equity-research',
    name: 'Equity Research Analyst',
    shortName: 'Equity Research',
    group: 'Finance Specialist',
    tagline: 'Valuation, DCF modeling, initiating coverage reports, and buy/sell-side research.',
    defaultTargetTitle: 'EQUITY RESEARCH',
    beginnerHints: {
      educationExample: 'MBA Finance / CFA Level 1 / B.Com — GPA 9.1/10 (Rank 3/250)',
      experienceExample: 'Equity Research Intern — Authored 12+ sector notes & built DCF valuation models',
      projectExample: 'Initiating Coverage Equity Research Report on Avenue Supermarts (DMart)',
      certificationExample: 'NISM XV Research Analyst Certification / The Valuation School Bootcamp',
    },
    sampleResumeFresher: {
      header: {
        fullName: 'SAHAJ BANA',
        targetTitle: 'EQUITY RESEARCH',
        phone: '+91 98765 43210',
        email: 'sahaj.bana@email.com',
        location: 'Mumbai, India',
        linkedinUrl: 'linkedin.com/in/sahajbana',
      },
      summary:
        'Equity Research Enthusiast with a strong foundation in **Equity Research**, researching securities, analyzing market trends, and providing actionable investment recommendations. Adept at **developing and presenting comprehensive research reports** that drive strategic investment choices and maintaining a deep understanding of the **financial services industry**.',
      coreExpertise: [
        'Equity Research',
        'Financial Statement Analysis',
        'Industry Analysis',
        'Company Analysis',
        'Financial Modeling',
        'DCF & Relative Valuation',
        'Equity Markets',
        'Portfolio Management',
        'Stakeholder Management',
      ],
      tools: ['MS Excel (Advanced Modeling)', 'Screener.in', 'Bloomberg / Capital IQ', 'PowerPoint', 'Python (Basic)'],
      education: [
        {
          id: 'edu-er-1',
          institution: 'ABC Institute of Management',
          location: 'Mumbai',
          degree: 'MBA in Finance',
          graduationYear: '2025',
          gpaOrScore: 'GPA: 9.1/10 (Rank 3/250)',
          highlights: ['GMAT: 760 (Q50, V44 | 99%tile); CAT: 99+%tile'],
        },
        {
          id: 'edu-er-2',
          institution: 'XYZ College of Management',
          location: 'Delhi',
          degree: 'B.Com (Honours)',
          graduationYear: '2023',
          gpaOrScore: 'GPA: 7.47/10 (Top 5%)',
          highlights: ['Highest Grade (10/10) in Final Year Equity Valuation Project'],
        },
      ],
      experience: [
        {
          id: 'exp-er-1',
          organization: 'Apex Broking & Research',
          location: 'Mumbai, India',
          roleTitle: 'Equity Research Intern',
          duration: "Jan' 2025 - Present",
          bullets: [
            'Conducted in-depth **research on securities** across 15+ mid-cap retail and FMCG firms to deliver actionable investment recommendations, contributing to a **15% increase in profitable calls**.',
            'Developed comprehensive **research reports** and quarterly earnings updates for presentation to senior analysts and institutional clients.',
            'Produced **30+ company notes and financial models** annually using advanced MS Excel, cutting peer-benchmarking turnaround time by 25%.',
          ],
        },
        {
          id: 'exp-er-2',
          organization: 'Vanguard Audit Partners',
          location: 'Mumbai, India',
          roleTitle: 'Financial Analysis Intern',
          duration: "May' 2024 - Dec' 2024",
          bullets: [
            'Conducted comprehensive **financial statement analysis** and audits for 40+ clients across diverse sectors, identifying KPI trends, margin shifts, and accounting discrepancies.',
            'Utilized advanced Excel skills to analyze company financials, assess investment opportunities, and formulate concise management summaries.',
          ],
        },
      ],
      projects: [
        {
          id: 'proj-er-1',
          title: 'Equity Research — Initiating Coverage on Avenue Supermarts (DMart)',
          subtitle: 'Independent Valuation & Industry Benchmarking Report',
          bullets: [
            'Conducted comprehensive **Equity Research** encompassing 3-statement financial modeling, DCF & EV/EBITDA valuation, and retail industry benchmarking to derive a defensible target price.',
            'Analyzed store-unit economics, same-store sales growth, and macroeconomic drivers to highlight key upside catalysts and downside risks.',
          ],
        },
      ],
      certifications: [
        {
          id: 'cert-er-1',
          title: "Equity Research Certificate — The Valuation School",
          issuerOrYear: '2025',
          bullets: [
            'Gained hands-on experience in quantitative analysis, building DCF investment models, and analyzing stocks to assist portfolio managers.',
            'Mastered Financial Statement Analysis, Industry Analysis, Company Analysis, Risk & Return fundamentals, Valuation Principles, and Corporate Actions.',
          ],
        },
        {
          id: 'cert-er-2',
          title: 'NISM XV — Research Analyst Certification',
          issuerOrYear: '2024',
          bullets: [
            'Mastered Indian Securities Markets terminologies, top-down and bottom-up fundamental research frameworks, micro/macro-economic indicators, and SEBI research report standards.',
          ],
        },
      ],
      virtualExperience: [
        {
          id: 'virt-er-1',
          title: 'JPMorgan Chase — Markets (Sales & Trading)',
          bullets: [
            'Conducted in-depth analysis of market conditions to identify trade opportunities and presented a tailored investment idea highlighting tactical reasoning and analytical rigor.',
          ],
        },
      ],
    },
    sampleResumeSwitcher: {
      header: {
        fullName: 'SAHAJ BANA',
        targetTitle: 'EQUITY RESEARCH ANALYST',
        phone: '+91 98765 43210',
        email: 'sahaj.bana@email.com',
        location: 'Mumbai, India',
        linkedinUrl: 'linkedin.com/in/sahajbana',
      },
      summary:
        'Finance professional transitioning into **Equity Research** with proven expertise in **financial statement analysis**, **DCF modeling**, and **industry benchmarking**. Track record of analyzing 100+ corporate financials, authoring 30+ structured research notes, and delivering actionable insights for senior management and institutional stakeholders.',
      coreExpertise: [
        'Equity Research',
        'Investment Banking',
        'Financial Statement Analysis',
        'Industry Analysis',
        'Company Analysis',
        'DCF Valuation',
        'Equity Markets',
        'Portfolio Management',
        'Stakeholder Management',
      ],
      tools: ['MS Excel (DCF & 3-Statement)', 'Bloomberg', 'Screener.in', 'PowerPoint', 'SQL'],
      education: [
        {
          id: 'edu-ers-1',
          institution: 'ABC Institute of Management',
          location: 'Mumbai',
          degree: 'MBA in Finance',
          graduationYear: '2023',
          gpaOrScore: 'GPA: 9.1/10 (Rank 3/250)',
          highlights: ['GMAT: 760 (Q50, V44 | 99%tile); CAT: 99+%tile'],
        },
      ],
      experience: [
        {
          id: 'exp-ers-1',
          organization: 'KPMG / Audit Advisory',
          location: 'Mumbai, India',
          roleTitle: 'Audit Associate',
          duration: "Jan' 2024 - Present",
          bullets: [
            'Conducted comprehensive **financial statement analysis** and statutory audits for **100+ clients** across manufacturing and retail sectors, developing sharp accuracy in spotting KPI trends and earnings quality red flags.',
            'Utilized advanced MS Excel models to benchmark company financials, evaluate capital allocation efficiency, and present actionable recommendations to senior partners.',
          ],
        },
        {
          id: 'exp-ers-2',
          organization: 'Apex Securities',
          location: 'Mumbai, India',
          roleTitle: 'Equity Research Analyst',
          duration: "Jan' 2022 - Dec' 2023",
          bullets: [
            'Conducted in-depth **research on securities** within target industries to deliver high-conviction investment calls, driving a **15% increase in profitable recommendations**.',
            'Authored **30+ comprehensive research reports** and quarterly earnings models annually for senior management and institutional clients.',
          ],
        },
      ],
      projects: [
        {
          id: 'proj-ers-1',
          title: 'Equity Research — Initiating Coverage on Avenue Supermarts (DMart)',
          subtitle: 'Valuation & Industry Benchmarking',
          bullets: [
            'Conducted bottom-up Equity Research covering financial statement analysis, DCF valuation, and competitive moat benchmarking for investment committee review.',
          ],
        },
      ],
      certifications: [
        {
          id: 'cert-ers-1',
          title: 'NISM XV — Research Analyst Certification',
          issuerOrYear: '2024',
          bullets: [
            'Certified in fundamental top-down/bottom-up equity research, securities valuation, macroeconomic analysis, and regulatory research report guidelines.',
          ],
        },
      ],
      virtualExperience: [
        {
          id: 'virt-ers-1',
          title: 'JPMorgan Chase — Markets (Sales & Trading)',
          bullets: [
            'Analyzed macro market shifts and pitched a structured trade thesis backed by quantitative risk-return metrics.',
          ],
        },
      ],
    },
    starterKeywords: [
      { term: 'Equity Research', category: 'core', frequency: 10, tier: 'must-have', selected: true },
      { term: 'Financial Modeling', category: 'core', frequency: 10, tier: 'must-have', selected: true },
      { term: 'Financial Statement Analysis', category: 'core', frequency: 10, tier: 'must-have', selected: true },
      { term: 'DCF Valuation', category: 'core', frequency: 9, tier: 'must-have', selected: true },
      { term: 'Industry Analysis', category: 'core', frequency: 8, tier: 'must-have', selected: true },
      { term: 'Research Reports', category: 'core', frequency: 8, tier: 'must-have', selected: true },
      { term: 'Earnings Forecasts', category: 'core', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'Relative Valuation', category: 'core', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'Investment Recommendations', category: 'core', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'Portfolio Management', category: 'core', frequency: 6, tier: 'high-frequency', selected: true },
      { term: 'MS Excel', category: 'tool', frequency: 10, tier: 'must-have', selected: true },
      { term: 'Bloomberg', category: 'tool', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'Capital IQ', category: 'tool', frequency: 6, tier: 'high-frequency', selected: true },
      { term: 'PowerPoint', category: 'tool', frequency: 8, tier: 'must-have', selected: true },
      { term: 'Python', category: 'tool', frequency: 4, tier: 'differentiator', selected: false },
    ],
    sampleJds: [
      {
        company: 'Motilal Oswal Institutional Equities',
        roleTitle: 'Equity Research Associate',
        rawText:
          'Build and maintain 3-statement financial models, DCF valuation, and relative valuation multiples for covered companies. Author initiating coverage research reports, quarterly earnings previews/reviews, and sector thematic notes. Track industry trends, attend management earnings calls, and deliver actionable investment recommendations. Strong MS Excel, Bloomberg/Capital IQ, and NISM XV or CFA progress preferred.',
      },
      {
        company: 'Goldman Sachs Global Investment Research',
        roleTitle: 'Equity Research Analyst',
        rawText:
          'Perform rigorous financial statement analysis, company analysis, and industry benchmarking across covered stocks. Prepare earnings forecasts, valuation models, and concise institutional research reports. Collaborate with portfolio managers and senior analysts to communicate investment theses clearly.',
      },
      {
        company: 'Crisil Research',
        roleTitle: 'Senior Research Analyst — Equity',
        rawText:
          'Analyze listed equities using bottom-up fundamental research, macroeconomic variables, and sector drivers. Prepare financial models in Excel, maintain valuation databases, and write clear research publications for clients.',
      },
    ],
    metricCategories: EQUITY_RESEARCH_METRICS,
  },

  'mba-marketing': {
    id: 'mba-marketing',
    name: 'MBA Marketing (Fresher)',
    shortName: 'MBA Marketing',
    group: 'MBA & Business',
    tagline: 'Brand management, digital marketing, consumer research, and B2B/B2C growth.',
    defaultTargetTitle: 'MBA MARKETING | BRAND & DIGITAL GROWTH',
    beginnerHints: {
      educationExample: 'MBA (Marketing), Symbiosis / NMIMS — CGPA 8.5/10',
      experienceExample: 'Marketing Intern — Ran Meta/Google ad campaign generating 450+ leads at 22% lower CPL',
      projectExample: 'Consumer Buying Behavior & Go-to-Market Strategy for D2C Skincare Brand',
      certificationExample: 'Google Digital Marketing & E-commerce / Meta Social Media Marketing',
    },
    sampleResumeFresher: {
      header: {
        fullName: 'PRIYA NAIR',
        targetTitle: 'MBA MARKETING | BRAND MANAGEMENT & DIGITAL GROWTH',
        phone: '+91 98201 55432',
        email: 'priya.nair@email.com',
        location: 'Bengaluru, India',
        linkedinUrl: 'linkedin.com/in/priyanair',
      },
      summary:
        'MBA Marketing fresher with hands-on exposure to **Brand Management**, **Digital Marketing**, **Market Research**, and **Go-to-Market (GTM) Strategy**. Proven ability to translate primary consumer insights and campaign analytics into **higher lead conversion, brand awareness, and measurable customer acquisition**.',
      coreExpertise: [
        'Brand Management',
        'Digital Marketing',
        'Market Research',
        'Go-to-Market (GTM) Strategy',
        'Performance Marketing',
        'Consumer Behavior Analysis',
        'Campaign Analytics',
        'Competitor Benchmarking',
        'B2B & B2C Lead Generation',
      ],
      tools: ['Google Analytics (GA4)', 'Meta Ads Manager', 'MS Excel', 'PowerPoint', 'Canva', 'HubSpot CRM'],
      education: [
        {
          id: 'edu-mkt-1',
          institution: 'Symbiosis Institute of Business Management',
          location: 'Bengaluru',
          degree: 'MBA in Marketing',
          graduationYear: '2026',
          gpaOrScore: 'CGPA: 8.6/10 (Top 15%)',
          highlights: [
            'Head of Sponsorships, Marketing Club — raised INR 4.5 Lakhs from 8 corporate partners',
            'Winner (1st of 140 teams) in National FMCG Brand Launch Case Competition',
          ],
        },
        {
          id: 'edu-mkt-2',
          institution: 'Christ University',
          location: 'Bengaluru',
          degree: 'BBA (Marketing Specialization)',
          graduationYear: '2024',
          gpaOrScore: '84.2%',
          highlights: ['Led 18-member campus publicity team driving 2,200+ fest registrations'],
        },
      ],
      experience: [
        {
          id: 'exp-mkt-1',
          organization: 'FreshLeaf D2C Wellness',
          location: 'Bengaluru, India',
          roleTitle: 'Summer Marketing Intern',
          duration: "Apr' 2025 - Jun' 2025",
          bullets: [
            'Executed A/B-tested **Meta and Google Search ad campaigns** across 4 target cohorts to scale top-of-funnel acquisition, generating **620+ qualified leads** while lowering Cost Per Lead by **24%**.',
            'Conducted primary **market research** across 180+ urban shoppers and 6 competitor brands to refine product pricing tiers, informing the Q3 launch messaging.',
            'Redesigned email onboarding and retargeting sequences in HubSpot CRM, lifting repeat click-through rate from 3.2% to **5.8%** within 6 weeks.',
          ],
        },
      ],
      projects: [
        {
          id: 'proj-mkt-1',
          title: 'Go-to-Market & Channel Expansion Strategy — Regional EV Mobility Brand',
          subtitle: 'MBA Live Industry Project',
          bullets: [
            'Surveyed 250+ commuters and 15 dealership managers to map adoption barriers, building a 3-month omnichannel launch roadmap with projected 18% lead uplift.',
            'Learned structured STP (Segmentation, Targeting, Positioning) frameworks and channel ROI modeling in MS Excel.',
          ],
        },
      ],
      certifications: [
        {
          id: 'cert-mkt-1',
          title: 'Google Analytics (GA4) & Digital Marketing Certification',
          issuerOrYear: '2025',
          bullets: [
            'Built hands-on fluency in funnel attribution, audience segmentation, SEO fundamentals, and campaign ROAS measurement.',
          ],
        },
      ],
      virtualExperience: [
        {
          id: 'virt-mkt-1',
          title: 'Red Bull — Off-Premise Sales & Brand Activation Simulation (Forage)',
          bullets: [
            'Analyzed retail shelf velocity data and crafted a promotional pitch deck to boost store-level visibility.',
          ],
        },
      ],
    },
    starterKeywords: [
      { term: 'Brand Management', category: 'core', frequency: 10, tier: 'must-have', selected: true },
      { term: 'Digital Marketing', category: 'core', frequency: 10, tier: 'must-have', selected: true },
      { term: 'Market Research', category: 'core', frequency: 9, tier: 'must-have', selected: true },
      { term: 'Go-to-Market (GTM) Strategy', category: 'core', frequency: 8, tier: 'must-have', selected: true },
      { term: 'Campaign Analytics', category: 'core', frequency: 8, tier: 'must-have', selected: true },
      { term: 'Performance Marketing', category: 'core', frequency: 8, tier: 'high-frequency', selected: true },
      { term: 'Consumer Insights', category: 'core', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'Lead Generation', category: 'core', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'Competitor Benchmarking', category: 'core', frequency: 6, tier: 'high-frequency', selected: true },
      { term: 'SEO & SEM', category: 'core', frequency: 6, tier: 'high-frequency', selected: true },
      { term: 'Google Analytics (GA4)', category: 'tool', frequency: 9, tier: 'must-have', selected: true },
      { term: 'Meta Ads Manager', category: 'tool', frequency: 8, tier: 'must-have', selected: true },
      { term: 'MS Excel', category: 'tool', frequency: 9, tier: 'must-have', selected: true },
      { term: 'HubSpot CRM', category: 'tool', frequency: 6, tier: 'differentiator', selected: true },
      { term: 'Canva', category: 'tool', frequency: 6, tier: 'differentiator', selected: true },
    ],
    sampleJds: [
      {
        company: 'Hindustan Unilever (HUL)',
        roleTitle: 'Management Trainee — Brand & Marketing',
        rawText:
          'Drive brand management, consumer insights, and go-to-market strategy across key consumer categories. Conduct market research, competitor benchmarking, and digital marketing activations. Analyze campaign analytics, retail trade performance, and ROI using MS Excel and PowerPoint.',
      },
      {
        company: 'Swiggy Growth',
        roleTitle: 'Associate Marketing Manager — Fresher',
        rawText:
          'Manage performance marketing, CRM retention campaigns, and city-level growth experiments. Track CTR, ROAS, CAC, and conversion funnels in Google Analytics (GA4) and Meta Ads Manager. Collaborate with creative and product teams to improve lead generation and user activation.',
      },
      {
        company: 'Zoho Corp',
        roleTitle: 'Product Marketing Associate (MBA)',
        rawText:
          'Conduct primary customer research, build positioning messaging, optimize SEO & SEM landing pages, and run B2B lead generation webinars. Hands-on familiarity with HubSpot CRM, GA4, and content analytics is a plus.',
      },
    ],
    metricCategories: MBA_MARKETING_METRICS,
  },

  'mba-hr': {
    id: 'mba-hr',
    name: 'MBA HR (Fresher)',
    shortName: 'MBA HR',
    group: 'MBA & Business',
    tagline: 'Talent acquisition, HR operations, employee engagement, L&D, and people analytics.',
    defaultTargetTitle: 'MBA HUMAN RESOURCES | TALENT ACQUISITION & HR OPERATIONS',
    beginnerHints: {
      educationExample: 'MBA (Human Resource Management), XLRI / TISS / Symbiosis — CGPA 8.6/10',
      experienceExample: 'HR Intern — Screened 350+ resumes, coordinated 60+ interviews & cut onboarding time by 20%',
      projectExample: 'Attrition Root-Cause & Employee Engagement Study across 150+ IT Employees',
      certificationExample: 'SHRM HR Fundamentals / People Analytics in Excel & Power BI',
    },
    sampleResumeFresher: {
      header: {
        fullName: 'ANANYA SHARMA',
        targetTitle: 'MBA HUMAN RESOURCES | TALENT ACQUISITION & HR OPERATIONS',
        phone: '+91 98112 77890',
        email: 'ananya.sharma@email.com',
        location: 'Pune, India',
        linkedinUrl: 'linkedin.com/in/ananyasharma',
      },
      summary:
        'MBA Human Resources graduate skilled in **End-to-End Talent Acquisition**, **Employee Onboarding**, **HR Operations**, and **People Analytics**. Experienced in managing high-volume candidate pipelines, designing structured engagement initiatives, and streamlining **HRIS workflows to improve hiring speed and employee experience**.',
      coreExpertise: [
        'Talent Acquisition',
        'End-to-End Recruitment',
        'Employee Onboarding',
        'HR Operations',
        'Employee Engagement',
        'Performance Management',
        'Learning & Development (L&D)',
        'People Analytics',
        'HR Policy & Compliance',
      ],
      tools: ['MS Excel (VLOOKUP, Pivot, Dashboards)', 'LinkedIn Recruiter', 'Naukri / ATS Portals', 'PowerPoint', 'Power BI'],
      education: [
        {
          id: 'edu-hr-1',
          institution: 'Symbiosis Centre for Management & HRD',
          location: 'Pune',
          degree: 'MBA in Human Resource Management',
          graduationYear: '2026',
          gpaOrScore: 'CGPA: 8.7/10 (Top 10%)',
          highlights: [
            'Placement Committee Coordinator — coordinated campus hiring drives for 35+ recruiters',
            'Runner-Up in National HR Strategy & Industrial Relations Case Challenge',
          ],
        },
        {
          id: 'edu-hr-2',
          institution: 'Delhi University',
          location: 'New Delhi',
          degree: 'B.A. (Honours) Psychology',
          graduationYear: '2024',
          gpaOrScore: '81.6%',
          highlights: ['President, Student Counseling & Peer Mentorship Cell (120+ student members)'],
        },
      ],
      experience: [
        {
          id: 'exp-hr-1',
          organization: 'Vertex Digital Solutions',
          location: 'Pune, India',
          roleTitle: 'Summer HR Intern — Talent Acquisition & Operations',
          duration: "May' 2025 - Jul' 2025",
          bullets: [
            'Sourced and screened **380+ profiles** across LinkedIn and Naukri for 14 tech and business roles, coordinating 65+ panel interviews and helping reduce **Time-to-Fill by 18%**.',
            'Streamlined the pre-boarding documentation checklist for **45 campus new hires**, improving Day-1 onboarding readiness to **98%** and boosting new-hire feedback scores.',
            'Built an Excel **People Analytics tracker** monitoring recruitment funnel conversion and early-tenure feedback across 4 business units for weekly HRBP reviews.',
          ],
        },
      ],
      projects: [
        {
          id: 'proj-hr-1',
          title: 'Early-Tenure Attrition & Employee Engagement Diagnostic Study',
          subtitle: 'MBA HR Capstone Project',
          bullets: [
            'Designed and analyzed a structured engagement survey across **160+ early-career employees**, pinpointing onboarding clarity and manager check-ins as top retention drivers.',
            'Recommended a 30-60-90 day buddy framework and gained practical proficiency in HR metrics, survey analysis, and labor compliance fundamentals.',
          ],
        },
      ],
      certifications: [
        {
          id: 'cert-hr-1',
          title: 'HR Analytics & Talent Management Certification',
          issuerOrYear: '2025',
          bullets: [
            'Applied workforce planning metrics, hiring funnel analytics, compensation benchmarking, and employee retention dashboards in Excel.',
          ],
        },
      ],
      virtualExperience: [
        {
          id: 'virt-hr-1',
          title: 'GE Aerospace — Explore Human Resources Job Simulation (Forage)',
          bullets: [
            'Completed organizational design, talent review calibration, and employee relations conflict-resolution exercises.',
          ],
        },
      ],
    },
    starterKeywords: [
      { term: 'Talent Acquisition', category: 'core', frequency: 10, tier: 'must-have', selected: true },
      { term: 'HR Operations', category: 'core', frequency: 10, tier: 'must-have', selected: true },
      { term: 'Employee Onboarding', category: 'core', frequency: 9, tier: 'must-have', selected: true },
      { term: 'Employee Engagement', category: 'core', frequency: 9, tier: 'must-have', selected: true },
      { term: 'End-to-End Recruitment', category: 'core', frequency: 8, tier: 'must-have', selected: true },
      { term: 'Performance Management', category: 'core', frequency: 8, tier: 'high-frequency', selected: true },
      { term: 'People Analytics', category: 'core', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'Learning & Development', category: 'core', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'HR Policy & Compliance', category: 'core', frequency: 6, tier: 'high-frequency', selected: true },
      { term: 'Stakeholder Management', category: 'core', frequency: 6, tier: 'high-frequency', selected: true },
      { term: 'MS Excel', category: 'tool', frequency: 10, tier: 'must-have', selected: true },
      { term: 'LinkedIn Recruiter', category: 'tool', frequency: 8, tier: 'must-have', selected: true },
      { term: 'HRIS / ATS', category: 'tool', frequency: 8, tier: 'must-have', selected: true },
      { term: 'PowerPoint', category: 'tool', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'Power BI', category: 'tool', frequency: 5, tier: 'differentiator', selected: true },
    ],
    sampleJds: [
      {
        company: 'Deloitte India',
        roleTitle: 'HR Analyst — Talent & Operations (MBA Fresher)',
        rawText:
          'Support end-to-end talent acquisition, campus hiring coordination, employee onboarding, and HR operations. Maintain accurate HRIS / ATS candidate trackers, generate people analytics dashboards in MS Excel and Power BI, and partner with HRBPs on employee engagement and performance management cycles.',
      },
      {
        company: 'Infosys HR',
        roleTitle: 'Associate HR Business Partner (MBA HR)',
        rawText:
          'Drive employee engagement programs, learning & development (L&D) interventions, HR policy compliance, and grievance resolution. Track attrition metrics, conduct exit interviews, and collaborate with business leaders on workforce planning.',
      },
      {
        company: 'Wipro Talent Acquisition',
        roleTitle: 'Management Trainee — Human Resources',
        rawText:
          'Manage full-cycle recruitment using LinkedIn Recruiter and ATS tools, screen candidates against job descriptions, coordinate interview panels, and optimize time-to-fill and offer conversion ratios.',
      },
    ],
    metricCategories: MBA_HR_METRICS,
  },

  'tech-swe': {
    id: 'tech-swe',
    name: 'Software Engineer (Fresher)',
    shortName: 'Software Eng',
    group: 'Tech',
    tagline: 'Full-stack, backend, and campus software development roles.',
    defaultTargetTitle: 'SOFTWARE ENGINEER | FULL-STACK DEVELOPMENT',
    beginnerHints: {
      educationExample: 'B.Tech Computer Science, NIT / State Univ — CGPA 8.6/10',
      experienceExample: 'SWE Intern — Built REST APIs in Node.js cutting response latency by 30%',
      projectExample: 'Real-Time Expense Tracker using React, TypeScript & PostgreSQL',
      certificationExample: 'AWS Cloud Practitioner / Meta Front-End Developer Certificate',
    },
    sampleResumeFresher: {
      header: {
        fullName: 'ROHAN KULKARNI',
        targetTitle: 'SOFTWARE ENGINEER | FULL-STACK & BACKEND',
        phone: '+91 97654 11223',
        email: 'rohan.kulkarni@email.com',
        location: 'Hyderabad, India',
        linkedinUrl: 'linkedin.com/in/rohankulkarni',
      },
      summary:
        'Computer Science graduate specializing in **Full-Stack Web Development**, **REST API Design**, **TypeScript**, and **SQL Databases**. Experienced in shipping responsive production web applications with clean architecture, automated testing, and **measurable latency and reliability improvements**.',
      coreExpertise: [
        'Full-Stack Development',
        'REST API Design',
        'Data Structures & Algorithms',
        'Relational Database Design',
        'System Design Fundamentals',
        'Agile Development',
        'Unit & Integration Testing',
      ],
      tools: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Python', 'Git & GitHub', 'Docker'],
      education: [
        {
          id: 'edu-swe-1',
          institution: 'National Institute of Technology',
          location: 'Warangal',
          degree: 'B.Tech in Computer Science & Engineering',
          graduationYear: '2026',
          gpaOrScore: 'CGPA: 8.7/10',
          highlights: [
            'Solved 450+ DSA problems on LeetCode; Top 3 finalist in Smart India Hackathon',
          ],
        },
      ],
      experience: [
        {
          id: 'exp-swe-1',
          organization: 'CloudScale Labs',
          location: 'Hyderabad, India',
          roleTitle: 'Software Engineering Intern',
          duration: "May' 2025 - Jul' 2025",
          bullets: [
            'Engineered **12+ RESTful API endpoints** in Node.js and TypeScript with indexed PostgreSQL queries, reducing p95 dashboard load latency by **38%**.',
            'Built reusable React form and analytics modules with Jest unit test coverage above **85%**, cutting QA regression bugs by 30%.',
          ],
        },
      ],
      projects: [
        {
          id: 'proj-swe-1',
          title: 'Campus Placement Portal & Resume Tracker',
          subtitle: 'React, TypeScript, Express, SQLite',
          bullets: [
            'Developed a role-based placement portal serving 400+ students with real-time application status tracking and CSV export, strengthening full-stack security and SQL schema design skills.',
          ],
        },
      ],
      certifications: [
        {
          id: 'cert-swe-1',
          title: 'AWS Certified Cloud Practitioner',
          issuerOrYear: '2025',
          bullets: [
            'Validated cloud architecture, IAM security, serverless deployment, and database hosting best practices.',
          ],
        },
      ],
      virtualExperience: [],
    },
    starterKeywords: [
      { term: 'Full-Stack Development', category: 'core', frequency: 10, tier: 'must-have', selected: true },
      { term: 'REST API Design', category: 'core', frequency: 9, tier: 'must-have', selected: true },
      { term: 'Data Structures & Algorithms', category: 'core', frequency: 9, tier: 'must-have', selected: true },
      { term: 'Database Design', category: 'core', frequency: 8, tier: 'must-have', selected: true },
      { term: 'Agile Development', category: 'core', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'Unit Testing', category: 'core', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'TypeScript', category: 'tool', frequency: 9, tier: 'must-have', selected: true },
      { term: 'React', category: 'tool', frequency: 9, tier: 'must-have', selected: true },
      { term: 'Node.js', category: 'tool', frequency: 8, tier: 'must-have', selected: true },
      { term: 'SQL', category: 'tool', frequency: 9, tier: 'must-have', selected: true },
      { term: 'Python', category: 'tool', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'Git', category: 'tool', frequency: 9, tier: 'must-have', selected: true },
      { term: 'Docker', category: 'tool', frequency: 6, tier: 'differentiator', selected: true },
    ],
    sampleJds: [
      {
        company: 'Atlassian',
        roleTitle: 'Graduate Software Engineer',
        rawText:
          'Build scalable web applications using TypeScript, React, Node.js, and SQL databases. Design reliable REST APIs, write clean unit and integration tests, apply strong data structures & algorithms fundamentals, and collaborate in Agile teams using Git and Docker.',
      },
      {
        company: 'Razorpay',
        roleTitle: 'Software Development Engineer — I',
        rawText:
          'Develop high-throughput backend microservices and intuitive frontend interfaces. Focus on database design, API latency optimization, code reviews, and automated CI/CD pipelines.',
      },
    ],
    metricCategories: TECH_METRICS,
  },

  'tech-data': {
    id: 'tech-data',
    name: 'Data / Business Analyst',
    shortName: 'Data Analyst',
    group: 'Tech',
    tagline: 'SQL, BI dashboards, business analytics, and data-driven consulting.',
    defaultTargetTitle: 'DATA & BUSINESS ANALYST | SQL & BI REPORTING',
    beginnerHints: {
      educationExample: 'MBA Business Analytics / B.Tech — CGPA 8.6/10',
      experienceExample: 'Data Analyst Intern — Automated Power BI KPI dashboard saving 10 hrs/week',
      projectExample: 'E-Commerce Customer Churn & Cohort Retention Analysis (SQL + Python)',
      certificationExample: 'Google Data Analytics / Microsoft Power BI Data Analyst',
    },
    sampleResumeFresher: {
      header: {
        fullName: 'KABIR VERMA',
        targetTitle: 'BUSINESS & DATA ANALYST | SQL, PYTHON & POWER BI',
        phone: '+91 98450 33119',
        email: 'kabir.verma@email.com',
        location: 'Gurugram, India',
        linkedinUrl: 'linkedin.com/in/kabirverma',
      },
      summary:
        'Analytical graduate trained in **SQL Querying**, **Business Intelligence Dashboards**, **Statistical Analysis**, and **KPI Reporting**. Experienced in cleaning large operational datasets and translating trends into **clear executive recommendations that reduce costs and improve conversion**.',
      coreExpertise: [
        'Data Cleaning & Transformation',
        'KPI Dashboarding',
        'Business Requirements Analysis',
        'Cohort & Funnel Analysis',
        'A/B Testing',
        'Statistical Analysis',
        'Stakeholder Reporting',
      ],
      tools: ['SQL (PostgreSQL / MySQL)', 'Power BI', 'MS Excel (Power Query)', 'Python (Pandas)', 'Tableau'],
      education: [
        {
          id: 'edu-da-1',
          institution: 'Institute of Management Technology',
          location: 'Ghaziabad',
          degree: 'PGDM / MBA in Business Analytics',
          graduationYear: '2026',
          gpaOrScore: 'CGPA: 8.5/10',
          highlights: ['Top 5% in Applied Statistics and Predictive Modeling coursework'],
        },
      ],
      experience: [
        {
          id: 'exp-da-1',
          organization: 'QuickCart Logistics',
          location: 'Gurugram, India',
          roleTitle: 'Business Analytics Intern',
          duration: "May' 2025 - Jul' 2025",
          bullets: [
            'Queried **500K+ order fulfillment records** in SQL to isolate regional delivery bottlenecks, informing route adjustments that improved on-time delivery by **7.5%**.',
            'Designed an interactive **Power BI executive KPI dashboard** tracking SLA compliance and cancellation reasons, saving operations leads 8 hours/week in manual Excel compilation.',
          ],
        },
      ],
      projects: [
        {
          id: 'proj-da-1',
          title: 'SaaS Customer Churn & Cohort Retention Analysis',
          subtitle: 'SQL, Python (Pandas) & Power BI',
          bullets: [
            'Cleaned and segmented 40K+ subscription logs to identify high-churn onboarding milestones, learning cohort retention modeling and executive storytelling.',
          ],
        },
      ],
      certifications: [
        {
          id: 'cert-da-1',
          title: 'Microsoft Power BI & Google Data Analytics Certificate',
          issuerOrYear: '2025',
          bullets: [
            'Built end-to-end DAX data models, SQL aggregations, and automated business performance dashboards.',
          ],
        },
      ],
      virtualExperience: [],
    },
    starterKeywords: [
      { term: 'SQL Querying', category: 'core', frequency: 10, tier: 'must-have', selected: true },
      { term: 'KPI Dashboarding', category: 'core', frequency: 9, tier: 'must-have', selected: true },
      { term: 'Data Cleaning', category: 'core', frequency: 9, tier: 'must-have', selected: true },
      { term: 'Business Requirements Analysis', category: 'core', frequency: 8, tier: 'must-have', selected: true },
      { term: 'Funnel & Cohort Analysis', category: 'core', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'Statistical Analysis', category: 'core', frequency: 7, tier: 'high-frequency', selected: true },
      { term: 'Stakeholder Reporting', category: 'core', frequency: 8, tier: 'high-frequency', selected: true },
      { term: 'SQL', category: 'tool', frequency: 10, tier: 'must-have', selected: true },
      { term: 'Power BI', category: 'tool', frequency: 9, tier: 'must-have', selected: true },
      { term: 'MS Excel', category: 'tool', frequency: 10, tier: 'must-have', selected: true },
      { term: 'Python', category: 'tool', frequency: 8, tier: 'high-frequency', selected: true },
      { term: 'Tableau', category: 'tool', frequency: 7, tier: 'high-frequency', selected: true },
    ],
    sampleJds: [
      {
        company: 'EY Analytics Consulting',
        roleTitle: 'Business Analyst — Data & BI',
        rawText:
          'Analyze operational datasets using SQL, Python (Pandas), and MS Excel. Build interactive Power BI or Tableau KPI dashboards, conduct funnel & cohort analysis, gather business requirements, and present clear insights to client stakeholders.',
      },
      {
        company: 'Flipkart Analytics',
        roleTitle: 'Junior Data Analyst',
        rawText:
          'Write complex SQL queries for data cleaning and transformation, run A/B testing evaluations, track conversion and retention metrics, and partner with product managers on weekly business reviews.',
      },
    ],
    metricCategories: TECH_METRICS,
  },
};

export const PRESET_LIST: TrackPreset[] = [
  TRACK_PRESETS['mba-finance'],
  TRACK_PRESETS['mba-marketing'],
  TRACK_PRESETS['mba-hr'],
  TRACK_PRESETS['equity-research'],
  TRACK_PRESETS['tech-swe'],
  TRACK_PRESETS['tech-data'],
];

export function getPresetById(trackId: TrackPresetId): TrackPreset {
  if (trackId === 'custom') {
    return TRACK_PRESETS['mba-finance'];
  }
  return TRACK_PRESETS[trackId] ?? TRACK_PRESETS['mba-finance'];
}

export function getStarterKeywords(trackId: TrackPresetId): KeywordItem[] {
  return getPresetById(trackId).starterKeywords.map((k) => ({ ...k }));
}

// Workshop-grounded Interview Prep prompts from JSW_-_SAHAJ_BANA__INTERVIEW__
export const INTERVIEW_FOUNDATION_PROMPTS = [
  {
    id: 'hr-about',
    category: 'hr-foundation' as const,
    question: 'Tell me about yourself.',
    frameworkLabel: '3-Part Workshop Hook: Break the Mold + Interesting Detail + End Loop',
    tip: 'Share a crisp story beyond your resume, include one concrete initiative/achievement, and end with a natural hook that invites the interviewer to ask a follow-up.',
  },
  {
    id: 'hr-career',
    category: 'hr-foundation' as const,
    question: 'Why did you choose this career field?',
    frameworkLabel: 'Clarity Formula: Personal Story + Career Research + Impact Motivation',
    tip: 'Show genuine clarity—connect what sparked your curiosity, what you validated through coursework/internships, and the impact you want to create.',
  },
  {
    id: 'hr-hire',
    category: 'hr-foundation' as const,
    question: 'Why should we hire you?',
    frameworkLabel: 'JD Fit Formula: Your Strengths + Skills Matched to JD + Team/Individual Execution',
    tip: 'Bridge 2–3 exact keywords from the job description directly to your projects/internships and highlight fast learning + team ownership.',
  },
  {
    id: 'hr-company',
    category: 'hr-foundation' as const,
    question: 'Why do you want to join this company?',
    frameworkLabel: 'Longevity Formula: Career Goal + Right Platform + Growth & Culture Fit',
    tip: 'Connect the company’s domain, training culture, and growth trajectory to where you want to build deep skills.',
  },
  {
    id: 'hr-5years',
    category: 'hr-foundation' as const,
    question: 'Where do you see yourself 5 years from now?',
    frameworkLabel: '2-Part Goal Formula: Short-Term (What to Learn) + Long-Term (Who to Become)',
    tip: 'Short term: master core tools, build trust and credibility. Long term: grow into a subject-matter expert taking larger ownership.',
  },
  {
    id: 'hr-strengths',
    category: 'hr-foundation' as const,
    question: 'What are your greatest strengths and one weakness you are working on?',
    frameworkLabel: 'Balanced Frame: 2 Job-Relevant Strengths with Proof + 1 Honest Area You Actively Improve',
    tip: 'Back your strengths with a quick internship/project example, and pair your weakness with the concrete habit or tool you use to improve it.',
  },
];

export const STAR_BEHAVIORAL_PROMPTS = [
  {
    id: 'star-authority',
    question: 'How would you handle a disagreement with a manager or authority?',
    tip: 'Discuss privately (never publicly), stay open and factual, seek clarity, and emphasize team alignment.',
  },
  {
    id: 'star-logic',
    question: 'Give me an example of when you used logic or data to solve a difficult problem.',
    tip: 'Walk cleanly through Situation → Task → Action (your analytical steps) → Quantified Result.',
  },
  {
    id: 'star-initiative',
    question: 'Explain a time when you took initiative beyond your assigned role.',
    tip: 'Highlight proactivity while still giving fair credit to your team.',
  },
  {
    id: 'star-blocker',
    question: 'Describe a time you faced a major blocker on a project and how you resolved it.',
    tip: 'Show calm breakdown of the problem, resourcefulness, and measurable outcome.',
  },
];

export const QUESTIONS_TO_ASK_INTERVIEWER = [
  'Is there anything in my profile or background that raises any concern I can clarify right now?',
  'What would success look like in the first 90 days if I am selected for this role?',
  'Beyond the core technical skills in the job description, what soft skills help top performers thrive on your team?',
  'Is there anything important about the team culture or upcoming projects we haven’t covered yet?',
  'What is your timeline for making a decision, and when can I expect to hear back?',
];
