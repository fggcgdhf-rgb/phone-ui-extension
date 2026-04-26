/**
 * SillyTavern Phone Extension - index.js
 * A full-featured in-character phone UI overlay
 * Version: 1.0.0
 */

import { callPopup, generateQuietPrompt } from "../../../../script.js";
import { extension_settings, getContext, saveSettingsDebounced } from "../../../extensions.js";

const EXT_NAME = "phone-system";
const DEFAULTS = {
    wallpaper: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
    userName: "Player",
    userHandle: "@player",
    userPhone: "081-234-5678",
    userBalance: 12500,
    notes: [],
    playlist: [],
    petState: null,
    igPosts: [],
    igStories: [],
    igDMs: [],
    tweets: [],
    lineDMs: [],
};

let settings = {};
let phoneVisible = false;
let currentPanel = null;
let currentIgTab = "feed";
let currentLineTab = "chat";
let activeChatContact = null;
let callTimer = null;
let callSeconds = 0;
let petInterval = null;
let ttVideoIndex = 0;
let currentPlayingIndex = -1;
let ytPlayer = null;
let noteEditing = null;

// ==================== INIT ====================

jQuery(async () => {
    settings = Object.assign({}, DEFAULTS, extension_settings[EXT_NAME] || {});
    extension_settings[EXT_NAME] = settings;

    await loadGoogleFonts();
    injectHTML();
    bindEvents();
    startClock();
    loadWeather();

    console.log("[PhoneExt] Phone Extension loaded ✓");
});

function saveSettings() {
    extension_settings[EXT_NAME] = settings;
    saveSettingsDebounced();
}

async function loadGoogleFonts() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700&display=swap";
    document.head.appendChild(link);
}

// ==================== HTML INJECTION ====================

