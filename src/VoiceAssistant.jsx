import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Mic, X, Clipboard, Check, Languages } from 'lucide-react'
import { CATEGORIES } from './data/groceryProducts'
import { DEPT_CONVERSATIONS_ES } from './dept_conversations_es'
import { DEPT_CONVERSATIONS_DE } from './dept_conversations_de'
import { DEPT_CONVERSATIONS_JA } from './dept_conversations_ja'
import { DEPT_CONVERSATIONS_KO } from './dept_conversations_ko'
import { DEPT_CONVERSATIONS_ZH } from './dept_conversations_zh'

// ── Country metadata ────────────────────────────────────────────────────────
const COUNTRY_META = {
  'United States': { flag: '🇺🇸', label: 'United States' },
  'Canada':        { flag: '🇨🇦', label: 'Canada' },
  'Mexico':        { flag: '🇲🇽', label: 'Mexico' },
  'Germany':       { flag: '🇩🇪', label: 'Germany' },
  'Japan':         { flag: '🇯🇵', label: 'Japan' },
  'Korea':         { flag: '🇰🇷', label: 'Korea' },
  'China':         { flag: '🇨🇳', label: 'China' },
}

// ── Scripted conversations per country ─────────────────────────────────────
const CONVERSATIONS = {
  'United States': [
    { role: 'user', text: 'Why are unit sales down 8% in CA this week?' },
    { role: 'ai', text: 'The drop is concentrated in LA and SF. SKU 1042 hit stockout across both DCs. West Coast replenishment runs 6 days, so recovery is Thursday at the earliest.' },
    { role: 'user', text: "What's the revenue risk if we don't act by EOD?" },
    { role: 'ai', text: "We're projecting $420K in lost revenue over 72 hours, plus SLA exposure on 3 key retail accounts with breach windows opening tomorrow morning." },
    { role: 'user', text: 'Should we reroute from the Phoenix DC?' },
    { role: 'ai', text: 'Yes. Phoenix has 1,200 units of SKU 1042 and can reach LA in ~18 hours via ground priority, covering ~60% of the demand gap immediately.' },
  ],
  'Canada': [
    { role: 'user', text: 'Why is shipment time spiking across Ontario?' },
    { role: 'ai', text: 'A winter storm hit the Toronto to Montreal corridor Tuesday. Carriers are running 2 to 3 day delays and our Mississauga DC lost 4 loading bays to ice damage.' },
    { role: 'user', text: 'Are we at risk of SLA breaches?' },
    { role: 'ai', text: '14 enterprise accounts are at risk, 8 in Ontario and 6 in Quebec. The first breach window opens in 36 hours.' },
    { role: 'user', text: 'Can air freight bridge the gap?' },
    { role: 'ai', text: 'Air out of Pearson covers the Montreal shortfall. It adds $38/unit, but that\'s ~$215K in expedite cost vs. ~$580K in SLA penalties. Air freight wins here.' },
  ],
  'Mexico': [
    { role: 'user', text: '¿Qué está causando los retrasos de cumplimiento en Monterrey?' },
    { role: 'ai', text: 'Los volúmenes de inspección de la CBP en Laredo aumentaron un 40%. El tiempo de permanencia promedio pasó de 4 a 11 horas. Tres camiones con destino norte están en inspección secundaria en este momento.' },
    { role: 'user', text: '¿Cómo afecta esto a nuestra puntuación de salud de inventario?' },
    { role: 'ai', text: 'Monterrey cayó al 58% de salud, impulsado por retrasos en la entrada de SKU 2210 y SKU 2215, ambos vinculados a los camiones retenidos.' },
    { role: 'user', text: '¿Cuál es nuestra mejor contingencia?' },
    { role: 'ai', text: 'Abastece el 60% del SKU 2210 desde Guadalajara. Evita la frontera por completo con un tiempo de entrega de 2 días frente a más de 6 para el envío retenido. Se recomienda tomar esa decisión hoy.' },
  ],
  'Germany': [
    { role: 'user', text: 'Warum ist die Dock-Effizienz am Hamburger Terminal gesunken?' },
    { role: 'ai', text: 'Hamburg hat letzten Montag auf das neue EU-Zollerklärungssystem umgestellt. Die Bearbeitungszeit pro Manifest stieg von 12 auf 31 Minuten. Die Teams haben die Schulung zum neuen Protokoll noch nicht abgeschlossen.' },
    { role: 'user', text: 'Sind wir EU-Compliance-Strafen ausgesetzt?' },
    { role: 'ai', text: 'Zwei Sendungen haben das 24-Stunden-Voranmeldefenster gemäß ICS2 verpasst. Das Strafrisiko beträgt 4.200 €. Verspätete Erklärungen sollten bis Freitag eingereicht werden.' },
    { role: 'user', text: 'Wann normalisiert sich die Effizienz wieder?' },
    { role: 'ai', text: 'Die Schulung endet Ende der Woche. Wir erwarten eine Rückkehr zu 18-minütigen Dock-Zeiten bis Montag, was den Durchsatz wieder innerhalb der SLA bringt.' },
  ],
  'Japan': [
    { role: 'user', text: 'キュー時間が増加しています。原因は何ですか？' },
    { role: 'ai', text: '大阪工場が先週3日間のカイゼンイベントを実施し、ピッカーのスループットが一時的に22%低下しました。キュー深度は94ユニットでピークとなり、40ユニットのJIT閾値を大きく上回りました。' },
    { role: 'user', text: '廃棄率はまだ仕様の範囲内ですか？' },
    { role: 'ai', text: '不良率は0.018%で仕様内です。ただし、動作ムダが増加しています。カイゼンチームはピックパックフローで3つの冗長ステップを特定しており、削除後にユニットあたり8秒の短縮が見込まれます。' },
    { role: 'user', text: '完全なJITフローはいつ再開しますか？' },
    { role: 'ai', text: '改訂された標準は月曜日に施行されます。モデリングでは、実施から48時間以内にキュー深度が35ユニットに戻ることが示されています。' },
  ],
  'Korea': [
    { role: 'user', text: '이번 주 서울의 판매 급증 원인은 무엇인가요?' },
    { role: 'ai', text: '주요 전자제품 출시로 SKU K77의 수요가 340% 급증했습니다. 모델이 출시일과의 상관관계를 놓쳤고, 현재 재고는 2.1일치 수요만 충당 가능합니다.' },
    { role: 'user', text: '유통 네트워크가 이를 감당할 수 있나요?' },
    { role: 'ai', text: '인천 허브가 94% 용량에 달했습니다. 부산에 초과 물량이 있지만 경로 추가로 6시간이 더 소요되어 익일 SLA가 위험해집니다.' },
    { role: 'user', text: '다음에 이런 예측 오류를 어떻게 방지할 수 있을까요?' },
    { role: 'ai', text: '마케팅 출시 캘린더를 예측 모델에 통합했다면 3주 전에 이를 포착할 수 있었을 것입니다. 해당 피드는 약 2일 내에 구축 가능합니다.' },
  ],
  'China': [
    { role: 'user', text: '为什么上海的出口履行率低于目标？' },
    { role: 'ai', text: '浦东正处理黄金周补货带来的超额订单，比正常量高出18%。纸箱封装线是瓶颈，当前上限为每小时4,200件，而目标是5,800件。' },
    { role: 'user', text: '这对美国交货时间有什么影响？' },
    { role: 'ai', text: '6批集装箱货物平均延误3.2天。美国零售合作伙伴将在12月11日至12日收到圣诞前库存，而非原定的12月8日。' },
    { role: 'user', text: '我们可以对高优先级的SKU进行空运吗？' },
    { role: 'ai', text: '从PVG空运可覆盖利润率最高的4个SKU：C14、C19、C22、C31。费用为18万美元，但可保护210万美元的节假日利润。建议立即批准这些SKU的空运。' },
  ],
}

