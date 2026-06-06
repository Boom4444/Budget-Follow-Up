interface Props {
  emoji: string
  bgColor: string
  size?: 'sm' | 'md' | 'lg'
  badgeText?: string
}

const sizes = { sm: 'w-8 h-8 text-base', md: 'w-10 h-10 text-xl', lg: 'w-12 h-12 text-2xl' }

export default function CategoryAvatar({ emoji, bgColor, size = 'md', badgeText }: Props) {
  return (
    <div className="relative flex-shrink-0">
      <div className={`${sizes[size]} rounded-full flex items-center justify-center`}
        style={{ backgroundColor: bgColor }}>
        <span className="leading-none">{emoji}</span>
      </div>
      {badgeText && (
        <div className="absolute -bottom-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-gray-500 dark:bg-gray-400 text-white text-[8px] font-bold flex items-center justify-center px-0.5 border border-white dark:border-gray-900 leading-none">
          {badgeText}
        </div>
      )}
    </div>
  )
}
