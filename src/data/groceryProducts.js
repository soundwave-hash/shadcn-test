// ── Grocery Product Catalog ────────────────────────────────────────────────────
// Each product has:
//   sku         — 6-digit internal SKU: [dept 1-7][subcat 1-6][seq 0001-9999]
//   name        — display name (original 20 items preserve exact names used by leaderboard)
//   category    — top-level department
//   subcategory — aisle-level grouping
//   dailyAvg    — average units sold per day across all locations
//   inventory   — current on-hand units
//   cost        — wholesale cost per unit (USD)
//   retail      — retail price per unit (USD)
//
// SKU structure
//   Dept digit:  1=Produce  2=Dairy & Eggs  3=Meat & Seafood  4=Bakery
//                5=Frozen Foods  6=Beverages  7=Pantry
//   Subcat digit (per dept):
//     Produce         1=Fresh Fruits  2=Fresh Vegetables
//     Dairy & Eggs    1=Eggs  2=Milk  3=Cheese  4=Yogurt  5=Butter & Margarine  6=Cream
//     Meat & Seafood  1=Beef  2=Poultry  3=Pork  4=Seafood
//     Bakery          1=Bread & Rolls  2=Tortillas & Wraps  3=Pastries & Desserts
//     Frozen Foods    1=Frozen Pizza  2=Frozen Meals  3=Frozen Vegetables  4=Ice Cream & Desserts
//     Beverages       1=Juice & Juice Drinks  2=Water  3=Soft Drinks  4=Coffee & Tea
//     Pantry          1=Pasta & Rice  2=Cereals & Oatmeal  3=Canned Goods
//                     4=Condiments & Sauces  5=Snacks
//
// WoS (weeks of stock) = inventory / (dailyAvg × 7)
//   Good ≥ 8 wks  |  Watch 4–8 wks  |  Low < 4 wks
//
// ★ = original leaderboard item — dailyAvg & inventory must not change
// ──────────────────────────────────────────────────────────────────────────────

// ── Country distribution profiles ─────────────────────────────────────────────
// salesFraction: what share of global total units are sold in each country (sums to 1.0)
// invFraction:   what share of global inventory is held in each country (sums to 1.0)
// inv/sales ratio > 1 → well-stocked for that country (high WoS)
// inv/sales ratio < 1 → lean / supply-stressed (low WoS)
export const COUNTRY_SALES_PROFILES = {
  US_Heavy:     { 'United States':0.38, 'China':0.22, 'Germany':0.10, 'Japan':0.09, 'Canada':0.08, 'Korea':0.07, 'Mexico':0.06 },
  China_Heavy:  { 'United States':0.20, 'China':0.52, 'Japan':0.08,   'Korea':0.07, 'Germany':0.06, 'Canada':0.04, 'Mexico':0.03 },
  Balanced:     { 'United States':0.28, 'China':0.35, 'Germany':0.10, 'Japan':0.09, 'Canada':0.07, 'Korea':0.06, 'Mexico':0.05 },
  Europe_Heavy: { 'United States':0.30, 'China':0.22, 'Germany':0.18, 'Japan':0.10, 'Canada':0.08, 'Korea':0.07, 'Mexico':0.05 },
  Seafood:      { 'United States':0.15, 'China':0.40, 'Japan':0.20,   'Korea':0.15, 'Germany':0.05, 'Canada':0.03, 'Mexico':0.02 },
}

export const COUNTRY_INV_PROFILES = {
  US_Heavy:     { 'United States':0.45, 'China':0.18, 'Germany':0.12, 'Japan':0.10, 'Canada':0.08, 'Korea':0.05, 'Mexico':0.02 },
  China_Heavy:  { 'United States':0.22, 'China':0.38, 'Japan':0.12,   'Korea':0.08, 'Germany':0.08, 'Canada':0.06, 'Mexico':0.06 },
  Balanced:     { 'United States':0.35, 'China':0.28, 'Germany':0.12, 'Japan':0.10, 'Canada':0.07, 'Korea':0.05, 'Mexico':0.03 },
  Europe_Heavy: { 'United States':0.32, 'China':0.20, 'Germany':0.22, 'Japan':0.12, 'Canada':0.07, 'Korea':0.05, 'Mexico':0.02 },
  Seafood:      { 'United States':0.20, 'China':0.35, 'Japan':0.22,   'Korea':0.10, 'Germany':0.06, 'Canada':0.04, 'Mexico':0.03 },
}

// City fractions — fraction of country total (both sales and inventory) per city.
// Values sum to 1.0 per country.
export const CITY_FRACTIONS = {
  'United States': { 'New York':0.20, 'Los Angeles':0.17, 'Chicago':0.16, 'Houston':0.19, 'Phoenix':0.14, 'Philadelphia':0.14 },
  'Canada':        { 'Toronto':0.30,  'Vancouver':0.20,   'Montreal':0.22, 'Calgary':0.12, 'Ottawa':0.09,  'Edmonton':0.07  },
  'Mexico':        { 'Mexico City':0.32,'Guadalajara':0.22,'Monterrey':0.16,'Puebla':0.14, 'Tijuana':0.09, 'León':0.07      },
  'Germany':       { 'Berlin':0.20,   'Munich':0.22,      'Hamburg':0.17,  'Frankfurt':0.19,'Cologne':0.12, 'Stuttgart':0.10 },
  'Japan':         { 'Tokyo':0.35,    'Osaka':0.26,       'Nagoya':0.13,   'Sapporo':0.11, 'Fukuoka':0.09, 'Kyoto':0.06    },
  'Korea':         { 'Seoul':0.42,    'Busan':0.22,       'Incheon':0.14,  'Daegu':0.11,   'Gwangju':0.06, 'Daejeon':0.05  },
  'China':         { 'Beijing':0.19,  'Shanghai':0.22,    'Guangzhou':0.18,'Shenzhen':0.15,'Chengdu':0.15, 'Wuhan':0.11    },
}

