import { describe, expect, it } from 'vitest';
import { COMPANY_INFO } from '../../src/data/companyInfo';

describe('Canonical Corporate Profile (COMPANY_INFO)', () => {
  it('matches official brochure corporate office, phones, email, and website', () => {
    expect(COMPANY_INFO.legalName).toBe('Viridian Nexus Development Ltd.');
    expect(COMPANY_INFO.motto).toBe('Homes Woven in Nature');
    expect(COMPANY_INFO.corporateOffice.street).toBe('Sector #04, Road #07, House #85');
    expect(COMPANY_INFO.corporateOffice.cityPostal).toBe('Uttara, Dhaka-1230, Bangladesh');
    expect(COMPANY_INFO.phones.landline).toBe('+8802-58953042');
    expect(COMPANY_INFO.phones.mobile).toBe('+8801577-740874');
    expect(COMPANY_INFO.phones.whatsappDigits).toBe('8801577740874');
    expect(COMPANY_INFO.email).toBe('veridiannexusdev@gmail.com');
    expect(COMPANY_INFO.websiteDisplay).toBe('www.viridiannexus.com');
    expect(COMPANY_INFO.websiteUrl).toBe('https://www.viridiannexus.com');
  });

  it('provides valid tel and mailto protocol links without placeholder values', () => {
    expect(COMPANY_INFO.phones.landlineHref).toBe('tel:+880258953042');
    expect(COMPANY_INFO.phones.mobileHref).toBe('tel:+8801577740874');
    expect(COMPANY_INFO.emailHref).toBe('mailto:veridiannexusdev@gmail.com');
    expect(JSON.stringify(COMPANY_INFO)).not.toContain('1700000000');
    expect(JSON.stringify(COMPANY_INFO)).not.toContain('concierge@');
    expect(JSON.stringify(COMPANY_INFO)).not.toContain('RJ-VN-2024-88A');
  });

  it('captures official enlistments and virtual renderings disclaimer', () => {
    expect(COMPANY_INFO.enlistments.rajuk).toBe('RAJUK Enlisted');
    expect(COMPANY_INFO.enlistments.canttBoard).toBe('Cantt. Board Enlisted');
    expect(COMPANY_INFO.enlistments.bangladeshArmy).toBe('Bangladesh Army Approved');
    expect(COMPANY_INFO.renderingsDisclaimer.toLowerCase()).toContain('renderings');
    expect(COMPANY_INFO.renderingsDisclaimer.toLowerCase()).toContain('modify');
  });
});
