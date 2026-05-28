import SwiftUI
import SwiftData

struct ExpenseListView: View {

    @Environment(\.modelContext) private var context
    @Query(sort: \Expense.date, order: .reverse) private var allExpenses: [Expense]
    @Query private var settingsQuery: [AppSettings]

    @State private var vm = ExpenseListViewModel()
    @State private var showAddExpense = false
    @State private var showFilters = false

    private var settings: AppSettings { settingsQuery.first ?? AppSettings() }

    private var grouped: [ExpenseListViewModel.GroupedExpenses] {
        vm.grouped(allExpenses)
    }

    private var totalFiltered: Double {
        vm.filtered(allExpenses).reduce(0) { $0 + $1.amountInBase }
    }

    var body: some View {
        @Bindable var bvm = vm
        NavigationStack {
            VStack(spacing: 0) {
                periodPicker
                    .padding(.horizontal)
                    .padding(.bottom, 8)

                if grouped.isEmpty {
                    emptyState
                } else {
                    List {
                        totalHeader
                        ForEach(grouped) { group in
                            Section {
                                ForEach(group.expenses) { expense in
                                    ExpenseRowView(
                                        expense: expense,
                                        settings: settings,
                                        baseCurrency: settings.baseCurrency
                                    )
                                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                        Button(role: .destructive) {
                                            delete(expense)
                                        } label: {
                                            Label("Supprimer", systemImage: "trash")
                                        }
                                    }
                                }
                            } header: {
                                HStack {
                                    Text(group.title)
                                        .font(.subheadline.weight(.semibold))
                                    Spacer()
                                    Text(group.total.formatted(as: settings.baseCurrency))
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Dépenses")
            .searchable(text: $bvm.searchText, prompt: "Rechercher…")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        showFilters = true
                    } label: {
                        Image(systemName: hasActiveFilters
                              ? "line.3.horizontal.decrease.circle.fill"
                              : "line.3.horizontal.decrease.circle")
                    }
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
            .sheet(isPresented: $showFilters) {
                filtersSheet
            }
        }
    }

    // MARK: - Period picker

    @ViewBuilder
    private var periodPicker: some View {
        HStack(spacing: 8) {
            Menu {
                ForEach((2020...Calendar.current.component(.year, from: Date())).reversed(), id: \.self) { year in
                    Button("\(year)") { vm.selectedYear = year }
                }
            } label: {
                HStack(spacing: 4) {
                    Text("\(vm.selectedYear)")
                        .font(.subheadline.weight(.semibold))
                    Image(systemName: "chevron.down")
                        .font(.caption2)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(.quaternary, in: Capsule())
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    monthChip(label: "Tout", month: nil)
                    ForEach(1...12, id: \.self) { month in
                        monthChip(
                            label: Date.from(year: vm.selectedYear, month: month).shortMonthString,
                            month: month
                        )
                    }
                }
                .padding(.horizontal, 2)
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
                .font(.caption.weight(selected ? .semibold : .regular))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(selected ? Color.blue : Color.clear, in: Capsule())
                .overlay(Capsule().stroke(selected ? Color.clear : Color.secondary.opacity(0.3)))
                .foregroundStyle(selected ? .white : .primary)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Total header

    @ViewBuilder
    private var totalHeader: some View {
        Section {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Total période")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(totalFiltered.formatted(as: settings.baseCurrency))
                        .font(.title2.bold())
                        .monospacedDigit()
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(vm.filtered(allExpenses).count) dépenses")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Menu {
                        ForEach(ExpenseListViewModel.SortOrder.allCases) { order in
                            Button {
                                vm.sortOrder = order
                            } label: {
                                HStack {
                                    Text(order.rawValue)
                                    if vm.sortOrder == order {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    } label: {
                        Label("Tri", systemImage: "arrow.up.arrow.down")
                            .font(.caption)
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }

    // MARK: - Empty state

    @ViewBuilder
    private var emptyState: some View {
        ContentUnavailableView {
            Label("Aucune dépense", systemImage: "tray")
        } description: {
            Text("Ajoutez votre première dépense via le bouton +")
        } actions: {
            Button("Ajouter une dépense") {
                showAddExpense = true
            }
            .buttonStyle(.bordered)
        }
        .frame(maxHeight: .infinity)
    }

    // MARK: - Filters sheet

    @ViewBuilder
    private var filtersSheet: some View {
        @Bindable var bvm = vm
        NavigationStack {
            Form {
                Section("Personne") {
                    Picker("Personne", selection: $bvm.filterPerson) {
                        Text("Toutes").tag(Optional<HouseholdMember>.none)
                        ForEach(HouseholdMember.allCases) { member in
                            Text(member.displayName(settings: settings)).tag(Optional(member))
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }

                Section("Type de charge") {
                    Picker("Type", selection: $bvm.filterFixedOnly) {
                        Text("Toutes").tag(Optional<Bool>.none)
                        Text("Incompressibles").tag(Optional(true))
                        Text("Variables").tag(Optional(false))
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }

                Section("Catégorie") {
                    Picker("Catégorie", selection: $bvm.filterCategory) {
                        Text("Toutes").tag(Optional<ExpenseCategory>.none)
                        ForEach(ExpenseCategory.allCases) { cat in
                            Label(cat.rawValue, systemImage: cat.icon).tag(Optional(cat))
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }
            }
            .navigationTitle("Filtres")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Réinitialiser") {
                        vm.filterCategory = nil
                        vm.filterPerson = nil
                        vm.filterFixedOnly = nil
                    }
                    .foregroundStyle(.red)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("OK") { showFilters = false }
                        .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.large])
    }

    // MARK: - Helpers

    private var hasActiveFilters: Bool {
        vm.filterCategory != nil || vm.filterPerson != nil || vm.filterFixedOnly != nil
    }

    private func delete(_ expense: Expense) {
        context.delete(expense)
        try? context.save()
    }
}