export const PRODUCTS = [

  // ══════════════════════════════════════════════════════════════════════════════
  // PRODUCE  (dept 1)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Fresh Fruits  (subcat 1 → 11xxxx) ────────────────────────────────────────
  { sku:'110001', name:'Bananas (lb)',           category:'Produce', subcategory:'Fresh Fruits',    profile:'Balanced', dailyAvg:1820, inventory:  38200, cost:0.19, retail:0.49 }, // ★ ~3.0 wks Low
  { sku:'110002', name:'Strawberries (1lb)',     category:'Produce', subcategory:'Fresh Fruits',    profile:'Balanced', dailyAvg: 890, inventory:  42700, cost:1.50, retail:3.99 }, // ★ ~6.9 wks Watch
  { sku:'110003', name:'Gala Apples (3lb)',      category:'Produce', subcategory:'Fresh Fruits',    profile:'Balanced', dailyAvg:2340, inventory:  85600, cost:1.80, retail:4.49 }, // ~5.2 wks Watch
  { sku:'110004', name:'Navel Oranges (3lb)',    category:'Produce', subcategory:'Fresh Fruits',    profile:'Balanced', dailyAvg: 740, inventory:  18500, cost:1.90, retail:4.99 }, // ~3.6 wks Low
  { sku:'110005', name:'Green Grapes (1.5lb)',   category:'Produce', subcategory:'Fresh Fruits',    profile:'Balanced', dailyAvg: 980, inventory:  31200, cost:1.60, retail:3.99 }, // ~4.6 wks Watch
  { sku:'110006', name:'Blueberries (6oz)',      category:'Produce', subcategory:'Fresh Fruits',    profile:'Balanced', dailyAvg:  88, inventory:   1960, cost:1.40, retail:3.49 }, // ~3.2 wks Low
  { sku:'110007', name:'Peaches (1lb)',          category:'Produce', subcategory:'Fresh Fruits',    profile:'Balanced', dailyAvg:  52, inventory:    820, cost:1.20, retail:2.99 }, // ~2.3 wks Low

  // ── Fresh Vegetables  (subcat 2 → 12xxxx) ────────────────────────────────────
  { sku:'120001', name:'Russet Potatoes',        category:'Produce', subcategory:'Fresh Vegetables', profile:'China_Heavy', dailyAvg: 920, inventory:  22100, cost:1.80, retail:3.99 }, // ★ ~3.4 wks Low
  { sku:'120002', name:'Baby Spinach (5oz)',     category:'Produce', subcategory:'Fresh Vegetables', profile:'China_Heavy', dailyAvg: 270, inventory:   4600, cost:1.80, retail:3.99 }, // ★ ~2.4 wks Low
  { sku:'120003', name:'Broccoli Crown',         category:'Produce', subcategory:'Fresh Vegetables', profile:'China_Heavy', dailyAvg:1140, inventory:  54200, cost:0.90, retail:2.49 }, // ~6.8 wks Watch
  { sku:'120004', name:'Carrots (2lb)',          category:'Produce', subcategory:'Fresh Vegetables', profile:'China_Heavy', dailyAvg:2680, inventory: 196000, cost:0.80, retail:1.99 }, // ~10.5 wks Good
  { sku:'120005', name:'Roma Tomatoes (1lb)',    category:'Produce', subcategory:'Fresh Vegetables', profile:'China_Heavy', dailyAvg: 870, inventory:  14700, cost:0.70, retail:1.79 }, // ~2.4 wks Low
  { sku:'120006', name:'Romaine Lettuce',        category:'Produce', subcategory:'Fresh Vegetables', profile:'China_Heavy', dailyAvg: 560, inventory:  16800, cost:0.90, retail:2.29 }, // ~4.3 wks Watch
  { sku:'120007', name:'Cucumber',               category:'Produce', subcategory:'Fresh Vegetables', profile:'China_Heavy', dailyAvg:  95, inventory:   1400, cost:0.55, retail:1.29 }, // ~2.1 wks Low

  // ══════════════════════════════════════════════════════════════════════════════
  // DAIRY & EGGS  (dept 2)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Eggs  (subcat 1 → 21xxxx) ─────────────────────────────────────────────────
  { sku:'210001', name:'Eggs (12pk)',            category:'Dairy & Eggs', subcategory:'Eggs',       profile:'US_Heavy', dailyAvg:1560, inventory:  98300, cost:2.20, retail:3.99 }, // ★ ~9.0 wks Good
  { sku:'210002', name:'Brown Eggs (12pk)',      category:'Dairy & Eggs', subcategory:'Eggs',       profile:'US_Heavy', dailyAvg: 680, inventory:  28900, cost:2.50, retail:4.49 }, // ~6.1 wks Watch
  { sku:'210003', name:'Cage-Free Eggs (12pk)',  category:'Dairy & Eggs', subcategory:'Eggs',       profile:'US_Heavy', dailyAvg: 490, inventory:  18600, cost:3.00, retail:5.49 }, // ~5.4 wks Watch
  { sku:'210004', name:'Jumbo Eggs (12pk)',      category:'Dairy & Eggs', subcategory:'Eggs',       profile:'US_Heavy', dailyAvg: 125, inventory:   4200, cost:2.40, retail:4.29 }, // ~4.8 wks Watch
  { sku:'210005', name:'Egg Whites (32oz)',      category:'Dairy & Eggs', subcategory:'Eggs',       profile:'US_Heavy', dailyAvg:  78, inventory:   1950, cost:2.80, retail:5.29 }, // ~3.6 wks Low
  { sku:'210006', name:'Organic Eggs (12pk)',    category:'Dairy & Eggs', subcategory:'Eggs',       profile:'US_Heavy', dailyAvg: 340, inventory:  12800, cost:3.50, retail:6.49 }, // ~5.4 wks Watch

  // ── Milk  (subcat 2 → 22xxxx) ─────────────────────────────────────────────────
  { sku:'220001', name:'Whole Milk (gal)',       category:'Dairy & Eggs', subcategory:'Milk',       profile:'US_Heavy', dailyAvg:1240, inventory:  69400, cost:2.80, retail:4.29 }, // ★ ~8.0 wks Good
  { sku:'220002', name:'2% Milk (gal)',          category:'Dairy & Eggs', subcategory:'Milk',       profile:'US_Heavy', dailyAvg:2180, inventory: 142000, cost:2.70, retail:4.19 }, // ~9.3 wks Good
  { sku:'220003', name:'Skim Milk (gal)',        category:'Dairy & Eggs', subcategory:'Milk',       profile:'US_Heavy', dailyAvg: 760, inventory:  28400, cost:2.60, retail:3.99 }, // ~5.4 wks Watch
  { sku:'220004', name:'Oat Milk (64oz)',        category:'Dairy & Eggs', subcategory:'Milk',       profile:'US_Heavy', dailyAvg: 920, inventory:  19600, cost:2.50, retail:4.99 }, // ~3.0 wks Low
  { sku:'220005', name:'Almond Milk (64oz)',     category:'Dairy & Eggs', subcategory:'Milk',       profile:'US_Heavy', dailyAvg: 840, inventory:  35300, cost:2.20, retail:4.49 }, // ~6.0 wks Watch
  { sku:'220006', name:'Heavy Cream (1pt)',      category:'Dairy & Eggs', subcategory:'Milk',       profile:'US_Heavy', dailyAvg: 115, inventory:   3600, cost:1.60, retail:3.49 }, // ~4.5 wks Watch

  // ── Cheese  (subcat 3 → 23xxxx) ───────────────────────────────────────────────
  { sku:'230001', name:'Cheddar Cheese',         category:'Dairy & Eggs', subcategory:'Cheese',     profile:'Europe_Heavy', dailyAvg: 380, inventory:  14900, cost:2.80, retail:5.49 }, // ★ ~5.6 wks Watch
  { sku:'230002', name:'Mozzarella (8oz)',       category:'Dairy & Eggs', subcategory:'Cheese',     profile:'Europe_Heavy', dailyAvg: 520, inventory:  16600, cost:2.60, retail:4.99 }, // ~4.6 wks Watch
  { sku:'230003', name:'Swiss Cheese (8oz)',     category:'Dairy & Eggs', subcategory:'Cheese',     profile:'Europe_Heavy', dailyAvg:  88, inventory:   2100, cost:2.90, retail:5.69 }, // ~3.4 wks Low
  { sku:'230004', name:'Parmesan (8oz)',         category:'Dairy & Eggs', subcategory:'Cheese',     profile:'Europe_Heavy', dailyAvg: 142, inventory:   6800, cost:3.20, retail:6.29 }, // ~6.9 wks Watch
  { sku:'230005', name:'Pepper Jack (8oz)',      category:'Dairy & Eggs', subcategory:'Cheese',     profile:'Europe_Heavy', dailyAvg:  96, inventory:   2900, cost:2.70, retail:5.29 }, // ~4.3 wks Watch
  { sku:'230006', name:'Provolone (8oz)',        category:'Dairy & Eggs', subcategory:'Cheese',     profile:'Europe_Heavy', dailyAvg:  58, inventory:   1380, cost:2.80, retail:5.49 }, // ~3.4 wks Low

  // ── Yogurt  (subcat 4 → 24xxxx) ───────────────────────────────────────────────
  { sku:'240001', name:'Greek Yogurt',           category:'Dairy & Eggs', subcategory:'Yogurt',     profile:'US_Heavy', dailyAvg: 620, inventory:  15500, cost:1.20, retail:2.49 }, // ★ ~3.6 wks Low
  { sku:'240002', name:'Vanilla Yogurt (6oz)',   category:'Dairy & Eggs', subcategory:'Yogurt',     profile:'US_Heavy', dailyAvg: 460, inventory:   9200, cost:0.60, retail:1.29 }, // ~2.9 wks Low
  { sku:'240003', name:'Strawberry Yogurt (6oz)',category:'Dairy & Eggs', subcategory:'Yogurt',     profile:'US_Heavy', dailyAvg: 390, inventory:   8580, cost:0.60, retail:1.29 }, // ~3.1 wks Low
  { sku:'240004', name:'Plain Yogurt (32oz)',    category:'Dairy & Eggs', subcategory:'Yogurt',     profile:'US_Heavy', dailyAvg:  98, inventory:   2940, cost:1.50, retail:3.29 }, // ~4.3 wks Watch
  { sku:'240005', name:'Coconut Yogurt (5.3oz)', category:'Dairy & Eggs', subcategory:'Yogurt',     profile:'US_Heavy', dailyAvg:  42, inventory:    840, cost:0.90, retail:1.99 }, // ~2.9 wks Low
  { sku:'240006', name:'Skyr Yogurt (5.3oz)',    category:'Dairy & Eggs', subcategory:'Yogurt',     profile:'US_Heavy', dailyAvg:  62, inventory:   1860, cost:0.85, retail:1.89 }, // ~4.3 wks Watch

  // ── Butter & Margarine  (subcat 5 → 25xxxx) ───────────────────────────────────
  { sku:'250001', name:'Butter (1lb)',           category:'Dairy & Eggs', subcategory:'Butter & Margarine', profile:'US_Heavy', dailyAvg: 340, inventory:   7800, cost:2.80, retail:5.49 }, // ★ ~3.3 wks Low
  { sku:'250002', name:'Unsalted Butter (1lb)',  category:'Dairy & Eggs', subcategory:'Butter & Margarine', profile:'US_Heavy', dailyAvg: 420, inventory:  12600, cost:2.80, retail:5.49 }, // ~4.3 wks Watch
  { sku:'250003', name:'Whipped Butter (8oz)',   category:'Dairy & Eggs', subcategory:'Butter & Margarine', profile:'US_Heavy', dailyAvg:  96, inventory:   1920, cost:1.60, retail:3.29 }, // ~2.9 wks Low
  { sku:'250004', name:'Margarine (15oz)',       category:'Dairy & Eggs', subcategory:'Butter & Margarine', profile:'US_Heavy', dailyAvg: 115, inventory:   4025, cost:1.40, retail:2.79 }, // ~5.0 wks Watch
  { sku:'250005', name:'Vegan Butter (7oz)',     category:'Dairy & Eggs', subcategory:'Butter & Margarine', profile:'US_Heavy', dailyAvg:  38, inventory:    570, cost:2.40, retail:4.99 }, // ~2.1 wks Low
  { sku:'250006', name:'European Butter (8oz)',  category:'Dairy & Eggs', subcategory:'Butter & Margarine', profile:'US_Heavy', dailyAvg:  28, inventory:    980, cost:2.60, retail:5.29 }, // ~5.0 wks Watch

  // ── Cream  (subcat 6 → 26xxxx) ────────────────────────────────────────────────
  { sku:'260001', name:'Sour Cream (16oz)',      category:'Dairy & Eggs', subcategory:'Cream',      profile:'US_Heavy', dailyAvg: 210, inventory:  11200, cost:1.10, retail:2.29 }, // ★ ~7.6 wks Watch
  { sku:'260002', name:'Cream Cheese (8oz)',     category:'Dairy & Eggs', subcategory:'Cream',      profile:'US_Heavy', dailyAvg: 195, inventory:   9400, cost:1.40, retail:2.99 }, // ★ ~6.9 wks Watch
  { sku:'260003', name:'Half & Half (1pt)',      category:'Dairy & Eggs', subcategory:'Cream',      profile:'US_Heavy', dailyAvg: 580, inventory:  22620, cost:1.20, retail:2.79 }, // ~5.6 wks Watch
  { sku:'260004', name:'Whipping Cream (1pt)',   category:'Dairy & Eggs', subcategory:'Cream',      profile:'US_Heavy', dailyAvg: 125, inventory:   3750, cost:1.30, retail:2.99 }, // ~4.3 wks Watch
  { sku:'260005', name:'Cottage Cheese (24oz)',  category:'Dairy & Eggs', subcategory:'Cream',      profile:'US_Heavy', dailyAvg: 280, inventory:   9800, cost:1.60, retail:3.29 }, // ~5.0 wks Watch

  // ══════════════════════════════════════════════════════════════════════════════
  // MEAT & SEAFOOD  (dept 3)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Beef  (subcat 1 → 31xxxx) ─────────────────────────────────────────────────
  { sku:'310001', name:'Ground Beef (1lb)',      category:'Meat & Seafood', subcategory:'Beef',     profile:'Balanced', dailyAvg: 510, inventory:  31600, cost:3.50, retail:6.99  }, // ★ ~8.9 wks Good
  { sku:'310002', name:'Ribeye Steak (1lb)',     category:'Meat & Seafood', subcategory:'Beef',     profile:'Balanced', dailyAvg:  48, inventory:   1440, cost:7.50, retail:15.99 }, // ~4.3 wks Watch
  { sku:'310003', name:'NY Strip Steak (1lb)',   category:'Meat & Seafood', subcategory:'Beef',     profile:'Balanced', dailyAvg:  42, inventory:   1260, cost:6.80, retail:13.99 }, // ~4.3 wks Watch
  { sku:'310004', name:'Chuck Roast (2lb)',      category:'Meat & Seafood', subcategory:'Beef',     profile:'Balanced', dailyAvg:  95, inventory:   3325, cost:5.60, retail:11.99 }, // ~5.0 wks Watch
  { sku:'310005', name:'Beef Stew Meat (1lb)',   category:'Meat & Seafood', subcategory:'Beef',     profile:'Balanced', dailyAvg:  72, inventory:   2160, cost:4.20, retail:8.49  }, // ~4.3 wks Watch
  { sku:'310006', name:'Flank Steak (1lb)',      category:'Meat & Seafood', subcategory:'Beef',     profile:'Balanced', dailyAvg:  55, inventory:   1650, cost:5.50, retail:10.99 }, // ~4.3 wks Watch

  // ── Poultry  (subcat 2 → 32xxxx) ──────────────────────────────────────────────
  { sku:'320001', name:'Chicken Breast',         category:'Meat & Seafood', subcategory:'Poultry',  profile:'Balanced', dailyAvg: 842, inventory:  47200, cost:2.20, retail:4.99 }, // ★ ~8.0 wks Good
  { sku:'320002', name:'Chicken Thighs (1lb)',   category:'Meat & Seafood', subcategory:'Poultry',  profile:'Balanced', dailyAvg:1960, inventory:  68600, cost:1.60, retail:3.49 }, // ~5.0 wks Watch
  { sku:'320003', name:'Whole Chicken (4lb)',    category:'Meat & Seafood', subcategory:'Poultry',  profile:'Balanced', dailyAvg: 580, inventory:  16240, cost:4.00, retail:8.99 }, // ~4.0 wks Watch
  { sku:'320004', name:'Ground Turkey (1lb)',    category:'Meat & Seafood', subcategory:'Poultry',  profile:'Balanced', dailyAvg: 420, inventory:  14700, cost:2.80, retail:5.99 }, // ~5.0 wks Watch
  { sku:'320005', name:'Turkey Breast (1lb)',    category:'Meat & Seafood', subcategory:'Poultry',  profile:'Balanced', dailyAvg: 115, inventory:   2875, cost:3.20, retail:6.99 }, // ~3.6 wks Low
  { sku:'320006', name:'Chicken Wings (1lb)',    category:'Meat & Seafood', subcategory:'Poultry',  profile:'Balanced', dailyAvg:2840, inventory:  99400, cost:2.00, retail:4.49 }, // ~5.0 wks Watch

  // ── Pork  (subcat 3 → 33xxxx) ─────────────────────────────────────────────────
  { sku:'330001', name:'Pork Chops (1lb)',       category:'Meat & Seafood', subcategory:'Pork',     profile:'China_Heavy', dailyAvg: 640, inventory:  22400, cost:2.40, retail:5.49 }, // ~5.0 wks Watch
  { sku:'330002', name:'Bacon (1lb)',            category:'Meat & Seafood', subcategory:'Pork',     profile:'China_Heavy', dailyAvg:3200, inventory:  96000, cost:3.60, retail:7.49 }, // ~4.3 wks Watch
  { sku:'330003', name:'Pork Tenderloin (1lb)',  category:'Meat & Seafood', subcategory:'Pork',     profile:'China_Heavy', dailyAvg:  88, inventory:   2200, cost:3.00, retail:6.29 }, // ~3.6 wks Low
  { sku:'330004', name:'Italian Sausage (1lb)',  category:'Meat & Seafood', subcategory:'Pork',     profile:'China_Heavy', dailyAvg: 480, inventory:  16800, cost:2.50, retail:5.29 }, // ~5.0 wks Watch
  { sku:'330005', name:'Ham Steak (1lb)',        category:'Meat & Seafood', subcategory:'Pork',     profile:'China_Heavy', dailyAvg:  95, inventory:   1900, cost:2.80, retail:5.99 }, // ~2.9 wks Low

  // ── Seafood  (subcat 4 → 34xxxx) ──────────────────────────────────────────────
  { sku:'340001', name:'Salmon Fillet (1lb)',    category:'Meat & Seafood', subcategory:'Seafood',  profile:'Seafood', dailyAvg: 340, inventory:   8500, cost:7.00, retail:13.99 }, // ~3.6 wks Low
  { sku:'340002', name:'Tilapia Fillet (1lb)',   category:'Meat & Seafood', subcategory:'Seafood',  profile:'Seafood', dailyAvg: 118, inventory:   2950, cost:3.20, retail:6.99  }, // ~3.6 wks Low
  { sku:'340003', name:'Shrimp (1lb)',           category:'Meat & Seafood', subcategory:'Seafood',  profile:'Seafood', dailyAvg: 520, inventory:  15600, cost:5.50, retail:10.99 }, // ~4.3 wks Watch
  { sku:'340004', name:'Cod Fillet (1lb)',       category:'Meat & Seafood', subcategory:'Seafood',  profile:'Seafood', dailyAvg:  82, inventory:   2050, cost:4.50, retail:9.49  }, // ~3.6 wks Low
  { sku:'340005', name:'Tuna Steak (1lb)',       category:'Meat & Seafood', subcategory:'Seafood',  profile:'Seafood', dailyAvg:  35, inventory:   1050, cost:6.50, retail:12.99 }, // ~4.3 wks Watch

  // ══════════════════════════════════════════════════════════════════════════════
  // BAKERY  (dept 4)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Bread & Rolls  (subcat 1 → 41xxxx) ────────────────────────────────────────
  { sku:'410001', name:'Sourdough Bread',        category:'Bakery', subcategory:'Bread & Rolls',   profile:'Europe_Heavy', dailyAvg: 680, inventory:  21400, cost:2.50, retail:5.99 }, // ★ ~4.5 wks Watch
  { sku:'410002', name:'White Sandwich Bread',   category:'Bakery', subcategory:'Bread & Rolls',   profile:'Europe_Heavy', dailyAvg:2480, inventory:  62000, cost:1.40, retail:3.49 }, // ~3.6 wks Low
  { sku:'410003', name:'Whole Wheat Bread',      category:'Bakery', subcategory:'Bread & Rolls',   profile:'Europe_Heavy', dailyAvg:1840, inventory:  82800, cost:1.50, retail:3.79 }, // ~6.5 wks Watch
  { sku:'410004', name:'Brioche Buns (8ct)',     category:'Bakery', subcategory:'Bread & Rolls',   profile:'Europe_Heavy', dailyAvg: 560, inventory:  11200, cost:2.20, retail:4.99 }, // ~2.9 wks Low
  { sku:'410005', name:'Dinner Rolls (12ct)',    category:'Bakery', subcategory:'Bread & Rolls',   profile:'Europe_Heavy', dailyAvg: 740, inventory:  25900, cost:1.80, retail:3.99 }, // ~5.0 wks Watch
  { sku:'410006', name:'Bagels (6ct)',           category:'Bakery', subcategory:'Bread & Rolls',   profile:'Europe_Heavy', dailyAvg: 920, inventory:  32200, cost:2.00, retail:4.49 }, // ~5.0 wks Watch

  // ── Tortillas & Wraps  (subcat 2 → 42xxxx) ────────────────────────────────────
  { sku:'420001', name:'Tortillas (20ct)',       category:'Bakery', subcategory:'Tortillas & Wraps', profile:'US_Heavy', dailyAvg: 330, inventory:  25400, cost:1.50, retail:3.49 }, // ★ ~11.0 wks Good
  { sku:'420002', name:'Whole Wheat Tortillas (10ct)', category:'Bakery', subcategory:'Tortillas & Wraps', profile:'US_Heavy', dailyAvg: 145, inventory:   5075, cost:1.60, retail:3.69 }, // ~5.0 wks Watch
  { sku:'420003', name:'Corn Tortillas (30ct)',  category:'Bakery', subcategory:'Tortillas & Wraps', profile:'US_Heavy', dailyAvg: 680, inventory:  20400, cost:1.30, retail:2.99 }, // ~4.3 wks Watch
  { sku:'420004', name:'Spinach Wraps (6ct)',    category:'Bakery', subcategory:'Tortillas & Wraps', profile:'US_Heavy', dailyAvg:  72, inventory:   1800, cost:1.80, retail:3.99 }, // ~3.6 wks Low
  { sku:'420005', name:'Low-Carb Tortillas (8ct)', category:'Bakery', subcategory:'Tortillas & Wraps', profile:'US_Heavy', dailyAvg:  88, inventory:   2640, cost:2.00, retail:4.49 }, // ~4.3 wks Watch
  { sku:'420006', name:'Pita Bread (8ct)',       category:'Bakery', subcategory:'Tortillas & Wraps', profile:'US_Heavy', dailyAvg: 380, inventory:  13300, cost:1.60, retail:3.49 }, // ~5.0 wks Watch

  // ── Pastries & Desserts  (subcat 3 → 43xxxx) ──────────────────────────────────
  { sku:'430001', name:'Croissants (4ct)',       category:'Bakery', subcategory:'Pastries & Desserts', profile:'Europe_Heavy', dailyAvg: 480, inventory:   9600, cost:2.20, retail:4.99 }, // ~2.9 wks Low
  { sku:'430002', name:'Blueberry Muffins (4ct)', category:'Bakery', subcategory:'Pastries & Desserts', profile:'Europe_Heavy', dailyAvg: 320, inventory:   6400, cost:2.00, retail:4.49 }, // ~2.9 wks Low
  { sku:'430003', name:'Cinnamon Rolls (8ct)',   category:'Bakery', subcategory:'Pastries & Desserts', profile:'Europe_Heavy', dailyAvg: 280, inventory:   9800, cost:2.80, retail:5.99 }, // ~5.0 wks Watch
  { sku:'430004', name:'Glazed Donuts (6ct)',    category:'Bakery', subcategory:'Pastries & Desserts', profile:'Europe_Heavy', dailyAvg: 640, inventory:  16000, cost:2.40, retail:5.49 }, // ~3.6 wks Low
  { sku:'430005', name:'Cheese Danish (4ct)',    category:'Bakery', subcategory:'Pastries & Desserts', profile:'Europe_Heavy', dailyAvg:  62, inventory:   1240, cost:2.20, retail:4.99 }, // ~2.9 wks Low

  // ══════════════════════════════════════════════════════════════════════════════
  // FROZEN FOODS  (dept 5)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Frozen Pizza  (subcat 1 → 51xxxx) ────────────────────────────────────────
  { sku:'510001', name:'Frozen Pizza',           category:'Frozen Foods', subcategory:'Frozen Pizza', profile:'US_Heavy', dailyAvg: 460, inventory:  18200, cost:3.50, retail:7.99 }, // ★ ~5.6 wks Watch
  { sku:'510002', name:'Cauliflower Crust Pizza', category:'Frozen Foods', subcategory:'Frozen Pizza', profile:'US_Heavy', dailyAvg:  72, inventory:   2160, cost:3.80, retail:8.49 }, // ~4.3 wks Watch
  { sku:'510003', name:'French Bread Pizza (2ct)', category:'Frozen Foods', subcategory:'Frozen Pizza', profile:'US_Heavy', dailyAvg: 380, inventory:  11400, cost:2.80, retail:6.29 }, // ~4.3 wks Watch
  { sku:'510004', name:'Personal Pan Pizza (4ct)', category:'Frozen Foods', subcategory:'Frozen Pizza', profile:'US_Heavy', dailyAvg: 115, inventory:   2875, cost:4.20, retail:9.49 }, // ~3.6 wks Low
  { sku:'510005', name:'Gluten-Free Pizza',      category:'Frozen Foods', subcategory:'Frozen Pizza', profile:'US_Heavy', dailyAvg:  48, inventory:   1440, cost:4.50, retail:9.99 }, // ~4.3 wks Watch
  { sku:'510006', name:'BBQ Chicken Pizza',      category:'Frozen Foods', subcategory:'Frozen Pizza', profile:'US_Heavy', dailyAvg: 280, inventory:   8400, cost:3.60, retail:7.99 }, // ~4.3 wks Watch

  // ── Frozen Meals  (subcat 2 → 52xxxx) ────────────────────────────────────────
  { sku:'520001', name:'Frozen Burrito (2ct)',   category:'Frozen Foods', subcategory:'Frozen Meals', profile:'China_Heavy', dailyAvg:2160, inventory:  75600, cost:1.80, retail:3.99 }, // ~5.0 wks Watch
  { sku:'520002', name:'Mac & Cheese Bowl',      category:'Frozen Foods', subcategory:'Frozen Meals', profile:'China_Heavy', dailyAvg:3400, inventory: 102000, cost:1.50, retail:3.49 }, // ~4.3 wks Watch
  { sku:'520003', name:'Chicken Pot Pie',        category:'Frozen Foods', subcategory:'Frozen Meals', profile:'China_Heavy', dailyAvg: 580, inventory:  14500, cost:1.60, retail:3.79 }, // ~3.6 wks Low
  { sku:'520004', name:'Frozen Lasagna (10oz)',  category:'Frozen Foods', subcategory:'Frozen Meals', profile:'China_Heavy', dailyAvg: 420, inventory:  12600, cost:2.00, retail:4.49 }, // ~4.3 wks Watch
  { sku:'520005', name:'Frozen Stir Fry Kit',    category:'Frozen Foods', subcategory:'Frozen Meals', profile:'China_Heavy', dailyAvg:  88, inventory:   2200, cost:2.80, retail:5.99 }, // ~3.6 wks Low

  // ── Frozen Vegetables  (subcat 3 → 53xxxx) ───────────────────────────────────
  { sku:'530001', name:'Frozen Broccoli (12oz)', category:'Frozen Foods', subcategory:'Frozen Vegetables', profile:'China_Heavy', dailyAvg:1840, inventory:  82800, cost:0.90, retail:2.19 }, // ~6.5 wks Watch
  { sku:'530002', name:'Frozen Peas (16oz)',     category:'Frozen Foods', subcategory:'Frozen Vegetables', profile:'China_Heavy', dailyAvg: 760, inventory:  19000, cost:0.85, retail:1.99 }, // ~3.6 wks Low
  { sku:'530003', name:'Mixed Vegetables (16oz)', category:'Frozen Foods', subcategory:'Frozen Vegetables', profile:'China_Heavy', dailyAvg: 920, inventory:  27600, cost:0.90, retail:2.09 }, // ~4.3 wks Watch
  { sku:'530004', name:'Edamame (12oz)',         category:'Frozen Foods', subcategory:'Frozen Vegetables', profile:'China_Heavy', dailyAvg:  55, inventory:   1375, cost:1.20, retail:2.79 }, // ~3.6 wks Low
  { sku:'530005', name:'Frozen Corn (16oz)',     category:'Frozen Foods', subcategory:'Frozen Vegetables', profile:'China_Heavy', dailyAvg: 480, inventory:  16800, cost:0.80, retail:1.89 }, // ~5.0 wks Watch

  // ── Ice Cream & Desserts  (subcat 4 → 54xxxx) ────────────────────────────────
  { sku:'540001', name:'Vanilla Ice Cream (1.5qt)', category:'Frozen Foods', subcategory:'Ice Cream & Desserts', profile:'Balanced', dailyAvg:2640, inventory:  92400, cost:2.40, retail:5.49 }, // ~5.0 wks Watch
  { sku:'540002', name:'Chocolate Ice Cream (1.5qt)', category:'Frozen Foods', subcategory:'Ice Cream & Desserts', profile:'Balanced', dailyAvg:1980, inventory:  69300, cost:2.40, retail:5.49 }, // ~5.0 wks Watch
  { sku:'540003', name:'Strawberry Ice Cream (1.5qt)', category:'Frozen Foods', subcategory:'Ice Cream & Desserts', profile:'Balanced', dailyAvg: 840, inventory:  20160, cost:2.40, retail:5.49 }, // ~3.4 wks Low
  { sku:'540004', name:'Popsicles (12ct)',       category:'Frozen Foods', subcategory:'Ice Cream & Desserts', profile:'Balanced', dailyAvg: 620, inventory:  12400, cost:1.80, retail:4.29 }, // ~2.9 wks Low
  { sku:'540005', name:'Ice Cream Sandwiches (6ct)', category:'Frozen Foods', subcategory:'Ice Cream & Desserts', profile:'Balanced', dailyAvg: 520, inventory:  18200, cost:2.00, retail:4.49 }, // ~5.0 wks Watch

  // ══════════════════════════════════════════════════════════════════════════════
  // BEVERAGES  (dept 6)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Juice & Juice Drinks  (subcat 1 → 61xxxx) ────────────────────────────────
  { sku:'610001', name:'Orange Juice (64oz)',    category:'Beverages', subcategory:'Juice & Juice Drinks', profile:'Balanced', dailyAvg: 760, inventory:  14400, cost:2.20, retail:4.99 }, // ★ ~2.7 wks Low
  { sku:'610002', name:'Apple Juice (64oz)',     category:'Beverages', subcategory:'Juice & Juice Drinks', profile:'Balanced', dailyAvg:1980, inventory:  49500, cost:1.60, retail:3.79 }, // ~3.6 wks Low
  { sku:'610003', name:'Cranberry Juice (64oz)', category:'Beverages', subcategory:'Juice & Juice Drinks', profile:'Balanced', dailyAvg: 480, inventory:   9600, cost:2.00, retail:4.49 }, // ~2.9 wks Low
  { sku:'610004', name:'Grape Juice (64oz)',     category:'Beverages', subcategory:'Juice & Juice Drinks', profile:'Balanced', dailyAvg: 320, inventory:  11200, cost:1.80, retail:3.99 }, // ~5.0 wks Watch
  { sku:'610005', name:'Lemonade (59oz)',        category:'Beverages', subcategory:'Juice & Juice Drinks', profile:'Balanced', dailyAvg:1240, inventory:  24800, cost:1.40, retail:3.29 }, // ~2.9 wks Low
  { sku:'610006', name:'Pineapple Juice (46oz)', category:'Beverages', subcategory:'Juice & Juice Drinks', profile:'Balanced', dailyAvg:  72, inventory:   2520, cost:1.60, retail:3.49 }, // ~5.0 wks Watch

  // ── Water  (subcat 2 → 62xxxx) ────────────────────────────────────────────────
  { sku:'620001', name:'Spring Water (24pk)',    category:'Beverages', subcategory:'Water',         profile:'Balanced', dailyAvg:4200, inventory: 168000, cost:3.20, retail:6.99 }, // ~5.7 wks Watch
  { sku:'620002', name:'Sparkling Water (12pk)', category:'Beverages', subcategory:'Water',         profile:'Balanced', dailyAvg: 880, inventory:  19360, cost:3.60, retail:7.49 }, // ~3.1 wks Low
  { sku:'620003', name:'Flavored Water (12pk)',  category:'Beverages', subcategory:'Water',         profile:'Balanced', dailyAvg: 540, inventory:  16200, cost:2.80, retail:5.99 }, // ~4.3 wks Watch
  { sku:'620004', name:'Alkaline Water (1gal)',  category:'Beverages', subcategory:'Water',         profile:'Balanced', dailyAvg: 110, inventory:   2750, cost:1.80, retail:3.99 }, // ~3.6 wks Low
  { sku:'620005', name:'Distilled Water (1gal)', category:'Beverages', subcategory:'Water',         profile:'Balanced', dailyAvg:  62, inventory:   2170, cost:0.80, retail:1.79 }, // ~5.0 wks Watch

  // ── Soft Drinks  (subcat 3 → 63xxxx) ─────────────────────────────────────────
  { sku:'630001', name:'Cola (12pk)',            category:'Beverages', subcategory:'Soft Drinks',   profile:'China_Heavy', dailyAvg:5600, inventory: 196000, cost:3.80, retail:7.99 }, // ~5.0 wks Watch
  { sku:'630002', name:'Diet Cola (12pk)',       category:'Beverages', subcategory:'Soft Drinks',   profile:'China_Heavy', dailyAvg:2800, inventory:  84000, cost:3.80, retail:7.99 }, // ~4.3 wks Watch
  { sku:'630003', name:'Lemon-Lime Soda (12pk)', category:'Beverages', subcategory:'Soft Drinks',  profile:'China_Heavy', dailyAvg:2100, inventory:  63000, cost:3.60, retail:7.49 }, // ~4.3 wks Watch
  { sku:'630004', name:'Root Beer (12pk)',       category:'Beverages', subcategory:'Soft Drinks',   profile:'China_Heavy', dailyAvg: 680, inventory:  20400, cost:3.60, retail:7.49 }, // ~4.3 wks Watch
  { sku:'630005', name:'Ginger Ale (12pk)',      category:'Beverages', subcategory:'Soft Drinks',   profile:'China_Heavy', dailyAvg: 340, inventory:   8500, cost:3.40, retail:6.99 }, // ~3.6 wks Low

  // ── Coffee & Tea  (subcat 4 → 64xxxx) ────────────────────────────────────────
  { sku:'640001', name:'Ground Coffee (12oz)',   category:'Beverages', subcategory:'Coffee & Tea',  profile:'US_Heavy', dailyAvg:1960, inventory:  68600, cost:4.20, retail:9.49  }, // ~5.0 wks Watch
  { sku:'640002', name:'Whole Bean Coffee (12oz)', category:'Beverages', subcategory:'Coffee & Tea', profile:'US_Heavy', dailyAvg: 480, inventory:  14400, cost:5.00, retail:11.49 }, // ~4.3 wks Watch
  { sku:'640003', name:'K-Cups (24ct)',          category:'Beverages', subcategory:'Coffee & Tea',  profile:'US_Heavy', dailyAvg:1640, inventory:  49200, cost:8.00, retail:16.99 }, // ~4.3 wks Watch
  { sku:'640004', name:'Black Tea (100ct)',      category:'Beverages', subcategory:'Coffee & Tea',  profile:'US_Heavy', dailyAvg: 380, inventory:  11400, cost:2.40, retail:5.49  }, // ~4.3 wks Watch
  { sku:'640005', name:'Green Tea (40ct)',       category:'Beverages', subcategory:'Coffee & Tea',  profile:'US_Heavy', dailyAvg:  88, inventory:   2200, cost:2.00, retail:4.49  }, // ~3.6 wks Low

  // ══════════════════════════════════════════════════════════════════════════════
  // PANTRY  (dept 7)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Pasta & Rice  (subcat 1 → 71xxxx) ────────────────────────────────────────
  { sku:'710001', name:'Pasta (16oz)',           category:'Pantry', subcategory:'Pasta & Rice',     profile:'Balanced', dailyAvg: 440, inventory:  34300, cost:0.65, retail:1.49 }, // ★ ~11.2 wks Good
  { sku:'710002', name:'White Rice (5lb)',       category:'Pantry', subcategory:'Pasta & Rice',     profile:'Balanced', dailyAvg: 290, inventory:  10200, cost:2.50, retail:4.99 }, // ★ ~5.0 wks Watch
  { sku:'710003', name:'Penne (16oz)',           category:'Pantry', subcategory:'Pasta & Rice',     profile:'Balanced', dailyAvg: 680, inventory:  47600, cost:0.70, retail:1.59 }, // ~10.0 wks Good
  { sku:'710004', name:'Rotini (16oz)',          category:'Pantry', subcategory:'Pasta & Rice',     profile:'Balanced', dailyAvg: 520, inventory:  36400, cost:0.70, retail:1.59 }, // ~10.0 wks Good
  { sku:'710005', name:'Brown Rice (2lb)',       category:'Pantry', subcategory:'Pasta & Rice',     profile:'Balanced', dailyAvg: 380, inventory:  13300, cost:1.80, retail:3.79 }, // ~5.0 wks Watch
  { sku:'710006', name:'Jasmine Rice (5lb)',     category:'Pantry', subcategory:'Pasta & Rice',     profile:'Balanced', dailyAvg: 460, inventory:  16100, cost:2.60, retail:5.49 }, // ~5.0 wks Watch
  { sku:'710007', name:'Orzo (16oz)',            category:'Pantry', subcategory:'Pasta & Rice',     profile:'Balanced', dailyAvg:  62, inventory:   1550, cost:0.80, retail:1.79 }, // ~3.6 wks Low

  // ── Cereals & Oatmeal  (subcat 2 → 72xxxx) ───────────────────────────────────
  { sku:'720001', name:'Cereal (18oz)',          category:'Pantry', subcategory:'Cereals & Oatmeal', profile:'US_Heavy', dailyAvg: 175, inventory:   6100, cost:2.00, retail:4.49 }, // ★ ~5.0 wks Watch
  { sku:'720002', name:'Oatmeal (42oz)',         category:'Pantry', subcategory:'Cereals & Oatmeal', profile:'US_Heavy', dailyAvg:2200, inventory:  99000, cost:2.60, retail:5.49 }, // ~6.5 wks Watch
  { sku:'720003', name:'Granola (12oz)',         category:'Pantry', subcategory:'Cereals & Oatmeal', profile:'US_Heavy', dailyAvg: 480, inventory:   9600, cost:2.20, retail:4.99 }, // ~2.9 wks Low
  { sku:'720004', name:'Corn Flakes (18oz)',     category:'Pantry', subcategory:'Cereals & Oatmeal', profile:'US_Heavy', dailyAvg: 580, inventory:  20300, cost:1.80, retail:3.99 }, // ~5.0 wks Watch
  { sku:'720005', name:'Raisin Bran (20oz)',     category:'Pantry', subcategory:'Cereals & Oatmeal', profile:'US_Heavy', dailyAvg:  92, inventory:   2760, cost:2.00, retail:4.49 }, // ~4.3 wks Watch
  { sku:'720006', name:'Honey Bunches (14.5oz)', category:'Pantry', subcategory:'Cereals & Oatmeal', profile:'US_Heavy', dailyAvg: 740, inventory:  25900, cost:2.40, retail:4.99 }, // ~5.0 wks Watch

  // ── Canned Goods  (subcat 3 → 73xxxx) ────────────────────────────────────────
  { sku:'730001', name:'Canned Tomatoes (28oz)', category:'Pantry', subcategory:'Canned Goods',    profile:'Balanced', dailyAvg:1840, inventory:  82800, cost:0.80, retail:1.89 }, // ~6.5 wks Watch
  { sku:'730002', name:'Canned Chickpeas (15oz)', category:'Pantry', subcategory:'Canned Goods',   profile:'Balanced', dailyAvg:  82, inventory:   2460, cost:0.60, retail:1.39 }, // ~4.3 wks Watch
  { sku:'730003', name:'Canned Tuna (5oz)',      category:'Pantry', subcategory:'Canned Goods',    profile:'Balanced', dailyAvg:1280, inventory:  44800, cost:0.90, retail:2.19 }, // ~5.0 wks Watch
  { sku:'730004', name:'Black Beans (15oz)',     category:'Pantry', subcategory:'Canned Goods',    profile:'Balanced', dailyAvg: 680, inventory:  17000, cost:0.55, retail:1.29 }, // ~3.6 wks Low
  { sku:'730005', name:'Chicken Broth (32oz)',   category:'Pantry', subcategory:'Canned Goods',    profile:'Balanced', dailyAvg: 920, inventory:  27600, cost:1.20, retail:2.79 }, // ~4.3 wks Watch

  // ── Condiments & Sauces  (subcat 4 → 74xxxx) ─────────────────────────────────
  { sku:'740001', name:'Ketchup (32oz)',         category:'Pantry', subcategory:'Condiments & Sauces', profile:'US_Heavy', dailyAvg:1640, inventory:  57400, cost:1.10, retail:2.69 }, // ~5.0 wks Watch
  { sku:'740002', name:'Yellow Mustard (14oz)',  category:'Pantry', subcategory:'Condiments & Sauces', profile:'US_Heavy', dailyAvg: 680, inventory:  23800, cost:0.70, retail:1.69 }, // ~5.0 wks Watch
  { sku:'740003', name:'Mayonnaise (30oz)',      category:'Pantry', subcategory:'Condiments & Sauces', profile:'US_Heavy', dailyAvg: 820, inventory:  24600, cost:2.20, retail:4.99 }, // ~4.3 wks Watch
  { sku:'740004', name:'Ranch Dressing (16oz)',  category:'Pantry', subcategory:'Condiments & Sauces', profile:'US_Heavy', dailyAvg:1240, inventory:  43400, cost:1.40, retail:3.29 }, // ~5.0 wks Watch
  { sku:'740005', name:'Pasta Sauce (24oz)',     category:'Pantry', subcategory:'Condiments & Sauces', profile:'US_Heavy', dailyAvg: 960, inventory:  28800, cost:1.60, retail:3.49 }, // ~4.3 wks Watch

  // ── Snacks  (subcat 5 → 75xxxx) ──────────────────────────────────────────────
  { sku:'750001', name:'Potato Chips (8oz)',     category:'Pantry', subcategory:'Snacks',           profile:'Balanced', dailyAvg:4800, inventory: 168000, cost:1.80, retail:4.29 }, // ~5.0 wks Watch
  { sku:'750002', name:'Tortilla Chips (11oz)',  category:'Pantry', subcategory:'Snacks',           profile:'Balanced', dailyAvg:2960, inventory:  88800, cost:1.60, retail:3.79 }, // ~4.3 wks Watch
  { sku:'750003', name:'Pretzels (16oz)',        category:'Pantry', subcategory:'Snacks',           profile:'Balanced', dailyAvg: 680, inventory:  23800, cost:1.40, retail:3.29 }, // ~5.0 wks Watch
  { sku:'750004', name:'Popcorn (3pk)',          category:'Pantry', subcategory:'Snacks',           profile:'Balanced', dailyAvg:1040, inventory:  36400, cost:1.80, retail:3.99 }, // ~5.0 wks Watch
  { sku:'750005', name:'Trail Mix (9oz)',        category:'Pantry', subcategory:'Snacks',           profile:'Balanced', dailyAvg: 380, inventory:   9500, cost:2.00, retail:4.49 }, // ~3.6 wks Low
]

