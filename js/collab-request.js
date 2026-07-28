const urlParams = new URLSearchParams(window.location.search);
const requestId = urlParams.get('id');

let currentUserId = null;
let requestData = null;

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

document.addEventListener('DOMContentLoaded', () => setTimeout(init, 50));
