import SwiftUI

struct CategoryBadgeView: View {
    let category: ExpenseCategory
    var showLabel: Bool = true
    var size: Size = .medium

    enum Size { case small, medium, large }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: category.icon)
                .font(iconFont)
                .foregroundStyle(category.color)

            if showLabel {
                Text(category.rawValue)
                    .font(labelFont)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, showLabel ? 8 : 6)
        .padding(.vertical, 4)
        .background(category.color.opacity(0.12), in: Capsule())
    }

    private var iconFont: Font {
        switch size {
        case .small:  return .caption2
        case .medium: return .caption
        case .large:  return .subheadline
        }
    }

    private var labelFont: Font {
        switch size {
        case .small:  return .caption2
        case .medium: return .caption
        case .large:  return .subheadline
        }
    }
}

struct FixedBadgeView: View {
    let isFixed: Bool

    var body: some View {
        Label(
            isFixed ? "Incompressible" : "Variable",
            systemImage: isFixed ? "lock.fill" : "arrow.up.arrow.down"
        )
        .font(.caption2.weight(.medium))
        .foregroundStyle(isFixed ? Color.red : Color.green)
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(
            (isFixed ? Color.red : Color.green).opacity(0.12),
            in: Capsule()
        )
    }
}

struct PersonBadgeView: View {
    let person: HouseholdMember
    let settings: AppSettings

    var body: some View {
        Label(
            person.displayName(settings: settings),
            systemImage: person.systemImage
        )
        .font(.caption2)
        .foregroundStyle(.secondary)
    }
}
