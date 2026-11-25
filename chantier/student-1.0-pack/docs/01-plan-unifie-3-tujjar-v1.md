# ECOMANITA unified plan + 3-merchant test (27/10/2026)

## Decision
- Moussa's files (office 0.3.9, 8 agents, filmed: install on Mac and Windows, spy, engagement, Drive → paused campaign) = the production line.
- The masar = the head and the money (inspector, Boussala, operations, money).
- Freeze "student 1.0" on the 0.4.2 code (237/237). No rebuild from 0.5.
- 11 players in the course. The code keeps its skills:
  - testing + scaling = media buyer;
  - manager + coach voice = leader (القائد);
  - engagement = a tool of the spy;
  - Boussala = the referee, not a player.
- Part 1 is filmed as is.
- Part 2 changes 5 things: 11 names, coach → Boussala/leader, page = draft, no "day 3", structure from the budget.
- New short part 3: inspector, filter, operations, money.

## Test (stores read-only, invented merchant names)
**Senior, NEXOR**
- Inspector 74/100 (17 checks). Reds:
  - return fee: Tassyir averages 200 DA per return (18,000 / 90 returns), Navex charges 50;
  - 5 returns not processed.
- Unknowns: wallets, dollar rate, return reasons.
- Oranges: ad spend shows 0 in Tassyir; the confirmer has 15 open orders; the «قائمة الانتظار» status is still active.
- Last 30 days: 67 orders, 49.3% confirmed, 18 delivered and 14 returned among closed parcels, tracking 88%.
- Stock: 12 on the shelf + 6 in transit, 21 days of cover.
- Boussala, goal 90 مليون in 60 days:

| Return fee | Net per order | Chance of 90 مليون | Commitment (9/10) |
|---|---|---|---|
| 50 DA | 1,285 DA | 64% | 27.5 مليون |
| 200 DA | 1,098 DA | 46% | none |

**Beginner, ZELA**
- Inspector 64/100. Reds: an email in the pixel field; no buy price.
- All 6 products tagged TEST before any Boussala verdict.
- Boussala, no goal, 30 مليون capital, 40 days: destination about 11 مليون cash. Start with قشابية (net 1,782 DA, max lead $3.53). Testing both at once needs 43.4 مليون.

**Not started, البيت الهادئ**
- 0 products, yet the inspector gives 67/100, because the team and the carrier are shared across the business. This is a bug.
- Example mirror (4,900 DA, buy 2,200, lead $1.8): net 242 DA, ROI 0%, verdict red.

## Fixes before the freeze
1. Return-fee check: merchant's figure vs Tassyir's average.
2. Inspector scores per store; 0 products = "not started", with no score.
3. Orange check: TEST tag before the verdict.
4. Ad spend linked in Tassyir.
5. First question: "do you have orders?", leading to 3 paths (not started / beginner / senior).
6. Plus the 4 code fixes: engine 29.18, page as draft, verdict without "day 3", leader voice.

Delivery reasons (#R) go to 1.1.

## Order
1. Moussa films part 1.
2. NA7LA deletes the «قائمة الانتظار» status and writes Navex's return fee.
3. Claude Code fixes 0.4.2 → freeze 1.0.
4. Part 2 renamed.
5. NA7LA films part 3.
6. One real «لانسي» as proof.
7. 1.1: the 0.5 prompt remapped to the 11 players.