function injectHTML() {
    const html = `
    <!-- FAB Button -->
    <button id="phone-fab" title="Open Phone">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
        </svg>
    </button>

    <!-- Phone Overlay -->
    <div id="phone-overlay">
        <div id="phone-frame">
            <!-- Status Bar -->
            <div id="phone-statusbar">
                <span class="statusbar-time" id="sb-time">12:00</span>
                <div class="statusbar-icons">
                    <span>📶</span>
                    <span>🔋</span>
                </div>
            </div>

            <!-- Screen -->
            <div id="phone-screen">
                <!-- Home -->
                <div id="phone-home">
                    <div class="home-date-widget">
                        <div class="hw-time" id="hw-time">12:00</div>
                        <div class="hw-date" id="hw-date">วันจันทร์ 1 มกราคม</div>
                        <div class="hw-weather" id="hw-weather-mini">🌤️ <span id="hw-weather-text">กำลังโหลด...</span></div>
                    </div>
                    <div id="phone-dock">
                        <button class="dock-tab tab-phone" data-panel="phone" title="โทรศัพท์">
                            <div class="tab-icon">📱</div>
                            <span class="tab-label">แอพ</span>
                        </button>
                        <button class="dock-tab tab-notes" data-panel="notes" title="บันทึก">
                            <div class="tab-icon">📝</div>
                            <span class="tab-label">บันทึก</span>
                        </button>
                        <button class="dock-tab tab-music" data-panel="music" title="เพลง">
                            <div class="tab-icon">🎵</div>
                            <span class="tab-label">เพลง</span>
                        </button>
                        <button class="dock-tab tab-weather" data-panel="weather" title="สภาพอากาศ">
                            <div class="tab-icon">🌤️</div>
                            <span class="tab-label">อากาศ</span>
                        </button>
                        <button class="dock-tab tab-game" data-panel="game" title="เกม">
                            <div class="tab-icon">🐾</div>
                            <span class="tab-label">เกม</span>
                        </button>
                    </div>
                </div>

                <!-- === PANEL: PHONE APPS === -->
                <div id="panel-phone" class="app-panel">
                    <div class="app-header">
                        <button class="back-btn" data-back>◀</button>
                        <span class="app-title">แอพพลิเคชัน</span>
                    </div>
                    <div class="apps-grid">
                        <div class="app-card" data-open="ig">
                            <div class="app-card-icon">📸</div>
                            <div class="app-card-name">Instagram</div>
                            <div class="app-card-sub">รูปภาพ & สตอรี่</div>
                        </div>
                        <div class="app-card" data-open="line">
                            <div class="app-card-icon">💬</div>
                            <div class="app-card-name">LINE</div>
                            <div class="app-card-sub">แชท & โทร</div>
                        </div>
                        <div class="app-card" data-open="tiktok">
                            <div class="app-card-icon">🎵</div>
                            <div class="app-card-name">TikTok</div>
                            <div class="app-card-sub">วิดีโอสั้น</div>
                        </div>
                        <div class="app-card" data-open="twitter">
                            <div class="app-card-icon">🐦</div>
                            <div class="app-card-name">Twitter / X</div>
                            <div class="app-card-sub">โพสต์ & ฟีด</div>
                        </div>
                        <div class="app-card" data-open="settings" style="grid-column: span 2">
                            <div class="app-card-icon">⚙️</div>
                            <div class="app-card-name">ตั้งค่า</div>
                            <div class="app-card-sub">โปรไฟล์ & การตั้งค่า</div>
                        </div>
                    </div>
                </div>

                <!-- === PANEL: INSTAGRAM === -->
                <div id="panel-ig" class="app-panel">
                    <div class="app-header ig-header">
                        <button class="back-btn" data-back>◀</button>
                        <span class="app-title">Instagram</span>
                        <button id="ig-dm-btn" style="background:none;border:none;cursor:pointer;color:white;font-size:20px;">✉️</button>
                    </div>
                    <div class="ig-tab-bar">
                        <div class="ig-tab active" data-igtab="feed">🏠 ฟีด</div>
                        <div class="ig-tab" data-igtab="dm">💬 DM</div>
                        <div class="ig-tab" data-igtab="profile">👤 โปรไฟล์</div>
                    </div>
                    <!-- IG Feed -->
                    <div id="ig-feed-view" style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
                        <div class="ig-stories-row" id="ig-stories-row"></div>
                        <div class="ig-posts-feed" id="ig-posts-feed"></div>
                    </div>
                    <!-- IG DMs -->
                    <div id="ig-dm-view" style="flex:1;display:none;flex-direction:column;overflow:hidden;">
                        <div class="ig-dm-list" id="ig-dm-list"></div>
                    </div>
                    <!-- IG Profile -->
                    <div id="ig-profile-view" style="flex:1;display:none;flex-direction:column;overflow-y:auto;padding:16px;">
                        <div id="ig-profile-content"></div>
                    </div>
                    <!-- Story Viewer -->
                    <div id="story-viewer" class="story-viewer">
                        <div class="story-progress" id="story-progress"></div>
                        <div class="story-top">
                            <div class="s-avatar" id="sv-avatar">👤</div>
                            <div>
                                <div class="s-name" id="sv-name">ชื่อ</div>
                                <div class="s-time" id="sv-time">เมื่อกี้</div>
                            </div>
                        </div>
                        <div class="story-content" id="sv-content">🌸</div>
                        <button class="story-close" id="story-close">✕</button>
                    </div>
                    <!-- IG Chat Window -->
                    <div id="ig-chat-panel" class="app-panel" style="z-index:20;">
                        <div class="app-header ig-header">
                            <button class="back-btn" id="ig-chat-back">◀</button>
                            <span class="app-title" id="ig-chat-title">DM</span>
                        </div>
                        <div class="chat-window" id="ig-chat-window"></div>
                        <div class="chat-input-row">
                            <input class="chat-input" id="ig-chat-input" placeholder="ส่งข้อความ..." />
                            <button class="chat-send-btn" id="ig-chat-send">➤</button>
                        </div>
                    </div>
                </div>

                <!-- === PANEL: LINE === -->
                <div id="panel-line" class="app-panel">
                    <div class="app-header line-header">
                        <button class="back-btn" data-back>◀</button>
                        <span class="app-title">LINE</span>
                    </div>
                    <div class="line-tab-bar">
                        <div class="line-tab active" data-linetab="chat">💬 แชท</div>
                        <div class="line-tab" data-linetab="call">📞 สาย</div>
                    </div>
                    <!-- LINE Chat List -->
                    <div id="line-chat-view" style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
                        <div class="ig-dm-list" id="line-chat-list"></div>
                    </div>
                    <!-- LINE Call View -->
                    <div id="line-call-view" style="flex:1;display:none;flex-direction:column;padding:16px;gap:10px;">
                        <div style="font-weight:700;font-size:15px;font-family:var(--font-main);color:var(--phone-text);margin-bottom:8px;">โทรหาใคร?</div>
                        <div id="line-call-contacts"></div>
                    </div>
                    <!-- LINE Chat Window -->
                    <div id="line-chat-panel" class="app-panel" style="z-index:20;">
                        <div class="app-header line-header">
                            <button class="back-btn" id="line-chat-back">◀</button>
                            <span class="app-title" id="line-chat-title">LINE</span>
                        </div>
                        <div class="line-call-bar">
                            <button class="line-call-btn voice" id="line-voice-call">📞 โทร</button>
                            <button class="line-call-btn video" id="line-video-call">📹 วิดีโอ</button>
                        </div>
                        <div class="chat-window" id="line-chat-window"></div>
                        <div class="chat-input-row">
                            <button class="share-location-btn" id="line-share-loc">📍</button>
                            <input class="chat-input" id="line-chat-input" placeholder="ส่งข้อความ..." />
                            <button class="chat-send-btn" id="line-chat-send">➤</button>
                        </div>
                    </div>
                    <!-- Call Screen -->
                    <div id="call-screen" class="call-screen">
                        <div class="call-avatar" id="call-avatar">👤</div>
                        <div class="call-name" id="call-name">ชื่อ</div>
                        <div class="call-status" id="call-status">กำลังโทร...</div>
                        <div class="call-timer" id="call-timer">00:00</div>
                        <div class="call-actions">
                            <button class="call-action-btn mute" id="call-mute">🔇</button>
                            <button class="call-action-btn end" id="call-end">📵</button>
                            <button class="call-action-btn speaker" id="call-speaker">🔊</button>
                        </div>
                    </div>
                </div>

                <!-- === PANEL: TIKTOK === -->
                <div id="panel-tiktok" class="app-panel">
                    <div class="app-header tt-header">
                        <button class="back-btn" data-back>◀</button>
                        <span class="app-title" style="color:white;">TikTok</span>
                        <button id="tt-next-btn" style="background:none;border:none;cursor:pointer;color:white;font-size:20px;margin-left:auto;">⬇️</button>
                    </div>
                    <div class="tt-feed" id="tt-feed">
                        <div id="tt-video-container"></div>
                        <div class="tt-actions" id="tt-actions"></div>
                        <div class="tt-nav-indicator" id="tt-nav-dots"></div>
                    </div>
                </div>

                <!-- === PANEL: TWITTER === -->
                <div id="panel-twitter" class="app-panel" style="position:relative;">
                    <div class="app-header tw-header">
                        <button class="back-btn" data-back>◀</button>
                        <span class="app-title">𝕏 Twitter</span>
                    </div>
                    <div class="tw-feed" id="tw-feed"></div>
                    <button class="tw-compose-btn" id="tw-compose-btn">✏️</button>
                    <!-- Compose Overlay -->
                    <div id="tw-compose" class="compose-overlay">
                        <div class="compose-header">
                            <button class="compose-cancel" id="tw-compose-cancel">ยกเลิก</button>
                            <div style="flex:1;font-weight:700;font-family:var(--font-main);font-size:16px;text-align:center;">โพสต์ใหม่</div>
                            <button class="compose-tweet-btn" id="tw-compose-send">โพสต์</button>
                        </div>
                        <div class="compose-body">
                            <div class="compose-avatar">👤</div>
                            <textarea class="compose-textarea" id="tw-compose-text" placeholder="มีอะไรเกิดขึ้น?"></textarea>
                        </div>
                        <div class="compose-privacy">
                            <span style="font-family:var(--font-main);font-size:13px;color:var(--phone-text-light);">การมองเห็น:</span>
                            <div class="privacy-toggle">
                                <button class="privacy-btn active" data-privacy="public">🌍 สาธารณะ</button>
                                <button class="privacy-btn" data-privacy="private">🔒 ส่วนตัว</button>
                            </div>
                        </div>
                    </div>
                    <!-- Tweet Detail -->
                    <div id="tw-detail" class="compose-overlay">
                        <div class="compose-header">
                            <button class="compose-cancel" id="tw-detail-back">◀ กลับ</button>
                        </div>
                        <div id="tw-detail-content" style="flex:1;overflow-y:auto;"></div>
                    </div>
                </div>

                <!-- === PANEL: SETTINGS === -->
                <div id="panel-settings" class="app-panel">
                    <div class="app-header">
                        <button class="back-btn" data-back>◀</button>
                        <span class="app-title">⚙️ ตั้งค่า</span>
                    </div>
                    <div class="settings-body" id="settings-body"></div>
                </div>

                <!-- === PANEL: NOTES === -->
                <div id="panel-notes" class="app-panel" style="position:relative;">
                    <div class="app-header">
                        <button class="back-btn" data-back>◀</button>
                        <span class="app-title">📝 บันทึก</span>
                    </div>
                    <div class="notes-body" id="notes-body"></div>
                    <button class="note-add-btn" id="note-add-btn">+</button>
                    <!-- Note Editor -->
                    <div id="note-editor" class="note-editor">
                        <div class="note-editor-header">
                            <button class="back-btn" id="note-editor-back">◀</button>
                            <span style="font-weight:700;font-size:15px;font-family:var(--font-main);">บันทึก</span>
                            <button class="note-save-btn" id="note-save-btn">บันทึก</button>
                        </div>
                        <textarea id="note-textarea" placeholder="พิมพ์บันทึกของคุณ...&#10;&#10;ตัวละครจะจดจำสิ่งที่คุณเขียนที่นี่"></textarea>
                    </div>
                </div>

                <!-- === PANEL: MUSIC === -->
                <div id="panel-music" class="app-panel">
                    <div class="app-header">
                        <button class="back-btn" data-back>◀</button>
                        <span class="app-title">🎵 เพลง</span>
                    </div>
                    <div class="music-body" id="music-body">
                        <!-- URL Input -->
                        <div class="music-url-input-row">
                            <input class="music-url-input" id="music-url-input" placeholder="วางลิงก์ YouTube เพลงที่นี่..." />
                            <button class="music-add-btn" id="music-add-btn">+ เพิ่ม</button>
                        </div>
                        <!-- Player -->
                        <div class="music-player-card" id="music-player-card" style="display:none;">
                            <div class="music-player-title" id="mp-title">ชื่อเพลง</div>
                            <div class="music-player-channel" id="mp-channel">ศิลปิน</div>
                            <div id="yt-embed-area"></div>
                            <div class="music-player-controls">
                                <button class="music-ctrl-btn" id="music-prev">⏮</button>
                                <button class="music-ctrl-btn play-pause" id="music-playpause">▶</button>
                                <button class="music-ctrl-btn" id="music-next">⏭</button>
                            </div>
                            <div class="music-volume-row">
                                <span class="music-vol-icon">🔉</span>
                                <input type="range" class="music-vol-slider" id="music-volume" min="0" max="100" value="80" />
                                <span class="music-vol-icon">🔊</span>
                            </div>
                        </div>
                        <!-- Playlist -->
                        <div class="music-playlist" id="music-playlist"></div>
                    </div>
                </div>

                <!-- === PANEL: WEATHER === -->
                <div id="panel-weather" class="app-panel">
                    <div class="app-header">
                        <button class="back-btn" data-back>◀</button>
                        <span class="app-title">🌤️ สภาพอากาศ</span>
                    </div>
                    <div class="weather-body" id="weather-body">
                        <div style="text-align:center;font-family:var(--font-main);color:var(--phone-text-light);padding:40px;">กำลังโหลดสภาพอากาศ...</div>
                    </div>
                </div>

                <!-- === PANEL: PET GAME === -->
                <div id="panel-game" class="app-panel">
                    <div class="app-header">
                        <button class="back-btn" data-back>◀</button>
                        <span class="app-title">🐾 เลี้ยงสัตว์</span>
                        <button id="pet-reset-btn" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--phone-text-light);margin-left:auto;font-family:var(--font-main);">เปลี่ยนสัตว์</button>
                    </div>
                    <div class="game-body" id="game-body"></div>
                </div>

            </div><!-- /phone-screen -->
        </div><!-- /phone-frame -->
    </div><!-- /phone-overlay -->

    <!-- Toast -->
    <div class="phone-toast" id="phone-toast"></div>
    `;

    $("body").append(html);
    applyWallpaper();
}

