import SwiftUI
import SwiftData

struct DashboardView: View {

    @Query(sort: \Expense.date, order: .reverse) private var allExpenses: [Expense]
    @Query private var settingsQuery: [AppSettings]

    @State private var vm = DashboardViewModel()
    @State private var showAddExpense = false

    private var settings: AppSettings { settingsQuery.first ?? AppSettings() }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    periodPickerSection

                    YearSummaryView(
                        vm: vm,
                        baseCurrency: settings.baseCurrency,
                        settings: settings
                    )

                    if !vm.monthlySummaries.allSatisfy({ $0.total == 0 }) {
                        MonthlyTrendView(
                            summaries: vm.monthlySummaries,
                            baseCurrency: settings.baseCurrency
                        )
                        .padding(.top, 4)
                    }

                    if !vm.categorySummaries.isEmpty {
                        CategoryBreakdownView(
                            summaries: vm.categorySummaries,
                            total: vm.totalYear,
                            baseCurrency: settings.baseCurrency
                        )
                    }

                    if allExpenses.isEmpty {
                        emptyState
                    }

                    Spacer(minLength: 40)
                }
                .padding(.top, 8)
            }
            .navigationTitle("Tableau de bord")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    personFilterMenu
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showAddExpense = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                    }
                }
            }
            .sheet(isPresented: $showAddExpense) {
                AddExpenseView()
            }
            .onChange(of: allExpenses) { _, _ in recompute() }
            .onChange(of: vm.selectedYear) { _, _ in recompute() }
            .onChange(of: vm.selectedMonth) { _, _ in recompute() }
            .onChange(of: vm.filterPerson) { _, _ in recompute() }
            .onAppear { recompute() }
        }
    }

    // MARK: - Sub-views

    @ViewBuilder
    private var periodPickerSection: some View {
        VStack(spacing: 10) {
            // Year picker
            HStack {
                Button {
                    vm.selectedYear -= 1
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.subheadline.weight(.semibold))
                }

                Spacer()

                Text("\(vm.selectedYear)")
                    .font(.title3.weight(.bold))

                Spacer()

                Button {
                    let now = Calendar.current.component(.year, from: Date())
                    if vm.selectedYear < now {
                        vm.selectedYear += 1
                    }
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.subheadline.weight(.semibold))
                }
            }
            .padding(.horizontal, 20)

            // Month chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    monthChip(label: "Année", month: nil)
                    ForEach(1...12, id: \.self) { month in
                        monthChip(
                            label: Date.from(year: vm.selectedYear, month: month).shortMonthString,
                            month: month
                        )
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    @ViewBuilder
    private func monthChip(label: String, month: Int?) -> some View {
        let selected = vm.selectedMonth == month
        Button {
            vm.selectedMonth = month
        } label: {
            Text(label)
                .font(.callout.weight(selected ? .semibold : .regular))
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(selected ? Color.blue : Color.clear, in: Capsule())
                .overlay(Capsule().stroke(selected ? Color.clear : Color.secondary.opacity(0.25)))
                .foregroundStyle(selected ? .white : .primary)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var personFilterMenu: some View {
        Menu {
            Button {
                vm.filterPerson = nil
            } label: {
                HStack {
                    Text("Tout le foyer")
                    if vm.filterPerson == nil {
                        Image(systemName: "checkmark")
                    }
                }
            }

            Divider()

            ForEach(HouseholdMember.allCases) { member in
                Button {
                    vm.filterPerson = member
                } label: {
                    HStack {
                        Text(member.displayName(settings: settings))
                        if vm.filterPerson == member {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            Label(
                vm.filterPerson?.displayName(settings: settings) ?? "Foyer",
                systemImage: vm.filterPerson == nil ? "person.2.fill" : "person.fill"
            )
            .font(.callout)
        }
    }

    @ViewBuilder
    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "chart.pie")
                .font(.system(size: 48))
                .foregroundStyle(.quaternary)
            Text("Commencez à saisir vos dépenses")
                .font(.headline)
                .foregroundStyle(.secondary)
            Button("Ajouter une dépense") {
                showAddExpense = true
            }
            .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    // MARK: - Helpers

    private func recompute() {
        vm.recompute(expenses: allExpenses)
    }
}
