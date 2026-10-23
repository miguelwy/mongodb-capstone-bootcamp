# Presenter script — Trendify 3.0 TFW (40 minutes)

Use the spoken lines as a guide, not a memorized monologue. Demo actions are part of the time box. Ask discovery prompts directly, leave a short beat, and move on without inventing customer answers.

**App:** `npm run dev:live` → http://localhost:5173 · footer must read **"Live Atlas cluster · synthetic data"**.
**Presenter notes**: press **N** to show or hide (no on-screen button). They mirror this script per tab.

---

## Pre-flight (before recording)

1. Resume the Atlas cluster; confirm your IP is in Network Access.
2. `npm run dev:live`, open http://localhost:5173.
3. Footer shows **Live Atlas cluster**. If it shows "Illustrative prototype", the API is not connected — see *Fallback* at the end.
4. Click **Reset journey** once (restores stock, clears demo orders). Riviera Canvas Slip-On should be **Low stock (qty 3)**.
5. Return to tab **1 · Trendify 3.0**, page **1 · Context**.

---

## 0:00–3:00 | Personalize the opening and set the frame

**On screen:** Tab **Trendify 3.0 → page 1 · Context** (title band, company facts, "Today" stack, shopper-journey ribbon Discover → Checkout → Europe).

**Say:**

"Sarah, good to see you. In our earlier conversations, you highlighted the pressure to keep up with business demand for new features while maintaining data performance across multiple regions. I also understand AI and real-time data processing are areas you're especially interested in. That gives us a useful lens for today: we'll follow one shopper journey — the ribbon at the top — and look at how the data architecture could support product discovery, peak checkout, and expansion into Europe."

"Does that still reflect the priorities you'd like us to keep in view?"

*Pause briefly, then continue without assuming an answer.*

"The purpose of this Technical Feasibility Workshop is to assess whether the proposed architecture can meet Trendify's technical requirements for Trendify 3.0 and surface feasibility risks early. I've proposed three Required Capabilities: recommendations that react in real time, responsive checkout through flash-sale peaks, and deliberate regional data placement for Europe. For each, we'll do a short show-and-tell on a live Atlas cluster with synthetic data, connect it to the business reason, and identify the evidence needed to assess feasibility."

**Transition:** "I'll start by replaying the before-state and why these priorities matter now."

---

## 3:00–7:00 | Replay the 3 Whys and the before-state

**On screen:** Same page — the three rows **Before → Consequence → Why now**, plus the *Cross-cutting: release velocity* line.

**Say** (walk the rows left to right):

"Why do anything? Trendify reports a split search and recommendation path with slow refresh, checkout latency spikes during flash sales, fragmented inventory data, and multi-region and GDPR strain. The consequences: lower engagement and average order value, abandoned carts, missed sales and compliance burden. Underneath all three is release velocity — business demand is outpacing delivery on a monolith moving toward microservices.

"Why now? The milestone is the next Black Friday, while Trendify expands into Europe.

"Why MongoDB? That is what this workshop needs to test — not assume. The hypotheses are whether Atlas can simplify operational search and recommendation retrieval, whether MongoDB's scale and consistency model fits the checkout workload, and whether Atlas data-placement options fit the regional requirements. We still need Trendify's workload patterns and success thresholds before calling any of these proven."

*Prep note: the scenario does not establish the decision process, detailed schema, access patterns, or peak-load profile. Avoid claiming feasibility until those inputs are validated.*

**Click:** **Proposed RCs →** (bottom right).

---

## 7:00–10:00 | Present and scope the three proposed RCs

**On screen:** Page **2 · Proposed RCs** — three numbered cards (each with an *Evaluate* box marked with the MongoDB leaf) and the 40-minute run-of-show strip.

**Say:**

"I've kept the scope to three proposed RCs — each with the targets you gave us — because these map to Trendify's most differentiated needs:

"One: when a shopper acts, the next recommendations should already reflect it — and never suggest something we can't sell. To evaluate: Atlas Vector Search on live operational data.

