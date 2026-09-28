# PHASE 1 — OPPORTUNITY DISCOVERY

> Date: 2026-09-28 · Status: **waiting for founder decision** · No code written.
> Labels: **[FACT]** has a source · **[DATA]** read from the founder's own CodPilot account ·
> **[INF]** inference · **[HYP]** hypothesis to test · **[REC]** recommendation.

---

## 0. Evidence base

### Market (Algeria)

| # | Claim | Label | Source |
|---|---|---|---|
| E1 | About 95% of online orders in Algeria are paid cash on delivery | FACT (secondary) | codrocket.com, dz-ecom.com, ecommaps.com |
| E2 | COD return rate runs 25–40% depending on the sector. Above 30% means unprofitable | FACT (secondary) | dz-ecom.com, colisify.com |
| E3 | A refused parcel costs 600–1,000 DA in the North and 1,200–2,500 DA in the South | FACT (secondary) | dz-ecom.com |
| E4 | Confirming before shipping cuts returns by 5–10 points | FACT (secondary, estimate) | dz-ecom.com |
| E5 | Local COD SaaS is crowded (Zimam, Mystoq, YouCan, Tassyir, CodPilot, EcomX, COD Manager, Ecommaps, CODRocket…). Mystoq's price is **999 DZD/month** | FACT | mystoq.com, getzimam.com, cod-manager.com |
| E6 | 35M Facebook users in Algeria (July 2026), about 73% of the population | FACT | DataReportal / NapoleonCat |
| E7 | CIB/Edahabia cards do not work with Meta. Most people pay through an agency invoiced in dinars | FACT (secondary) | dz-ecom.com |
| E8 | Local digital payment works through Chargily Pay (CIB/Edahabia, free API) or BaridiMob transfers | FACT | chargily.com |
| E9 | Global AI UGC tools cost $29–99/month (Arcads, Creatify) and are weak in Arabic | FACT (secondary) | creatify.ai, wireflow.ai |
| E10 | Clothing return rates are about 30% worldwide, 70% of them because of size | FACT (global) | sizebay, aftership |

### Founder's own data: CodPilot (Ecomanita, fashion)

| Period (by created) | Orders | Confirmed | Confirm % | Delivered | Returned | Delivery % (of closed) | AOV |
|---|---|---|---|---|---|---|---|
| Mar 28 → Sep 28, 2026 | 2,047 | 563 | **27.5%** | 208 | 330 | **38.7%** | 7,018 DA |
| Aug 1 → Sep 28, 2026 | 865 | 286 | **33.1%** | 88 | 173 | **33.7%** | 7,507 DA |

**[DATA]** Of 2,047 orders, **208 were delivered (≈10%)**. The funnel leaks after the ad, not before it.
**[INF]** A 61–66% return rate is roughly **double** the "unprofitable" threshold in E2. Even if
some statuses are recorded inaccurately, the scale of the loss is clear.
**[INF]** This is the strongest piece of evidence in the whole study: the pain is real, it is
measured, and it sits inside the founder's own business.

---

## 1. Opportunity Map (9 opportunities)

