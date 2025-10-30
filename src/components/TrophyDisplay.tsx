'use client'

interface TrophyDisplayProps {
  isWrapped?: boolean
  onClick?: () => void
}

export default function TrophyDisplay({ isWrapped = true, onClick }: TrophyDisplayProps) {
  if (!isWrapped) {
    return null
  }

  return (
    <div 
      className="trophy-display-container flex flex-col items-center justify-center p-6 rounded-lg shadow-lg"
      style={{ 
        backgroundColor: 'var(--card-bg)', 
        borderColor: 'var(--primary)',
        borderWidth: '2px',
        cursor: onClick ? 'pointer' : 'default'
      }}
      onClick={onClick}
    >
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
          🎁 TROFÉ AKTIV 🎁
        </h3>
        <p className="text-sm opacity-70 mt-2">
          Vinn denna omgång för att få en trofé!
        </p>
      </div>
      
      {/* Wrapped gift box animation */}
      <div className="wrapped-trophy relative">
        <div 
          className="gift-box w-32 h-32 rounded-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            animation: 'pulse 2s ease-in-out infinite'
          }}
        >
          <div className="text-6xl">🎁</div>
        </div>
        
        {/* Sparkles */}
        <div 
          className="sparkles absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{
            animation: 'sparkle 1.5s ease-in-out infinite'
          }}
        >
          <span className="absolute top-2 right-2 text-2xl">✨</span>
          <span className="absolute bottom-2 left-2 text-2xl">✨</span>
          <span className="absolute top-1/2 left-0 text-xl">⭐</span>
          <span className="absolute top-1/2 right-0 text-xl">⭐</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @keyframes sparkle {
          0%, 100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}


