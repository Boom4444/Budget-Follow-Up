import Foundation

extension Date {

    var startOfMonth: Date {
        Calendar.current.dateInterval(of: .month, for: self)!.start
    }

    var endOfMonth: Date {
        Calendar.current.dateInterval(of: .month, for: self)!.end
    }

    var startOfYear: Date {
        Calendar.current.dateInterval(of: .year, for: self)!.start
    }

    var endOfYear: Date {
        Calendar.current.dateInterval(of: .year, for: self)!.end
    }

    var year: Int { Calendar.current.component(.year, from: self) }
    var month: Int { Calendar.current.component(.month, from: self) }
    var day: Int { Calendar.current.component(.day, from: self) }

    var monthYearString: String {
        formatted(.dateTime.month(.wide).year())
    }

    var shortMonthString: String {
        formatted(.dateTime.month(.abbreviated))
    }

    var shortMonthYearString: String {
        formatted(.dateTime.month(.abbreviated).year(.twoDigits))
    }

    func isSameMonth(as other: Date) -> Bool {
        Calendar.current.isDate(self, equalTo: other, toGranularity: .month)
    }

    func isSameYear(as other: Date) -> Bool {
        Calendar.current.isDate(self, equalTo: other, toGranularity: .year)
    }

    static func from(year: Int, month: Int) -> Date {
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = 1
        return Calendar.current.date(from: components) ?? Date()
    }
}
