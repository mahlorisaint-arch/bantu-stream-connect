// ============================================
// MOOD & ENERGY TAGS FUNCTIONS
// ============================================
function collectMoodData() {
    const selectedMoodElement = document.querySelector('.mood-option.selected');
    if (!selectedMoodElement) return null;
    const intensity = parseInt(document.getElementById('mood-intensity')?.value || 7) / 10;
    return { primary_mood: selectedMoodElement.dataset.mood, mood_intensity: intensity, tagged_by: 'creator' };
}
