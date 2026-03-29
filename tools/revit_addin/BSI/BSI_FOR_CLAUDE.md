# BSI (Building Scheme Intelligence) — Complete Codebase

## What BSI Does

BSI is a Revit 2024 dockable panel plugin that:

1. Reads all placed Rooms from the Revit model
2. Sends room data to a Node.js backend which uses Claude AI to classify each room (residential, retail, core, circulation, parking, etc.)
3. Calculates per-zone efficiency (NLA/GFA) and compares against industry benchmarks
4. Optionally asks Claude AI for design improvement suggestions

## Architecture

- **Revit Plugin**: C# / .NET Framework 4.8 / WPF (code-only, no XAML) / Revit 2024 API
- **Backend**: Node.js Express on localhost:5000, uses Anthropic Claude SDK
- **AI Models**: claude-sonnet (classify), claude-opus (advise)
- **Analysis**: Pure math calculation (no AI) — NLA = sum of revenue-generating room areas, GFA = sum of all room areas, Efficiency = NLA/GFA

## Key Calculation Logic

- Revit internal areas are always in ft² (square feet)
- Backend API always receives and returns values in m² (square meters)
- Conversion: 1 ft² = 0.09290304 m², 1 m² = 10.7639104 ft²
- Display converts API m² back to project units if project uses ft²
- "GFA" in BSI = sum of all Room areas (not Revit's "Gross Building Area" from Area Plans)
- "NLA" = sum of revenue-generating rooms only (residential, retail, office, hospitality)
- Efficiency = NLA / GFA per zone

## Current Test Results (Snowdon Towers Sample)

- 54 rooms, 9 zones
- BSI GFA: 56,377 ft² (sum of Room areas)
- BSI NLA: 30,300 ft²
- Blended Efficiency: 53.7%
- Revit Area Schedule (Gross Building) Grand Total: 76,616.96 SF
- Note: BSI reads Rooms (wall-to-wall internal), not Area Plans (which include wall thickness)

---

## FILE: BSI.csproj

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net48</TargetFramework>
    <AssemblyName>BSI.RevitAddin</AssemblyName>
    <RootNamespace>BSI.RevitAddin</RootNamespace>
    <LangVersion>latest</LangVersion>
    <PlatformTarget>x64</PlatformTarget>
    <OutputType>Library</OutputType>
    <!-- DEV: Build straight into Revit addins folder -->
    <AppData>$([System.Environment]::GetFolderPath(System.Environment+SpecialFolder.ApplicationData))</AppData>
    <OutputPath>$(AppData)\Autodesk\Revit\Addins\2024\</OutputPath>
    <AppendTargetFrameworkToOutputPath>false</AppendTargetFrameworkToOutputPath>
    <AppendRuntimeIdentifierToOutputPath>false</AppendRuntimeIdentifierToOutputPath>
  </PropertyGroup>

  <ItemGroup>
    <None Include="BSI.addin" CopyToOutputDirectory="PreserveNewest" />
  </ItemGroup>

  <ItemGroup>
    <Reference Include="RevitAPI">
      <HintPath>$(ProgramFiles)\Autodesk\Revit 2024\RevitAPI.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="RevitAPIUI">
      <HintPath>$(ProgramFiles)\Autodesk\Revit 2024\RevitAPIUI.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="PresentationCore" />
    <Reference Include="PresentationFramework" />
    <Reference Include="WindowsBase" />
    <Reference Include="System.Xaml" />
    <Reference Include="System.Net.Http" />
    <Reference Include="System.Web.Extensions" />
  </ItemGroup>
</Project>
```

## FILE: BSI.addin

```xml
<?xml version="1.0" encoding="utf-8"?>
<RevitAddIns>
  <AddIn Type="Application">
    <Name>BSI - Building Scheme Intelligence</Name>
    <Assembly>BSI.RevitAddin.dll</Assembly>
    <AddInId>F7A1B2C3-D4E5-6F78-9A0B-CDEF12345678</AddInId>
    <FullClassName>BSI.RevitAddin.BsiApp</FullClassName>
    <VendorId>GenFabTools</VendorId>
    <VendorDescription>GenFabTools - Building Scheme Intelligence</VendorDescription>
  </AddIn>

  <AddIn Type="Command">
    <Name>BSI Toggle Panel</Name>
    <Assembly>BSI.RevitAddin.dll</Assembly>
    <AddInId>A2B3C4D5-E6F7-8901-2345-6789ABCDEF01</AddInId>
    <FullClassName>BSI.RevitAddin.TogglePanelCommand</FullClassName>
    <VendorId>GenFabTools</VendorId>
    <Text>BSI Panel</Text>
    <VisibilityMode>AlwaysVisible</VisibilityMode>
  </AddIn>

  <AddIn Type="Command">
    <Name>BSI Analyze Model</Name>
    <Assembly>BSI.RevitAddin.dll</Assembly>
    <AddInId>B3C4D5E6-F789-0123-4567-89ABCDEF0123</AddInId>
    <FullClassName>BSI.RevitAddin.AnalyzeCommand</FullClassName>
    <VendorId>GenFabTools</VendorId>
    <Text>Analyze Model</Text>
    <VisibilityMode>AlwaysVisible</VisibilityMode>
  </AddIn>
</RevitAddIns>
```

## FILE: BsiApp.cs

```csharp
using System;
using System.Reflection;
using Autodesk.Revit.UI;
using Autodesk.Revit.DB;
using Autodesk.Revit.Attributes;

namespace BSI.RevitAddin
{
    public class BsiApp : IExternalApplication
    {
        internal static BsiPanel Panel { get; private set; }
        internal static ExternalEvent AnalyzeEvent { get; private set; }

        private static readonly DockablePaneId PaneId =
            new DockablePaneId(new Guid("F7A1B2C3-D4E5-6F78-9A0B-CDEF12345678"));

        public Result OnStartup(UIControlledApplication app)
        {
            try
            {
                Panel = new BsiPanel();
                var handler = new AnalyzeHandler();
                AnalyzeEvent = ExternalEvent.Create(handler);

                try
                {
                    app.RegisterDockablePane(PaneId, "BSI", Panel);
                }
                catch
                {
                    // Pane was already registered — not an error
                }

                CreateRibbon(app);
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                TaskDialog.Show("BSI", "BSI startup failed: " + ex.Message);
                return Result.Failed;
            }
        }

        public Result OnShutdown(UIControlledApplication app)
        {
            return Result.Succeeded;
        }

        private void CreateRibbon(UIControlledApplication app)
        {
            string tabName = "GenFabTools";
            try { app.CreateRibbonTab(tabName); }
            catch { /* tab may already exist */ }

            RibbonPanel panel = null;
            try
            {
                var existing = app.GetRibbonPanels(tabName);
                foreach (var p in existing)
                    if (p.Name == "BSI") { panel = p; break; }
            }
            catch { }

            if (panel == null)
                panel = app.CreateRibbonPanel(tabName, "BSI");

            string assemblyPath = Assembly.GetExecutingAssembly().Location;

            bool hasToggle = false, hasAnalyze = false;
            foreach (var item in panel.GetItems())
            {
                if (item.Name == "BSI_Toggle") hasToggle = true;
                if (item.Name == "BSI_Analyze") hasAnalyze = true;
            }

            if (!hasToggle)
            {
                var toggleData = new PushButtonData(
                    "BSI_Toggle", "BSI\nPanel", assemblyPath,
                    typeof(TogglePanelCommand).FullName)
                { ToolTip = "Show or hide the BSI analysis panel" };
                panel.AddItem(toggleData);
            }

            if (!hasAnalyze)
            {
                var analyzeData = new PushButtonData(
                    "BSI_Analyze", "Analyze\nModel", assemblyPath,
                    typeof(AnalyzeCommand).FullName)
                { ToolTip = "Read all rooms and run AI efficiency analysis" };
                panel.AddItem(analyzeData);
            }
        }
    }

    [Transaction(TransactionMode.ReadOnly)]
    public class TogglePanelCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                var paneId = new DockablePaneId(new Guid("F7A1B2C3-D4E5-6F78-9A0B-CDEF12345678"));
                var pane = commandData.Application.GetDockablePane(paneId);
                if (pane.IsShown()) pane.Hide(); else pane.Show();
                return Result.Succeeded;
            }
            catch (Exception ex) { message = ex.Message; return Result.Failed; }
        }
    }

    [Transaction(TransactionMode.ReadOnly)]
    public class AnalyzeCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                var paneId = new DockablePaneId(new Guid("F7A1B2C3-D4E5-6F78-9A0B-CDEF12345678"));
                var pane = commandData.Application.GetDockablePane(paneId);
                if (!pane.IsShown()) pane.Show();
                BsiApp.AnalyzeEvent.Raise();
                return Result.Succeeded;
            }
            catch (Exception ex) { message = ex.Message; return Result.Failed; }
        }
    }
}
```

## FILE: AnalyzeHandler.cs

```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Autodesk.Revit.UI;

