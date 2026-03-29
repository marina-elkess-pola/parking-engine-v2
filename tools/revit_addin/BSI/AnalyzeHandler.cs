using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Autodesk.Revit.UI;

namespace BSI.RevitAddin
{
    /// <summary>
    /// Runs on Revit's main thread via ExternalEvent.
    /// Extracts rooms from the active document and kicks off the API pipeline.
    /// </summary>
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
                // Extract rooms (must run on Revit's thread)
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
                var areaPlanResult = RoomExtractor.ExtractAreaPlans(doc);
                var projectName = doc.Title ?? "Untitled";

                // Show initial GFA from area plans or room sum
                double initialGFA;
                if (areaPlanResult.HasAreaPlans)
                {
                    double totalSqM = areaPlanResult.TotalGfaSqM;
                    initialGFA = RoomExtractor.ProjectAreaUnit == RoomExtractor.AreaUnit.SquareFeet
                        ? Math.Round(totalSqM * 10.7639104, 2)
                        : Math.Round(totalSqM, 2);
                }
                else
                {
                    initialGFA = Math.Round(rooms.Sum(r => r.Area), 2);
                }

                panel.Dispatcher.Invoke(() =>
                {
                    vm.RoomCount = rooms.Count;
                    vm.ZoneCount = zones.Count;
                    vm.TotalGFA = initialGFA;
                    var gfaNote = areaPlanResult.HasAreaPlans
                        ? " (GFA from Area Plans)"
                        : "";
                    vm.Status = $"Found {rooms.Count} rooms across {zones.Count} levels{gfaNote}. Calling AI...";
                });

                // Hand off to async API pipeline (runs on background thread)
                Task.Run(() => panel.RunApiPipeline(rooms, zones, projectName, areaPlanResult));
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