// ── Inventory augmentation (lead time, promo price, on order, in transit, fill rate) ──────────────

const _LEAD_TIME_BY_SUBCATEGORY = {
  'Fresh Fruits': 3, 'Fresh Vegetables': 3,
  'Eggs': 4, 'Milk': 4, 'Cheese': 4, 'Yogurt': 4, 'Butter & Margarine': 4, 'Cream': 4,
  'Beef': 3, 'Poultry': 3, 'Pork': 3, 'Seafood': 4,
  'Bread & Rolls': 2, 'Tortillas & Wraps': 2, 'Pastries & Desserts': 2,
  'Frozen Pizza': 7, 'Frozen Meals': 7, 'Frozen Vegetables': 7, 'Ice Cream & Desserts': 7,
  'Juice & Juice Drinks': 10, 'Water': 10, 'Soft Drinks': 10, 'Coffee & Tea': 10,
  'Pasta & Rice': 14, 'Cereals & Oatmeal': 14, 'Canned Goods': 14, 'Condiments & Sauces': 14, 'Snacks': 14,
}

// Deterministic pseudo-random seeded from SKU int + offset
function _skuRng(sku, offset) {
  let n = (parseInt(sku, 10) + offset * 9973) | 0
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  return ((n >>> 0) / 0xffffffff)
}