namespace BSI.RevitAddin
{
    public class AnalyzeHandler : IExternalEventHandler
    {
        public void Execute(UIApplication app)
        {
            var panel = BsiApp.Panel;
            var vm = panel.ViewModel;

            var doc = app.ActiveUIDocument?.Document;
            if (doc == null)
            {
                panel.Dispatcher.Invoke(() => vm.Status = "No active document open.");
                return;
            }

            panel.Dispatcher.Invoke(() =>
            {
                vm.IsAnalyzing = true;
                vm.Status = "Extracting rooms from model...";
            });

            try
            {
                var rooms = RoomExtractor.ExtractRooms(doc);

                if (rooms.Count == 0)
                {
                    panel.Dispatcher.Invoke(() =>
                    {
                        vm.Status = "No placed rooms found. Add Rooms to the model first.";
                        vm.IsAnalyzing = false;
                    });
                    return;
                }

                var zones = RoomExtractor.GroupIntoZones(rooms);
                var projectName = doc.Title ?? "Untitled";

                panel.Dispatcher.Invoke(() =>
                {
                    vm.RoomCount = rooms.Count;
                    vm.ZoneCount = zones.Count;
                    vm.TotalGFA = Math.Round(rooms.Sum(r => r.Area), 2);
                    vm.Status = $"Found {rooms.Count} rooms across {zones.Count} levels. Calling AI...";
                });

                Task.Run(() => panel.RunApiPipeline(rooms, zones, projectName));
            }
            catch (Exception ex)
            {
                panel.Dispatcher.Invoke(() =>
                {
                    vm.Status = $"Extraction error: {ex.Message}";
                    vm.IsAnalyzing = false;
                });
            }
        }

        public string GetName() => "BSI Analyze";
    }
}
```

## FILE: RoomExtractor.cs

```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Architecture;

namespace BSI.RevitAddin
{
    public static class RoomExtractor
    {
        private const double SqFtToSqM = 0.09290304;

        public enum AreaUnit { SquareMeters, SquareFeet }

        public static AreaUnit ProjectAreaUnit { get; private set; } = AreaUnit.SquareMeters;

        public static string UnitLabel => ProjectAreaUnit == AreaUnit.SquareMeters ? "m²" : "ft²";

        public class RoomInfo
        {
            public string Id { get; set; }
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

        public static List<RoomInfo> ExtractRooms(Document doc)
        {
            ProjectAreaUnit = DetectAreaUnit(doc);

            var levels = new Dictionary<ElementId, Level>();
            var levelCollector = new FilteredElementCollector(doc).OfClass(typeof(Level));
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

        public static void InferZonePrimaryUse(List<ZoneData> zones)
        {
            var revenueCategories = new HashSet<string>
            {
                "residential", "retail", "office", "hospitality"
            };

            foreach (var zone in zones)
            {
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
                    var topCategory = zone.Rooms
                        .Where(r => !string.IsNullOrEmpty(r.Category))
                        .GroupBy(r => r.Category)
                        .OrderByDescending(g => g.Sum(r => r.AreaSqM))
                        .FirstOrDefault();

                    zone.PrimaryUse = topCategory?.Key ?? "unclassified";
                }
            }
        }

        private static int ExtractLevelNumber(Level level)
        {
            if (level == null) return 0;
            var digits = new string(level.Name.Where(char.IsDigit).ToArray());
            if (int.TryParse(digits, out int num)) return num;
            return (int)Math.Round(level.Elevation / 10.0);
        }

        private static AreaUnit DetectAreaUnit(Document doc)
        {
            try
            {
                var units = doc.GetUnits();
                var formatOptions = units.GetFormatOptions(SpecTypeId.Area);
                var unitTypeId = formatOptions.GetUnitTypeId();
                if (unitTypeId == UnitTypeId.SquareFeet)
                    return AreaUnit.SquareFeet;
                return AreaUnit.SquareMeters;
            }
            catch
            {
                return AreaUnit.SquareMeters;
            }
        }
    }
}
```

## FILE: BsiApiClient.cs

```csharp
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
    public static class BsiApiClient
    {
        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };

