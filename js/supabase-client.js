// js/supabase-client.js - COMPLETE VERSION
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// ✅ SAME CREDENTIALS AS MOBILE APP
const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
const PROJECT_REF = 'ydnxqnbjoshvxteevemc'
// Flag to indicate unified view system is active (prevents duplicate view recording from supabase-client)
window._usingUnifiedViewSystem = true;

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Track initialization state
let _isInitialized = false
let _initializationAttempted = false

// ✅ INITIALIZATION (from initialize() in Dart)
export async function initialize() {
    if (_initializationAttempted) {
        console.log('⚠️ Supabase initialization already attempted')
        return
    }

    _initializationAttempted = true

    try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.log('⚠️ Supabase configuration missing - running in offline mode')
            return
        }

        // For web, client is automatically initialized when we create it
        // We just need to test the connection
        const { error } = await supabase.auth.getSession()
        if (error) {
            console.error('❌ Supabase connection test failed:', error)
            return
        }

        _isInitialized = true
        console.log('✅ Supabase initialized successfully')
    } catch (error) {
        console.error('❌ Supabase initialization error:', error)
    }
}

// Safe client access
function getClient() {
    if (!_isInitialized) {
        throw new Error('Supabase not initialized. Please check your network connection.')
    }
    return supabase
}

// Safe initialization check
export function isInitialized() {
    return _isInitialized
}

// ✅ GENERATE PUBLIC URL (from _generatePublicUrl in Dart)
export function generatePublicUrl(bucket, filePath) {
    return `https://${PROJECT_REF}.supabase.co/storage/v1/object/public/${bucket}/${filePath}`
}

// ✅ FIX MEDIA URL (from fixMediaUrl in Dart)
export function fixMediaUrl(mediaUrl) {
    if (mediaUrl.startsWith('http')) {
        return mediaUrl
    }
    
    if (mediaUrl.includes('thumbnails')) {
        return generatePublicUrl('content-thumbnails', mediaUrl)
    } else {
        return generatePublicUrl('content-media', mediaUrl)
    }
}

// ============ AUTHENTICATION METHODS ============

// ✅ SIGN UP (from signUp in Dart)
export async function signUp({ email, password, fullName, username }) {
    try {
        const client = getClient()
        
        // Generate username if not provided
        const generatedUsername = username || generateUsername(email)
        const displayName = fullName?.trim() || email.split('@')[0]

        console.log('🔄 Starting signup process for:', email)

        // Sign up with Supabase
        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: displayName,
                    username: generatedUsername,
                    role: 'creator'
                }
            }
        })

        if (error) throw error
        if (!data.user) throw new Error('Authentication failed - no user returned')

        const user = data.user
        console.log('✅ Auth user created:', user.id)

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 500))

        // Create creator record
        await ensureCreatorRecordExists({
            userId: user.id,
            email: email,
            fullName: displayName,
            username: generatedUsername
        })

        // Create user profile
        await ensureUserProfileExists({
            userId: user.id,
            email: email,
            fullName: displayName,
            username: generatedUsername
        })

        console.log('✅ Complete signup process finished successfully')
        return data
    } catch (error) {
        console.error('❌ Enhanced signup error:', error)
        throw error
    }
}

// ✅ SIGN IN (from signIn in Dart)
export async function signIn({ email, password }) {
    try {
        const client = getClient()
        console.log('🔄 Starting signin process for:', email)

        const { data, error } = await client.auth.signInWithPassword({
            email,
            password
        })

        if (error) throw error
        if (!data.user) throw new Error('Authentication failed')

        const user = data.user
        console.log('✅ User authenticated:', user.id)

        // Optional database validation
        try {
            await ensureCreatorRecordExists({
                userId: user.id,
                email: user.email,
                fullName: user.user_metadata?.full_name || user.email.split('@')[0],
                username: user.user_metadata?.username || generateUsername(user.email)
            })

            await ensureUserProfileExists({
                userId: user.id,
                email: user.email,
                fullName: user.user_metadata?.full_name || user.email.split('@')[0],
                username: user.user_metadata?.username || generateUsername(user.email)
            })
        } catch (dbError) {
            console.log('⚠️ Database validation failed (non-fatal):', dbError)
        }

        console.log('✅ Enhanced signin process finished successfully')
        return data
    } catch (error) {
        console.error('❌ Enhanced signin error:', error)
        throw error
    }
}

// ✅ SIGN OUT (from signOut in Dart)
export async function signOut() {
    try {
        const client = getClient()
        const { error } = await client.auth.signOut()
        if (error) throw error
        console.log('✅ Sign out successful')
    } catch (error) {
        console.error('❌ Sign out error:', error)
        throw error
    }
}

// ✅ GET CURRENT USER (from getCurrentUser in Dart)
export function getCurrentUser() {
    try {
        const client = getClient()
        const { data: { user } } = client.auth.getUser()
        return user
    } catch (error) {
        console.error('❌ Get current user error:', error)
        return null
    }
}

// ✅ IS AUTHENTICATED (from isAuthenticated in Dart)
export function isAuthenticated() {
    return getCurrentUser() !== null
}

// ✅ LEGACY METHODS for backward compatibility
export async function signUpWithEmail(email, password) {
    return signUp({ email, password })
}

export async function signInWithEmail(email, password) {
    return signIn({ email, password })
}

// ✅ HELPER: Generate unique username
function generateUsername(email) {
    const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')
    const timestamp = Date.now().toString().slice(-6)
    return `${emailPrefix}_${timestamp}`
}

