import SwiftUI
import Charts

struct MonthlyTrendView: View {
    let summaries: [DashboardViewModel.MonthlySummary]
    let baseCurrency: CurrencyCode

    @State private var selectedMonth: DashboardViewModel.MonthlySummary?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Évolution mensuelle")
                    .font(.headline)
                if let sel = selectedMonth {
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(sel.label)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(sel.total.formatted(as: baseCurrency))
                            .font(.callout.bold())
                            .monospacedDigit()
                    }
                }
            }
            .padding(.horizontal)

            Chart(summaries) { summary in
                BarMark(
                    x: .value("Mois", summary.label),
                    y: .value("Incompressible", summary.fixedTotal)
                )
                .foregroundStyle(Color.red.opacity(0.75))
                .cornerRadius(3)

                BarMark(
                    x: .value("Mois", summary.label),
                    y: .value("Variable", summary.variableTotal)
                )
                .foregroundStyle(Color.blue.opacity(0.75))
                .cornerRadius(3)

                if let sel = selectedMonth, sel.month == summary.month {
                    RuleMark(x: .value("Mois", summary.label))
                        .foregroundStyle(.primary.opacity(0.3))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4]))
                }
            }
            .chartXAxis {
                AxisMarks(values: .automatic) {
                    AxisValueLabel()
                        .font(.caption2)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading) {
                    AxisValueLabel()
                        .font(.caption2)
                }
            }
            .chartOverlay { proxy in
                GeometryReader { geo in
                    Rectangle().fill(.clear).contentShape(Rectangle())
                        .onTapGesture { location in
                            guard let label: String = proxy.value(atX: location.x) else { return }
                            selectedMonth = summaries.first { $0.label == label }
                        }
                }
            }
            .frame(height: 200)
            .padding(.horizontal)

            // Legend
            HStack(spacing: 16) {
                Label("Incompressible", systemImage: "square.fill")
                    .font(.caption)
                    .foregroundStyle(.red.opacity(0.75))
                Label("Variable", systemImage: "square.fill")
                    .font(.caption)
                    .foregroundStyle(.blue.opacity(0.75))
            }
            .padding(.horizontal)
        }
    }
}