// ==================== BIND EVENTS ====================

function bindEvents() {
    // FAB toggle
    $(document).on("click", "#phone-fab", togglePhone);

    // Close overlay on bg click
    $(document).on("click", "#phone-overlay", (e) => {
        if (e.target.id === "phone-overlay") closePhone();
    });

    // Dock tabs
    $(document).on("click", ".dock-tab", function () {
        const panel = $(this).data("panel");
        openPanel(panel);
    });

    // Back buttons
    $(document).on("click", "[data-back]", goBack);

    // App cards
    $(document).on("click", "[data-open]", function () {
        const app = $(this).data("open");
        openPanel(app);
    });

    // IG Tab bar
    $(document).on("click", ".ig-tab", function () {
        $(".ig-tab").removeClass("active");
        $(this).addClass("active");
        currentIgTab = $(this).data("igtab");
        renderIgView();
    });

    // IG Stories
    $(document).on("click", ".ig-story-bubble", function () {
        const idx = $(this).data("index");
        openStoryViewer(idx);
    });
    $(document).on("click", "#story-close", closeStoryViewer);

    // IG DM item
    $(document).on("click", ".dm-item[data-contact]", function () {
        const c = $(this).data("contact");
        openIgChat(c);
    });

    // IG Chat back
    $(document).on("click", "#ig-chat-back", () => {
        $("#ig-chat-panel").removeClass("open");
    });

    // IG Chat send
    $(document).on("click", "#ig-chat-send", sendIgMessage);
    $(document).on("keypress", "#ig-chat-input", (e) => {
        if (e.key === "Enter") sendIgMessage();
    });

    // LINE tabs
    $(document).on("click", ".line-tab", function () {
        $(".line-tab").removeClass("active");
        $(this).addClass("active");
        currentLineTab = $(this).data("linetab");
        renderLineView();
    });

    // LINE chat item
    $(document).on("click", ".dm-item[data-linecontact]", function () {
        openLineChat($(this).data("linecontact"));
    });

    // LINE chat back
    $(document).on("click", "#line-chat-back", () => {
        $("#line-chat-panel").removeClass("open");
    });

    // LINE chat send
    $(document).on("click", "#line-chat-send", sendLineMessage);
    $(document).on("keypress", "#line-chat-input", (e) => {
        if (e.key === "Enter") sendLineMessage();
    });

    // LINE calls
    $(document).on("click", "#line-voice-call", () => startCall(false));
    $(document).on("click", "#line-video-call", () => startCall(true));
    $(document).on("click", ".line-call-contact-btn", function () {
        activeChatContact = $(this).data("contact");
        startCall($(this).data("video") === true);
    });
    $(document).on("click", "#call-end", endCall);
    $(document).on("click", "#line-share-loc", shareLocation);

    // TikTok next
    $(document).on("click", "#tt-next-btn", () => {
        ttVideoIndex = (ttVideoIndex + 1) % getTTVideos().length;
        renderTikTok();
    });

    // Twitter compose
    $(document).on("click", "#tw-compose-btn", () => {
        $("#tw-compose").addClass("open");
    });
    $(document).on("click", "#tw-compose-cancel", () => {
        $("#tw-compose").removeClass("open");
    });
    $(document).on("click", "#tw-compose-send", postTweet);
    $(document).on("click", ".privacy-btn", function () {
        $(".privacy-btn").removeClass("active");
        $(this).addClass("active");
    });

    // Twitter tweet click
    $(document).on("click", ".tw-tweet", function () {
        const idx = $(this).data("index");
        openTweetDetail(idx);
    });
    $(document).on("click", ".tw-action-btn", function (e) {
        e.stopPropagation();
        const action = $(this).data("action");
        const idx = $(this).closest(".tw-tweet").data("index");
        handleTweetAction(action, idx);
    });
    $(document).on("click", "#tw-detail-back", () => {
        $("#tw-detail").removeClass("open");
    });

    // Settings
    $(document).on("click", ".wp-option", function () {
        settings.wallpaper = $(this).data("wp");
        applyWallpaper();
        $(".wp-option").removeClass("active");
        $(this).addClass("active");
        saveSettings();
    });

    // Notes
    $(document).on("click", "#note-add-btn", () => openNoteEditor(null));
    $(document).on("click", "#note-editor-back", () => {
        $("#note-editor").removeClass("open");
    });
    $(document).on("click", "#note-save-btn", saveNote);
    $(document).on("click", ".note-card", function () {
        openNoteEditor($(this).data("index"));
    });

    // Music
    $(document).on("click", "#music-add-btn", addMusicTrack);
    $(document).on("keypress", "#music-url-input", (e) => {
        if (e.key === "Enter") addMusicTrack();
    });
    $(document).on("click", "#music-prev", musicPrev);
    $(document).on("click", "#music-next", musicNext);
    $(document).on("click", "#music-playpause", musicPlayPause);
    $(document).on("click", ".playlist-item[data-idx]", function () {
        playTrack($(this).data("idx"));
    });
    $(document).on("click", ".pl-del", function (e) {
        e.stopPropagation();
        deleteTrack($(this).data("idx"));
    });

    // Pet game
    $(document).on("click", ".pet-option", function () {
        settings.petState = {
            type: $(this).data("type"),
            emoji: $(this).data("emoji"),
            name: $(this).data("name"),
            hunger: 80,
            happy: 90,
            clean: 85,
            speech: "หวัดดี! ดูแลฉันด้วยนะ~ 🥺"
        };
        saveSettings();
        renderPetGame();
    });
    $(document).on("click", "#pet-reset-btn", () => {
        settings.petState = null;
        saveSettings();
        renderPetGame();
    });
    $(document).on("click", ".pet-emoji-big", () => {
        petAction("poke");
    });
    $(document).on("click", ".pet-action-btn", function () {
        petAction($(this).data("action"));
    });

    // Listen for character changes to update contacts
    $(document).on("character_selected", onCharacterSelected);
}

// ==================== PHONE OPEN/CLOSE ====================

function togglePhone() {
    if (phoneVisible) closePhone();
    else openPhone();
}
function openPhone() {
    phoneVisible = true;
    $("#phone-overlay").addClass("active");
    syncCharacterData();
}
function closePhone() {
    phoneVisible = false;
    $("#phone-overlay").removeClass("active");
}

// ==================== PANEL NAVIGATION ====================

const panelStack = [];

function openPanel(panelId) {
    const panelEl = $(`#panel-${panelId}`);
    if (!panelEl.length) return;

    if (currentPanel) {
        $(`#panel-${currentPanel}`).removeClass("open");
    }
    panelStack.push(panelId);
    currentPanel = panelId;
    panelEl.addClass("open");

    // Init panel content
    switch (panelId) {
        case "ig": renderInstagram(); break;
        case "line": renderLine(); break;
        case "tiktok": renderTikTok(); break;
        case "twitter": renderTwitter(); break;
        case "settings": renderSettings(); break;
        case "notes": renderNotes(); break;
        case "music": renderMusic(); break;
        case "weather": loadWeather(); break;
        case "game": renderPetGame(); break;
    }
}

