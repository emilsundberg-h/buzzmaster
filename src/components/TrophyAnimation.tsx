'use client'

import { useState, useEffect } from 'react'

interface TrophyAnimationProps {
  trophyImageKey: string
  trophyName: string
  onComplete?: () => void
}

export default function TrophyAnimation({ 
  trophyImageKey, 
  trophyName,
  onComplete 
}: TrophyAnimationProps) {
  const [stage, setStage] = useState<'swell' | 'crack' | 'reveal'>('swell')

  useEffect(() => {
    // Swell for 1 second
    const swellTimer = setTimeout(() => {
      setStage('crack')
    }, 1000)

    // Crack for 0.5 seconds
    const crackTimer = setTimeout(() => {
      setStage('reveal')
    }, 1500)

    // Complete after 3 seconds
    const completeTimer = setTimeout(() => {
      onComplete?.()
    }, 4500)

    return () => {
      clearTimeout(swellTimer)
      clearTimeout(crackTimer)
      clearTimeout(completeTimer)
    }
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="trophy-animation-container flex flex-col items-center">
        {stage === 'swell' && (
          <div 
            className="gift-box-swell"
            style={{
              animation: 'swell 1s ease-in-out forwards'
            }}
          >
            <div 
              className="w-48 h-48 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }}
            >
              <div className="text-9xl">🎁</div>
            </div>
          </div>
        )}

        {stage === 'crack' && (
          <div 
            className="gift-box-crack relative"
            style={{
              animation: 'shake 0.5s ease-in-out forwards'
            }}
          >
            <div 
              className="w-48 h-48 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }}
            >
              <div className="text-9xl">💥</div>
            </div>
            
            {/* Crack lines */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className="absolute w-full h-1 bg-white opacity-70"
                style={{ transform: 'rotate(45deg)' }}
              />
              <div 
                className="absolute w-full h-1 bg-white opacity-70"
                style={{ transform: 'rotate(-45deg)' }}
              />
            </div>
          </div>
        )}

        {stage === 'reveal' && (
          <div 
            className="trophy-reveal"
            style={{
              animation: 'revealFadeIn 1s ease-out forwards'
            }}
          >
            <div className="text-center">
              <h2 
                className="text-4xl font-bold mb-6"
                style={{ color: '#ffd700' }}
              >
                🏆 GRATTIS! 🏆
              </h2>
              
              <div className="trophy-image-container mb-4">
                <img
                  src={`/trophys/${trophyImageKey}`}
                  alt={trophyName}
                  className="w-64 h-64 object-contain mx-auto"
                  style={{
                    filter: 'drop-shadow(0 10px 30px rgba(255, 215, 0, 0.5))',
                    animation: 'float 2s ease-in-out infinite'
                  }}
                />
              </div>
              
              <h3 className="text-3xl font-bold text-white">
                {trophyName}
              </h3>
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes swell {
            0% {
              transform: scale(1);
            }
            100% {
              transform: scale(1.3);
            }
          }

          @keyframes shake {
            0%, 100% {
              transform: translateX(0) scale(1.3);
            }
            25% {
              transform: translateX(-10px) scale(1.3) rotate(-5deg);
            }
            75% {
              transform: translateX(10px) scale(1.3) rotate(5deg);
            }
          }

          @keyframes revealFadeIn {
            0% {
              opacity: 0;
              transform: scale(0.5);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes float {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-20px);
            }
          }
        `}</style>
      </div>
    </div>
  )
}


