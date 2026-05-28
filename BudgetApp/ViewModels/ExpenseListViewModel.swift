import Foundation
import SwiftUI

@Observable
final class ExpenseListViewModel {

    var searchText: String = ""
    var filterCategory: ExpenseCategory? = nil
    var filterPerson: HouseholdMember? = nil
    var filterFixedOnly: Bool? = nil        // nil = all, true = fixed, false = variable
    var selectedYear: Int = Calendar.current.component(.year, from: Date())
    var selectedMonth: Int? = Calendar.current.component(.month, from: Date())
    var sortOrder: SortOrder = .dateDescending

    enum SortOrder: String, CaseIterable, Identifiable {
        case dateDescending  = "Date (récent)"
        case dateAscending   = "Date (ancien)"
        case amountDescending = "Montant (haut)"
        case amountAscending  = "Montant (bas)"
        case category         = "Catégorie"

        var id: String { rawValue }
    }

    struct GroupedExpenses: Identifiable {
        let id: String
        let title: String
        let date: Date
        var expenses: [Expense]
        var total: Double { expenses.reduce(0) { $0 + $1.amountInBase } }
    }

    func filtered(_ expenses: [Expense]) -> [Expense] {
        expenses
            .filter { expense in
                // Year filter
                guard expense.date.year == selectedYear else { return false }

                // Month filter
                if let month = selectedMonth {
                    guard expense.date.month == month else { return false }
                }

                // Category filter
                if let category = filterCategory {
                    guard expense.category == category else { return false }
                }

                // Person filter
                if let person = filterPerson {
                    guard expense.person == person else { return false }
                }

                // Fixed/variable filter
                if let fixed = filterFixedOnly {
                    guard expense.isFixed == fixed else { return false }
                }

                // Search
                if !searchText.isEmpty {
                    let q = searchText.lowercased()
                    guard expense.title.lowercased().contains(q)
                        || expense.bank.lowercased().contains(q)
                        || expense.category.rawValue.lowercased().contains(q)
                    else { return false }
                }

                return true
            }
            .sorted(by: sortComparator)
    }

    func grouped(_ expenses: [Expense]) -> [GroupedExpenses] {
        let sorted = filtered(expenses)
        let dict = Dictionary(grouping: sorted) { expense -> String in
            expense.date.shortMonthYearString
        }
        return dict.map { key, items in
            let date = items.first?.date ?? Date()
            return GroupedExpenses(id: key, title: key, date: date, expenses: items)
        }.sorted { $0.date > $1.date }
    }

    private var sortComparator: (Expense, Expense) -> Bool {
        switch sortOrder {
        case .dateDescending:   return { $0.date > $1.date }
        case .dateAscending:    return { $0.date < $1.date }
        case .amountDescending: return { $0.amountInBase > $1.amountInBase }
        case .amountAscending:  return { $0.amountInBase < $1.amountInBase }
        case .category:         return { $0.categoryRawValue < $1.categoryRawValue }
        }
    }
}
