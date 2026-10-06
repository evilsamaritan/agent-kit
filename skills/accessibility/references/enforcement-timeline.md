# Accessibility Enforcement Timeline

Volatile enforcement data: compliance deadlines, active dates, regulatory changes. Update periodically.

Reviewed October 2026 against regulator and standards-body pages (EUR-Lex text for the EAA transition dates was only reachable through search snippets). Legal dates move; quote them to a client from the official text.

---

## European Union — European Accessibility Act (EAA)

- **Directive (EU) 2019/882** — the EAA itself was adopted in April 2019
- **Transposition deadline:** June 28, 2022 (member states had to adopt national laws)
- **Active enforcement:** since June 28, 2025 — obligations apply to in-scope products and services placed on the EU market
- **Legacy service carve-out:** service contracts concluded before June 28, 2025 may continue unchanged until they expire, at the latest June 28, 2030
- **Self-service terminals deployed before enforcement:** may remain in use until the end of their economic life, up to 20 years after deployment

### Scope

Applies to any provider offering in-scope digital products/services to EU consumers regardless of provider location. In-scope: e-commerce, banking, e-books, ticketing, consumer electronics, self-service terminals, e-communications, audiovisual media services' access components.

### Standard

EN 301 549, the harmonised European standard for ICT accessibility. V3.2.1 (2021) is built on WCAG 2.1 AA. V4.1.1 (published by ETSI in September 2026) updates its web, document, and software clauses to WCAG 2.2 and adds an annex mapping to the EAA; its own foreword says the presumption of conformity starts only once it is cited in the Official Journal of the EU, so check which version is cited before choosing a target. WCAG 2.2 AA is a safe superset of both.

### Exemptions

- Micro-enterprises providing services (fewer than 10 persons and annual turnover or balance sheet total not above €2M) are exempt
- Disproportionate burden exemption: must be assessed and documented, and reassessed on the schedule the directive and national law set

### Penalties

Each member state sets its own penalty regime in its transposition law. Regimes differ in kind (fixed caps, turnover-based fines, periodic penalties, in some states criminal liability) and change as national law is amended, so read the national law and the designated market-surveillance authority's guidance for each market you serve rather than relying on a summary figure.

Enforcement is decentralized to national market-surveillance authorities.

---

## United States — ADA Title II (State and Local Government)

- **Final rule:** issued April 2024 by DOJ under 28 CFR Part 35
- **Interim Final Rule (April 20, 2026):** moved both compliance dates back one year and took effect immediately. The technical standard is unchanged. Public comments were accepted through June 22, 2026; a final rule that changes the dates again has not been verified, so check the DOJ ADA site (ada.gov) before quoting them
- **Compliance deadline (large entities, 50,000 or more population):** April 26, 2027 (previously April 24, 2026)
- **Compliance deadline (small entities, under 50,000 population, and special district governments):** April 26, 2028 (previously April 26, 2027)
- **Standard:** WCAG 2.1 Level AA
- DOJ stated it expects to enforce at the new dates; the underlying duty to provide equal access did not change

Applies to web content and mobile apps of state and local government entities (including public universities, courts, libraries, and public transit agencies).

### Exceptions (narrow)

- Archived web content created before the compliance date and not used for current services
- Preexisting conventional electronic documents unless needed for active services
- Content posted by third parties on public-facing platforms
- Password-protected non-public third-party content

---

## United States — ADA Title III (Private Sector)

- **Status:** no codified technical standard; DOJ enforcement and private litigation driven by WCAG 2.1/2.2 AA as de-facto benchmark
- **Active litigation:** thousands of ADA website demand letters and lawsuits are filed each year, concentrated in a few states; overlay-widget vendors have been named as defendants
- **DOJ guidance (March 2022, reaffirmed):** websites of public accommodations must be accessible; no Title III technical rule has been adopted

---

## United States — Section 508 (Federal Agencies)

- **Current standard:** 36 CFR Part 1194 (2018 refresh), incorporates WCAG 2.0 AA by reference
- **Refresh:** the Access Board's standard names WCAG 2.0 only; a newer WCAG reference would need a new rulemaking, so build to WCAG 2.2 AA, which also satisfies the 2.0 criteria apart from the obsolete 4.1.1 Parsing
- **Scope:** all federal agency ICT (electronic and information technology) procured, developed, maintained, or used

---

## United Kingdom

- **Public sector:** Public Sector Bodies (Websites and Mobile Applications) (No. 2) Accessibility Regulations 2018 — WCAG 2.2 AA; compliance is monitored by the Government Digital Service and enforced by the Equality and Human Rights Commission (EHRC), or the ECNI in Northern Ireland
- **Private sector:** Equality Act 2010 — no technical standard; courts treat WCAG 2.1/2.2 AA as reasonable-adjustment benchmark
- **Post-Brexit EAA equivalent:** UK has not adopted the EAA; PSBAR remains the binding public-sector regime

---

## Canada

- **Accessible Canada Act (federal):** S.C. 2019, c. 10 (assented June 21, 2019), covering federally regulated entities
- **Goal:** a barrier-free Canada on or before January 1, 2040; requirements arrive through regulations and accessibility standards
- **Accessibility for Ontarians with Disabilities Act (AODA):** WCAG 2.0 AA since January 1, 2021 for public-sector and private organizations with 50+ employees
- **Accessible British Columbia Act (2021):** requirements arrive through regulations; check the provincial government for the current standards

---

## Australia

- **Disability Discrimination Act 1992:** no technical standard
- **Australian Government Digital Service Standard:** requires federal agencies to meet WCAG AA; confirm the WCAG version in the current standard text
- **Private sector:** complaints under the DDA use WCAG AA as the practical benchmark

---

## Japan

- **JIS X 8341-3:2016** — national standard aligned with WCAG 2.0
- **Revised Act on the Elimination of Discrimination against Persons with Disabilities (effective April 1, 2024):** private-sector reasonable accommodation is now mandatory (previously voluntary)
- **Revision aligned with newer WCAG:** the Web Accessibility Infrastructure Committee (WAIC) is drafting a JIS X 8341-3 revision after the 2025 ISO/IEC 40500 update; until it is published, 2016 stays the cited edition

---

## International Standards

- **WCAG 2.2** — W3C Recommendation (October 2023; updated December 2024 with errata)
- **ISO/IEC 40500:2025** — the October 2023 text of WCAG 2.2 adopted as an international standard (replaces ISO/IEC 40500:2012, which was WCAG 2.0)
- **WCAG 3.0** — a W3C Working Draft with its conformance model still in development and no completion date. Continue using WCAG 2.2 AA for compliance.

---

## Trend Summary

1. **EAA enforcement is live** — private-sector digital services in EU face fines today, not in the future
2. **US public sector** is approaching active compliance (Title II deadlines moved to April 2027 and April 2028)
3. **Overlay-widget litigation** is rising — courts increasingly reject overlays as a substitute for remediation
4. **WCAG 2.2 adoption** is the trajectory (UK public sector and the newest EN 301 549 already name it); WCAG 2.1 AA is still the binding text in several jurisdictions, and Section 508 and Ontario's AODA still name WCAG 2.0
5. **Jurisdictional fragmentation** — each country sets its own penalties; cross-border service providers must map every applicable regime
