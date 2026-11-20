'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Share2, Mail, ChevronDown, ChevronUp, Copy, Check, Users } from 'lucide-react'

interface CapturedPost {
  id: string
  profileId: string
  profileName: string
  profileUrl: string | null
  postText: string
  postUrl: string | null
  postedAt: string | null
  likes: number | null
  comments: number | null
  twitterThread: string | null
  linkedinRepost: string | null
  newsletter: string | null
  createdAt: string
}

type Format = 'twitterThread' | 'linkedinRepost' | 'newsletter'

const FORMAT_META: Record<Format, { label: string; icon: React.ReactNode; color: string }> = {
  twitterThread:  { label: 'Twitter Thread', icon: <MessageSquare size={14} />, color: '#1d9bf0' },
  linkedinRepost: { label: 'LinkedIn Post',  icon: <Share2 size={14} />,        color: '#0a66c2' },
  newsletter:     { label: 'Newsletter',     icon: <Mail size={14} />,          color: '#7c3aed' },
}

function PostCard({ post, onTransformDone }: { post: CapturedPost; onTransformDone: (id: string, format: Format, result: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [activeFormat, setActiveFormat] = useState<Format | null>(null)
  const [loading, setLoading] = useState<Format | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedFormat, setCopiedFormat] = useState<Format | null>(null)

  const transform = useCallback(async (format: Format) => {
    setActiveFormat(format)
    setError(null)
    const cached = post[format]
    if (cached) return

    setLoading(format)
    try {
      const res = await fetch(`/api/captured-posts/${post.id}/transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      })
      if (res.ok) {
        const data = await res.json()
        onTransformDone(post.id, format, data[format])
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to generate — check your AI key in Settings.')
      }
    } catch {
      setError('Network error — check your connection.')
    } finally {
      setLoading(null)
    }
  }, [post, onTransformDone])

  const activeContent = activeFormat ? post[activeFormat] : null

  function copyText(text: string, format: Format) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedFormat(format)
      setTimeout(() => setCopiedFormat(null), 2000)
    })
  }

  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <a
            href={post.profileUrl || `https://www.linkedin.com/in/${post.profileId}`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontWeight: 600, color: '#0a66c2', textDecoration: 'none', fontSize: 14 }}
          >
            {post.profileName}
          </a>
          {post.postedAt && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{post.postedAt}</span>}
          {(post.likes != null || post.comments != null) && (
            <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>
              {post.likes != null ? `${post.likes} likes` : ''}{post.likes != null && post.comments != null ? ' · ' : ''}{post.comments != null ? `${post.comments} comments` : ''}
            </span>
          )}
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 2 }}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Post text preview */}
      <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {expanded ? post.postText : post.postText.slice(0, 200) + (post.postText.length > 200 ? '…' : '')}
      </p>
      {post.postText.length > 200 && (
        <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer', padding: '4px 0 0 0' }}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      {/* Transform buttons */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
        {(Object.entries(FORMAT_META) as [Format, typeof FORMAT_META[Format]][]).map(([fmt, meta]) => (
          <button
            key={fmt}
            onClick={() => transform(fmt)}
            disabled={loading === fmt}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              border: `1px solid ${activeFormat === fmt ? meta.color : '#e5e7eb'}`,
              background: activeFormat === fmt ? meta.color : 'white',
              color: activeFormat === fmt ? 'white' : '#374151',
              opacity: loading === fmt ? 0.6 : 1,
            }}
          >
            {meta.icon}
            {loading === fmt ? 'Generating…' : meta.label}
            {post[fmt] && activeFormat !== fmt && <span style={{ fontSize: 10, marginLeft: 2 }}>✓</span>}
          </button>
        ))}
      </div>

      {/* Generated content / error */}
      {activeFormat && (
        <div style={{ marginTop: 12, background: '#f9fafb', border: `1px solid ${error ? '#fca5a5' : '#e5e7eb'}`, borderRadius: 8, padding: 12 }}>
          {error ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ margin: 0, color: '#dc2626', fontSize: 12, flex: 1 }}>❌ {error}</p>
              <button
                onClick={() => { setError(null); transform(activeFormat) }}
                style={{
                  flexShrink: 0, padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626',
                }}
              >
                Retry
              </button>
            </div>
          ) : activeContent ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                <button
                  onClick={() => copyText(activeContent, activeFormat)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid #d1d5db', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: '#374151' }}
                >
                  {copiedFormat === activeFormat ? <Check size={12} /> : <Copy size={12} />}
                  {copiedFormat === activeFormat ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre style={{ margin: 0, fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6 }}>
                {activeContent}
              </pre>
            </>
          ) : (
            <p style={{ margin: 0, color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>Generating…</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function CapturedPostsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [posts, setPosts] = useState<CapturedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [profileFilter, setProfileFilter] = useState('')

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/captured-posts')
    if (res.ok) {
      const data = await res.json()
      setPosts(data.posts)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated') fetchPosts()
  }, [status, fetchPosts, router])

  const handleTransformDone = useCallback((id: string, format: Format, result: string) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, [format]: result } : p))
  }, [])

  // Unique profiles for the filter
  const profiles = Array.from(new Map(posts.map(p => [p.profileId, p.profileName])).entries())

  if (status === 'loading' || loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <p style={{ color: '#9ca3af' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Captured LinkedIn Posts</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Posts captured via the browser extension. Transform any post into a Twitter thread, LinkedIn repost, or newsletter section.
        </p>
      </div>

      {/* Filter bar */}
      {profiles.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <Users size={14} style={{ color: '#6b7280' }} />
          <span style={{ fontSize: 12, color: '#6b7280' }}>Filter by person:</span>
          <button
            onClick={() => setProfileFilter('')}
            style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
              border: `1px solid ${!profileFilter ? '#7c3aed' : '#d1d5db'}`,
              background: !profileFilter ? '#7c3aed' : 'white',
              color: !profileFilter ? 'white' : '#374151',
            }}
          >
            All ({posts.length})
          </button>
          {profiles.map(([profileId, profileName]) => {
            const count = posts.filter(p => p.profileId === profileId).length
            return (
              <button
                key={profileId}
                onClick={() => setProfileFilter(profileFilter === profileId ? '' : profileId)}
                style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                  border: `1px solid ${profileFilter === profileId ? '#7c3aed' : '#d1d5db'}`,
                  background: profileFilter === profileId ? '#7c3aed' : 'white',
                  color: profileFilter === profileId ? 'white' : '#374151',
                }}
              >
                {profileName} ({count})
              </button>
            )
          })}
        </div>
      )}

      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          <p style={{ fontSize: 15, marginBottom: 8 }}>No posts captured yet.</p>
          <p style={{ fontSize: 13 }}>
            Visit a LinkedIn profile and click <strong>&quot;Capture Posts&quot;</strong> in the extension panel.
          </p>
        </div>
      ) : (
        <div>
          {posts
            .filter(p => !profileFilter || p.profileId === profileFilter)
            .map(post => (
              <PostCard key={post.id} post={post} onTransformDone={handleTransformDone} />
            ))}
        </div>
      )}
    </div>
  )
}