"Two: scale checkout and related operational workloads through peak events while meeting the required availability and consistency. To evaluate: sharding and replica sets.

"Three: place regional data and writes deliberately as Trendify expands into Europe while keeping regional access performant. To evaluate: Atlas Global Clusters.

"Please flag anything you would reword or prioritize differently. Adjacent topics go in the Parking Lot so we stay focused — you'll see it at the end."

*Keep this to ~2 minutes so the next page fits in the block.*

**Click:** **Demo environment →**.

### ~9:15–10:00 | What we prepared in Atlas

**On screen:** Page **3 · Demo environment** — three columns (one per RC) and the cluster strip with **North America · Zone 1 · us-east-1** and **Europe · Zone 2 · eu-west-1**. With the cluster online, the tag reads **Live Atlas cluster** and the zones and MongoDB version are read from the cluster.

**Say (~45 s):**

"Before the demos, a quick look at what we prepared. This is a live Atlas cluster with synthetic data. For RC 1, a small product catalog with embeddings, and shopper events that update a session profile used for vector-based recommendations. For RC 2, order data sharded across replica sets, with order and inventory updated in one transaction. For RC 3, a Global Cluster with two zones — US East and Ireland — and location mappings that decide where each order lives. It's sized to demonstrate the patterns, not Trendify's workload."

**Click:** **Start → Discover**.

**Transition:** "I'll start with the customer experience that differentiates Trendify: personalized recommendations."

---

## 10:00–18:00 | RC 1 — Real-time recommendations

**On screen:** Tab **Real-time recommendations** — ribbon step *Discover · RC 1* lit; storefront on the left, **Product detail** and **Recommended for you** on the right.

### 10:00–12:00 | Set up the problem

"The scenario says product recommendations take too long to update in real time. The TensorFlow engine reads a PostgreSQL analytics copy, so suggestions lag what the shopper is actually doing. The consequences are irrelevant suggestions, lower AOV and engagement, and slower adoption of AI-driven campaigns. The RC on screen is our hypothesis in your words: when a shopper acts, the next recommendations should already reflect it — and never suggest something we can't sell."

### 12:00–16:00 | Demo

1. **Point to Recommended for you** (cold start: *Open a product to personalize*).
2. **Click Run semantic query** (prefilled: *comfortable shoes for a summer city trip*).
   "Search is the entry point — a real Atlas Vector Search query over the same product data."
3. **Open Aero Knit City Sneaker.** The panel switches to *Based on Aero Knit City Sneaker* and new items.
   "That view was written to Atlas as an event, the shopper's session profile was updated, and the recommendations were recomputed with Vector Search — on the click, not in a nightly batch."
4. **Open one of the recommended items** (e.g. Packable Rain Shell). The recommendations change again.
   "Each click shifts the profile toward what the shopper just looked at."
5. Point to the stock labels.
   "Out-of-stock items are filtered in the same query, so we never recommend something we can't sell."
6. **Open Riviera Canvas Slip-On** and **click Add to shopper journey**.

"This doesn't replace your TensorFlow models — it shows the fresh behavior and inventory data, and the retrieval, they could build on. It does not prove Trendify's recommendation quality, freshness target, or conversion lift; those need a representative workload and agreed success criteria."

*Callback for later: after the flash sale in RC 2, return to this tab — Riviera is out of stock and has dropped out of the recommendations.*

### ~15:30 | Validate against Trendify's targets

**Click Validate** on the *Trendify targets* card (bottom right). It takes a few seconds.

"These are the targets you set for this capability: recommendations reflect the last click within two seconds, zero out-of-stock items recommended, and semantic search within one second. The check runs live against the cluster with its own test session and cleans up after itself."

Read the three results (typical: ~1.1 s, 0 items, ~0.5 s — all ✓).

*Numbers are measured from the demo API on the presenter's laptop to Atlas over the internet, with synthetic data — in-region they would be lower. Present them as evidence for the targets on this demo, not as production sizing.*

