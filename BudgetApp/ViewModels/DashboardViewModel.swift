import Foundation
import SwiftUI
import Combine

@Observable
final class DashboardViewModel {

    // MARK: - Published state

    var selectedYear: Int = Calendar.current.component(.year, from: Date())
    var selectedMonth: Int? = nil      // nil = all year
    var filterPerson: HouseholdMember? = nil

    // MARK: - Derived from expenses

    struct MonthlySummary: Identifiable {
        let id = UUID()
        let month: Int
        let year: Int
        let total: Double
        let fixedTotal: Double
        let variableTotal: Double

        var label: String {
            Date.from(year: year, month: month).shortMonthString
        }
    }

    struct CategorySummary: Identifiable {
        let id = UUID()
        let category: ExpenseCategory
        let total: Double
        let count: Int
    }

    private(set) var monthlySummaries: [MonthlySummary] = []
    private(set) var categorySummaries: [CategorySummary] = []
    private(set) var totalYear: Double = 0
    private(set) var totalFixed: Double = 0
    private(set) var totalVariable: Double = 0
    private(set) var totalPerson1: Double = 0
    private(set) var totalPerson2: Double = 0
    private(set) var totalShared: Double = 0

    // MARK: - Computation

    func recompute(expenses: [Expense]) {
        let filtered = expenses.filter { expense in
            guard expense.date.year == selectedYear else { return false }
            if let month = selectedMonth {
                guard expense.date.month == month else { return false }
            }
            if let person = filterPerson {
                guard expense.person == person else { return false }
            }
            return true
        }

        totalYear     = filtered.reduce(0) { $0 + $1.amountInBase }
        totalFixed    = filtered.filter(\.isFixed).reduce(0) { $0 + $1.amountInBase }
        totalVariable = filtered.filter { !$0.isFixed }.reduce(0) { $0 + $1.amountInBase }
        totalPerson1  = filtered.filter { $0.person == .person1 }.reduce(0) { $0 + $1.amountInBase }
        totalPerson2  = filtered.filter { $0.person == .person2 }.reduce(0) { $0 + $1.amountInBase }
        totalShared   = filtered.filter { $0.person == .shared }.reduce(0) { $0 + $1.amountInBase }

        // Monthly summaries (all 12 months)
        monthlySummaries = (1...12).map { month in
            let monthExpenses = filtered.filter { $0.date.month == month }
            return MonthlySummary(
                month: month,
                year: selectedYear,
                total: monthExpenses.reduce(0) { $0 + $1.amountInBase },
                fixedTotal: monthExpenses.filter(\.isFixed).reduce(0) { $0 + $1.amountInBase },
                variableTotal: monthExpenses.filter { !$0.isFixed }.reduce(0) { $0 + $1.amountInBase }
            )
        }

        // Category summaries sorted by total descending
        let grouped = Dictionary(grouping: filtered, by: \.categoryRawValue)
        categorySummaries = grouped.compactMap { rawValue, items -> CategorySummary? in
            guard let category = ExpenseCategory(rawValue: rawValue) else { return nil }
            return CategorySummary(
                category: category,
                total: items.reduce(0) { $0 + $1.amountInBase },
                count: items.count
            )
        }.sorted { $0.total > $1.total }
    }
}