// ── English versions for non-English countries ─────────────────────────────
const CONVERSATIONS_EN = {
  'Mexico': [
    { role: 'user', text: "What's causing the fulfillment delays in Monterrey?" },
    { role: 'ai', text: 'CBP inspection volumes at Laredo are up 40%. Average dwell time jumped from 4 to 11 hours. Three northbound trucks are in secondary inspection right now.' },
    { role: 'user', text: 'How does this affect our inventory health score?' },
    { role: 'ai', text: 'Monterrey dropped to 58% health, driven by inbound delays on SKU 2210 and SKU 2215, both tied to the held trucks.' },
    { role: 'user', text: "What's our best contingency?" },
    { role: 'ai', text: 'Source 60% of SKU 2210 from Guadalajara. It bypasses the border entirely with a 2 day lead time vs. 6+ for the held shipment. Recommend pulling that lever today.' },
  ],
  'Germany': [
    { role: 'user', text: 'Why is dock efficiency down at the Hamburg terminal?' },
    { role: 'ai', text: "Hamburg upgraded to the new EU customs declaration system last Monday. Processing time per manifest jumped from 12 to 31 minutes. Teams haven't completed the new protocol training yet." },
    { role: 'user', text: 'Are we exposed to any EU compliance penalties?' },
    { role: 'ai', text: 'Two shipments missed the 24 hour pre arrival notification window under ICS2. Penalty exposure is €4,200. Late declarations should be filed before Friday.' },
    { role: 'user', text: 'When will efficiency normalize?' },
    { role: 'ai', text: "Training completes end of week. We're projecting a return to 18 minute dock times by Monday, which brings throughput back within SLA." },
  ],
  'Japan': [
    { role: 'user', text: "Queue times are up. What's driving it?" },
    { role: 'ai', text: 'The Osaka facility ran a 3 day kaizen event last week, temporarily cutting picker throughput 22%. Queue depth peaked at 94 units, well above the 40 unit JIT threshold.' },
    { role: 'user', text: 'Is the waste ratio still within spec?' },
    { role: 'ai', text: 'Defect rate is 0.018%, within spec. Motion waste is elevated though. The kaizen team flagged 3 redundant steps in the pick pack flow that will cut 8 seconds per unit once removed.' },
    { role: 'user', text: 'When does full JIT flow resume?' },
    { role: 'ai', text: 'The revised standard takes effect Monday. Modeling shows queue depth returning to 35 units within 48 hours of implementation.' },
  ],
  'Korea': [
    { role: 'user', text: "What's driving the sales spike in Seoul this week?" },
    { role: 'ai', text: 'A major electronics launch triggered a 340% demand surge for SKU K77. Our model missed the correlation to the launch date. Current inventory covers only 2.1 days of demand.' },
    { role: 'user', text: 'Can the distribution network handle this?' },
    { role: 'ai', text: 'Incheon hub is at 94% capacity. We have overflow at Busan, but routing adds 6 hours and puts next day SLAs at risk.' },
    { role: 'user', text: 'How do we prevent this forecast miss next time?' },
    { role: 'ai', text: 'Integrating the marketing launch calendar into the forecast model would have flagged this 3 weeks out. That feed can be built in about 2 days.' },
  ],
  'China': [
    { role: 'user', text: 'Why is export fulfillment below target in Shanghai?' },
    { role: 'ai', text: 'Pudong is processing 18% above normal volume from Golden Week restocks. The carton sealing line is the bottleneck, capped at 4,200 units/hour vs. 5,800 target.' },
    { role: 'user', text: "What's the downstream impact on US delivery timelines?" },
    { role: 'ai', text: '6 container shipments are delayed an average of 3.2 days. US retail partners will see pre Christmas stock arrive Dec 11 to 12 instead of Dec 8.' },
    { role: 'user', text: 'Can we air freight the high priority SKUs?' },
    { role: 'ai', text: 'Air from PVG covers the top 4 margin SKUs: C14, C19, C22, C31. Cost is $180K but protects $2.1M in holiday margin. Recommend approving air freight for those SKUs immediately.' },
  ],
}