        public static async Task<List<ClassifyResult>> ClassifyAsync(
            string serverUrl, string token, List<RoomExtractor.RoomInfo> rooms)
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
                            Name = room?.Name ?? roomId,
                            Category = item["category"]?.ToString() ?? "unclassified",
                            Confidence = ToDouble(item, "confidence"),
                        });
                    }
                }
            }
            return classifications;
        }

        public static async Task<Dictionary<string, object>> AnalyzeAsync(
            string serverUrl, string token, string projectName,
            List<RoomExtractor.RoomInfo> rooms, List<RoomExtractor.ZoneData> zones)
        {
            var areas = rooms.Select(r => new Dictionary<string, object>
            {
                { "name", r.Name },
                { "category", r.Category ?? "unclassified" },
                { "area", r.AreaSqM },
                { "levelNumber", r.LevelNumber },
            }).ToList<object>();

            var zonesPayload = zones.Select(z => new Dictionary<string, object>
            {
                { "name", z.Name },
                { "primaryUse", z.PrimaryUse ?? "residential" },
                { "levels", z.Levels.Cast<object>().ToList() },
            }).ToList<object>();

            var payload = new Dictionary<string, object>
            {
                { "projectName", projectName },
                { "areas", areas },
                { "zones", zonesPayload },
            };

            return await PostAsync(serverUrl + "/api/bsi/analyze", token, payload);
        }

        public static async Task<AdviseResponse> AdviseAsync(
            string serverUrl, string token, Dictionary<string, object> analysisResult)
        {
            var payload = new Dictionary<string, object> { { "analysis", analysisResult } };
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
```

## FILE: BsiViewModel.cs

```csharp
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace BSI.RevitAddin
{
    public class BsiViewModel : INotifyPropertyChanged
    {
        private string _serverUrl = "http://localhost:5000";
        private string _authToken = "dev-fake-token";
        private string _status = "Ready — click Analyze to scan rooms from the model.";
        private bool _isAnalyzing;
        private bool _hasResults;
        private int _roomCount;
        private int _zoneCount;
        private double _totalGFA;
        private double _totalNLA;
        private double _blendedEfficiency;
        private string _narrative;
        private List<ZoneResult> _zones = new List<ZoneResult>();
        private List<ClassifyResult> _classifications = new List<ClassifyResult>();
        private List<SuggestionResult> _suggestions = new List<SuggestionResult>();

        public string ServerUrl { get => _serverUrl; set { _serverUrl = value; Notify(); } }
        public string AuthToken { get => _authToken; set { _authToken = value; Notify(); } }
        public string Status { get => _status; set { _status = value; Notify(); } }
        public bool IsAnalyzing { get => _isAnalyzing; set { _isAnalyzing = value; Notify(); } }
        public bool HasResults { get => _hasResults; set { _hasResults = value; Notify(); } }
        public int RoomCount { get => _roomCount; set { _roomCount = value; Notify(); } }
        public int ZoneCount { get => _zoneCount; set { _zoneCount = value; Notify(); } }
        public double TotalGFA { get => _totalGFA; set { _totalGFA = value; Notify(); } }
        public double TotalNLA { get => _totalNLA; set { _totalNLA = value; Notify(); } }
        public double BlendedEfficiency { get => _blendedEfficiency; set { _blendedEfficiency = value; Notify(); } }
        public string Narrative { get => _narrative; set { _narrative = value; Notify(); } }
        public List<ZoneResult> Zones { get => _zones; set { _zones = value; Notify(); } }
        public List<ClassifyResult> Classifications { get => _classifications; set { _classifications = value; Notify(); } }
        public List<SuggestionResult> Suggestions { get => _suggestions; set { _suggestions = value; Notify(); } }

        public event PropertyChangedEventHandler PropertyChanged;
        private void Notify([CallerMemberName] string name = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
        }
    }

    public class ZoneResult
    {
        public string Name { get; set; }
        public string PrimaryUse { get; set; }
        public List<int> Levels { get; set; } = new List<int>();
        public double GFA { get; set; }
        public double NLA { get; set; }
        public double Core { get; set; }
        public double Circulation { get; set; }
        public double Efficiency { get; set; }
        public double BenchmarkMin { get; set; }
        public double BenchmarkTarget { get; set; }
        public double BenchmarkMax { get; set; }
        public string Status { get; set; }
    }

    public class ClassifyResult
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Category { get; set; }
        public double Confidence { get; set; }
    }

    public class SuggestionResult
    {
        public string Zone { get; set; }
        public string Severity { get; set; }
        public string Type { get; set; }
        public string Message { get; set; }
        public double? EfficiencyDelta { get; set; }
        public double? RevenueDelta { get; set; }
    }
}
```

## FILE: BsiPanel.cs

```csharp
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Media;
using Autodesk.Revit.UI;

namespace BSI.RevitAddin
{
    public class BsiPanel : UserControl, IDockablePaneProvider
    {
        private readonly BsiViewModel _vm;

        private TextBlock _statusText;
        private StackPanel _welcomePanel;
        private StackPanel _summaryPanel;
        private WrapPanel _summaryStats;
        private StackPanel _zonesPanel;
        private StackPanel _zonesContent;
        private StackPanel _classifyPanel;
        private StackPanel _classifyContent;
        private Button _adviseBtn;
        private StackPanel _suggestionsPanel;
        private StackPanel _suggestionsContent;
        private TextBlock _narrativeBlock;
        private Button _analyzeBtn;

        private Dictionary<string, object> _lastAnalysisResult;

        public BsiPanel()
        {
            _vm = new BsiViewModel();
            _vm.PropertyChanged += OnViewModelChanged;
            BuildUI();
        }

        public BsiViewModel ViewModel => _vm;

        public void SetupDockablePane(DockablePaneProviderData data)
        {
            data.FrameworkElement = this;
            data.InitialState = new DockablePaneState
            {
                DockPosition = DockPosition.Right,
            };
        }

        private void BuildUI()
        {
            Background = Brush(249, 250, 251);
            var root = new DockPanel();

            // HEADER
            var header = new Border
            {
                Background = new LinearGradientBrush(
                    Color.FromRgb(30, 58, 138),
                    Color.FromRgb(59, 130, 246), 0),
                Padding = new Thickness(16, 14, 16, 14),
            };
            var headerStack = new StackPanel();
            headerStack.Children.Add(new TextBlock
            {
                Text = "\U0001F3E2  Building Scheme Intelligence",
                FontSize = 15, FontWeight = FontWeights.SemiBold, Foreground = Brushes.White,
            });
            headerStack.Children.Add(new TextBlock
            {
                Text = "AI-powered building efficiency analysis",
                FontSize = 10,
                Foreground = new SolidColorBrush(Color.FromRgb(191, 219, 254)),
                Margin = new Thickness(0, 2, 0, 0),
            });
            header.Child = headerStack;
            DockPanel.SetDock(header, Dock.Top);
            root.Children.Add(header);

            // STATUS BAR
            var statusBorder = new Border
            {
                Background = Brush(243, 244, 246),
                Padding = new Thickness(12, 6, 12, 6),
                BorderBrush = Brush(229, 231, 235),
                BorderThickness = new Thickness(0, 1, 0, 0),
            };
            _statusText = new TextBlock
            {
                FontSize = 11,
                Foreground = Brush(107, 114, 128),
                TextWrapping = TextWrapping.Wrap,
            };
            _statusText.SetBinding(TextBlock.TextProperty, new Binding("Status") { Source = _vm });
            statusBorder.Child = _statusText;
            DockPanel.SetDock(statusBorder, Dock.Bottom);
            root.Children.Add(statusBorder);

            // SCROLLABLE CONTENT
            var scroll = new ScrollViewer
            {
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            };
            var content = new StackPanel { Margin = new Thickness(12) };

            // Welcome card
            _welcomePanel = new StackPanel { Margin = new Thickness(0, 8, 0, 0) };
            var welcomeCard = new Border
            {
                Background = Brushes.White,
                BorderBrush = Brush(219, 234, 254),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(16),
            };
            var welcomeStack = new StackPanel();
            welcomeStack.Children.Add(new TextBlock
            {
                Text = "Analyze your building",
                FontSize = 14, FontWeight = FontWeights.SemiBold,
                Foreground = Brush(30, 58, 138),
            });
            welcomeStack.Children.Add(new TextBlock
            {
                Text = "BSI reads all rooms from your Revit model, uses AI to classify them " +
                       "(residential, retail, core, circulation...), then compares your building's " +
                       "efficiency against industry benchmarks.",
                FontSize = 11, Foreground = Brush(75, 85, 99),
                TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 6, 0, 0),
            });

