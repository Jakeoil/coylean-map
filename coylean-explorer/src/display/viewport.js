export class Viewport {
    constructor({
        panX = 0,
        panY = 0,
        zoom = 1,
        minZoom = 0.01,
        maxZoom = 100,
        zoomSpeed = 0.0015,
        zoomAtCursor = true,
        panEnabled = true,
        zoomEnabled = true,
        onChange = null,
    } = {}) {
        this.panX = panX;
        this.panY = panY;
        this.zoom = zoom;
        this.minZoom = minZoom;
        this.maxZoom = maxZoom;
        this.zoomSpeed = zoomSpeed;
        this.zoomAtCursor = zoomAtCursor;
        this.panEnabled = panEnabled;
        this.zoomEnabled = zoomEnabled;
        this.onChange = onChange;

        this._element = null;
        this._dragging = false;
        this._pointerId = null;
        this._lastX = 0;
        this._lastY = 0;

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onWheel = this._onWheel.bind(this);
    }

    attach(element) {
        if (this._element) this.detach();
        this._element = element;
        element.addEventListener("pointerdown", this._onPointerDown);
        element.addEventListener("pointermove", this._onPointerMove);
        element.addEventListener("pointerup", this._onPointerUp);
        element.addEventListener("pointercancel", this._onPointerUp);
        element.addEventListener("wheel", this._onWheel, { passive: false });
    }

    detach() {
        const el = this._element;
        if (!el) return;
        el.removeEventListener("pointerdown", this._onPointerDown);
        el.removeEventListener("pointermove", this._onPointerMove);
        el.removeEventListener("pointerup", this._onPointerUp);
        el.removeEventListener("pointercancel", this._onPointerUp);
        el.removeEventListener("wheel", this._onWheel);
        this._element = null;
        this._dragging = false;
        this._pointerId = null;
    }

    screenToWorld(sx, sy) {
        return {
            x: (sx - this.panX) / this.zoom,
            y: (sy - this.panY) / this.zoom,
        };
    }

    worldToScreen(wx, wy) {
        return {
            x: wx * this.zoom + this.panX,
            y: wy * this.zoom + this.panY,
        };
    }

    setView({ panX, panY, zoom } = {}) {
        if (panX !== undefined) this.panX = panX;
        if (panY !== undefined) this.panY = panY;
        if (zoom !== undefined) this.zoom = this._clampZoom(zoom);
        this._emit();
    }

    reset() {
        this.panX = 0;
        this.panY = 0;
        this.zoom = 1;
        this._emit();
    }

    zoomBy(factor, cx, cy) {
        const newZoom = this._clampZoom(this.zoom * factor);
        const actual = newZoom / this.zoom;
        if (actual === 1) return;
        if (cx !== undefined && cy !== undefined) {
            this.panX = cx - (cx - this.panX) * actual;
            this.panY = cy - (cy - this.panY) * actual;
        }
        this.zoom = newZoom;
        this._emit();
    }

    panBy(dx, dy) {
        this.panX += dx;
        this.panY += dy;
        this._emit();
    }

    _clampZoom(z) {
        return Math.min(this.maxZoom, Math.max(this.minZoom, z));
    }

    _localCoords(e) {
        const rect = this._element.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    _onPointerDown(e) {
        if (!this.panEnabled || this._dragging) return;
        this._dragging = true;
        this._pointerId = e.pointerId;
        this._lastX = e.clientX;
        this._lastY = e.clientY;
        if (this._element.setPointerCapture) {
            this._element.setPointerCapture(e.pointerId);
        }
    }

    _onPointerMove(e) {
        if (!this._dragging || e.pointerId !== this._pointerId) return;
        const dx = e.clientX - this._lastX;
        const dy = e.clientY - this._lastY;
        this._lastX = e.clientX;
        this._lastY = e.clientY;
        this.panBy(dx, dy);
    }

    _onPointerUp(e) {
        if (e.pointerId !== this._pointerId) return;
        this._dragging = false;
        this._pointerId = null;
        if (this._element.releasePointerCapture) {
            try {
                this._element.releasePointerCapture(e.pointerId);
            } catch (_) {}
        }
    }

    _onWheel(e) {
        if (!this.zoomEnabled) return;
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * this.zoomSpeed);
        if (this.zoomAtCursor) {
            const { x, y } = this._localCoords(e);
            this.zoomBy(factor, x, y);
        } else {
            this.zoomBy(factor);
        }
    }

    _emit() {
        if (this.onChange) this.onChange(this);
    }
}
