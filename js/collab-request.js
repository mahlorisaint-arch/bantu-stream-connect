const urlParams = new URLSearchParams(window.location.search);
const requestId = urlParams.get('id');

let currentUserId = null;
let requestData = null;
let threadInitialized = false;
let threadChannel = null;
const seenMessageIds = new Set();

async function init() {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
    }
    currentUserId = session.user.id;

    if (!requestId) {
        showError('No collab request specified.');
        return;
    }

    await loadRequest();

    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = 'block';
}

async function loadRequest() {
    const { data, error } = await window.supabaseClient
        .from('creator_collaboration_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

    if (error || !data) {
        showError('This collab request could not be found.');
        return;
    }

    if (data.from_creator_id !== currentUserId && data.to_creator_id !== currentUserId) {
        showError("You don't have access to this collab request.");
        return;
    }

    requestData = data;
    const isSender = data.from_creator_id === currentUserId;
    const otherPartyId = isSender ? data.to_creator_id : data.from_creator_id;

    const { data: otherProfile } = await window.supabaseClient
        .from('user_profiles')
        .select('full_name, username, avatar_url')
        .eq('id', otherPartyId)
        .maybeSingle();

    renderRequest(data, otherProfile, isSender);
}

function renderRequest(req, otherProfile, isSender) {
    const name = otherProfile?.full_name || otherProfile?.username || 'A creator';

    document.getElementById('collab-card').style.display = 'block';
    document.getElementById('collab-error').style.display = 'none';

    document.getElementById('collab-title').textContent = isSender
        ? `Your collab request to ${name}`
        : `Collab request from ${name}`;

    document.getElementById('collab-message').textContent = req.message;
    document.getElementById('collab-meta').textContent =
        `${new Date(req.created_at).toLocaleString()} · ${req.collaboration_type}`;

    const statusBadge = document.getElementById('collab-status');
    statusBadge.textContent = req.status;
    statusBadge.className = `collab-status-badge status-${req.status}`;

    const actionsEl = document.getElementById('collab-actions');
    const responseEl = document.getElementById('collab-response-block');

    if (req.status === 'pending' && !isSender) {
        actionsEl.style.display = 'flex';
        responseEl.style.display = 'none';

        document.getElementById('accept-btn').onclick = () => respond('accepted');
        document.getElementById('decline-btn').onclick = () => respond('declined');
    } else {
        actionsEl.style.display = 'none';

        if (req.status !== 'pending') {
            responseEl.style.display = 'block';
            document.getElementById('collab-response-text').textContent =
                req.response_message || (req.status === 'accepted' ? 'Accepted, no message left.' : 'Declined, no message left.');
            document.getElementById('collab-response-meta').textContent =
                req.responded_at ? `Responded ${new Date(req.responded_at).toLocaleString()}` : '';
        } else {
            responseEl.style.display = 'none';
        }
    }

    updateThreadVisibility(req.status);
}

function updateThreadVisibility(status) {
    const threadCard = document.getElementById('collab-thread-card');
    const closedNotice = document.getElementById('collab-thread-closed');

    if (status === 'accepted') {
        threadCard.style.display = 'block';
        closedNotice.style.display = 'none';
        if (!threadInitialized) initThread();
    } else if (status === 'declined') {
        threadCard.style.display = 'none';
        closedNotice.style.display = 'block';
        teardownThreadSubscription();
    } else {
        threadCard.style.display = 'none';
        closedNotice.style.display = 'none';
        teardownThreadSubscription();
    }
}

async function respond(status) {
    const responseMessage = document.getElementById('response-input').value.trim();

    try {
        const { error } = await window.supabaseClient
            .from('creator_collaboration_requests')
            .update({
                status,
                response_message: responseMessage || null,
                responded_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (error) throw error;

        showToast(status === 'accepted' ? 'Request accepted' : 'Request declined', 'success');
        await loadRequest();
    } catch (error) {
        console.error('Error responding to collab request:', error);
        showToast('Could not send your response', 'error');
    }
}

function showError(msg) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('collab-card').style.display = 'none';
    document.getElementById('collab-error').style.display = 'block';
    document.getElementById('collab-error-text').textContent = msg;
}

// ===== Conversation thread - only reachable once the request is accepted
// (the messages table's own INSERT policy enforces this server-side too). =====

async function initThread() {
    threadInitialized = true;

    await loadMessages();
    subscribeToThread();

    const input = document.getElementById('collab-thread-input');
    const sendBtn = document.getElementById('collab-thread-send');

    sendBtn.onclick = sendMessage;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
}

async function loadMessages() {
    const { data, error } = await window.supabaseClient
        .from('creator_collaboration_messages')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error loading collab messages:', error);
        return;
    }

    const list = document.getElementById('collab-thread-list');
    list.innerHTML = '';

    if (!data || data.length === 0) {
        list.innerHTML = '<div class="collab-thread-empty">No messages yet. Say hello and start planning the collab.</div>';
    } else {
        data.forEach((msg) => {
            seenMessageIds.add(msg.id);
            list.appendChild(buildMessageEl(msg));
        });
        list.scrollTop = list.scrollHeight;
    }
}

function buildMessageEl(msg) {
    const el = document.createElement('div');
    const isMine = msg.sender_id === currentUserId;
    el.className = `collab-msg ${isMine ? 'collab-msg-mine' : 'collab-msg-theirs'}`;
    el.innerHTML = `${escapeHtml(msg.message)}<span class="collab-msg-time">${new Date(msg.created_at).toLocaleString()}</span>`;
    return el;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function sendMessage() {
    const input = document.getElementById('collab-thread-input');
    const text = input.value.trim();
    if (!text) return;

    const sendBtn = document.getElementById('collab-thread-send');
    sendBtn.disabled = true;

    try {
        const { error } = await window.supabaseClient
            .from('creator_collaboration_messages')
            .insert({ request_id: requestId, sender_id: currentUserId, message: text });

        if (error) throw error;

        input.value = '';
        input.style.height = 'auto';
    } catch (error) {
        console.error('Error sending collab message:', error);
        showToast('Could not send message', 'error');
    } finally {
        sendBtn.disabled = false;
    }
}

function subscribeToThread() {
    threadChannel = window.supabaseClient
        .channel(`collab-thread-${requestId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'creator_collaboration_messages',
            filter: `request_id=eq.${requestId}`
        }, (payload) => {
            const msg = payload.new;
            if (seenMessageIds.has(msg.id)) return;
            seenMessageIds.add(msg.id);

            const list = document.getElementById('collab-thread-list');
            const emptyEl = list.querySelector('.collab-thread-empty');
            if (emptyEl) emptyEl.remove();

            list.appendChild(buildMessageEl(msg));
            list.scrollTop = list.scrollHeight;
        })
        .subscribe();
}

function teardownThreadSubscription() {
    if (threadChannel) {
        window.supabaseClient.removeChannel(threadChannel);
        threadChannel = null;
    }
}

document.addEventListener('DOMContentLoaded', () => setTimeout(init, 50));
