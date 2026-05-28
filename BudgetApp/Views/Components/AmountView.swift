import SwiftUI

struct AmountView: View {
    let amount: Double
    let currency: CurrencyCode
    var style: Style = .standard
    var color: Color = .primary

    enum Style {
        case standard
        case large
        case compact
    }

    var body: some View {
        Text(formattedString)
            .font(font)
            .foregroundStyle(color)
            .monospacedDigit()
    }

    private var formattedString: String {
        switch style {
        case .compact: return amount.formattedCompact(as: currency)
        default:       return amount.formatted(as: currency)
        }
    }

    private var font: Font {
        switch style {
        case .large:   return .title.bold()
        case .standard: return .body.weight(.semibold)
        case .compact: return .callout.weight(.medium)
        }
    }
}

struct AmountBadge: View {
    let amount: Double
    let currency: CurrencyCode
    var backgroundColor: Color = .blue.opacity(0.12)

    var body: some View {
        AmountView(amount: amount, currency: currency, style: .compact)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(backgroundColor, in: Capsule())
    }
}