// ── Department-scoped conversations (English, all depts) ────────────────────
const DEPT_CONVERSATIONS = {
  'All Departments': [
    { role: 'user', text: "What's our overall inventory health across all departments right now?" },
    { role: 'ai',   text: "Pantry and Beverages are in good shape. Spring Water, Cola, and Pasta are all above 5 weeks on hand. Produce is the tightest spot: Bananas, Roma Tomatoes, and Baby Spinach are all under 3.5 weeks. Dairy is mixed, with Greek Yogurt and several butter SKUs running low across the board." },
    { role: 'user', text: 'Which departments have the most SKUs at risk of stockout?' },
    { role: 'ai',   text: "Produce leads with 6 of 14 SKUs in the Low tier. Dairy & Eggs has 8 low stock SKUs, mostly in Yogurt and Butter. Bakery's Pastries subcategory is tight: Croissants, Blueberry Muffins, and Glazed Donuts are all under 3.6 weeks. Meat & Seafood's entire seafood aisle is in the Low tier." },
    { role: 'user', text: 'What should we prioritize in the next replenishment cycle?' },
    { role: 'ai',   text: "Top three actions: (1) Rush replenishment on Bananas and Roma Tomatoes, both high velocity and under 3 weeks. (2) Reorder Greek Yogurt and Butter (1lb) before the 4 day lead time expires. (3) Flag Croissants and Blueberry Muffins, only a 2 day lead time but current stock won't carry through the weekend." },
    { role: 'user', text: 'Give me your top recommendations right now.' },
    { role: 'ai',   text: "• Produce: Order 2,000 units Bananas and 1,500 units Roma Tomatoes today\n• Dairy: Reorder 800 units Greek Yogurt and 600 units Butter (1lb) before lead time closes\n• Bakery: Submit 700 units Brioche Buns and 500 units Croissants immediately\n• Seafood: Order 1,200 units Shrimp and 900 units Salmon Fillet to prevent weekend stockout\n• Pricing: Mark down Blueberries 20% and Peaches 25% to cut spoilage losses this week" },
    { role: 'user', text: 'Approved. Please push all recommendations to the relevant teams.' },
    { role: 'ai',   pause: 2000, text: "Done. Ordering team notified: Bananas (2,000 units), Roma Tomatoes (1,500 units), Baby Spinach (600 units), Greek Yogurt (800 units), Butter 1lb (600 units), Brioche Buns (700 units), Croissants (500 units), Shrimp (1,200 units), and Salmon Fillet (900 units). Pricing team flagged to mark down Blueberries 20% and Peaches 25% effective today." },
  ],
  'Produce': [
    { role: 'user', text: 'What does our spoilage picture look like across produce right now?' },
    { role: 'ai',   text: "Berries are our biggest spoilage risk. Blueberries are at 3.2 WOS and Strawberries at 6.9 WOS but both have shelf lives of only 5 to 7 days after receipt, and we are seeing an estimated 8 to 12% spoilage rate on those SKUs this week. Peaches are the worst case at 2.3 WOS with slow enough velocity that we expect roughly 15% loss before sell through." },
    { role: 'user', text: 'How do inventory turn rates compare across the department?' },
    { role: 'ai',   text: "Fresh Vegetables are turning faster than fruits. Carrots lead at approximately 35 annual turns driven by 2,680 daily units. Broccoli Crown and Roma Tomatoes are in the 20 to 25 turns range. On the fruit side, Bananas turn roughly 26 times per year at 1,820 daily units but Peaches and Blueberries are well below 10 annual turns and sitting in spoilage risk territory." },
    { role: 'user', text: 'What actions can we take this week to reduce spoilage losses?' },
    { role: 'ai',   text: "Three levers: first, run a markdown promotion on Peaches and Blueberries today at 20% off to drive velocity before shelf life expires. Second, reduce the inbound order on Blueberries by 30% for the next cycle given the low turns. Third, shift Strawberry receiving from twice weekly to three times weekly in smaller batches to keep product fresher on shelf." },
    { role: 'user', text: 'What should we do right now?' },
    { role: 'ai',   text: "• Order 2,000 units Bananas and 1,500 units Roma Tomatoes today (3 day lead time)\n• Order 600 units Baby Spinach and 400 units Cucumber before end of day\n• Mark down Peaches 25% and Blueberries 20% immediately to cut spoilage\n• Reduce next Blueberry inbound order by 30% to match current turn rate\n• Raise Strawberry reorder point by 20% ahead of spring demand increase" },
    { role: 'user', text: 'Approved, push changes to the ordering and pricing teams, but reject the suggestion regarding reordering Strawberries' },
    { role: 'ai',   pause: 2000, segments: [
      { text: "Done. Ordering team notified with updated quantities for Bananas (2,000 units), Roma Tomatoes (1,500 units), Baby Spinach (600 units), and Cucumber (400 units). Pricing team flagged to apply 25% markdown on Peaches and 20% markdown on Blueberries effective today." },
      { text: "\nStrawberry reorder suggestion rejected per your instruction.", color: '#ff6b6b' },
    ]},
  ],
  'Dairy & Eggs': [
    { role: 'user', text: 'Which dairy SKUs have the highest spoilage exposure right now?' },
    { role: 'ai',   text: "Yogurt is our most vulnerable category. Greek Yogurt, Vanilla Yogurt, and Strawberry Yogurt all have shelf lives under 30 days and current stock below 4 WOS. Strawberry Yogurt is turning at roughly 13 times per year which is low for a perishable at that price point. Whipped Butter and Vegan Butter are also concern items with under 3 WOS and slow velocity." },
    { role: 'user', text: 'How are turn rates looking for milk and eggs?' },
    { role: 'ai',   text: "2% Milk is our best performer in the category. At 9.3 WOS and 2,180 daily units its annual turn rate is around 24, which is healthy for a perishable staple. Eggs (12pk) at 9.0 WOS and 1,560 daily units is similarly strong. Oat Milk is the outlier at only 3.0 WOS on 920 daily units, meaning turns are high but we are constantly at risk of running out before the next replenishment arrives." },
    { role: 'user', text: 'What should we do about the slow turning perishables?' },
    { role: 'ai',   text: "Skyr Yogurt and Coconut Yogurt both have under 10 annual turns and are approaching sell by risk. I would recommend reducing standard order quantities by 25% on both and placing a markdown label on current shelf stock. Vegan Butter and European Butter are similar cases, low velocity with a 4 day lead time creating reorder complexity. Consider consolidating to one specialty butter SKU until velocity improves." },
    { role: 'user', text: 'Give me the action items.' },
    { role: 'ai',   text: "• Order 1,100 units Oat Milk today (4 day lead time, at risk by Thursday)\n• Reorder 800 units Greek Yogurt, 600 units Vanilla Yogurt, 500 units Strawberry Yogurt\n• Reorder 500 units Butter (1lb) and 300 units Whipped Butter before weekend\n• Mark down Skyr Yogurt and Coconut Yogurt 20% to clear slow turning perishable stock\n• Cut Skyr and Coconut Yogurt order quantities by 25% on next cycle" },
    { role: 'user', text: 'Please push recommendations to the ordering team and message the pricing team regarding the markdowns.' },
    { role: 'ai',   pause: 2000, text: "Done. Ordering team notified with quantities for Oat Milk (1,100 units), Greek Yogurt (800 units), Vanilla Yogurt (600 units), Strawberry Yogurt (500 units), Butter 1lb (500 units), and Whipped Butter (300 units). Skyr and Coconut Yogurt order quantities reduced 25% in the next cycle. Pricing team messaged to apply 20% markdown on Skyr Yogurt and Coconut Yogurt effective immediately." },
  ],
  'Meat & Seafood': [
    { role: 'user', text: 'Which items are at stockout risk this week?' },
    { role: 'ai',   text: "All four seafood SKUs are in the Low tier and approaching critical levels. Shrimp is the highest volume concern at 520 units per day and only 3.6 WOS. Salmon Fillet is at 3.6 WOS on 340 daily units. With a 4 day lead time, any demand spike could push Shrimp to a full stockout by the weekend. Tilapia and Cod are in the same range and need orders placed today." },
    { role: 'user', text: 'What are the current WOS numbers across beef and poultry?' },
    { role: 'ai',   text: "Beef is healthy overall. Ground Beef leads at 8.9 WOS and serves as our anchor SKU for the department. Ribeye Steak and NY Strip are both at 4.3 WOS in the Watch tier. In poultry, Chicken Breast is solid at 8.0 WOS and Chicken Wings are at 5.0 WOS on 2,840 daily units. Turkey Breast is the weak link at 3.6 WOS and 115 daily units, close enough to Low that a reorder is due." },
    { role: 'user', text: 'Has there been any recent stockout history in this department?' },
    { role: 'ai',   text: "We had a near stockout on Salmon Fillet two weeks ago when weekend demand pushed velocity to 480 units per day versus the 340 baseline. The system flagged it too late and we hit zero stock for about 6 hours on Saturday. The recommended fix is to raise the Salmon reorder point from 3.5 WOS to 5.0 WOS to build a buffer against weekend demand spikes. Pork Tenderloin also briefly ran out last week when an inbound truck arrived 2 days late from the distribution center." },
    { role: 'user', text: 'What are the next steps?' },
    { role: 'ai',   text: "• Order today: 1,200 units Shrimp, 900 units Salmon Fillet, 500 units Tilapia, 400 units Cod\n• Raise Salmon reorder point from 3.5 WOS to 5.0 WOS to buffer weekend spikes\n• Reorder 350 units Turkey Breast to move from Low to Watch tier\n• Increase Chicken Wings standing order by 15% ahead of summer grilling season\n• Flag premium beef cuts for weekend monitoring; alert DC if velocity exceeds 20% above baseline" },
    { role: 'user', text: 'Agree, forward recommendations to the ordering team and send a message to the DC.' },
    { role: 'ai',   pause: 2000, text: "Done. Ordering team notified with quantities: Shrimp (1,200 units), Salmon Fillet (900 units), Tilapia (500 units), Cod (400 units), Turkey Breast (350 units). DC message sent: Salmon reorder point raised to 5.0 WOS, Chicken Wings standing order increased 15% effective next cycle, and weekend monitoring flag set for premium beef cuts." },
  ],
  'Bakery': [
    { role: 'user', text: 'Which bakery items are closest to a stockout right now?' },
    { role: 'ai',   text: "Pastries are the most at risk. Croissants, Blueberry Muffins, and Cheese Danish are all under 3.0 WOS. At current velocity, Croissants at 480 daily units will run out in just over 2 weeks with no reorder placed. The 2 day lead time is the only buffer and it is razor thin. Glazed Donuts at 640 daily units and 3.6 WOS are next in line and also need attention." },
    { role: 'user', text: 'How are WOS levels across bread and rolls?' },
    { role: 'ai',   text: "Whole Wheat Bread leads the subcategory at 6.5 WOS on 1,840 daily units. Sourdough Bread is Watch at 4.5 WOS. The critical item is White Sandwich Bread at only 3.6 WOS and 2,480 daily units, our highest volume bakery SKU. A stockout there would have immediate customer impact. Brioche Buns are at 2.9 WOS and need a replenishment order placed today." },
    { role: 'user', text: 'Are there any stockout patterns we should know about in this department?' },
    { role: 'ai',   text: "Brioche Buns consistently hit Low inventory during holiday weekends when burger and sandwich builds spike. We had two partial stockouts in the last 60 days, both on Saturdays. Dinner Rolls also ran low around holiday periods. I recommend increasing the standing order quantity on Brioche Buns by 40% and adding a weekend demand multiplier to the Rolls reorder model to get ahead of the next holiday cycle." },
    { role: 'user', text: 'What do you recommend we do today?' },
    { role: 'ai',   text: "• Order 800 units Brioche Buns, 600 units Croissants, 450 units Blueberry Muffins immediately\n• Increase Brioche Buns standing order quantity by 40% starting next cycle\n• Order 3,000 units White Sandwich Bread to move from Low to Watch tier\n• Apply 1.3x weekend demand multiplier to Brioche Buns and Dinner Rolls reorder model\n• No price changes needed; bakery margins are healthy across all subcategories" },
    { role: 'user', text: 'Approved, push changes to the ordering team and apply multiplier calculation to the model.' },
    { role: 'ai',   pause: 2000, text: "Done. Ordering team notified: Brioche Buns (800 units), Croissants (600 units), Blueberry Muffins (450 units), White Sandwich Bread (3,000 units). Brioche Buns standing order increased 40% starting next cycle. Weekend demand multiplier of 1.3x applied to Brioche Buns and Dinner Rolls in the reorder model." },
  ],
  'Frozen Foods': [
    { role: 'user', text: 'What are our top selling frozen food items right now?' },
    { role: 'ai',   text: "Mac and Cheese Bowl leads Frozen Meals at 3,400 daily units and maps to the Stouffer's format, making it our single highest volume frozen SKU. Frozen Burrito is second at 2,160 daily units. In desserts, Vanilla Ice Cream runs 2,640 units per day and Chocolate Ice Cream 1,980. Frozen Broccoli leads vegetables at 1,840 daily units, tracking similarly to Birds Eye and Green Giant branded volumes in comparable markets." },
    { role: 'user', text: 'Which frozen pizza brands and SKUs are moving fastest?' },
    { role: 'ai',   text: "Our core Frozen Pizza SKU, which covers DiGiorno and Tombstone varieties, leads the segment at 460 units per day. Stouffer's French Bread Pizza format is second at 380 daily units. BBQ Chicken Pizza moves 280 daily units. The Cauliflower Crust and Gluten Free options are slower at under 100 units per day but represent a growing segment worth maintaining for assortment breadth." },
    { role: 'user', text: 'Are there brand gaps in our frozen assortment we should address?' },
    { role: 'ai',   text: "We are light on Birds Eye and Green Giant branded frozen vegetables, which are the two most requested brands in this category. We also have no Haagen Dazs or Ben and Jerry's representation in ice cream, which is a premium segment gap that competitors are filling. Adding one SKU from each of those brands could lift ice cream category revenue by an estimated 8 to 12% based on comparable store data." },
    { role: 'user', text: 'What are your recommendations?' },
    { role: 'ai',   text: "• Order 2,000 units Popsicles and 1,200 units Strawberry Ice Cream this week\n• Reorder 800 units Chicken Pot Pie and 350 units Frozen Stir Fry Kit given 7 day lead time\n• Increase Mac and Cheese Bowl standing order by 10%; it consistently approaches reorder threshold\n• Add 1 Haagen Dazs and 1 Ben and Jerry's SKU to ice cream set; projected +8 to 12% category lift\n• Run a 2 for $10 promo on Frozen Pizza varieties to lift velocity on slower SKUs" },
    { role: 'user', text: 'Make recommendations to the ordering team and message the pricing team about the promotion.' },
    { role: 'ai',   pause: 2000, text: "Done. Ordering team notified: Popsicles (2,000 units), Strawberry Ice Cream (1,200 units), Chicken Pot Pie (800 units), Frozen Stir Fry Kit (350 units). Mac and Cheese Bowl standing order increased 10% in the system. Pricing team messaged to activate the 2 for $10 Frozen Pizza promotion and review Haagen Dazs and Ben and Jerry's assortment additions." },
  ],
  'Beverages': [
    { role: 'user', text: 'What are our top selling beverage brands right now?' },
    { role: 'ai',   text: "Coca Cola leads the entire store at 5,600 daily units across our Cola 12 pack SKU, which is roughly 70% Coke and 30% Pepsi volume. Diet Coke and Coke Zero drive the Diet Cola segment at 2,800 daily units. Poland Spring and Dasani account for most of our Spring Water volume at 4,200 daily units, making water our second highest volume beverage category. Sprite and 7UP share the Lemon Lime segment at 2,100 daily units." },
    { role: 'user', text: 'How is the beer segment performing and what brands are leading?' },
    { role: 'ai',   text: "Bud Light is our top beer SKU running at strong velocity consistent with a top 3 national brand. Miller Lite and Coors Light are close behind in the light beer segment. Corona is our top import performer. We have a seasonal demand curve building for summer and will need a 20 to 30% inventory increase across all beer SKUs beginning next month to stay ahead of stockouts during peak grilling weekends." },
    { role: 'user', text: 'Are there coffee or juice brand gaps we should close?' },
    { role: 'ai',   text: "In coffee, we carry Ground Coffee and K Cups under Folgers and Maxwell House but have no Starbucks or Dunkin branded pods, which are among the top searched coffee products nationally. In juice, we carry Orange Juice and Apple Juice volume but lack explicit Tropicana and Minute Maid SKUs, which are the two brands consumers most frequently request. Closing those four brand gaps in coffee and juice could add 200 to 300 incremental daily units to the category." },
    { role: 'user', text: 'Walk me through the next steps.' },
    { role: 'ai',   text: "• Order today (10 day lead time): 1,800 units OJ, 3,500 units Apple Juice, 1,200 units Cranberry Juice, 2,200 units Lemonade\n• Order 1,500 units Sparkling Water and 600 units Alkaline Water immediately\n• Add Starbucks K Cups and Tropicana OJ to assortment; projected +200 to 300 daily units\n• Increase Bud Light, Miller Lite, and Corona inventory by 25% ahead of summer\n• Run 15% promotional price on Cranberry Juice to lift velocity before stock drops further" },
    { role: 'user', text: 'Approve changes, push to ordering team and inform the pricing team for promotional changes.' },
    { role: 'ai',   pause: 2000, text: "Done. Ordering team notified: OJ (1,800 units), Apple Juice (3,500 units), Cranberry Juice (1,200 units), Lemonade (2,200 units), Sparkling Water (1,500 units), Alkaline Water (600 units). Beer inventory increase of 25% queued for Bud Light, Miller Lite, and Corona. Pricing team notified to activate 15% promotional price on Cranberry Juice effective this week." },
  ],
  'Pantry': [
    { role: 'user', text: 'What are our top selling pantry brands and SKUs?' },
    { role: 'ai',   text: "Lay's Potato Chips lead all of Pantry at 4,800 daily units. Doritos drives the Tortilla Chips segment at 2,960 daily units. Quaker Oats accounts for the majority of our Oatmeal volume at 2,200 daily units, making it one of the strongest branded staples in the store. Heinz Ketchup at 1,640 daily units and Barilla Pasta at 440 daily units round out the top performing pantry brands." },
    { role: 'user', text: 'Which cereal and grain brands are performing best?' },
    { role: 'ai',   text: "Quaker is the anchor brand in grains. Kellogg's drives Corn Flakes at 580 daily units and Post Honey Bunches of Oats moves 740 daily units, making it our top named cereal SKU. Granola at 480 daily units is in the Watch tier and most of that volume ties to a single premium brand with limited substitution options, which is a risk if that brand has any supply issues. Ben's Original and Mahatma account for most of our rice volume across White Rice and Jasmine Rice." },
    { role: 'user', text: 'Are there brand gaps in snacks or condiments we should address?' },
    { role: 'ai',   text: "In condiments, we carry Heinz and Kraft but have no Hellmann's Mayonnaise on shelf, which is the most requested condiment brand in customer feedback surveys. In snacks, we are missing Pringles and Cheez It, two consistently high demand SKUs that would likely drive incremental volume rather than cannibalize existing Lay's and Doritos sales. Adding those three SKUs could add 300 to 400 incremental daily units to the snack and condiment subcategories." },
    { role: 'user', text: 'What do we need to act on today?' },
    { role: 'ai',   text: "• Order today (14 day lead time): 2,000 units Granola, 2,500 units Black Beans, 1,400 units Trail Mix\n• Reduce Pasta and Penne standing order by 20% to address 10+ WOS overstock\n• Add Hellmann's Mayonnaise, Pringles, and Cheez It to assortment; projected +300 to 400 daily units\n• Run 15% promotional price on Trail Mix to lift velocity out of the Low tier\n• Reallocate 1 Pasta shelf facing to a new snack SKU to optimize floor space" },
    { role: 'user', text: 'Approve changes, push to ordering team, send a message to the store planning team and inform the pricing team regarding the promotion suggestions.' },
    { role: 'ai',   pause: 2000, text: "Done. Ordering team notified: Granola (2,000 units), Black Beans (2,500 units), Trail Mix (1,400 units). Pasta and Penne standing orders reduced 20% in the system. Store planning team messaged to evaluate shelf reallocation, reducing Pasta facings by 1 and opening space for a new snack SKU. Pricing team notified to apply 15% promotional price on Trail Mix and review assortment additions for Hellmann's Mayonnaise, Pringles, and Cheez It." },
  ],
}