            var stepsPanel = new StackPanel { Margin = new Thickness(0, 12, 0, 0) };
            stepsPanel.Children.Add(StepRow("1", "Scans all placed Rooms from the model"));
            stepsPanel.Children.Add(StepRow("2", "AI classifies each room by function"));
            stepsPanel.Children.Add(StepRow("3", "Analyzes efficiency per zone vs benchmarks"));
            stepsPanel.Children.Add(StepRow("4", "AI suggests design improvements"));
            welcomeStack.Children.Add(stepsPanel);
            welcomeCard.Child = welcomeStack;
            _welcomePanel.Children.Add(welcomeCard);
            content.Children.Add(_welcomePanel);

            // Analyze button
            _analyzeBtn = ActionButton("▶  Analyze Model", Color.FromRgb(59, 130, 246));
            _analyzeBtn.Margin = new Thickness(0, 12, 0, 0);
            _analyzeBtn.Click += OnAnalyzeClick;
            content.Children.Add(_analyzeBtn);

            // Summary section (hidden until results)
            _summaryPanel = new StackPanel { Margin = new Thickness(0, 16, 0, 0), Visibility = Visibility.Collapsed };
            _summaryPanel.Children.Add(SectionLabel("Summary"));
            _summaryStats = new WrapPanel { Margin = new Thickness(0, 4, 0, 0) };
            _summaryPanel.Children.Add(_summaryStats);
            content.Children.Add(_summaryPanel);

            // Zones section
            _zonesPanel = new StackPanel { Margin = new Thickness(0, 16, 0, 0), Visibility = Visibility.Collapsed };
            _zonesPanel.Children.Add(SectionLabel("Zones"));
            _zonesContent = new StackPanel { Margin = new Thickness(0, 4, 0, 0) };
            _zonesPanel.Children.Add(_zonesContent);
            content.Children.Add(_zonesPanel);

            // Classifications section
            _classifyPanel = new StackPanel { Margin = new Thickness(0, 16, 0, 0), Visibility = Visibility.Collapsed };
            _classifyPanel.Children.Add(SectionLabel("Room Classifications"));
            _classifyContent = new StackPanel { Margin = new Thickness(0, 4, 0, 0) };
            _classifyPanel.Children.Add(_classifyContent);
            content.Children.Add(_classifyPanel);

            // AI Advice button
            _adviseBtn = ActionButton("🤖  Get AI Advice", Color.FromRgb(124, 58, 237));
            _adviseBtn.Click += OnAdviseClick;
            _adviseBtn.Margin = new Thickness(0, 16, 0, 0);
            _adviseBtn.Visibility = Visibility.Collapsed;
            content.Children.Add(_adviseBtn);

            // Narrative
            _narrativeBlock = new TextBlock
            {
                TextWrapping = TextWrapping.Wrap, FontSize = 12,
                FontStyle = FontStyles.Italic, Foreground = Brush(55, 65, 81),
                Margin = new Thickness(0, 12, 0, 0), Visibility = Visibility.Collapsed,
            };
            content.Children.Add(_narrativeBlock);

            // Suggestions section
            _suggestionsPanel = new StackPanel { Margin = new Thickness(0, 12, 0, 0), Visibility = Visibility.Collapsed };
            _suggestionsPanel.Children.Add(SectionLabel("AI Suggestions"));
            _suggestionsContent = new StackPanel { Margin = new Thickness(0, 4, 0, 0) };
            _suggestionsPanel.Children.Add(_suggestionsContent);
            content.Children.Add(_suggestionsPanel);

            scroll.Content = content;
            root.Children.Add(scroll);
            Content = root;
        }

        private void OnAnalyzeClick(object sender, RoutedEventArgs e)
        {
            BsiApp.AnalyzeEvent.Raise();
        }

        private async void OnAdviseClick(object sender, RoutedEventArgs e)
        {
            if (_lastAnalysisResult == null)
            {
                _vm.Status = "Run Analyze first before requesting AI advice.";
                return;
            }

            _adviseBtn.IsEnabled = false;
            _vm.Status = "Requesting AI design advice...";

            try
            {
                var result = await BsiApiClient.AdviseAsync(
                    _vm.ServerUrl.TrimEnd('/'), _vm.AuthToken, _lastAnalysisResult);

                _vm.Narrative = result.Narrative;
                _vm.Suggestions = result.Suggestions;
                _vm.Status = $"AI advice received — {result.Suggestions.Count} suggestions.";
            }
            catch (Exception ex)
            {
                _vm.Status = $"Advise error: {ex.Message}";
            }
            finally
            {
                _adviseBtn.IsEnabled = true;
            }
        }

        public async void RunApiPipeline(
            List<RoomExtractor.RoomInfo> rooms,
            List<RoomExtractor.ZoneData> zones,
            string projectName)
        {
            var serverUrl = _vm.ServerUrl.TrimEnd('/');
            var token = _vm.AuthToken;

            try
            {
                Dispatcher.Invoke(() => _vm.Status = $"AI classifying {rooms.Count} rooms...");

                var classifications = await BsiApiClient.ClassifyAsync(serverUrl, token, rooms);

                // Apply classifications back to room data (match by ID)
                var classById = new Dictionary<string, ClassifyResult>();
                foreach (var c in classifications)
                {
                    if (c.Id != null && !classById.ContainsKey(c.Id))
                        classById[c.Id] = c;
                }

                foreach (var room in rooms)
                {
                    ClassifyResult cls;
                    if (classById.TryGetValue(room.Id, out cls))
                    {
                        room.Category = cls.Category;
                        room.Confidence = cls.Confidence;
                    }
                }

                Dispatcher.Invoke(() =>
                {
                    _vm.Classifications = classifications;
                    _vm.Status = $"Classified {classifications.Count} rooms. Analyzing zones...";
                });

                RoomExtractor.InferZonePrimaryUse(zones);

                Dispatcher.Invoke(() => _vm.Status = "Analyzing zone efficiency...");

                var analysisResult = await BsiApiClient.AnalyzeAsync(
                    serverUrl, token, projectName, rooms, zones);

                _lastAnalysisResult = analysisResult;

                Dispatcher.Invoke(() => ParseAndDisplayAnalysis(analysisResult, rooms.Count));
            }
            catch (Exception ex)
            {
                Dispatcher.Invoke(() =>
                {
                    _vm.Status = $"Error: {ex.Message}";
                    _vm.IsAnalyzing = false;
                });
            }
        }

