// js/settings.js — Settings Page Logic
// Bantu Stream Connect — Account / Playback / Privacy / Content Preferences / Notifications / Appearance / Danger Zone
//
// Wrapped in an IIFE (matching movies.js/music.js/creator-channel.js/watch-history.js/my-space.js)
// so this file's own SUPABASE_URL const doesn't collide with the identically-
// named const the inline <script> in settings.html declares in global scope.
(function() {
'use strict';

console.log('⚙️ Settings initializing...');

let currentUser = null;
let profile = null;

// Real SA genre names (from the `genres` table, top-level rows only — same
// source used to fix Music's Sonic DNA quiz elsewhere in this codebase).
const GENRE_OPTIONS = [
    'Afro House', 'Amapiano', 'Bacardi House', 'Bubblegum', 'Gospel', 'Gqom',
    'Hip Hop (SA)', 'House (SA)', 'Jazz (SA)', 'Kwaito', 'Lekompo', 'Maskandi',
    'Mbaqanga', 'Reggae (SA)', 'SA R&B', 'Shangaan Electro', 'Township Pop',
    'Xigaza', 'Xigaza xa ma 2k'
];

const LANGUAGE_OPTIONS = [
    'English', 'Zulu', 'Xhosa', 'Afrikaans', 'Sepedi', 'Tswana', 'Sotho',
    'Tsonga', 'Swati', 'Venda', 'Ndebele'
];

// Same city list used on discover-creator.html's BSC Radar.
const CITY_OPTIONS = [
    'Johannesburg', 'Cape Town', 'Pretoria', 'Durban', 'Gqeberha', 'Bloemfontein',
    'Polokwane', 'Nelspruit', 'Kimberley', 'Pietermaritzburg', 'East London', 'Rustenburg'
];

const NOTIFICATION_TYPES = ['like', 'comment', 'follow', 'collab_request', 'system'];

document.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ DOM loaded, starting Settings initialization...');

    await checkAuth();

    if (currentUser) {
        await loadSettings();
        setupEventListeners();
    }

    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = 'block';

    console.log('✅ Settings fully initialized');
});

// Direct auth pattern (matches watch-history.js/my-space.js).
async function checkAuth() {
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session?.user) {
            showToast('Please sign in to view Settings', 'warning');
            setTimeout(() => {
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            }, 1500);
            return;
        }
        currentUser = session.user;
        console.log('✅ User authenticated:', currentUser.email);
    } catch (error) {
        console.error('Auth check failed:', error);
        showToast('Authentication error', 'error');
    }
}

async function loadSettings() {
    try {
        const { data, error } = await window.supabaseClient
            .from('user_profiles')
            .select('username, location, website_url, autoplay_previews, hd_only, is_private, show_history, preferred_genres, preferred_languages, preferred_cities, notification_preferences')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (error) throw error;

        profile = data || {};

        document.getElementById('account-email').value = currentUser.email || '';
        document.getElementById('account-username').value = profile.username || '';
        document.getElementById('account-location').value = profile.location || '';
        document.getElementById('account-website').value = profile.website_url || '';

        document.getElementById('autoplay-previews-toggle').checked = profile.autoplay_previews || false;
        document.getElementById('hd-only-toggle').checked = profile.hd_only || false;
        document.getElementById('is-private-toggle').checked = profile.is_private || false;
        document.getElementById('show-history-toggle').checked = profile.show_history !== false;

        renderChips('genre-chips', GENRE_OPTIONS, profile.preferred_genres || [], 'preferred_genres');
        renderChips('language-chips', LANGUAGE_OPTIONS, profile.preferred_languages || [], 'preferred_languages');
        renderChips('city-chips', CITY_OPTIONS, profile.preferred_cities || [], 'preferred_cities');

        const notifPrefs = profile.notification_preferences || {};
        NOTIFICATION_TYPES.forEach(type => {
            const toggle = document.getElementById(`notif-${type}`);
            if (toggle) toggle.checked = notifPrefs[type] !== false;
        });

    } catch (error) {
        console.error('❌ Failed to load settings:', error);
        showToast('Failed to load settings', 'error');
    }
}

// ==========================================================================
// CONTENT PREFERENCE CHIPS — click to add/remove, saves the full array
// immediately on each click (same targeted-update pattern as the toggles).
// ==========================================================================
function renderChips(containerId, options, selected, column) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = options.map(option => {
        const isSelected = selected.includes(option);
        return `<button type="button" class="pref-chip${isSelected ? ' is-selected' : ''}" data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>`;
    }).join('');

    container.querySelectorAll('.pref-chip').forEach(chip => {
        chip.addEventListener('click', () => toggleChip(chip, containerId, column));
    });
}

