using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Architecture;

namespace BSI.RevitAddin
{
    /// <summary>
    /// Reads all placed Rooms from a Revit document and groups them into zones by level.
    /// </summary>
    public static class RoomExtractor
    {
        private const double SqFtToSqM = 0.09290304;

        /// <summary>Area unit the Revit project is using.</summary>
        public enum AreaUnit { SquareMeters, SquareFeet }

        /// <summary>Detected project area unit (set during extraction).</summary>
        public static AreaUnit ProjectAreaUnit { get; private set; } = AreaUnit.SquareMeters;

        /// <summary>Unit suffix for display ("m²" or "ft²").</summary>
        public static string UnitLabel => ProjectAreaUnit == AreaUnit.SquareMeters ? "m\u00B2" : "ft\u00B2";

        public class RoomInfo
        {
            public string Id { get; set; }
            /// <summary>Revit ElementId.Value for the source Room element.</summary>
            public long RevitElementId { get; set; }
            public string Name { get; set; }
            public string Number { get; set; }
            /// <summary>Area in the project's display unit (m² or ft²).</summary>
            public double Area { get; set; }
            /// <summary>Area always in m² for the backend API.</summary>
            public double AreaSqM { get; set; }
            public string LevelName { get; set; }
            public int LevelNumber { get; set; }
            public string Department { get; set; }
            public string Category { get; set; }
            public double Confidence { get; set; }
        }

        public class ZoneData
        {
            public string Name { get; set; }
            public string PrimaryUse { get; set; }
            public List<int> Levels { get; set; } = new List<int>();
            public List<RoomInfo> Rooms { get; set; } = new List<RoomInfo>();
            public double TotalArea { get; set; }
        }

        public class AreaPlanResult
        {
            /// <summary>True if a Gross Building area scheme was found with areas.</summary>
            public bool HasAreaPlans { get; set; }
            /// <summary>Name of the area scheme used.</summary>
            public string SchemeName { get; set; }
            /// <summary>Per-level GFA in m² from area plans.</summary>
            public Dictionary<string, double> GfaByLevelSqM { get; set; } = new Dictionary<string, double>();
            /// <summary>Total GFA from area plans in m².</summary>
            public double TotalGfaSqM => GfaByLevelSqM.Values.Sum();
        }

        /// <summary>
        /// Extracts all placed rooms (area > 0) from the active document.
        /// </summary>
        public static List<RoomInfo> ExtractRooms(Document doc)
        {
            // Detect project area unit
            ProjectAreaUnit = DetectAreaUnit(doc);

            var levels = new Dictionary<ElementId, Level>();
            var levelCollector = new FilteredElementCollector(doc)
                .OfClass(typeof(Level));
            foreach (Level lev in levelCollector)
                levels[lev.Id] = lev;

            var collector = new FilteredElementCollector(doc)
                .OfCategory(BuiltInCategory.OST_Rooms)
                .WhereElementIsNotElementType();

            var rooms = new List<RoomInfo>();
            int autoId = 1;

            foreach (var elem in collector)
            {
                var room = elem as Room;
                if (room == null || room.Area <= 0) continue;

                Level level = null;
                if (room.LevelId != null && room.LevelId != ElementId.InvalidElementId)
                    levels.TryGetValue(room.LevelId, out level);

                // Revit internal area is always in ft²
                double areaInternalFt2 = room.Area;
                double areaSqM = Math.Round(areaInternalFt2 * SqFtToSqM, 2);
                double areaDisplay = ProjectAreaUnit == AreaUnit.SquareFeet
                    ? Math.Round(areaInternalFt2, 2)
                    : areaSqM;

                rooms.Add(new RoomInfo
                {
                    Id = $"R{autoId++}",
                    RevitElementId = room.Id.Value,
                    Name = room.get_Parameter(BuiltInParameter.ROOM_NAME)?.AsString() ?? "Room",
                    Number = room.Number ?? "",
                    Area = areaDisplay,
                    AreaSqM = areaSqM,
                    LevelName = level?.Name ?? "Unknown",
                    LevelNumber = ExtractLevelNumber(level),
                    Department = room.get_Parameter(BuiltInParameter.ROOM_DEPARTMENT)?.AsString() ?? "",
                });
            }

            return rooms.OrderBy(r => r.LevelNumber).ThenBy(r => r.Name).ToList();
        }

