using System;
using System.Collections.Generic;
using System.Linq;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Architecture;
using Autodesk.Revit.UI;

namespace BSI.RevitAddin
{
    /// <summary>
    /// ExternalEvent handler that highlights (selects + zooms to) a room in Revit.
    /// Set PendingElementId before raising the event.
    /// </summary>
    public class HighlightRoomHandler : IExternalEventHandler
    {
        /// <summary>ElementId.Value of the room to highlight. Set before Raise().</summary>
        public long PendingElementId { get; set; }

        public void Execute(UIApplication app)
        {
            var uidoc = app.ActiveUIDocument;
            if (uidoc == null || PendingElementId <= 0) return;

            try
            {
                var doc = uidoc.Document;
                var elementId = new ElementId(PendingElementId);
                var element = doc.GetElement(elementId);
                if (element == null) return;

                // If the element is a Room, navigate to its level's floor plan first
                var room = element as Room;
                if (room != null && room.LevelId != null && room.LevelId != ElementId.InvalidElementId)
                {
                    var levelId = room.LevelId;

                    // Find a floor plan ViewPlan for this level
                    var floorPlan = new FilteredElementCollector(doc)
                        .OfClass(typeof(ViewPlan))
                        .Cast<ViewPlan>()
                        .Where(v => !v.IsTemplate
                            && v.ViewType == ViewType.FloorPlan
                            && v.GenLevel != null
                            && v.GenLevel.Id == levelId)
                        .FirstOrDefault();

                    if (floorPlan != null)
                    {
                        uidoc.ActiveView = floorPlan;
                    }
                }

                // Select the element
                uidoc.Selection.SetElementIds(new List<ElementId> { elementId });

                // Zoom to the element in the active view
                uidoc.ShowElements(new List<ElementId> { elementId });
            }
            catch (Exception ex)
            {
                BsiApp.Panel?.Dispatcher.Invoke(() =>
                {
                    BsiApp.Panel.ViewModel.Status = $"Highlight failed: {ex.Message}";
                });
            }
        }

        public string GetName() => "BSI Highlight Room";
    }
}
