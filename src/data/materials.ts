import type { Material } from '../types';

export const BUILT_IN_MATERIALS: Material[] = [
  // ==========================================
  // 1. Zdivo a tvárnice / Masonry & Blocks
  // ==========================================
  {
    id: "mat-brick-solid",
    name: { cs: "Plná cihla (CP 290/140/65)", en: "Solid Clay Brick (CP)" },
    category: { cs: "Zdivo a tvárnice", en: "Masonry & Blocks" },
    design_thermal_conductivity: 0.80,
    is_custom: false
  },
  {
    id: "mat-brick-clinker",
    name: { cs: "Klinker a zvonivky (Klinker brick)", en: "Clinker Brick" },
    category: { cs: "Zdivo a tvárnice", en: "Masonry & Blocks" },
    design_thermal_conductivity: 1.05,
    is_custom: false
  },
  {
    id: "mat-porotherm-30-profi",
    name: { cs: "Děrovaná cihla Porotherm 30 Profi", en: "Hollow Clay Block Porotherm 30 Profi" },
    category: { cs: "Zdivo a tvárnice", en: "Masonry & Blocks" },
    design_thermal_conductivity: 0.18,
    is_custom: false
  },
  {
    id: "mat-porotherm-44-t-profi",
    name: { cs: "Cihla plněná vatou Porotherm 44 T Profi", en: "Wool-filled Clay Block Porotherm 44 T Profi" },
    category: { cs: "Zdivo a tvárnice", en: "Masonry & Blocks" },
    design_thermal_conductivity: 0.077,
    is_custom: false
  },
  {
    id: "mat-heluz-family-30",
    name: { cs: "Brusný keramický blok Heluz Family 30", en: "Hollow Clay Block Heluz Family 30" },
    category: { cs: "Zdivo a tvárnice", en: "Masonry & Blocks" },
    design_thermal_conductivity: 0.15,
    is_custom: false
  },
  {
    id: "mat-heluz-family-50-2in1",
    name: { cs: "Cihla plněná polystyrenem Heluz Family 50 2in1", en: "EPS-filled Clay Block Heluz Family 50 2in1" },
    category: { cs: "Zdivo a tvárnice", en: "Masonry & Blocks" },
    design_thermal_conductivity: 0.068,
    is_custom: false
  },
  {
    id: "mat-ytong-p2-400",
    name: { cs: "Pórobeton Ytong P2-400", en: "Aerated Concrete Ytong P2-400" },
    category: { cs: "Zdivo a tvárnice", en: "Masonry & Blocks" },
    design_thermal_conductivity: 0.105,
    is_custom: false
  },
  {
    id: "mat-ytong-p4-550",
    name: { cs: "Pórobeton Ytong P4-550", en: "Aerated Concrete Ytong P4-550" },
    category: { cs: "Zdivo a tvárnice", en: "Masonry & Blocks" },
    design_thermal_conductivity: 0.14,
    is_custom: false
  },
  {
    id: "mat-ytong-lambda-yq",
    name: { cs: "Pórobeton Ytong Lambda YQ", en: "Aerated Concrete Ytong Lambda YQ" },
    category: { cs: "Zdivo a tvárnice", en: "Masonry & Blocks" },
    design_thermal_conductivity: 0.083,
    is_custom: false
  },
  {
    id: "mat-sand-lime-brick",
    name: { cs: "Vápenopísková cihla (VPC / Sendwix)", en: "Sand-Lime Brick (VPC)" },
    category: { cs: "Zdivo a tvárnice", en: "Masonry & Blocks" },
    design_thermal_conductivity: 0.96,
    is_custom: false
  },
  {
    id: "mat-concrete-block-hollow",
    name: { cs: "Betonové tvárnice / Ztracené bednění", en: "Concrete Shuttering Blocks" },
    category: { cs: "Zdivo a tvárnice", en: "Masonry & Blocks" },
    design_thermal_conductivity: 1.30,
    is_custom: false
  },
  {
    id: "mat-expanded-clay-block",
    name: { cs: "Liapor tvárnice (Liaporbetonové zdivo)", en: "Lightweight Expanded Clay Block (Liapor)" },
    category: { cs: "Zdivo a tvárnice", en: "Masonry & Blocks" },
    design_thermal_conductivity: 0.22,
    is_custom: false
  },

  // ==========================================
  // 2. Betony a malty / Concrete & Mortars
  // ==========================================
  {
    id: "mat-reinforced-concrete",
    name: { cs: "Železobeton (hustota 2500 kg/m³)", en: "Reinforced Concrete (2500 kg/m³)" },
    category: { cs: "Betony a malty", en: "Concrete & Mortars" },
    design_thermal_conductivity: 1.58,
    is_custom: false
  },
  {
    id: "mat-plain-concrete",
    name: { cs: "Prostý beton (hustota 2200 kg/m³)", en: "Plain Concrete (2200 kg/m³)" },
    category: { cs: "Betony a malty", en: "Concrete & Mortars" },
    design_thermal_conductivity: 1.30,
    is_custom: false
  },
  {
    id: "mat-lightweight-concrete-liapor",
    name: { cs: "Lehký beton (Liaporbeton)", en: "Lightweight Concrete (Liapor)" },
    category: { cs: "Betony a malty", en: "Concrete & Mortars" },
    design_thermal_conductivity: 0.45,
    is_custom: false
  },
  {
    id: "mat-cement-mortar",
    name: { cs: "Cementová malta / Cihlářská malta", en: "Cement Mortar" },
    category: { cs: "Betony a malty", en: "Concrete & Mortars" },
    design_thermal_conductivity: 1.16,
    is_custom: false
  },
  {
    id: "mat-lime-cement-mortar",
    name: { cs: "Vápenocementová malta", en: "Lime-Cement Mortar" },
    category: { cs: "Betony a malty", en: "Concrete & Mortars" },
    design_thermal_conductivity: 0.88,
    is_custom: false
  },
  {
    id: "mat-thin-bed-mortar",
    name: { cs: "Lepidlo pro tenkovrstvé zdění (Zakládací / Tenkovrstvá malta)", en: "Thin-Bed Masonry Mortar / Adhesive" },
    category: { cs: "Betony a malty", en: "Concrete & Mortars" },
    design_thermal_conductivity: 0.60,
    is_custom: false
  },

  // ==========================================
  // 3. Tepelné izolace / Thermal Insulation
  // ==========================================
  {
    id: "mat-eps-70f",
    name: { cs: "Fasádní polystyren EPS 70F", en: "Facade EPS 70F" },
    category: { cs: "Tepelné izolace", en: "Thermal Insulation" },
    design_thermal_conductivity: 0.039,
    is_custom: false
  },
  {
    id: "mat-eps-100f",
    name: { cs: "Podlahový / Fasádní polystyren EPS 100F", en: "Floor/Facade EPS 100F" },
    category: { cs: "Tepelné izolace", en: "Thermal Insulation" },
    design_thermal_conductivity: 0.037,
    is_custom: false
  },
  {
    id: "mat-eps-grey",
    name: { cs: "Grafitový polystyren (Grey EPS 100F)", en: "Graphite / Grey EPS" },
    category: { cs: "Tepelné izolace", en: "Thermal Insulation" },
    design_thermal_conductivity: 0.031,
    is_custom: false
  },
  {
    id: "mat-xps",
    name: { cs: "Extrudovaný polystyren (XPS)", en: "Extruded Polystyrene (XPS)" },
    category: { cs: "Tepelné izolace", en: "Thermal Insulation" },
    design_thermal_conductivity: 0.034,
    is_custom: false
  },
  {
    id: "mat-mineral-wool-facade",
    name: { cs: "Minerální vata fasádní (Čedičová / Kamenná)", en: "Mineral Wool Facade Board (Rock Wool)" },
    category: { cs: "Tepelné izolace", en: "Thermal Insulation" },
    design_thermal_conductivity: 0.036,
    is_custom: false
  },
  {
    id: "mat-mineral-wool-roll",
    name: { cs: "Minerální vata do krovů a stropů (Skelná)", en: "Mineral Wool Roll for Roofs/Ceilings (Glass Wool)" },
    category: { cs: "Tepelné izolace", en: "Thermal Insulation" },
    design_thermal_conductivity: 0.038,
    is_custom: false
  },
  {
    id: "mat-pir-pur-board",
    name: { cs: "PIR / PUR izolační desky s hliníkem", en: "PIR / PUR Foil-Faced Boards" },
    category: { cs: "Tepelné izolace", en: "Thermal Insulation" },
    design_thermal_conductivity: 0.022,
    is_custom: false
  },
  {
    id: "mat-wood-fiber-board",
    name: { cs: "Dřevovláknitá izolační deska (Hobra / Steico)", en: "Wood Fiber Insulation Board (Hobra)" },
    category: { cs: "Tepelné izolace", en: "Thermal Insulation" },
    design_thermal_conductivity: 0.040,
    is_custom: false
  },
  {
    id: "mat-expanded-perlite",
    name: { cs: "Expanzovaný perlit (Perlit zásyp)", en: "Expanded Perlite Loose Fill" },
    category: { cs: "Tepelné izolace", en: "Thermal Insulation" },
    design_thermal_conductivity: 0.050,
    is_custom: false
  },
  {
    id: "mat-cellulose-blown",
    name: { cs: "Foukaná celulóza (Climatizer Plus)", en: "Blown Cellulose Insulation" },
    category: { cs: "Tepelné izolace", en: "Thermal Insulation" },
    design_thermal_conductivity: 0.039,
    is_custom: false
  },
  {
    id: "mat-blown-mineral-wool",
    name: { cs: "Foukaná minerální vata", en: "Blown Mineral Wool" },
    category: { cs: "Tepelné izolace", en: "Thermal Insulation" },
    design_thermal_conductivity: 0.038,
    is_custom: false
  },
  {
    id: "mat-phenolic-foam",
    name: { cs: "Fenolická pěna (Kooltherm / Resol deska)", en: "Phenolic Foam Board" },
    category: { cs: "Tepelné izolace", en: "Thermal Insulation" },
    design_thermal_conductivity: 0.021,
    is_custom: false
  },

  // ==========================================
  // 4. Deskové materiály a dřevo / Board Materials & Wood
  // ==========================================
  {
    id: "mat-softwood-solid",
    name: { cs: "Měkké dřevo - smrk / borovice (kolmo k vláknům)", en: "Solid Softwood - Spruce/Pine (Perpendicular to grain)" },
    category: { cs: "Deskové materiály a dřevo", en: "Board Materials & Wood" },
    design_thermal_conductivity: 0.18,
    is_custom: false
  },
  {
    id: "mat-hardwood-solid",
    name: { cs: "Tvrdé dřevo - dub / buk", en: "Solid Hardwood - Oak/Beech" },
    category: { cs: "Deskové materiály a dřevo", en: "Board Materials & Wood" },
    design_thermal_conductivity: 0.22,
    is_custom: false
  },
  {
    id: "mat-osb3",
    name: { cs: "OSB desky (OSB/3)", en: "OSB/3 Board" },
    category: { cs: "Deskové materiály a dřevo", en: "Board Materials & Wood" },
    design_thermal_conductivity: 0.13,
    is_custom: false
  },
  {
    id: "mat-gypsum-board-standard",
    name: { cs: "Sádrokartonová deska standardní (GKB / RB)", en: "Standard Gypsum Board (GKB)" },
    category: { cs: "Deskové materiály a dřevo", en: "Board Materials & Wood" },
    design_thermal_conductivity: 0.22,
    is_custom: false
  },
  {
    id: "mat-gypsum-board-moisture",
    name: { cs: "Sádrokartonová deska impregnovaná (GKBi / RBI)", en: "Moisture-Resistant Gypsum Board (GKBi)" },
    category: { cs: "Deskové materiály a dřevo", en: "Board Materials & Wood" },
    design_thermal_conductivity: 0.22,
    is_custom: false
  },
  {
    id: "mat-gypsum-fiberboard",
    name: { cs: "Sádrovláknitá deska (Fermacell)", en: "Gypsum Fiberboard (Fermacell)" },
    category: { cs: "Deskové materiály a dřevo", en: "Board Materials & Wood" },
    design_thermal_conductivity: 0.32,
    is_custom: false
  },
  {
    id: "mat-cetris-board",
    name: { cs: "Cementotřísková deska (Cetris)", en: "Cement-Bonded Particleboard (Cetris)" },
    category: { cs: "Deskové materiály a dřevo", en: "Board Materials & Wood" },
    design_thermal_conductivity: 0.25,
    is_custom: false
  },
  {
    id: "mat-plywood",
    name: { cs: "Stavební překližka", en: "Construction Plywood" },
    category: { cs: "Deskové materiály a dřevo", en: "Board Materials & Wood" },
    design_thermal_conductivity: 0.13,
    is_custom: false
  },

  // ==========================================
  // 5. Omítky a potěry / Plasters & Renders
  // ==========================================
  {
    id: "mat-lime-cement-plaster",
    name: { cs: "Vápenocementová omítka (vnitřní / vnější)", en: "Lime-Cement Render / Plaster" },
    category: { cs: "Omítky a potěry", en: "Plasters & Renders" },
    design_thermal_conductivity: 0.88,
    is_custom: false
  },
  {
    id: "mat-gypsum-plaster",
    name: { cs: "Sádrová omítka", en: "Gypsum Plaster" },
    category: { cs: "Omítky a potěry", en: "Plasters & Renders" },
    design_thermal_conductivity: 0.40,
    is_custom: false
  },
  {
    id: "mat-thermal-render",
    name: { cs: "Tepelněizolační omítka (Baumit Thermo / Ytong)", en: "Thermal Insulating Render" },
    category: { cs: "Omítky a potěry", en: "Plasters & Renders" },
    design_thermal_conductivity: 0.09,
    is_custom: false
  },
  {
    id: "mat-anhydrite-screed",
    name: { cs: "Anhydritový potěr (Anhydrit lité podlahy)", en: "Anhydrite Screed" },
    category: { cs: "Omítky a potěry", en: "Plasters & Renders" },
    design_thermal_conductivity: 1.20,
    is_custom: false
  },
  {
    id: "mat-cement-screed",
    name: { cs: "Cementový potěr / Cementová mazanina", en: "Cement Screed" },
    category: { cs: "Omítky a potěry", en: "Plasters & Renders" },
    design_thermal_conductivity: 1.16,
    is_custom: false
  },
  {
    id: "mat-thin-layer-finish-render",
    name: { cs: "Tenkovrstvá silikonová / akrylátová omítka", en: "Thin-layer Silicone/Acrylic Finish Render" },
    category: { cs: "Omítky a potěry", en: "Plasters & Renders" },
    design_thermal_conductivity: 0.70,
    is_custom: false
  },

  // ==========================================
  // 6. Zemina a ostatní / Ground & Misc
  // ==========================================
  {
    id: "mat-moist-ground",
    name: { cs: "Zemina vlhká (pro podlahy na terénu)", en: "Moist Ground / Soil (for ground floors)" },
    category: { cs: "Zemina a ostatní", en: "Ground & Misc" },
    design_thermal_conductivity: 2.00,
    is_custom: false
  },
  {
    id: "mat-gravel-aggregate",
    name: { cs: "Štěrkový podsyp (Štěrkodrť)", en: "Gravel Aggregate / Sub-base" },
    category: { cs: "Zemina a ostatní", en: "Ground & Misc" },
    design_thermal_conductivity: 0.70,
    is_custom: false
  },
  {
    id: "mat-bitumen-membrane",
    name: { cs: "Asfaltové pásy a hydroizolace", en: "Bitumen Waterproofing Membranes" },
    category: { cs: "Zemina a ostatní", en: "Ground & Misc" },
    design_thermal_conductivity: 0.17,
    is_custom: false
  },
  {
    id: "mat-window-float-glass",
    name: { cs: "Okenní tabulové sklo (Float glass)", en: "Window Float Glass" },
    category: { cs: "Zemina a ostatní", en: "Ground & Misc" },
    design_thermal_conductivity: 1.00,
    is_custom: false
  },
  {
    id: "mat-air-layer-unventilated",
    name: { cs: "Nevětraná vzduchová mezera (ekvivalentní λ)", en: "Unventilated Air Cavity (Equivalent λ)" },
    category: { cs: "Zemina a ostatní", en: "Ground & Misc" },
    design_thermal_conductivity: 0.14,
    is_custom: false
  }
];