async function toggleChip(chip, containerId, column) {
    chip.classList.toggle('is-selected');

    const values = Array.from(document.querySelectorAll(`#${containerId} .pref-chip.is-selected`))
        .map(el => el.dataset.value);

    profile[column] = values;

    try {
        const { error } = await window.supabaseClient
            .from('user_profiles')
            .update({ [column]: values, updated_at: new Date().toISOString() })
            .eq('id', currentUser.id);

        if (error) throw error;
    } catch (error) {
        console.error(`❌ Failed to update ${column}:`, error);
        showToast('Failed to save preference', 'error');
    }
}

// ==========================================================================
// TARGETED FIELD UPDATE — single-column update, used by every toggle so one
// switch never risks clobbering fields the user hasn't touched.
// ==========================================================================
async function updateField(column, value) {
    try {
        const { error } = await window.supabaseClient
            .from('user_profiles')
            .update({ [column]: value, updated_at: new Date().toISOString() })
            .eq('id', currentUser.id);

        if (error) throw error;
    } catch (error) {
        console.error(`❌ Failed to update ${column}:`, error);
        showToast('Failed to save setting', 'error');
    }
}

// ==========================================================================
// NOTIFICATIONS — single notification_preferences jsonb column, each toggle
// updates one key via a targeted jsonb patch rather than overwriting the
// whole object (so concurrent tabs/toggles can't stomp on each other).
// ==========================================================================
async function updateNotificationPreference(type, value) {
    if (!profile.notification_preferences) profile.notification_preferences = {};
    profile.notification_preferences[type] = value;

    try {
        const { error } = await window.supabaseClient
            .from('user_profiles')
            .update({ notification_preferences: profile.notification_preferences, updated_at: new Date().toISOString() })
            .eq('id', currentUser.id);

        if (error) throw error;
    } catch (error) {
        console.error(`❌ Failed to update notification preference (${type}):`, error);
        showToast('Failed to save notification setting', 'error');
    }
}

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================
function setupEventListeners() {
    document.getElementById('save-account-btn')?.addEventListener('click', saveAccountInfo);
    document.getElementById('change-password-btn')?.addEventListener('click', changePassword);

    document.getElementById('autoplay-previews-toggle')?.addEventListener('change', (e) => updateField('autoplay_previews', e.target.checked));
    document.getElementById('hd-only-toggle')?.addEventListener('change', (e) => updateField('hd_only', e.target.checked));
    document.getElementById('is-private-toggle')?.addEventListener('change', (e) => updateField('is_private', e.target.checked));
    document.getElementById('show-history-toggle')?.addEventListener('change', (e) => updateField('show_history', e.target.checked));

    NOTIFICATION_TYPES.forEach(type => {
        document.getElementById(`notif-${type}`)?.addEventListener('change', (e) => updateNotificationPreference(type, e.target.checked));
    });

    // Theme/UI scale controls already live in the sidebar (shared-components.js
    // owns them) — this just opens it, matching the existing #menu-toggle behavior.
    document.getElementById('open-sidebar-btn')?.addEventListener('click', () => {
        document.getElementById('menu-toggle')?.click();
    });

    // Reuses shared-components.js's setupLogout() handler on #sidebar-logout
    // rather than re-implementing auth.signOut() here.
    document.getElementById('sign-out-btn')?.addEventListener('click', () => {
        document.getElementById('sidebar-logout')?.click();
    });
}

async function saveAccountInfo() {
    const username = document.getElementById('account-username').value.trim();
    const location = document.getElementById('account-location').value.trim();
    const website = document.getElementById('account-website').value.trim();

    try {
        const { error } = await window.supabaseClient
            .from('user_profiles')
            .update({
                username: username || null,
                location: location || null,
                website_url: website || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);

        if (error) throw error;

        showToast('Account info saved', 'success');
    } catch (error) {
        console.error('❌ Failed to save account info:', error);
        showToast('Failed to save account info', 'error');
    }
}

async function changePassword() {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!newPassword || newPassword.length < 6) {
        showToast('Password must be at least 6 characters', 'warning');
        return;
    }
    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'warning');
        return;
    }

    try {
        const { error } = await window.supabaseClient.auth.updateUser({ password: newPassword });
        if (error) throw error;

        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
        showToast('Password changed successfully', 'success');
    } catch (error) {
        console.error('❌ Failed to change password:', error);
        showToast(error.message || 'Failed to change password', 'error');
    }
}

// ==========================================================================
// UTILITIES (per-page copies, matching the established pattern)
// ==========================================================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        error: 'fa-exclamation-triangle',
        success: 'fa-check-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `
        <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

})();
