import SwiftUI

struct CategoryPickerView: View {
    @Binding var selection: ExpenseCategory
    @Binding var isFixed: Bool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Charges incompressibles") {
                    ForEach(ExpenseCategory.fixedCategories) { category in
                        categoryRow(category)
                    }
                }
                Section("Charges courantes") {
                    ForEach(ExpenseCategory.variableCategories) { category in
                        categoryRow(category)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Catégorie")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
            }
        }
    }

    @ViewBuilder
    private func categoryRow(_ category: ExpenseCategory) -> some View {
        Button {
            selection = category
            isFixed   = category.isFixed
            dismiss()
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(category.color.opacity(0.18))
                        .frame(width: 34, height: 34)
                    Image(systemName: category.icon)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(category.color)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(category.rawValue)
                        .foregroundStyle(.primary)
                        .font(.callout)
                    if category.isFixed {
                        Text("Incompressible")
                            .font(.caption2)
                            .foregroundStyle(.red)
                    }
                }

                Spacer()

                if selection == category {
                    Image(systemName: "checkmark")
                        .foregroundStyle(.blue)
                        .fontWeight(.semibold)
                }
            }
        }
    }
}
