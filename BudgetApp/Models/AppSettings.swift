import Foundation
import SwiftData

@Model
final class AppSettings {

    var person1Name: String
    var person2Name: String
    var baseCurrencyRawValue: String
    var banksData: Data

    init(
        person1Name: String = "Moi",
        person2Name: String = "Partenaire",
        baseCurrency: CurrencyCode = .eur,
        banks: [String] = ["BNP Paribas", "Société Générale"]
    ) {
        self.person1Name = person1Name
        self.person2Name = person2Name
        self.baseCurrencyRawValue = baseCurrency.rawValue
        self.banksData = (try? JSONEncoder().encode(banks)) ?? Data()
    }

    var baseCurrency: CurrencyCode {
        get { CurrencyCode(rawValue: baseCurrencyRawValue) ?? .eur }
        set { baseCurrencyRawValue = newValue.rawValue }
    }

    var banks: [String] {
        get { (try? JSONDecoder().decode([String].self, from: banksData)) ?? [] }
        set { banksData = (try? JSONEncoder().encode(newValue)) ?? Data() }
    }
}