// ✅ HELPER: Ensure creators record exists
async function ensureCreatorRecordExists({ userId, email, fullName, username }) {
    try {
        const client = getClient()
        
        // Check if creators record exists
        const { data: existingCreator, error: checkError } = await client
            .from('creators')
            .select('id, auth_uid, email, username')
            .eq('id', userId)
            .maybeSingle()

        if (checkError) throw checkError
        
        if (existingCreator) {
            console.log('✅ Creators record already exists:', existingCreator.email)
            return
        }

        // Create creators record manually
        const { error: insertError } = await client
            .from('creators')
            .upsert({
                id: userId,
                auth_uid: userId,
                email: email,
                username: username,
                joined_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            })

        if (insertError) throw insertError
        console.log('✅ Creators record created/updated successfully')
    } catch (error) {
        console.error('⚠️ Creators record handling error:', error)
    }
}

// ✅ HELPER: Ensure user profile exists
async function ensureUserProfileExists({ userId, email, fullName, username }) {
    try {
        const client = getClient()
        
        // Check if user profile exists
        const { data: existingProfile, error: checkError } = await client
            .from('user_profiles')
            .select('id, email, username, full_name')
            .eq('id', userId)
            .maybeSingle()

        if (checkError) throw checkError
        
        if (existingProfile) {
            console.log('✅ User profile already exists:', existingProfile.email)
            return
        }

        // Create user profile manually
        const { error: insertError } = await client
            .from('user_profiles')
            .upsert({
                id: userId,
                email: email,
                full_name: fullName,
                username: username,
                role: 'creator',
                created_at: new Date().toISOString()
            })

        if (insertError) throw insertError
        console.log('✅ User profile created/updated successfully')
    } catch (error) {
        console.error('⚠️ User profile handling error:', error)
    }
}

// ============ FILE UPLOAD METHODS ============

// ✅ UPLOAD MEDIA FILE (from uploadMediaFile in Dart)
export async function uploadMediaFile({ file, fileName, userId }) {
    try {
        const client = getClient()
        const uniqueFileName = `${Date.now()}_${fileName}`
        const fullPath = `${userId}/media/${uniqueFileName}`

        console.log('📁 Uploading media file:', fullPath)
        console.log('📊 File size:', file.size, 'bytes')

        const { data, error } = await client.storage
            .from('content-media')
            .upload(fullPath, file)

        if (error) throw error

        const publicUrl = generatePublicUrl('content-media', fullPath)
        console.log('✅ Media uploaded successfully')
        console.log('🔗 Public URL:', publicUrl)

        return publicUrl
    } catch (error) {
        console.error('❌ Media upload error:', error)
        throw new Error(`Media upload failed: ${error.message}`)
    }
}

// ✅ UPLOAD THUMBNAIL (from uploadThumbnail in Dart)
export async function uploadThumbnail({ file, fileName, userId }) {
    try {
        const client = getClient()
        const uniqueFileName = `thumb_${Date.now()}_${fileName}`
        const fullPath = `${userId}/thumbnails/${uniqueFileName}`

        console.log('🖼️ Uploading thumbnail:', fullPath)

        const { data, error } = await client.storage
            .from('content-thumbnails')
            .upload(fullPath, file)

        if (error) throw error

        const publicUrl = generatePublicUrl('content-thumbnails', fullPath)
        console.log('✅ Thumbnail uploaded successfully')
        console.log('🔗 Public URL:', publicUrl)

        return publicUrl
    } catch (error) {
        console.error('❌ Thumbnail upload error:', error)
        throw new Error(`Thumbnail upload failed: ${error.message}`)
    }
}

// ✅ UPLOAD PROFILE PICTURE (from uploadProfilePicture in Dart)
export async function uploadProfilePicture({ file, userId }) {
    try {
        const client = getClient()
        const uniqueFileName = `avatar_${Date.now()}`
        const fullPath = `${userId}/profile/${uniqueFileName}`

        console.log('🖼️ Uploading profile picture:', fullPath)

        const { data, error } = await client.storage
            .from('profile-pictures')
            .upload(fullPath, file)

        if (error) throw error

        const publicUrl = generatePublicUrl('profile-pictures', fullPath)
        console.log('✅ Profile picture uploaded:', publicUrl)

        return publicUrl
    } catch (error) {
        console.error('❌ Profile picture upload error:', error)
        throw new Error(`Profile picture upload failed: ${error.message}`)
    }
}

// ✅ UPDATE USER PROFILE (from updateUserProfile in Dart)
export async function updateUserProfile({ userId, bio, avatarUrl, fullName }) {
    try {
        const client = getClient()
        
        const updates = {}
        if (bio !== undefined) updates.bio = bio
        if (avatarUrl !== undefined) updates.avatar_url = avatarUrl
        if (fullName !== undefined) updates.full_name = fullName
        updates.updated_at = new Date().toISOString()

        const { error } = await client
            .from('user_profiles')
            .update(updates)
            .eq('id', userId)

        if (error) throw error
        console.log('✅ User profile updated successfully')
    } catch (error) {
        console.error('❌ Update user profile error:', error)
        throw error
    }
}

// ============ CONTENT MANAGEMENT METHODS ============

// ✅ CREATE CONTENT (from createContent in Dart)
export async function createContent({
    title,
    description,
    mediaFilePath,
    thumbnailUrl,
    mediaType,
    genre
}) {
    try {
        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        console.log('🔄 Creating content in Content table...')
        console.log('📝 Title:', title)
        console.log('🎭 Genre:', genre)

        const data = {
            title,
            description,
            media_type: mediaType,
            thumbnail_url: thumbnailUrl,
            file_url: mediaFilePath,
            user_id: user.id,
            creator_id: user.id,
            status: 'published',
            created_at: new Date().toISOString()
        }

        if (genre && genre.trim()) {
            data.genre = genre
        }

        const { data: response, error } = await client
            .from('Content')
            .insert(data)
            .select()
            .single()

        if (error) throw error

        console.log('✅ Content created successfully:', response.title)
        console.log('🆔 Content ID:', response.id)
        console.log('🎭 Genre saved:', response.genre || 'Not set')

        return response
    } catch (error) {
        console.error('❌ Create content error:', error)
        throw new Error(`Failed to save content: ${error.message}`)
    }
}