function goBack() {
    if (panelStack.length <= 1) {
        $(`#panel-${currentPanel}`).removeClass("open");
        panelStack.length = 0;
        currentPanel = null;
        return;
    }
    panelStack.pop();
    $(`#panel-${currentPanel}`).removeClass("open");
    currentPanel = panelStack[panelStack.length - 1];
    $(`#panel-${currentPanel}`).addClass("open");
}

// ==================== CLOCK ====================

function startClock() {
    updateClock();
    setInterval(updateClock, 1000);
}
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" });
    $("#sb-time, #hw-time").text(timeStr);
    $("#hw-date").text(dateStr);
}

// ==================== CHARACTER SYNC ====================

function syncCharacterData() {
    const ctx = getContext();
    const char = ctx.characters?.[ctx.characterId];
    if (!char) return;

    const charName = char.name || "{{Char}}";
    const charEmoji = "🌸";

    // Auto add char to IG contacts if not present
    if (!settings.igDMs.find(d => d.id === "char_main")) {
        settings.igDMs.unshift({
            id: "char_main",
            name: charName,
            avatar: charEmoji,
            handle: `@${charName.toLowerCase().replace(/\s/g, "_")}`,
            messages: [],
            story: { emoji: "✨", time: "เมื่อกี้" }
        });
    } else {
        settings.igDMs[0].name = charName;
    }

    // Auto add to LINE
    if (!settings.lineDMs.find(d => d.id === "char_main")) {
        settings.lineDMs.unshift({
            id: "char_main",
            name: charName,
            avatar: charEmoji,
            messages: []
        });
    } else {
        settings.lineDMs[0].name = charName;
    }

    // Auto add to Twitter
    if (!settings.tweets.find(t => t.authorId === "char_main")) {
        settings.tweets.unshift({
            id: "tw_" + Date.now(),
            authorId: "char_main",
            author: charName,
            handle: `@${charName.toLowerCase().replace(/\s/g, "_")}`,
            avatar: charEmoji,
            text: `สวัสดี ฉันคือ ${charName}! ยินดีที่ได้รู้จักทุกคน~ 🌸`,
            time: "เมื่อกี้",
            likes: Math.floor(Math.random() * 200) + 10,
            retweets: Math.floor(Math.random() * 50),
            replies: [],
            isPublic: true,
        });
    }

    // IG Stories from char
    if (!settings.igStories.find(s => s.id === "char_main")) {
        settings.igStories.unshift({
            id: "char_main",
            name: charName,
            avatar: charEmoji,
            content: "✨",
            time: "เมื่อกี้",
            seen: false
        });
    }

    saveSettings();
}

function onCharacterSelected() {
    syncCharacterData();
}

// ==================== AI RESPONSE ====================

async function getAiResponse(context, userMsg) {
    const ctx = getContext();
    const char = ctx.characters?.[ctx.characterId];
    const charName = char?.name || "ตัวละคร";
    const notes = settings.notes.map(n => n.text).join("\n");

    const systemPrompt = `คุณคือ ${charName} ตัวละครใน SillyTavern กำลังตอบข้อความทาง ${context}
จำไว้ว่า: ตอบในสไตล์ของ ${charName} และอยู่ใน roleplay เสมอ ตอบสั้นๆ เป็นธรรมชาติ ไม่เกิน 2-3 ประโยค
${notes ? `\nบันทึกของผู้เล่น (จดจำไว้):\n${notes}` : ""}`;

    try {
        const prompt = `[${context}] ${userMsg}`;
        const response = await generateQuietPrompt(prompt, false, false, systemPrompt);
        return response || "...";
    } catch {
        return getRandomReply(charName);
    }
}

function getRandomReply(name) {
    const replies = [
        `${name}: หวัดดี! ยังอยู่นะ~`,
        "อ๊ะ ได้ยินเลย! 💕",
        "โอเค โอเค~ รับทราบแล้ว",
        "จริงๆ เหรอ? น่าสนใจนะ...",
        "ฮ่าๆ ก็ดีนะ!"
    ];
    return replies[Math.floor(Math.random() * replies.length)];
}

// ==================== INSTAGRAM ====================

function renderInstagram() {
    renderIgStories();
    renderIgView();
}

function renderIgView() {
    const views = { feed: "#ig-feed-view", dm: "#ig-dm-view", profile: "#ig-profile-view" };
    Object.values(views).forEach(v => $(v).hide());
    $(views[currentIgTab]).show().css("display", "flex");

    if (currentIgTab === "feed") {
        renderIgStories();
        renderIgPosts();
    } else if (currentIgTab === "dm") {
        renderIgDMs();
    } else if (currentIgTab === "profile") {
        renderIgProfile();
    }
}

function renderIgStories() {
    const stories = settings.igStories;
    let html = stories.map((s, i) => `
        <div class="ig-story-bubble" data-index="${i}">
            <div class="ig-story-ring ${s.seen ? 'seen' : ''}">
                <div class="ig-story-avatar">${s.avatar}</div>
            </div>
            <span class="ig-story-name">${s.name}</span>
        </div>
    `).join("");

    // Add story button
    html = `<div class="ig-story-bubble" id="add-story-btn">
        <div class="ig-story-ring" style="background:#ccc;">
            <div class="ig-story-avatar" style="font-size:26px;">➕</div>
        </div>
        <span class="ig-story-name">สตอรี่ใหม่</span>
    </div>` + html;

    $("#ig-stories-row").html(html);
}

function openStoryViewer(idx) {
    const story = settings.igStories[idx];
    if (!story) return;
    story.seen = true;
    saveSettings();

    $("#sv-avatar").text(story.avatar);
    $("#sv-name").text(story.name);
    $("#sv-time").text(story.time);
    $("#sv-content").text(story.content);

    const progHtml = settings.igStories.map((_, i) =>
        `<div class="story-progress-bar"><div class="story-progress-fill" ${i === idx ? 'id="active-prog"' : ''}></div></div>`
    ).join("");
    $("#story-progress").html(progHtml);

    $("#story-viewer").addClass("open");
    setTimeout(() => {
        $("#active-prog").css("width", "100%");
        setTimeout(() => closeStoryViewer(), 5200);
    }, 100);
}

function closeStoryViewer() {
    $("#story-viewer").removeClass("open");
    renderIgStories();
}

function renderIgPosts() {
    const allPosts = [
        ...settings.igDMs.map(dm => ({
            authorId: dm.id, author: dm.name, avatar: dm.avatar,
            handle: dm.handle || `@${dm.name.toLowerCase()}`,
            imgEmoji: "🌸", caption: `${dm.name} โพสต์รูปใหม่! 📸`,
            likes: Math.floor(Math.random() * 500) + 50,
            comments: Math.floor(Math.random() * 30),
            time: "2h", id: `post_${dm.id}`
        }))
    ];

    if (!allPosts.length) {
        $("#ig-posts-feed").html(`<div style="text-align:center;padding:40px;font-family:var(--font-main);color:var(--phone-text-light);">ยังไม่มีโพสต์<br>ติดตามตัวละครเพื่อเห็นโพสต์</div>`);
        return;
    }

    const html = allPosts.map((p, i) => `
        <div class="ig-post">
            <div class="ig-post-header">
                <div class="ig-post-avatar">${p.avatar}</div>
                <div>
                    <div class="ig-post-user">${p.author}</div>
                    <div class="ig-post-time">${p.time}</div>
                </div>
                <div style="margin-left:auto;font-size:18px;cursor:pointer;">⋯</div>
            </div>
            <div class="ig-post-img">${p.imgEmoji}</div>
            <div class="ig-post-actions">
                <button class="ig-action-btn ig-like-btn" data-idx="${i}">🤍</button>
                <button class="ig-action-btn ig-comment-btn" data-idx="${i}">💬</button>
                <button class="ig-action-btn">✈️</button>
                <span style="margin-left:auto"><button class="ig-action-btn">🔖</button></span>
            </div>
            <div class="ig-post-likes">❤️ ${p.likes} ไลก์</div>
            <div class="ig-post-caption"><strong>${p.author}</strong> ${p.caption}</div>
            <div class="ig-post-comments-link">ดู ${p.comments} ความคิดเห็น</div>
        </div>
    `).join("");
    $("#ig-posts-feed").html(html);

    // Like button
    $(document).off("click", ".ig-like-btn").on("click", ".ig-like-btn", function () {
        const btn = $(this);
        if (btn.text() === "🤍") {
            btn.text("❤️");
        } else {
            btn.text("🤍");
        }
    });
}

