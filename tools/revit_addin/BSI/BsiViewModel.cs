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
        private string _status = "Ready \u2014 click Analyze to scan rooms from the model.";
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

        // ── Settings ────────────────────────────────────────────────
        private string _selectedPreset = "dubai_residential_tower";
        private string _buildingHeight = "mid";
        private bool _useCustomBenchmarks;
        private double _customEffMin;
        private double _customEffTarget;
        private double _customEffMax;

        public string ServerUrl
        {
            get => _serverUrl;
            set { _serverUrl = value; Notify(); }
        }

        public string AuthToken
        {
            get => _authToken;
            set { _authToken = value; Notify(); }
        }

        public string Status
        {
            get => _status;
            set { _status = value; Notify(); }
        }

        public bool IsAnalyzing
        {
            get => _isAnalyzing;
            set { _isAnalyzing = value; Notify(); }
        }

        public bool HasResults
        {
            get => _hasResults;
            set { _hasResults = value; Notify(); }
        }

        public int RoomCount
        {
            get => _roomCount;
            set { _roomCount = value; Notify(); }
        }

        public int ZoneCount
        {
            get => _zoneCount;
            set { _zoneCount = value; Notify(); }
        }

        public double TotalGFA
        {
            get => _totalGFA;
            set { _totalGFA = value; Notify(); }
        }

        public double TotalNLA
        {
            get => _totalNLA;
            set { _totalNLA = value; Notify(); }
        }

        public double BlendedEfficiency
        {
            get => _blendedEfficiency;
            set { _blendedEfficiency = value; Notify(); }
        }

        public string Narrative
        {
            get => _narrative;
            set { _narrative = value; Notify(); }
        }

        public List<ZoneResult> Zones
        {
            get => _zones;
            set { _zones = value; Notify(); }
        }

        public List<ClassifyResult> Classifications
        {
            get => _classifications;
            set { _classifications = value; Notify(); }
        }

        public List<SuggestionResult> Suggestions
        {
            get => _suggestions;
            set { _suggestions = value; Notify(); }
        }

        // ── Settings properties ─────────────────────────────────────

        public string SelectedPreset
        {
            get => _selectedPreset;
            set { _selectedPreset = value; Notify(); }
        }

        public string BuildingHeight
        {
            get => _buildingHeight;
            set { _buildingHeight = value; Notify(); }
        }

        public bool UseCustomBenchmarks
        {
            get => _useCustomBenchmarks;
            set { _useCustomBenchmarks = value; Notify(); }
        }

        public double CustomEffMin
        {
            get => _customEffMin;
            set { _customEffMin = value; Notify(); }
        }

        public double CustomEffTarget
        {
            get => _customEffTarget;
            set { _customEffTarget = value; Notify(); }
        }

        public double CustomEffMax
        {
            get => _customEffMax;
            set { _customEffMax = value; Notify(); }
        }

        /// <summary>Available preset definitions (id + label). Populated from API.</summary>
        public List<PresetInfo> AvailablePresets { get; set; } = new List<PresetInfo>();

        /// <summary>User overrides for room categories. Key = "Name|LevelName", Value = category string.</summary>
        public Dictionary<string, string> RoomCategoryOverrides { get; set; } = new Dictionary<string, string>();

        public event PropertyChangedEventHandler PropertyChanged;

        private void Notify([CallerMemberName] string name = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
        }

        /// <summary>
        /// Returns the correct net area abbreviation for a given typology.
        /// </summary>
        public static string GetNetAreaLabel(string typology)
        {
            switch (typology?.ToLower())
            {
                case "residential": return "NIA";
                case "office": return "NLA";
                case "retail": return "GLA";
                case "hospitality": return "NRA";
                default: return "Net Area";
            }
        }
    }

    // --- Data models ---

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
        public string Status { get; set; } // above_benchmark, on_target, below_benchmark, not_applicable
        public int? StallCount { get; set; }
        public List<ZoneRoomInfo> Rooms { get; set; } = new List<ZoneRoomInfo>();
    }

    public class ClassifyResult
    {
        public string Id { get; set; }
        /// <summary>Revit ElementId.Value for highlighting in the model.</summary>
        public long RevitElementId { get; set; }
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

    public class PresetInfo
    {
        public string Id { get; set; }
        public string Label { get; set; }
        public string Description { get; set; }
        public string Region { get; set; }
        public string DenominatorType { get; set; }
    }

    public class ZoneRoomInfo
    {
        public string Id { get; set; }
        public long RevitElementId { get; set; }
        public string Name { get; set; }
        public double Area { get; set; }
        public string Category { get; set; }
        public double Confidence { get; set; }
        public bool IsOverridden { get; set; }
        public string LevelName { get; set; }
        public int LevelNumber { get; set; }
    }
}