        /// <summary>
        /// Groups rooms by level into zone data structures.
        /// </summary>
        public static List<ZoneData> GroupIntoZones(List<RoomInfo> rooms)
        {
            return rooms
                .GroupBy(r => r.LevelName)
                .Select(g =>
                {
                    var levelNum = g.First().LevelNumber;
                    return new ZoneData
                    {
                        Name = g.Key,
                        Levels = new List<int> { levelNum },
                        Rooms = g.ToList(),
                        TotalArea = Math.Round(g.Sum(r => r.Area), 2),
                    };
                })
                .OrderBy(z => z.Levels.FirstOrDefault())
                .ToList();
        }

        /// <summary>
        /// After AI classification, infers a zone's primary use from the most common
        /// revenue category among its rooms.
        /// </summary>
        public static void InferZonePrimaryUse(List<ZoneData> zones)
        {
            var revenueCategories = new HashSet<string>
            {
                "residential", "retail", "office", "hospitality"
            };

            foreach (var zone in zones)
            {
                // Find the most common revenue category by area
                var categoryAreas = zone.Rooms
                    .Where(r => !string.IsNullOrEmpty(r.Category) && revenueCategories.Contains(r.Category))
                    .GroupBy(r => r.Category)
                    .Select(g => new { Category = g.Key, Area = g.Sum(r => r.AreaSqM) })
                    .OrderByDescending(x => x.Area)
                    .FirstOrDefault();

                if (categoryAreas != null)
                    zone.PrimaryUse = categoryAreas.Category;
                else
                {
                    // Fall back to most common category overall
                    var topCategory = zone.Rooms
                        .Where(r => !string.IsNullOrEmpty(r.Category))
                        .GroupBy(r => r.Category)
                        .OrderByDescending(g => g.Sum(r => r.AreaSqM))
                        .FirstOrDefault();

                    zone.PrimaryUse = topCategory?.Key ?? "unclassified";
                }
            }
        }