function renderIgDMs() {
    const html = settings.igDMs.map(dm => `
        <div class="dm-item" data-contact="${dm.id}">
            <div class="dm-avatar">${dm.avatar}</div>
            <div class="dm-info">
                <div class="dm-name">${dm.name}</div>
                <div class="dm-preview">${dm.messages.length ? dm.messages[dm.messages.length-1].text.substring(0,30) : "ยังไม่มีข้อความ"}</div>
            </div>
            <div class="dm-time">เมื่อกี้</div>
        </div>
    `).join("");
    $("#ig-dm-list").html(html || `<div style="text-align:center;padding:40px;font-family:var(--font-main);color:var(--phone-text-light);">ยังไม่มีการสนทนา</div>`);
}

function renderIgProfile() {
    const html = `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
            <div style="width:72px;height:72px;border-radius:50%;background:var(--ig-gradient);display:flex;align-items:center;justify-content:center;font-size:36px;">👤</div>
            <div>
                <div style="font-weight:700;font-size:16px;font-family:var(--font-main);">${settings.userName}</div>
                <div style="font-size:13px;color:var(--phone-text-light);font-family:var(--font-main);">${settings.userHandle}</div>
            </div>
        </div>
        <div style="display:flex;gap:16px;margin-bottom:20px;">
            <div style="text-align:center;flex:1;">
                <div style="font-weight:700;font-family:var(--font-main);">${settings.igDMs.length}</div>
                <div style="font-size:12px;color:var(--phone-text-light);font-family:var(--font-main);">กำลังติดตาม</div>
            </div>
            <div style="text-align:center;flex:1;">
                <div style="font-weight:700;font-family:var(--font-main);">0</div>
                <div style="font-size:12px;color:var(--phone-text-light);font-family:var(--font-main);">ผู้ติดตาม</div>
            </div>
            <div style="text-align:center;flex:1;">
                <div style="font-weight:700;font-family:var(--font-main);">0</div>
                <div style="font-size:12px;color:var(--phone-text-light);font-family:var(--font-main);">โพสต์</div>
            </div>
        </div>
        <div style="text-align:center;padding:40px;background:var(--phone-secondary);border-radius:var(--phone-radius-sm);font-family:var(--font-main);color:var(--phone-text-light);">📷 ยังไม่มีโพสต์</div>
    `;
    $("#ig-profile-content").html(html);
}

function openIgChat(contactId) {
    const dm = settings.igDMs.find(d => d.id === contactId);
    if (!dm) return;
    activeChatContact = contactId;
    $("#ig-chat-title").text(dm.name);
    renderChatWindow("#ig-chat-window", dm.messages);
    $("#ig-chat-panel").addClass("open");
}

async function sendIgMessage() {
    const text = $("#ig-chat-input").val().trim();
    if (!text) return;
    $("#ig-chat-input").val("");

    const dm = settings.igDMs.find(d => d.id === activeChatContact);
    if (!dm) return;

    dm.messages.push({ from: "me", text, time: now() });
    renderChatWindow("#ig-chat-window", dm.messages);
    saveSettings();

    // AI reply
    const reply = await getAiResponse("Instagram DM", text);
    dm.messages.push({ from: "them", text: reply, time: now() });
    renderChatWindow("#ig-chat-window", dm.messages);
    saveSettings();
}

// ==================== LINE ====================

function renderLine() {
    renderLineView();
}

function renderLineView() {
    if (currentLineTab === "chat") {
        $("#line-chat-view").show().css("display", "flex");
        $("#line-call-view").hide();
        renderLineDMs();
    } else {
        $("#line-chat-view").hide();
        $("#line-call-view").show().css("display", "flex");
        renderLineCallContacts();
    }
}

function renderLineDMs() {
    const html = settings.lineDMs.map(dm => `
        <div class="dm-item" data-linecontact="${dm.id}">
            <div class="dm-avatar" style="background:var(--line-color);">${dm.avatar}</div>
            <div class="dm-info">
                <div class="dm-name">${dm.name}</div>
                <div class="dm-preview">${dm.messages.length ? dm.messages[dm.messages.length-1].text.substring(0,30) : "ยังไม่มีข้อความ"}</div>
            </div>
            <div class="dm-time">เมื่อกี้</div>
        </div>
    `).join("");
    $("#line-chat-list").html(html || `<div style="text-align:center;padding:40px;font-family:var(--font-main);color:var(--phone-text-light);">ยังไม่มีการสนทนา</div>`);
}