        private void ParseAndDisplayAnalysis(Dictionary<string, object> result, int roomCount)
        {
            try
            {
                // API always returns m² — convert to project display unit
                double toDisplay = RoomExtractor.ProjectAreaUnit == RoomExtractor.AreaUnit.SquareFeet
                    ? 10.7639104   // 1 m² = 10.7639 ft²
                    : 1.0;

                var summary = result.ContainsKey("summary")
                    ? result["summary"] as Dictionary<string, object>
                    : null;

                if (summary != null)
                {
                    _vm.TotalGFA = Math.Round(GetDouble(summary, "totalGFA") * toDisplay, 0);
                    _vm.TotalNLA = Math.Round(GetDouble(summary, "totalNLA") * toDisplay, 0);
                    _vm.BlendedEfficiency = GetDouble(summary, "blendedEfficiency");
                    _vm.ZoneCount = GetInt(summary, "zoneCount");
                    _vm.RoomCount = roomCount;
                }

                var zoneList = new List<ZoneResult>();
                var zonesRaw = result.ContainsKey("zones")
                    ? (result["zones"] as ArrayList ?? ToArrayList(result["zones"]))
                    : null;

                if (zonesRaw != null)
                {
                    foreach (Dictionary<string, object> z in zonesRaw)
                    {
                        var bm = z.ContainsKey("benchmark")
                            ? z["benchmark"] as Dictionary<string, object>
                            : null;

                        zoneList.Add(new ZoneResult
                        {
                            Name = z.ContainsKey("name") ? z["name"]?.ToString() : "",
                            PrimaryUse = z.ContainsKey("primaryUse") ? z["primaryUse"]?.ToString() : "",
                            GFA = Math.Round(GetDouble(z, "gfa") * toDisplay, 0),
                            NLA = Math.Round(GetDouble(z, "nla") * toDisplay, 0),
                            Core = Math.Round(GetDouble(z, "core") * toDisplay, 0),
                            Circulation = Math.Round(GetDouble(z, "circulation") * toDisplay, 0),
                            Efficiency = GetDouble(z, "efficiency"),
                            Status = z.ContainsKey("status") ? z["status"]?.ToString() : "on_target",
                            BenchmarkMin = bm != null ? GetDouble(bm, "min") : 0,
                            BenchmarkTarget = bm != null ? GetDouble(bm, "target") : 0,
                            BenchmarkMax = bm != null ? GetDouble(bm, "max") : 0,
                        });
                    }
                }

                _vm.Zones = zoneList;
                _vm.HasResults = true;
                _vm.IsAnalyzing = false;
                _vm.Status = $"Analysis complete — {roomCount} rooms, {zoneList.Count} zones. " +
                             $"Blended efficiency: {(_vm.BlendedEfficiency * 100):F1}%";
            }
            catch (Exception ex)
            {
                _vm.Status = $"Parse error: {ex.Message}";
                _vm.IsAnalyzing = false;
            }
        }

        private void OnViewModelChanged(object sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            if (!Dispatcher.CheckAccess())
            {
                Dispatcher.Invoke(() => OnViewModelChanged(sender, e));
                return;
            }

            switch (e.PropertyName)
            {
                case nameof(BsiViewModel.HasResults):
                    _welcomePanel.Visibility = _vm.HasResults ? Visibility.Collapsed : Visibility.Visible;
                    _summaryPanel.Visibility = _vm.HasResults ? Visibility.Visible : Visibility.Collapsed;
                    _adviseBtn.Visibility = _vm.HasResults ? Visibility.Visible : Visibility.Collapsed;
                    if (_vm.HasResults) RebuildSummary();
                    break;
                case nameof(BsiViewModel.Zones): RebuildZones(); break;
                case nameof(BsiViewModel.Classifications): RebuildClassifications(); break;
                case nameof(BsiViewModel.Suggestions): RebuildSuggestions(); break;
                case nameof(BsiViewModel.Narrative):
                    if (!string.IsNullOrEmpty(_vm.Narrative))
                    {
                        _narrativeBlock.Text = _vm.Narrative;
                        _narrativeBlock.Visibility = Visibility.Visible;
                    }
                    break;
                case nameof(BsiViewModel.IsAnalyzing):
                    _analyzeBtn.IsEnabled = !_vm.IsAnalyzing;
                    _analyzeBtn.Content = _vm.IsAnalyzing ? "Analyzing..." : "▶  Analyze Model";
                    break;
            }
        }

        private void RebuildSummary()
        {
            _summaryStats.Children.Clear();
            _summaryStats.Children.Add(StatBlock("Rooms", _vm.RoomCount.ToString()));
            _summaryStats.Children.Add(StatBlock("Zones", _vm.ZoneCount.ToString()));
            var unit = RoomExtractor.UnitLabel;
            _summaryStats.Children.Add(StatBlock("GFA", $"{_vm.TotalGFA:N0} {unit}"));
            _summaryStats.Children.Add(StatBlock("NLA", $"{_vm.TotalNLA:N0} {unit}"));

            var effColor = _vm.BlendedEfficiency >= 0.86 ? Color.FromRgb(34, 197, 94)
                : _vm.BlendedEfficiency >= 0.82 ? Color.FromRgb(234, 179, 8)
                : Color.FromRgb(239, 68, 68);
            _summaryStats.Children.Add(StatBlock("Efficiency",
                $"{(_vm.BlendedEfficiency * 100):F1}%", effColor));
        }