const DEPT_CONVERSATIONS_BY_COUNTRY = {
  Mexico:  DEPT_CONVERSATIONS_ES,
  Germany: DEPT_CONVERSATIONS_DE,
  Japan:   DEPT_CONVERSATIONS_JA,
  Korea:   DEPT_CONVERSATIONS_KO,
  China:   DEPT_CONVERSATIONS_ZH,
}

const ENGLISH_ONLY = new Set(['United States', 'Canada'])
const NATIVE_LABEL = { Mexico: 'Spanish', Germany: 'German', Japan: 'Japanese', Korea: 'Korean', China: 'Mandarin' }

// Native-language UI strings for non-English countries
const UI_TEXT = {
  'United States': { prompt: 'Click the mic button to start\nor use the text box', placeholder: 'How can I help you today…', translateTo: 'Translate to English', showIn: lang => `Show in ${lang}`, copied: 'Copied!', copy: 'Copy conversation' },
  'Canada':        { prompt: 'Click the mic button to start\nor use the text box', placeholder: 'How can I help you today…', translateTo: 'Translate to English', showIn: lang => `Show in ${lang}`, copied: 'Copied!', copy: 'Copy conversation' },
  'Mexico':        { prompt: 'Haz clic en el micrófono para comenzar\no usa el cuadro de texto', placeholder: '¿En qué puedo ayudarte hoy…', translateTo: 'Traducir al inglés', showIn: () => 'Mostrar en español', copied: '¡Copiado!', copy: 'Copiar conversación' },
  'Germany':       { prompt: 'Klicke auf das Mikrofon, um zu beginnen\noder nutze das Textfeld', placeholder: 'Wie kann ich Ihnen heute helfen…', translateTo: 'Ins Englische übersetzen', showIn: () => 'Auf Deutsch anzeigen', copied: 'Kopiert!', copy: 'Gespräch kopieren' },
  'Japan':         { prompt: 'マイクボタンをクリックして開始\nまたはテキストボックスを使用', placeholder: '今日はどのようにお手伝いできますか…', translateTo: '英語に翻訳', showIn: () => '日本語で表示', copied: 'コピーしました！', copy: '会話をコピー' },
  'Korea':         { prompt: '마이크 버튼을 클릭하여 시작하거나\n텍스트 상자를 사용하세요', placeholder: '오늘 어떻게 도와드릴까요…', translateTo: '영어로 번역', showIn: () => '한국어로 보기', copied: '복사됨!', copy: '대화 복사' },
  'China':         { prompt: '点击麦克风按钮开始\n或使用文本框', placeholder: '今天有什么可以帮您的…', translateTo: '翻译成英文', showIn: () => '显示中文', copied: '已复制！', copy: '复制对话' },
}