function renderLineCallContacts() {
    const html = settings.lineDMs.map(dm => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px;background:white;border-radius:var(--phone-radius-sm);margin-bottom:8px;font-family:var(--font-main);">
            <div style="width:44px;height:44px;border-radius:50%;background:var(--line-color);display:flex;align-items:center;justify-content:center;font-size:22px;">${dm.avatar}</div>
            <span style="flex:1;font-weight:600;">${dm.name}</span>
            <button class="line-call-contact-btn" style="padding:6px 12px;border-radius:16px;background:var(--line-color);border:none;color:white;cursor:pointer;font-family:var(--font-main);font-size:12px;" data-contact="${dm.id}" data-video="false">📞</button>
            <button class="line-call-contact-btn" style="padding:6px 12px;border-radius:16px;background:#2f80ed;border:none;color:white;cursor:pointer;font-family:var(--font-main);font-size:12px;" data-contact="${dm.id}" data-video="true">📹</button>
        </div>
    `).join("");
    $("#line-call-contacts").html(html);
}

function openLineChat(contactId) {
    const dm = settings.lineDMs.find(d => d.id === contactId);
    if (!dm) return;
    activeChatContact = contactId;
    $("#line-chat-title").text(dm.name);
    renderChatWindow("#line-chat-window", dm.messages);
    $("#line-chat-panel").addClass("open");
}

async function sendLineMessage() {
    const text = $("#line-chat-input").val().trim();
    if (!text) return;
    $("#line-chat-input").val("");

    const dm = settings.lineDMs.find(d => d.id === activeChatContact);
    if (!dm) return;

    dm.messages.push({ from: "me", text, time: now() });
    renderChatWindow("#line-chat-window", dm.messages);
    saveSettings();

    const reply = await getAiResponse("LINE", text);
    dm.messages.push({ from: "them", text: reply, time: now() });
    renderChatWindow("#line-chat-window", dm.messages);
    saveSettings();
}

function shareLocation() {
    const dm = settings.lineDMs.find(d => d.id === activeChatContact);
    if (!dm) return;
    const locMsg = "📍 แชร์พิกัดตำแหน่งปัจจุบัน\nhttps://maps.google.com/...";
    dm.messages.push({ from: "me", text: locMsg, time: now() });
    renderChatWindow("#line-chat-window", dm.messages);
    saveSettings();
    showToast("แชร์พิกัดแล้ว 📍");
}

// Call
function startCall(isVideo) {
    const dm = settings.lineDMs.find(d => d.id === activeChatContact);
    const name = dm?.name || "ตัวละคร";
    const emoji = dm?.avatar || "👤";

    $("#call-avatar").text(emoji);
    $("#call-name").text(name);
    $("#call-status").text(isVideo ? "📹 วิดีโอคอล..." : "📞 กำลังโทร...");
    $("#call-timer").text("00:00");
    $("#call-screen").addClass("open");

    setTimeout(() => {
        $("#call-status").text(isVideo ? "📹 กำลังคุย" : "📞 กำลังคุย");
        callSeconds = 0;
        callTimer = setInterval(() => {
            callSeconds++;
            const m = String(Math.floor(callSeconds / 60)).padStart(2, "0");
            const s = String(callSeconds % 60).padStart(2, "0");
            $("#call-timer").text(`${m}:${s}`);
        }, 1000);
    }, 2000);
}

function endCall() {
    clearInterval(callTimer);
    callTimer = null;
    $("#call-screen").removeClass("open");
    showToast(`วางสายแล้ว ⏱ ${$("#call-timer").text()}`);
}

// ==================== TIKTOK ====================

function getTTVideos() {
    const ctx = getContext();
    const char = ctx.characters?.[ctx.characterId];
    const charName = char?.name || "ตัวละคร";
    return [
        { user: charName, avatar: "🌸", content: "✨", caption: "ชีวิตดีมีความสุข~ 💕", sound: "🎵 เพลงยอดนิยม", likes: "2.4K", comments: "128", shares: "89" },
        { user: "npc_friend", avatar: "🎀", content: "🌺", caption: "วันนี้อากาศดีมากก", sound: "🎵 เสียงธรรมชาติ", likes: "1.1K", comments: "45", shares: "23" },
        { user: "npc_cook", avatar: "👨‍🍳", content: "🍜", caption: "ทำอาหารง่ายๆ สูตรลับ!", sound: "🎵 เพลงครัว", likes: "5.6K", comments: "302", shares: "214" },
        { user: "npc_travel", avatar: "✈️", content: "🌴", caption: "ที่เที่ยวสุดอินเทรนด์!", sound: "🎵 เพลง chill", likes: "8.9K", comments: "521", shares: "478" },
        { user: "npc_dance", avatar: "💃", content: "🎶", caption: "เต้นตามกระแสใหม่~", sound: "🎵 เพลงฮิตประจำวัน", likes: "14.2K", comments: "892", shares: "1.2K" },
    ];
}

function renderTikTok() {
    const videos = getTTVideos();
    const v = videos[ttVideoIndex];

    const html = `
        <div class="tt-video-item">
            <div class="tt-video-bg">
                <div style="font-size:100px;">${v.content}</div>
                <div class="tt-video-overlay">
                    <div class="tt-user">@${v.user}</div>
                    <div class="tt-caption">${v.caption}</div>
                    <div class="tt-sound">🎵 ${v.sound}</div>
                </div>
            </div>
        </div>
    `;

    const actionsHtml = `
        <div class="tt-action" style="cursor:pointer;" onclick="this.children[0].textContent = this.children[0].textContent === '❤️' ? '🤍' : '❤️'">
            <div class="icon">🤍</div>
            <div class="count">${v.likes}</div>
        </div>
        <div class="tt-action"><div class="icon">💬</div><div class="count">${v.comments}</div></div>
        <div class="tt-action"><div class="icon">📤</div><div class="count">${v.shares}</div></div>
        <div class="tt-action" style="width:42px;height:42px;border-radius:50%;background:var(--ig-gradient);display:flex;align-items:center;justify-content:center;font-size:20px;">${v.avatar}</div>
    `;

    const dotsHtml = videos.map((_, i) =>
        `<div class="tt-nav-dot ${i === ttVideoIndex ? 'active' : ''}"></div>`
    ).join("");

    $("#tt-video-container").html(html);
    $("#tt-actions").html(actionsHtml);
    $("#tt-nav-dots").html(dotsHtml);
}

// ==================== TWITTER ====================

function renderTwitter() {
    const html = settings.tweets.filter(t => t.isPublic || t.authorId !== "char_main").map((t, i) => `
        <div class="tw-tweet" data-index="${i}">
            <div class="tw-tweet-avatar">${t.avatar}</div>
            <div class="tw-tweet-body">
                <div class="tw-tweet-header">
                    <span class="tw-tweet-name">${t.author}</span>
                    <span class="tw-tweet-handle">${t.handle}</span>
                    <span class="tw-tweet-time">${t.time}</span>
                </div>
                <div class="tw-tweet-text">${t.text}</div>
                <div class="tw-tweet-actions">
                    <button class="tw-action-btn" data-action="reply">💬 ${t.replies?.length || 0}</button>
                    <button class="tw-action-btn" data-action="retweet">🔁 ${t.retweets}</button>
                    <button class="tw-action-btn" data-action="like">🤍 ${t.likes}</button>
                    <button class="tw-action-btn" data-action="share">📤</button>
                </div>
            </div>
        </div>
    `).join("");

    $("#tw-feed").html(html || `<div style="text-align:center;padding:60px;font-family:var(--font-main);color:var(--phone-text-light);">ยังไม่มีทวีต<br>กด ✏️ เพื่อโพสต์แรก!</div>`);
}

function postTweet() {
    const text = $("#tw-compose-text").val().trim();
    if (!text) return;

    const isPublic = $(".privacy-btn.active").data("privacy") === "public";
    const tweet = {
        id: "tw_" + Date.now(),
        authorId: "player",
        author: settings.userName,
        handle: settings.userHandle,
        avatar: "👤",
        text,
        time: "เมื่อกี้",
        likes: 0,
        retweets: 0,
        replies: [],
        isPublic,
    };
    settings.tweets.unshift(tweet);
    saveSettings();
    renderTwitter();
    $("#tw-compose").removeClass("open");
    $("#tw-compose-text").val("");
    showToast(isPublic ? "โพสต์แล้ว 🌍" : "โพสต์แบบส่วนตัวแล้ว 🔒");
}

function handleTweetAction(action, idx) {
    const t = settings.tweets[idx];
    if (!t) return;
    if (action === "like") { t.likes++; }
    if (action === "retweet") { t.retweets++; showToast("รีทวีตแล้ว 🔁"); }
    if (action === "share") { showToast("คัดลอกลิงก์แล้ว 📤"); }
    saveSettings();
    renderTwitter();
}

function openTweetDetail(idx) {
    const t = settings.tweets[idx];
    if (!t) return;
    const html = `
        <div class="tw-tweet" style="border-bottom:2px solid var(--phone-secondary);" onclick="">
            <div class="tw-tweet-avatar">${t.avatar}</div>
            <div class="tw-tweet-body">
                <div class="tw-tweet-header"><span class="tw-tweet-name">${t.author}</span><span class="tw-tweet-handle">${t.handle}</span></div>
                <div class="tw-tweet-text" style="font-size:16px;margin-top:4px;">${t.text}</div>
                <div style="font-size:12px;color:var(--phone-text-light);margin:8px 0;font-family:var(--font-main);">${t.time}</div>
                <div style="display:flex;gap:16px;font-family:var(--font-main);font-size:13px;padding:10px 0;border-top:1px solid var(--phone-secondary);">
                    <span><strong>${t.retweets}</strong> รีทวีต</span>
                    <span><strong>${t.likes}</strong> ไลก์</span>
                </div>
            </div>
        </div>
        <div style="padding:16px;font-family:var(--font-main);">
            <div style="font-weight:700;font-size:14px;color:var(--phone-text);margin-bottom:10px;">ความคิดเห็น</div>
            ${t.replies.map(r => `<div style="padding:10px 0;border-bottom:1px solid var(--phone-secondary);font-size:13px;">${r}</div>`).join("") || '<div style="color:var(--phone-text-light);">ยังไม่มีความคิดเห็น</div>'}
        </div>
    `;
    $("#tw-detail-content").html(html);
    $("#tw-detail").addClass("open");
}

// ==================== SETTINGS ====================

function renderSettings() {
    const wallpapers = [
        { label: "💜 ม่วงชมพู", value: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)" },
        { label: "🌅 ทอแสง", value: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
        { label: "🌊 ทะเล", value: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
        { label: "🌲 ป่าไม้", value: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
        { label: "🌙 กลางคืน", value: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" },
        { label: "🌸 ซากุระ", value: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)" },
    ];

    const wpHtml = wallpapers.map(w => `
        <div class="wp-option ${settings.wallpaper === w.value ? 'active' : ''}" 
             data-wp="${w.value}" 
             style="background:${w.value};"
             title="${w.label}">
        </div>
    `).join("");

    const html = `
        <div class="settings-section">
            <div class="settings-label">โปรไฟล์ผู้เล่น</div>
            <div class="settings-card">
                <div class="settings-item">
                    <div class="s-icon" style="background:#eee;">👤</div>
                    <div class="s-info">
                        <div class="s-name">ชื่อ</div>
                        <div class="s-sub">ชื่อในเกม</div>
                    </div>
                    <span class="s-val">${settings.userName}</span>
                    <span class="s-arrow">›</span>
                </div>
                <div class="settings-item">
                    <div class="s-icon" style="background:#eee;">📱</div>
                    <div class="s-info">
                        <div class="s-name">เบอร์โทรศัพท์</div>
                    </div>
                    <span class="s-val">${settings.userPhone}</span>
                    <span class="s-arrow">›</span>
                </div>
                <div class="settings-item">
                    <div class="s-icon" style="background:#d4edda;">💰</div>
                    <div class="s-info">
                        <div class="s-name">ยอดเงินในบัญชี</div>
                        <div class="s-sub">ใช้ล่าสุด: ค่าอาหาร -150฿</div>
                    </div>
                    <span class="s-val">${settings.userBalance.toLocaleString()}฿</span>
                    <span class="s-arrow">›</span>
                </div>
            </div>
        </div>
        <div class="settings-section">
            <div class="settings-label">วอลเปเปอร์</div>
            <div class="settings-card">
                <div class="settings-item" style="flex-direction:column;align-items:flex-start;">
                    <div class="wallpaper-picker">${wpHtml}</div>
                </div>
            </div>
        </div>
        <div class="settings-section">
            <div class="settings-label">วันที่ & เวลา</div>
            <div class="settings-card">
                <div class="settings-item">
                    <div class="s-icon" style="background:#fff3cd;">📅</div>
                    <div class="s-info">
                        <div class="s-name">วันที่ปัจจุบัน</div>
                        <div class="s-sub" id="settings-date"></div>
                    </div>
                </div>
                <div class="settings-item">
                    <div class="s-icon" style="background:#cce5ff;">🕐</div>
                    <div class="s-info">
                        <div class="s-name">เวลาปัจจุบัน</div>
                        <div class="s-sub" id="settings-time"></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="settings-section">
            <div class="settings-label">เกี่ยวกับ</div>
            <div class="settings-card">
                <div class="settings-item">
                    <div class="s-icon" style="background:linear-gradient(135deg,var(--phone-accent),var(--phone-accent2));">📱</div>
                    <div class="s-info">
                        <div class="s-name">Phone Extension</div>
                        <div class="s-sub">v1.0.0 by SillyTavern</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    $("#settings-body").html(html);

    const now2 = new Date();
    $("#settings-date").text(now2.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    $("#settings-time").text(now2.toLocaleTimeString("th-TH"));
}

// ==================== NOTES ====================

function renderNotes() {
    if (!settings.notes.length) {
        $("#notes-body").html(`<div style="text-align:center;padding:60px;font-family:var(--font-main);color:var(--phone-text-light);">📝 ยังไม่มีบันทึก<br><small>กด + เพื่อเพิ่มบันทึกใหม่</small></div>`);
        return;
    }
    const html = settings.notes.map((n, i) => `
        <div class="note-card" data-index="${i}">
            <div class="note-date">${n.date}</div>
            <div class="note-text">${n.text.substring(0, 100)}${n.text.length > 100 ? "..." : ""}</div>
        </div>
    `).join("");
    $("#notes-body").html(html);
}

function openNoteEditor(idx) {
    noteEditing = idx;
    if (idx !== null && settings.notes[idx]) {
        $("#note-textarea").val(settings.notes[idx].text);
    } else {
        $("#note-textarea").val("");
    }
    $("#note-editor").addClass("open");
    setTimeout(() => $("#note-textarea").focus(), 300);
}

function saveNote() {
    const text = $("#note-textarea").val().trim();
    if (!text) return;

    const note = { text, date: new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) };

    if (noteEditing !== null) {
        settings.notes[noteEditing] = note;
    } else {
        settings.notes.unshift(note);
    }
    saveSettings();
    renderNotes();
    $("#note-editor").removeClass("open");
    showToast("บันทึกแล้ว ✅");
}

// ==================== MUSIC ====================

function renderMusic() {
    renderPlaylist();
    if (currentPlayingIndex >= 0) {
        showPlayerCard(currentPlayingIndex);
    }
}

function addMusicTrack() {
    const url = $("#music-url-input").val().trim();
    if (!url) return;
    if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
        showToast("กรุณาใส่ลิงก์ YouTube เท่านั้น");
        return;
    }
    const videoId = extractYouTubeId(url);
    if (!videoId) { showToast("ลิงก์ไม่ถูกต้อง"); return; }

    const track = { url, videoId, title: "🎵 กำลังโหลด...", channel: "" };
    settings.playlist.push(track);
    saveSettings();
    renderPlaylist();
    $("#music-url-input").val("");
    showToast("เพิ่มเพลงแล้ว 🎵");

    if (currentPlayingIndex === -1) playTrack(settings.playlist.length - 1);
}

