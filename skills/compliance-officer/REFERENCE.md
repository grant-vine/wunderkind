# Compliance Officer Reference

Use this file for deep compliance work after the router in `SKILL.md` determines the task belongs here.

## Regulation quick reference

| Regulation | Core model | Rights / control focus | Breach timeline |
|---|---|---|---|
| **GDPR** | lawful basis + accountability | access, rectification, erasure, portability, objection, restriction | **72 hours** to regulator; individuals without undue delay when high risk |
| **POPIA** | lawful processing conditions + openness | access, correction, objection, special personal information controls | **As soon as reasonably possible**; treat **72 hours** as the practical benchmark |
| **CCPA / CPRA** | consumer notice + opt-out / limit SPI | know, delete, correct, opt out of sale/share, limit SPI | no single GDPR-style clock; use state/federal incident obligations |
| **PIPEDA** | fair information principles | meaningful consent, access, challenge compliance | notify regulator and individuals when real risk of significant harm; keep records 24 months |
| **LGPD** | GDPR-like lawful basis model | access, correction, deletion, portability, objection | **2 working days** |
| **PDPA (Singapore)** | consent + purpose limitation | notification, access, correction | **3 days** to PDPC when notifiable |
| **PDPA (Thailand)** | GDPR-like lawful basis model | access, rectification, erasure, portability, objection, restriction | **72 hours** |
| **APP (Australia)** | privacy principles + openness | access, correction, direct-marketing controls | **As soon as practicable** under NDB |

## Global compliance defaults

- Treat **data minimisation, purpose limitation, retention control, security safeguards, documentation, and operational rights fulfilment** as universal requirements.
- Treat **cross-border transfers** as blocked unless there is a lawful mechanism.
- Treat **consent** as valid only when it is freely given, specific, informed, unambiguous, withdrawable, and recorded.
- Treat **rights handling** as operational work: policies alone do not count if the team cannot fulfil the request in time.

## Data classification levels

| Level | Description | Examples | Controls |
|---|---|---|---|
| **Public** | Safe to share with anyone | Marketing copy, published docs | None required |
| **Internal** | Employees only, not harmful if leaked | Meeting notes, internal processes | Access control |
| **Confidential** | Limited to authorised personnel | Customer data, financial data | Encryption + access control + audit log |
| **Restricted** | Highly sensitive, regulated | Health data, payment data, credentials | Encryption at rest + in transit + strict need-to-know + DLP |

## Detailed command structures

### `/compliance-assessment <regulation>`

Assessment structure:
1. Scope
2. Data inventory
3. Legal basis audit
4. Rights implementation
5. Security controls
6. Breach response readiness
7. Prioritised gap register

### `/dpia <feature or system>`

DPIA structure:
1. Description of processing
2. Necessity and proportionality
3. Risks to individuals
4. Mitigating measures
5. Residual risk
6. DPO / regulator consultation path

### `/consent-audit <consent mechanism>`

Valid consent requires:
- [ ] **Freely given**: no pre-ticked boxes, no bundling with service access
- [ ] **Specific**: separate consent for each distinct purpose
- [ ] **Informed**: clear plain-language description of what is consented to
- [ ] **Unambiguous**: active opt-in, not opt-out
- [ ] **Withdrawable**: as easy to withdraw as to give; withdrawal must not degrade service
- [ ] **Recorded**: consent timestamp, version, and mechanism stored for audit
- [ ] **Age verification**: if data subjects may include under-18s, parental consent process exists

For each criterion: PASS / FAIL / PARTIAL with evidence.

### `/breach-response-plan`

Plan must cover: detection, first-hour assessment, containment, regulator notice ownership and timelines, individual notice, documentation, remediation, and post-incident review.

When the breach has a technical containment component:

```typescript
task(
  category="unspecified-high",
  load_skills=["wunderkind:fullstack-wunderkind"],
  description="Containment steps for data breach incident",
  prompt="A data breach has been detected. Implement containment: isolate affected systems, revoke exposed credentials/tokens, disable compromised accounts, capture logs for forensic preservation, and confirm blast radius. Return: actions taken, systems affected, credentials rotated, and estimated scope of exposed data.",
  run_in_background=false
)
```

When the breach reveals inadequate technical security controls:

```typescript
task(
  category="unspecified-high",
  load_skills=["wunderkind:security-analyst"],
  description="Security control assessment following breach",
  prompt="Following a data breach, assess the technical controls that failed: review auth implementation, input validation, access control configuration, encryption at rest/in transit, and logging/monitoring gaps. Provide a prioritised remediation list.",
  run_in_background=false
)
```

### `/data-retention-check`

For each data category:
1. What is the defined retention period?
2. Is it documented in the ROPA?
3. Is there an automated deletion job or manual process?
4. Has deletion been tested?
5. Are backup retention periods aligned?
6. Are there legal hold exceptions?

## Data subject request process

1. **Verify identity**
2. **Log receipt** with timestamp and reference number
3. **Acknowledge** within 5 business days
4. **Scope** all systems containing the individual's data
5. **Compile** profile, activity logs, communications, and derived data
6. **Review** for third-party redactions
7. **Respond** within the applicable legal timeline
8. **Erasure** must cover primary systems and backup handling expectations
