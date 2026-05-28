import Foundation
import SwiftData

// MARK: - Sample data mirroring a typical 2-person French household budget

@MainActor
enum PreviewData {

    static var container: ModelContainer = {
        let schema = Schema([Expense.self, RecurringExpense.self, AppSettings.self])
        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        let container = try! ModelContainer(for: schema, configurations: config)
        insertSampleData(into: container.mainContext)
        return container
    }()

    static func insertSampleData(into context: ModelContext) {
        // Settings
        let settings = AppSettings(
            person1Name: "Sophie",
            person2Name: "Thomas",
            baseCurrency: .eur,
            banks: ["BNP Paribas", "Crédit Agricole", "Revolut"]
        )
        context.insert(settings)

        // Recurring templates
        let recurringItems: [RecurringExpense] = [
            RecurringExpense(title: "Loyer", amount: 1_200, category: .rent, isFixed: true,
                             bank: "BNP Paribas", person: .shared, frequency: .monthly, dayOfMonth: 1),
            RecurringExpense(title: "EDF", amount: 85, category: .electricity, isFixed: true,
                             bank: "BNP Paribas", person: .shared, frequency: .monthly, dayOfMonth: 10),
            RecurringExpense(title: "Free Mobile Sophie", amount: 19.99, category: .mobile, isFixed: true,
                             bank: "Crédit Agricole", person: .person1, frequency: .monthly, dayOfMonth: 5),
            RecurringExpense(title: "Free Mobile Thomas", amount: 19.99, category: .mobile, isFixed: true,
                             bank: "Crédit Agricole", person: .person2, frequency: .monthly, dayOfMonth: 5),
            RecurringExpense(title: "Netflix", amount: 17.99, category: .subscriptions, isFixed: false,
                             bank: "Revolut", person: .shared, frequency: .monthly, dayOfMonth: 15),
            RecurringExpense(title: "Spotify", amount: 9.99, category: .subscriptions, isFixed: false,
                             bank: "Revolut", person: .person1, frequency: .monthly, dayOfMonth: 12),
            RecurringExpense(title: "Mutuelle", amount: 95, category: .healthInsurance, isFixed: true,
                             bank: "BNP Paribas", person: .shared, frequency: .monthly, dayOfMonth: 1),
        ]
        recurringItems.forEach { context.insert($0) }

        // Expenses — last 6 months
        let months = generateExpenses()
        months.forEach { context.insert($0) }

        try? context.save()
    }

    private static func generateExpenses() -> [Expense] {
        var expenses: [Expense] = []
        let calendar = Calendar.current
        let now = Date()

        for monthOffset in 0..<6 {
            guard let monthDate = calendar.date(byAdding: .month, value: -monthOffset, to: now) else { continue }
            let year = calendar.component(.year, from: monthDate)
            let month = calendar.component(.month, from: monthDate)

            func date(_ day: Int) -> Date {
                var c = DateComponents()
                c.year = year; c.month = month; c.day = min(day, 28)
                return calendar.date(from: c) ?? now
            }

            // Fixed charges every month
            expenses += [
                Expense(title: "Loyer", amount: 1_200, amountInBase: 1_200, date: date(1),
                        category: .rent, isFixed: true, bank: "BNP Paribas", person: .shared),
                Expense(title: "EDF", amount: 85, amountInBase: 85, date: date(10),
                        category: .electricity, isFixed: true, bank: "BNP Paribas", person: .shared),
                Expense(title: "Free Mobile Sophie", amount: 19.99, amountInBase: 19.99, date: date(5),
                        category: .mobile, isFixed: true, bank: "Crédit Agricole", person: .person1),
                Expense(title: "Free Mobile Thomas", amount: 19.99, amountInBase: 19.99, date: date(5),
                        category: .mobile, isFixed: true, bank: "Crédit Agricole", person: .person2),
                Expense(title: "Netflix", amount: 17.99, amountInBase: 17.99, date: date(15),
                        category: .subscriptions, isFixed: false, bank: "Revolut", person: .shared),
                Expense(title: "Mutuelle", amount: 95, amountInBase: 95, date: date(1),
                        category: .healthInsurance, isFixed: true, bank: "BNP Paribas", person: .shared),
            ]

            // Variable charges
            expenses += [
                Expense(title: "Courses Lidl", amount: Double.random(in: 60...90), amountInBase: Double.random(in: 60...90), date: date(7),
                        category: .groceries, bank: "Crédit Agricole", person: .person1),
                Expense(title: "Courses Carrefour", amount: Double.random(in: 80...130), amountInBase: Double.random(in: 80...130), date: date(14),
                        category: .groceries, bank: "Crédit Agricole", person: .shared),
                Expense(title: "Carburant Total", amount: Double.random(in: 50...80), amountInBase: Double.random(in: 50...80), date: date(8),
                        category: .transport, bank: "BNP Paribas", person: .person2),
                Expense(title: "Pharmacie", amount: Double.random(in: 15...45), amountInBase: Double.random(in: 15...45), date: date(12),
                        category: .health, bank: "Crédit Agricole", person: .person1),
                Expense(title: "Restaurant La Cigale", amount: Double.random(in: 30...60), amountInBase: Double.random(in: 30...60), date: date(20),
                        category: .restaurants, bank: "Revolut", person: .shared),
            ]

            // Occasional
            if monthOffset == 0 {
                expenses += [
                    Expense(title: "Amazon commande", amount: 49.99, amountInBase: 49.99, date: date(18),
                            category: .other, bank: "Revolut", person: .person1),
                    Expense(title: "Zara vêtements", amount: 75, amountInBase: 75, date: date(22),
                            category: .clothing, bank: "Crédit Agricole", person: .person1),
                ]
            }
            if monthOffset == 1 {
                // USD expense
                let usdAmount = 45.0
                let eurAmount = CurrencyService.shared.convert(usdAmount, from: .usd, to: .eur)
                expenses.append(
                    Expense(title: "Airbnb Barcelone", amount: usdAmount, currency: .usd,
                            amountInBase: eurAmount, date: date(3), category: .travel, bank: "Revolut", person: .shared)
                )
            }
        }

        return expenses
    }
}
