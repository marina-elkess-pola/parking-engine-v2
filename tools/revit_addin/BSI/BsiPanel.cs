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
    /// <summary>
    /// WPF dockable pane for Building Scheme Intelligence.
    /// Reads rooms from the Revit model, classifies them via AI,
    /// analyzes zone efficiency, and shows AI design suggestions.
    /// </summary>
    public class BsiPanel : UserControl, IDockablePaneProvider
    {
        private readonly BsiViewModel _vm;

        // Mutable UI containers
        private TextBlock _statusText;
        private StackPanel _welcomePanel;
        private StackPanel _summaryCard;
        private WrapPanel _summaryStats;
        private Border _healthDot;
        private TextBlock _healthLabel;
        private Border _gfaBanner;
        private TextBlock _gfaSourceText;
        private StackPanel _zonesPanel;
        private StackPanel _zonesContent;
        private Button _adviseBtn;
        private StackPanel _suggestionsPanel;
        private StackPanel _suggestionsContent;
        private TextBlock _narrativeBlock;
        private TextBlock _staleAdviceNote;
        private Button _analyzeBtn;

        // Store analysis result for advise call
        private Dictionary<string, object> _lastAnalysisResult;

        // Area plan data for GFA source tracking
        private RoomExtractor.AreaPlanResult _areaPlanResult;

        // Track expanded zone panels for collapse/expand
        private readonly Dictionary<string, StackPanel> _expandedZones = new Dictionary<string, StackPanel>();

        // Store merged zones from last analysis (for room-per-zone display)
        private List<RoomExtractor.ZoneData> _lastMergedZones;

        // Settings UI
        private System.Windows.Controls.ComboBox _presetCombo;
        private System.Windows.Controls.ComboBox _heightCombo;
        private StackPanel _customBenchmarkPanel;
        private System.Windows.Controls.TextBox _customEffMinBox;
        private System.Windows.Controls.TextBox _customEffTargetBox;
        private System.Windows.Controls.TextBox _customEffMaxBox;
        private System.Windows.Controls.CheckBox _customCheckbox;
        private TextBlock _denominatorNote;

        // Recalculate bar
        private Border _recalcBar;

        // Cached data from last full pipeline run (for recalc without re-extraction)
        private List<RoomExtractor.RoomInfo> _lastRooms;
        private List<RoomExtractor.ZoneData> _lastRawZones;
        private string _lastProjectName;

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

        // ── UI Construction ─────────────────────────────────────────

        private void BuildUI()
        {
            Background = Brush(249, 250, 251);
            var root = new DockPanel();

            // === HEADER ===
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
                FontSize = 15,
                FontWeight = FontWeights.SemiBold,
                Foreground = Brushes.White,
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

            // === STATUS BAR ===
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

            // === SCROLLABLE CONTENT ===
            var scroll = new ScrollViewer
            {
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            };
            var content = new StackPanel { Margin = new Thickness(12) };

            // -- Welcome / empty state --
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
                FontSize = 14,
                FontWeight = FontWeights.SemiBold,
                Foreground = Brush(30, 58, 138),
            });
            welcomeStack.Children.Add(new TextBlock
            {
                Text = "BSI reads all rooms from your Revit model, uses AI to classify them " +
                       "(residential, retail, core, circulation...), then compares your building's " +
                       "efficiency against industry benchmarks.",
                FontSize = 11,
                Foreground = Brush(75, 85, 99),
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(0, 6, 0, 0),
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

            // -- Settings panel (always visible) --
            content.Children.Add(BuildSettingsPanel());

            // -- Analyze button --
            _analyzeBtn = ActionButton("\u25B6  Analyze Model", Color.FromRgb(59, 130, 246));
            _analyzeBtn.Margin = new Thickness(0, 12, 0, 0);
            _analyzeBtn.Click += OnAnalyzeClick;
            content.Children.Add(_analyzeBtn);

            // -- LEVEL 1: Headline summary card (hidden until results) --
            _summaryCard = new StackPanel
            {
                Margin = new Thickness(0, 16, 0, 0),
                Visibility = Visibility.Collapsed,
            };
            var summaryBorder = new Border
            {
                Background = Brushes.White,
                BorderBrush = Brush(229, 231, 235),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(14),
            };
            var summaryInner = new StackPanel();
            _summaryStats = new WrapPanel { Margin = new Thickness(0, 0, 0, 0) };
            summaryInner.Children.Add(_summaryStats);

            // Health indicator row (rebuilt dynamically)
            _healthDot = new Border
            {
                Width = 10,
                Height = 10,
                CornerRadius = new CornerRadius(5),
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(0, 0, 6, 0),
            };
            _healthLabel = new TextBlock
            {
                FontSize = 11,
                Foreground = Brush(107, 114, 128),
                VerticalAlignment = VerticalAlignment.Center,
            };
            var healthRow = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                Margin = new Thickness(0, 8, 0, 0),
            };
            healthRow.Children.Add(_healthDot);
            healthRow.Children.Add(_healthLabel);
            summaryInner.Children.Add(healthRow);

            // GFA source banner
            _gfaBanner = new Border
            {
                CornerRadius = new CornerRadius(4),
                Padding = new Thickness(8, 4, 8, 4),
                Margin = new Thickness(0, 8, 0, 0),
                Visibility = Visibility.Collapsed,
            };
            _gfaSourceText = new TextBlock
            {
                FontSize = 10,
                TextWrapping = TextWrapping.Wrap,
            };
            _gfaBanner.Child = _gfaSourceText;
            summaryInner.Children.Add(_gfaBanner);

            summaryBorder.Child = summaryInner;
            _summaryCard.Children.Add(summaryBorder);
            content.Children.Add(_summaryCard);

            // -- Recalculate bar (shown when overrides changed) --
            _recalcBar = new Border
            {
                Background = new SolidColorBrush(Color.FromRgb(220, 252, 231)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(34, 197, 94)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(6),
                Padding = new Thickness(12, 8, 12, 8),
                Margin = new Thickness(0, 8, 0, 0),
                Cursor = System.Windows.Input.Cursors.Hand,
                Visibility = Visibility.Collapsed,
            };
            var recalcText = new TextBlock
            {
                Text = "\u26A1 Classifications changed \u2014 click to recalculate",
                FontSize = 12,
                FontWeight = FontWeights.SemiBold,
                Foreground = new SolidColorBrush(Color.FromRgb(22, 101, 52)),
                TextAlignment = TextAlignment.Center,
            };
            _recalcBar.Child = recalcText;
            _recalcBar.MouseLeftButtonDown += (s, ev) =>
            {
                ev.Handled = true;
                RecalculateWithOverrides();
            };
            content.Children.Add(_recalcBar);

            // -- LEVEL 2: Zone rows (clickable, expand to LEVEL 3) --
            _zonesPanel = new StackPanel
            {
                Margin = new Thickness(0, 12, 0, 0),
                Visibility = Visibility.Collapsed,
            };
            _zonesContent = new StackPanel();
            _zonesPanel.Children.Add(_zonesContent);
            content.Children.Add(_zonesPanel);

            // -- AI Advice button (hidden until analysis done) --
            _adviseBtn = ActionButton("\U0001F916  Get AI Advice", Color.FromRgb(124, 58, 237));
            _adviseBtn.Click += (s, ev) => OnAdviseClick(s, ev);
            _adviseBtn.Margin = new Thickness(0, 16, 0, 0);
            _adviseBtn.Visibility = Visibility.Collapsed;
            content.Children.Add(_adviseBtn);

            // -- Stale advice warning --
            _staleAdviceNote = new TextBlock
            {
                Text = "\u26A0 Analysis has changed since this advice was generated. Click Get AI Advice to refresh.",
                TextWrapping = TextWrapping.Wrap,
                FontSize = 11,
                FontStyle = FontStyles.Italic,
                Foreground = new SolidColorBrush(Color.FromRgb(202, 138, 4)),
                Margin = new Thickness(0, 8, 0, 0),
                Visibility = Visibility.Collapsed,
            };
            content.Children.Add(_staleAdviceNote);

            // -- Narrative --
            _narrativeBlock = new TextBlock
            {
                TextWrapping = TextWrapping.Wrap,
                FontSize = 12,
                FontStyle = FontStyles.Italic,
                Foreground = Brush(55, 65, 81),
                Margin = new Thickness(0, 12, 0, 0),
                Visibility = Visibility.Collapsed,
            };
            content.Children.Add(_narrativeBlock);

            // -- Suggestions section --
            _suggestionsPanel = new StackPanel
            {
                Margin = new Thickness(0, 12, 0, 0),
                Visibility = Visibility.Collapsed,
            };
            _suggestionsPanel.Children.Add(SectionLabel("AI Suggestions"));
            _suggestionsContent = new StackPanel { Margin = new Thickness(0, 4, 0, 0) };
            _suggestionsPanel.Children.Add(_suggestionsContent);
            content.Children.Add(_suggestionsPanel);

            scroll.Content = content;
            root.Children.Add(scroll);
            Content = root;

            // Fetch presets from server on load (fire and forget)
            LoadPresetsAsync();
        }

        // ── Settings Panel ──────────────────────────────────────────

        private FrameworkElement BuildSettingsPanel()
        {
            var settingsCard = new Border
            {
                Background = Brushes.White,
                BorderBrush = Brush(229, 231, 235),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(14),
                Margin = new Thickness(0, 12, 0, 0),
            };

            var stack = new StackPanel();

            // Header row with gear icon
            stack.Children.Add(new TextBlock
            {
                Text = "\u2699  Settings",
                FontSize = 13,
                FontWeight = FontWeights.SemiBold,
                Foreground = Brush(17, 24, 39),
                Margin = new Thickness(0, 0, 0, 8),
            });

            // ── Preset dropdown ──
            stack.Children.Add(FieldLabel("Benchmark Preset"));
            _presetCombo = new System.Windows.Controls.ComboBox
            {
                FontSize = 11,
                Margin = new Thickness(0, 2, 0, 8),
                IsEditable = false,
            };
            // Seed with default presets (will be replaced once API responds)
            var defaultPresets = new[]
            {
                new PresetInfo { Id = "dubai_residential_tower", Label = "GFA-based (UAE / Dubai Municipality)", DenominatorType = "GEA" },
                new PresetInfo { Id = "uk_mixed_use", Label = "GIA-based (UK / RICS)", DenominatorType = "GIA" },
                new PresetInfo { Id = "gcc_commercial_tower", Label = "GFA-based (GCC / Commercial)", DenominatorType = "GEA" },
                new PresetInfo { Id = "hotel_resort", Label = "GFA-based (Hotel / Hospitality)", DenominatorType = "GEA" },
                new PresetInfo { Id = "european_apartment", Label = "GIA-based (Europe / IPMS)", DenominatorType = "GIA" },
                new PresetInfo { Id = "custom", Label = "Custom", DenominatorType = "GEA" },
            };
            foreach (var p in defaultPresets) _presetCombo.Items.Add(p.Label);
            _presetCombo.SelectedIndex = 0;
            _vm.AvailablePresets = new List<PresetInfo>(defaultPresets);

            _presetCombo.SelectionChanged += (s, ev) =>
            {
                var idx = _presetCombo.SelectedIndex;
                if (idx >= 0 && idx < _vm.AvailablePresets.Count)
                {
                    _vm.SelectedPreset = _vm.AvailablePresets[idx].Id;
                    var dt = _vm.AvailablePresets[idx].DenominatorType ?? "GEA";
                    _denominatorNote.Text = $"Measurement standard: {dt}";
                    _denominatorNote.ToolTip = dt == "GIA"
                        ? "Gross Internal Area \u2014 measured to the internal face of external walls. v1.5 uses Gross Building area plan as proxy."
                        : "Gross External Area \u2014 uses the Gross Building area plan as-is.";
                }
            };
            stack.Children.Add(_presetCombo);

            // Measurement standard note (driven by selected preset)
            var initialDt = defaultPresets[0].DenominatorType ?? "GEA";
            _denominatorNote = new TextBlock
            {
                Text = $"Measurement standard: {initialDt}",
                FontSize = 10,
                FontStyle = FontStyles.Italic,
                Foreground = Brush(107, 114, 128),
                Margin = new Thickness(0, -4, 0, 8),
                ToolTip = "Gross External Area \u2014 uses the Gross Building area plan as-is.",
            };
            stack.Children.Add(_denominatorNote);

            // ── Building height ──
            stack.Children.Add(FieldLabel("Building Height"));
            _heightCombo = new System.Windows.Controls.ComboBox
            {
                FontSize = 11,
                Margin = new Thickness(0, 2, 0, 8),
                IsEditable = false,
            };
            _heightCombo.Items.Add("Low-rise (\u2264 5 floors)");
            _heightCombo.Items.Add("Mid-rise (6\u201320 floors)");
            _heightCombo.Items.Add("High-rise (21+ floors)");
            _heightCombo.SelectedIndex = 1; // default: mid
            _heightCombo.SelectionChanged += (s, ev) =>
            {
                switch (_heightCombo.SelectedIndex)
                {
                    case 0: _vm.BuildingHeight = "low"; break;
                    case 1: _vm.BuildingHeight = "mid"; break;
                    case 2: _vm.BuildingHeight = "high"; break;
                }
            };
            stack.Children.Add(_heightCombo);

            // ── Custom benchmarks toggle ──
            _customCheckbox = new System.Windows.Controls.CheckBox
            {
                Content = "Override with custom efficiency targets",
                FontSize = 11,
                Foreground = Brush(55, 65, 81),
                Margin = new Thickness(0, 4, 0, 4),
                IsChecked = false,
            };
            _customCheckbox.Checked += (s, ev) =>
            {
                _vm.UseCustomBenchmarks = true;
                _customBenchmarkPanel.Visibility = Visibility.Visible;
            };
            _customCheckbox.Unchecked += (s, ev) =>
            {
                _vm.UseCustomBenchmarks = false;
                _customBenchmarkPanel.Visibility = Visibility.Collapsed;
            };
            stack.Children.Add(_customCheckbox);

            // ── Custom benchmark fields (hidden by default) ──
            _customBenchmarkPanel = new StackPanel
            {
                Margin = new Thickness(0, 4, 0, 0),
                Visibility = Visibility.Collapsed,
            };

            var fieldsGrid = new Grid();
            fieldsGrid.ColumnDefinitions.Add(new ColumnDefinition());
            fieldsGrid.ColumnDefinitions.Add(new ColumnDefinition());
            fieldsGrid.ColumnDefinitions.Add(new ColumnDefinition());
            fieldsGrid.RowDefinitions.Add(new RowDefinition());
            fieldsGrid.RowDefinitions.Add(new RowDefinition());

            // Labels
            var lblMin = FieldLabel("Min %");
            Grid.SetColumn(lblMin, 0); Grid.SetRow(lblMin, 0);
            fieldsGrid.Children.Add(lblMin);
            var lblTarget = FieldLabel("Target %");
            Grid.SetColumn(lblTarget, 1); Grid.SetRow(lblTarget, 0);
            fieldsGrid.Children.Add(lblTarget);
            var lblMax = FieldLabel("Max %");
            Grid.SetColumn(lblMax, 2); Grid.SetRow(lblMax, 0);
            fieldsGrid.Children.Add(lblMax);

            // Text boxes
            _customEffMinBox = new System.Windows.Controls.TextBox
            {
                Text = "78",
                FontSize = 12,
                Margin = new Thickness(0, 2, 4, 0),
                Padding = new Thickness(4, 3, 4, 3),
            };
            _customEffMinBox.TextChanged += (s, ev) => ParseCustomField(_customEffMinBox, v => _vm.CustomEffMin = v);
            Grid.SetColumn(_customEffMinBox, 0); Grid.SetRow(_customEffMinBox, 1);
            fieldsGrid.Children.Add(_customEffMinBox);

            _customEffTargetBox = new System.Windows.Controls.TextBox
            {
                Text = "82",
                FontSize = 12,
                Margin = new Thickness(0, 2, 4, 0),
                Padding = new Thickness(4, 3, 4, 3),
            };
            _customEffTargetBox.TextChanged += (s, ev) => ParseCustomField(_customEffTargetBox, v => _vm.CustomEffTarget = v);
            Grid.SetColumn(_customEffTargetBox, 1); Grid.SetRow(_customEffTargetBox, 1);
            fieldsGrid.Children.Add(_customEffTargetBox);

            _customEffMaxBox = new System.Windows.Controls.TextBox
            {
                Text = "85",
                FontSize = 12,
                Margin = new Thickness(0, 2, 0, 0),
                Padding = new Thickness(4, 3, 4, 3),
            };
            _customEffMaxBox.TextChanged += (s, ev) => ParseCustomField(_customEffMaxBox, v => _vm.CustomEffMax = v);
            Grid.SetColumn(_customEffMaxBox, 2); Grid.SetRow(_customEffMaxBox, 1);
            fieldsGrid.Children.Add(_customEffMaxBox);

            _customBenchmarkPanel.Children.Add(fieldsGrid);

            _customBenchmarkPanel.Children.Add(new TextBlock
            {
                Text = "Custom targets apply to all benchmarked zones. Enter efficiency as whole numbers (e.g. 82 for 82%).",
                FontSize = 10,
                Foreground = Brush(156, 163, 175),
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(0, 4, 0, 0),
            });

            stack.Children.Add(_customBenchmarkPanel);

            // Initialize default custom values
            _vm.CustomEffMin = 78;
            _vm.CustomEffTarget = 82;
            _vm.CustomEffMax = 85;

            settingsCard.Child = stack;
            return settingsCard;
        }

        private void ParseCustomField(System.Windows.Controls.TextBox box, Action<double> setter)
        {
            double val;
            if (double.TryParse(box.Text, out val) && val >= 0 && val <= 100)
            {
                box.BorderBrush = Brush(209, 213, 219);
                setter(val);
            }
            else
            {
                box.BorderBrush = new SolidColorBrush(Color.FromRgb(239, 68, 68));
            }
        }

        private async void LoadPresetsAsync()
        {
            try
            {
                var serverUrl = _vm.ServerUrl.TrimEnd('/');
                var presets = await BsiApiClient.GetPresetsAsync(serverUrl, _vm.AuthToken);
                if (presets != null && presets.Count > 0)
                {
                    Dispatcher.Invoke(() =>
                    {
                        _vm.AvailablePresets = presets;
                        _presetCombo.Items.Clear();
                        int selectedIdx = 0;
                        for (int i = 0; i < presets.Count; i++)
                        {
                            _presetCombo.Items.Add(presets[i].Label);
                            if (presets[i].Id == _vm.SelectedPreset) selectedIdx = i;
                        }
                        _presetCombo.SelectedIndex = selectedIdx;
                    });
                }
            }
            catch
            {
                // Silently fall back to hardcoded presets
            }
        }

        // ── Button Handlers ─────────────────────────────────────────

        private void OnAnalyzeClick(object sender, RoutedEventArgs e)
        {
            // Trigger the ExternalEvent so room extraction runs on Revit's thread
            BsiApp.AnalyzeEvent.Raise();
        }

        private async void OnAdviseClick(object sender, RoutedEventArgs e, string zoneId = null)
        {
            if (_lastAnalysisResult == null)
            {
                _vm.Status = "Run Analyze first before requesting AI advice.";
                return;
            }

            _adviseBtn.IsEnabled = false;
            _vm.Status = zoneId != null
                ? $"Requesting AI advice for zone \"{zoneId}\"..."
                : "Requesting AI design advice...";

            try
            {
                var result = await BsiApiClient.AdviseAsync(
                    _vm.ServerUrl.TrimEnd('/'), _vm.AuthToken, _lastAnalysisResult, zoneId);

                _staleAdviceNote.Visibility = Visibility.Collapsed;
                _vm.Narrative = result.Narrative;
                _vm.Suggestions = result.Suggestions;
                _vm.Status = $"AI advice received \u2014 {result.Suggestions.Count} suggestions.";
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

        // ── Called from AnalyzeHandler after room extraction ─────────

        public async void RunApiPipeline(
            List<RoomExtractor.RoomInfo> rooms,
            List<RoomExtractor.ZoneData> zones,
            string projectName,
            RoomExtractor.AreaPlanResult areaPlanResult)
        {
            _areaPlanResult = areaPlanResult;
            _lastRooms = rooms;
            _lastRawZones = zones;
            _lastProjectName = projectName;
            var serverUrl = _vm.ServerUrl.TrimEnd('/');
            var token = _vm.AuthToken;

            try
            {
                // Step 1: Classify rooms via AI
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

                // Apply user category overrides (from previous manual corrections)
                foreach (var room in rooms)
                {
                    string overrideCat;
                    var roomKey = $"{room.Name}|{room.LevelName}";
                    if (_vm.RoomCategoryOverrides.TryGetValue(roomKey, out overrideCat))
                    {
                        room.Category = overrideCat;
                        room.Confidence = 1.0; // user override = full confidence
                    }
                }

                Dispatcher.Invoke(() =>
                {
                    _vm.Classifications = classifications;
                    _vm.Status = $"Classified {classifications.Count} rooms. Analyzing zones...";
                });

                // Step 2: Infer zone primary use from classified rooms
                RoomExtractor.InferZonePrimaryUse(zones);

                // Step 2b: Merge consecutive zones with the same primary use
                zones = RoomExtractor.MergeConsecutiveZones(zones);

                Dispatcher.Invoke(() =>
                {
                    _vm.ZoneCount = zones.Count;
                    _lastMergedZones = zones;
                    _vm.Status = $"Merged into {zones.Count} zones. Analyzing efficiency...";
                });

                // Step 3: Analyze zone efficiency against benchmarks
                Dispatcher.Invoke(() => _vm.Status = "Analyzing zone efficiency...");

                var analysisResult = await BsiApiClient.AnalyzeAsync(
                    serverUrl, token, projectName, rooms, zones, areaPlanResult,
                    _vm.SelectedPreset, _vm.BuildingHeight);

                _lastAnalysisResult = analysisResult;

                // Parse analysis results
                Dispatcher.Invoke(() =>
                {
                    _recalcBar.Visibility = Visibility.Collapsed;
                    ParseAndDisplayAnalysis(analysisResult, rooms.Count);
                    if (_narrativeBlock.Visibility == Visibility.Visible)
                        _staleAdviceNote.Visibility = Visibility.Visible;
                });
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

        // ── Recalculate with overrides (skip AI classification) ────

        private async void RecalculateWithOverrides()
        {
            if (_lastRooms == null || _lastRawZones == null)
            {
                _vm.Status = "No previous analysis data \u2014 run Analyze first.";
                return;
            }

            _recalcBar.Visibility = Visibility.Collapsed;
            _vm.IsAnalyzing = true;
            _vm.Status = "Recalculating with updated classifications...";

            var serverUrl = _vm.ServerUrl.TrimEnd('/');
            var token = _vm.AuthToken;
            var rooms = _lastRooms;
            var projectName = _lastProjectName ?? "Untitled";

            try
            {
                // DEBUG: Show override keys vs room IDs to diagnose mismatch
                Dispatcher.Invoke(() =>
                {
                    _vm.Status = $"DEBUG: {_vm.RoomCategoryOverrides.Count} overrides stored. Keys: {string.Join(", ", _vm.RoomCategoryOverrides.Keys)}. First 3 room keys in _lastRooms: {string.Join(", ", _lastRooms.Take(3).Select(r => $"{r.Name}|{r.LevelName}"))}";
                });
                await System.Threading.Tasks.Task.Delay(2000);

                // Apply all current overrides to cached rooms
                int appliedCount = 0;
                var appliedDetails = new List<string>();
                await System.Threading.Tasks.Task.Run(() =>
                {
                    foreach (var room in rooms)
                    {
                        string overrideCat;
                        var roomKey = $"{room.Name}|{room.LevelName}";
                        if (_vm.RoomCategoryOverrides.TryGetValue(roomKey, out overrideCat))
                        {
                            if (room.Category != overrideCat)
                                appliedDetails.Add($"{room.Name}: {room.Category}\u2192{overrideCat}");
                            room.Category = overrideCat;
                            room.Confidence = 1.0;
                            appliedCount++;
                        }
                    }
                });

                Dispatcher.Invoke(() =>
                {
                    var detail = appliedDetails.Count > 0
                        ? string.Join(", ", appliedDetails)
                        : "(categories already match overrides)";
                    _vm.Status = $"Recalculating with {appliedCount} override(s): {detail}";
                });

                // Re-group and re-merge zones from scratch with updated categories
                var zones = RoomExtractor.GroupIntoZones(rooms);
                RoomExtractor.InferZonePrimaryUse(zones);
                zones = RoomExtractor.MergeConsecutiveZones(zones);

                Dispatcher.Invoke(() =>
                {
                    _vm.ZoneCount = zones.Count;
                    _lastMergedZones = zones;
                });

                // Re-analyze against benchmarks
                var analysisResult = await BsiApiClient.AnalyzeAsync(
                    serverUrl, token, projectName, rooms, zones, _areaPlanResult,
                    _vm.SelectedPreset, _vm.BuildingHeight);

                _lastAnalysisResult = analysisResult;

                Dispatcher.Invoke(() =>
                {
                    ParseAndDisplayAnalysis(analysisResult, rooms.Count);
                    if (_narrativeBlock.Visibility == Visibility.Visible)
                        _staleAdviceNote.Visibility = Visibility.Visible;
                    _vm.Status = "Recalculation complete \u2014 zones updated with overridden categories.";
                });
            }
            catch (Exception ex)
            {
                Dispatcher.Invoke(() =>
                {
                    _vm.Status = $"Recalc error: {ex.Message}";
                    _vm.IsAnalyzing = false;
                });
            }
        }

        // ── Parse API response into ViewModel ──────────────────────

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

                // Parse zones
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

                        var stallRaw = z.ContainsKey("stallCount") ? z["stallCount"] : null;
                        int? stallCount = stallRaw != null ? (int?)Convert.ToInt32(stallRaw) : null;

                        var zoneName = z.ContainsKey("name") ? z["name"]?.ToString() : "";

                        var zr = new ZoneResult
                        {
                            Name = zoneName,
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
                            StallCount = stallCount,
                        };

                        // Attach classified rooms from merged zone data
                        if (_lastMergedZones != null)
                        {
                            var match = _lastMergedZones.FirstOrDefault(mz => mz.Name == zoneName);
                            if (match != null)
                            {
                                zr.Rooms = match.Rooms.Select(r => new ZoneRoomInfo
                                {
                                    Id = r.Id,
                                    RevitElementId = r.RevitElementId,
                                    Name = r.Name,
                                    Area = r.Area,
                                    Category = r.Category ?? "unclassified",
                                    Confidence = r.Confidence,
                                    IsOverridden = _vm.RoomCategoryOverrides.ContainsKey($"{r.Name}|{r.LevelName}"),
                                    LevelName = r.LevelName,
                                    LevelNumber = r.LevelNumber,
                                }).ToList();
                            }
                        }

                        zoneList.Add(zr);
                    }
                }

                _vm.Zones = zoneList;
                _vm.HasResults = true;
                _vm.IsAnalyzing = false;
                _vm.Status = $"Analysis complete \u2014 {roomCount} rooms, {zoneList.Count} zones";
            }
            catch (Exception ex)
            {
                _vm.Status = $"Parse error: {ex.Message}";
                _vm.IsAnalyzing = false;
            }
        }

        // ── ViewModel change handler: rebuild dynamic UI ────────────

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
                    _summaryCard.Visibility = _vm.HasResults ? Visibility.Visible : Visibility.Collapsed;
                    _adviseBtn.Visibility = _vm.HasResults ? Visibility.Visible : Visibility.Collapsed;
                    if (_vm.HasResults) RebuildSummary();
                    break;

                case nameof(BsiViewModel.Zones):
                    RebuildZones();
                    break;

                case nameof(BsiViewModel.Suggestions):
                    RebuildSuggestions();
                    break;

                case nameof(BsiViewModel.Narrative):
                    if (!string.IsNullOrEmpty(_vm.Narrative))
                    {
                        _narrativeBlock.Text = _vm.Narrative;
                        _narrativeBlock.Visibility = Visibility.Visible;
                    }
                    break;

                case nameof(BsiViewModel.IsAnalyzing):
                    _analyzeBtn.IsEnabled = !_vm.IsAnalyzing;
                    _analyzeBtn.Content = _vm.IsAnalyzing ? "Analyzing..." : "\u25B6  Analyze Model";
                    break;
            }
        }

        // ── Rebuild Summary (LEVEL 1 — Headline Card) ──────────────

        private void RebuildSummary()
        {
            _summaryStats.Children.Clear();

            var unit = RoomExtractor.UnitLabel;
            _summaryStats.Children.Add(StatBlock("Rooms", _vm.RoomCount.ToString()));
            _summaryStats.Children.Add(StatBlock("Zones", _vm.ZoneCount.ToString()));
            _summaryStats.Children.Add(StatBlock("GFA", $"{_vm.TotalGFA:N0} {unit}"));
            _summaryStats.Children.Add(StatBlock("Efficiency",
                $"{(_vm.BlendedEfficiency * 100):F1}%"));

            // Health indicator: green/yellow/red based on zone benchmark status
            var healthColor = Color.FromRgb(34, 197, 94);  // green default
            var healthText = "All zones meet benchmarks";

            if (_vm.Zones.Count > 0)
            {
                bool anyBelow = false;
                bool anyNear = false;

                foreach (var z in _vm.Zones)
                {
                    if (z.Status == "not_applicable") continue;
                    if (z.Status == "below_benchmark") { anyBelow = true; break; }
                    // "near" = within 3% of benchmark min
                    if (z.BenchmarkMin > 0 && z.Efficiency < z.BenchmarkMin + 0.03)
                        anyNear = true;
                }

                if (anyBelow)
                {
                    healthColor = Color.FromRgb(239, 68, 68);  // red
                    healthText = "Some zones below benchmark";
                }
                else if (anyNear)
                {
                    healthColor = Color.FromRgb(234, 179, 8);  // yellow
                    healthText = "Some zones near benchmark floor";
                }
            }

            _healthDot.Background = new SolidColorBrush(healthColor);
            _healthLabel.Text = healthText;

            // GFA source banner
            if (_areaPlanResult != null)
            {
                _gfaBanner.Visibility = Visibility.Visible;
                if (_areaPlanResult.HasAreaPlans)
                {
                    _gfaBanner.Background = new SolidColorBrush(Color.FromArgb(30, 16, 185, 129));
                    _gfaSourceText.Text = $"\U0001F4D0 GFA from \"{_areaPlanResult.SchemeName}\" area plans";
                    _gfaSourceText.Foreground = Brush(5, 150, 105);
                }
                else
                {
                    _gfaBanner.Background = new SolidColorBrush(Color.FromArgb(30, 234, 179, 8));
                    _gfaSourceText.Text = "\u26A0 No Gross Building area scheme found. GFA estimated from room totals \u2014 add Area Plans for accurate results.";
                    _gfaSourceText.Foreground = Brush(161, 98, 7);
                }
            }
        }

        // ── Rebuild Zones (LEVEL 2 — Clickable rows + LEVEL 3 — Detail) ──

        private void RebuildZones()
        {
            _zonesContent.Children.Clear();
            _expandedZones.Clear();
            if (_vm.Zones.Count == 0) return;

            _zonesPanel.Visibility = Visibility.Visible;

            var categories = new[] { "residential", "retail", "office", "hospitality",
                                     "core", "circulation", "parking", "amenity", "boh" };

            foreach (var zone in _vm.Zones)
            {
                var container = new StackPanel();

                // ── LEVEL 2: Single clickable zone row ──
                var borderColor = GetTypologyBorderColor(zone.PrimaryUse);
                var row = new Border
                {
                    Background = Brushes.White,
                    BorderBrush = new SolidColorBrush(borderColor),
                    BorderThickness = new Thickness(3, 1, 1, 1),
                    Padding = new Thickness(10, 8, 10, 8),
                    Margin = new Thickness(0, 0, 0, 2),
                    Cursor = System.Windows.Input.Cursors.Hand,
                };

                // Tooltip with benchmark data (Section 4)
                if (zone.BenchmarkTarget > 0)
                {
                    var tipStack = new StackPanel { Margin = new Thickness(2) };
                    tipStack.Children.Add(new TextBlock
                    {
                        Text = $"{zone.Name} ({zone.PrimaryUse})",
                        FontWeight = FontWeights.SemiBold,
                        FontSize = 12,
                    });
                    tipStack.Children.Add(new TextBlock
                    {
                        Text = $"Efficiency: {zone.Efficiency * 100:F1}%",
                        FontSize = 11,
                        Margin = new Thickness(0, 2, 0, 0),
                    });
                    tipStack.Children.Add(new TextBlock
                    {
                        Text = $"Benchmark range: {zone.BenchmarkMin * 100:F0}% \u2013 {zone.BenchmarkMax * 100:F0}%",
                        FontSize = 11,
                        Foreground = Brush(107, 114, 128),
                    });
                    tipStack.Children.Add(new TextBlock
                    {
                        Text = $"Target: {zone.BenchmarkTarget * 100:F0}%",
                        FontSize = 11,
                        Foreground = Brush(107, 114, 128),
                    });
                    var unit = RoomExtractor.UnitLabel;
                    tipStack.Children.Add(new TextBlock
                    {
                        Text = $"GFA: {zone.GFA:N0} {unit}  |  {BsiViewModel.GetNetAreaLabel(zone.PrimaryUse)}: {zone.NLA:N0} {unit}",
                        FontSize = 10,
                        Foreground = Brush(156, 163, 175),
                        Margin = new Thickness(0, 4, 0, 0),
                    });
                    row.ToolTip = tipStack;
                }
                else if (zone.Status == "not_applicable")
                {
                    var tipUnit = RoomExtractor.UnitLabel;
                    row.ToolTip = $"{zone.Name}: {zone.PrimaryUse}, GFA {zone.GFA:N0} {tipUnit} (not benchmarked)";
                }

                var rowContent = new DockPanel();

                // Colored typology dot
                rowContent.Children.Add(new Border
                {
                    Width = 8,
                    Height = 8,
                    CornerRadius = new CornerRadius(4),
                    Background = new SolidColorBrush(borderColor),
                    VerticalAlignment = VerticalAlignment.Center,
                    Margin = new Thickness(0, 0, 8, 0),
                });

                // Status badge (right side)
                if (zone.Status == "not_applicable")
                {
                    var naBadge = new TextBlock
                    {
                        Text = "N/A",
                        FontSize = 10,
                        Foreground = Brush(156, 163, 175),
                        VerticalAlignment = VerticalAlignment.Center,
                    };
                    DockPanel.SetDock(naBadge, Dock.Right);
                    rowContent.Children.Add(naBadge);
                }
                else
                {
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
                        Padding = new Thickness(5, 1, 5, 1),
                        VerticalAlignment = VerticalAlignment.Center,
                    };
                    badge.Child = new TextBlock
                    {
                        Text = statusLabel,
                        FontSize = 9,
                        FontWeight = FontWeights.Bold,
                        Foreground = Brushes.White,
                    };
                    DockPanel.SetDock(badge, Dock.Right);
                    rowContent.Children.Add(badge);
                }

                // Zone name + efficiency text
                var nameText = zone.Name;
                if (zone.Status != "not_applicable")
                    nameText += $" \u2014 {(zone.Efficiency * 100):F1}%";

                rowContent.Children.Add(new TextBlock
                {
                    Text = nameText,
                    FontSize = 12,
                    Foreground = Brush(31, 41, 55),
                    VerticalAlignment = VerticalAlignment.Center,
                    TextTrimming = TextTrimming.CharacterEllipsis,
                });

                row.Child = rowContent;

                // ── LEVEL 3: Expanded detail panel (hidden by default) ──
                var tintColor = Color.FromArgb(13, borderColor.R, borderColor.G, borderColor.B);
                var detail = new Border
                {
                    Background = new SolidColorBrush(tintColor),
                    BorderBrush = new SolidColorBrush(
                        Color.FromArgb(40, borderColor.R, borderColor.G, borderColor.B)),
                    BorderThickness = new Thickness(3, 0, 1, 1),
                    Padding = new Thickness(12, 8, 12, 8),
                    Margin = new Thickness(0, 0, 0, 2),
                    Visibility = Visibility.Collapsed,
                };

                var detailStack = new StackPanel();

                var dUnit = RoomExtractor.UnitLabel;
                var zoneNetLabel = BsiViewModel.GetNetAreaLabel(zone.PrimaryUse);

                // Metrics row
                var metrics = new WrapPanel { Margin = new Thickness(0, 0, 0, 6) };
                metrics.Children.Add(MiniStat("GFA", $"{zone.GFA:N0} {dUnit}"));
                metrics.Children.Add(MiniStat(zoneNetLabel, $"{zone.NLA:N0} {dUnit}"));
                metrics.Children.Add(MiniStat("Core", $"{zone.Core:N0} {dUnit}"));
                metrics.Children.Add(MiniStat("Circ", $"{zone.Circulation:N0} {dUnit}"));
                detailStack.Children.Add(metrics);

                if (zone.Status == "not_applicable")
                {
                    detailStack.Children.Add(new TextBlock
                    {
                        Text = "Not benchmarked",
                        FontSize = 11,
                        FontStyle = FontStyles.Italic,
                        Foreground = Brush(156, 163, 175),
                    });

                    if (zone.StallCount.HasValue)
                    {
                        detailStack.Children.Add(new TextBlock
                        {
                            Text = $"Stalls: ~{zone.StallCount.Value:N0} (estimated)",
                            FontSize = 12,
                            FontWeight = FontWeights.SemiBold,
                            Foreground = Brush(55, 65, 81),
                            Margin = new Thickness(0, 4, 0, 0),
                            ToolTip = GetMetricTooltip("Stalls"),
                        });
                    }
                }
                else
                {
                    // Efficiency bar
                    var statusColor = zone.Status == "above_benchmark" ? Color.FromRgb(34, 197, 94)
                        : zone.Status == "on_target" ? Color.FromRgb(234, 179, 8)
                        : Color.FromRgb(239, 68, 68);

                    detailStack.Children.Add(new TextBlock
                    {
                        Text = $"Efficiency: {zone.Efficiency * 100:F1}%",
                        FontSize = 11,
                        Foreground = Brush(55, 65, 81),
                        ToolTip = GetMetricTooltip("Efficiency"),
                    });

                    var barBg = new Border
                    {
                        Background = Brush(229, 231, 235),
                        CornerRadius = new CornerRadius(3),
                        Height = 8,
                        Margin = new Thickness(0, 4, 0, 0),
                    };
                    var barFill = new Border
                    {
                        Background = new SolidColorBrush(statusColor),
                        CornerRadius = new CornerRadius(3),
                        Height = 8,
                        HorizontalAlignment = HorizontalAlignment.Left,
                        Width = 0,
                    };

                    var barGrid = new Grid();
                    barGrid.Children.Add(barBg);
                    barGrid.Children.Add(barFill);
                    detailStack.Children.Add(barGrid);

                    barGrid.Loaded += (s, ev) =>
                    {
                        var pct = Math.Min(1.0, Math.Max(0.0, zone.Efficiency));
                        barFill.Width = barGrid.ActualWidth * pct;
                    };

                    if (zone.BenchmarkTarget > 0)
                    {
                        detailStack.Children.Add(new TextBlock
                        {
                            Text = $"Benchmark: {zone.BenchmarkMin * 100:F0}% \u2013 {zone.BenchmarkMax * 100:F0}% (target {zone.BenchmarkTarget * 100:F0}%)",
                            FontSize = 10,
                            Foreground = Brush(156, 163, 175),
                            Margin = new Thickness(0, 2, 0, 0),
                        });
                    }
                }

                // ── Inline room list (progressive disclosure Level 4) ──
                if (zone.Rooms != null && zone.Rooms.Count > 0)
                {
                    var roomsSection = new StackPanel { Margin = new Thickness(0, 8, 0, 0) };

                    // Collapsible header
                    var roomToggleRow = new DockPanel { Margin = new Thickness(0, 0, 0, 4) };
                    var roomCount = zone.Rooms.Count;
                    var overrideCount = zone.Rooms.Count(r => r.IsOverridden);
                    var toggleLabel = $"Rooms ({roomCount})" +
                        (overrideCount > 0 ? $" \u2022 {overrideCount} overridden" : "");

                    var roomToggleBtn = new TextBlock
                    {
                        Text = toggleLabel + " \u25BC",
                        FontSize = 10,
                        FontWeight = FontWeights.SemiBold,
                        Foreground = Brush(59, 130, 246),
                        Cursor = System.Windows.Input.Cursors.Hand,
                    };

                    var roomList = new StackPanel
                    {
                        Visibility = Visibility.Collapsed,
                        Margin = new Thickness(0, 2, 0, 0),
                    };

                    roomToggleBtn.MouseLeftButtonDown += (s, ev) =>
                    {
                        ev.Handled = true;
                        if (roomList.Visibility == Visibility.Visible)
                        {
                            roomList.Visibility = Visibility.Collapsed;
                            roomToggleBtn.Text = toggleLabel + " \u25BC";
                        }
                        else
                        {
                            roomList.Visibility = Visibility.Visible;
                            roomToggleBtn.Text = toggleLabel + " \u25B2";
                        }
                    };

                    roomToggleRow.Children.Add(roomToggleBtn);
                    roomsSection.Children.Add(roomToggleRow);

                    // Room rows
                    foreach (var room in zone.Rooms)
                    {
                        var roomRow = new DockPanel
                        {
                            Margin = new Thickness(0, 1, 0, 1),
                        };

                        // Category override dropdown (right side)
                        var catCombo = new System.Windows.Controls.ComboBox
                        {
                            FontSize = 9,
                            Width = 88,
                            Padding = new Thickness(3, 1, 3, 1),
                            VerticalAlignment = VerticalAlignment.Center,
                            IsEditable = false,
                        };
                        int selectedIdx = 0;
                        for (int ci = 0; ci < categories.Length; ci++)
                        {
                            catCombo.Items.Add(categories[ci]);
                            if (categories[ci] == room.Category) selectedIdx = ci;
                        }
                        catCombo.SelectedIndex = selectedIdx;

                        // Override border to signal manual override
                        if (room.IsOverridden)
                        {
                            catCombo.BorderBrush = Brush(245, 158, 11); // amber
                            catCombo.ToolTip = "Manually overridden \u2014 will persist on re-analyze";
                        }
                        else
                        {
                            catCombo.ToolTip = $"AI confidence: {room.Confidence * 100:F0}%\nChange to override AI classification";
                        }

                        var capturedRoom = room;
                        catCombo.SelectionChanged += (s, ev) =>
                        {
                            var combo = s as System.Windows.Controls.ComboBox;
                            if (combo == null || combo.SelectedIndex < 0) return;
                            var newCat = categories[combo.SelectedIndex];
                            if (newCat != capturedRoom.Category)
                            {
                                _vm.RoomCategoryOverrides[$"{capturedRoom.Name}|{capturedRoom.LevelName}"] = newCat;
                                capturedRoom.Category = newCat;
                                capturedRoom.IsOverridden = true;
                                combo.BorderBrush = Brush(245, 158, 11);
                                combo.ToolTip = "Manually overridden \u2014 will persist on re-analyze";
                                _vm.Status = $"Overridden: {capturedRoom.Name} \u2192 {newCat}. Click green bar to recalculate.";
                                _recalcBar.Visibility = Visibility.Visible;
                            }
                        };
                        DockPanel.SetDock(catCombo, Dock.Right);
                        roomRow.Children.Add(catCombo);

                        // Confidence dot
                        var confColor = room.Confidence >= 0.9 ? Color.FromRgb(34, 197, 94)
                            : room.Confidence >= 0.7 ? Color.FromRgb(234, 179, 8)
                            : Color.FromRgb(239, 68, 68);
                        var confDot = new Border
                        {
                            Width = 6,
                            Height = 6,
                            CornerRadius = new CornerRadius(3),
                            Background = room.IsOverridden
                                ? new SolidColorBrush(Color.FromRgb(245, 158, 11))
                                : new SolidColorBrush(confColor),
                            Margin = new Thickness(0, 0, 5, 0),
                            VerticalAlignment = VerticalAlignment.Center,
                            ToolTip = room.IsOverridden
                                ? "User override"
                                : $"AI confidence: {room.Confidence * 100:F0}%",
                        };
                        roomRow.Children.Add(confDot);

                        // Room name — clickable to highlight in Revit
                        var lvTag = !string.IsNullOrEmpty(room.LevelName) ? $" ({room.LevelName})" : "";
                        var nameBlock = new TextBlock
                        {
                            Text = room.Name + lvTag,
                            FontSize = 10,
                            Foreground = Brush(55, 65, 81),
                            VerticalAlignment = VerticalAlignment.Center,
                            TextTrimming = TextTrimming.CharacterEllipsis,
                        };

                        if (room.RevitElementId > 0)
                        {
                            nameBlock.Foreground = Brush(37, 99, 235);
                            nameBlock.Cursor = System.Windows.Input.Cursors.Hand;
                            nameBlock.TextDecorations = TextDecorations.Underline;
                            nameBlock.ToolTip = $"Click to select & zoom in Revit (ID: {room.RevitElementId})";
                            var eid = room.RevitElementId;
                            nameBlock.MouseLeftButtonDown += (s, ev) =>
                            {
                                ev.Handled = true;
                                BsiApp.HighlightRoomHandler.PendingElementId = eid;
                                BsiApp.HighlightRoomEvent.Raise();
                            };
                        }

                        roomRow.Children.Add(nameBlock);

                        // Area label (between name and dropdown)
                        var areaLabel = new TextBlock
                        {
                            Text = $"  {room.Area:N0} {dUnit}",
                            FontSize = 9,
                            Foreground = Brush(156, 163, 175),
                            VerticalAlignment = VerticalAlignment.Center,
                            Margin = new Thickness(0, 0, 6, 0),
                        };
                        DockPanel.SetDock(areaLabel, Dock.Right);
                        roomRow.Children.Add(areaLabel);

                        roomList.Children.Add(roomRow);
                    }

                    roomsSection.Children.Add(roomList);
                    detailStack.Children.Add(roomsSection);
                }

                // "Ask AI about this zone" link
                var askLink = new TextBlock
                {
                    Text = "Ask AI about this zone \u2192",
                    FontSize = 10,
                    Foreground = Brush(124, 58, 237),
                    Cursor = System.Windows.Input.Cursors.Hand,
                    Margin = new Thickness(0, 8, 0, 0),
                };
                var capturedZoneName = zone.Name;
                askLink.MouseLeftButtonDown += (s, ev) =>
                {
                    if (_lastAnalysisResult == null)
                    {
                        _vm.Status = "Run Analyze first.";
                        return;
                    }
                    OnAdviseClick(null, null, capturedZoneName);
                };
                detailStack.Children.Add(askLink);

                detail.Child = detailStack;

                var detailPanel = new StackPanel();
                detailPanel.Children.Add(detail);
                _expandedZones[zone.Name] = detailPanel;

                row.MouseLeftButtonDown += (s, ev) =>
                {
                    if (detail.Visibility == Visibility.Visible)
                        detail.Visibility = Visibility.Collapsed;
                    else
                        detail.Visibility = Visibility.Visible;
                };

                container.Children.Add(row);
                container.Children.Add(detailPanel);
                _zonesContent.Children.Add(container);
            }
        }

        // ── Rebuild Suggestions ─────────────────────────────────────

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

                // Severity + Zone row
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
                    FontSize = 9,
                    FontWeight = FontWeights.Bold,
                    Foreground = Brushes.White,
                };
                headerRow.Children.Add(sevBadge);

                headerRow.Children.Add(new TextBlock
                {
                    Text = sug.Zone ?? "",
                    FontSize = 11,
                    Foreground = Brush(107, 114, 128),
                    VerticalAlignment = VerticalAlignment.Center,
                });
                stack.Children.Add(headerRow);

                // Message
                stack.Children.Add(new TextBlock
                {
                    Text = sug.Message,
                    FontSize = 12,
                    Foreground = Brush(31, 41, 55),
                    TextWrapping = TextWrapping.Wrap,
                    Margin = new Thickness(0, 4, 0, 0),
                });

                // Impact metrics
                if (sug.RevenueDelta.HasValue && sug.RevenueDelta.Value != 0)
                {
                    var sign = sug.RevenueDelta.Value > 0 ? "+" : "";
                    stack.Children.Add(new TextBlock
                    {
                        Text = $"\U0001F4B0 Revenue impact: {sign}\u20AC{sug.RevenueDelta.Value:N0}",
                        FontSize = 11,
                        Foreground = Brush(16, 185, 129),
                        Margin = new Thickness(0, 4, 0, 0),
                    });
                }

                card.Child = stack;
                _suggestionsContent.Children.Add(card);
            }
        }

        // ── UI Helper Methods ───────────────────────────────────────

        private static TextBlock SectionLabel(string text)
        {
            return new TextBlock
            {
                Text = text,
                FontSize = 13,
                FontWeight = FontWeights.SemiBold,
                Foreground = new SolidColorBrush(Color.FromRgb(17, 24, 39)),
                Margin = new Thickness(0, 0, 0, 4),
            };
        }

        private static TextBlock FieldLabel(string text)
        {
            return new TextBlock
            {
                Text = text,
                FontSize = 11,
                Foreground = new SolidColorBrush(Color.FromRgb(107, 114, 128)),
            };
        }

        private static FrameworkElement StepRow(string number, string text)
        {
            var row = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                Margin = new Thickness(0, 3, 0, 3),
            };
            var numBadge = new Border
            {
                Background = new SolidColorBrush(Color.FromRgb(59, 130, 246)),
                CornerRadius = new CornerRadius(10),
                Width = 20,
                Height = 20,
                Margin = new Thickness(0, 0, 8, 0),
            };
            numBadge.Child = new TextBlock
            {
                Text = number,
                FontSize = 10,
                FontWeight = FontWeights.Bold,
                Foreground = Brushes.White,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
            };
            row.Children.Add(numBadge);
            row.Children.Add(new TextBlock
            {
                Text = text,
                FontSize = 11,
                Foreground = new SolidColorBrush(Color.FromRgb(55, 65, 81)),
                VerticalAlignment = VerticalAlignment.Center,
            });
            return row;
        }

        private static Button ActionButton(string text, Color color)
        {
            var btn = new Button
            {
                Content = text,
                FontSize = 13,
                FontWeight = FontWeights.SemiBold,
                Foreground = Brushes.White,
                Background = new SolidColorBrush(color),
                Padding = new Thickness(16, 10, 16, 10),
                Cursor = System.Windows.Input.Cursors.Hand,
                BorderThickness = new Thickness(0),
                HorizontalAlignment = HorizontalAlignment.Stretch,
            };
            return btn;
        }

        // ── Metric tooltip dictionary ────────────────────────────
        private static readonly Dictionary<string, string> MetricTooltips = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "GFA", "Gross Floor Area \u2014 total area measured to the outside face of external walls" },
            { "NIA", "Net Internal Area \u2014 usable area inside apartments, measured wall-to-wall" },
            { "NLA", "Net Lettable Area \u2014 usable office space available to tenants" },
            { "GLA", "Gross Leasable Area \u2014 total area inside retail tenant units" },
            { "NRA", "Net Rentable Area \u2014 usable area within hotel / hospitality units" },
            { "Net Area", "Net usable area for this zone type" },
            { "Core", "Stairs, elevators, shafts, risers \u2014 shared vertical infrastructure" },
            { "Circ", "Corridors, lobbies, walkways within a zone" },
            { "Circulation", "Corridors, lobbies, walkways within a zone" },
            { "Efficiency", "Net area divided by gross area. Higher is better \u2014 more of your building is usable." },
            { "Stalls", "Estimated parking stall count based on area per stall" },
            { "Rooms", "Total number of rooms extracted from the Revit model" },
            { "Zones", "Number of vertical zones after grouping and merging levels" },
        };

        private static string GetMetricTooltip(string label)
        {
            string tip;
            return MetricTooltips.TryGetValue(label, out tip) ? tip : null;
        }

        private static Border StatBlock(string label, string value, Color? color = null, string tooltip = null)
        {
            var border = new Border
            {
                Background = Brushes.White,
                BorderBrush = new SolidColorBrush(Color.FromRgb(229, 231, 235)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(6),
                Padding = new Thickness(10, 6, 10, 6),
                Margin = new Thickness(0, 0, 6, 6),
                MinWidth = 70,
            };
            var resolvedTip = tooltip ?? GetMetricTooltip(label);
            if (resolvedTip != null) border.ToolTip = resolvedTip;
            var stack = new StackPanel { HorizontalAlignment = HorizontalAlignment.Center };
            stack.Children.Add(new TextBlock
            {
                Text = value,
                FontSize = 16,
                FontWeight = FontWeights.Bold,
                Foreground = color.HasValue ? new SolidColorBrush(color.Value) : new SolidColorBrush(Color.FromRgb(17, 24, 39)),
                HorizontalAlignment = HorizontalAlignment.Center,
            });
            stack.Children.Add(new TextBlock
            {
                Text = label,
                FontSize = 10,
                Foreground = new SolidColorBrush(Color.FromRgb(156, 163, 175)),
                HorizontalAlignment = HorizontalAlignment.Center,
            });
            border.Child = stack;
            return border;
        }

        private static FrameworkElement MiniStat(string label, string value, string tooltip = null)
        {
            var stack = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                Margin = new Thickness(0, 0, 12, 0),
            };
            var resolvedTip = tooltip ?? GetMetricTooltip(label);
            if (resolvedTip != null) stack.ToolTip = resolvedTip;
            stack.Children.Add(new TextBlock
            {
                Text = label + ": ",
                FontSize = 10,
                Foreground = new SolidColorBrush(Color.FromRgb(156, 163, 175)),
            });
            stack.Children.Add(new TextBlock
            {
                Text = value,
                FontSize = 10,
                FontWeight = FontWeights.SemiBold,
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
                Text = category ?? "?",
                FontSize = 10,
                FontWeight = FontWeights.SemiBold,
                Foreground = new SolidColorBrush(color),
            };
            return badge;
        }

        private static Color GetCategoryColor(string category)
        {
            switch (category?.ToLower())
            {
                case "residential": return Color.FromRgb(59, 130, 246);   // blue
                case "retail": return Color.FromRgb(236, 72, 153);   // pink
                case "office": return Color.FromRgb(168, 85, 247);   // purple
                case "hospitality": return Color.FromRgb(245, 158, 11);   // amber
                case "core": return Color.FromRgb(107, 114, 128);  // gray
                case "circulation": return Color.FromRgb(234, 179, 8);    // yellow
                case "parking": return Color.FromRgb(20, 184, 166);   // teal
                case "amenity": return Color.FromRgb(16, 185, 129);   // emerald
                case "boh": return Color.FromRgb(156, 163, 175);  // gray-400
                default: return Color.FromRgb(209, 213, 219);  // gray-300
            }
        }

        /// <summary>Zone row left-border colors per typology (distinct from category badge colors).</summary>
        private static Color GetTypologyBorderColor(string primaryUse)
        {
            switch (primaryUse?.ToLower())
            {
                case "residential": return Color.FromRgb(20, 184, 166);    // teal
                case "retail": return Color.FromRgb(245, 158, 11);    // amber
                case "office": return Color.FromRgb(59, 130, 246);    // blue
                case "hospitality": return Color.FromRgb(168, 85, 247);    // purple
                case "parking": return Color.FromRgb(156, 163, 175);   // gray
                case "amenity": return Color.FromRgb(16, 185, 129);    // green
                default: return Color.FromRgb(209, 213, 219);   // gray-300
            }
        }

        private static Color GetSeverityColor(string severity)
        {
            switch (severity?.ToLower())
            {
                case "critical": return Color.FromRgb(220, 38, 38);   // red-600
                case "high": return Color.FromRgb(249, 115, 22);  // orange-500
                case "medium": return Color.FromRgb(234, 179, 8);   // yellow-500
                case "low": return Color.FromRgb(59, 130, 246);  // blue-500
                case "info":
                default: return Color.FromRgb(107, 114, 128); // gray-500
            }
        }

        // Shorthand for creating a SolidColorBrush
        private static SolidColorBrush Brush(byte r, byte g, byte b) =>
            new SolidColorBrush(Color.FromRgb(r, g, b));

        // JSON helpers
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

        private static int GetInt(Dictionary<string, object> d, string key)
        {
            return (int)GetDouble(d, key);
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
}
