import Foundation
import SwiftData

@Model
final class RecurringExpense {

    var id: UUID
    var title: String
    var amount: Double
    var currencyRawValue: String
    var categoryRawValue: String
    var isFixed: Bool
    var bank: String
    var personRawValue: String
    var frequencyRawValue: String
    var dayOfMonth: Int
    var lastUsedDate: Date?
    var usageCount: Int

    init(
        id: UUID = UUID(),
        title: String,
        amount: Double,
        currency: CurrencyCode = .eur,
        category: ExpenseCategory,
        isFixed: Bool = false,
        bank: String = "",
        person: HouseholdMember = .person1,
        frequency: RecurrenceFrequency = .monthly,
        dayOfMonth: Int = 1,
        lastUsedDate: Date? = nil,
        usageCount: Int = 0
    ) {
        self.id = id
        self.title = title
        self.amount = amount
        self.currencyRawValue = currency.rawValue
        self.categoryRawValue = category.rawValue
        self.isFixed = isFixed
        self.bank = bank
        self.personRawValue = person.rawValue
        self.frequencyRawValue = frequency.rawValue
        self.dayOfMonth = dayOfMonth
        self.lastUsedDate = lastUsedDate
        self.usageCount = usageCount
    }

    var currency: CurrencyCode {
        CurrencyCode(rawValue: currencyRawValue) ?? .eur
    }

    var category: ExpenseCategory {
        ExpenseCategory(rawValue: categoryRawValue) ?? .other
    }

    var person: HouseholdMember {
        HouseholdMember(rawValue: personRawValue) ?? .person1
    }

    var frequency: RecurrenceFrequency {
        RecurrenceFrequency(rawValue: frequencyRawValue) ?? .monthly
    }
}

enum RecurrenceFrequency: String, CaseIterable, Codable, Identifiable {
    case weekly     = "Hebdomadaire"
    case biweekly   = "Bi-mensuel"
    case monthly    = "Mensuel"
    case quarterly  = "Trimestriel"
    case yearly     = "Annuel"

    var id: String { rawValue }

    var shortLabel: String {
        switch self {
        case .weekly:    return "/ sem."
        case .biweekly:  return "/ 2 sem."
        case .monthly:   return "/ mois"
        case .quarterly: return "/ trim."
        case .yearly:    return "/ an"
        }
    }

    var monthlyMultiplier: Double {
        switch self {
        case .weekly:    return 52.0 / 12.0
        case .biweekly:  return 26.0 / 12.0
        case .monthly:   return 1.0
        case .quarterly: return 1.0 / 3.0
        case .yearly:    return 1.0 / 12.0
        }
    }
}