function extractYouTubeId(url) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
    return match?.[1] || null;
}

function renderPlaylist() {
    const html = settings.playlist.map((t, i) => `
        <div class="playlist-item ${i === currentPlayingIndex ? 'active' : ''}" data-idx="${i}">
            <div class="pl-icon">${i === currentPlayingIndex ? '▶️' : '🎵'}</div>
            <div class="pl-info">
                <div class="pl-title">${t.title}</div>
                <div class="pl-url">${t.url}</div>
            </div>
            <button class="pl-del" data-idx="${i}">🗑</button>
        </div>
    `).join("");
    $("#music-playlist").html(html || `<div style="text-align:center;padding:30px;font-family:var(--font-main);color:var(--phone-text-light);">วางลิงก์ YouTube ข้างบน</div>`);
}

function playTrack(idx) {
    if (!settings.playlist[idx]) return;
    currentPlayingIndex = idx;
    const track = settings.playlist[idx];
    showPlayerCard(idx);
    renderPlaylist();

    const embedUrl = `https://www.youtube.com/embed/${track.videoId}?autoplay=1&enablejsapi=1`;
    $("#yt-embed-area").html(`<div class="yt-embed-container"><iframe src="${embedUrl}" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>`);
    $("#mp-title").text(track.title);
    $("#mp-channel").text("YouTube");
    $("#music-playpause").text("⏸");
}

function showPlayerCard(idx) {
    const track = settings.playlist[idx];
    if (!track) return;
    $("#mp-title").text(track.title);
    $("#mp-channel").text("YouTube");
    $("#music-player-card").show();
}

function musicPlayPause() {
    const btn = $("#music-playpause");
    if (btn.text() === "▶") {
        btn.text("⏸");
    } else {
        btn.text("▶");
    }
}

function musicPrev() {
    if (currentPlayingIndex > 0) playTrack(currentPlayingIndex - 1);
}

function musicNext() {
    if (currentPlayingIndex < settings.playlist.length - 1) playTrack(currentPlayingIndex + 1);
}

function deleteTrack(idx) {
    settings.playlist.splice(idx, 1);
    if (currentPlayingIndex >= idx) currentPlayingIndex--;
    saveSettings();
    renderPlaylist();
}

// ==================== WEATHER ====================

