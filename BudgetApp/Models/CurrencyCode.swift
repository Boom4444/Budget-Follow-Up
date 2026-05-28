import Foundation

enum CurrencyCode: String, CaseIterable, Codable, Identifiable {
    case eur = "EUR"
    case usd = "USD"
    case gbp = "GBP"
    case chf = "CHF"
    case mad = "MAD"
    case dzd = "DZD"
    case tnd = "TND"
    case jpy = "JPY"
    case cad = "CAD"
    case aud = "AUD"
    case sgd = "SGD"
    case aed = "AED"

    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .eur: return "€"
        case .usd: return "$"
        case .gbp: return "£"
        case .chf: return "Fr"
        case .mad: return "د.م."
        case .dzd: return "دج"
        case .tnd: return "DT"
        case .jpy: return "¥"
        case .cad: return "CA$"
        case .aud: return "A$"
        case .sgd: return "S$"
        case .aed: return "د.إ"
        }
    }

    var flag: String {
        switch self {
        case .eur: return "🇪🇺"
        case .usd: return "🇺🇸"
        case .gbp: return "🇬🇧"
        case .chf: return "🇨🇭"
        case .mad: return "🇲🇦"
        case .dzd: return "🇩🇿"
        case .tnd: return "🇹🇳"
        case .jpy: return "🇯🇵"
        case .cad: return "🇨🇦"
        case .aud: return "🇦🇺"
        case .sgd: return "🇸🇬"
        case .aed: return "🇦🇪"
        }
    }

    var name: String {
        switch self {
        case .eur: return "Euro"
        case .usd: return "Dollar américain"
        case .gbp: return "Livre sterling"
        case .chf: return "Franc suisse"
        case .mad: return "Dirham marocain"
        case .dzd: return "Dinar algérien"
        case .tnd: return "Dinar tunisien"
        case .jpy: return "Yen japonais"
        case .cad: return "Dollar canadien"
        case .aud: return "Dollar australien"
        case .sgd: return "Dollar de Singapour"
        case .aed: return "Dirham des EAU"
        }
    }

    var displayName: String { "\(flag) \(rawValue) – \(name)" }
}
