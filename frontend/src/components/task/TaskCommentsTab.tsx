import React, { useState, useEffect } from 'react'
import { 
  MessageSquare, User, Clock, CheckSquare, Paperclip, 
  History, Pin, Reply, ThumbsUp, Heart, Smile,
  Plus, Send, Filter, Search, Users, Calendar,
  Eye, Archive, MoreVertical, Edit, Trash2, ExternalLink
} from 'lucide-react'
import { getApiUrlDynamic } from '../../utils/config'

interface Comment {
  id: string
  content: string
  type: 'comment' | 'note' | 'review' | 'suggestion' | 'approval'
  entity_type: 'task'
  entity_id: string
  author_id: string
  parent_id?: string
  thread_id?: string
  mentions: Array<{
    user_id: string
    username: string
    position: number
  }>
  attachments: string[]
  is_edited: boolean
  is_internal: boolean
  is_pinned: boolean
  reply_count: number
  reaction_count: number
  reactions: Array<{
    user_id: string
    emoji: string
    timestamp: string
  }>
  is_resolved: boolean
  resolved_by?: string
  resolved_at?: string
  created_at: string
  updated_at: string
}

interface ConversationHistoryEntry {
  id: string
  content: string
  type: string
  author: {
    id: string
    name: string
    email: string
    avatar_url?: string
    initials: string
  }
  timestamp: string
  formatted_time: string
  reactions: any[]
  reaction_summary: Record<string, {
    count: number
    users: any[]
    current_user_reacted: boolean
  }>
  mentions: any[]
  attachments: string[]
  is_edited: boolean
  is_pinned: boolean
  is_resolved: boolean
  parent_id?: string
  thread_id?: string
  reply_count: number
}

interface ConversationHistory {
  conversation_history: ConversationHistoryEntry[]
  statistics: {
    total_messages: number
    participants: number
    message_types: Record<string, number>
    first_message?: string
    last_message?: string
    pinned_messages: number
    resolved_items: number
  }
  participants: any[]
}

interface TaskCommentsTabProps {
  comments: Comment[]
  loading: boolean
  newComment: string
  setNewComment: (value: string) => void
  onAddComment: () => void
  availableUsers?: any[]
  taskId?: string
  tokens?: any
}

