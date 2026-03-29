# BSI v2 — Building Scheme Intelligence
## AI-Powered Mixed-Use Building Analysis

### Product Definition

**BSI** (formerly RSI) analyzes building scheme efficiency across **any use type** —
residential, commercial, retail, hospitality, parking, mixed-use — with AI-powered
insights that tell architects not just *what* is wrong but *what to do about it*.

---

## 1. Expanded Space Categories

### Primary Use Types (revenue-generating)
| Category Key        | Label              | Example Spaces                          |
|---------------------|--------------------|-----------------------------------------|
| `residential`       | Residential NLA    | Apartments, studios, penthouses         |
| `retail`            | Retail GLA         | Shops, F&B, showrooms                   |
| `office`            | Office NLA         | Open office, private offices, co-work   |
| `hospitality`       | Hospitality NLA    | Hotel rooms, suites, serviced apts      |

### Support Categories (non-revenue)
| Category Key        | Label              | Example Spaces                          |
|---------------------|--------------------|-----------------------------------------|
| `core`              | Core               | Stairs, lifts, risers, lobbies          |
| `circulation`       | Circulation        | Corridors, hallways, shared access      |
| `parking`           | Parking            | Car parking, bicycle parking            |
| `amenity`           | Amenity            | Gym, pool, lounge, rooftop terrace      |
| `boh`               | Back of House      | Plant rooms, MEP, storage, loading dock |
| `unclassified`      | Unclassified       | Not yet categorized                     |

---

## 2. Zone Model

BSI groups floors into **zones** by primary use type. Each zone gets independent
efficiency analysis and benchmarks.

```
Building
├── Zone: Retail Podium (G-L1)
│   ├── Retail GLA: 1,200 m²
│   ├── Core: 80 m²
│   ├── Circulation: 45 m²
│   └── Efficiency: 90.5%  (benchmark: 88-92%)
├── Zone: Parking (B2-B1)
│   ├── Parking: 3,400 m²
│   ├── Core: 120 m²
│   ├── Circulation: 180 m²
│   └── Efficiency: 91.9%  (benchmark: 90-95%)
├── Zone: Residential Tower (L2-L25)
│   ├── Residential NLA: 14,400 m²
│   ├── Core: 2,160 m²
│   ├── Circulation: 1,440 m²
│   └── Efficiency: 80.0%  (benchmark: 78-83%)
└── Whole Building Summary
    ├── Total GFA: 22,025 m²
    ├── Total NLA: 15,600 m²
    ├── Blended Efficiency: 82.4%
    └── Revenue Zones: 3
```

---

## 3. API Contract

### 3.1 POST /api/bsi/analyze

**Input** (from Revit plugin or web):
```json
{
  "projectName": "Marina Tower",
  "buildingType": "mixed_use_tower",
  "areas": [
    {
      "id": "area_001",
      "name": "Unit A - Studio",
      "level": "Level 3",
      "levelNumber": 3,
      "area": 42.5,
      "category": "residential",
      "perimeter": 26.4
    },
    {
      "id": "area_002",
      "name": "Ground Floor Shop 1",
      "level": "Ground",
      "levelNumber": 0,
      "area": 85.0,
      "category": "retail",
      "perimeter": 38.2
    }
  ],
  "zones": [
    { "name": "Retail Podium", "levels": [0, 1], "primaryUse": "retail" },
    { "name": "Parking", "levels": [-2, -1], "primaryUse": "parking" },
    { "name": "Residential Tower", "levels": [2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25], "primaryUse": "residential" }
  ],
  "financial": {
    "residential_price_per_sqm": 8500,
    "retail_rent_per_sqm_year": 1200,
    "office_rent_per_sqm_year": 900,
    "parking_price_per_space": 45000
  }
}
```

**Output**:
```json
{
  "summary": {
    "totalGFA": 22025,
    "totalNLA": 15600,
    "blendedEfficiency": 0.824,
    "zoneCount": 3,
    "areaCount": 312,
    "unclassifiedCount": 0
  },
  "zones": [
    {
      "name": "Retail Podium",
      "primaryUse": "retail",
      "levels": [0, 1],
      "gfa": 1325,
      "nla": 1200,
      "core": 80,
      "circulation": 45,
      "efficiency": 0.905,
      "benchmark": { "min": 0.88, "target": 0.90, "max": 0.92 },
      "status": "on_target",
      "breakdown": { "retail": 1200, "core": 80, "circulation": 45 }
    }
  ],
  "financial": {
    "residential_revenue": 122400000,
    "retail_annual_rent": 1440000,
    "parking_revenue": 3150000,
    "total_estimated_value": 126990000
  }
}
```

