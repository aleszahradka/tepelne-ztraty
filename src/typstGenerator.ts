import type { ProjectState } from './types';
import {
  calculateEffectiveUValue,
  calculateNetArea,
  calculateTransmissionLoss,
  calculateRoomVentilationLoss,
  calculateAssemblyUValue,
  calculateLayerResistance
} from './mathEngine';

export interface TypstExportOptions {
  selectedSectionKeys: string[];
  selectedStoreyIds: string[];
  selectedRoomIds: string[];
  lang?: 'cs' | 'en';
}

/**
 * Generates a complete Typst (.typ) report string based on selected sections, storeys, and rooms.
 */
export function generateTypstDocument(
  state: ProjectState,
  options: TypstExportOptions
): string {
  const lang = options.lang || 'cs';
  const isCs = lang === 'cs';

  const selectedSectionSet = new Set(options.selectedSectionKeys);
  const selectedStoreySet = new Set(options.selectedStoreyIds);
  const selectedRoomSet = new Set(options.selectedRoomIds);

  // 1. Filter Storeys
  const allStoreys = state.storeys || [];
  const filteredStoreys = allStoreys.filter(s => selectedStoreySet.has(s.id));

  // 2. Filter Rooms (must be selected AND belong to a selected storey)
  const allRooms = state.rooms || [];
  const filteredRooms = allRooms.filter(r =>
    selectedRoomSet.has(r.id) && selectedStoreySet.has(r.storey_id)
  );
  const filteredRoomIds = new Set(filteredRooms.map(r => r.id));

  // 3. Filter Envelope Elements
  // Elements linked to a room must belong to a selected room.
  // Unassigned elements (no room_id) are kept.
  const allElements = state.envelope_elements || [];
  let filteredElements = allElements.filter(el => {
    if (el.room_id) {
      return filteredRoomIds.has(el.room_id);
    }
    return true; // Keep unassigned element
  });

  // Also drop child openings whose parent element was filtered out
  const filteredElementIds = new Set(filteredElements.map(e => e.id));
  filteredElements = filteredElements.filter(el => {
    if (el.parent_element_id) {
      return filteredElementIds.has(el.parent_element_id);
    }
    return true;
  });

  // 4. Calculate Filtered Aggregate Heat Losses & Metrics
  const phiT = filteredElements.reduce((sum, el) => {
    return sum + calculateTransmissionLoss(
      el,
      state.assemblies,
      state.materials,
      state.environmental_settings,
      filteredElements,
      filteredRooms,
      filteredStoreys
    );
  }, 0);

  let phiV = 0;
  if (allRooms.length === 0) {
    // Global fallback
    const deltaT = state.environmental_settings.t_int - state.environmental_settings.t_e;
    phiV = Math.max(0, state.environmental_settings.room_volume * state.environmental_settings.air_exchange_rate * 0.34 * deltaT);
  } else {
    // Sum filtered rooms
    phiV = filteredRooms.reduce((sum, room) => {
      return sum + calculateRoomVentilationLoss(room, state.environmental_settings.t_e);
    }, 0);
  }

  const phiTotal = phiT + phiV;

  let totalArea = 0;
  let weightedU = 0;
  filteredElements.forEach(el => {
    const aNet = calculateNetArea(el, filteredElements, filteredRooms, filteredStoreys);
    if (aNet > 0) {
      const uEff = calculateEffectiveUValue(el, state.assemblies, state.materials);
      totalArea += aNet;
      weightedU += aNet * uEff;
    }
  });
  const avgU = totalArea > 0 ? weightedU / totalArea : 0;

  // 5. Build Typst Document Markup
  const lines: string[] = [];

  // Page setup & Styling
  lines.push(`#set page(
  paper: "a4",
  margin: (x: 2cm, y: 2.5cm),
  header: align(right)[
    #text(size: 8pt, fill: rgb("#64748b"))[
      ${isCs ? "Výpočet tepelných ztrát budovy (ČSN EN 12831)" : "Building Heat Loss Calculation (EN 12831)"}
    ]
  ],
  footer: context [
    #align(center)[
      #text(size: 8pt, fill: rgb("#94a3b8"))[
        #counter(page).display("1 / 1", both: true)
      ]
    ]
  ]
)`);

  lines.push(`#set text(font: "Liberation Sans", lang: "${lang}", size: 10pt)`);
  lines.push(`#set par(justify: true)`);
  lines.push(``);

  // Title Header
  lines.push(`#align(center)[
  #text(size: 20pt, weight: "bold", fill: rgb("#1e293b"))[
    ${isCs ? "Protokol výpočtu tepelných ztrát budovy" : "Building Heat Loss Calculation Report"}
  ] \\
  #v(2pt)
  #text(size: 11pt, fill: rgb("#64748b"))[
    ${isCs ? "Metodika ČSN EN 12831 • Typst Export" : "EN 12831 Methodology • Typst Export"}
  ]
]`);
  lines.push(`#v(1em)`);

  // --- SECTION 1: Executive Summary & Key Results ---
  if (selectedSectionSet.has('summary')) {
    lines.push(`== ${isCs ? "1. Souhrnné výsledky a klíčové ukazatele" : "1. Executive Summary & Key Results"}`);
    lines.push(``);
    lines.push(`#rect(
  width: 100%,
  fill: rgb("#f8fafc"),
  stroke: 1pt + rgb("#e2e8f0"),
  inset: 12pt,
  radius: 6pt
)[
  #grid(
    columns: (1fr, 1fr, 1fr),
    gutter: 10pt,
    [
      #text(size: 9pt, fill: rgb("#64748b"))[${isCs ? "Celková ztráta (Φ_CELK)" : "Total Heat Loss (Φ_Total)"}] \\
      #text(size: 16pt, weight: "bold", fill: rgb("#dc2626"))[${(phiTotal / 1000).toFixed(2)} kW] \\
      #text(size: 8pt, fill: rgb("#94a3b8"))[(${phiTotal.toFixed(0)} W)]
    ],
    [
      #text(size: 9pt, fill: rgb("#64748b"))[${isCs ? "Ztráta prostupem (Φ_T)" : "Transmission Loss (Φ_T)"}] \\
      #text(size: 14pt, weight: "bold", fill: rgb("#2563eb"))[${(phiT / 1000).toFixed(2)} kW] \\
      #text(size: 8pt, fill: rgb("#94a3b8"))[(${totalArea > 0 ? (phiT / totalArea).toFixed(1) : 0} W/m²)]
    ],
    [
      #text(size: 9pt, fill: rgb("#64748b"))[${isCs ? "Ztráta větráním (Φ_V)" : "Ventilation Loss (Φ_V)"}] \\
      #text(size: 14pt, weight: "bold", fill: rgb("#d97706"))[${(phiV / 1000).toFixed(2)} kW] \\
      #text(size: 8pt, fill: rgb("#94a3b8"))[(${phiTotal > 0 ? ((phiV / phiTotal) * 100).toFixed(1) : 0} %)]
    ]
  )
]`);
    lines.push(``);

    lines.push(`#table(
  columns: (2fr, 1fr, 1fr),
  inset: 7pt,
  align: (left, right, right),
  fill: (x, y) => if y == 0 { rgb("#f1f5f9") } else { none },
  stroke: 0.5pt + rgb("#cbd5e1"),
  [*${isCs ? "Ukazatel" : "Metric"}*], [*${isCs ? "Hodnota" : "Value"}*], [*${isCs ? "Jednotka" : "Unit"}*],
  [${isCs ? "Celková teplosměnná plocha obálky (A_celk)" : "Total Envelope Area (A_total)"}], [${totalArea.toFixed(2)}], [m²],
  [${isCs ? "Průměrný součinitel prostupu tepla (U_prům)" : "Average U-Value (U_avg)"}], [${avgU.toFixed(3)}], [W/(m²·K)],
  [${isCs ? "Návrhová vnitřní teplota (t_int)" : "Design Indoor Temp (t_int)"}], [${state.environmental_settings.t_int.toFixed(1)}], [°C],
  [${isCs ? "Návrhová venkovní teplota (t_e)" : "Design Outdoor Temp (t_e)"}], [${state.environmental_settings.t_e.toFixed(1)}], [°C],
  [${isCs ? "Teplotní rozdíl (ΔT)" : "Temperature Difference (ΔT)"}], [${(state.environmental_settings.t_int - state.environmental_settings.t_e).toFixed(1)}], [K]
)`);
    lines.push(`#v(1em)`);
  }

  // --- SECTION 2: Temperatures & Ventilation Parameters ---
  if (selectedSectionSet.has('environmental')) {
    lines.push(`== ${isCs ? "2. Teploty a větrání" : "2. Temperatures & Ventilation"}`);
    lines.push(``);
    lines.push(isCs
      ? `Základní výpočtové okrajové podmínky a parametrizace větrání objektu podle ČSN EN 12831.`
      : `Core design boundary conditions and ventilation parameters according to EN 12831.`
    );
    lines.push(``);

    lines.push(`#table(
  columns: (3fr, 1fr, 1fr),
  inset: 7pt,
  align: (left, right, right),
  fill: (x, y) => if y == 0 { rgb("#f1f5f9") } else { none },
  stroke: 0.5pt + rgb("#cbd5e1"),
  [*${isCs ? "Parametr" : "Parameter"}*], [*${isCs ? "Hodnota" : "Value"}*], [*${isCs ? "Jednotka" : "Unit"}*],
  [${isCs ? "Globální vnitřní teplota (t_int)" : "Global Indoor Temp (t_int)"}], [${state.environmental_settings.t_int}], [°C],
  [${isCs ? "Venkovní návrhová teplota (t_e)" : "Outdoor Design Temp (t_e)"}], [${state.environmental_settings.t_e}], [°C],
  [${isCs ? "Teplota zeminy (t_g)" : "Ground Temp (t_g)"}], [${state.environmental_settings.t_ground ?? 5}], [°C],
  [${isCs ? "Globální objem budovy (V)" : "Global Building Volume (V)"}], [${state.environmental_settings.room_volume}], [m³],
  [${isCs ? "Intenzita výměny vzduchu (n)" : "Air Exchange Rate (n)"}], [${state.environmental_settings.air_exchange_rate}], [1/h],
  [${isCs ? "Natočení k severu (Severka)" : "North Orientation"}], [${state.environmental_settings.building_orientation}], [°]
)`);
    lines.push(``);

    // Required Formula for Ventilation Loss with dot
    lines.push(`*${isCs ? "Vzorec pro výpočet tepelné ztráty větráním (se zohledněním rekuperace HRV):" : "Ventilation Heat Loss Formula (including HRV efficiency):"}*`);
    lines.push(`$ Phi_V = 0.34 dot V_(m i n) dot (t_(i n t) - t_e) dot (1 - eta_(h r v)) $`);
    lines.push(`#v(1em)`);
  }

  // --- SECTION 3: Building Hierarchy ---
  if (selectedSectionSet.has('hierarchy')) {
    lines.push(`== ${isCs ? "3. Hierarchie budovy (Podlaží a místnosti)" : "3. Building Hierarchy (Storeys & Rooms)"}`);
    lines.push(``);

    if (filteredStoreys.length === 0 && filteredRooms.length === 0) {
      lines.push(`_${isCs ? "Žádná podlaží ani místnosti nebyly vybrány do exportu." : "No storeys or rooms selected for export."}_`);
    } else {
      lines.push(`#table(
  columns: (1.5fr, 2fr, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr),
  inset: 5pt,
  align: (left, left, right, right, right, right, center, right),
  fill: (x, y) => if y == 0 { rgb("#f1f5f9") } else { none },
  stroke: 0.5pt + rgb("#cbd5e1"),
  [*${isCs ? "Podlaží" : "Storey"}*], [*${isCs ? "Místnost" : "Room"}*], [*${isCs ? "Plocha" : "Area"} (m²)*], [*${isCs ? "Výška" : "Height"} (m)*], [*${isCs ? "Objem" : "Vol"} (m³)*], [*${isCs ? "t_int" : "t_int"} (°C)*], [*${isCs ? "HRV" : "HRV"}*], [*${isCs ? "Φ_celk" : "Φ_total"} (W)*],
  ${filteredRooms.map(r => {
    const s = filteredStoreys.find(st => st.id === r.storey_id);
    const storeyName = s ? s.name : (isCs ? "Nepřiřazeno" : "Unassigned");
    const vol = r.area * r.height;
    const roomLossT = filteredElements
      .filter(el => el.room_id === r.id)
      .reduce((sum, el) => sum + calculateTransmissionLoss(el, state.assemblies, state.materials, state.environmental_settings, filteredElements, filteredRooms, filteredStoreys), 0);
    const roomLossV = calculateRoomVentilationLoss(r, state.environmental_settings.t_e);
    const roomLossTotal = roomLossT + roomLossV;
    const hrvStr = r.has_hrv ? `${((r.hrv_efficiency ?? 0.8) * 100).toFixed(0)}%` : "-";

    return `[${storeyName}], [${r.name}], [${r.area.toFixed(1)}], [${r.height.toFixed(2)}], [${vol.toFixed(1)}], [${r.t_int}], [${hrvStr}], [${roomLossTotal.toFixed(0)}]`;
  }).join(',\n  ')}
)`);
    }
    lines.push(`#v(1em)`);
  }

  // --- SECTION 4: Material Assemblies & U-Values ---
  if (selectedSectionSet.has('assemblies')) {
    lines.push(`== ${isCs ? "4. Stavební konstrukce (1D U-hodnota)" : "4. Material Assemblies & U-Values"}`);
    lines.push(``);

    // Required Formula for U-Value
    lines.push(`*${isCs ? "Vzorec pro výpočet součinitele prostupu tepla (U):" : "U-Value Calculation Formula:"}*`);
    lines.push(`$ U = 1 / (R_(s i) + sum (d_i / lambda_i) + R_(s e)) + Delta U_(T B) $`);
    lines.push(``);

    lines.push(`#table(
  columns: (2fr, 1fr, 1fr, 1fr, 1fr),
  inset: 6pt,
  align: (left, center, right, right, right),
  fill: (x, y) => if y == 0 { rgb("#f1f5f9") } else { none },
  stroke: 0.5pt + rgb("#cbd5e1"),
  [*${isCs ? "Konstrukce" : "Assembly"}*], [*${isCs ? "Typ" : "Type"}*], [*R_si + R_se*], [*${isCs ? "Suma R_layer" : "Sum R_layer"}*], [*U (W/m²K)*],
  ${state.assemblies.map(a => {
    const uVal = calculateAssemblyUValue(a, state.materials);
    let rLayersSum = 0;
    a.layers.forEach(l => {
      rLayersSum += calculateLayerResistance(l, state.materials);
    });
    return `[${a.name}], [${a.type}], [${(a.rsi + a.rse).toFixed(2)}], [${rLayersSum.toFixed(2)}], [${uVal.toFixed(3)}]`;
  }).join(',\n  ')}
)`);
    lines.push(`#v(1em)`);
  }

  // --- SECTION 5: Room Envelopes & Surfaces ---
  if (selectedSectionSet.has('envelope')) {
    lines.push(`== ${isCs ? "5. Obálky místností a konstrukce" : "5. Room Envelopes & Surfaces"}`);
    lines.push(``);

    // Required Formula for Transmission Heat Loss with dot
    lines.push(`*${isCs ? "Vzorec pro výpočet tepelné ztráty prostupem:" : "Transmission Heat Loss Formula:"}*`);
    lines.push(`$ Phi_T = A_k dot U_k dot (t_(i n t) - t_e) dot b_k $`);
    lines.push(``);

    if (filteredElements.length === 0) {
      lines.push(`_${isCs ? "Žádné prvky obálky nebyly vybrány." : "No envelope elements selected."}_`);
    } else {
      lines.push(`#table(
  columns: (2fr, 1.5fr, 1.5fr, 1fr, 1fr, 1fr, 1fr, 1fr),
  inset: 5pt,
  align: (left, left, left, right, right, right, right, right),
  fill: (x, y) => if y == 0 { rgb("#f1f5f9") } else { none },
  stroke: 0.5pt + rgb("#cbd5e1"),
  [*${isCs ? "Prvek" : "Element"}*], [*${isCs ? "Místnost" : "Room"}*], [*${isCs ? "Konstrukce" : "Assembly"}*], [*A_gross*], [*A_net*], [*U_eff*], [*b*], [*Φ_T (W)*],
  ${filteredElements.map(el => {
    const rm = filteredRooms.find(r => r.id === el.room_id);
    const roomName = rm ? rm.name : (isCs ? "Nepřiřazeno" : "Unassigned");
    const asm = state.assemblies.find(a => a.id === el.assembly_id);
    const asmName = asm ? asm.name : "-";
    const grossA = el.area * Math.max(1, el.count || 1);
    const netA = calculateNetArea(el, filteredElements, filteredRooms, filteredStoreys);
    const uEff = calculateEffectiveUValue(el, state.assemblies, state.materials);
    const loss = calculateTransmissionLoss(el, state.assemblies, state.materials, state.environmental_settings, filteredElements, filteredRooms, filteredStoreys);

    return `[${el.name}], [${roomName}], [${asmName}], [${grossA.toFixed(1)}], [${netA.toFixed(1)}], [${uEff.toFixed(2)}], [${el.b_factor.toFixed(2)}], [${loss.toFixed(0)}]`;
  }).join(',\n  ')}
)`);
    }
    lines.push(`#v(1em)`);
  }

  // --- SECTION 6: Heat Loss Distribution ---
  if (selectedSectionSet.has('distribution')) {
    lines.push(`== ${isCs ? "6. Rozdělení tepelných ztrát obálkou" : "6. Heat Loss Distribution"}`);
    lines.push(``);

    if (filteredRooms.length === 0) {
      lines.push(`_${isCs ? "Žádné místnosti nebyly vybrány do přehledu rozdělení ztrát." : "No rooms selected for heat loss distribution."}_`);
    } else {
      lines.push(`#table(
  columns: (2fr, 1fr, 1fr, 1fr, 1fr),
  inset: 6pt,
  align: (left, right, right, right, right),
  fill: (x, y) => if y == 0 { rgb("#f1f5f9") } else { none },
  stroke: 0.5pt + rgb("#cbd5e1"),
  [*${isCs ? "Místnost / Objekt" : "Room / Entity"}*], [*Φ_T (W)*], [*Φ_V (W)*], [*Φ_celk (W)*], [*${isCs ? "Podíl" : "Share"} (%)*],
  ${filteredRooms.map(rm => {
    const rmLossT = filteredElements
      .filter(el => el.room_id === rm.id)
      .reduce((sum, el) => sum + calculateTransmissionLoss(el, state.assemblies, state.materials, state.environmental_settings, filteredElements, filteredRooms, filteredStoreys), 0);
    const rmLossV = calculateRoomVentilationLoss(rm, state.environmental_settings.t_e);
    const rmTotal = rmLossT + rmLossV;
    const share = phiTotal > 0 ? (rmTotal / phiTotal) * 100 : 0;

    return `[${rm.name}], [${rmLossT.toFixed(0)}], [${rmLossV.toFixed(0)}], [${rmTotal.toFixed(0)}], [${share.toFixed(1)}%]`;
  }).join(',\n  ')}
)`);
    }
    lines.push(`#v(1em)`);
  }

  // --- SECTION 7: Calculation Methodology & Formulas ---
  if (selectedSectionSet.has('methodology')) {
    lines.push(`== ${isCs ? "7. Výpočtové postupy a vzorce" : "7. Calculation Methodology & Formulas"}`);
    lines.push(``);
    lines.push(isCs
      ? `Výpočet tepelných ztrát je proveden v souladu s evropskou normou EN 12831. Fyzikální výpočet zohledňuje následující základní matematické vztahy:`
      : `The heat loss calculation is performed in compliance with European standard EN 12831, utilizing the following formal equations:`
    );
    lines.push(``);

    lines.push(`1. *${isCs ? "Součinitel prostupu tepla 1D konstrukce (U):" : "1D Assembly U-Value:"}*`);
    lines.push(`$ U = 1 / (R_(s i) + sum (d_i / lambda_i) + R_(s e)) + Delta U_(T B) $`);
    lines.push(``);

    lines.push(`2. *${isCs ? "Tepelná ztráta prostupem tepla obálkou (Φ_T):" : "Transmission Heat Loss (Φ_T):"}*`);
    lines.push(`$ Phi_T = A_k dot U_k dot (t_(i n t) - t_e) dot b_k $`);
    lines.push(``);

    lines.push(`3. *${isCs ? "Tepelná ztráta větráním (Φ_V):" : "Ventilation Heat Loss (Φ_V):"}*`);
    lines.push(`$ Phi_V = 0.34 dot V_(m i n) dot (t_(i n t) - t_e) dot (1 - eta_(h r v)) $`);
    lines.push(``);
  }

  return lines.join('\n');
}
