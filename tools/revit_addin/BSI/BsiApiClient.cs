using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace BSI.RevitAddin
{
    /// <summary>
    /// HTTP client for the BSI backend API endpoints.
    /// Handles classify, analyze, and advise calls.
    /// </summary>
    public static class BsiApiClient
    {
        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };

        // ── Classify: AI room classification ──────────────────────────

        public static async Task<List<ClassifyResult>> ClassifyAsync(
            string serverUrl,
            string token,
            List<RoomExtractor.RoomInfo> rooms)
        {
            var areas = rooms.Select(r => new Dictionary<string, object>
            {
                { "id", r.Id },
                { "name", r.Name },
                { "level", r.LevelName },
                { "area", r.AreaSqM },
            }).ToList<object>();

            var payload = new Dictionary<string, object> { { "areas", areas } };
            var result = await PostAsync(serverUrl + "/api/bsi/classify", token, payload);

            var classifications = new List<ClassifyResult>();
            if (result.ContainsKey("classifications"))
            {
                var list = result["classifications"] as ArrayList ?? ToArrayList(result["classifications"]);
                if (list != null)
                {
                    foreach (Dictionary<string, object> item in list)
                    {
                        var roomId = item["id"]?.ToString();
                        var room = rooms.FirstOrDefault(r => r.Id == roomId);
                        classifications.Add(new ClassifyResult
                        {
                            Id = roomId,
                            RevitElementId = room?.RevitElementId ?? 0,
                            Name = room?.Name ?? roomId,
                            Category = item["category"]?.ToString() ?? "unclassified",
                            Confidence = ToDouble(item, "confidence"),
                        });
                    }
                }
            }
            return classifications;
        }

        // ── Analyze: Pure calculation against benchmarks ─────────────

        public static async Task<Dictionary<string, object>> AnalyzeAsync(
            string serverUrl,
            string token,
            string projectName,
            List<RoomExtractor.RoomInfo> rooms,
            List<RoomExtractor.ZoneData> zones,
            RoomExtractor.AreaPlanResult areaPlanResult = null,
            string preset = null,
            string buildingHeight = null)
        {
            // Build areas array matching the API contract
            var areas = rooms.Select(r => new Dictionary<string, object>
            {
                { "name", r.Name },
                { "category", r.Category ?? "unclassified" },
                { "area", r.AreaSqM },
                { "levelNumber", r.LevelNumber },
            }).ToList<object>();

            // Pre-compute per-level room area totals for proportional GFA splitting.
            // When multiple zones share a level, each zone gets GFA proportional to its room area.
            Dictionary<string, double> totalRoomAreaByLevel = null;
            if (areaPlanResult?.HasAreaPlans == true)
            {
                totalRoomAreaByLevel = rooms
                    .GroupBy(r => r.LevelName)
                    .ToDictionary(g => g.Key, g => g.Sum(r => r.AreaSqM));
            }

            var zonesPayload = zones.Select(z =>
            {
                var zoneDict = new Dictionary<string, object>
                {
                    { "name", z.Name },
                    { "primaryUse", z.PrimaryUse ?? "residential" },
                    { "levels", z.Levels.Cast<object>().ToList() },
                };

                // Distribute area plan GFA proportionally across zones sharing a level.
                // Sum GFA from all levels this zone spans, splitting each level's GFA by
                // the zone's share of room area on that level.
                if (areaPlanResult?.HasAreaPlans == true && totalRoomAreaByLevel != null)
                {
                    double zoneGfa = 0;
                    // Get distinct level names from the zone's rooms
                    var levelNames = z.Rooms.Select(r => r.LevelName).Distinct();
                    foreach (var lvName in levelNames)
                    {
                        if (!areaPlanResult.GfaByLevelSqM.ContainsKey(lvName)) continue;
                        double levelGfa = areaPlanResult.GfaByLevelSqM[lvName];
                        double levelTotalRoom = totalRoomAreaByLevel.ContainsKey(lvName)
                            ? totalRoomAreaByLevel[lvName] : 0;
                        double zoneRoomOnLevel = z.Rooms
                            .Where(r => r.LevelName == lvName).Sum(r => r.AreaSqM);
                        // Proportional share: zone's room area on this level / total room area on level
                        double share = levelTotalRoom > 0 ? zoneRoomOnLevel / levelTotalRoom : 0;
                        zoneGfa += levelGfa * share;
                    }
                    if (zoneGfa > 0)
                        zoneDict["gfa"] = Math.Round(zoneGfa, 2);
                }

                return zoneDict;
            }).ToList<object>();

            var payload = new Dictionary<string, object>
            {
                { "projectName", projectName },
                { "areas", areas },
                { "zones", zonesPayload },
            };

            if (!string.IsNullOrEmpty(preset))
                payload["preset"] = preset;
            if (!string.IsNullOrEmpty(buildingHeight))
                payload["buildingHeight"] = buildingHeight;

            return await PostAsync(serverUrl + "/api/bsi/analyze", token, payload);
        }

        // ── Advise: AI design advisor ────────────────────────────────

        public static async Task<AdviseResponse> AdviseAsync(
            string serverUrl,
            string token,
            Dictionary<string, object> analysisResult,
            string zoneId = null)
        {
            // Wrap the analysis result in the expected format
            var payload = new Dictionary<string, object>
            {
                { "analysis", analysisResult },
            };

            if (!string.IsNullOrEmpty(zoneId))
                payload["zoneId"] = zoneId;

            var result = await PostAsync(serverUrl + "/api/bsi/advise", token, payload);

            var response = new AdviseResponse
            {
                Narrative = result.ContainsKey("narrative") ? result["narrative"]?.ToString() : null,
            };

            if (result.ContainsKey("suggestions"))
            {
                var list = result["suggestions"] as ArrayList ?? ToArrayList(result["suggestions"]);
                if (list != null)
                {
                    foreach (Dictionary<string, object> item in list)
                    {
                        var suggestion = new SuggestionResult
                        {
                            Zone = item.ContainsKey("zone") ? item["zone"]?.ToString() : "whole_building",
                            Severity = item.ContainsKey("severity") ? item["severity"]?.ToString() : "info",
                            Type = item.ContainsKey("type") ? item["type"]?.ToString() : "",
                            Message = item.ContainsKey("message") ? item["message"]?.ToString() : "",
                        };

                        if (item.ContainsKey("metric_impact"))
                        {
                            var impact = item["metric_impact"] as Dictionary<string, object>;
                            if (impact != null)
                            {
                                if (impact.ContainsKey("efficiency_delta"))
                                    suggestion.EfficiencyDelta = ToDouble(impact, "efficiency_delta");
                                if (impact.ContainsKey("revenue_delta"))
                                    suggestion.RevenueDelta = ToDouble(impact, "revenue_delta");
                            }
                        }

                        response.Suggestions.Add(suggestion);
                    }
                }
            }

            return response;
        }

        // ── Presets: fetch available benchmark presets ────────────────

        public static async Task<List<PresetInfo>> GetPresetsAsync(string serverUrl, string token)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, serverUrl + "/api/bsi/presets");
            request.Headers.Add("Authorization", "Bearer " + token);
            var response = await Http.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode) return null;

            var data = Json.Deserialize<Dictionary<string, object>>(body);
            if (!data.ContainsKey("presets")) return null;

            var list = data["presets"] as ArrayList ?? ToArrayList(data["presets"]);
            if (list == null) return null;

            var presets = new List<PresetInfo>();
            foreach (Dictionary<string, object> item in list)
            {
                presets.Add(new PresetInfo
                {
                    Id = item.ContainsKey("id") ? item["id"]?.ToString() : "",
                    Label = item.ContainsKey("label") ? item["label"]?.ToString() : "",
                    Description = item.ContainsKey("description") ? item["description"]?.ToString() : "",
                    Region = item.ContainsKey("region") ? item["region"]?.ToString() : "",
                });
            }
            return presets;
        }

        // ── HTTP helper ──────────────────────────────────────────────

        private static async Task<Dictionary<string, object>> PostAsync(
            string url, string token, object payload)
        {
            var json = Json.Serialize(payload);
            var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
            request.Headers.Add("Authorization", "Bearer " + token);

            var response = await Http.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception($"API error {(int)response.StatusCode}: {body}");

            return Json.Deserialize<Dictionary<string, object>>(body);
        }

        // ── JSON helpers (JavaScriptSerializer quirks) ───────────────

        private static double ToDouble(Dictionary<string, object> dict, string key)
        {
            if (!dict.ContainsKey(key) || dict[key] == null) return 0.0;
            var val = dict[key];
            if (val is double d) return d;
            if (val is int i) return i;
            if (val is decimal m) return (double)m;
            if (val is long l) return l;
            double.TryParse(val.ToString(), out double parsed);
            return parsed;
        }

        private static ArrayList ToArrayList(object obj)
        {
            if (obj is object[] arr)
            {
                var list = new ArrayList();
                foreach (var item in arr) list.Add(item);
                return list;
            }
            return null;
        }
    }

    public class AdviseResponse
    {
        public string Narrative { get; set; }
        public List<SuggestionResult> Suggestions { get; set; } = new List<SuggestionResult>();
    }
}