### 3.2 POST /api/bsi/classify

**AI Auto-Classification.** Sends area names, sizes, and levels → returns predicted categories.

**Input**:
```json
{
  "areas": [
    { "id": "a1", "name": "Corridor L3", "level": "Level 3", "area": 28.5 },
    { "id": "a2", "name": "Shop 1A", "level": "Ground", "area": 92.0 },
    { "id": "a3", "name": "Stair 1", "level": "Level 5", "area": 12.0 },
    { "id": "a4", "name": "Unit B 2BR", "level": "Level 8", "area": 95.0 }
  ]
}
```

**Output**:
```json
{
  "classifications": [
    { "id": "a1", "category": "circulation", "confidence": 0.97 },
    { "id": "a2", "category": "retail", "confidence": 0.94 },
    { "id": "a3", "category": "core", "confidence": 0.98 },
    { "id": "a4", "category": "residential", "confidence": 0.96 }
  ],
  "unresolved": []
}
```

### 3.3 POST /api/bsi/advise

**AI Design Advisor.** Takes analysis results → returns actionable suggestions.

**Input**: Same as /analyze output + original areas

**Output**:
```json
{
  "suggestions": [
    {
      "zone": "Residential Tower",
      "severity": "high",
      "type": "circulation_overallocation",
      "message": "Corridor on levels 3-10 averages 1.8m width — reducing to 1.5m (code minimum) recovers 7.2m² per floor, 57.6m² total. At $8,500/m² that's $489,600 additional revenue.",
      "metric_impact": { "efficiency_delta": +0.032, "revenue_delta": 489600 }
    },
    {
      "zone": "Retail Podium",
      "severity": "low",
      "type": "efficiency_optimal",
      "message": "Retail podium at 90.5% efficiency — well within benchmark. No changes recommended."
    }
  ],
  "narrative": "This 25-story mixed-use tower achieves 82.4% blended efficiency..."
}
```

---

## 4. Benchmarks Database

| Building Type              | Use Zone     | Efficiency Range | Core Target | Circ Target |
|----------------------------|-------------|-----------------|-------------|-------------|
| `residential_lowrise`      | residential | 83-88%          | 8-10%       | 4-7%        |
| `residential_midrise`      | residential | 80-85%          | 10-13%      | 5-8%        |
| `residential_highrise`     | residential | 76-82%          | 12-16%      | 6-10%       |
| `office_class_a`           | office      | 82-87%          | 8-11%       | 3-6%        |
| `office_class_b`           | office      | 84-89%          | 7-9%        | 3-5%        |
| `retail_mall`              | retail      | 85-92%          | 5-8%        | 3-5%        |
| `retail_high_street`       | retail      | 88-93%          | 4-6%        | 2-4%        |
| `hotel_3star`              | hospitality | 60-68%          | 12-15%      | 15-20%      |
| `hotel_5star`              | hospitality | 55-63%          | 14-18%      | 18-25%      |
| `parking_above_ground`     | parking     | 90-95%          | 3-5%        | 2-4%        |
| `parking_basement`         | parking     | 88-93%          | 4-6%        | 3-5%        |
| `mixed_use_podium_tower`   | blended     | 78-84%          | varies      | varies      |

---

## 5. Revit Plugin Changes (C# side — future)

1. Replace `RSI_Category` parameter with `BSI_Category` (expanded enum)
2. Add `BSI_Zone` parameter for zone assignment
3. Add `BSI_UseType` parameter for primary use type per area
4. UI: Add zone configuration panel (drag levels into zones)
5. API: Plugin sends all area data to `/api/bsi/analyze` and `/api/bsi/advise`
6. AI panel: Display suggestions inline in Revit dockable panel

---

## 6. Migration Path

- RSI users keep existing functionality (residential analysis = one zone)
- BSI adds zones + mixed-use + AI on top
- Revit plugin auto-detects: if all areas are residential → single-zone mode (backward compatible)
- License: BSI replaces RSI in product catalog (same subscription)
