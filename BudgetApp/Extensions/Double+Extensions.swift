import Foundation

extension Double {

    func formatted(as currency: CurrencyCode) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        formatter.groupingSeparator = " "
        formatter.decimalSeparator = ","
        let str = formatter.string(from: NSNumber(value: self)) ?? String(format: "%.2f", self)
        return "\(str) \(currency.symbol)"
    }

    func formattedCompact(as currency: CurrencyCode) -> String {
        if self >= 1_000 {
            let k = self / 1_000
            return String(format: "%.1fk %@", k, currency.symbol)
        }
        return formatted(as: currency)
    }

    /// Percentage string like "42,5 %"
    func asPercentString(total: Double) -> String {
        guard total > 0 else { return "0 %" }
        let pct = (self / total) * 100
        return String(format: "%.1f %%", pct)
    }
}
