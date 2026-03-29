using System;
using System.Reflection;
using Autodesk.Revit.UI;
using Autodesk.Revit.DB;
using Autodesk.Revit.Attributes;

namespace BSI.RevitAddin
{
    /// <summary>
    /// Revit application entry point.
    /// Registers the BSI dockable pane and creates ribbon UI.
    /// </summary>
    public class BsiApp : IExternalApplication
    {
        internal static BsiPanel Panel { get; private set; }
        internal static ExternalEvent AnalyzeEvent { get; private set; }
        internal static ExternalEvent HighlightRoomEvent { get; private set; }
        internal static HighlightRoomHandler HighlightRoomHandler { get; private set; }

        private static readonly DockablePaneId PaneId =
            new DockablePaneId(new Guid("F7A1B2C3-D4E5-6F78-9A0B-CDEF12345678"));

        public Result OnStartup(UIControlledApplication app)
        {
            try
            {
                // Create the WPF panel and handler
                Panel = new BsiPanel();
                var handler = new AnalyzeHandler();
                AnalyzeEvent = ExternalEvent.Create(handler);
                HighlightRoomHandler = new HighlightRoomHandler();
                HighlightRoomEvent = ExternalEvent.Create(HighlightRoomHandler);

                // Register dockable pane (may already exist from prior session)
                try
                {
                    app.RegisterDockablePane(PaneId, "BSI", Panel);
                }
                catch
                {
                    // Pane was already registered — not an error
                }

                // Create ribbon UI
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
            // Use the shared GenFabTools tab (created by other addins too)
            string tabName = "GenFabTools";
            try { app.CreateRibbonTab(tabName); }
            catch { /* tab may already exist from OccuCalc or ParkCore */ }

            // Find existing BSI panel or create new one
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

            // Only add buttons if they don't already exist
            bool hasToggle = false, hasAnalyze = false;
            foreach (var item in panel.GetItems())
            {
                if (item.Name == "BSI_Toggle") hasToggle = true;
                if (item.Name == "BSI_Analyze") hasAnalyze = true;
            }

            if (!hasToggle)
            {
                var toggleData = new PushButtonData(
                    "BSI_Toggle",
                    "BSI\nPanel",
                    assemblyPath,
                    typeof(TogglePanelCommand).FullName)
                {
                    ToolTip = "Show or hide the BSI analysis panel",
                };
                panel.AddItem(toggleData);
            }

            if (!hasAnalyze)
            {
                var analyzeData = new PushButtonData(
                    "BSI_Analyze",
                    "Analyze\nModel",
                    assemblyPath,
                    typeof(AnalyzeCommand).FullName)
                {
                    ToolTip = "Read all rooms and run AI efficiency analysis",
                };
                panel.AddItem(analyzeData);
            }
        }
    }

    // ── Commands ─────────────────────────────────────────────────

    /// <summary>
    /// Toggles the BSI dockable pane visibility.
    /// </summary>
    [Transaction(TransactionMode.ReadOnly)]
    public class TogglePanelCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                var paneId = new DockablePaneId(new Guid("F7A1B2C3-D4E5-6F78-9A0B-CDEF12345678"));
                var pane = commandData.Application.GetDockablePane(paneId);

                if (pane.IsShown())
                    pane.Hide();
                else
                    pane.Show();

                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                return Result.Failed;
            }
        }
    }

    /// <summary>
    /// Triggers BSI analysis from the ribbon button.
    /// Uses ExternalEvent to safely access Revit API.
    /// </summary>
    [Transaction(TransactionMode.ReadOnly)]
    public class AnalyzeCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                // Show the panel if hidden
                var paneId = new DockablePaneId(new Guid("F7A1B2C3-D4E5-6F78-9A0B-CDEF12345678"));
                var pane = commandData.Application.GetDockablePane(paneId);
                if (!pane.IsShown()) pane.Show();

                // Raise the analyze event
                BsiApp.AnalyzeEvent.Raise();

                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                return Result.Failed;
            }
        }
    }
}
