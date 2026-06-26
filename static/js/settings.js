/* ═══════════════════════════════════════════════
   settings.js - 设置页面逻辑
   ═══════════════════════════════════════════════ */

(function() {

    var idleTimer = null;
    var showResource = false;

    // ── 加载设置 ──
    function loadSettingsUI() {
        return fetch('/api/settings').then(function(r){return r.json();}).then(function(s) {
            MoCang.settingsData = s;
            var lock = s.lock || {};
            var editor = s.editor || {};
            var iface = s.interface || {};
            var software = s.software || {};

            var hasPassword = !!(lock.password && lock.password.length > 0);
            document.getElementById('set-lock-enabled').checked = hasPassword && !!lock.enabled;
            document.getElementById('set-lock-enabled').disabled = !hasPassword;
            document.getElementById('btn-clear-password').style.display = hasPassword ? 'inline-block' : 'none';
            document.getElementById('set-lock-idle').value = String(lock.idle_timeout || 0);
            document.getElementById('set-auto-save').checked = editor.auto_save !== false;
            document.getElementById('set-save-interval').value = String(editor.save_interval || 60);
            document.getElementById('set-font-size').value = String(editor.font_size || 14);
            document.getElementById('set-dark-mode').checked = iface.dark_mode !== false;
            document.getElementById('set-opacity').value = Math.round((iface.opacity != null ? iface.opacity : 1) * 100);
            document.getElementById('opacity-value').textContent = (iface.opacity != null ? iface.opacity : 1).toFixed(1);
            document.getElementById('set-ui-opacity').value = Math.round((iface.ui_opacity != null ? iface.ui_opacity : 0.9) * 100);
            document.getElementById('ui-opacity-value').textContent = (iface.ui_opacity != null ? iface.ui_opacity : 0.9).toFixed(1);
            document.getElementById('set-bg-blur').value = iface.bg_blur || 0;
            document.getElementById('bg-blur-value').textContent = (iface.bg_blur || 0) + 'px';
            document.getElementById('set-auto-update').checked = !!software.auto_update;
            document.getElementById('set-show-resource').checked = !!software.show_resource;
            return s;
        });
    }

    // ── 实时应用设置 ──
    function applySettings(s) {
        var editor = s.editor || {};
        var iface = s.interface || {};

        // 字体大小
        var editorEl = document.getElementById('kb-editor');
        if (editorEl) editorEl.style.fontSize = (editor.font_size || 14) + 'px';

        // 全局透明度（Win32 窗口级，能看到桌面）
        var opacity = iface.opacity != null ? iface.opacity : 1;
        if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.set_window_opacity(opacity);
        }

        // 界面透明度（UI 组件背景）
        var uiOpacity = iface.ui_opacity != null ? iface.ui_opacity : 0.9;
        document.documentElement.style.setProperty('--ui-bg-alpha', uiOpacity);

        // 背景模糊度
        var bgBlur = iface.bg_blur || 0;
        var bgEl = document.getElementById('bg-layer');
        if (bgEl) bgEl.style.filter = bgBlur > 0 ? 'blur(' + bgBlur + 'px)' : 'none';

        // 暗黑模式
        var isLight = iface.dark_mode === false;
        if (isLight) {
            document.documentElement.classList.add('light-mode');
        } else {
            document.documentElement.classList.remove('light-mode');
        }

        // SVG 图标颜色切换
        var svgFilter = isLight ? 'none' : 'invert(1) brightness(0.8)';
        document.querySelectorAll('img[src*="/static/icons/svgs/"]').forEach(function(img) {
            img.style.filter = svgFilter;
        });

        // 资源占用显示
        var software = s.software || {};
        showResource = !!software.show_resource;
        var resEl = document.getElementById('titlebar-resource');
        if (resEl) resEl.style.display = showResource ? 'inline' : 'none';
        if (showResource) updateResource();

        // 自动保存间隔
        if (typeof MoCang.setAutoSaveInterval === 'function') {
            MoCang.setAutoSaveInterval((editor.auto_save !== false) ? (editor.save_interval || 60) * 1000 : 0);
        }

        // 锁屏空闲检测
        setupIdleLock(s.lock || {});
    }

    function applyBackground(path) {
        var bg = document.getElementById('bg-layer');
        if (!bg) return;
        if (path) {
            bg.style.backgroundImage = 'url(/api/background?t=' + Date.now() + ')';
        } else {
            bg.style.backgroundImage = '';
        }
        updateBgRemoveBtn();
    }

    // 更新移除按钮显示状态
    function updateBgRemoveBtn() {
        var btn = document.getElementById('btn-remove-bg');
        var bg = document.getElementById('bg-layer');
        if (btn && bg) {
            btn.style.display = bg.style.backgroundImage ? 'inline-block' : 'none';
        }
    }

    // ── 锁屏逻辑 ──
    function setupIdleLock(lock) {
        if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
        if (!lock.enabled || !lock.idle_timeout || lock.idle_timeout <= 0) return;
        var timeout = lock.idle_timeout * 1000;
        function resetIdle() {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(function() { showLockScreen(); }, timeout);
        }
        ['mousemove','mousedown','keydown','touchstart','scroll'].forEach(function(evt) {
            document.addEventListener(evt, resetIdle, {passive: true});
        });
        resetIdle();
    }

    function showLockScreen() {
        var lock = (MoCang.settingsData || {}).lock || {};
        if (!lock.enabled || !lock.password) return;
        document.getElementById('lock-overlay').style.display = 'flex';
        document.getElementById('lock-password').value = '';
        document.getElementById('lock-error').style.display = 'none';
        document.getElementById('lock-password').focus();
        if (window.pywebview && window.pywebview.api) window.pywebview.api.set_locked(true);
    }

    function unlockScreen() {
        var pwd = document.getElementById('lock-password').value;
        if (!pwd) return;
        fetch('/api/settings/verify-lock', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({password: pwd})
        }).then(function(r){return r.json();}).then(function(d) {
            if (d && d.ok) {
                document.getElementById('lock-overlay').style.display = 'none';
                document.getElementById('lock-password').value = '';
                document.getElementById('lock-error').style.display = 'none';
                if (window.pywebview && window.pywebview.api) window.pywebview.api.set_locked(false);
            } else {
                var err = document.getElementById('lock-error');
                err.textContent = (d && d.error) || '密码错误';
                err.style.display = 'block';
                document.getElementById('lock-password').value = '';
                document.getElementById('lock-password').focus();
            }
        }).catch(function() {
            var err = document.getElementById('lock-error');
            err.textContent = '验证失败，请重试';
            err.style.display = 'block';
        });
    }

    // ── 资源占用监控 ──
    function updateResource() {
        if (!showResource) return;
        window.pywebview.api.get_resource_usage().then(function(r) {
            var el = document.getElementById('titlebar-resource');
            if (el) el.textContent = 'CPU ' + r.cpu + '% | MEM ' + r.mem + 'MB';
        });
    }

    // ═══════════════════════════════════════════════
    //  设置页面事件绑定
    // ═══════════════════════════════════════════════

    // 打开设置页面
    document.getElementById('btn-settings').addEventListener('click', function() {
        loadSettingsUI();
        document.getElementById('settings-overlay').style.display = 'flex';
    });

    // 关闭设置页面
    document.getElementById('settings-close').addEventListener('click', function() {
        document.getElementById('settings-overlay').style.display = 'none';
    });
    document.getElementById('btn-settings-cancel').addEventListener('click', function() {
        document.getElementById('settings-overlay').style.display = 'none';
    });

    // 菜单切换
    document.querySelectorAll('.settings-menu-item').forEach(function(item) {
        item.addEventListener('click', function() {
            document.querySelectorAll('.settings-menu-item').forEach(function(i){i.classList.remove('active');});
            document.querySelectorAll('.settings-section').forEach(function(s){s.classList.remove('active');});
            item.classList.add('active');
            document.getElementById('section-' + item.dataset.section).classList.add('active');
        });
    });

    // 滑块实时显示
    document.getElementById('set-opacity').addEventListener('input', function() {
        document.getElementById('opacity-value').textContent = (this.value / 100).toFixed(1);
    });
    document.getElementById('set-ui-opacity').addEventListener('input', function() {
        document.getElementById('ui-opacity-value').textContent = (this.value / 100).toFixed(1);
    });
    document.getElementById('set-bg-blur').addEventListener('input', function() {
        document.getElementById('bg-blur-value').textContent = this.value + 'px';
    });

    // 保存设置
    document.getElementById('btn-settings-save').addEventListener('click', function() {
        var newSettings = {
            lock: {
                enabled: document.getElementById('set-lock-enabled').checked,
                idle_timeout: parseInt(document.getElementById('set-lock-idle').value),
            },
            editor: {
                auto_save: document.getElementById('set-auto-save').checked,
                save_interval: parseInt(document.getElementById('set-save-interval').value),
                font_size: parseInt(document.getElementById('set-font-size').value),
            },
            interface: {
                dark_mode: document.getElementById('set-dark-mode').checked,
                opacity: parseInt(document.getElementById('set-opacity').value) / 100,
                ui_opacity: parseInt(document.getElementById('set-ui-opacity').value) / 100,
                bg_blur: parseInt(document.getElementById('set-bg-blur').value),
            },
            software: {
                auto_update: document.getElementById('set-auto-update').checked,
                show_resource: document.getElementById('set-show-resource').checked,
            }
        };
        // 保留密码不覆盖
        if (MoCang.settingsData && MoCang.settingsData.lock && MoCang.settingsData.lock.password) {
            newSettings.lock.password = MoCang.settingsData.lock.password;
        }
        fetch('/api/settings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(newSettings)
        }).then(function(r){return r.json();}).then(function() {
            document.getElementById('settings-overlay').style.display = 'none';
            applySettings(newSettings);
        });
    });

    // 设置密码
    document.getElementById('btn-set-password').addEventListener('click', function() {
        showPrompt('请输入新锁屏密码：', '', '设置密码').then(function(pwd) {
            if (pwd !== null && pwd.length > 0) {
                fetch('/api/settings', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({lock: {password: pwd}})
                }).then(function() {
                    if (MoCang.settingsData) { if (!MoCang.settingsData.lock) MoCang.settingsData.lock = {}; MoCang.settingsData.lock.password = pwd; }
                    document.getElementById('set-lock-enabled').disabled = false;
                    document.getElementById('btn-clear-password').style.display = 'inline-block';
                    showAlert('密码已设置');
                });
            }
        });
    });

    // 清除密码
    document.getElementById('btn-clear-password').addEventListener('click', function() {
        showConfirm('确定清除锁屏密码？清除后锁屏功能将关闭。', '清除密码', true).then(function(ok) {
            if (ok) {
                fetch('/api/settings', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({lock: {password: '', enabled: false}})
                }).then(function() {
                    if (MoCang.settingsData) { if (!MoCang.settingsData.lock) MoCang.settingsData.lock = {}; MoCang.settingsData.lock.password = ''; MoCang.settingsData.lock.enabled = false; }
                    document.getElementById('set-lock-enabled').checked = false;
                    document.getElementById('set-lock-enabled').disabled = true;
                    document.getElementById('btn-clear-password').style.display = 'none';
                    showAlert('密码已清除，锁屏已关闭');
                });
            }
        });
    });

    // 上传背景图片
    document.getElementById('btn-upload-bg').addEventListener('click', function() {
        document.getElementById('bg-file-input').click();
    });
    document.getElementById('bg-file-input').addEventListener('change', function() {
        var file = this.files[0];
        if (!file) return;
        var fd = new FormData();
        fd.append('file', file);
        fetch('/api/settings/upload-bg', {method: 'POST', body: fd}).then(function(r){return r.json();}).then(function(d) {
            if (d.ok) {
                applyBackground(d.path);
                showAlert('背景图片已更新');
            } else {
                showAlert(d.error || '上传失败', '错误');
            }
        });
    });

    // 移除背景图片
    document.getElementById('btn-remove-bg').addEventListener('click', function() {
        fetch('/api/settings/remove-bg', {method: 'POST'}).then(function(r){return r.json();}).then(function(d) {
            if (d.ok) {
                applyBackground('');
                showAlert('背景图片已移除');
            }
        });
    });

    // 解锁按钮
    document.getElementById('btn-unlock').addEventListener('click', unlockScreen);
    document.getElementById('lock-password').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') unlockScreen();
    });

    // 锁屏关闭按钮
    document.getElementById('btn-lock-close').addEventListener('click', function() {
        if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.close();
        }
    });

    // ── 启动时加载设置并应用（等待 pywebview 就绪）──
    window.addEventListener('pywebviewready', function() {
        fetch('/api/settings').then(function(r){return r.json();}).then(function(s) {
            MoCang.settingsData = s;
            MoCang.ungroupedPosition = s.ungrouped_position != null ? s.ungrouped_position : 0;
            applySettings(s);
            if (s.interface && s.interface.background_image) {
                applyBackground(s.interface.background_image);
            }
            // 强制锁屏（上次未解锁就关闭了）
            if (s.lock && s.lock.force_lock && s.lock.enabled && s.lock.password) {
                showLockScreen();
                // 清除标记
                fetch('/api/settings', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({lock:{force_lock:false}})});
            }
        });

        // 资源占用监控
        setInterval(updateResource, 2000);
        updateResource();
    });

    // ── 暴露到 MoCang 命名空间 ──
    MoCang.loadSettingsUI = loadSettingsUI;
    MoCang.applySettings = applySettings;
    MoCang.applyBackground = applyBackground;
    MoCang.updateBgRemoveBtn = updateBgRemoveBtn;
    MoCang.setupIdleLock = setupIdleLock;
    MoCang.showLockScreen = showLockScreen;
    MoCang.unlockScreen = unlockScreen;

})();
