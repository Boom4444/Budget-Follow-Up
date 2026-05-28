import Foundation
import SwiftData

@Model
final class Expense {

    var id: UUID
    var title: String
    var amount: Double
    var currencyRawValue: String
    var amountInBase: Double
    var date: Date
    var categoryRawValue: String
    var isFixed: Bool
    var bank: String
    var personRawValue: String
    var notes: String
    var recurringExpenseID: UUID?

    init(
        id: UUID = UUID(),
        title: String,
        amount: Double,
        currency: CurrencyCode = .eur,
        amountInBase: Double,
        date: Date = Date(),
        category: ExpenseCategory,
        isFixed: Bool = false,
        bank: String = "",
        person: HouseholdMember = .person1,
        notes: String = "",
        recurringExpenseID: UUID? = nil
    ) {
        self.id = id
        self.title = title
        self.amount = amount
        self.currencyRawValue = currency.rawValue
        self.amountInBase = amountInBase
        self.date = date
        self.categoryRawValue = category.rawValue
        self.isFixed = isFixed
        self.bank = bank
        self.personRawValue = person.rawValue
        self.notes = notes
        self.recurringExpenseID = recurringExpenseID
    }

    // MARK: - Computed helpers

    var currency: CurrencyCode {
        CurrencyCode(rawValue: currencyRawValue) ?? .eur
    }

    var category: ExpenseCategory {
        ExpenseCategory(rawValue: categoryRawValue) ?? .other
    }

    var person: HouseholdMember {
        HouseholdMember(rawValue: personRawValue) ?? .person1
    }

    var formattedAmount: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        let str = formatter.string(from: NSNumber(value: amount)) ?? "\(amount)"
        return "\(str) \(currency.symbol)"
    }
}
