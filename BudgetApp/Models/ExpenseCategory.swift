import SwiftUI

enum ExpenseCategory: String, CaseIterable, Codable, Identifiable {

    // MARK: - Charges incompressibles
    case rent               = "Loyer / Prêt immobilier"
    case homeInsurance      = "Assurance habitation"
    case healthInsurance    = "Mutuelle / Assurance santé"
    case electricity        = "Électricité / Gaz"
    case water              = "Eau"
    case internet           = "Internet / Box"
    case mobile             = "Téléphone mobile"
    case carInsurance       = "Assurance voiture"
    case loanRepayment      = "Remboursement crédit"
    case taxes              = "Impôts / Taxes"

    // MARK: - Charges courantes
    case groceries          = "Alimentation / Courses"
    case transport          = "Transport / Carburant"
    case health             = "Santé / Pharmacie"
    case clothing           = "Vêtements"
    case leisure            = "Loisirs / Sorties"
    case restaurants        = "Restaurants / Cafés"
    case travel             = "Vacances / Voyages"
    case culture            = "Culture / Divertissement"
    case sport              = "Sport / Fitness"
    case gifts              = "Cadeaux"
    case children           = "Enfants / Éducation"
    case savings            = "Épargne"
    case homeImprovement    = "Maison / Entretien"
    case subscriptions      = "Abonnements"
    case other              = "Autre"

    var id: String { rawValue }

    var isFixed: Bool {
        switch self {
        case .rent, .homeInsurance, .healthInsurance, .electricity,
             .water, .internet, .mobile, .carInsurance, .loanRepayment, .taxes:
            return true
        default:
            return false
        }
    }

    var icon: String {
        switch self {
        case .rent:             return "house.fill"
        case .homeInsurance:    return "shield.fill"
        case .healthInsurance:  return "heart.fill"
        case .electricity:      return "bolt.fill"
        case .water:            return "drop.fill"
        case .internet:         return "wifi"
        case .mobile:           return "iphone"
        case .carInsurance:     return "car.fill"
        case .loanRepayment:    return "banknote.fill"
        case .taxes:            return "building.columns.fill"
        case .groceries:        return "cart.fill"
        case .transport:        return "fuelpump.fill"
        case .health:           return "cross.case.fill"
        case .clothing:         return "tshirt.fill"
        case .leisure:          return "star.fill"
        case .restaurants:      return "fork.knife"
        case .travel:           return "airplane"
        case .culture:          return "book.fill"
        case .sport:            return "figure.run"
        case .gifts:            return "gift.fill"
        case .children:         return "figure.2.and.child.holdinghands"
        case .savings:          return "banknote"
        case .homeImprovement:  return "wrench.and.screwdriver.fill"
        case .subscriptions:    return "repeat.circle.fill"
        case .other:            return "ellipsis.circle.fill"
        }
    }

    var color: Color {
        switch self {
        case .rent:             return Color(red: 0.20, green: 0.40, blue: 0.90)
        case .homeInsurance:    return Color(red: 0.35, green: 0.25, blue: 0.80)
        case .healthInsurance:  return Color(red: 0.95, green: 0.30, blue: 0.50)
        case .electricity:      return Color(red: 0.95, green: 0.80, blue: 0.10)
        case .water:            return Color(red: 0.10, green: 0.75, blue: 0.90)
        case .internet:         return Color(red: 0.60, green: 0.20, blue: 0.85)
        case .mobile:           return Color(red: 0.20, green: 0.80, blue: 0.70)
        case .carInsurance:     return Color(red: 0.95, green: 0.50, blue: 0.10)
        case .loanRepayment:    return Color(red: 0.85, green: 0.15, blue: 0.15)
        case .taxes:            return Color(red: 0.50, green: 0.35, blue: 0.20)
        case .groceries:        return Color(red: 0.20, green: 0.75, blue: 0.30)
        case .transport:        return Color(red: 0.90, green: 0.55, blue: 0.10)
        case .health:           return Color(red: 0.85, green: 0.20, blue: 0.20)
        case .clothing:         return Color(red: 0.90, green: 0.40, blue: 0.65)
        case .leisure:          return Color(red: 0.55, green: 0.20, blue: 0.80)
        case .restaurants:      return Color(red: 0.95, green: 0.45, blue: 0.15)
        case .travel:           return Color(red: 0.10, green: 0.50, blue: 0.95)
        case .culture:          return Color(red: 0.60, green: 0.40, blue: 0.20)
        case .sport:            return Color(red: 0.15, green: 0.70, blue: 0.25)
        case .gifts:            return Color(red: 0.85, green: 0.15, blue: 0.35)
        case .children:         return Color(red: 0.90, green: 0.75, blue: 0.10)
        case .savings:          return Color(red: 0.10, green: 0.60, blue: 0.40)
        case .homeImprovement:  return Color(red: 0.50, green: 0.50, blue: 0.50)
        case .subscriptions:    return Color(red: 0.45, green: 0.15, blue: 0.75)
        case .other:            return Color(red: 0.55, green: 0.55, blue: 0.60)
        }
    }

    static var fixedCategories: [ExpenseCategory] {
        allCases.filter(\.isFixed)
    }

    static var variableCategories: [ExpenseCategory] {
        allCases.filter { !$0.isFixed }
    }
}
