/**
 * Canonical corporate profile, contact details, regulatory enlistments, and official
 * publication disclaimers for Viridian Nexus Development Ltd.
 */
export const COMPANY_INFO = {
  legalName: 'Viridian Nexus Development Ltd.',
  shortName: 'Viridian Nexus Ltd.',
  motto: 'Homes Woven in Nature',
  corporateOffice: {
    street: 'Sector #04, Road #07, House #85',
    cityPostal: 'Uttara, Dhaka-1230, Bangladesh',
    singleLine: 'Sector #04, Road #07, House #85, Uttara, Dhaka-1230, Bangladesh',
    compactLine: 'Sector #04, Road #07, House #85, Uttara, Dhaka-1230',
  },
  phones: {
    landline: '+8802-58953042',
    mobile: '+8801577-740874',
    landlineHref: 'tel:+880258953042',
    mobileHref: 'tel:+8801577740874',
    whatsappDigits: '8801577740874',
  },
  email: 'veridiannexusdev@gmail.com',
  emailHref: 'mailto:veridiannexusdev@gmail.com',
  websiteDisplay: 'www.viridiannexus.com',
  websiteUrl: 'https://www.viridiannexus.com',
  enlistments: {
    rajuk: 'RAJUK Enlisted',
    canttBoard: 'Cantt. Board Enlisted',
    bangladeshArmy: 'Bangladesh Army Approved',
    combinedSummary: 'RAJUK Enlisted • Cantt. Board Enlisted',
  },
  renderingsDisclaimer:
    'All architectural renderings and visual materials are virtually produced artistic impressions, and the authority reserves the right to change and modify terms, conditions, and specifications as per necessity.',
} as const;
