import SwiftUI

struct YearSummaryView: View {
    let vm: DashboardViewModel
    let baseCurrency: CurrencyCode
    let settings: AppSettings

    var body: some View {
        VStack(spacing: 12) {
            // Main total card
            totalCard

            // Fixed vs Variable
            HStack(spacing: 12) {
                summaryCard(
                    title: "Incompressible",
                    amount: vm.totalFixed,
                    icon: "lock.fill",
                    color: .red
                )
                summaryCard(
                    title: "Variable",
                    amount: vm.totalVariable,
                    icon: "arrow.up.arrow.down",
                    color: .blue
                )
            }

            // Per-person
            HStack(spacing: 12) {
                summaryCard(
                    title: settings.person1Name,
                    amount: vm.totalPerson1,
                    icon: "person.fill",
                    color: .purple
                )
                summaryCard(
                    title: settings.person2Name,
                    amount: vm.totalPerson2,
                    icon: "person.fill",
                    color: .orange
                )
            }

            if vm.totalShared > 0 {
                summaryCard(
                    title: "Commun",
                    amount: vm.totalShared,
                    icon: "person.2.fill",
                    color: .green
                )
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal)
    }

    @ViewBuilder
    private var totalCard: some View {
        VStack(spacing: 4) {
            Text("Total \(vm.selectedMonth == nil ? "\(vm.selectedYear)" : Date.from(year: vm.selectedYear, month: vm.selectedMonth ?? 1).monthYearString)")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Text(vm.totalYear.formatted(as: baseCurrency))
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .monospacedDigit()

            if vm.totalYear > 0 {
                HStack(spacing: 12) {
                    Label(
                        "\(vm.totalFixed.asPercentString(total: vm.totalYear)) fixe",
                        systemImage: "lock.fill"
                    )
                    .font(.caption)
                    .foregroundStyle(.red)

                    Label(
                        "\(vm.totalVariable.asPercentString(total: vm.totalYear)) variable",
                        systemImage: "arrow.up.arrow.down"
                    )
                    .font(.caption)
                    .foregroundStyle(.blue)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder
    private func summaryCard(title: String, amount: Double, icon: String, color: Color) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(color)
                .font(.subheadline)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Text(amount.formatted(as: baseCurrency))
                    .font(.callout.weight(.semibold))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }
}
