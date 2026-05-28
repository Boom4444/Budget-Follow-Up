import SwiftUI
import SwiftData

struct AddRecurringExpenseView: View {

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query private var settingsQuery: [AppSettings]

    var editItem: RecurringExpense?

    @State private var title: String = ""
    @State private var amountText: String = ""
    @State private var currency: CurrencyCode = .eur
    @State private var category: ExpenseCategory = .other
    @State private var isFixed: Bool = false
    @State private var bank: String = ""
    @State private var person: HouseholdMember = .person1
    @State private var frequency: RecurrenceFrequency = .monthly
    @State private var dayOfMonth: Int = 1
    @State private var showCategoryPicker = false

    private var settings: AppSettings { settingsQuery.first ?? AppSettings() }

    private var amount: Double? {
        Double(amountText.replacingOccurrences(of: ",", with: "."))
    }

    private var isValid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty && amount != nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Description") {
                    TextField("Ex: Loyer, EDF, Spotify…", text: $title)
                }

                Section("Montant") {
                    HStack {
                        TextField("0,00", text: $amountText)
                            .keyboardType(.decimalPad)
                        Divider().frame(height: 28)
                        Picker("", selection: $currency) {
                            ForEach(CurrencyCode.allCases) { code in
                                Text("\(code.flag) \(code.rawValue)").tag(code)
                            }
                        }
                        .labelsHidden()
                        .pickerStyle(.menu)
                    }
                }

                Section("Catégorie") {
                    Button {
                        showCategoryPicker = true
                    } label: {
                        HStack {
                            ZStack {
                                Circle()
                                    .fill(category.color.opacity(0.15))
                                    .frame(width: 30, height: 30)
                                Image(systemName: category.icon)
                                    .font(.caption)
                                    .foregroundStyle(category.color)
                            }
                            Text(category.rawValue).foregroundStyle(.primary)
                            Spacer()
                            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                        }
                    }
                }

                Section {
                    Toggle(isOn: $isFixed) {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Charge incompressible")
                                Text("Loyer, assurance, électricité…").font(.caption).foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "lock.fill").foregroundStyle(isFixed ? .red : .secondary)
                        }
                    }
                    .tint(.red)
                }

                Section("Récurrence") {
                    Picker("Fréquence", selection: $frequency) {
                        ForEach(RecurrenceFrequency.allCases) { freq in
                            Text(freq.rawValue).tag(freq)
                        }
                    }
                    if frequency == .monthly || frequency == .yearly {
                        Stepper("Jour du mois : \(dayOfMonth)", value: $dayOfMonth, in: 1...31)
                    }
                }

                Section("Qui & Banque") {
                    Picker("Personne", selection: $person) {
                        ForEach(HouseholdMember.allCases) { m in
                            Label(m.displayName(settings: settings), systemImage: m.systemImage).tag(m)
                        }
                    }
                    Picker("Banque", selection: $bank) {
                        Text("— Non spécifiée —").tag("")
                        ForEach(settings.banks, id: \.self) { b in Text(b).tag(b) }
                    }
                }
            }
            .navigationTitle(editItem == nil ? "Nouveau modèle" : "Modifier")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Enregistrer") { save() }
                        .disabled(!isValid)
                        .fontWeight(.semibold)
                }
            }
            .sheet(isPresented: $showCategoryPicker) {
                CategoryPickerView(selection: $category, isFixed: $isFixed)
            }
            .onAppear(perform: populateIfEditing)
        }
    }

    private func populateIfEditing() {
        guard let item = editItem else { return }
        title = item.title
        amountText = String(format: "%.2f", item.amount)
        currency = item.currency
        category = item.category
        isFixed = item.isFixed
        bank = item.bank
        person = item.person
        frequency = item.frequency
        dayOfMonth = item.dayOfMonth
    }

    private func save() {
        guard let amt = amount else { return }
        if let item = editItem {
            item.title = title
            item.amount = amt
            item.currencyRawValue = currency.rawValue
            item.categoryRawValue = category.rawValue
            item.isFixed = isFixed
            item.bank = bank
            item.personRawValue = person.rawValue
            item.frequencyRawValue = frequency.rawValue
            item.dayOfMonth = dayOfMonth
        } else {
            let item = RecurringExpense(
                title: title,
                amount: amt,
                currency: currency,
                category: category,
                isFixed: isFixed,
                bank: bank,
                person: person,
                frequency: frequency,
                dayOfMonth: dayOfMonth
            )
            context.insert(item)
        }
        try? context.save()
        dismiss()
    }
}
