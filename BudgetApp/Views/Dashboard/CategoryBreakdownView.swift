import SwiftUI
import Charts

struct CategoryBreakdownView: View {
    let summaries: [DashboardViewModel.CategorySummary]
    let total: Double
    let baseCurrency: CurrencyCode

    @State private var selectedCategory: ExpenseCategory?

    private var displayedSummaries: [DashboardViewModel.CategorySummary] {
        Array(summaries.prefix(8))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Répartition par catégorie")
                .font(.headline)
                .padding(.horizontal)

            pieChart
                .frame(height: 230)
                .padding(.horizontal)

            legendList
                .padding(.horizontal)
        }
    }

    @ViewBuilder
    private var pieChart: some View {
        Chart(displayedSummaries) { summary in
            SectorMark(
                angle: .value("Montant", summary.total),
                innerRadius: .ratio(0.56),
                outerRadius: selectedCategory == summary.category ? .ratio(0.97) : .ratio(0.89),
                angularInset: 1.5
            )
            .foregroundStyle(summary.category.color)
            .opacity(selectedCategory == nil || selectedCategory == summary.category ? 1 : 0.35)
            .cornerRadius(4)
        }
        .overlay {
            if let sel = selectedCategory,
               let summary = summaries.first(where: { $0.category == sel }) {
                VStack(spacing: 2) {
                    Image(systemName: sel.icon)
                        .font(.title3)
                        .foregroundStyle(sel.color)
                    Text(summary.total.formatted(as: baseCurrency))
                        .font(.callout.bold())
                        .monospacedDigit()
                    Text(summary.total.asPercentString(total: total))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else {
                VStack(spacing: 2) {
                    Text("Total")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(total.formatted(as: baseCurrency))
                        .font(.callout.bold())
                        .monospacedDigit()
                }
            }
        }
    }

    @ViewBuilder
    private var legendList: some View {
        VStack(spacing: 0) {
            ForEach(displayedSummaries) { summary in
                Button {
                    selectedCategory = selectedCategory == summary.category ? nil : summary.category
                } label: {
                    HStack(spacing: 10) {
                        Circle()
                            .fill(summary.category.color)
                            .frame(width: 10, height: 10)

                        Image(systemName: summary.category.icon)
                            .font(.caption)
                            .foregroundStyle(summary.category.color)
                            .frame(width: 16)

                        Text(summary.category.rawValue)
                            .font(.callout)
                            .foregroundStyle(.primary)
                            .lineLimit(1)

                        if summary.category.isFixed {
                            Image(systemName: "lock.fill")
                                .font(.caption2)
                                .foregroundStyle(.red.opacity(0.7))
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 1) {
                            Text(summary.total.formatted(as: baseCurrency))
                                .font(.callout.weight(.medium))
                                .monospacedDigit()
                            Text(summary.total.asPercentString(total: total))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(
                        selectedCategory == summary.category
                            ? summary.category.color.opacity(0.08)
                            : Color.clear
                    )
                }
                .buttonStyle(.plain)

                if summary.id != displayedSummaries.last?.id {
                    Divider().padding(.leading, 48)
                }
            }
        }
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 14))
    }
}