        private void RebuildZones()
        {
            _zonesContent.Children.Clear();
            if (_vm.Zones.Count == 0) return;
            _zonesPanel.Visibility = Visibility.Visible;

            foreach (var zone in _vm.Zones)
            {
                var card = new Border
                {
                    Background = Brushes.White,
                    BorderBrush = Brush(229, 231, 235),
                    BorderThickness = new Thickness(1),
                    CornerRadius = new CornerRadius(6),
                    Padding = new Thickness(12),
                    Margin = new Thickness(0, 0, 0, 8),
                };

                var stack = new StackPanel();

                // Zone name + primary use
                var titleRow = new DockPanel();
                titleRow.Children.Add(new TextBlock
                {
                    Text = zone.Name, FontSize = 13, FontWeight = FontWeights.SemiBold,
                    Foreground = Brush(17, 24, 39),
                });
                var useBadge = CategoryBadge(zone.PrimaryUse);
                DockPanel.SetDock(useBadge, Dock.Right);
                titleRow.Children.Add(useBadge);
                stack.Children.Add(titleRow);

                // Metrics row
                var metrics = new WrapPanel { Margin = new Thickness(0, 6, 0, 0) };
                metrics.Children.Add(MiniStat("GFA", $"{zone.GFA:N0}"));
                metrics.Children.Add(MiniStat("NLA", $"{zone.NLA:N0}"));
                metrics.Children.Add(MiniStat("Core", $"{zone.Core:N0}"));
                metrics.Children.Add(MiniStat("Circ", $"{zone.Circulation:N0}"));
                stack.Children.Add(metrics);

                // Efficiency bar
                var effPct = zone.Efficiency * 100;
                var effRow = new StackPanel { Margin = new Thickness(0, 8, 0, 0) };
                var effLabel = new DockPanel();
                effLabel.Children.Add(new TextBlock
                {
                    Text = $"Efficiency: {effPct:F1}%", FontSize = 11, Foreground = Brush(55, 65, 81),
                });

                var statusColor = zone.Status == "above_benchmark" ? Color.FromRgb(34, 197, 94)
                    : zone.Status == "on_target" ? Color.FromRgb(234, 179, 8)
                    : Color.FromRgb(239, 68, 68);
                var statusLabel = zone.Status == "above_benchmark" ? "ABOVE"
                    : zone.Status == "on_target" ? "ON TARGET"
                    : "BELOW";

                var badge = new Border
                {
                    Background = new SolidColorBrush(statusColor),
                    CornerRadius = new CornerRadius(3),
                    Padding = new Thickness(6, 1, 6, 1),
                };
                badge.Child = new TextBlock
                {
                    Text = statusLabel, FontSize = 9, FontWeight = FontWeights.Bold, Foreground = Brushes.White,
                };
                DockPanel.SetDock(badge, Dock.Right);
                effLabel.Children.Add(badge);
                effRow.Children.Add(effLabel);

                // Progress bar
                var barBg = new Border
                {
                    Background = Brush(229, 231, 235), CornerRadius = new CornerRadius(3),
                    Height = 8, Margin = new Thickness(0, 4, 0, 0),
                };
                var barFill = new Border
                {
                    Background = new SolidColorBrush(statusColor), CornerRadius = new CornerRadius(3),
                    Height = 8, HorizontalAlignment = HorizontalAlignment.Left, Width = 0,
                };

                var barGrid = new Grid();
                barGrid.Children.Add(barBg);
                barGrid.Children.Add(barFill);
                effRow.Children.Add(barGrid);

                barGrid.Loaded += (s, ev) =>
                {
                    var pct = Math.Min(1.0, Math.Max(0.0, zone.Efficiency));
                    barFill.Width = barGrid.ActualWidth * pct;
                };

                if (zone.BenchmarkTarget > 0)
                {
                    effRow.Children.Add(new TextBlock
                    {
                        Text = $"Benchmark: {zone.BenchmarkMin * 100:F0}% – {zone.BenchmarkMax * 100:F0}% (target {zone.BenchmarkTarget * 100:F0}%)",
                        FontSize = 10, Foreground = Brush(156, 163, 175), Margin = new Thickness(0, 2, 0, 0),
                    });
                }

                stack.Children.Add(effRow);
                card.Child = stack;
                _zonesContent.Children.Add(card);
            }
        }

        private void RebuildClassifications()
        {
            _classifyContent.Children.Clear();
            if (_vm.Classifications.Count == 0) return;
            _classifyPanel.Visibility = Visibility.Visible;

            foreach (var cls in _vm.Classifications)
            {
                var row = new DockPanel { Margin = new Thickness(0, 0, 0, 3) };
                var confDot = new Border
                {
                    Width = 8, Height = 8, CornerRadius = new CornerRadius(4),
                    Background = new SolidColorBrush(
                        cls.Confidence >= 0.9 ? Color.FromRgb(34, 197, 94) :
                        cls.Confidence >= 0.7 ? Color.FromRgb(234, 179, 8) :
                        Color.FromRgb(239, 68, 68)),
                    Margin = new Thickness(0, 0, 6, 0),
                    VerticalAlignment = VerticalAlignment.Center,
                };
                row.Children.Add(confDot);
                row.Children.Add(new TextBlock
                {
                    Text = cls.Name, FontSize = 11, Foreground = Brush(55, 65, 81),
                    VerticalAlignment = VerticalAlignment.Center,
                });
                var catBadge = CategoryBadge(cls.Category);
                DockPanel.SetDock(catBadge, Dock.Right);
                row.Children.Add(catBadge);
                _classifyContent.Children.Add(row);
            }
        }

        private void RebuildSuggestions()
        {
            _suggestionsContent.Children.Clear();
            if (_vm.Suggestions.Count == 0) return;
            _suggestionsPanel.Visibility = Visibility.Visible;

            foreach (var sug in _vm.Suggestions)
            {
                var sevColor = GetSeverityColor(sug.Severity);
                var card = new Border
                {
                    Background = Brushes.White,
                    BorderBrush = new SolidColorBrush(sevColor),
                    BorderThickness = new Thickness(3, 0, 0, 0),
                    CornerRadius = new CornerRadius(0, 6, 6, 0),
                    Padding = new Thickness(12, 8, 12, 8),
                    Margin = new Thickness(0, 0, 0, 6),
                };
                var stack = new StackPanel();

                var headerRow = new DockPanel();
                var sevBadge = new Border
                {
                    Background = new SolidColorBrush(sevColor),
                    CornerRadius = new CornerRadius(3),
                    Padding = new Thickness(6, 1, 6, 1),
                    Margin = new Thickness(0, 0, 8, 0),
                };
                sevBadge.Child = new TextBlock
                {
                    Text = sug.Severity?.ToUpper() ?? "INFO",
                    FontSize = 9, FontWeight = FontWeights.Bold, Foreground = Brushes.White,
                };
                headerRow.Children.Add(sevBadge);
                headerRow.Children.Add(new TextBlock
                {
                    Text = sug.Zone ?? "", FontSize = 11,
                    Foreground = Brush(107, 114, 128),
                    VerticalAlignment = VerticalAlignment.Center,
                });
                stack.Children.Add(headerRow);

                stack.Children.Add(new TextBlock
                {
                    Text = sug.Message, FontSize = 12,
                    Foreground = Brush(31, 41, 55),
                    TextWrapping = TextWrapping.Wrap,
                    Margin = new Thickness(0, 4, 0, 0),
                });

                if (sug.RevenueDelta.HasValue && sug.RevenueDelta.Value != 0)
                {
                    var sign = sug.RevenueDelta.Value > 0 ? "+" : "";
                    stack.Children.Add(new TextBlock
                    {
                        Text = $"💰 Revenue impact: {sign}€{sug.RevenueDelta.Value:N0}",
                        FontSize = 11, Foreground = Brush(16, 185, 129),
                        Margin = new Thickness(0, 4, 0, 0),
                    });
                }

                card.Child = stack;
                _suggestionsContent.Children.Add(card);
            }
        }

