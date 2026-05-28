import Foundation

/// Offline approximate rates relative to EUR. In production these would be
/// fetched from an exchange-rate API and cached.
final class CurrencyService {

    static let shared = CurrencyService()

    // Rates: 1 EUR = X foreign currency
    private var rates: [String: Double] = [
        "EUR": 1.0,
        "USD": 1.08,
        "GBP": 0.86,
        "CHF": 0.96,
        "MAD": 10.85,
        "DZD": 145.20,
        "TND": 3.35,
        "JPY": 162.50,
        "CAD": 1.47,
        "AUD": 1.65,
        "SGD": 1.45,
        "AED": 3.97
    ]

    private init() {}

    /// Converts `amount` from `from` currency to `to` currency.
    func convert(_ amount: Double, from: CurrencyCode, to: CurrencyCode) -> Double {
        guard from != to else { return amount }
        let fromRate = rates[from.rawValue] ?? 1.0
        let toRate   = rates[to.rawValue]   ?? 1.0
        let eur = amount / fromRate
        return eur * toRate
    }

    /// Converts any amount to the base EUR value.
    func toEUR(_ amount: Double, currency: CurrencyCode) -> Double {
        let rate = rates[currency.rawValue] ?? 1.0
        return amount / rate
    }

    func updateRate(for currency: CurrencyCode, rate: Double) {
        rates[currency.rawValue] = rate
    }

    func formattedRate(for currency: CurrencyCode, base: CurrencyCode = .eur) -> String {
        let rate = convert(1.0, from: base, to: currency)
        return String(format: "1 %@ = %.4f %@", base.rawValue, rate, currency.rawValue)
    }
}