// ✅ UPLOAD CONTENT (alias for createContent)
export async function uploadContent({
    title,
    description,
    mediaType,
    thumbnailUrl,
    fileUrl,
    genre
}) {
    return createContent({
        title,
        description,
        mediaFilePath: fileUrl,
        thumbnailUrl,
        mediaType,
        genre
    })
}

// ✅ UPDATE CONTENT (from updateContent in Dart)
export async function updateContent({
    contentId,
    title,
    description,
    thumbnailUrl,
    genre
}) {
    try {
        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        const updateData = {
            title,
            description,
            updated_at: new Date().toISOString()
        }

        if (thumbnailUrl) updateData.thumbnail_url = thumbnailUrl
        if (genre !== undefined) updateData.genre = genre

        const { data, error } = await client
            .from('Content')
            .update(updateData)
            .eq('id', contentId)
            .eq('user_id', user.id)
            .select()
            .single()

        if (error) throw error

        console.log('✅ Content updated:', data.title)
        if (genre !== undefined) console.log('🎭 Genre updated to:', genre)

        return data
    } catch (error) {
        console.error('❌ Update content error:', error)
        throw error
    }
}

// ✅ DELETE CONTENT (from deleteContent in Dart)
export async function deleteContent(contentId) {
    try {
        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        // Get content to check ownership and get file paths
        const { data: content, error: fetchError } = await client
            .from('Content')
            .select('id, user_id, file_url, thumbnail_url')
            .eq('id', contentId)
            .eq('user_id', user.id)
            .single()

        if (fetchError) throw fetchError

        // Delete storage files if they exist
        try {
            if (content.file_url) {
                let filePath = content.file_url
                if (filePath.startsWith('http')) {
                    const url = new URL(filePath)
                    filePath = url.pathname.split('/').slice(3).join('/')
                }
                await client.storage.from('content-media').remove([filePath])
            }

            if (content.thumbnail_url) {
                let thumbPath = content.thumbnail_url
                if (thumbPath.startsWith('http')) {
                    const url = new URL(thumbPath)
                    thumbPath = url.pathname.split('/').slice(3).join('/')
                }
                await client.storage.from('content-thumbnails').remove([thumbPath])
            }
        } catch (storageError) {
            console.log('⚠️ Storage cleanup failed (non-fatal):', storageError)
        }

        // Delete the content record
        const { error: deleteError } = await client
            .from('Content')
            .delete()
            .eq('id', contentId)
            .eq('user_id', user.id)

        if (deleteError) throw deleteError

        console.log('✅ Content deleted successfully:', contentId)
    } catch (error) {
        console.error('❌ Delete content error:', error)
        throw error
    }
}

