import SwiftUI
import SwiftData

struct AddExpenseView: View {

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query private var allExpenses: [Expense]
    @Query private var allRecurring: [RecurringExpense]
    @Query private var settingsQuery: [AppSettings]

    @State private var vm = AddExpenseViewModel()
    @State private var showCategoryPicker = false
    @State private var showSaveAsRecurring = false
    @State private var recurringFrequency: RecurrenceFrequency = .monthly
    @State private var recurringDay: Int = 1

    private var settings: AppSettings { settingsQuery.first ?? AppSettings() }
    private var baseCurrency: CurrencyCode { settings.baseCurrency }

    var body: some View {
        @Bindable var bvm = vm
        NavigationStack {
            Form {
                if bvm.showRecurringSuggestions {
                    suggestionsSection
                }
                Section("Description") {
                    TextField("Ex: Loyer octobre, Courses Lidl…", text: $bvm.title)
                        .textInputAutocapitalization(.sentences)
                }
                amountSection(bvm: $bvm)
                categorySection
                Section {
                    Toggle(isOn: $bvm.isFixed) {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Charge incompressible")
                                    .font(.callout)
                                Text("Loyer, assurance, électricité…")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "lock.fill")
                                .foregroundStyle(bvm.isFixed ? .red : .secondary)
                        }
                    }
                    .tint(.red)
                }
                personBankSection(bvm: $bvm)
                Section("Date & Notes") {
                    DatePicker("Date", selection: $bvm.date, displayedComponents: .date)
                        .environment(\.locale, Locale(identifier: "fr_FR"))
                    TextField("Notes (optionnel)", text: $bvm.notes, axis: .vertical)
                        .lineLimit(2...4)
                }
                Section {
                    Button {
                        showSaveAsRecurring = true
                    } label: {
                        Label("Enregistrer comme dépense récurrente", systemImage: "arrow.clockwise.circle")
                    }
                    .disabled(!vm.isValid)
                }
            }
            .navigationTitle("Nouvelle dépense")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Ajouter") { saveExpense() }
                        .disabled(!vm.isValid)
                        .fontWeight(.semibold)
                }
            }
            .sheet(isPresented: $showCategoryPicker) {
                CategoryPickerView(selection: $bvm.category, isFixed: $bvm.isFixed)
            }
            .sheet(isPresented: $showSaveAsRecurring) {
                saveAsRecurringSheet
            }
            .onChange(of: vm.title) { _, _ in
                vm.updateSuggestions(allExpenses: allExpenses, allRecurring: allRecurring)
            }
        }
    }

    // MARK: - Suggestion section

    @ViewBuilder
    private var suggestionsSection: some View {
        Section("Suggestions") {
            ForEach(vm.suggestedRecurring.prefix(3)) { recurring in
                Button {
                    vm.applyRecurring(recurring)
                } label: {
                    HStack {
                        ZStack {
                            Circle()
                                .fill(recurring.category.color.opacity(0.15))
                                .frame(width: 32, height: 32)
                            Image(systemName: recurring.category.icon)
                                .font(.caption)
                                .foregroundStyle(recurring.category.color)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(recurring.title)
                                .foregroundStyle(.primary)
                                .font(.callout)
                            HStack(spacing: 4) {
                                Text(recurring.frequency.rawValue)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                if recurring.isFixed {
                                    Image(systemName: "lock.fill")
                                        .font(.caption2)
                                        .foregroundStyle(.red.opacity(0.7))
                                }
                            }
                        }
                        Spacer()
                        Text(recurring.amount.formatted(as: recurring.currency))
                            .font(.callout.weight(.medium))
                            .foregroundStyle(.blue)
                    }
                }
            }

            ForEach(vm.recentTitles.prefix(3), id: \.self) { title in
                Button {
                    vm.title = title
                    vm.showRecurringSuggestions = false
                } label: {
                    Label(title, systemImage: "clock.arrow.circlepath")
                        .font(.callout)
                        .foregroundStyle(.primary)
                }
            }
        }
    }

    // MARK: - Amount section

    @ViewBuilder
    private func amountSection(bvm: Bindable<AddExpenseViewModel>) -> some View {
        Section("Montant") {
            HStack {
                TextField("0,00", text: bvm.amountText)
                    .keyboardType(.decimalPad)
                    .font(.title3.weight(.medium))
                Divider().frame(height: 28)
                Picker("", selection: bvm.currency) {
                    ForEach(CurrencyCode.allCases) { code in
                        Text("\(code.flag) \(code.rawValue)").tag(code)
                    }
                }
                .labelsHidden()
                .pickerStyle(.menu)
            }
            if vm.currency != baseCurrency, let amt = vm.amount {
                let converted = CurrencyService.shared.convert(amt, from: vm.currency, to: baseCurrency)
                HStack {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("\(converted.formatted(as: baseCurrency)) en \(baseCurrency.rawValue)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    // MARK: - Category section

    @ViewBuilder
    private var categorySection: some View {
        Section("Catégorie") {
            Button {
                showCategoryPicker = true
            } label: {
                HStack {
                    ZStack {
                        Circle()
                            .fill(vm.category.color.opacity(0.15))
                            .frame(width: 32, height: 32)
                        Image(systemName: vm.category.icon)
                            .font(.caption)
                            .foregroundStyle(vm.category.color)
                    }
                    Text(vm.category.rawValue)
                        .foregroundStyle(.primary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    // MARK: - Person & bank section

    @ViewBuilder
    private func personBankSection(bvm: Bindable<AddExpenseViewModel>) -> some View {
        Section("Qui & Banque") {
            Picker("Personne", selection: bvm.person) {
                ForEach(HouseholdMember.allCases) { member in
                    Label(
                        member.displayName(settings: settings),
                        systemImage: member.systemImage
                    ).tag(member)
                }
            }
            Picker("Banque", selection: bvm.bank) {
                Text("— Non spécifiée —").tag("")
                ForEach(settings.banks, id: \.self) { bank in
                    Text(bank).tag(bank)
                }
            }
        }
    }

    // MARK: - Recurring sheet

    @ViewBuilder
    private var saveAsRecurringSheet: some View {
        NavigationStack {
            Form {
                Picker("Fréquence", selection: $recurringFrequency) {
                    ForEach(RecurrenceFrequency.allCases) { freq in
                        Text(freq.rawValue).tag(freq)
                    }
                }
                if recurringFrequency == .monthly || recurringFrequency == .yearly {
                    Stepper("Jour du mois : \(recurringDay)", value: $recurringDay, in: 1...31)
                }
            }
            .navigationTitle("Dépense récurrente")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { showSaveAsRecurring = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Enregistrer") {
                        saveRecurringTemplate()
                        showSaveAsRecurring = false
                    }
                    .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium])
    }

    // MARK: - Actions

    private func saveExpense() {
        guard let expense = vm.buildExpense(baseCurrency: baseCurrency) else { return }
        context.insert(expense)
        try? context.save()
        dismiss()
    }

    private func saveRecurringTemplate() {
        guard let recurring = vm.buildRecurringTemplate(
            frequency: recurringFrequency,
            dayOfMonth: recurringDay
        ) else { return }
        context.insert(recurring)
        try? context.save()
    }
}