// ── AI typing dots ───────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 14px' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#f59e0b', display: 'inline-block',
          animation: `va-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  )
}

// ── User voice waveform ───────────────────────────────────────────────────────
const WAVE_HEIGHTS = [10, 20, 28, 18, 32, 14, 26, 20, 12, 24]
function VoiceWave() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '8px 14px', height: 44 }}>
      {WAVE_HEIGHTS.map((h, i) => (
        <span key={i} style={{
          display: 'inline-block', width: 3, borderRadius: 2,
          background: '#00bcd4', height: h,
          animation: `va-wave ${0.6 + (i % 4) * 0.15}s ease-in-out ${i * 0.07}s infinite alternate`,
        }} />
      ))}
    </div>
  )
}

// ── Typewriter text (user messages) ──────────────────────────────────────────
function TypewriterText({ text, color, onDone, onChar }) {
  const [displayed, setDisplayed] = useState('')
  const isCJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(text)
  useEffect(() => {
    setDisplayed('')
    let i = 0
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      onChar?.()
      if (i >= text.length) { clearInterval(id); onDone?.() }
    }, isCJK ? 100 : 65)
    return () => clearInterval(id)
  }, [text])
  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span style={{ borderRight: `2px solid ${color}`, marginLeft: 1, animation: 'va-cursor 0.7s step-end infinite' }}> </span>
      )}
    </span>
  )
}

// ── Anthropic spinner (AI avatar) ────────────────────────────────────────────
function AnthropicSpinner({ active }) {
  const rays = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
  return (
    <div style={{ width: 26, height: 26, flexShrink: 0, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
      <svg width="22" height="22" viewBox="0 0 24 24" style={{ animation: active ? 'va-spin 1.8s linear infinite' : 'none' }}>
        {rays.map((angle, i) => (
          <line key={i} x1="12" y1="2.5" x2="12" y2="6.5"
            stroke="#c96a4a" strokeWidth="2.2" strokeLinecap="round"
            transform={`rotate(${angle} 12 12)`}
            opacity={active ? 0.5 + (i % 4) * 0.17 : 0.55}
          />
        ))}
      </svg>
    </div>
  )
}

// ── Word-by-word text (AI messages) ──────────────────────────────────────────
// Accepts either `text` (string) or `segments` ([{text, color?}]) for colored inline runs
function WordByWordText({ text, segments, onDone, onWord }) {
  const src = segments || [{ text }]
  const isCJK = src.some(({ text: t }) => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(t))
  // Build flat token list with optional per-token color
  const tokens = src.flatMap(({ text: t, color }) =>
    isCJK
      ? [...t].map(c => ({ tok: c, color: color ?? null }))
      : t.split(/(\n)/).flatMap(seg =>
          seg === '\n'
            ? [{ tok: '\n', color: null }]
            : seg.split(' ').filter(Boolean).map(w => ({ tok: w, color: color ?? null }))
        )
  )
  const [count, setCount] = useState(0)
  const effectKey = segments ? segments.map(s => s.text).join('\x00') : text
  useEffect(() => {
    setCount(0)
    let i = 0
    const id = setInterval(() => {
      i++
      setCount(i)
      onWord?.()
      if (i >= tokens.length) { clearInterval(id); onDone?.() }
    }, isCJK ? 60 : 90)
    return () => clearInterval(id)
  }, [effectKey])
  if (isCJK && !segments) return <span>{tokens.slice(0, count).map(t => t.tok).join('')}</span>
  return (
    <span>
      {tokens.slice(0, count).map((item, i) =>
        item.tok === '\n' ? <br key={i} /> :
        item.color
          ? <span key={i} style={{ color: item.color, fontWeight: 'normal' }}>{(i > 0 && tokens[i - 1]?.tok !== '\n' ? ' ' : '') + item.tok}</span>
          : (i > 0 && tokens[i - 1]?.tok !== '\n' ? ' ' : '') + item.tok
      )}
    </span>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function VoiceAssistant({ open, onClose, theme, country, activeUser }) {
  const T = theme === 'dark'
    ? { bg: '#1c1c1c', panelBg: '#161616', border: '#2a2a2a', text: '#fff', textMuted: '#aaa', inputBg: '#252525', inputBorder: '#3a3a3a' }
    : { bg: '#e2e5e8', panelBg: '#f5f5f5', border: 'rgba(0,0,0,0.09)', text: '#111', textMuted: '#555', inputBg: '#d7dadd', inputBorder: 'rgba(0,0,0,0.12)' }

  const PANEL_W = 560
  const DEFAULT_POS = () => ({
    x: Math.max(0, window.innerWidth / 2 - PANEL_W / 2),
    y: 60,
  })

  const [selectedDept, setSelectedDept] = useState('"AMA"')
  const [deptOpen, setDeptOpen] = useState(false)
  const [deptMenuPos, setDeptMenuPos] = useState({ top: 0, left: 0 })
  const deptBtnRef = useRef(null)
  const [messages, setMessages] = useState([])
  const [typingRole, setTypingRole] = useState(null) // 'user' | 'ai' | null
  const [userWriting, setUserWriting] = useState(false)
  const [aiIsAnimating, setAiIsAnimating] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [micPulsing, setMicPulsing] = useState(false)
  const [visible, setVisible] = useState(false)
  const [started, setStarted] = useState(false)
  const [translated, setTranslated] = useState(false)
  const [pos, setPos] = useState(DEFAULT_POS)
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const timersRef = useRef([])
  const scrollRef = useRef(null)
  const userWritingDoneRef = useRef(null)
  const aiWritingDoneRef = useRef(null)

  const meta = COUNTRY_META[country] || { flag: '🌍', label: country }
  const nativeUiText = UI_TEXT[country] || UI_TEXT['United States']
  const uiText = (!ENGLISH_ONLY.has(country) && translated)
    ? UI_TEXT['United States']
    : nativeUiText

  const deptPrompt = selectedDept === '"AMA"'
    ? 'Click the mic or type a prompt\nto ask me anything'
    : selectedDept === 'All Departments'
      ? 'Click the mic or type a prompt\nto ask me about all departments'
      : `Click the mic or type a prompt\nto ask me anything about ${selectedDept}`

  // Reset translated state when country changes
  useEffect(() => { setTranslated(false) }, [country])

  // Clear conversation when user switches department selection
  useEffect(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setMessages([])
    setTypingRole(null)
    setStarted(false)
    setUserWriting(false)
    setAiIsAnimating(false)
    setIsProcessing(false)
  }, [selectedDept])

  const activeConversation = selectedDept !== '"AMA"'
    ? (!ENGLISH_ONLY.has(country) && !translated
        ? ((DEPT_CONVERSATIONS_BY_COUNTRY[country] || {})[selectedDept] || DEPT_CONVERSATIONS[selectedDept] || DEPT_CONVERSATIONS['All Departments'])
        : (DEPT_CONVERSATIONS[selectedDept] || DEPT_CONVERSATIONS['All Departments']))
    : (!ENGLISH_ONLY.has(country) && translated
        ? (CONVERSATIONS_EN[country] || CONVERSATIONS['United States'])
        : (CONVERSATIONS[country] || CONVERSATIONS['United States']))

  function scrollToBottom() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }

  // scroll to bottom on new messages
  useEffect(() => { scrollToBottom() }, [messages, typingRole])

  useEffect(() => {
    if (!deptOpen) return
    function handleOutside() { setDeptOpen(false) }
    window.addEventListener('mousedown', handleOutside)
    return () => window.removeEventListener('mousedown', handleOutside)
  }, [deptOpen])

  // animate in/out; reset on open
  useEffect(() => {
    if (open) {
      setVisible(true)
      setPos(DEFAULT_POS())
      setMessages([])
      setTypingRole(null)
      setStarted(false)
      setUserWriting(false)
      setSelectedDept('"AMA"')
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    } else {
      setVisible(false)
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      // small delay before resetting messages so exit animation plays
      userWritingDoneRef.current = null
      aiWritingDoneRef.current = null
      const t = setTimeout(() => { setMessages([]); setTypingRole(null); setStarted(false); setUserWriting(false); setAiIsAnimating(false) }, 300)
      timersRef.current.push(t)
    }
    return () => { timersRef.current.forEach(clearTimeout) }
  }, [open, country])

  function handleCopy() {
    if (!messages.length) return
    const text = messages.map(m => `${m.role === 'user' ? 'You' : 'Assistant'}: ${m.segments ? m.segments.map(s => s.text).join('') : m.text}`).join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleMicClick() {
    if (started) return
    setStarted(true)
    playScript(activeConversation)
  }

  // drag handlers
  function onHeaderMouseDown(e) {
    if (e.button !== 0) return
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    setDragging(true)

    function onMove(ev) {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - PANEL_W, ev.clientX - dragOffset.current.x)),
        y: Math.max(0, ev.clientY - dragOffset.current.y),
      })
    }
    function onUp() {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function playScript(msgs) {
    let idx = 0

    function playNext() {
      if (idx >= msgs.length) return
      const msg = msgs[idx++]
      const isAi = msg.role === 'ai'

      if (!isAi) {
        // show voice wave in input box
        setTypingRole('user')
        const t1 = setTimeout(() => {
          // reveal message → typewriter starts
          setTypingRole(null)
          setMessages(prev => [...prev, msg])
          setUserWriting(true)
          // when typewriter finishes, wait 1s then play AI response
          userWritingDoneRef.current = () => {
            const t2 = setTimeout(playNext, 1000)
            timersRef.current.push(t2)
          }
        }, 1200)
        timersRef.current.push(t1)
      } else if (msg.pause) {
        // show processing animation for msg.pause ms, then reveal AI message
        setIsProcessing(true)
        scrollToBottom()
        const tp = setTimeout(() => {
          setIsProcessing(false)
          setMessages(prev => [...prev, msg])
          setAiIsAnimating(true)
          scrollToBottom()
          aiWritingDoneRef.current = () => {
            setAiIsAnimating(false)
            const t1 = setTimeout(playNext, 800)
            timersRef.current.push(t1)
          }
        }, msg.pause)
        timersRef.current.push(tp)
      } else {
        // reveal AI message immediately, word-by-word handles the pacing
        setMessages(prev => [...prev, msg])
        setAiIsAnimating(true)
        aiWritingDoneRef.current = () => {
          setAiIsAnimating(false)
          const t1 = setTimeout(playNext, 800)
          timersRef.current.push(t1)
        }
      }
    }

    const t0 = setTimeout(playNext, 800)
    timersRef.current.push(t0)
  }

  if (!open && !visible) return null

  return (
    <>
      <style>{`
        @keyframes va-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes va-slide-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes va-slide-out {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(20px); }
        }
        @keyframes va-mic-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,188,212,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(0,188,212,0); }
        }
        @keyframes va-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes va-wave {
          from { transform: scaleY(0.25); opacity: 0.5; }
          to   { transform: scaleY(1);    opacity: 1; }
        }
        .va-clip-wrap:hover .va-clip-tip { opacity: 1 !important; }
        @keyframes va-cursor {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes va-processing-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: pos.y, left: pos.x,
          zIndex: 300,
          width: PANEL_W,
          height: '68vh',
          maxHeight: '68vh',
          borderRadius: 14,
          background: T.bg,
          border: `1px solid ${T.border}`,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: dragging ? 'none' : `${visible ? 'va-slide-in' : 'va-slide-out'} 280ms ease forwards`,
          boxShadow: dragging ? '0 32px 80px rgba(0,0,0,0.45)' : '0 24px 60px rgba(0,0,0,0.35)',
          userSelect: dragging ? 'none' : 'auto',
        }}
      >
        {/* Header — drag handle */}
        <div
          onMouseDown={onHeaderMouseDown}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px',
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
            cursor: dragging ? 'grabbing' : 'grab',
            position: 'relative',
          }}
        >

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: T.text, display: 'block', flexShrink: 0 }}>
              <line x1="12" y1="5" x2="12" y2="2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <circle cx="12" cy="1.5" r="1" fill="currentColor" stroke="none"/>
              <path d="M4 5 L20 5 Q22 5 22 7 L22 17 Q22 19 20 19 L14 19 L12 22 L10 19 L4 19 Q2 19 2 17 L2 7 Q2 5 4 5 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
              <rect x="7" y="8.5" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
              <rect x="14" y="8.5" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
              <path d="M8.5 14 Q12 16.5 15.5 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
            </svg>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, lineHeight: 1 }}>WarehouseIQ Agent</div>
          </div>

          {/* Department dropdown — absolutely centered in header */}
          <div onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
              <button
                ref={deptBtnRef}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation()
                  if (!deptOpen && deptBtnRef.current) {
                    const r = deptBtnRef.current.getBoundingClientRect()
                    setDeptMenuPos({ top: r.bottom + 4, left: r.left })
                  }
                  setDeptOpen(o => !o)
                }}
                style={{
                  backgroundColor: T.inputBg, border: `1px solid ${selectedDept !== '"AMA"' ? '#c96a4a' : T.inputBorder}`,
                  color: selectedDept !== '"AMA"' ? '#c96a4a' : T.textMuted,
                  fontSize: 12, padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, height: 28, whiteSpace: 'nowrap',
                }}>
                {selectedDept}<span style={{ color: T.textMuted, fontSize: 10 }}>▼</span>
              </button>
              {deptOpen && createPortal(
                <div
                  onMouseDown={e => e.stopPropagation()}
                  style={{
                    position: 'fixed', top: deptMenuPos.top, left: deptMenuPos.left,
                    zIndex: 9999, backgroundColor: T.bg, border: `1px solid ${T.border}`,
                    borderRadius: 6, minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                    overflow: 'hidden',
                  }}
                >
                  {['"AMA"', 'All Departments', ...CATEGORIES].map(item => (
                    <div
                      key={item}
                      onMouseDown={e => { e.stopPropagation(); setSelectedDept(item); setDeptOpen(false) }}
                      style={{
                        fontSize: 12, cursor: 'pointer', padding: '6px 12px',
                        color: selectedDept === item ? '#c96a4a' : T.textMuted,
                        backgroundColor: selectedDept === item ? 'rgba(201,106,74,0.1)' : 'transparent',
                      }}
                    >
                      {selectedDept === item ? '✓ ' : ''}{item}
                    </div>
                  ))}
                </div>,
                document.body
              )}
          </div>
          {!ENGLISH_ONLY.has(country) && (
            <div style={{ position: 'relative', flexShrink: 0 }} className="va-clip-wrap">
              <button
                onClick={() => {
                  const newTranslated = !translated
                  setTranslated(newTranslated)
                  if (started && messages.length > 0) {
                    const newConv = selectedDept !== '"AMA"'
                      ? (DEPT_CONVERSATIONS[selectedDept] || DEPT_CONVERSATIONS['All Departments'])
                      : (!ENGLISH_ONLY.has(country) && newTranslated
                          ? (CONVERSATIONS_EN[country] || CONVERSATIONS['United States'])
                          : (CONVERSATIONS[country] || CONVERSATIONS['United States']))
                    setMessages(newConv.slice(0, messages.length))
                  } else {
                    setMessages([])
                    setStarted(false)
                  }
                }}
                onMouseDown={e => e.stopPropagation()}
                style={{
                  width: 24, height: 24, borderRadius: 6, cursor: 'pointer',
                  border: `1px solid ${translated ? 'rgba(201,106,74,0.4)' : T.border}`,
                  background: translated ? 'rgba(201,106,74,0.1)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 150ms',
                }}
              >
                <Languages size={13} color={translated ? '#c96a4a' : T.textMuted} />
              </button>
              <div className="va-clip-tip" style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: '50%',
                transform: 'translateX(-50%)',
                background: theme === 'dark' ? '#333' : '#222',
                color: '#fff', fontSize: 11, whiteSpace: 'nowrap',
                padding: '4px 8px', borderRadius: 5,
                pointerEvents: 'none', opacity: 0, transition: 'opacity 150ms',
              }}>
                {translated ? nativeUiText.showIn(NATIVE_LABEL[country]) : nativeUiText.translateTo}
              </div>
            </div>
          )}
          <div style={{ position: 'relative', flexShrink: 0 }} className="va-clip-wrap">
            <button
              onClick={handleCopy}
              onMouseDown={e => e.stopPropagation()}
              style={{
                width: 24, height: 24, borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : T.border}`,
                background: copied ? 'rgba(34,197,94,0.1)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 150ms',
              }}
            >
              {copied
                ? <Check size={13} color="#22c55e" />
                : <Clipboard size={13} color={T.textMuted} />}
            </button>
            <div className="va-clip-tip" style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: '50%',
              transform: 'translateX(-50%)',
              background: theme === 'dark' ? '#333' : '#222',
              color: '#fff', fontSize: 11, whiteSpace: 'nowrap',
              padding: '4px 8px', borderRadius: 5,
              pointerEvents: 'none', opacity: 0, transition: 'opacity 150ms',
            }}>
              {copied ? uiText.copied : uiText.copy}
            </div>
          </div>
          {activeUser && (
            <div style={{
              width: 28, height: 28, borderRadius: '50%', overflow: 'hidden',
              flexShrink: 0, border: '2px solid rgba(245,158,11,0.4)',
            }}>
              <img
                src={activeUser.src}
                alt={activeUser.name}
                title={activeUser.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(activeUser.imgStyle ?? {}) }}
              />
            </div>
          )}
          <button
            onClick={onClose}
            onMouseDown={e => e.stopPropagation()}
            style={{
              width: 24, height: 24, borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${T.border}`,
              background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={13} color={T.textMuted} />
          </button>
        </div>

        {/* Chat thread */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 16px 20px',
            display: 'flex', flexDirection: 'column', gap: 20,
            scrollbarWidth: 'thin',
          }}
        >
          {messages.length === 0 && !typingRole && !started && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: T.textMuted, fontSize: 12 }}>
                {deptPrompt.split('\n')[0]}<br />{deptPrompt.split('\n')[1]}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            return (
              <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', gap: 8 }}>
                {!isUser && (
                  <AnthropicSpinner active={aiIsAnimating && i === messages.length - 1} />
                )}
                {isUser ? (
                  <div style={{
                    maxWidth: '72%', padding: '9px 13px',
                    borderRadius: '12px 12px 4px 12px',
                    background: 'rgba(0,188,212,0.15)',
                    border: '1px solid rgba(0,188,212,0.3)',
                    fontSize: 13, lineHeight: 1.55, color: '#00bcd4',
                  }}>
                    <TypewriterText text={msg.text} color="#00bcd4" onChar={scrollToBottom} onDone={() => { setUserWriting(false); userWritingDoneRef.current?.(); userWritingDoneRef.current = null; scrollToBottom() }} />
                  </div>
                ) : (
                  <div style={{
                    maxWidth: '72%', fontSize: 13, lineHeight: 1.6,
                    color: T.text, alignSelf: 'flex-start', whiteSpace: 'pre-line',
                  }}>
                    <WordByWordText text={msg.text} segments={msg.segments} onWord={scrollToBottom} onDone={() => { aiWritingDoneRef.current?.(); aiWritingDoneRef.current = null; scrollToBottom() }} />
                  </div>
                )}
                {isUser && activeUser && (
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    overflow: 'hidden', alignSelf: 'flex-end',
                  }}>
                    <img src={activeUser.src} alt={activeUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(activeUser.imgStyle ?? {}) }} />
                  </div>
                )}
              </div>
            )
          })}

          {isProcessing && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8, alignItems: 'center' }}>
              <AnthropicSpinner active={false} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#c96a4a',
                    animation: `va-processing-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
                <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 4 }}>Processing</span>
              </div>
            </div>
          )}

          {typingRole === 'user' && activeUser && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden' }}>
                <img src={activeUser.src} alt={activeUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(activeUser.imgStyle ?? {}) }} />
              </div>
            </div>
          )}
        </div>

        {/* Input row */}
        <div style={{
          padding: '10px 14px',
          borderTop: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0,
        }}>
          <div style={{
            flex: 1, height: 34, borderRadius: 8,
            background: T.inputBg,
            border: `1px solid ${typingRole === 'user' || userWriting ? 'rgba(0,188,212,0.4)' : T.inputBorder}`,
            display: 'flex', alignItems: 'center',
            padding: typingRole === 'user' || userWriting ? '0 4px' : '0 12px',
            fontSize: 12, color: T.textMuted,
            overflow: 'hidden',
            transition: 'border 200ms',
          }}>
            {typingRole === 'user' || userWriting
              ? <VoiceWave />
              : (started ? '' : uiText.placeholder)}
          </div>
          <button
            title={started ? 'Listening…' : 'Start conversation'}
            onClick={handleMicClick}
            onMouseEnter={() => setMicPulsing(true)}
            onMouseLeave={() => setMicPulsing(false)}
            style={{
              width: 34, height: 34, borderRadius: 8, cursor: started ? 'default' : 'pointer', flexShrink: 0,
              border: started ? '1px solid rgba(0,188,212,0.5)' : `1px solid ${T.inputBorder}`,
              background: started ? 'rgba(0,188,212,0.12)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: (!started && micPulsing) ? 'va-mic-pulse 1.2s ease-in-out infinite' : 'none',
              transition: 'background 150ms, border 150ms',
            }}
          >
            <Mic size={15} color={started ? '#00bcd4' : (theme === 'dark' ? '#fff' : '#333')} />
          </button>
        </div>
      </div>
    </>
  )
}
