import SwiftUI
import SwiftData

@main
struct BudgetApp: App {

    let modelContainer: ModelContainer

    init() {
        do {
            modelContainer = try ModelContainer(
                for: Expense.self, RecurringExpense.self, AppSettings.self
            )
        } catch {
            fatalError("Impossible d'initialiser le conteneur SwiftData : \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .modelContainer(modelContainer)
        }
    }
}
