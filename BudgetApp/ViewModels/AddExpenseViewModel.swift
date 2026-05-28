import Foundation
import SwiftUI

@Observable
final class AddExpenseViewModel {

    // MARK: - Form fields

    var title: String = ""
    var amountText: String = ""
    var currency: CurrencyCode = .eur
    var date: Date = Date()
    var category: ExpenseCategory = .other
    var isFixed: Bool = false
    var bank: String = ""
    var person: HouseholdMember = .person1
    var notes: String = ""

    // MARK: - Suggestion state

    var suggestedRecurring: [RecurringExpense] = []
    var recentTitles: [String] = []
    var showRecurringSuggestions: Bool = false

    // MARK: - Validation

    var amount: Double? {
        let cleaned = amountText
            .replacingOccurrences(of: ",", with: ".")
            .trimmingCharacters(in: .whitespaces)
        return Double(cleaned)
    }

    var isValid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty && amount != nil
    }

    // MARK: - Suggestions

    func updateSuggestions(allExpenses: [Expense], allRecurring: [RecurringExpense]) {
        let q = title.lowercased()

        if q.isEmpty {
            // Show most frequently used titles
            let counts = Dictionary(grouping: allExpenses, by: { $0.title.lowercased() })
            recentTitles = counts
                .sorted { $0.value.count > $1.value.count }
                .prefix(5)
                .map { $0.value.first?.title ?? $0.key }
        } else {
            // Filter by typed text
            let matching = allExpenses
                .filter { $0.title.lowercased().contains(q) }
                .map(\.title)
            let unique = Array(NSOrderedSet(array: matching)) as? [String] ?? []
            recentTitles = Array(unique.prefix(5))
        }

        // Recurring suggestions matching current text
        suggestedRecurring = allRecurring.filter { recurring in
            q.isEmpty || recurring.title.lowercased().contains(q)
        }

        showRecurringSuggestions = !suggestedRecurring.isEmpty || !recentTitles.isEmpty
    }

    func applyRecurring(_ recurring: RecurringExpense) {
        title    = recurring.title
        amountText = String(format: "%.2f", recurring.amount)
        currency = recurring.currency
        category = recurring.category
        isFixed  = recurring.isFixed
        bank     = recurring.bank
        person   = recurring.person
        showRecurringSuggestions = false
    }

    func buildExpense(baseCurrency: CurrencyCode) -> Expense? {
        guard let amt = amount else { return nil }
        let baseAmount = CurrencyService.shared.convert(amt, from: currency, to: baseCurrency)
        return Expense(
            title: title.trimmingCharacters(in: .whitespaces),
            amount: amt,
            currency: currency,
            amountInBase: baseAmount,
            date: date,
            category: category,
            isFixed: isFixed,
            bank: bank,
            person: person,
            notes: notes
        )
    }

    func buildRecurringTemplate(frequency: RecurrenceFrequency, dayOfMonth: Int) -> RecurringExpense? {
        guard let amt = amount, !title.isEmpty else { return nil }
        return RecurringExpense(
            title: title,
            amount: amt,
            currency: currency,
            category: category,
            isFixed: isFixed,
            bank: bank,
            person: person,
            frequency: frequency,
            dayOfMonth: dayOfMonth
        )
    }

    func reset() {
        title = ""
        amountText = ""
        currency = .eur
        date = Date()
        category = .other
        isFixed = false
        bank = ""
        person = .person1
        notes = ""
        showRecurringSuggestions = false
        recentTitles = []
        suggestedRecurring = []
    }
}