### 16:00–18:00 | Discovery and RC capture

"To make 'real time' concrete: how current do product, inventory, and shopper signals need to be for a recommendation to be useful? How do you measure recommendation quality today? And which system is authoritative for each field?"

**Click:** **Continue to checkout →**.

**Transition:** "The second RC moves from discovery to the revenue-critical path: checkout under flash-sale load."

---

## 18:00–26:00 | RC 2 — Scale and consistency for checkout

**On screen:** Tab **Flash-sale checkout** — cart with Riviera Slip-On; **Request path** (Storefront → Checkout service → Query router) and the two real shards: **Shard 0 · Zone 1 · us-east-1** and **Shard 1 · Zone 2 · eu-west-1**.

### 18:00–20:00 | Set up the problem

"Trendify reports checkout latency spikes during flash sales, with cart abandonment as a direct consequence, and the current PostgreSQL and Redis setup is described as facing scalability challenges. I'm not assuming a target latency or that MongoDB automatically improves conversion; those have to be measured."

### 20:00–24:00 | Demo

1. **Trace the path** with the cursor: storefront → checkout service → query router → shard.
   "Each shard is a three-node replica set: the primary takes writes, secondaries keep copies for availability. The design questions are which operations must be atomic, the shard key, and the transaction boundary."
2. **Click ⚡ Flash sale**, then **⚡ Run flash sale · 20 shoppers**.
   "Twenty shoppers try to buy the same item at almost the same moment. There are three units in stock. Each purchase is a real transaction: create the order and decrement inventory together, or neither."
3. **Narrate as it runs:** squares turn green ✓ or red ✕; committed orders drop under the shard that stored them.
   "Three committed, seventeen rejected, stock three to zero — no oversell. And the orders landed on both shards, US shoppers in us-east-1 and German shoppers in eu-west-1."

"What this shows is consistency under concurrency on a sharded cluster. It is not a load test: twenty requests say nothing about Black Friday throughput, p95/p99 latency, or failover behavior. Those need a controlled test against Trendify's profile."

### ~23:30 | Validate against Trendify's targets

**Click Validate** on the *Trendify targets* card.

"Your targets: twenty concurrent checkouts on one item complete in under three seconds, no oversell, and peak load spread across shards. The check fires twenty real checkouts against a three-unit test item, then ten normal orders from US and German shoppers."

Read the results (typical: ~1.8–2.6 s, 3 orders for 3 units, 2 shards — all ✓).

*Numbers are measured from the demo API on the presenter's laptop to Atlas over the internet, with synthetic data — in-region they would be lower. Present them as evidence for the targets on this demo, not as production sizing.*

*If asked about bigger drops: when ten or more units sell into the same item at once, each winning transaction waits its turn on that product document, and from this laptop the burst grows to ~5 s. That hot-item contention, measured in-region, is exactly what a technical validation should size.*

### 24:00–26:00 | Discovery and RC capture

"How is RDS PostgreSQL scaled today, and what happens to latency and errors during a flash-sale peak? What consistency do you require across cart, order, and inventory? To assess feasibility we'll need current and target throughput, tail latency, error rate, and recovery thresholds. The scenario names a 15–20% cart-abandonment reduction as a desired outcome; we should validate the baseline and target rather than treat it as a forecast."

**Click:** **Continue to Europe placement →**.

**Transition:** "The third RC addresses the Europe expansion, where performance and data placement have to be discussed together."

---

## 26:00–33:00 | RC 3 — Regional data placement for Europe

**On screen:** Tab **Europe data placement** — **North America (Zone 1 · us-east-1)** and **Europe (Zone 2 · eu-west-1)**; order record panel; *Atlas Global Clusters · To evaluate* card.

### 26:00–28:00 | Set up the problem

"The scenario says GDPR and multi-region performance are straining Trendify's infrastructure and compliance workflows as it expands into Europe. The consequences are compliance risk, slower European response times, and operational burden."

### 28:00–31:00 | Demo