export const TaskCommentsTab: React.FC<TaskCommentsTabProps> = ({ 
  comments, 
  loading, 
  newComment, 
  setNewComment, 
  onAddComment, 
  availableUsers = [],
  taskId,
  tokens
}) => {
  const [commentType, setCommentType] = useState<'comment' | 'note' | 'review'>('comment')
  const [filterType, setFilterType] = useState<'all' | 'comment' | 'note' | 'review' | 'resolved'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'comments' | 'history'>('comments')
  const [conversationHistory, setConversationHistory] = useState<ConversationHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  // Filter and search comments
  const filteredComments = comments.filter(comment => {
    const matchesType = filterType === 'all' || 
      (filterType === 'resolved' ? comment.is_resolved : comment.type === filterType)
    const matchesSearch = !searchTerm || 
      comment.content.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesType && matchesSearch
  })

  // Sort comments by creation date (newest first, but pinned first)
  const sortedComments = [...filteredComments].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Group comments by type for summary
  const commentSummary = comments.reduce((acc, comment) => {
    acc[comment.type] = (acc[comment.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const resolvedCount = comments.filter(c => c.is_resolved).length
  const pinnedCount = comments.filter(c => c.is_pinned).length

  const emojis = ['👍', '👎', '❤️', '😄', '😮', '😢', '😡', '🎉', '🚀', '👀']

  // Fetch conversation history
  const fetchConversationHistory = async () => {
    if (!taskId || !tokens?.access_token) return
    
    try {
      setHistoryLoading(true)
      const response = await fetch(`${getApiUrlDynamic()}/api/comments/conversation-history/task/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setConversationHistory(data)
      }
    } catch (error) {
      console.error('Error fetching conversation history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Load conversation history when switching to history view
  useEffect(() => {
    if (activeView === 'history' && !conversationHistory) {
      fetchConversationHistory()
    }
  }, [activeView, taskId])

  // Helper function to format time in industry-standard way
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const messageTime = new Date(timestamp)
    const diffInMs = now.getTime() - messageTime.getTime()
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMinutes / 60)
    const diffInDays = Math.floor(diffInHours / 24)
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInDays < 7) return `${diffInDays}d ago`
    return messageTime.toLocaleDateString()
  }

  const formatFullTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Handle loading state within the main return instead of early return
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="comments-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading comments...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Enhanced Comments Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-6 mb-6 border border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center">
            <MessageSquare className="h-6 w-6 mr-3 text-blue-600" />
            Comments & Discussion
          </h3>
          
          {/* View Toggle */}
          <div className="flex items-center bg-white rounded-lg p-1 shadow-sm border border-gray-200">
            <button
              onClick={() => setActiveView('comments')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeView === 'comments'
                  ? 'bg-blue-100 text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Comments</span>
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeView === 'history'
                  ? 'bg-blue-100 text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <History className="h-4 w-4" />
              <span>History</span>
            </button>
          </div>
        </div>
        
        {/* Comments Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <div className="text-center bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-blue-600">{comments.length}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="text-center bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-green-600">{commentSummary.comment || 0}</div>
            <div className="text-sm text-gray-600">Comments</div>
          </div>
          <div className="text-center bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-purple-600">{commentSummary.review || 0}</div>
            <div className="text-sm text-gray-600">Reviews</div>
          </div>
          <div className="text-center bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-yellow-600">{pinnedCount}</div>
            <div className="text-sm text-gray-600">Pinned</div>
          </div>
          <div className="text-center bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-gray-600">{resolvedCount}</div>
            <div className="text-sm text-gray-600">Resolved</div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search comments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex space-x-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="comment">Comments</option>
              <option value="note">Notes</option>
              <option value="review">Reviews</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Add Comment Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Plus className="h-5 w-5 mr-2 text-green-600" />
          Add New Comment
        </h4>
        
        {/* Comment Type Selector */}
        <div className="flex space-x-2 mb-4">
          {[
            { type: 'comment', label: 'Comment', icon: '💬', color: 'blue' },
            { type: 'note', label: 'Note', icon: '📝', color: 'yellow' },
            { type: 'review', label: 'Review', icon: '👁️', color: 'purple' }
          ].map(({ type, label, icon, color }) => (
            <button
              key={type}
              onClick={() => setCommentType(type as any)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-colors ${
                commentType === type
                  ? `bg-${color}-100 text-${color}-800 border-${color}-300`
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <span>{icon}</span>
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={`Write a ${commentType}... Use @username to mention team members`}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
          />
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              <span className="flex items-center">
                💡 <span className="ml-1">Tips: Use @username for mentions, #tags for references</span>
              </span>
            </div>
            <button
              onClick={onAddComment}
              disabled={!newComment.trim()}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <Send className="h-4 w-4" />
              <span>Add {commentType.charAt(0).toUpperCase() + commentType.slice(1)}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content based on active view */}
      {activeView === 'comments' ? (
        <>
          {/* Comments List */}
          <div className="space-y-4">
            {sortedComments.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || filterType !== 'all' ? 'No matching comments' : 'Start the conversation!'}
            </h4>
            <p className="text-gray-600 mb-4">
              {searchTerm || filterType !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Be the first to add a comment, note, or review to this task.'
              }
            </p>
            {!searchTerm && filterType === 'all' && (
              <div className="text-sm text-gray-500">
                Comments help track decisions, updates, and team collaboration. 🚀
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Pinned Comments */}
            {sortedComments.filter(c => c.is_pinned).length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Pin className="h-5 w-5 mr-2 text-yellow-600" />
                  Pinned Messages
                </h4>
                <div className="space-y-3">
                  {sortedComments.filter(c => c.is_pinned).map((comment) => (
                    <CommentCard 
                      key={`pinned-${comment.id}`} 
                      comment={comment} 
                      availableUsers={availableUsers} 
                      isPinned={true}
                      showEmojiPicker={showEmojiPicker}
                      setShowEmojiPicker={setShowEmojiPicker}
                      emojis={emojis}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Comments */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
                <div className="flex items-center">
                  <History className="h-5 w-5 mr-2 text-gray-600" />
                  Discussion Timeline
                </div>
                <span className="text-sm font-normal text-gray-500">
                  Showing {sortedComments.length} of {comments.length} comments
                </span>
              </h4>
              
              <div className="space-y-4">
                {sortedComments.map((comment) => (
                  <CommentCard 
                    key={comment.id} 
                    comment={comment} 
                    availableUsers={availableUsers}
                    showEmojiPicker={showEmojiPicker}
                    setShowEmojiPicker={setShowEmojiPicker}
                    emojis={emojis}
                  />
                ))}
              </div>
            </div>
          </>
        )}
          </div>
        </>
      ) : (
        /* Conversation History View */
        <ConversationHistoryView
          conversationHistory={conversationHistory}
          loading={historyLoading}
          formatTimeAgo={formatTimeAgo}
          formatFullTime={formatFullTime}
          emojis={emojis}
          onRefresh={fetchConversationHistory}
        />
      )}
    </div>
  )
}

// Enhanced Comment Card Component
const CommentCard: React.FC<{
  comment: Comment
  availableUsers: any[]
  isPinned?: boolean
  showEmojiPicker: string | null
  setShowEmojiPicker: (id: string | null) => void
  emojis: string[]
}> = ({ comment, availableUsers, isPinned = false, showEmojiPicker, setShowEmojiPicker, emojis }) => {
  const user = availableUsers.find(u => u.id === comment.author_id)
  const isOldComment = new Date().getTime() - new Date(comment.created_at).getTime() > 7 * 24 * 60 * 60 * 1000 // 7 days
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyText, setReplyText] = useState('')

  const getCommentBorder = () => {
    if (isPinned) return 'border-l-4 border-l-yellow-400 bg-yellow-50'
    switch (comment.type) {
      case 'review': return 'border-l-4 border-l-purple-400 bg-purple-50'
      case 'approval': return 'border-l-4 border-l-green-400 bg-green-50'
      case 'note': return 'border-l-4 border-l-blue-400 bg-blue-50'
      default: return 'border-l-4 border-l-gray-400 bg-white'
    }
  }

  const getTypeIcon = () => {
    switch (comment.type) {
      case 'review': return '👁️'
      case 'approval': return '✅'
      case 'note': return '📝'
      case 'suggestion': return '💡'
      default: return '💬'
    }
  }

  const getTypeColor = () => {
    switch (comment.type) {
      case 'review': return 'bg-purple-100 text-purple-800'
      case 'approval': return 'bg-green-100 text-green-800'
      case 'note': return 'bg-blue-100 text-blue-800'
      case 'suggestion': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className={`rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 ${getCommentBorder()}`}>
      {/* Comment Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start space-x-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            comment.type === 'review' ? 'bg-purple-100' :
            comment.type === 'approval' ? 'bg-green-100' :
            comment.type === 'note' ? 'bg-blue-100' :
            'bg-gray-100'
          }`}>
            <User className={`h-5 w-5 ${
              comment.type === 'review' ? 'text-purple-600' :
              comment.type === 'approval' ? 'text-green-600' :
              comment.type === 'note' ? 'text-blue-600' :
              'text-gray-600'
            }`} />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <div className="font-semibold text-gray-900">
                {user ? `${user.first_name} ${user.last_name}` : 'Unknown User'}
              </div>
              {user && (
                <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  @{user.email.split('@')[0]}
                </div>
              )}
              {comment.is_edited && (
                <div className="text-xs text-gray-400 italic">(edited)</div>
              )}
            </div>
            
            <div className="text-sm text-gray-500 flex items-center space-x-2">
              <Clock className="h-3 w-3" />
              <span>{new Date(comment.created_at).toLocaleString()}</span>
              {isOldComment && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                  Archived
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Comment Type Badge */}
        <div className="flex items-center space-x-2">
          {isPinned && (
            <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium flex items-center">
              <Pin className="h-3 w-3 mr-1" />
              Pinned
            </div>
          )}
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeColor()}`}>
            <span className="mr-1">{getTypeIcon()}</span>
            {comment.type.charAt(0).toUpperCase() + comment.type.slice(1)}
          </div>
        </div>
      </div>
      
      {/* Comment Content */}
      <div className="text-gray-900 whitespace-pre-wrap mb-4 pl-13">
        {comment.content}
      </div>

      {/* Comment Metadata & Actions */}
      <div className="flex items-center justify-between pl-13">
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          {/* Reply Button */}
          <button
            onClick={() => setShowReplyForm(!showReplyForm)}
            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            <Reply className="h-3 w-3" />
            <span>Reply</span>
            {comment.reply_count > 0 && (
              <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-xs">
                {comment.reply_count}
              </span>
            )}
          </button>
          
          {/* Attachments */}
          {comment.attachments && comment.attachments.length > 0 && (
            <div className="flex items-center space-x-1">
              <Paperclip className="h-3 w-3" />
              <span>{comment.attachments.length} attachment{comment.attachments.length > 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Mentions */}
          {comment.mentions && comment.mentions.length > 0 && (
            <div className="flex items-center space-x-1">
              <User className="h-3 w-3" />
              <span>{comment.mentions.length} mention{comment.mentions.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Reactions */}
        <div className="flex items-center space-x-2">
          {/* Existing Reactions */}
          {comment.reactions && comment.reactions.length > 0 && (
            <div className="flex items-center space-x-1">
              {comment.reactions.slice(0, 3).map((reaction, idx) => (
                <button
                  key={idx} 
                  className="text-sm bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 cursor-pointer transition-colors"
                >
                  {reaction.emoji} 1
                </button>
              ))}
              {comment.reactions.length > 3 && (
                <span className="text-xs text-gray-500">+{comment.reactions.length - 3}</span>
              )}
            </div>
          )}
          
          {/* Add Reaction */}
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(showEmojiPicker === comment.id ? null : comment.id)}
              className="text-sm text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
            >
              <Smile className="h-4 w-4" />
            </button>
            
            {showEmojiPicker === comment.id && (
              <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2">
                <div className="grid grid-cols-5 gap-1">
                  {emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        // Handle emoji reaction
                        setShowEmojiPicker(null)
                      }}
                      className="p-2 hover:bg-gray-100 rounded text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reply Form */}
      {showReplyForm && (
        <div className="mt-4 pl-13">
          <div className="border-t border-gray-200 pt-4">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={2}
            />
            <div className="flex justify-end space-x-2 mt-2">
              <button
                onClick={() => {
                  setShowReplyForm(false)
                  setReplyText('')
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Handle reply submission
                  setShowReplyForm(false)
                  setReplyText('')
                }}
                disabled={!replyText.trim()}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Reply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolved Status */}
      {comment.is_resolved && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-sm">
          <div className="flex items-center text-green-800">
            <CheckSquare className="h-4 w-4 mr-2" />
            <span className="font-medium">Resolved</span>
            {comment.resolved_at && (
              <span className="ml-2 text-green-600">
                on {new Date(comment.resolved_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Conversation History View Component
const ConversationHistoryView: React.FC<{
  conversationHistory: ConversationHistory | null
  loading: boolean
  formatTimeAgo: (timestamp: string) => string
  formatFullTime: (timestamp: string) => string
  emojis: string[]
  onRefresh: () => void
}> = ({ conversationHistory, loading, formatTimeAgo, formatFullTime, emojis, onRefresh }) => {
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading conversation history...</p>
        </div>
      </div>
    )
  }

  if (!conversationHistory || conversationHistory.conversation_history.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <History className="h-16 w-16 mx-auto mb-4 text-gray-300" />
        <h4 className="text-lg font-medium text-gray-900 mb-2">No conversation history</h4>
        <p className="text-gray-600 mb-4">Start the conversation by adding the first comment!</p>
        <button
          onClick={onRefresh}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add First Comment</span>
        </button>
      </div>
    )
  }

  const { conversation_history, statistics, participants } = conversationHistory

  return (
    <div className="space-y-6">
      {/* Conversation Statistics */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <History className="h-5 w-5 mr-2 text-indigo-600" />
            Conversation History
          </h3>
          <button
            onClick={onRefresh}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="text-2xl font-bold text-blue-600">{statistics.total_messages}</div>
            <div className="text-sm text-blue-700">Total Messages</div>
          </div>
          <div className="text-center bg-green-50 rounded-lg p-3 border border-green-100">
            <div className="text-2xl font-bold text-green-600">{statistics.participants}</div>
            <div className="text-sm text-green-700">Participants</div>
          </div>
          <div className="text-center bg-yellow-50 rounded-lg p-3 border border-yellow-100">
            <div className="text-2xl font-bold text-yellow-600">{statistics.pinned_messages}</div>
            <div className="text-sm text-yellow-700">Pinned</div>
          </div>
          <div className="text-center bg-purple-50 rounded-lg p-3 border border-purple-100">
            <div className="text-2xl font-bold text-purple-600">{statistics.resolved_items}</div>
            <div className="text-sm text-purple-700">Resolved</div>
          </div>
        </div>

        {/* Timeline Info */}
        <div className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
          <span className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>
              {statistics.first_message && `Started ${formatFullTime(statistics.first_message)}`}
            </span>
          </span>
          <span className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>
              {statistics.last_message && `Last activity ${formatTimeAgo(statistics.last_message)}`}
            </span>
          </span>
        </div>
      </div>

      {/* Participants Overview */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center">
          <Users className="h-4 w-4 mr-2 text-blue-600" />
          Conversation Participants ({participants.length})
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {participants.map((participant) => (
            <div key={participant.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {participant.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">{participant.name}</div>
                <div className="text-sm text-gray-500 truncate">{participant.email}</div>
              </div>
              <div className="text-sm text-gray-400 bg-white px-2 py-1 rounded border">
                {participant.message_count} messages
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chronological Message History */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-medium text-gray-900 mb-6 flex items-center">
          <MessageSquare className="h-4 w-4 mr-2 text-green-600" />
          Complete Message Timeline
        </h4>
        
        <div className="space-y-6">
          {conversation_history.map((entry, index) => (
            <div key={entry.id} className="relative">
              {/* Timeline connector */}
              {index < conversation_history.length - 1 && (
                <div className="absolute left-8 top-16 w-0.5 h-8 bg-gray-200"></div>
              )}
              
              {/* Message Entry */}
              <div className={`flex items-start space-x-4 p-4 rounded-xl border transition-all hover:shadow-sm ${
                entry.is_pinned 
                  ? 'bg-yellow-50 border-yellow-200' 
                  : entry.type === 'review' 
                    ? 'bg-purple-50 border-purple-200'
                    : entry.type === 'note'
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white border-gray-200'
              }`}>
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${
                  entry.type === 'review' 
                    ? 'bg-gradient-to-br from-purple-500 to-purple-600' 
                    : entry.type === 'note'
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                      : 'bg-gradient-to-br from-gray-500 to-gray-600'
                }`}>
                  {entry.author.initials}
                </div>

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className="font-semibold text-gray-900">{entry.author.name}</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        entry.type === 'comment' 
                          ? 'bg-gray-100 text-gray-800'
                          : entry.type === 'note'
                            ? 'bg-blue-100 text-blue-800'
                            : entry.type === 'review'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-green-100 text-green-800'
                      }`}>
                        {entry.type === 'comment' ? '💬 Comment' :
                         entry.type === 'note' ? '📝 Note' :
                         entry.type === 'review' ? '👁️ Review' :
                         entry.type}
                      </span>
                      {entry.is_pinned && (
                        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full flex items-center">
                          <Pin className="h-3 w-3 mr-1" />
                          Pinned
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500" title={formatFullTime(entry.timestamp)}>
                      {formatTimeAgo(entry.timestamp)}
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="text-gray-800 mb-3 whitespace-pre-wrap leading-relaxed">
                    {entry.content}
                  </div>

                  {/* Message Metadata */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      {entry.mentions.length > 0 && (
                        <span className="flex items-center space-x-1">
                          <User className="h-3 w-3" />
                          <span>{entry.mentions.length} mention{entry.mentions.length > 1 ? 's' : ''}</span>
                        </span>
                      )}
                      {entry.attachments.length > 0 && (
                        <span className="flex items-center space-x-1">
                          <Paperclip className="h-3 w-3" />
                          <span>{entry.attachments.length} file{entry.attachments.length > 1 ? 's' : ''}</span>
                        </span>
                      )}
                      {entry.is_edited && (
                        <span className="flex items-center space-x-1 text-gray-400">
                          <Edit className="h-3 w-3" />
                          <span>Edited</span>
                        </span>
                      )}
                    </div>

                    {/* Reactions Display */}
                    <div className="flex items-center space-x-2">
                      {Object.entries(entry.reaction_summary).map(([emoji, data]) => (
                        <button
                          key={emoji}
                          className={`flex items-center space-x-1 px-2 py-1 rounded-full text-sm transition-colors ${
                            data.current_user_reacted
                              ? 'bg-blue-100 border border-blue-300 text-blue-800'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                          }`}
                          title={`${data.users.map(u => u.name).join(', ')} reacted with ${emoji}`}
                        >
                          <span>{emoji}</span>
                          <span className="font-medium">{data.count}</span>
                        </button>
                      ))}
                      
                      {/* Add Reaction Button */}
                      <div className="relative">
                        <button
                          onClick={() => setShowReactionPicker(showReactionPicker === entry.id ? null : entry.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          <Smile className="h-4 w-4" />
                        </button>
                        
                        {showReactionPicker === entry.id && (
                          <div className="absolute right-0 bottom-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2">
                            <div className="grid grid-cols-5 gap-1">
                              {emojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => {
                                    // Handle emoji reaction
                                    setShowReactionPicker(null)
                                  }}
                                  className="p-2 hover:bg-gray-100 rounded text-lg"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Resolved Status */}
                  {entry.is_resolved && (
                    <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-sm">
                      <div className="flex items-center text-green-800">
                        <CheckSquare className="h-4 w-4 mr-2" />
                        <span className="font-medium">Resolved</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* End of Timeline */}
        <div className="flex items-center justify-center mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Archive className="h-4 w-4" />
            <span>End of conversation history</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TaskCommentsTab