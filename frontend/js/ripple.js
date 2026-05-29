/**
 * ripple.js — WebGL 水面涟漪特效
 * 
 * 功能说明：
 *   在背景图（body::before 伪元素）之上叠加 WebGL 画布，通过着色器实现
 *   位移映射（displacement mapping）和高光/暗纹效果，模拟真实水面波纹。
 * 
 * 涟漪池管理：
 *   - 自动涟漪：固定 3 个，随机 2~5 秒生成，位置随机
 *   - 鼠标涟漪：最多 3 个，点击生成，超出上限则快速淡出最早的
 * 
 * 技术栈：原生 JS + WebGL 1.0 + 着色器，无第三方库依赖。
 */
(function () {
    'use strict';

    // ============================================================
    // 1. 配置常量
    // ============================================================
    const CONFIG = {
        // 自动涟漪
        AUTO_COUNT_MAX: 3,               // 同时存在的自动涟漪上限
        AUTO_INTERVAL_MIN: 800,          // 生成间隔下限 (ms)
        AUTO_INTERVAL_MAX: 2000,         // 生成间隔上限 (ms)
        AUTO_DURATION: [6000, 8000],     // 生命周期范围 (ms)
        AUTO_RADIUS_FACTOR: 0.5,         // 最大半径 = min(宽,高) × 此因子（≈ 屏幕宽/6）
        AUTO_MARGIN: 30,                 // 与画布边缘的最小距离 (px)
        AUTO_PEAK_TIME: 0.2,             // 达到峰值强度的时间 (s)

        // 鼠标涟漪
        CLICK_COUNT_MAX: 3,
        CLICK_DURATION: [4000, 5000],
        CLICK_RADIUS_FACTOR: 0.65,       // 鼠标涟漪最大半径 = 自动涟漪最大半径 × 此因子
        CLICK_PEAK_TIME: 0.2,
        CLICK_FAST_FADE_DURATION: 500,   // 快速淡出时长 (ms)

        // 渲染
        MAX_RIPPLES: 6,                  // 总涟漪上限（自动 + 鼠标）
        AMPLITUDE_NORMALIZED: 0.02,      // 最大位移幅度（归一化纹理坐标）
        HIGHLIGHT_STRENGTH: 0.2,        // 高光/暗纹强度系数
        WAVELENGTH_FACTOR: 0.2,          // 波长 = maxRadius × 此因子
        WAVE_SPEED: 3.0,                 // 波动速度

        // 背景图片映射（与 style.css 一致）
        BG_MAP: {
            'homepage': '/images/home-bg.jpg',
            'note-page': '/images/note-bg.png',
            'friends-page': '/images/home-bg.jpg',
            'log-page': '/images/note-bg.png',
        },
        DEFAULT_BG: '/images/home-bg.jpg',
    };

    // ============================================================
    // 2. 着色器源代码
    // ============================================================

    const VERTEX_SHADER_SRC = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `;

    const FRAGMENT_SHADER_SRC = `
    precision highp float;

    varying vec2 v_texCoord;

    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform int u_rippleCount;
    uniform vec2 u_coverScale;   // CSS cover 变换缩放因子

    // 涟漪参数数组（最多 6 个）
    uniform vec2  u_centers[6];
    uniform float u_radii[6];
    uniform float u_intensities[6];
    uniform float u_maxRadii[6];

    void main() {
      vec2 canvasUV = v_texCoord;            // 画布空间的 UV (0~1)
      vec2 totalOffset = vec2(0.0);
      float totalColorMod = 0.0;

      // 常量
      const float PI = 3.14159265359;
      const float AMPLITUDE = 0.02;
      const float HIGHLIGHT = 0.2;

      for (int i = 0; i < 6; i++) {
        // 跳过无效涟漪（intensity <= 0 或 radius <= 0）
        float intensity = u_intensities[i];
        float radius = u_radii[i];
        if (intensity < 0.001 || radius < 0.001) continue;

        vec2 delta = canvasUV - u_centers[i];
        float dist = length(delta);

        // 只处理在半径范围内的像素
        if (dist < radius) {
          float radialFactor = dist / radius;             // 0~1，中心到边缘
          float maxRadius = u_maxRadii[i];
          float wavelength = maxRadius * 0.2;             // 波长随涟漪大小变化
          float phase = u_time * 3.0;                     // 相位随时间推进
          float wave = sin(2.0 * PI * (dist / wavelength) - phase);  // 正弦波
          float envelope = (1.0 - radialFactor) * intensity;          // 包络衰减
          float displacement = AMPLITUDE * wave * envelope;           // 位移量

          // 安全处理：防止 dist=0 时除以 0
          vec2 dir = dist > 0.001 ? normalize(delta) : vec2(0.0, 0.0);

          totalOffset += dir * displacement;

          // 高光/暗纹：波峰亮、波谷暗
          totalColorMod += HIGHLIGHT * intensity * wave * envelope;
        }
      }

      // 对画布 UV 施加偏移（涟漪扭曲发生在画布空间）
      vec2 displacedUV = clamp(canvasUV + totalOffset, 0.0, 1.0);

      // CSS cover 变换：将画布 UV 映射到图片 UV，保持宽高比居中裁剪
      vec2 coverUV = (displacedUV - 0.5) * u_coverScale + 0.5;

      // 采样背景纹理
      vec4 color = texture2D(u_texture, coverUV);

      // 叠加高光/暗纹
      color.rgb += totalColorMod;

      gl_FragColor = color;
    }
  `;

    // ============================================================
    // 3. 涟漪对象工厂
    // ============================================================

    /**
     * 创建一个涟漪对象
     * @param {'auto'|'click'} type
     * @param {number} x 归一化 x 坐标 (0~1)
     * @param {number} y 归一化 y 坐标 (0~1)
     * @param {number} maxRadius 归一化最大半径 (0~1)
     * @param {number} duration 生命周期 (ms)
     * @param {number} peakTime 达到峰值强度的时间 (s)
     * @returns {object}
     */
    function createRipple(type, x, y, maxRadius, duration, peakTime) {
        return {
            type: type,
            x: x,
            y: y,
            radius: 0,                    // 当前半径，每帧更新
            maxRadius: maxRadius,
            intensity: 0,                 // 当前强度 (0~1)，每帧更新
            startTime: performance.now(),
            duration: duration,
            peakTime: peakTime || CONFIG.AUTO_PEAK_TIME,
            fastFade: false,              // 是否正在快速淡出
            fastFadeStart: 0,             // 快速淡出开始时间
            frozenRadius: 0,              // 快速淡出时冻结的半径
        };
    }

    /**
     * 更新涟漪状态（每帧调用）
     * @param {object} ripple
     * @param {number} now performance.now()
     */
    function updateRipple(ripple, now) {
        if (ripple.fastFade) {
            // 快速淡出模式
            const fadeElapsed = now - ripple.fastFadeStart;
            const fadeProgress = Math.min(fadeElapsed / CONFIG.CLICK_FAST_FADE_DURATION, 1.0);
            ripple.radius = ripple.frozenRadius;
            ripple.intensity = Math.max(0, 1.0 - fadeProgress);
            return fadeProgress >= 1.0; // 返回 true 表示可以移除
        }

        // 正常生命周期
        const elapsed = now - ripple.startTime;
        const progress = Math.min(elapsed / ripple.duration, 1.0);

        // 半径线性增长
        ripple.radius = progress * ripple.maxRadius;

        // 强度包络：先攀升到峰值，再衰减
        const peakProgress = ripple.peakTime / (ripple.duration / 1000);
        if (progress < peakProgress) {
            // 攀升阶段
            ripple.intensity = progress / peakProgress;
        } else {
            // 衰减阶段
            ripple.intensity = 1.0 - (progress - peakProgress) / (1.0 - peakProgress);
        }
        ripple.intensity = Math.max(0, Math.min(1, ripple.intensity));

        return progress >= 1.0; // 返回 true 表示生命周期结束
    }

    // ============================================================
    // 4. WebGL 渲染器
    // ============================================================

    class WebGLRenderer {
        constructor(canvas) {
            this.canvas = canvas;
            this.gl = null;
            this.program = null;
            this.uniformLocs = {};
            this.texture = null;
            this.bgImage = null;
            this.isReady = false;

            this._initGL();
        }

        _initGL() {
            const gl = this.canvas.getContext('webgl', {
                alpha: true,
                premultipliedAlpha: false,
                antialias: false,
            });
            if (!gl) {
                console.error('[ripple] WebGL 不可用，水面特效将不启动。');
                return;
            }
            this.gl = gl;

            // 编译着色器
            const vs = this._compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
            const fs = this._compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
            if (!vs || !fs) return;

            const program = gl.createProgram();
            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.error('[ripple] 着色器链接失败:', gl.getProgramInfoLog(program));
                return;
            }
            gl.useProgram(program);
            this.program = program;

            // 删除着色器对象
            gl.deleteShader(vs);
            gl.deleteShader(fs);

            // 获取 uniform 位置
            this.uniformLocs = {
                u_texture: gl.getUniformLocation(program, 'u_texture'),
                u_resolution: gl.getUniformLocation(program, 'u_resolution'),
                u_time: gl.getUniformLocation(program, 'u_time'),
                u_rippleCount: gl.getUniformLocation(program, 'u_rippleCount'),
                u_coverScale: gl.getUniformLocation(program, 'u_coverScale'),
                u_centers: gl.getUniformLocation(program, 'u_centers'),
                u_radii: gl.getUniformLocation(program, 'u_radii'),
                u_intensities: gl.getUniformLocation(program, 'u_intensities'),
                u_maxRadii: gl.getUniformLocation(program, 'u_maxRadii'),
            };

            // 创建全屏四边形（两个三角形组成一个矩形）
            const positions = new Float32Array([
                -1, -1, 0, 0,   // 左下
                1, -1, 1, 0,   // 右下
                -1, 1, 0, 1,   // 左上
                1, 1, 1, 1,   // 右上
            ]);

            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

            // 位置属性
            const posAttrib = gl.getAttribLocation(program, 'a_position');
            gl.enableVertexAttribArray(posAttrib);
            gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 16, 0);

            // 纹理坐标属性
            const texAttrib = gl.getAttribLocation(program, 'a_texCoord');
            gl.enableVertexAttribArray(texAttrib);
            gl.vertexAttribPointer(texAttrib, 2, gl.FLOAT, false, 16, 8);

            // 设置纹理单元
            gl.uniform1i(this.uniformLocs.u_texture, 0);

            this.isReady = true;
        }

        _compileShader(type, source) {
            const gl = this.gl;
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                const typeName = type === gl.VERTEX_SHADER ? '顶点' : '片段';
                console.error(`[ripple] ${typeName}着色器编译失败:`, gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        }

        /**
         * 加载背景图片作为纹理
         * @param {string} url 图片 URL
         * @returns {Promise<void>}
         */
        loadBackground(url) {
            return new Promise((resolve) => {
                const gl = this.gl;
                if (!gl) { resolve(); return; }

                const img = new Image();

                // file:// 协议下不支持 crossOrigin，跳过以避免加载失败
                const isFileProtocol = window.location.protocol === 'file:';
                if (!isFileProtocol) {
                    img.crossOrigin = 'anonymous';
                }

                const loadAttempt = (retryWithoutCrossOrigin) => {
                    img.onload = () => {
                        this.bgImage = img;
                        const texture = gl.createTexture();
                        gl.bindTexture(gl.TEXTURE_2D, texture);
                        // 翻转 Y 轴，使图片顶部对应纹理顶部
                        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

                        // 设置纹理参数
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

                        // 检查图片是否为 2 的幂，否则禁用 mipmap
                        const isPowerOf2 = (v) => (v & (v - 1)) === 0;
                        if (isPowerOf2(img.width) && isPowerOf2(img.height)) {
                            gl.generateMipmap(gl.TEXTURE_2D);
                        } else {
                            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                        }

                        if (this.texture) {
                            gl.deleteTexture(this.texture);
                        }
                        this.texture = texture;
                        console.log('[ripple] 背景纹理加载成功:', url);
                        resolve();
                    };

                    img.onerror = () => {
                        // 如果启用 crossOrigin 失败，重试一次不带 crossOrigin
                        if (retryWithoutCrossOrigin && img.crossOrigin) {
                            console.warn('[ripple] 跨域加载失败，重试不带 crossOrigin:', url);
                            const retryImg = new Image();
                            // 替换当前 img 的引用
                            const parentOnLoad = img.onload;
                            const parentOnError = img.onerror;
                            retryImg.onload = parentOnLoad;
                            retryImg.onerror = () => {
                                console.warn('[ripple] 背景图片彻底加载失败:', url, '保持透明，让 CSS 背景透出');
                                this.texture = null;
                                this.bgImage = null;
                                resolve();
                            };
                            retryImg.src = url;
                            return;
                        }

                        console.warn('[ripple] 背景图片加载失败:', url, '保持透明，让 CSS 背景透出');
                        this.texture = null;
                        this.bgImage = null;
                        resolve();
                    };
                };

                loadAttempt(true);
                img.src = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(); // 防止缓存
            });
        }

        /**
         * 渲染一帧
         * @param {number} time 当前时间 (s)
         * @param {Array} ripples 涟漪对象数组
         */
        render(time, ripples) {
            const gl = this.gl;
            if (!gl || !this.isReady) return;

            // 如果纹理尚未就绪，跳过绘制（保持透明，让 CSS 背景透出）
            if (!this.texture) return;

            // 更新视口
            const w = this.canvas.width;
            const h = this.canvas.height;
            gl.viewport(0, 0, w, h);

            // 清除
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            // 绑定纹理
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.texture);

            // 设置 uniforms
            gl.uniform2f(this.uniformLocs.u_resolution, w, h);
            gl.uniform1f(this.uniformLocs.u_time, time);

            // 计算 CSS cover 变换因子：保持图片宽高比居中裁剪
            // cover 模式下，图片缩放使较小维度对齐画布，较大维度溢出裁剪。
            // 纹理 UV 需 "压缩"（scale < 1）在溢出的那个维度上，只采样中央可见部分。
            if (this.bgImage && this.bgImage.width && this.bgImage.height) {
                const imgAspect = this.bgImage.width / this.bgImage.height;
                const canvasAspect = w / h;
                // 如果图片比画布"宽"(imgAspect > canvasAspect)：高度对齐，宽度裁剪
                //   → coverScaleX < 1 (水平压缩只取中央), coverScaleY = 1
                // 如果图片比画布"高"(imgAspect < canvasAspect)：宽度对齐，高度裁剪
                //   → coverScaleX = 1, coverScaleY < 1
                const coverScaleX = Math.min(canvasAspect / imgAspect, 1.0);
                const coverScaleY = Math.min(imgAspect / canvasAspect, 1.0);
                gl.uniform2f(this.uniformLocs.u_coverScale, coverScaleX, coverScaleY);
            } else {
                gl.uniform2f(this.uniformLocs.u_coverScale, 1.0, 1.0);
            }

            // 构建涟漪数组数据
            const count = Math.min(ripples.length, CONFIG.MAX_RIPPLES);
            gl.uniform1i(this.uniformLocs.u_rippleCount, count);

            const centers = new Float32Array(12);  // 6 × vec2
            const radii = new Float32Array(6);
            const intensities = new Float32Array(6);
            const maxRadii = new Float32Array(6);

            for (let i = 0; i < count; i++) {
                const r = ripples[i];
                centers[i * 2] = r.x;
                centers[i * 2 + 1] = 1.0 - r.y;  // WebGL 纹理 Y 轴翻转
                radii[i] = r.radius;
                intensities[i] = r.intensity;
                maxRadii[i] = r.maxRadius;
            }

            gl.uniform2fv(this.uniformLocs.u_centers, centers);
            gl.uniform1fv(this.uniformLocs.u_radii, radii);
            gl.uniform1fv(this.uniformLocs.u_intensities, intensities);
            gl.uniform1fv(this.uniformLocs.u_maxRadii, maxRadii);

            // 绘制
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        /**
         * 调整画布尺寸
         */
        resize() {
            const canvas = this.canvas;
            const dpr = window.devicePixelRatio || 1;
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            const bw = Math.round(w * dpr);
            const bh = Math.round(h * dpr);
            if (canvas.width !== bw || canvas.height !== bh) {
                canvas.width = bw;
                canvas.height = bh;
                return true;
            }
            return false;
        }

        destroy() {
            const gl = this.gl;
            if (gl) {
                if (this.texture) gl.deleteTexture(this.texture);
                if (this.program) gl.deleteProgram(this.program);
            }
            this.isReady = false;
        }
    }

    // ============================================================
    // 5. 涟漪池管理器
    // ============================================================

    class RipplePool {
        constructor(renderer, canvas) {
            this.renderer = renderer;
            this.canvas = canvas;

            // 涟漪存储
            this.autoRipples = [];
            this.clickRipples = [];

            // 自动涟漪计时器
            this.autoTimerId = null;
            this.autoInterval = 0;

            // 鼠标涟漪计数器（用于区分最早生成的那个）
            this.clickSequence = 0;

            // 动画状态
            this.animFrameId = null;
            this.lastTime = 0;
            this.isRunning = false;

            // 页面可见性
            this.isVisible = true;

            // 背景图片 URL
            this.currentBgUrl = CONFIG.DEFAULT_BG;

            // 绑定事件
            this._bindEvents();

            // 启动自动涟漪
            this._scheduleAutoRipple();
        }

        // ---- 背景图片检测 ----

        /**
         * 根据 body 的 class 确定当前背景图片 URL
         */
        getBackgroundUrl() {
            const body = document.body;
            for (const [cls, url] of Object.entries(CONFIG.BG_MAP)) {
                if (body.classList.contains(cls)) {
                    return url;
                }
            }
            // 默认（homepage 或无特殊 class）
            if (body.classList.contains('homepage') || !body.classList.contains('note-page')) {
                return CONFIG.DEFAULT_BG;
            }
            return CONFIG.DEFAULT_BG;
        }

        /**
         * 检查背景是否需要更新
         */
        checkBackgroundChange() {
            const newUrl = this.getBackgroundUrl();
            if (newUrl !== this.currentBgUrl) {
                this.currentBgUrl = newUrl;
                this.renderer.loadBackground(newUrl);
            }
        }

        // ---- 涟漪更新逻辑 ----

        /**
         * 生成随机位置（归一化坐标，边缘留白）
         * @returns {{x: number, y: number}}
         */
        _randomPosition() {
            const w = this.canvas.clientWidth || window.innerWidth;
            const h = this.canvas.clientHeight || window.innerHeight;
            const marginX = CONFIG.AUTO_MARGIN / w;
            const marginY = CONFIG.AUTO_MARGIN / h;
            return {
                x: marginX + Math.random() * (1 - 2 * marginX),
                y: marginY + Math.random() * (1 - 2 * marginY),
            };
        }

        /**
         * 计算涟漪的最大半径（归一化）
         * @param {'auto'|'click'} type
         * @returns {number}
         */
        _calcMaxRadius(type) {
            const w = this.canvas.clientWidth || window.innerWidth;
            const h = this.canvas.clientHeight || window.innerHeight;
            const baseMax = Math.min(w, h) * CONFIG.AUTO_RADIUS_FACTOR;
            const normalizedBase = baseMax / Math.max(w, h);
            if (type === 'click') {
                return normalizedBase * CONFIG.CLICK_RADIUS_FACTOR;
            }
            return normalizedBase;
        }

        /**
         * 生成一个随机涟漪并加入自动池
         */
        _spawnAutoRipple() {
            if (this.autoRipples.length >= CONFIG.AUTO_COUNT_MAX) {
                // 已达上限，等待后续调度
                return;
            }

            const pos = this._randomPosition();
            const maxR = this._calcMaxRadius('auto');
            const dur = CONFIG.AUTO_DURATION[0] +
                Math.random() * (CONFIG.AUTO_DURATION[1] - CONFIG.AUTO_DURATION[0]);

            const ripple = createRipple('auto', pos.x, pos.y, maxR, dur, CONFIG.AUTO_PEAK_TIME);
            this.autoRipples.push(ripple);
        }

        /**
         * 调度下一个自动涟漪
         */
        _scheduleAutoRipple() {
            if (this.autoTimerId) {
                clearTimeout(this.autoTimerId);
                this.autoTimerId = null;
            }

            // 如果池未满，立即生成一个
            if (this.autoRipples.length < CONFIG.AUTO_COUNT_MAX) {
                this._spawnAutoRipple();
            }

            // 无论是否生成，都设置下一个计时器（在池未满时，下一个计时器会触发新的生成）
            this.autoInterval = CONFIG.AUTO_INTERVAL_MIN +
                Math.random() * (CONFIG.AUTO_INTERVAL_MAX - CONFIG.AUTO_INTERVAL_MIN);

            this.autoTimerId = setTimeout(() => {
                this._scheduleAutoRipple();
            }, this.autoInterval);
        }

        /**
         * 处理鼠标点击生成涟漪
         * @param {number} clientX
         * @param {number} clientY
         */
        handleClick(clientX, clientY) {
            const rect = this.canvas.getBoundingClientRect();
            const x = (clientX - rect.left) / rect.width;
            const y = (clientY - rect.top) / rect.height;

            if (x < 0 || x > 1 || y < 0 || y > 1) return; // 点击不在画布范围内

            // 检查是否达到上限
            if (this.clickRipples.length >= CONFIG.CLICK_COUNT_MAX) {
                // 强制移除最早的鼠标涟漪（快速淡出）
                const oldest = this.clickRipples[0];
                if (oldest && !oldest.fastFade) {
                    oldest.fastFade = true;
                    oldest.fastFadeStart = performance.now();
                    oldest.frozenRadius = oldest.radius;
                }
                // 注意：不移除数组元素，让 fastFade 完成后自然移除
            }

            const maxR = this._calcMaxRadius('click');
            const dur = CONFIG.CLICK_DURATION[0] +
                Math.random() * (CONFIG.CLICK_DURATION[1] - CONFIG.CLICK_DURATION[0]);

            const ripple = createRipple('click', x, y, maxR, dur, CONFIG.CLICK_PEAK_TIME);
            this.clickRipples.push(ripple);
        }

        /**
         * 每帧更新所有涟漪状态
         * @param {number} now performance.now()
         * @param {number} time 传递给着色器的时间 (s)
         */
        update(now, time) {
            // 更新和清理自动涟漪
            this.autoRipples = this.autoRipples.filter(r => !updateRipple(r, now));

            // 更新和清理鼠标涟漪
            this.clickRipples = this.clickRipples.filter(r => !updateRipple(r, now));

            // 合并所有涟漪用于渲染
            const allRipples = this.autoRipples.concat(this.clickRipples);

            // 渲染
            this.renderer.render(time, allRipples);

            // 如果自动池空了但计时器还在运行，不用做额外处理；
            // 计时器到时会在 _scheduleAutoRipple 中重新生成
            // 特殊处理：如果自动池一直为空（如页面刚加载）且计时器未设置
            if (this.autoRipples.length < CONFIG.AUTO_COUNT_MAX && !this.autoTimerId) {
                this._scheduleAutoRipple();
            }
        }

        // ---- 动画循环 ----

        _startLoop() {
            if (this.isRunning) return;
            this.isRunning = true;
            this.lastTime = performance.now();
            this.elapsedTime = 0; // 累积时间（秒）

            // 初始化时加载背景
            this.currentBgUrl = this.getBackgroundUrl();
            this.renderer.loadBackground(this.currentBgUrl);

            const loop = (now) => {
                if (!this.isRunning) return;

                // 检查画布尺寸是否变化
                this.renderer.resize();

                // 检查背景图是否变化
                this.checkBackgroundChange();

                // 计算 delta 时间（秒），并累积
                const dt = (now - this.lastTime) / 1000;
                this.lastTime = now;
                this.elapsedTime += dt;

                // 更新涟漪（传递累积时间作为着色器的 u_time）
                this.update(now, this.elapsedTime);

                this.animFrameId = requestAnimationFrame(loop);
            };

            this.animFrameId = requestAnimationFrame(loop);
        }

        _stopLoop() {
            this.isRunning = false;
            if (this.animFrameId) {
                cancelAnimationFrame(this.animFrameId);
                this.animFrameId = null;
            }
        }

        // ---- 事件绑定 ----

        _bindEvents() {
            // 鼠标点击（监听 document 以支持全屏点击）
            document.addEventListener('click', (e) => {
                this.handleClick(e.clientX, e.clientY);
            });

            // 页面可见性变化
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.isVisible = false;
                    this._stopLoop();
                } else {
                    this.isVisible = true;
                    this._startLoop();
                }
            });

            // 窗口尺寸变化
            window.addEventListener('resize', () => {
                this.renderer.resize();
            });

            // 监测 body class 变化（背景切换）
            const observer = new MutationObserver(() => {
                this.checkBackgroundChange();
            });
            observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

            // 页面卸载清理
            window.addEventListener('beforeunload', () => {
                this.destroy();
            });
        }

        /**
         * 启动特效
         */
        start() {
            this._startLoop();
        }

        /**
         * 销毁资源
         */
        destroy() {
            this._stopLoop();
            if (this.autoTimerId) {
                clearTimeout(this.autoTimerId);
                this.autoTimerId = null;
            }
            this.renderer.destroy();
            this.autoRipples = [];
            this.clickRipples = [];
        }
    }

    // ============================================================
    // 6. 初始化入口
    // ============================================================

    function init() {
        // 检查 WebGL 支持
        const testCanvas = document.createElement('canvas');
        const testGL = testCanvas.getContext('webgl');
        if (!testGL) {
            console.error('[ripple] 当前浏览器不支持 WebGL，水面涟漪特效无法启动。');
            return;
        }
        // testGL 会在函数退出后被 GC 自动回收，无需手动释放

        // 创建主画布
        const canvas = document.createElement('canvas');
        canvas.id = 'ripple-canvas';
        // z-index: -1 使得 canvas 位于 body::before 之上（与背景同层）
        // 但低于 body 的非定位内容（文字、侧边栏等），从而不会遮挡前景内容
        canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: -1;
      pointer-events: none;
      display: block;
    `;
        document.body.insertBefore(canvas, document.body.firstChild);

        // 初始化渲染器
        const renderer = new WebGLRenderer(canvas);
        if (!renderer.isReady) {
            console.error('[ripple] WebGL 渲染器初始化失败。');
            return;
        }

        // 初始尺寸
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(canvas.clientWidth * dpr);
        canvas.height = Math.round(canvas.clientHeight * dpr);

        // 启动涟漪池
        const pool = new RipplePool(renderer, canvas);
        pool.start();

        console.log('[ripple] 水面涟漪特效已启动');
    }

    // DOM 加载完成后初始化
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();