// ✅ GET USER CONTENT (from getUserContent in Dart)
export async function getUserContent() {
    try {
        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        const { data, error } = await client
            .from('Content')
            .select(`
                *,
                user_profiles!user_id(full_name, username, avatar_url)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) throw error

        console.log('✅ Content fetched:', data.length, 'items')
        return data
    } catch (error) {
        console.error('❌ Get user content error:', error)
        throw error
    }
}

// ✅ GET CONTENT INSIGHTS (from getContentInsights in Dart)
export async function getContentInsights(contentId) {
    try {
        const client = getClient()
        
        // Get basic content stats
        const { data: contentResponse, error: contentError } = await client
            .from('Content')
            .select('views_count, likes_count, comments_count')
            .eq('id', contentId)
            .single()

        if (contentError) throw contentError

        // Get detailed view analytics
        const { data: viewsResponse, error: viewsError } = await client
            .from('content_views')
            .select('view_duration, device_type')
            .eq('content_id', contentId)

        if (viewsError) throw viewsError

        // Calculate analytics
        let totalViewDuration = 0
        const deviceBreakdown = {}

        viewsResponse.forEach(view => {
            totalViewDuration += view.view_duration || 0
            const deviceType = view.device_type || 'unknown'
            deviceBreakdown[deviceType] = (deviceBreakdown[deviceType] || 0) + 1
        })

        const averageViewDuration = viewsResponse.length > 0 
            ? totalViewDuration / viewsResponse.length 
            : 0

        return {
            total_views: contentResponse.views_count || 0,
            total_likes: contentResponse.likes_count || 0,
            total_comments: contentResponse.comments_count || 0,
            total_view_duration: totalViewDuration,
            average_view_duration: averageViewDuration,
            device_breakdown: deviceBreakdown
        }
    } catch (error) {
        console.error('Error getting content insights:', error)
        throw error
    }
}

// ============ HOME FEED METHODS ============

// ✅ GET HOME FEED CONTENT (from getHomeFeedContent in Dart)
export async function getHomeFeedContent(limit = 50, category = null) {
    try {
        if (!_isInitialized) {
            console.log('⚠️ Supabase not initialized, returning empty feed')
            return []
        }

        console.log('🔄 Fetching home feed content...')
        console.log('🎭 Category filter:', category || 'All')

        const client = getClient()
        let query = client
            .from('Content')
            .select(`
                id,
                title,
                description,
                thumbnail_url,
                media_type,
                file_url,
                created_at,
                user_id,
                creator_id,
                genre,
                status,
                user_profiles!user_id(
                    full_name,
                    username,
                    avatar_url
                )
            `)
            .eq('status', 'published')

        if (category && category !== 'All') {
            query = query.eq('genre', category)
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw error

        console.log('📊 Raw content count from query:', data.length)

        // Process with creator names
        const contentWithCreatorNames = data.map(item => {
            let creatorDisplayName = 'Content Creator'
            
            if (item.user_profiles) {
                creatorDisplayName = item.user_profiles.full_name || 
                                   item.user_profiles.username || 
                                   'Content Creator'
                
                if (creatorDisplayName === 'Content Creator') {
                    console.log('⚠️ Could not resolve creator name for content', item.id)
                }
            }

            return {
                id: item.id,
                title: item.title || 'Untitled',
                description: item.description || '',
                thumbnail_url: item.thumbnail_url,
                file_url: item.file_url,
                media_type: item.media_type || 'video',
                genre: item.genre,
                created_at: item.created_at,
                creator: creatorDisplayName,
                creator_display_name: creatorDisplayName,
                creator_id: item.creator_id,
                user_id: item.user_id,
                views: item.views_count || 0,
                likes: item.likes_count || 0
            }
        })

        console.log('✅ Home feed loaded:', contentWithCreatorNames.length, 'items')
        return contentWithCreatorNames
    } catch (error) {
        console.error('❌ Get home feed content error:', error)
        return []
    }
}

// ✅ GET CONTENT WITH CREATOR (from getContentWithCreator in Dart)
export async function getContentWithCreator(contentId) {
    try {
        const client = getClient()
        
        const { data, error } = await client
            .from('Content')
            .select(`
                *,
                user_profiles!user_id(
                    full_name,
                    username,
                    avatar_url
                )
            `)
            .eq('id', contentId)
            .eq('status', 'published')
            .single()

        if (error) throw error
        if (!data) return null

        let creatorDisplayName = 'Content Creator'
        if (data.user_profiles) {
            creatorDisplayName = data.user_profiles.full_name || 
                               data.user_profiles.username || 
                               'Content Creator'
        }

        return {
            ...data,
            creator_display_name: creatorDisplayName,
            creator: creatorDisplayName
        }
    } catch (error) {
        console.error('❌ Get content with creator error:', error)
        return null
    }
}

// ✅ GET SIMILAR CONTENT (from getSimilarContent in Dart)
export async function getSimilarContent({ currentContentId, currentGenre, limit = 10 }) {
    try {
        const client = getClient()
        
        if (currentGenre && currentGenre.trim()) {
            const { data, error } = await client
                .from('Content')
                .select(`
                    id, title, description, thumbnail_url, 
                    media_type, file_url, created_at, user_id, 
                    creator_id, genre,
                    user_profiles!user_id(full_name, username, avatar_url)
                `)
                .neq('id', currentContentId)
                .eq('status', 'published')
                .eq('genre', currentGenre)
                .order('created_at', { ascending: false })
                .limit(limit)

            if (error) throw error
            
            console.log('✅ Similar content found by genre:', data.length, 'items')
            return data
        } else {
            // Get current content to find creator
            const { data: currentContent, error: currentError } = await client
                .from('Content')
                .select('creator_id')
                .eq('id', currentContentId)
                .single()

            if (currentError) throw currentError

            const { data, error } = await client
                .from('Content')
                .select(`
                    id, title, description, thumbnail_url, 
                    media_type, file_url, created_at, user_id, 
                    creator_id, genre,
                    user_profiles!user_id(full_name, username, avatar_url)
                `)
                .neq('id', currentContentId)
                .eq('status', 'published')
                .eq('creator_id', currentContent.creator_id)
                .order('created_at', { ascending: false })
                .limit(limit)

            if (error) throw error
            
            console.log('✅ Similar content found by creator:', data.length, 'items')
            return data
        }
    } catch (error) {
        console.error('❌ Get similar content error:', error)
        return []
    }
}

// ============ NOTIFICATION METHODS ============

// ✅ GET UNREAD NOTIFICATIONS (from getUnreadNotifications in Dart)
export async function getUnreadNotifications(userId) {
    try {
        if (!_isInitialized) {
            console.log('⚠️ Supabase not initialized, returning empty notifications')
            return []
        }

        const user = getCurrentUser()
        if (!user) {
            console.log('⚠️ User not authenticated, returning empty notifications')
            return []
        }

        console.log('🔄 Fetching unread notifications for user:', userId)

        const client = getClient()
        const { data, error } = await client
            .from('notifications')
            .select(`
                id,
                type,
                title,
                message,
                content_id,
                content_title,
                content_type,
                sender_name,
                sender_avatar,
                is_read,
                created_at
            `)
            .eq('user_id', userId)
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(50)

        if (error) throw error

        console.log('✅ Unread notifications fetched successfully:', data.length, 'items')
        return data
    } catch (error) {
        console.error('❌ Get unread notifications error:', error)
        return []
    }
}

// ✅ GET ALL NOTIFICATIONS (from getAllNotifications in Dart)
export async function getAllNotifications(userId) {
    try {
        if (!_isInitialized) {
            console.log('⚠️ Supabase not initialized, returning empty notifications')
            return []
        }

        const user = getCurrentUser()
        if (!user) {
            console.log('⚠️ User not authenticated, returning empty notifications')
            return []
        }

        console.log('🔄 Fetching notifications for user:', userId)

        const client = getClient()
        const { data, error } = await client
            .from('notifications')
            .select(`
                id,
                type,
                title,
                message,
                content_id,
                content_title,
                content_type,
                sender_name,
                sender_avatar,
                is_read,
                created_at
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100)

        if (error) throw error

        console.log('✅ Notifications fetched successfully:', data.length, 'items')
        return data
    } catch (error) {
        console.error('❌ Get all notifications error:', error)
        return []
    }
}

// ✅ MARK NOTIFICATION AS READ (from markNotificationAsRead in Dart)
export async function markNotificationAsRead(notificationId) {
    try {
        const client = getClient()
        
        const { error } = await client
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId)

        if (error) throw error
    } catch (error) {
        console.error('❌ Mark notification as read error:', error)
        throw new Error(`Failed to mark notification as read: ${error.message}`)
    }
}

// ✅ MARK ALL NOTIFICATIONS AS READ (from markAllNotificationsAsRead in Dart)
export async function markAllNotificationsAsRead(userId) {
    try {
        const client = getClient()
        
        const { error } = await client
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false)

        if (error) throw error
    } catch (error) {
        console.error('❌ Mark all notifications as read error:', error)
        throw new Error(`Failed to mark all notifications as read: ${error.message}`)
    }
}