        // UI Helpers
        private static TextBlock SectionLabel(string text) => new TextBlock
        {
            Text = text, FontSize = 13, FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(17, 24, 39)),
            Margin = new Thickness(0, 0, 0, 4),
        };

        private static FrameworkElement StepRow(string number, string text)
        {
            var row = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 3, 0, 3) };
            var numBadge = new Border
            {
                Background = new SolidColorBrush(Color.FromRgb(59, 130, 246)),
                CornerRadius = new CornerRadius(10), Width = 20, Height = 20,
                Margin = new Thickness(0, 0, 8, 0),
            };
            numBadge.Child = new TextBlock
            {
                Text = number, FontSize = 10, FontWeight = FontWeights.Bold, Foreground = Brushes.White,
                HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center,
            };
            row.Children.Add(numBadge);
            row.Children.Add(new TextBlock
            {
                Text = text, FontSize = 11,
                Foreground = new SolidColorBrush(Color.FromRgb(55, 65, 81)),
                VerticalAlignment = VerticalAlignment.Center,
            });
            return row;
        }

        private static Button ActionButton(string text, Color color) => new Button
        {
            Content = text, FontSize = 13, FontWeight = FontWeights.SemiBold,
            Foreground = Brushes.White, Background = new SolidColorBrush(color),
            Padding = new Thickness(16, 10, 16, 10),
            Cursor = System.Windows.Input.Cursors.Hand,
            BorderThickness = new Thickness(0),
            HorizontalAlignment = HorizontalAlignment.Stretch,
        };

        private static Border StatBlock(string label, string value, Color? color = null)
        {
            var border = new Border
            {
                Background = Brushes.White,
                BorderBrush = new SolidColorBrush(Color.FromRgb(229, 231, 235)),
                BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(6),
                Padding = new Thickness(10, 6, 10, 6), Margin = new Thickness(0, 0, 6, 6), MinWidth = 70,
            };
            var stack = new StackPanel { HorizontalAlignment = HorizontalAlignment.Center };
            stack.Children.Add(new TextBlock
            {
                Text = value, FontSize = 16, FontWeight = FontWeights.Bold,
                Foreground = color.HasValue ? new SolidColorBrush(color.Value)
                    : new SolidColorBrush(Color.FromRgb(17, 24, 39)),
                HorizontalAlignment = HorizontalAlignment.Center,
            });
            stack.Children.Add(new TextBlock
            {
                Text = label, FontSize = 10,
                Foreground = new SolidColorBrush(Color.FromRgb(156, 163, 175)),
                HorizontalAlignment = HorizontalAlignment.Center,
            });
            border.Child = stack;
            return border;
        }

        private static FrameworkElement MiniStat(string label, string value)
        {
            var stack = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 12, 0) };
            stack.Children.Add(new TextBlock
            {
                Text = label + ": ", FontSize = 10,
                Foreground = new SolidColorBrush(Color.FromRgb(156, 163, 175)),
            });
            stack.Children.Add(new TextBlock
            {
                Text = value, FontSize = 10, FontWeight = FontWeights.SemiBold,
                Foreground = new SolidColorBrush(Color.FromRgb(55, 65, 81)),
            });
            return stack;
        }

        private static Border CategoryBadge(string category)
        {
            var color = GetCategoryColor(category);
            var badge = new Border
            {
                Background = new SolidColorBrush(Color.FromArgb(30, color.R, color.G, color.B)),
                CornerRadius = new CornerRadius(3),
                Padding = new Thickness(6, 1, 6, 1),
                VerticalAlignment = VerticalAlignment.Center,
            };
            badge.Child = new TextBlock
            {
                Text = category ?? "?", FontSize = 10, FontWeight = FontWeights.SemiBold,
                Foreground = new SolidColorBrush(color),
            };
            return badge;
        }

        private static Color GetCategoryColor(string category)
        {
            switch (category?.ToLower())
            {
                case "residential": return Color.FromRgb(59, 130, 246);
                case "retail": return Color.FromRgb(236, 72, 153);
                case "office": return Color.FromRgb(168, 85, 247);
                case "hospitality": return Color.FromRgb(245, 158, 11);
                case "core": return Color.FromRgb(107, 114, 128);
                case "circulation": return Color.FromRgb(234, 179, 8);
                case "parking": return Color.FromRgb(20, 184, 166);
                case "amenity": return Color.FromRgb(16, 185, 129);
                case "boh": return Color.FromRgb(156, 163, 175);
                default: return Color.FromRgb(209, 213, 219);
            }
        }

        private static Color GetSeverityColor(string severity)
        {
            switch (severity?.ToLower())
            {
                case "critical": return Color.FromRgb(220, 38, 38);
                case "high": return Color.FromRgb(249, 115, 22);
                case "medium": return Color.FromRgb(234, 179, 8);
                case "low": return Color.FromRgb(59, 130, 246);
                case "info": default: return Color.FromRgb(107, 114, 128);
            }
        }

        private static SolidColorBrush Brush(byte r, byte g, byte b) =>
            new SolidColorBrush(Color.FromRgb(r, g, b));

        private static double GetDouble(Dictionary<string, object> d, string key)
        {
            if (!d.ContainsKey(key) || d[key] == null) return 0;
            var v = d[key];
            if (v is double dd) return dd;
            if (v is int ii) return ii;
            if (v is decimal mm) return (double)mm;
            if (v is long ll) return ll;
            double.TryParse(v.ToString(), out double p);
            return p;
        }

        private static int GetInt(Dictionary<string, object> d, string key) => (int)GetDouble(d, key);

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
}
```

## FILE: backend/src/bsi/benchmarks.js

```javascript
const BENCHMARKS = {
    residential_lowrise: {
        use: 'residential', label: 'Residential Low-Rise (1-4 stories)',
        efficiency: { min: 0.83, target: 0.86, max: 0.88 },
        core:        { min: 0.08, target: 0.09, max: 0.10 },
        circulation:  { min: 0.04, target: 0.05, max: 0.07 },
    },
    residential_midrise: {
        use: 'residential', label: 'Residential Mid-Rise (5-12 stories)',
        efficiency: { min: 0.80, target: 0.82, max: 0.85 },
        core:        { min: 0.10, target: 0.12, max: 0.13 },
        circulation:  { min: 0.05, target: 0.06, max: 0.08 },
    },
    residential_highrise: {
        use: 'residential', label: 'Residential High-Rise (13+ stories)',
        efficiency: { min: 0.76, target: 0.79, max: 0.82 },
        core:        { min: 0.12, target: 0.14, max: 0.16 },
        circulation:  { min: 0.06, target: 0.08, max: 0.10 },
    },
    office_class_a: {
        use: 'office', label: 'Office Class A',
        efficiency: { min: 0.82, target: 0.85, max: 0.87 },
        core:        { min: 0.08, target: 0.09, max: 0.11 },
        circulation:  { min: 0.03, target: 0.04, max: 0.06 },
    },
    office_class_b: {
        use: 'office', label: 'Office Class B',
        efficiency: { min: 0.84, target: 0.87, max: 0.89 },
        core:        { min: 0.07, target: 0.08, max: 0.09 },
        circulation:  { min: 0.03, target: 0.04, max: 0.05 },
    },
    retail_mall: {
        use: 'retail', label: 'Retail Mall / Shopping Centre',
        efficiency: { min: 0.85, target: 0.88, max: 0.92 },
        core:        { min: 0.05, target: 0.06, max: 0.08 },
        circulation:  { min: 0.03, target: 0.04, max: 0.05 },
    },
    retail_high_street: {
        use: 'retail', label: 'Retail High Street / Ground Floor',
        efficiency: { min: 0.88, target: 0.90, max: 0.93 },
        core:        { min: 0.04, target: 0.05, max: 0.06 },
        circulation:  { min: 0.02, target: 0.03, max: 0.04 },
    },
    hotel_3star: {
        use: 'hospitality', label: 'Hotel 3-Star',
        efficiency: { min: 0.60, target: 0.64, max: 0.68 },
        core:        { min: 0.12, target: 0.13, max: 0.15 },
        circulation:  { min: 0.15, target: 0.18, max: 0.20 },
    },
    hotel_5star: {
        use: 'hospitality', label: 'Hotel 5-Star / Luxury',
        efficiency: { min: 0.55, target: 0.59, max: 0.63 },
        core:        { min: 0.14, target: 0.16, max: 0.18 },
        circulation:  { min: 0.18, target: 0.22, max: 0.25 },
    },
    parking_above_ground: {
        use: 'parking', label: 'Parking Above Ground',
        efficiency: { min: 0.90, target: 0.92, max: 0.95 },
        core:        { min: 0.03, target: 0.04, max: 0.05 },
        circulation:  { min: 0.02, target: 0.03, max: 0.04 },
    },
    parking_basement: {
        use: 'parking', label: 'Parking Basement',
        efficiency: { min: 0.88, target: 0.90, max: 0.93 },
        core:        { min: 0.04, target: 0.05, max: 0.06 },
        circulation:  { min: 0.03, target: 0.04, max: 0.05 },
    },
    mixed_use_podium_tower: {
        use: 'mixed', label: 'Mixed-Use Podium + Tower',
        efficiency: { min: 0.78, target: 0.81, max: 0.84 },
        core:        { min: 0.10, target: 0.12, max: 0.15 },
        circulation:  { min: 0.05, target: 0.07, max: 0.09 },
    },
};

