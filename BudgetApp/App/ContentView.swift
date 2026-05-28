import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("Tableau de bord", systemImage: "chart.bar.fill")
                }

            ExpenseListView()
                .tabItem {
                    Label("Dépenses", systemImage: "list.bullet.rectangle.portrait.fill")
                }

            RecurringExpenseListView()
                .tabItem {
                    Label("Récurrentes", systemImage: "arrow.clockwise")
                }

            SettingsView()
                .tabItem {
                    Label("Réglages", systemImage: "gear")
                }
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(PreviewData.container)
}