// ✅ CLEAR ALL NOTIFICATIONS (from clearAllNotifications in Dart)
export async function clearAllNotifications(userId) {
    try {
        const client = getClient()
        
        const { error } = await client
            .from('notifications')
            .delete()
            .eq('user_id', userId)

        if (error) throw error
    } catch (error) {
        console.error('❌ Clear all notifications error:', error)
        throw new Error(`Failed to clear notifications: ${error.message}`)
    }
}

// ✅ CREATE NOTIFICATION (from createNotification in Dart)
export async function createNotification({
    userId,
    type,
    title,
    message,
    contentId,
    contentTitle,
    contentType,
    senderName,
    senderAvatar
}) {
    try {
        const client = getClient()
        
        await client.from('notifications').insert({
            user_id: userId,
            type: type,
            title: title,
            message: message,
            content_id: contentId,
            content_title: contentTitle,
            content_type: contentType,
            sender_name: senderName,
            sender_avatar: senderAvatar,
            is_read: false
        })

        console.log('✅ Notification created for user:', userId)
    } catch (error) {
        console.error('❌ Create notification error:', error)
        throw new Error(`Failed to create notification: ${error.message}`)
    }
}

// ✅ GET UNREAD NOTIFICATION COUNT (from getUnreadNotificationCount in Dart)
export async function getUnreadNotificationCount(userId) {
    try {
        if (!_isInitialized) return 0
        
        const user = getCurrentUser()
        if (!user) return 0

        const client = getClient()
        const { count, error } = await client
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false)

        if (error) throw error
        return count || 0
    } catch (error) {
        console.error('❌ Get notification count error:', error)
        return 0
    }
}

// ============ ANALYTICS & ENGAGEMENT METHODS ============

// ✅ GET CREATOR ANALYTICS (from getCreatorAnalytics in Dart)
export async function getCreatorAnalytics() {
    try {
        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        console.log('🔄 Loading creator analytics for:', user.id)

        const client = getClient()
        
        // Get content count
        const { count: contentCount, error: contentError } = await client
            .from('Content')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)

        if (contentError) throw contentError

        // Get view counts
        let totalViews = 0
        try {
            const { count: viewsCount, error: viewsError } = await client
                .from('content_views')
                .select('content_id', { count: 'exact', head: true })
                .eq('viewer_id', user.id)

            if (!viewsError) totalViews = viewsCount || 0
        } catch (e) {
            console.log('⚠️ content_views table not accessible:', e)
        }

        // Get connector count
        let totalConnectors = 0
        try {
            const { count: connectorsCount, error: connectorsError } = await client
                .from('connectors')
                .select('id', { count: 'exact', head: true })
                .eq('connected_id', user.id)
                .eq('connection_type', 'creator')

            if (!connectorsError) totalConnectors = connectorsCount || 0
        } catch (e) {
            console.log('⚠️ connectors table not accessible:', e)
        }

        const analytics = {
            total_views: totalViews,
            total_likes: 0, // Add likes functionality later
            total_connectors: totalConnectors,
            total_earnings: 0.00,
            total_uploads: contentCount || 0
        }

        console.log('✅ Creator analytics calculated:', analytics)
        return analytics
    } catch (error) {
        console.error('❌ Get creator analytics error:', error)
        return {
            total_views: 0,
            total_likes: 0,
            total_connectors: 0,
            total_earnings: 0.00,
            total_uploads: 0
        }
    }
}

// ✅ GET CREATOR DASHBOARD DATA (from getCreatorDashboardData in Dart)
export async function getCreatorDashboardData() {
    try {
        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        console.log('🔄 Loading creator dashboard data for:', user.id)

        // Validate and fix creator record
        await validateAndFixCreatorRecord(user.id, user.email)

        // Get analytics
        let analytics
        try {
            analytics = await getCreatorAnalytics()
        } catch (e) {
            console.log('⚠️ Analytics fallback:', e)
            analytics = {
                total_views: 0,
                total_likes: 0,
                total_connectors: 0,
                total_earnings: 0.00,
                total_uploads: 0
            }
        }

        // Get user content
        let content
        try {
            content = await getUserContent()
        } catch (e) {
            console.log('⚠️ Content loading fallback:', e)
            content = []
        }

        // Get user info
        let displayName = 'Creator'
        let email = user.email || ''

        try {
            // Try user_profiles first
            const { data: profile, error: profileError } = await client
                .from('user_profiles')
                .select('full_name, username, email, avatar_url, bio')
                .eq('id', user.id)
                .maybeSingle()

            if (!profileError && profile) {
                displayName = profile.full_name || profile.username || 'Creator'
                email = profile.email || user.email || ''
            } else {
                // Fallback to creators table
                const { data: creator, error: creatorError } = await client
                    .from('creators')
                    .select('email, username')
                    .eq('auth_uid', user.id)
                    .maybeSingle()

                if (!creatorError && creator) {
                    displayName = creator.username || 'Creator'
                    email = creator.email || user.email || ''
                }
            }
        } catch (e) {
            console.log('⚠️ Profile lookup failed, using auth metadata:', e)
            displayName = user.user_metadata?.full_name || 
                         user.email?.split('@')[0] || 
                         'Creator'
            email = user.email || ''
        }

        const avatarUrl = await getUserAvatarUrl(user.id)
        const bio = await getUserBio(user.id)

        const dashboardData = {
            user: {
                id: user.id,
                email: email,
                name: displayName,
                avatar_url: avatarUrl,
                bio: bio
            },
            analytics: analytics,
            content: content
        }

        console.log('✅ Creator dashboard data loaded successfully')
        return dashboardData
    } catch (error) {
        console.error('❌ Dashboard data loading error:', error)
        throw error
    }
}

