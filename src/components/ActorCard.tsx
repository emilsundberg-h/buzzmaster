'use client'

import Image from 'next/image'

interface Actor {
  id: string
  playerId: string
  revealed: boolean
  player: {
    id: string
    name: string
    imageKey: string
  }
}

interface ActorCardProps {
  actor: Actor
  onReveal: (playerId: string) => Promise<void>
}

export default function ActorCard({ actor, onReveal }: ActorCardProps) {
  // Actors are always visible, no flip needed
  return (
    <div className="relative w-32 h-32">
      <div className="relative w-full h-full">
        <div className="relative w-full h-full rounded-lg overflow-hidden shadow-lg">
          <Image
            src={`/${actor.player.imageKey}`}
            alt={actor.player.name}
            fill
            className="object-cover"
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 text-center truncate">
          {actor.player.name}
        </div>
      </div>
    </div>
  )
}
