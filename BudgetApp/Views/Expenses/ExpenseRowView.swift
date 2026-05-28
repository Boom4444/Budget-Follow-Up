import SwiftUI

struct ExpenseRowView: View {
    let expense: Expense
    let settings: AppSettings
    let baseCurrency: CurrencyCode

    var body: some View {
        HStack(spacing: 12) {
            // Category icon
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(expense.category.color.opacity(0.15))
                    .frame(width: 42, height: 42)
                Image(systemName: expense.category.icon)
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(expense.category.color)
            }

            // Title & meta
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(expense.title)
                        .font(.callout.weight(.medium))
                        .lineLimit(1)

                    if expense.isFixed {
                        Image(systemName: "lock.fill")
                            .font(.caption2)
                            .foregroundStyle(.red.opacity(0.8))
                    }
                }

                HStack(spacing: 6) {
                    Text(expense.category.rawValue)
                        .font(.caption)
                        .foregroundStyle(expense.category.color)
                        .lineLimit(1)

                    if expense.person != .shared {
                        Text("·")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                        Text(expense.person.displayName(settings: settings))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    if !expense.bank.isEmpty {
                        Text("·")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                        Text(expense.bank)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }

            Spacer()

            // Amount
            VStack(alignment: .trailing, spacing: 2) {
                Text(expense.amount.formatted(as: expense.currency))
                    .font(.callout.weight(.semibold))
                    .monospacedDigit()

                if expense.currency != baseCurrency {
                    Text(expense.amountInBase.formatted(as: baseCurrency))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }

                Text(expense.date, style: .date)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 4)
    }
}