// ✅ HELPER: Get user avatar URL
async function getUserAvatarUrl(userId) {
    try {
        const client = getClient()
        const { data, error } = await client
            .from('user_profiles')
            .select('avatar_url')
            .eq('id', userId)
            .maybeSingle()

        if (error) throw error
        return data?.avatar_url
    } catch (error) {
        return null
    }
}

// ✅ HELPER: Get user bio
async function getUserBio(userId) {
    try {
        const client = getClient()
        const { data, error } = await client
            .from('user_profiles')
            .select('bio')
            .eq('id', userId)
            .maybeSingle()

        if (error) throw error
        return data?.bio
    } catch (error) {
        return null
    }
}

// ✅ VALIDATE AND FIX CREATOR RECORD (from _validateAndFixCreatorRecord in Dart)
async function validateAndFixCreatorRecord(userId, userEmail) {
    try {
        const client = getClient()
        
        // Check if creators record exists with correct auth_uid
        const { data: existingCreator, error: existingError } = await client
            .from('creators')
            .select('id, auth_uid, email, username')
            .eq('auth_uid', userId)
            .maybeSingle()

        if (!existingError && existingCreator) {
            console.log('✅ Valid creators record found:', existingCreator.email)
            return
        }

        // Check if there's a record with wrong auth_uid but matching email
        const { data: creatorByEmail, error: emailError } = await client
            .from('creators')
            .select('id, auth_uid, email, username')
            .eq('email', userEmail)
            .maybeSingle()

        if (!emailError && creatorByEmail) {
            // Fix the auth_uid
            await client
                .from('creators')
                .update({ auth_uid: userId })
                .eq('email', userEmail)

            console.log('🔧 Fixed creators record auth_uid for:', userEmail)
            return
        }

        // Create new creator record if none exists
        const username = generateUsername(userEmail)
        await client.from('creators').insert({
            id: userId,
            auth_uid: userId,
            email: userEmail,
            username: username,
            joined_at: new Date().toISOString(),
            created_at: new Date().toISOString()
        })

        console.log('✅ Created new creators record for:', userEmail)
    } catch (error) {
        console.log('⚠️ Creator record validation failed:', error)
    }
}

// ✅ RECORD CONTENT VIEW (from recordContentView in Dart)
export async function recordContentView(contentId, viewDuration = 0) {
    // ✅ GUARD: Skip if unified view system is active (prevents duplicate recording)
    if (window._usingUnifiedViewSystem) {
        console.log('⚠️ Using unified view system, skipping duplicate record in supabase-client');
        return;
    }
    
    try {
        const user = getCurrentUser()
        const client = getClient()
        
        await client.from('content_views').insert({
            content_id: contentId,
            viewer_id: user?.id,
            view_duration: viewDuration,
            device_type: 'web'
        })

        // Add to watch history
        if (user) {
            await addToWatchHistory(contentId, viewDuration)
        }

        console.log('✅ Content view recorded for content ID:', contentId)
    } catch (error) {
        console.log('❌ Record content view error:', error)
    }
}
// ============ CONNECTOR METHODS ============

// ✅ CONNECT WITH USER (from connectWithUser in Dart)
export async function connectWithUser({ connectorId, connectedId, connectionType }) {
    try {
        const client = getClient()
        
        await client.from('connectors').insert({
            connector_id: connectorId,
            connected_id: connectedId,
            connection_type: connectionType
        })

        console.log(`✅ ${connectorId} connected with ${connectedId} (${connectionType})`)
    } catch (error) {
        console.error('❌ Connect with user error:', error)
        throw error
    }
}

// ✅ DISCONNECT FROM USER (from disconnectFromUser in Dart)
export async function disconnectFromUser({ connectorId, connectedId, connectionType }) {
    try {
        const client = getClient()
        
        await client
            .from('connectors')
            .delete()
            .eq('connector_id', connectorId)
            .eq('connected_id', connectedId)
            .eq('connection_type', connectionType)

        console.log(`✅ ${connectorId} disconnected from ${connectedId} (${connectionType})`)
    } catch (error) {
        console.error('❌ Disconnect from user error:', error)
        throw error
    }
}

// ✅ CHECK IF CONNECTED (from isConnectedTo in Dart)
export async function isConnectedTo({ connectedId, connectionType }) {
    try {
        const user = getCurrentUser()
        if (!user) return false

        const client = getClient()
        const { data, error } = await client
            .from('connectors')
            .select()
            .eq('connector_id', user.id)
            .eq('connected_id', connectedId)
            .eq('connection_type', connectionType)
            .maybeSingle()

        if (error) throw error
        return data !== null
    } catch (error) {
        console.error('❌ Check connection error:', error)
        return false
    }
}

// ✅ GET CONNECTOR COUNT (from getConnectorCount in Dart)
export async function getConnectorCount(userId, userType) {
    try {
        const client = getClient()
        const { count, error } = await client
            .from('connectors')
            .select('id', { count: 'exact', head: true })
            .eq('connected_id', userId)
            .eq('connection_type', userType)

        if (error) throw error
        return count || 0
    } catch (error) {
        console.error('❌ Get connector count error:', error)
        return 0
    }
}

// ✅ GET CONNECTING COUNT (from getConnectingCount in Dart)
export async function getConnectingCount(userId) {
    try {
        const client = getClient()
        const { count, error } = await client
            .from('connectors')
            .select('id', { count: 'exact', head: true })
            .eq('connector_id', userId)

        if (error) throw error
        return count || 0
    } catch (error) {
        console.error('❌ Get connecting count error:', error)
        return 0
    }
}