const REVENUE_CATEGORIES = new Set(['residential', 'retail', 'office', 'hospitality']);

const ALL_CATEGORIES = new Set([
    'residential', 'retail', 'office', 'hospitality',
    'core', 'circulation', 'parking', 'amenity', 'boh', 'unclassified',
]);

function getBenchmarkForZone(primaryUse, levelCount) {
    // Select benchmark based on use + height
    // ... (selects appropriate benchmark based on building type and height)
}

module.exports = { BENCHMARKS, REVENUE_CATEGORIES, ALL_CATEGORIES, getBenchmarkForZone };
```

## FILE: backend/src/bsi/bsiRoutes.js

```javascript
const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { BENCHMARKS, REVENUE_CATEGORIES, ALL_CATEGORIES, getBenchmarkForZone } = require('./benchmarks');

let _anthropic;
function getClaude() {
    if (!_anthropic) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
        _anthropic = new Anthropic({ apiKey });
    }
    return _anthropic;
}

/* POST /api/bsi/analyze — Pure calculation, no AI */
router.post('/analyze', async (req, res) => {
    try {
        const { projectName, areas, zones, financial } = req.body || {};

        if (!areas || !Array.isArray(areas) || areas.length === 0)
            return res.status(400).json({ error: 'areas array is required' });
        if (!zones || !Array.isArray(zones) || zones.length === 0)
            return res.status(400).json({ error: 'zones array is required' });

        // Validate categories
        for (const a of areas) {
            if (a.category && !ALL_CATEGORIES.has(a.category))
                return res.status(400).json({ error: `Invalid category "${a.category}"` });
        }

        // Build per-zone tallies
        const zoneResults = zones.map(zone => {
            const levelSet = new Set(zone.levels.map(Number));
            const zoneAreas = areas.filter(a => levelSet.has(Number(a.levelNumber)));

            const breakdown = {};
            let totalGFA = 0;
            let totalNLA = 0;

            for (const a of zoneAreas) {
                const cat = a.category || 'unclassified';
                breakdown[cat] = (breakdown[cat] || 0) + a.area;
                totalGFA += a.area;
                if (REVENUE_CATEGORIES.has(cat)) totalNLA += a.area;
            }

            const efficiency = totalGFA > 0 ? totalNLA / totalGFA : 0;
            const benchmark = getBenchmarkForZone(zone.primaryUse, zone.levels.length);

            let status = 'on_target';
            if (efficiency < benchmark.efficiency.min) status = 'below_benchmark';
            else if (efficiency > benchmark.efficiency.max) status = 'above_benchmark';

            const coreRatio = totalGFA > 0 ? (breakdown.core || 0) / totalGFA : 0;
            const circRatio = totalGFA > 0 ? (breakdown.circulation || 0) / totalGFA : 0;

            return {
                name: zone.name,
                primaryUse: zone.primaryUse,
                levels: zone.levels,
                gfa: round2(totalGFA),
                nla: round2(totalNLA),
                core: round2(breakdown.core || 0),
                circulation: round2(breakdown.circulation || 0),
                efficiency: round4(efficiency),
                coreRatio: round4(coreRatio),
                circulationRatio: round4(circRatio),
                benchmark: benchmark.efficiency,
                status,
                breakdown,
            };
        });

        // Whole-building summary
        const totalGFA = zoneResults.reduce((s, z) => s + z.gfa, 0);
        const totalNLA = zoneResults.reduce((s, z) => s + z.nla, 0);
        const blendedEfficiency = totalGFA > 0 ? totalNLA / totalGFA : 0;

        return res.json({
            projectName: projectName || 'Untitled',
            summary: {
                totalGFA: round2(totalGFA),
                totalNLA: round2(totalNLA),
                blendedEfficiency: round4(blendedEfficiency),
                zoneCount: zoneResults.length,
                areaCount: areas.length,
            },
            zones: zoneResults,
        });
    } catch (err) {
        return res.status(500).json({ error: 'Analysis failed' });
    }
});

/* POST /api/bsi/classify — AI-powered room classification */
router.post('/classify', async (req, res) => {
    // Sends room names/areas/levels to Claude Sonnet
    // Returns: { classifications: [{ id, category, confidence }] }
    // Categories: residential, retail, office, hospitality, core, circulation, parking, amenity, boh, unclassified
});

/* POST /api/bsi/advise — AI design advisor */
router.post('/advise', async (req, res) => {
    // Sends analysis results to Claude Opus
    // Returns: { suggestions: [{ zone, severity, type, message, metric_impact }], narrative: "..." }
});

function round2(n) { return Math.round(n * 100) / 100; }
function round4(n) { return Math.round(n * 10000) / 10000; }

module.exports = router;
```

---

## Known Issues / Questions

1. **GFA discrepancy**: BSI reads Revit Rooms (measured wall-to-wall inside face). Revit's "Gross Building Area" from Area Plans includes wall thicknesses. So BSI GFA (56,377 ft²) < Revit Area Schedule total (76,616 SF). This is expected but may be confusing.
2. **NLA definition**: Only revenue-generating categories (residential, retail, office, hospitality) count toward NLA. Core, circulation, parking, amenity, boh are excluded.
3. **Efficiency formula**: Efficiency = NLA / GFA (where GFA = sum of ALL room areas, NLA = sum of revenue rooms only)
4. **Parking zone shows 0% efficiency**: Parking is not a revenue category, so NLA=0 for parking zones. This is by design but looks alarming with the red "BELOW" badge.
5. **Unit conversion**: All API communication in m². Display converts to ft² if project uses imperial. Conversion factor: 10.7639104.
