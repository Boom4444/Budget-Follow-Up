import SwiftUI
import SwiftData

struct RecurringExpenseListView: View {

    @Environment(\.modelContext) private var context
    @Query(sort: \RecurringExpense.title) private var recurring: [RecurringExpense]
    @Query private var settingsQuery: [AppSettings]

    @State private var showAdd = false
    @State private var itemToEdit: RecurringExpense?

    private var settings: AppSettings { settingsQuery.first ?? AppSettings() }

    private var fixedItems: [RecurringExpense] { recurring.filter(\.isFixed) }
    private var variableItems: [RecurringExpense] { recurring.filter { !$0.isFixed } }

    private var monthlyTotal: Double {
        recurring.reduce(0) { total, item in
            total + (item.amount * item.frequency.monthlyMultiplier)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if !recurring.isEmpty {
                    Section {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Charge mensuelle estimée")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text(monthlyTotal.formatted(as: settings.baseCurrency))
                                    .font(.title3.bold())
                                    .monospacedDigit()
                            }
                            Spacer()
                            Text("\(recurring.count) modèles")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                }

                if !fixedItems.isEmpty {
                    Section("Charges incompressibles") {
                        ForEach(fixedItems) { item in
                            recurringRow(item)
                        }
                        .onDelete { offsets in
                            deleteItems(fixedItems, offsets: offsets)
                        }
                    }
                }

                if !variableItems.isEmpty {
                    Section("Charges courantes") {
                        ForEach(variableItems) { item in
                            recurringRow(item)
                        }
                        .onDelete { offsets in
                            deleteItems(variableItems, offsets: offsets)
                        }
                    }
                }

                if recurring.isEmpty {
                    ContentUnavailableView(
                        "Aucun modèle",
                        systemImage: "arrow.clockwise",
                        description: Text("Créez des modèles pour vos dépenses régulières")
                    )
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Récurrentes")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showAdd = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                    }
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    EditButton()
                }
            }
            .sheet(isPresented: $showAdd) {
                AddRecurringExpenseView()
            }
            .sheet(item: $itemToEdit) { item in
                AddRecurringExpenseView(editItem: item)
            }
        }
    }

    @ViewBuilder
    private func recurringRow(_ item: RecurringExpense) -> some View {
        Button {
            itemToEdit = item
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .fill(item.category.color.opacity(0.15))
                        .frame(width: 38, height: 38)
                    Image(systemName: item.category.icon)
                        .font(.system(size: 16))
                        .foregroundStyle(item.category.color)
                }

                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text(item.title)
                            .font(.callout.weight(.medium))
                            .foregroundStyle(.primary)
                        if item.isFixed {
                            Image(systemName: "lock.fill")
                                .font(.caption2)
                                .foregroundStyle(.red.opacity(0.7))
                        }
                    }

                    HStack(spacing: 4) {
                        Text(item.frequency.rawValue)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text("·")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                        Text(item.person.displayName(settings: settings))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(item.amount.formatted(as: item.currency))
                        .font(.callout.weight(.semibold))
                        .monospacedDigit()
                    Text(item.frequency.shortLabel)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private func deleteItems(_ items: [RecurringExpense], offsets: IndexSet) {
        for i in offsets {
            context.delete(items[i])
        }
        try? context.save()
    }
}
