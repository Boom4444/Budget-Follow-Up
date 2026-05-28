import Foundation

enum HouseholdMember: String, CaseIterable, Codable, Identifiable {
    case person1 = "person1"
    case person2 = "person2"
    case shared  = "shared"

    var id: String { rawValue }

    func displayName(settings: AppSettings) -> String {
        switch self {
        case .person1: return settings.person1Name
        case .person2: return settings.person2Name
        case .shared:  return "Commun"
        }
    }

    var defaultDisplayName: String {
        switch self {
        case .person1: return "Moi"
        case .person2: return "Partenaire"
        case .shared:  return "Commun"
        }
    }

    var systemImage: String {
        switch self {
        case .person1: return "person.fill"
        case .person2: return "person.fill"
        case .shared:  return "person.2.fill"
        }
    }
}
