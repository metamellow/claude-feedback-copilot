// Feedback Copilot — Overlay Injection Script
// This runs in the HOST page context (injected via bookmarklet or javascript_tool).
// It creates: (1) a floating iframe with the panel, (2) a drawing canvas.
// __PORT__ is replaced dynamically by the bridge server.

(function () {
  if (document.getElementById('fc-overlay-root')) return; // already injected

  var PORT = '__PORT__';
  var PANEL_URL = 'http://localhost:' + PORT + '/?overlay=true';

  // ========== Overlay Container ==========

  var root = document.createElement('div');
  root.id = 'fc-overlay-root';
  root.style.cssText = 'position:fixed;bottom:20px;right:20px;width:380px;height:540px;z-index:2147483646;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.15);display:flex;flex-direction:column;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;';

  // --- Drag Handle ---
  var handle = document.createElement('div');
  handle.style.cssText = 'height:28px;background:#f0f0f0;cursor:grab;display:flex;align-items:center;justify-content:center;flex-shrink:0;border-bottom:1px solid rgba(0,0,0,0.06);user-select:none;-webkit-user-select:none;';
  handle.innerHTML = '<div style="width:36px;height:4px;background:#ccc;border-radius:2px;"></div>';

  // --- Minimize Button ---
  var minBtn = document.createElement('button');
  minBtn.textContent = '\u2013'; // en-dash as minimize icon
  minBtn.title = 'Minimize';
  minBtn.style.cssText = 'position:absolute;top:4px;right:8px;width:22px;height:22px;border:none;background:rgba(0,0,0,0.06);border-radius:6px;cursor:pointer;font-size:14px;line-height:1;color:#6e6e73;display:flex;align-items:center;justify-content:center;z-index:1;';
  handle.style.position = 'relative';
  handle.appendChild(minBtn);

  var isMinimized = false;
  minBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    isMinimized = !isMinimized;
    if (isMinimized) {
      iframe.style.display = 'none';
      root.style.height = '28px';
      minBtn.textContent = '+';
      minBtn.title = 'Expand';
    } else {
      iframe.style.display = 'block';
      root.style.height = '540px';
      minBtn.textContent = '\u2013';
      minBtn.title = 'Minimize';
    }
  });

  // --- iframe ---
  var iframe = document.createElement('iframe');
  iframe.src = PANEL_URL;
  iframe.allow = 'microphone';
  iframe.style.cssText = 'flex:1;border:none;width:100%;background:#fafafa;';

  root.appendChild(handle);
  root.appendChild(iframe);
  document.body.appendChild(root);

  // ========== Drag Behavior ==========

  var isDragging = false;
  var dragOffsetX = 0;
  var dragOffsetY = 0;

  handle.addEventListener('mousedown', function (e) {
    isDragging = true;
    handle.style.cursor = 'grabbing';
    var rect = root.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    var x = e.clientX - dragOffsetX;
    var y = e.clientY - dragOffsetY;
    // Constrain to viewport
    x = Math.max(0, Math.min(x, window.innerWidth - root.offsetWidth));
    y = Math.max(0, Math.min(y, window.innerHeight - root.offsetHeight));
    root.style.left = x + 'px';
    root.style.top = y + 'px';
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', function () {
    if (isDragging) {
      isDragging = false;
      handle.style.cursor = 'grab';
    }
  });

  // Touch drag support
  handle.addEventListener('touchstart', function (e) {
    isDragging = true;
    var touch = e.touches[0];
    var rect = root.getBoundingClientRect();
    dragOffsetX = touch.clientX - rect.left;
    dragOffsetY = touch.clientY - rect.top;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!isDragging) return;
    var touch = e.touches[0];
    var x = touch.clientX - dragOffsetX;
    var y = touch.clientY - dragOffsetY;
    x = Math.max(0, Math.min(x, window.innerWidth - root.offsetWidth));
    y = Math.max(0, Math.min(y, window.innerHeight - root.offsetHeight));
    root.style.left = x + 'px';
    root.style.top = y + 'px';
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  }, { passive: true });

  document.addEventListener('touchend', function () {
    isDragging = false;
  });

  // ========== Drawing Canvas ==========

  var canvas = document.createElement('canvas');
  canvas.id = 'fc-draw-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483645;pointer-events:none;opacity:0;transition:opacity 0.15s;';
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  var drawMode = false;
  var isDrawingStroke = false;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Floating "Done" button on canvas (fallback for when panel is minimized)
  var canvasDoneBtn = document.createElement('button');
  canvasDoneBtn.textContent = 'Done Drawing';
  canvasDoneBtn.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;padding:10px 20px;background:#ff3b30;color:white;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;display:none;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;box-shadow:0 4px 16px rgba(255,59,48,0.3);';
  document.body.appendChild(canvasDoneBtn);

  canvasDoneBtn.addEventListener('click', function () {
    finishDrawing();
  });

  function activateDrawing() {
    drawMode = true;
    canvas.style.pointerEvents = 'auto';
    canvas.style.opacity = '1';
    canvas.style.cursor = 'crosshair';
    canvasDoneBtn.style.display = 'block';
    // Clear previous drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Subtle overlay hint
    ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function finishDrawing() {
    if (!drawMode) return;
    drawMode = false;
    canvas.style.pointerEvents = 'none';
    canvas.style.cursor = 'default';
    canvasDoneBtn.style.display = 'none';

    // Capture the drawing
    var imageData = canvas.toDataURL('image/png');
    canvas.style.opacity = '0';

    // Send back to iframe
    iframe.contentWindow.postMessage({ type: 'fc-drawing-complete', imageData: imageData }, '*');

    // Clear after a beat
    setTimeout(function () {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 200);
  }

  function clearDrawing() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (drawMode) {
      // Re-apply subtle overlay hint
      ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  // --- Mouse drawing ---
  canvas.addEventListener('mousedown', function (e) {
    if (!drawMode) return;
    isDrawingStroke = true;
    ctx.beginPath();
    ctx.moveTo(e.clientX, e.clientY);
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  });

  canvas.addEventListener('mousemove', function (e) {
    if (!isDrawingStroke) return;
    ctx.lineTo(e.clientX, e.clientY);
    ctx.stroke();
  });

  canvas.addEventListener('mouseup', function () {
    isDrawingStroke = false;
  });

  canvas.addEventListener('mouseleave', function () {
    isDrawingStroke = false;
  });

  // --- Touch drawing ---
  canvas.addEventListener('touchstart', function (e) {
    if (!drawMode) return;
    e.preventDefault();
    isDrawingStroke = true;
    var touch = e.touches[0];
    ctx.beginPath();
    ctx.moveTo(touch.clientX, touch.clientY);
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  });

  canvas.addEventListener('touchmove', function (e) {
    if (!isDrawingStroke) return;
    e.preventDefault();
    var touch = e.touches[0];
    ctx.lineTo(touch.clientX, touch.clientY);
    ctx.stroke();
  });

  canvas.addEventListener('touchend', function () {
    isDrawingStroke = false;
  });

  // --- Escape key to finish drawing ---
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawMode) {
      finishDrawing();
    }
  });

  // ========== postMessage Bridge ==========

  window.addEventListener('message', function (e) {
    if (!e.data || !e.data.type) return;

    switch (e.data.type) {
      case 'fc-start-drawing':
        activateDrawing();
        break;
      case 'fc-stop-drawing':
        finishDrawing();
        break;
      case 'fc-clear-drawing':
        clearDrawing();
        break;
      case 'fc-hide-overlay':
        root.style.display = 'none';
        canvas.style.display = 'none';
        canvasDoneBtn.style.display = 'none';
        break;
      case 'fc-show-overlay':
        root.style.display = 'flex';
        canvas.style.display = 'block';
        break;
    }
  });
})();