### O1 — COD Leak Audit (productized diagnosis)
- **Problem:** the seller knows their "orders" and their CPL, but not where the money leaks between order → confirmation → delivery → collection, or how much each leak costs.
- **Customer:** Algerian COD stores doing **300+ orders/month** (fashion first).
- **Existing solution:** SaaS dashboards show rates (E5) but not the **money** or the **cause**. Otherwise gut feel, or a friend.
- **Pain:** high (E2, E3 + the founder's own data).
- **Money:** directly tied to it. 5 points of delivery rate on 500 orders × 7,000 DA ≈ +175k DA/month in revenue.
- **WTP:** medium. [HYP] they will pay 10–20k DA if the report names numbers in DA.
- **Distribution:** Na7la + founder network + the platforms' own groups.
- **Competition:** agencies/consultants and free SaaS content. No clear "COD audit" product was found.
- **Founder advantage:** very high (operator + own data + Na7la).
- **AI leverage:** high (CSV analysis, reports, Darija scripts).
- **MVP time:** 2–3 days (Sheet + prompt + report template).
- **Monetization:** audit → implementation (done-with-you) → monthly "COD CFO" subscription → a leak-detection layer on top of the existing platforms.
- **Expansion:** an AI analytics layer that plugs into CodPilot/Tassyir/Ecotrack instead of competing with them. Also MENA COD (Morocco, Gulf).
- **Main risk:** credibility (your own store is at 61%) + one-off purchase + reluctance to share data.

### O2 — Performance confirmation service (paid per delivered order)
- **Problem / pain:** same as O1, solved with execution instead of diagnosis.
- **Solution:** a confirmation + follow-up team, paid per **delivered** order, not per call.
- **WTP:** high (paid only on results). **Competition:** many call centers (E5, codpartner).
- **Advantage:** team management. **AI:** weak for now (Darija voice AI isn't mature enough to sell).
- **Risk:** heavy operations, thin margin, it's a job rather than an asset, and your own confirmation (27.5%) doesn't prove you know how to do it.

### O3 — Darija Creative Sprint (creatives for testing)
- 10 hooks + scripts + 3–5 videos per product in 48h, using the existing skills (POV, cod-product-strategist) + AI.
- **WTP:** medium to low (local freelancers are cheap). **Competition:** freelancers + E9 tools.
- **Risk:** commoditized, and you can't prove the creative caused the sale. It also **pours more orders into a funnel that is already leaking**.

### O4 — Product Test Strategy Report ("before you spend on ads")
- A report per product: angle, offer, max CPL, 3×3×3 plan, sales scripts. MVP is nearly ready (existing skill).
- **Risk:** low price (2–5k DA), beginner customers with low WTP, and free content does the same job.

### O5 — Na7la "COD Operator" program (cohort)
- **Risk:** crowded courses market (YouCan, Evact, free courses), trust problems, and slower to reach proof than O1. Better **as the result** of O1 (case studies → course), not as a starting point.

### O6 — Fit/size layer for fashion (before confirmation)
- Size guide + size confirmation over WhatsApp. It addresses a real cause (E10) but it's a **feature**, not a product. It belongs inside O1/O2.

### O7 — Global: Arabic COD creative/ops for Gulf sellers
- Higher purchasing power (dollars) and an Algerian cost advantage. But **access is weak, you have no proof in that market, and collecting payment from abroad is hard** (limits for auto-entrepreneurs, see the jobbers.io source). A phase 2 expansion, not a starting point.

### O8 — A new local COD SaaS — **KILL**
- Price already at 999 DA/month + 10 competitors (E5). No clear wedge. A race to the bottom.

### O9 — Meta ad account billing/reselling — **KILL**
- Real demand (E7), but it's grey-area, capital-heavy, and dependent on Meta policy. It isn't an asset.

---

## 2. Internal scoring (1–5, informs the decision but doesn't make it)

| Opp | Demand | Pain | Money | WTP | Access | Advantage | Speed | AI | Productize | Expansion | /50 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **O1 Leak Audit** | 4 | 5 | 5 | 3 | 4 | 5 | 5 | 4 | 4 | 4 | **43** |
| O2 Confirmation service | 5 | 5 | 5 | 4 | 4 | 3 | 3 | 2 | 3 | 3 | 37 |
| O3 Creative Sprint | 4 | 3 | 3 | 3 | 4 | 4 | 4 | 5 | 4 | 3 | 37 |
| O4 Product report | 3 | 3 | 3 | 2 | 4 | 4 | 5 | 5 | 4 | 3 | 36 |
| O8 Local SaaS | 4 | 3 | 3 | 1 | 4 | 3 | 2 | 4 | 5 | 4 | 33 ✖ |
| O9 Ads billing | 5 | 4 | 4 | 4 | 4 | 3 | 4 | 1 | 2 | 2 | 33 ✖ |
| O7 Global Gulf | 3 | 3 | 4 | 4 | 2 | 2 | 3 | 4 | 3 | 4 | 32 |
| O5 Cohort | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 3 | 31 |
| O6 Fit layer | 3 | 4 | 4 | 2 | 3 | 4 | 3 | 3 | 3 | 2 | 31 |

---

## 3. Top 3 + Red Team

### O1 — COD Leak Audit
| Attack | Strength | Response / condition to survive |
|---|---|---|
| "The doctor is sick": your store is at 61% returns | **Strong** | Turn it into proof: run the audit on Ecomanita first and publish the before/after numbers. If you can't improve your own store, the idea dies. |
| "CodPilot already shows me my confirmation rate" | Medium | They show a %. The audit shows **DA lost + the cause + a 30-day plan**. If the report doesn't carry a number that surprises the seller, it's worthless. |
| One-off purchase, low LTV | Medium | The ladder: audit → implementation → monthly subscription. The first test measures the audit only. |
| Refuses to share orders data | Medium | Export with phone numbers and names removed + a clear agreement. A test metric in its own right. |
| Small sellers can't pay; big ones have teams | Medium | Target 300–3,000 orders/month, where 5 points = more than 100k DA/month. |
| Diagnosis without execution changes nothing | Medium | Include 2 ready-made "fixes" (Darija confirmation script + risky-wilaya rules) in the deliverable. |

### O2 — Confirmation service
| Attack | Strength |
|---|---|
| Heavy operations + management + training = low margin and scaling through headcount | Strong |
| Many existing call centers (price competition) | Strong |
| No internal proof (27.5% confirmation at your own store) | **Strong** |
| **Verdict:** doesn't start on its own. It's the natural upsell of O1 after the process is proven. | |

### O3 — Creative Sprint
| Attack | Strength |
|---|---|
| Commoditized: a local freelancer at a low price + global AI tools | Strong |
| Hard to prove impact (creative ≠ sale in COD) | Strong |
| Adds orders to a leaking funnel: we treat the wrong stage (rule 26) | **Strong** |
| **Verdict:** postpone. It becomes part of an "after fixing the funnel" offer. | |

---

## 4. Recommendation [REC]

**O1 — COD Leak Audit**, starting with **Ecomanita as customer #0**.

### Why this one
1. **Measured pain, not assumed:** your data shows ≈10% of orders get delivered.
2. **It's about money:** the report speaks in DA, not "AI".
3. **Unfair advantage:** operator + real data + Na7la. A Gulf competitor or a SaaS company doesn't have this.
4. **Fastest to revenue:** a manual service in 48–72h, no code, no hosting.
5. **Builds an asset:** every audit → case study → Na7la content → data for a future analysis layer that sits **on top of** the existing platforms instead of competing with them.
6. **Shortcut:** fixing Ecomanita's own funnel may be the **highest-return money** available right now, even if nobody buys the audit.

### Why not the others
- **O2:** strong but operationally heavy and not proven internally. It comes after O1.
- **O3/O4:** treat the wrong stage of the funnel and sell a commodity.
- **O5:** a result of O1, not a starting point.
- **O7:** better money but weak access and no proof. An expansion later.
- **O8/O9:** killed.

---

## 5. Validation experiment: EXP-001 (10 days, no code)

**Hypothesis:** Algerian COD sellers (300+ orders/month) will pay **9,900 DA upfront** for a "Leak
Report" that names the DA lost at each stage + a 30-day plan, delivered within 72h.

| Step | Days | Detail |
|---|---|---|
| A. Customer #0 | 1–3 | Full audit of Ecomanita from CodPilot (by product, wilaya, agent, carrier). Output: a report template + the first case study (numbers anonymized if you prefer). Apply 2 immediate fixes. |
| B. Offer | 3 | A one-page Google Form / Tally page: problem → sample report → price → payment via BaridiMob/CCP (manual) → WhatsApp. **3 founding seats at 9,900 DA** (full price 19,900). |
| C. Distribution (no ads first) | 4–8 | 1 Na7la post/video built on the real numbers ("of 2,047 orders only 208 were delivered — here's why") + **40 direct conversations** with sellers from the network/groups. |
| D. Small paid test (optional) | 5–8 | Only if C produces < 15 qualified conversations: a 10–15k DA equivalent budget on Meta (lead form/WhatsApp), with a single message: the "leak". |
| E. Delivery | 6–10 | Deliver the reports manually (Sheet + Claude) and measure delivery time and customer reaction. |

**Metrics:** qualified leads (300+ orders/month) → conversations → agreed to share data → **paid** → delivered → asked for implementation.

**Decision rules:**
- **Continue:** ≥ **3 paid** out of ≤ 40 qualified conversations, plus ≥ 1 asking for implementation/follow-up.
- **Iterate:** 1–2 paid, or strong interest with a price or data-sharing objection → change one variable (price or deliverable) and repeat for 5 days.
- **Kill:** 0 paid after 40 qualified conversations and one fix to the offer. Keep the audit as an internal tool for Ecomanita + content.

**Cost:** ≈ 0–15k DA + ~15 hours of founder time. No code, no subscriptions.
