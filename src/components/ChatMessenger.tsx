'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, MessageCircle, Minimize2, X, ChevronDown, Users } from 'lucide-react'
import { getAvatarPath } from '@/lib/avatar-helpers'

interface Message {
  id: string
  roomId: string
  senderId: string
  receiverId: string | null
  content: string
  createdAt: string
  read: boolean
  sender: {
    id: string
    clerkId: string
    username: string
    avatarKey: string
  }
}

interface Participant {
  id: string
  clerkId: string
  username: string
  avatarKey: string
  unreadCount: number
}

interface Poke {
  id: string
  roomId: string
  senderId: string
  receiverId: string
  sender: {
    id: string
    username: string
    avatarKey: string
  }
  senderUsername: string
  receiverClerkId: string
  createdAt: string
  seen: boolean
}

interface ChatMessengerProps {
  roomId: string
  currentUserId: string
  lastWebSocketMessage?: any
}

export default function ChatMessenger({ roomId, currentUserId, lastWebSocketMessage }: ChatMessengerProps) {
  const [isMinimized, setIsMinimized] = useState(true) // Default to minimized/closed
  const [activeChat, setActiveChat] = useState<'group' | string | null>(null) // 'group' or userId for DM
  const [participants, setParticipants] = useState<Participant[]>([])
  const [unreadGroupCount, setUnreadGroupCount] = useState(0)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showPoke, setShowPoke] = useState(false)
  const [pokeFrom, setPokeFrom] = useState<string>('')
  const [closing, setClosing] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Calculate total unread messages
  const totalUnread = participants.reduce((sum, p) => sum + p.unreadCount, 0) + unreadGroupCount

  // Fetch participants
  const fetchParticipants = async () => {
    try {
      const response = await fetch(`/api/chat/participants?roomId=${roomId}`, {
        headers: {
          'x-dev-user-id': currentUserId
        }
      })
      const data = await response.json()
      setParticipants(data.participants || [])
      setUnreadGroupCount(data.unreadGroupCount || 0)
    } catch (error) {
      console.error('Failed to fetch participants:', error)
    }
  }

  // Fetch messages for active chat
  const fetchMessages = async () => {
    if (!activeChat) return

    try {
      let url = `/api/chat/messages?roomId=${roomId}`
      if (activeChat !== 'group') {
        url += `&otherUserId=${activeChat}`
      }

      const response = await fetch(url, {
        headers: {
          'x-dev-user-id': currentUserId
        }
      })
      const data = await response.json()
      setMessages(data.messages || [])
      
      // Mark messages as read
      await markAsRead()
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    }
  }

  // Mark messages as read
  const markAsRead = async () => {
    if (!activeChat) return

    try {
      await fetch('/api/chat/messages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-dev-user-id': currentUserId
        },
        body: JSON.stringify({
          roomId,
          otherUserId: activeChat !== 'group' ? activeChat : undefined
        })
      })

      // Update local unread counts
      if (activeChat === 'group') {
        setUnreadGroupCount(0)
      } else {
        setParticipants(prev => prev.map(p => 
          p.id === activeChat ? { ...p, unreadCount: 0 } : p
        ))
      }

      // Refresh participants from server to ensure accurate counts
      await fetchParticipants()
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  // Send message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !activeChat || sending) return

    setSending(true)
    try {
      await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dev-user-id': currentUserId
        },
        body: JSON.stringify({
          roomId,
          receiverId: activeChat !== 'group' ? activeChat : null,
          content: messageInput
        })
      })
      setMessageInput('')
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setSending(false)
    }
  }

  // Send poke
  const handlePoke = async (participantId: string) => {
    try {
      await fetch('/api/chat/poke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dev-user-id': currentUserId
        },
        body: JSON.stringify({
          roomId,
          receiverId: participantId
        })
      })
    } catch (error) {
      console.error('Failed to send poke:', error)
    }
  }

  // Listen for WebSocket messages
  useEffect(() => {
    if (!lastWebSocketMessage) return

    if (lastWebSocketMessage.type === 'chat:message') {
      const newMessage = lastWebSocketMessage.data.message
      console.log('ChatMessenger: Received message', {
        senderId: newMessage.senderId,
        receiverId: newMessage.receiverId,
        activeChat,
        currentUserId,
        isMinimized
      })
      
      // If viewing this chat, add message and mark as read
      if (activeChat === 'group' && !newMessage.receiverId) {
        console.log('ChatMessenger: Adding group message')
        setMessages(prev => [...prev, newMessage])
        markAsRead()
      } else if (activeChat && activeChat !== 'group') {
        // Check if message is from or to the active chat
        const isFromActiveChat = newMessage.senderId === activeChat
        const isToActiveChat = newMessage.receiverId === activeChat
        const isMyMessage = newMessage.senderId === currentUserId
        const isToMe = newMessage.receiverId === currentUserId
        
        console.log('ChatMessenger: DM check', {
          isFromActiveChat,
          isToActiveChat,
          isMyMessage,
          isToMe
        })
        
        // Show message if it's from the person I'm chatting with, or if it's my message to them
        if ((isFromActiveChat && isToMe) || (isToActiveChat && isMyMessage)) {
          console.log('ChatMessenger: Adding DM message')
          setMessages(prev => [...prev, newMessage])
          markAsRead()
        } else {
          // Message is for a different chat - update unread count
          console.log('ChatMessenger: Updating unread count')
          fetchParticipants()
        }
      } else {
        // Update unread count
        console.log('ChatMessenger: No active chat, updating unread count')
        fetchParticipants()
      }
    } else if (lastWebSocketMessage.type === 'chat:poke') {
      const poke: Poke = lastWebSocketMessage.data.poke
      
      console.log('🔔 Poke received:', {
        pokeReceiverClerkId: poke.receiverClerkId,
        currentUserId: currentUserId,
        match: poke.receiverClerkId === currentUserId,
        sender: poke.senderUsername
      })
      
      // Check if poke is for me
      if (poke.receiverClerkId === currentUserId) {
        console.log('🔔 POKE IS FOR ME! Showing notification')
        setPokeFrom(poke.senderUsername)
        setShowPoke(true)
        
        // Apply shake to body
        document.body.classList.add('screen-shake')
        
        // Hide after 3 seconds
        setTimeout(() => {
          setShowPoke(false)
          document.body.classList.remove('screen-shake')
        }, 3000)

        // Mark as seen
        fetch('/api/chat/poke', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-dev-user-id': currentUserId
          },
          body: JSON.stringify({ pokeId: poke.id })
        })
      } else {
        console.log('🔔 Poke is not for me, ignoring')
      }
    }
  }, [lastWebSocketMessage, activeChat, currentUserId])

  // Fetch participants on mount
  useEffect(() => {
    fetchParticipants()
  }, [])

  // Refetch participants periodically
  useEffect(() => {
    const interval = setInterval(() => {
      fetchParticipants()
    }, 3000) // Refresh every 3 seconds

    return () => clearInterval(interval)
  }, [])

  // Fetch messages when switching chats
  useEffect(() => {
    if (activeChat) {
      fetchMessages()
    }
  }, [activeChat])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Click outside to minimize
  useEffect(() => {
    if (isMinimized) return

    const handleClickOutside = (event: MouseEvent) => {
      const chatWindow = document.querySelector('[data-chat-window]')
      if (chatWindow && !chatWindow.contains(event.target as Node)) {
        setIsMinimized(true)
        setActiveChat(null) // Reset to home screen when closing
        setMessages([]) // Clear messages
      }
    }

    // Add slight delay to avoid minimizing immediately after opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMinimized])

  // Get active chat info
  const getActiveChatInfo = () => {
    if (activeChat === 'group') {
      return { name: 'All', avatarKey: null }
    }
    const participant = participants.find(p => p.id === activeChat)
    return participant ? { name: participant.username, avatarKey: participant.avatarKey } : null
  }

  const activeChatInfo = getActiveChatInfo()

  return (
    <>
      {/* Hide scrollbars and add animations */}
      <style>{`
        .chat-scrollable {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge */
        }
        .chat-scrollable::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideDown {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(20px);
          }
        }
        @keyframes shake {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-15px, 5px); }
          20% { transform: translate(15px, -5px); }
          30% { transform: translate(-15px, -5px); }
          40% { transform: translate(15px, 5px); }
          50% { transform: translate(-12px, 3px); }
          60% { transform: translate(12px, -3px); }
          70% { transform: translate(-8px, -2px); }
          80% { transform: translate(8px, 2px); }
          90% { transform: translate(-4px, 1px); }
        }
        .screen-shake {
          animation: shake 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97);
        }
      `}</style>

      {/* Poke notification */}
      {showPoke && (
        <div 
          className="fixed top-24 right-8 rounded-xl shadow-2xl px-8 py-6 z-[9999] border-4 animate-bounce"
          style={{ 
            backgroundColor: 'var(--card-bg)', 
            color: 'var(--foreground)',
            borderColor: 'var(--primary)',
            boxShadow: '0 0 30px rgba(59,130,246,0.5), 0 0 0 8px rgba(59,130,246,0.25)'
          }}
        >
          <div className="text-2xl font-bold flex items-center gap-3">
            <span role="img" aria-label="poke" className="text-4xl">👉</span>
            {pokeFrom} poked you!
          </div>
        </div>
      )}

      {/* Minimized floating button */}
      {isMinimized ? (
        <button
          aria-label="Open messages"
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full shadow-2xl flex items-center justify-center border"
          style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
        >
          <MessageCircle size={22} />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>
      ) : (
      /* Chat window expanded */
      <div 
        data-chat-window
        className={`fixed bottom-0 right-0 w-96 shadow-2xl flex flex-col overflow-hidden z-40 border-l border-t h-[500px]`}
        style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
      >
        
        <div className={`${closing ? 'chat-slide-down' : 'chat-slide-up'} flex-1 flex flex-col min-h-0`}>
            {/* Minimize button when chat is open */}
            <div className="absolute top-2 right-2 z-50">
              <button
              onClick={() => {
                setClosing(true)
                setTimeout(() => {
                  setIsMinimized(true)
                  setClosing(false)
                  setActiveChat(null) // Reset to home screen when closing
                  setMessages([]) // Clear messages
                }, 250)
              }}
                className="p-2 rounded-full transition-all duration-200 focus:outline-none"
                style={{ color: 'var(--foreground)' }}
              >
                <ChevronDown size={20} />
              </button>
            </div>

            {!activeChat ? (
              // Participant list
              <>

              <div className="flex-1 min-h-0 overflow-y-auto p-2 pt-10 chat-scrollable">
                {/* Group chat */}
                <button
                  onClick={() => setActiveChat('group')}
                  className="w-full p-3 rounded-lg mb-2 flex items-center gap-3 hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: 'var(--input-bg)' }}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
                    <Users className="text-white" size={24} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold">All</div>
                    <div className="text-sm opacity-70">Group chat</div>
                  </div>
                  {unreadGroupCount > 0 && (
                    <div className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {unreadGroupCount}
                    </div>
                  )}
                </button>

                {/* Individual participants */}
                {participants.map(participant => (
                  <div key={participant.id} className="relative mb-2">
                    <button
                      onClick={() => setActiveChat(participant.id)}
                      className="w-full p-3 rounded-lg flex items-center gap-3 hover:opacity-80 transition-all"
                      style={{ 
                        backgroundColor: 'var(--input-bg)',
                        border: participant.unreadCount > 0 ? '2px solid #ef4444' : '2px solid transparent',
                        boxShadow: participant.unreadCount > 0 ? '0 0 10px rgba(239, 68, 68, 0.5)' : 'none'
                      }}
                    >
                      <img
                        src={getAvatarPath(participant.avatarKey)}
                        alt={participant.username}
                        className="w-12 h-12 rounded-full"
                      />
                      <div className="flex-1 text-left">
                        <div className={participant.unreadCount > 0 ? "font-bold" : "font-semibold"}>{participant.username}</div>
                        {participant.unreadCount > 0 && (
                          <div className="text-xs text-red-500">New message</div>
                        )}
                      </div>
                      {participant.unreadCount > 0 && (
                        <div className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                          {participant.unreadCount}
                        </div>
                      )}
                    </button>
                    
                    {/* Poke button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePoke(participant.id)
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-yellow-500 text-white text-xs rounded-full hover:bg-yellow-600"
                    >
                      👉 Poke
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            // Chat view
            <>
              <div className="flex-shrink-0 p-4 pr-12 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
                <button
                  onClick={async () => {
                    // Fetch participants to refresh unread counts before going back
                    await fetchParticipants()
                    setActiveChat(null)
                    setMessages([])
                  }}
                  className="text-2xl hover:opacity-70 transition-opacity leading-none"
                >
                  ←
                </button>
                {activeChatInfo?.avatarKey ? (
                  <img
                    src={getAvatarPath(activeChatInfo.avatarKey)}
                    alt={activeChatInfo.name}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
                    <Users className="text-white" size={20} />
                  </div>
                )}
                <h3 className="text-lg font-bold">{activeChatInfo?.name}</h3>
              </div>

              {/* Messages */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 chat-scrollable">
                {messages.map(message => {
                  const isOwnMessage = message.sender.clerkId === currentUserId
                  return (
                    <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-2 max-w-[80%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                        {!isOwnMessage && (
                          <img
                            src={getAvatarPath(message.sender.avatarKey)}
                            alt={message.sender.username}
                            className="w-8 h-8 rounded-full"
                          />
                        )}
                        <div className={`rounded-lg px-4 py-2 ${isOwnMessage ? 'rounded-br-none' : 'rounded-bl-none'}`}
                          style={{ 
                            backgroundColor: isOwnMessage ? 'var(--primary)' : 'var(--input-bg)',
                            color: isOwnMessage ? 'white' : 'var(--foreground)'
                          }}
                        >
                          {!isOwnMessage && activeChat === 'group' && (
                            <div className="text-xs opacity-70 mb-1">{message.sender.username}</div>
                          )}
                          <div>{message.content}</div>
                          <div className="text-xs opacity-70 mt-1">
                            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="flex-shrink-0 p-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    placeholder="Write a message..."
                    className="flex-1 px-3 py-2 rounded-lg border"
                    style={{ 
                      backgroundColor: 'var(--input-bg)', 
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)'
                    }}
                    disabled={sending}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sending}
                    className="px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                    style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      )}
    </>
  )
}