const _STAPLE_SUBCATS = new Set(['Eggs', 'Milk', 'Bread & Rolls', 'Pasta & Rice', 'Canned Goods', 'Water'])

PRODUCTS.forEach(p => {
  const lt = _LEAD_TIME_BY_SUBCATEGORY[p.subcategory] ?? 7
  p.leadTime  = lt
  const oo    = Math.round(p.dailyAvg * lt * 0.8)
  p.onOrder   = oo
  p.inTransit = Math.round(oo * 0.4)
  // promoPrice: retail × 0.75–0.90 rounded down to nearest .99
  const discFrac = 0.75 + _skuRng(p.sku, 1) * 0.15
  p.promoPrice   = Math.floor(p.retail * discFrac) + 0.99
  // fillRate: 96.5–99.5 for staples, 92.0–99.5 for others
  const base   = _STAPLE_SUBCATS.has(p.subcategory) ? 96.5 : 92.0
  const range  = _STAPLE_SUBCATS.has(p.subcategory) ?  3.0 :  7.5
  p.fillRate   = parseFloat((base + _skuRng(p.sku, 2) * range).toFixed(1))
})

// ── Derived lookup helpers ─────────────────────────────────────────────────────

export const CATEGORIES = [...new Set(PRODUCTS.map(p => p.category))]

export const SUBCATEGORIES_BY_CATEGORY = CATEGORIES.reduce((acc, cat) => {
  acc[cat] = [...new Set(PRODUCTS.filter(p => p.category === cat).map(p => p.subcategory))]
  return acc
}, {})

export const PRODUCTS_BY_SUBCATEGORY = PRODUCTS.reduce((acc, p) => {
  if (!acc[p.subcategory]) acc[p.subcategory] = []
  acc[p.subcategory].push(p)
  return acc
}, {})

export const PRODUCTS_BY_SKU = PRODUCTS.reduce((acc, p) => {
  acc[p.sku] = p
  return acc
}, {})