// ✅ GET CONNECTORS (from getConnectors in Dart)
export async function getConnectors(userId, userType) {
    try {
        const client = getClient()
        const { data, error } = await client
            .from('connectors')
            .select(`
                connector:connector_id (
                    id, full_name, username, avatar_url, bio
                ),
                created_at
            `)
            .eq('connected_id', userId)
            .eq('connection_type', userType)
            .order('created_at', { ascending: false })

        if (error) throw error

        const connectors = data.map(item => ({
            ...item.connector,
            connected_at: item.created_at
        }))

        console.log('✅ Loaded', connectors.length, 'connectors')
        return connectors
    } catch (error) {
        console.error('❌ Get connectors error:', error)
        return []
    }
}

// ✅ GET CONNECTIONS (from getConnections in Dart)
export async function getConnections(userId) {
    try {
        const client = getClient()
        const { data, error } = await client
            .from('connectors')
            .select(`
                connected:connected_id (
                    id, full_name, username, avatar_url, bio
                ),
                connection_type,
                created_at
            `)
            .eq('connector_id', userId)
            .order('created_at', { ascending: false })

        if (error) throw error

        const connections = data.map(item => ({
            ...item.connected,
            connection_type: item.connection_type,
            connected_at: item.created_at
        }))

        console.log('✅ Loaded', connections.length, 'connections')
        return connections
    } catch (error) {
        console.error('❌ Get connections error:', error)
        return []
    }
}

// ✅ GET CONNECTORS LIST (from getConnectorsList in Dart)
export async function getConnectorsList(connectedId, connectionType) {
    try {
        const client = getClient()
        const { data, error } = await client
            .from('connections')
            .select(`
                connector:connector_id (id, username, full_name, avatar_url)
            `)
            .eq('connected_id', connectedId)
            .eq('connection_type', connectionType)

        if (error) throw error

        const connectors = data
            .map(item => item.connector)
            .filter(connector => connector !== null)

        console.log('✅ Connectors list loaded:', connectors.length, 'items')
        return connectors
    } catch (error) {
        console.error('❌ Error fetching connectors:', error)
        throw error
    }
}

// ============ FAVORITES METHODS ============

// ✅ ADD TO FAVORITES (from addToFavorites in Dart)
export async function addToFavorites(contentId) {
    try {
        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        const client = getClient()
        await client.from('favorites').insert({
            user_id: user.id,
            content_id: contentId
        })

        console.log('✅ Content', contentId, 'added to favorites')
    } catch (error) {
        console.error('❌ Add to favorites error:', error)
        throw error
    }
}

// ✅ REMOVE FROM FAVORITES (from removeFromFavorites in Dart)
export async function removeFromFavorites(contentId) {
    try {
        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        const client = getClient()
        await client
            .from('favorites')
            .delete()
            .eq('user_id', user.id)
            .eq('content_id', contentId)

        console.log('✅ Content', contentId, 'removed from favorites')
    } catch (error) {
        console.error('❌ Remove from favorites error:', error)
        throw error
    }
}

// ✅ CHECK IF CONTENT IS IN FAVORITES (from isContentInFavorites in Dart)
export async function isContentInFavorites(contentId) {
    try {
        const user = getCurrentUser()
        if (!user) return false

        const client = getClient()
        const { data, error } = await client
            .from('favorites')
            .select()
            .eq('user_id', user.id)
            .eq('content_id', contentId)
            .maybeSingle()

        if (error) throw error
        return data !== null
    } catch (error) {
        console.error('❌ Check favorites error:', error)
        return false
    }
}

