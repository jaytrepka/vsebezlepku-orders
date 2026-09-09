---
name: inventory-expiry-advisor
description: >-
  Use this skill when analyzing inventory stock levels, expiration dates, sell-out velocity,
  waste simulation, and formulating discount/clearance strategies for vsebezlepku.cz.
---

# Inventory & Expiration Advisor for VšeBezLepku

This skill provides decision-making logic and action plans for inventory control and expiration management based on the FIFO simulation engine in `vsebezlepku-orders`.

---

## 1. How the Prediction Engine Works

The prediction algorithm in `/api/stock/predictions` computes:
1. **FIFO Batch Waste Simulation:**
   - Evaluates each batch ordered by `expirationDate ASC`.
   - Projects consumption at a given velocity ($v$ = items/day).
   - If projected sales date for a batch is beyond its expiration date, excess pieces are marked as **Waste**.
2. **Sales Velocity Models:**
   - **Overall Velocity ($v_{overall}$):** $\frac{\text{Total Pieces Sold}}{\text{Days between first and last order}}$.
   - **Trending Velocity ($v_{trending}$):** Calculated across the **last 5 distinct order dates** where this product was purchased. Captures recent demand surges or slowdowns.
3. **Risk Triggers:**
   - **`atRisk` = True:** If $(v_{trending} > 0 \text{ and } \text{UnsoldCount}_{trending} > 0)$ or $(v_{overall} > 0 \text{ and } \text{UnsoldCount}_{overall} > 0)$.
   - **Color coding:**
     - 🔴 **Red (<= 30 days):** Critical urgency.
     - 🟡 **Yellow (31–60 days):** Warning threshold.
     - 🟢 **Green (> 60 days):** Healthy stock.

---

## 2. Action Matrix for Expiring Stock

| Days to Expiration | Risk Status | Recommended Action | Discount Tier |
| :--- | :--- | :--- | :--- |
| **> 60 days** | `atRisk = false` | Standard price, normal display. | 0% |
| **45–60 days** | `atRisk = true` | Add to "Tip týdne" or featured banner. | 10–15% |
| **30–45 days** | `atRisk = true` | Add flag `action`, move to "Pomozte neplýtvat". | 20–25% |
| **15–30 days** | Any | Intensive promo: Leadhub newsletter, bundle offer. | 35–40% |
| **< 15 days** | Any | Last chance clearance, flash deal, free gift to >2500 Kč orders. | 50% |

---

## 3. Bundling Strategies to Accelerate Sell-Out
When multiple items are at risk:
1. **Theme Bundles:** Pair an at-risk slow mover (e.g. specialized gnocchi) with a high-velocity bestseller (e.g. Massimo Zero Penne) at a 20% package discount.
2. **"Mystery Zero-Waste Box":** 5–6 mixed products in near-expiration for a fixed price of 299 Kč (value 500+ Kč).