async function loadWeather() {
    const ctx = getContext();
    // Simple weather data based on in-game logic
    const weatherData = getWeatherForChar();
    renderWeather(weatherData);
    $("#hw-weather-text").text(`${weatherData.temp}°C ${weatherData.desc}`);
}

function getWeatherForChar() {
    const weathers = [
        { icon: "☀️", desc: "แดดจ้า", temp: 32, humidity: 60, wind: "12", feel: 35 },
        { icon: "⛅", desc: "มีเมฆบางส่วน", temp: 28, humidity: 70, wind: "8", feel: 30 },
        { icon: "🌧️", desc: "ฝนตก", temp: 24, humidity: 90, wind: "15", feel: 23 },
        { icon: "🌤️", desc: "อากาศดี", temp: 27, humidity: 65, wind: "10", feel: 28 },
        { icon: "🌩️", desc: "ฟ้าคะนอง", temp: 22, humidity: 85, wind: "20", feel: 21 },
    ];
    const idx = new Date().getHours() % weathers.length;
    return weathers[idx];
}

function renderWeather(w) {
    const ctx = getContext();
    const char = ctx.characters?.[ctx.characterId];
    const charName = char?.name || "ตัวละคร";

    const html = `
        <div class="weather-main-card">
            <div class="weather-place">📍 ที่ตั้งใน ${charName}'s World</div>
            <div class="weather-icon-big">${w.icon}</div>
            <div class="weather-temp-big">${w.temp}°</div>
            <div class="weather-desc">${w.desc}</div>
            <div class="weather-detail-row">
                <div class="weather-detail"><div class="wd-label">ความชื้น</div><div class="wd-val">${w.humidity}%</div></div>
                <div class="weather-detail"><div class="wd-label">ลม</div><div class="wd-val">${w.wind} กม/ช</div></div>
                <div class="weather-detail"><div class="wd-label">รู้สึก</div><div class="wd-val">${w.feel}°</div></div>
            </div>
        </div>
        <div class="weather-extra-row">
            <div class="weather-extra-card">
                <div class="we-icon">🌅</div>
                <div class="we-label">พระอาทิตย์ขึ้น</div>
                <div class="we-val">06:15</div>
            </div>
            <div class="weather-extra-card">
                <div class="we-icon">🌇</div>
                <div class="we-label">พระอาทิตย์ตก</div>
                <div class="we-val">18:42</div>
            </div>
            <div class="weather-extra-card">
                <div class="we-icon">👁️</div>
                <div class="we-label">ทัศนวิสัย</div>
                <div class="we-val">10 กม</div>
            </div>
            <div class="weather-extra-card">
                <div class="we-icon">🌡️</div>
                <div class="we-label">ดัชนีความร้อน</div>
                <div class="we-val">${w.humidity > 80 ? "สูง" : "ปานกลาง"}</div>
            </div>
        </div>
        <div style="text-align:center;margin-top:12px;font-family:var(--font-main);font-size:12px;color:var(--phone-text-light);">
            📅 ${new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}
        </div>
    `;
    $("#weather-body").html(html);
}

// ==================== PET GAME ====================

const PETS = [
    { type: "cat", emoji: "🐱", name: "แมว" },
    { type: "dog", emoji: "🐶", name: "หมา" },
    { type: "rabbit", emoji: "🐰", name: "กระต่าย" },
    { type: "hamster", emoji: "🐹", name: "แฮมสเตอร์" },
    { type: "fox", emoji: "🦊", name: "จิ้งจอก" },
    { type: "bear", emoji: "🐻", name: "หมี" },
];

function renderPetGame() {
    if (!settings.petState) {
        renderPetSelect();
    } else {
        renderPetMain();
    }
}

function renderPetSelect() {
    const optHtml = PETS.map(p => `
        <div class="pet-option" data-type="${p.type}" data-emoji="${p.emoji}" data-name="${p.name}">
            <div class="po-emoji">${p.emoji}</div>
            <div class="po-name">${p.name}</div>
        </div>
    `).join("");

    const html = `
        <div class="pet-select-screen">
            <div class="pet-select-title">🐾 เลือกสัตว์เลี้ยงของคุณ</div>
            <div class="pet-options">${optHtml}</div>
        </div>
    `;
    $("#game-body").html(html);
}

function renderPetMain() {
    const pet = settings.petState;
    const actionsHtml = [
        { action: "feed", label: "🍖 ให้อาหาร" },
        { action: "bath", label: "🛁 อาบน้ำ" },
        { action: "brush", label: "🪮 แปรงขน" },
        { action: "play", label: "🎾 เล่นด้วย" },
        { action: "walk", label: "🚶 พาเดิน" },
        { action: "poke", label: "😝 แกล้ง" },
    ].map(a => `<button class="pet-action-btn" data-action="${a.action}">${a.label}</button>`).join("");

    const html = `
        <div class="pet-game-screen">
            <div class="pet-stats-row">
                <div class="pet-stat">
                    <div class="pet-stat-label">🍖 หิว</div>
                    <div class="pet-stat-bar"><div class="pet-stat-fill hunger" style="width:${pet.hunger}%"></div></div>
                </div>
                <div class="pet-stat">
                    <div class="pet-stat-label">😊 สุข</div>
                    <div class="pet-stat-bar"><div class="pet-stat-fill happy" style="width:${pet.happy}%"></div></div>
                </div>
                <div class="pet-stat">
                    <div class="pet-stat-label">✨ สะอาด</div>
                    <div class="pet-stat-bar"><div class="pet-stat-fill clean" style="width:${pet.clean}%"></div></div>
                </div>
            </div>
            <div class="pet-stage">
                <div class="pet-speech" id="pet-speech">${pet.speech}</div>
                <div class="pet-emoji-big">${pet.emoji}</div>
            </div>
            <div class="pet-actions">${actionsHtml}</div>
        </div>
    `;
    $("#game-body").html(html);
}

function petAction(action) {
    const pet = settings.petState;
    if (!pet) return;

    const reactions = {
        feed: { speech: "อร่อยมากก! 😋🍖", hunger: 20, happy: 5 },
        bath: { speech: "สดชื่นมากเลย~ 🛁✨", clean: 25, happy: 5 },
        brush: { speech: "ชอบมากๆ เลยยย 🪮💕", clean: 10, happy: 15 },
        play: { speech: "สนุกมากก! 🎾😆", happy: 20 },
        walk: { speech: "อากาศดีดีด! 🚶🌸", happy: 15, hunger: -10 },
        poke: { speech: "ฮ้ะ! อย่าแกล้งสิ!! 😾", happy: -10 },
    };

    const r = reactions[action];
    if (!r) return;

    pet.speech = r.speech;
    if (r.hunger) pet.hunger = Math.max(0, Math.min(100, pet.hunger + r.hunger));
    if (r.happy) pet.happy = Math.max(0, Math.min(100, pet.happy + r.happy));
    if (r.clean) pet.clean = Math.max(0, Math.min(100, pet.clean + r.clean));

    saveSettings();
    renderPetMain();

    // Animate
    $(".pet-emoji-big").css("transform", "scale(1.3)");
    setTimeout(() => $(".pet-emoji-big").css("transform", ""), 200);
}

// ==================== HELPERS ====================

function renderChatWindow(selector, messages) {
    const html = messages.map(m => `
        <div class="chat-msg ${m.from === "me" ? "me" : "them"}">${m.text}</div>
    `).join("");
    $(selector).html(html);
    const el = $(selector)[0];
    if (el) el.scrollTop = el.scrollHeight;
}

function now() {
    return new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function showToast(msg) {
    const toast = $("#phone-toast");
    toast.text(msg).addClass("show");
    setTimeout(() => toast.removeClass("show"), 2500);
}

function applyWallpaper() {
    const wp = settings.wallpaper || DEFAULTS.wallpaper;
    document.documentElement.style.setProperty("--wallpaper", wp);
    $("#phone-home").css("background", wp);
    $("#phone-statusbar").css("background", wp);
}