        /// <summary>
        /// Merges adjacent zones that share the same PrimaryUse into a single zone.
        /// E.g. Level 5, 6, 7 all "residential" → "Residential (L5–L7)".
        /// Zones must already be ordered by level and have PrimaryUse set.
        /// </summary>
        public static List<ZoneData> MergeConsecutiveZones(List<ZoneData> zones)
        {
            if (zones.Count <= 1) return zones;

            // --- Pass 1: merge zones that share the same level AND same PrimaryUse ---
            // (e.g. L1 Block 35 retail + L1 Block 37 retail → single L1 retail zone)
            var byLevelAndUse = new Dictionary<string, ZoneData>();
            var pass1Order = new List<string>();

            foreach (var zone in zones)
            {
                foreach (int lv in zone.Levels.Distinct())
                {
                    string key = $"{lv}|{(zone.PrimaryUse ?? "").ToLowerInvariant()}";
                    if (byLevelAndUse.ContainsKey(key))
                    {
                        var target = byLevelAndUse[key];
                        var newRooms = zone.Rooms.Where(r => r.LevelNumber == lv).ToList();
                        target.Rooms.AddRange(newRooms);
                        target.TotalArea = Math.Round(target.Rooms.Sum(r => r.Area), 2);
                    }
                    else
                    {
                        var roomsForLevel = zone.Rooms.Where(r => r.LevelNumber == lv).ToList();
                        var newZone = new ZoneData
                        {
                            Name = zone.Name,
                            PrimaryUse = zone.PrimaryUse,
                            Levels = new List<int> { lv },
                            Rooms = new List<RoomInfo>(roomsForLevel),
                            TotalArea = Math.Round(roomsForLevel.Sum(r => r.Area), 2),
                        };
                        byLevelAndUse[key] = newZone;
                        pass1Order.Add(key);
                    }
                }
            }

            var pass1 = pass1Order.Select(k => byLevelAndUse[k]).ToList();

            // Clean up names for single-level zones after same-level merge
            // e.g. "L1 - Block 35" → "Retail (L1)" when PrimaryUse is known
            foreach (var z in pass1)
            {
                if (z.Levels.Count == 1 && !string.IsNullOrEmpty(z.PrimaryUse))
                {
                    var useLabel = System.Globalization.CultureInfo.CurrentCulture.TextInfo
                        .ToTitleCase(z.PrimaryUse);
                    int lv = z.Levels[0];
                    string lvLabel = lv < 0 ? $"B{Math.Abs(lv)}" : $"L{lv}";
                    z.Name = $"{useLabel} ({lvLabel})";
                }
            }

            // --- Pass 2: merge consecutive levels with same PrimaryUse ---
            var merged = new List<ZoneData>();
            ZoneData current = null;

            foreach (var zone in pass1)
            {
                if (current == null)
                {
                    current = CloneZone(zone);
                    continue;
                }

                int prevMax = current.Levels.Max();
                int thisMin = zone.Levels.Min();
                bool consecutive = (thisMin - prevMax) <= 1;
                bool sameUse = string.Equals(current.PrimaryUse, zone.PrimaryUse, StringComparison.OrdinalIgnoreCase);

                if (consecutive && sameUse)
                {
                    current.Levels.AddRange(zone.Levels);
                    current.Rooms.AddRange(zone.Rooms);
                    current.TotalArea = Math.Round(current.Rooms.Sum(r => r.Area), 2);
                }
                else
                {
                    FinalizeMergedZoneName(current);
                    merged.Add(current);
                    current = CloneZone(zone);
                }
            }

            if (current != null)
            {
                FinalizeMergedZoneName(current);
                merged.Add(current);
            }

            return merged;
        }

        private static ZoneData CloneZone(ZoneData z)
        {
            return new ZoneData
            {
                Name = z.Name,
                PrimaryUse = z.PrimaryUse,
                Levels = new List<int>(z.Levels),
                Rooms = new List<RoomInfo>(z.Rooms),
                TotalArea = z.TotalArea,
            };
        }

        private static void FinalizeMergedZoneName(ZoneData zone)
        {
            if (zone.Levels.Count <= 1) return;

            // Build a nice name: "Residential (L5–L22)"
            var sorted = zone.Levels.OrderBy(l => l).ToList();
            var useLabel = System.Globalization.CultureInfo.CurrentCulture.TextInfo
                .ToTitleCase(zone.PrimaryUse ?? "Mixed");
            zone.Name = $"{useLabel} (L{sorted.First()}\u2013L{sorted.Last()})";
        }

