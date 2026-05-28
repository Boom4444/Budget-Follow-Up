import SwiftUI
import SwiftData

struct SettingsView: View {

    @Environment(\.modelContext) private var context
    @Query private var settingsQuery: [AppSettings]

    @State private var person1Name: String = "Moi"
    @State private var person2Name: String = "Partenaire"
    @State private var baseCurrency: CurrencyCode = .eur
    @State private var newBank: String = ""
    @State private var hasLoaded = false
    @State private var showCurrencyRates = false

    private var settings: AppSettings {
        settingsQuery.first ?? AppSettings()
    }

    var body: some View {
        NavigationStack {
            Form {
                householdSection
                currencySection
                banksSection
                ratesSection
                aboutSection
            }
            .navigationTitle("Réglages")
            .onAppear(perform: loadSettings)
            .onChange(of: person1Name) { _, _ in saveSettings() }
            .onChange(of: person2Name) { _, _ in saveSettings() }
            .onChange(of: baseCurrency) { _, _ in saveSettings() }
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var householdSection: some View {
        Section {
            HStack {
                Image(systemName: "person.fill")
                    .foregroundStyle(.purple)
                    .frame(width: 28)
                TextField("Prénom personne 1", text: $person1Name)
            }
            HStack {
                Image(systemName: "person.fill")
                    .foregroundStyle(.orange)
                    .frame(width: 28)
                TextField("Prénom personne 2", text: $person2Name)
            }
        } header: {
            Text("Foyer")
        } footer: {
            Text("Ces noms apparaîtront dans les dépenses et les statistiques.")
        }
    }

    @ViewBuilder
    private var currencySection: some View {
        Section {
            Picker("Devise de référence", selection: $baseCurrency) {
                ForEach(CurrencyCode.allCases) { code in
                    HStack {
                        Text(code.flag)
                        Text(code.rawValue)
                        Text("–")
                        Text(code.name)
                    }
                    .tag(code)
                }
            }
        } header: {
            Text("Devise")
        } footer: {
            Text("Les montants en devises étrangères sont convertis dans cette devise pour les totaux.")
        }
    }

    @ViewBuilder
    private var banksSection: some View {
        Section {
            ForEach(settings.banks, id: \.self) { bank in
                HStack {
                    Image(systemName: "building.columns.fill")
                        .foregroundStyle(.blue)
                        .frame(width: 28)
                    Text(bank)
                    Spacer()
                }
            }
            .onDelete { offsets in
                var banks = settings.banks
                banks.remove(atOffsets: offsets)
                settings.banks = banks
                try? context.save()
            }

            HStack {
                Image(systemName: "plus.circle.fill")
                    .foregroundStyle(.green)
                    .frame(width: 28)
                TextField("Ajouter une banque…", text: $newBank)
                    .onSubmit {
                        addBank()
                    }
                if !newBank.isEmpty {
                    Button("Ajouter") {
                        addBank()
                    }
                    .font(.callout)
                }
            }
        } header: {
            Text("Banques")
        } footer: {
            Text("Listez vos comptes bancaires pour catégoriser vos dépenses par source.")
        }
    }

    @ViewBuilder
    private var ratesSection: some View {
        Section("Taux de change") {
            Button {
                showCurrencyRates = true
            } label: {
                Label("Voir les taux de conversion", systemImage: "arrow.triangle.2.circlepath")
            }
        }
    }

    @ViewBuilder
    private var aboutSection: some View {
        Section("À propos") {
            LabeledContent("Version", value: "1.0.0")
            LabeledContent("Données", value: "Stockées localement")
        }
    }

    // MARK: - Helpers

    private func loadSettings() {
        guard !hasLoaded else { return }
        hasLoaded = true

        if settingsQuery.isEmpty {
            let defaultSettings = AppSettings()
            context.insert(defaultSettings)
            try? context.save()
        }

        person1Name  = settings.person1Name
        person2Name  = settings.person2Name
        baseCurrency = settings.baseCurrency
    }

    private func saveSettings() {
        guard hasLoaded else { return }
        settings.person1Name = person1Name
        settings.person2Name = person2Name
        settings.baseCurrency = baseCurrency
        try? context.save()
    }

    private func addBank() {
        let trimmed = newBank.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !settings.banks.contains(trimmed) else {
            newBank = ""
            return
        }
        settings.banks.append(trimmed)
        newBank = ""
        try? context.save()
    }
}