// ✅ GET FAVORITE CONTENT (from getFavoriteContent in Dart)
export async function getFavoriteContent() {
    try {
        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        const client = getClient()
        const { data, error } = await client
            .from('favorites')
            .select(`
                content:content_id (
                    id, title, description, thumbnail_url, 
                    media_type, file_url, created_at, genre,
                    user_profiles!user_id(full_name, username, avatar_url)
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) throw error

        const favorites = data.map(item => item.content)
        console.log('✅ Loaded', favorites.length, 'favorite items')
        return favorites
    } catch (error) {
        console.error('❌ Get favorites error:', error)
        return []
    }
}

// ============ WATCH HISTORY METHODS ============

// ✅ ADD TO WATCH HISTORY (from addToWatchHistory in Dart)
export async function addToWatchHistory(contentId, progressSeconds = 0) {
    try {
        const user = getCurrentUser()
        if (!user) return

        const client = getClient()
        await client.from('watch_history').upsert({
            user_id: user.id,
            content_id: contentId,
            progress_seconds: progressSeconds,
            watched_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,content_id'
        })

        console.log('✅ Added to watch history:', contentId)
    } catch (error) {
        console.error('❌ Add to watch history error:', error)
    }
}

// ✅ GET WATCH HISTORY (from getWatchHistory in Dart)
export async function getWatchHistory() {
    try {
        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        const client = getClient()
        const { data, error } = await client
            .from('watch_history')
            .select(`
                content:content_id (
                    id, title, description, thumbnail_url, 
                    media_type, file_url, created_at, genre,
                    user_profiles!user_id(full_name, username, avatar_url)
                ),
                watched_at,
                progress_seconds
            `)
            .eq('user_id', user.id)
            .order('watched_at', { ascending: false })
            .limit(50)

        if (error) throw error

        const history = data.map(item => ({
            ...item.content,
            watched_at: item.watched_at,
            progress_seconds: item.progress_seconds
        }))

        console.log('✅ Loaded', history.length, 'watch history items')
        return history
    } catch (error) {
        console.error('❌ Get watch history error:', error)
        return []
    }
}

// ============ CREATOR METHODS ============

// ✅ GET CREATOR PROFILE (from getCreatorProfile in Dart)
export async function getCreatorProfile(creatorId) {
    try {
        console.log('🔄 Fetching creator profile for:', creatorId)

        const client = getClient()
        
        // Get user profile data
        const { data: userProfile, error: userError } = await client
            .from('user_profiles')
            .select('*')
            .eq('id', creatorId)
            .maybeSingle()

        if (userError) throw userError
        if (!userProfile) {
            console.log('❌ User profile not found for:', creatorId)
            return null
        }

        // Get creator-specific data
        const { data: creatorData, error: creatorError } = await client
            .from('creators')
            .select('*')
            .eq('id', creatorId)
            .maybeSingle()

        console.log('✅ User profile found:', userProfile)
        if (!creatorError && creatorData) {
            console.log('✅ Creator data found:', creatorData)
        }

        // Combine data
        const combinedData = {
            ...userProfile,
            is_founder: creatorData?.is_founder || false,
            social_links: creatorData?.social_links || {},
            joined_at: creatorData?.joined_at,
            bio: userProfile.bio || creatorData?.bio
        }

        // Get connector count and connection status
        const connectorCount = await getConnectorCount(creatorId, 'creator')
        const isConnected = await isConnectedTo({
            connectedId: creatorId,
            connectionType: 'creator'
        })

        combinedData.connector_count = connectorCount
        combinedData.is_connected = isConnected

        console.log('✅ Final combined creator profile:', combinedData)
        return combinedData
    } catch (error) {
        console.error('❌ Get creator profile error:', error)
        return null
    }
}

// ✅ GET CREATOR CONTENT (from getCreatorContent in Dart)
export async function getCreatorContent(creatorId) {
    try {
        const client = getClient()
        const { data, error } = await client
            .from('Content')
            .select(`
                id, title, description, thumbnail_url, 
                media_type, file_url, created_at, genre,
                views_count, likes_count,
                user_profiles!user_id(full_name, username, avatar_url)
            `)
            .eq('user_id', creatorId)
            .eq('status', 'published')
            .order('created_at', { ascending: false })

        if (error) throw error

        console.log('✅ Loaded', data.length, 'content items for creator:', creatorId)
        return data
    } catch (error) {
        console.error('❌ Get creator content error:', error)
        return []
    }
}

// ✅ GET FOUNDER CREATORS (from getFounderCreators in Dart)
export async function getFounderCreators() {
    try {
        const client = getClient()
        const { data, error } = await client
            .from('creators')
            .select(`
                *,
                user_profiles!id(full_name, username, avatar_url, bio)
            `)
            .eq('is_founder', true)
            .order('joined_at', { ascending: true })

        if (error) throw error

        // Process and add connector counts
        const founders = await Promise.all(
            data.map(async creator => {
                const connectorCount = await getConnectorCount(creator.id, 'creator')
                const contentCount = await getCreatorContentCount(creator.id)
                return {
                    ...creator,
                    connector_count: connectorCount,
                    content_count: contentCount
                }
            })
        )

        console.log('✅ Loaded', founders.length, 'founder creators')
        return founders
    } catch (error) {
        console.error('❌ Get founder creators error:', error)
        return []
    }
}

// ✅ HELPER: Get creator content count
async function getCreatorContentCount(creatorId) {
    try {
        const client = getClient()
        const { count, error } = await client
            .from('Content')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', creatorId)
            .eq('status', 'published')

        if (error) throw error
        return count || 0
    } catch (error) {
        return 0
    }
}

// ============ RECOMMENDATIONS METHODS ============

// ✅ GET PERSONALIZED RECOMMENDATIONS (from getPersonalizedRecommendations in Dart)
export async function getPersonalizedRecommendations() {
    try {
        const user = getCurrentUser()
        if (!user) return []

        // Get user's watch history
        const watchHistory = await getWatchHistory()
        if (watchHistory.length === 0) return []

        // Extract genres from watch history
        const genres = [...new Set(
            watchHistory
                .map(item => item.genre)
                .filter(genre => genre && genre.trim())
        )]

        if (genres.length === 0) return []

        // Get content with similar genres
        const client = getClient()
        const { data, error } = await client
            .from('Content')
            .select(`
                id, title, description, thumbnail_url, 
                media_type, file_url, created_at, genre,
                user_profiles!user_id(full_name, username, avatar_url)
            `)
            .in('genre', genres)
            .neq('user_id', user.id)
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(20)

        if (error) throw error

        console.log('✅ Generated', data.length, 'personalized recommendations')
        return data
    } catch (error) {
        console.error('❌ Get recommendations error:', error)
        return []
    }
}

// ============ HELPER FUNCTIONS ============

// ✅ GET MOST VIEWED CONTENT (helper)
export function getMostViewedContent(contentData = []) {
    if (contentData.length === 0) return []
    
    return [...contentData]
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 10)
}

// ✅ GET MOST LIKED CONTENT (helper)
export function getMostLikedContent(contentData = []) {
    if (contentData.length === 0) return []
    
    return [...contentData]
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 10)
}

// ✅ GET TRENDING CONTENT (helper)
export function getTrendingContent(contentData = []) {
    if (contentData.length === 0) return []
    
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    
    const recentContent = contentData.filter(item => {
        try {
            const createdAt = new Date(item.created_at)
            return createdAt >= oneWeekAgo
        } catch {
            return false
        }
    })
    
    return recentContent
        .sort((a, b) => {
            const aScore = (a.views || 0) + ((a.likes || 0) * 2)
            const bScore = (b.views || 0) + ((b.likes || 0) * 2)
            return bScore - aScore
        })
        .slice(0, 10)
}

// ✅ AUTH STATE CHANGES (from authStateChanges in Dart)
export function onAuthStateChange(callback) {
    const client = getClient()
    return client.auth.onAuthStateChange(callback)
}

// Initialize when imported
initialize()

// Make functions available globally for non-module scripts
if (typeof window !== 'undefined') {
    window.supabase = supabase;
    window.initialize = initialize;
    window.isInitialized = isInitialized;
    window.generatePublicUrl = generatePublicUrl;
    window.fixMediaUrl = fixMediaUrl;
    window.getContentWithCreator = getContentWithCreator;
    window.getSimilarContent = getSimilarContent;
    window.recordContentView = recordContentView;
    window.getCurrentUser = getCurrentUser;
    window.isAuthenticated = isAuthenticated;
}