        /// <summary>
        /// Reads Area elements from the Gross Building area scheme and returns per-level GFA.
        /// Falls back gracefully if no area scheme exists.
        /// </summary>
        public static AreaPlanResult ExtractAreaPlans(Document doc)
        {
            var result = new AreaPlanResult();

            var levels = new Dictionary<ElementId, Level>();
            foreach (Level lev in new FilteredElementCollector(doc).OfClass(typeof(Level)))
                levels[lev.Id] = lev;

            var collector = new FilteredElementCollector(doc)
                .OfCategory(BuiltInCategory.OST_Areas)
                .WhereElementIsNotElementType();

            foreach (var elem in collector)
            {
                var areaElem = elem as Area;
                if (areaElem == null || areaElem.Area <= 0) continue;

                // Get area scheme name
                string schemeName = null;
                try
                {
                    var schemeIdParam = areaElem.get_Parameter(BuiltInParameter.AREA_SCHEME_ID);
                    if (schemeIdParam != null)
                    {
                        var schemeId = schemeIdParam.AsElementId();
                        if (schemeId != null && schemeId != ElementId.InvalidElementId)
                            schemeName = doc.GetElement(schemeId)?.Name;
                    }
                }
                catch { }

                // Fallback: lookup by parameter display name
                if (string.IsNullOrEmpty(schemeName))
                {
                    try
                    {
                        var p = areaElem.LookupParameter("Area Scheme");
                        schemeName = p?.AsValueString() ?? p?.AsString();
                    }
                    catch { }
                }

                if (string.IsNullOrEmpty(schemeName)) continue;

                // Only include areas from the "Gross Building" scheme
                if (schemeName.IndexOf("Gross", StringComparison.OrdinalIgnoreCase) < 0) continue;

                result.HasAreaPlans = true;
                result.SchemeName = schemeName;

                // Get level
                Level level = null;
                if (areaElem.LevelId != null && areaElem.LevelId != ElementId.InvalidElementId)
                    levels.TryGetValue(areaElem.LevelId, out level);
                string levelName = level?.Name ?? "Unknown";

                // Revit internal area is always in ft²
                double areaSqM = areaElem.Area * SqFtToSqM;

                if (result.GfaByLevelSqM.ContainsKey(levelName))
                    result.GfaByLevelSqM[levelName] += areaSqM;
                else
                    result.GfaByLevelSqM[levelName] = areaSqM;
            }

            // Round final values
            foreach (var key in result.GfaByLevelSqM.Keys.ToList())
                result.GfaByLevelSqM[key] = Math.Round(result.GfaByLevelSqM[key], 2);

            return result;
        }

        /// <summary>
        /// Extracts a numeric level index from a Level element.
        /// Tries to parse a number from the name, falls back to elevation-based ordering.
        /// </summary>
        private static int ExtractLevelNumber(Level level)
        {
            if (level == null) return 0;

            var name = level.Name.Trim();

            // If name contains " - " or " \u2013 " (e.g. "L1 - Block 35"), use the part before the separator
            var sepIdx = name.IndexOf(" - ", StringComparison.Ordinal);
            if (sepIdx < 0) sepIdx = name.IndexOf(" \u2013 ", StringComparison.Ordinal);
            if (sepIdx > 0) name = name.Substring(0, sepIdx).Trim();

            // Basement patterns: B1, B2, Basement 1 → negative numbers
            var basementMatch = Regex.Match(name, @"^(?:B|Basement\s*)(\d+)", RegexOptions.IgnoreCase);
            if (basementMatch.Success && int.TryParse(basementMatch.Groups[1].Value, out int bNum))
                return -bNum;

            // Standard patterns: "Level 3", "L1", "Floor 2", "Storey 5"
            var prefixMatch = Regex.Match(name, @"^(?:Level|L|Floor|Storey|Story)\s*(\d+)", RegexOptions.IgnoreCase);
            if (prefixMatch.Success && int.TryParse(prefixMatch.Groups[1].Value, out int pNum))
                return pNum;

            // Fallback: first number anywhere in the (trimmed) prefix
            var firstNum = Regex.Match(name, @"\d+");
            if (firstNum.Success && int.TryParse(firstNum.Value, out int fNum))
                return fNum;

            // Last resort: elevation-based (Revit elevation is in feet, ~10 ft per storey)
            return (int)Math.Round(level.Elevation / 10.0);
        }

        /// <summary>
        /// Detects the project's area display unit from the document settings.
        /// Revit 2022+ uses FormatOptions; older versions use ProjectUnit.
        /// </summary>
        private static AreaUnit DetectAreaUnit(Document doc)
        {
            try
            {
                var units = doc.GetUnits();
                var formatOptions = units.GetFormatOptions(SpecTypeId.Area);
                var unitTypeId = formatOptions.GetUnitTypeId();

                // Check if it's square feet or square meters
                if (unitTypeId == UnitTypeId.SquareFeet)
                    return AreaUnit.SquareFeet;

                return AreaUnit.SquareMeters;
            }
            catch
            {
                // If detection fails, default to metric
                return AreaUnit.SquareMeters;
            }
        }
    }
}