1. Point to the **order record** — the order from checkout, with `"location"`.
2. **Click Europe.** The record shows `"location": "DE"`; the order badge moves to Europe; the panel reads **Stored on Zone 2 · eu-west-1 (via explain)**.
   "The location is part of the shard key. Atlas maps DE to the European zone, and the cluster moved the document to the shard in Ireland — read back from the database, not drawn."
3. **Click North America.** It moves back to Zone 1 · us-east-1.
   "Here I'm moving an existing order to make the mechanism visible. In practice, location would be set when the record is written."

### ~30:30 | Validate against Trendify's targets

**Click Validate** on the *Trendify targets* card.

"Your targets: every order stored in its country's zone, a regional query touching only that region, and a region change reflected within two seconds. The check reads placement back from the cluster for every order."

Read the results (typical: 100%, 1 shard, ~1 s — all ✓).

*Numbers are measured from the demo API on the presenter's laptop to Atlas over the internet, with synthetic data — in-region they would be lower. Present them as evidence for the targets on this demo, not as production sizing.*

### 31:00–33:00 | Discovery and RC capture

"Which data must remain in-region? Where do writes originate, what cross-region access is permitted, and what regional latency and recovery objectives matter? We should also confirm the search and retrieval deployment fits the regional architecture."

**Click:** **Close & recap →**.

**Transition:** "Before closing, I'll keep the supporting requirements in scope without turning this into several workshops."

---

## 33:00–37:00 | Cross-cutting topics and Parking Lot

**On screen:** **Recap** panel — *How it connects* strip (RC 1 → events, session profile, vector recs, RC 2 → sharded & replicated, RC 3 → zones). The Parking Lot is spoken, not on screen.

**Say:**

"This strip is how the three connect: shopper events updating a profile that drives vector recommendations, orders on a sharded, replicated cluster, and regional data placed by zone — a hypothesis to test, not a decided architecture.

"Inventory freshness sits inside the recommendation and checkout path, so we traced it there — you saw stock drive both the search filter and the flash sale. A deeper ERP and fulfillment redesign, the microservices migration plan, and AWS implementation and pricing are in the Parking Lot for follow-up.

"If a new topic comes up: 'That's important. I'll put it in the Parking Lot so we can finish validating the three critical capabilities first.' The Parking Lot is a prioritization tool, not a rejection."

---

## 37:00–40:00 | Playback, next steps, and close

**On screen:** Same panel — RC table (*Proposed RC · Consequence · Targets*).

**Click Validate all** in the table header. The nine targets fill in with ✓ and the header shows *9/9 met* (~15 s; talk over it).

**Say:**

"To summarize: real-time recommendations, because suggestions that lag the shopper reduce engagement and AOV; checkout scale and consistency, because flash-sale latency contributes to abandoned carts; and regional data placement, because Europe expansion raises performance and compliance-workflow concerns. Is there anything you would change in that wording or order?

"On this demo environment, all nine targets you gave us were met. The next step is to rerun the same checks against your workload profile, in-region, to confirm them at Trendify's scale."

"For next steps: validate workload patterns, agree baselines and success measures, confirm architecture and residency constraints with security and legal, and assign owners and dates. A proof of concept is worth considering only where a critical capability can't be validated through discussion or a demonstration like today's."

**Close:** "That is the proposed scope and the evidence still needed to assess technical feasibility for Trendify 3.0."

*After the session: click **Reset journey** to restore stock for the next run.*

---

## Fallback — no live cluster

If the footer reads **"Illustrative prototype · synthetic data · no live Atlas connection"**, the app runs fully in the browser:

- RC 1: matching is client-side and illustrative — say "illustrates the retrieval pattern" and skip the keyword toggle.
- RC 2: **Place demo order** animates the path over three conceptual shards; the flash sale is visual only — skip the 20-shopper narration and keep RC 2 as a whiteboard.
- RC 3: placement is conceptual — say "this is how location-aware zones work" instead of "read back from the database".
