// ============================================
// UPLOAD MANAGEMENT & WORKFLOW FUNCTIONS
// ============================================
// ============================================
// BANTU UPLOAD ENGINE - Unified Upload & Processing
// FIXED: Uses native Supabase SDK for function invocation
// ============================================
const BANTU_UPLOAD_ENGINE = {
    supabase: window.supabaseClient,

    /**
     * LANE 1: Local Audio Transcoding Engine
     * Converts any raw audio file into a web-optimized 320kbps MP3 locally in the browser
     */
    async compressAudio(file, onProgress) {
        console.log(`Starting local optimization for: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        if (onProgress) onProgress({ status: 'decoding', percent: 10 });

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        if (onProgress) onProgress({ status: 'encoding', percent: 40 });

        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;
        
        const sampleRate = audioBuffer.sampleRate;
        const mp3Encoder = new lamejs.Mp3Encoder(2, sampleRate, 320);
        const mp3Chunks = [];
        
        const convertFloatToInt16 = (buffer) => {
            let l = buffer.length;
            const buf = new Int16Array(l);
            while (l--) {
                let s = Math.max(-1, Math.min(1, buffer[l]));
                buf[l] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            return buf;
        };
        
        const leftInt16 = convertFloatToInt16(leftChannel);
        const rightInt16 = convertFloatToInt16(rightChannel);
        
        const sampleBlockSize = 1152;
        for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
            const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
            const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
            
            const mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
            if (mp3buf.length > 0) {
                mp3Chunks.push(new Uint8Array(mp3buf));
            }
        }
        
        const endBuf = mp3Encoder.flush();
        if (endBuf.length > 0) {
            mp3Chunks.push(new Uint8Array(endBuf));
        }
        
        if (onProgress) onProgress({ status: 'done', percent: 100 });
        audioCtx.close();

        const optimizedBlob = new Blob(mp3Chunks, { type: 'audio/mpeg' });
        console.log(`Optimization complete! New size: ${(optimizedBlob.size / 1024 / 1024).toFixed(2)} MB`);
        return optimizedBlob;
    },

    /**
     * LANE 2: Fetch Secure Handshake Upload URL from Supabase Edge Function
     * FIXED: Uses native Supabase SDK invocation to route directly to Supabase Cloud
     */
    async getSecureUploadHandshake(mediaType, fileName) {
        console.log(`Requesting secure upload handshake for ${mediaType}...`);
        
        try {
            // Call the function natively via the Supabase Client SDK
            const { data, error } = await this.supabase.functions.invoke('get-upload-url', {
                body: { mediaType, fileName }
            });

            // If Supabase returns an edge function execution error
            if (error) {
                console.error("Supabase Edge Function Invocation Error:", error);
                throw new Error(error.message || "Failed to secure upload authorization channel.");
            }

            // The SDK automatically parses the JSON response for you!
            console.log('Handshake successful:', data);
            return data;
            // Returns: { uploadUrl, fileUrl, providerVideoId, streamingProvider }
        } catch (error) {
            console.error('Handshake failed:', error);
            throw new Error(`Upload handshake failed: ${error.message}`);
        }
    },

    /**
     * LANE 3: Execute Direct High-Performance Streaming Upload via XHR
     */
    uploadFileViaXHR(file, uploadUrl, isVideoChannel, onProgressCallback) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const startTime = Date.now();

            if (isVideoChannel) {
                xhr.open('POST', uploadUrl);
            } else {
                xhr.open('PUT', uploadUrl);
            }

            let uploadPayload = file;
            if (isVideoChannel) {
                const formData = new FormData();
                formData.append('file', file);
                uploadPayload = formData;
            }

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    const timeElapsed = (Date.now() - startTime) / 1000;
                    const speedBytesPerSec = e.loaded / timeElapsed;
                    
                    const speedMbps = ((speedBytesPerSec * 8) / (1024 * 1024)).toFixed(1);
                    const bytesRemaining = e.total - e.loaded;
                    const etaSeconds = Math.round(bytesRemaining / speedBytesPerSec);

                    onProgressCallback({
                        percent,
                        speed: `${speedMbps} Mbps`,
                        eta: etaSeconds > 60 ? `${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s` : `${etaSeconds}s`
                    });
                }
            });

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(true);
                } else {
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        reject(new Error(errorData.error || `Upload failed with status: ${xhr.status}`));
                    } catch {
                        reject(new Error(`Upload failed with status: ${xhr.status}`));
                    }
                }
            };

            xhr.onerror = () => reject(new Error("Network connection dropped during transmission."));
            xhr.send(uploadPayload);
        });
    },

    /**
     * CORE EXECUTION CONTROLLER: Orchestrates the entire pipeline
     */
    async processCreatorPublish(formData, rawMediaFile, rawCustomThumbnailFile, uiCallbacks) {
        try {
            uiCallbacks.updateStatus("Initializing secure pipelines...");
            let finalMediaUrl = null;
            let finalProviderVideoId = null;
            let finalStreamingProvider = null;
            let finalThumbnailUrl = null;

            const mediaType = rawMediaFile.type.startsWith('video/') ? 'video' : 'audio';

            // STEP 1: HANDLE THUMBNAILS FIRST
            if (rawCustomThumbnailFile) {
                uiCallbacks.updateStatus("Securing custom thumbnail channel...");
                const thumbHandshake = await this.getSecureUploadHandshake('image', rawCustomThumbnailFile.name);
                
                uiCallbacks.updateStatus("Uploading custom thumbnail...");
                await this.uploadFileViaXHR(rawCustomThumbnailFile, thumbHandshake.uploadUrl, false, () => {});
                finalThumbnailUrl = thumbHandshake.fileUrl;
            }

            // STEP 2: PROCESS AND ROUTE MEDIA CHANNELS
            if (mediaType === 'audio') {
                uiCallbacks.updateStatus("Optimizing audio track locally...");
                const optimizedAudioBlob = await this.compressAudio(rawMediaFile, (p) => {
                    uiCallbacks.updateStatus(`Optimizing Audio Format... ${p.percent}%`);
                });

                uiCallbacks.updateStatus("Securing audio storage lane...");
                const audioHandshake = await this.getSecureUploadHandshake('audio', 'track.mp3');

                uiCallbacks.updateStatus("Uploading optimized audio track...");
                await this.uploadFileViaXHR(optimizedAudioBlob, audioHandshake.uploadUrl, false, uiCallbacks.onProgress);
                
                finalMediaUrl = audioHandshake.fileUrl;
                finalStreamingProvider = 'cloudflare_r2';
            } 
            else {
                uiCallbacks.updateStatus("Securing Cloudflare stream lane...");
                const videoHandshake = await this.getSecureUploadHandshake('video', rawMediaFile.name);

                uiCallbacks.updateStatus("Uploading video file...");
                await this.uploadFileViaXHR(rawMediaFile, videoHandshake.uploadUrl, true, uiCallbacks.onProgress);
                
                finalProviderVideoId = videoHandshake.providerVideoId;
                finalStreamingProvider = 'cloudflare_stream';

                if (!finalThumbnailUrl) {
                    finalThumbnailUrl = `https://videodelivery.net/${finalProviderVideoId}/thumbnails/thumbnail.jpg?time=5s&height=600`;
                }
            }

            // STEP 3: CREATE THE UNIFIED SUPABASE CONTENT ROW
            uiCallbacks.updateStatus("Publishing content metadata...");
            
            const { data: { user } } = await this.supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");
            
            const contentPayload = {
                title: formData.title,
                description: formData.description,
                genre: formData.genre,
                content_format: formData.contentFormat || null,
                media_type: mediaType,
                streaming_provider: finalStreamingProvider,
                provider_video_id: finalProviderVideoId,
                file_url: finalMediaUrl,
                thumbnail_url: finalThumbnailUrl,
                content_metadata: formData.genreSpecificMetadata || {},
                user_id: user.id,
                creator_id: user.id,
                status: 'published'
            };

            if (formData.duration) {
                contentPayload.duration = formData.duration;
            }

            if (formData.chapters && formData.chapters.length > 0) {
                contentPayload.chapters = formData.chapters;
            }

            console.log('Creating content record with payload:', contentPayload);

            const { data: newContent, error: dbError } = await this.supabase
                .from('Content')
                .insert([contentPayload])
                .select()
                .single();

            if (dbError) {
                console.error('Database error:', dbError);
                throw new Error(`Database error: ${dbError.message}`);
            }

            uiCallbacks.onSuccess(newContent);

        } catch (error) {
            console.error("Critical Upload Error:", error);
            uiCallbacks.onError(error.message || "An unexpected processing break occurred.");
        }
    }
};

async function uploadContent(isDraft = false) {
    if (!currentUserId) {
        showToast('Please sign in to upload content');
        authModal.classList.add('active');
        return;
    }

    const title = document.getElementById('content-title').value.trim();
    const desc = document.getElementById('content-description').value.trim();
    const genre = document.getElementById('content-genre').value;
    const contentFormat = document.getElementById('content_format').value;

    if (!title || !desc) {
        showToast('Please fill in title and description');
        return;
    }

    if (!selectedMediaFile && selectedMediaType !== 'news') {
        showToast('Please select a media file');
        return;
    }

    if (!genre) {
        showToast('Please select a genre');
        return;
    }

    // News validation
    if (selectedMediaType === 'news') {
        const source = document.getElementById('news-source')?.value?.trim();
        const category = document.getElementById('news-category')?.value;
        const articleBody = document.getElementById('article-body')?.value?.trim();
        
        if (!source || !category || !articleBody) {
            showToast('Please fill all news article fields');
            return;
        }
    }

    // Shorts validation
    if (selectedMediaType === 'short' && (extractedDuration === null || extractedDuration > 60)) {
        showToast('Shorts must be under 60 seconds');
        return;
    }

    // Genre metadata validation
    if (!validateGenreMetadata()) {
        return;
    }

    isUploading = true;
    updateButtonsState();

    // Show processing state
    uploadFormState.style.display = 'none';
    processingState.classList.add('active');
    processingMessage.innerHTML = '🎬 Preparing your content...<br>This may take a moment';

    try {
        const formData = {
            title: title,
            description: desc,
            genre: genre,
            contentFormat: contentFormat || null,
            genreSpecificMetadata: collectContentMetadata() || {},
            duration: extractedDuration,
            chapters: chapters.length > 0 ? chapters : null
        };

        // For news articles, we don't upload media
        if (selectedMediaType === 'news') {
            const newsMetadata = {
                source_name: document.getElementById('news-source')?.value?.trim() || null,
                category: document.getElementById('news-category')?.value || null,
                read_time: parseInt(document.getElementById('read-time')?.value) || null,
                is_breaking: document.getElementById('is-breaking')?.checked || false,
                article_body: document.getElementById('article-body')?.value?.trim() || ''
            };

            const { data: { user } } = await window.supabaseClient.auth.getUser();
            
            const contentPayload = {
                title: title,
                description: desc,
                genre: 'News',
                content_format: 'long_form',
                media_type: 'article',
                streaming_provider: null,
                provider_video_id: null,
                file_url: null,
                thumbnail_url: selectedThumbnailFile ? await uploadThumbnailOnly(selectedThumbnailFile) : null,
                content_metadata: newsMetadata,
                user_id: user.id,
                creator_id: user.id,
                status: 'published'
            };

            const { data: newContent, error: dbError } = await window.supabaseClient
                .from('Content')
                .insert([contentPayload])
                .select()
                .single();

            if (dbError) throw new Error(dbError.message);

            processingState.classList.remove('active');
            successState.classList.add('active');
            triggerConfetti();
            localStorage.removeItem(`draft_${currentUserId}`);
            return;
        }

        // Set up UI callbacks for the upload engine
        const uiCallbacks = {
            updateStatus: (message) => {
                processingMessage.textContent = message;
            },
            onProgress: (progress) => {
                const fill = document.getElementById('progress-fill');
                const percentage = document.getElementById('progress-percentage');
                const speed = document.getElementById('progress-speed');
                const eta = document.getElementById('progress-eta');
                
                if (fill) fill.style.width = `${progress.percent}%`;
                if (percentage) percentage.textContent = `${progress.percent}%`;
                if (speed && progress.speed) speed.textContent = `Speed: ${progress.speed}`;
                if (eta && progress.eta) eta.textContent = `ETA: ${progress.eta}`;
                
                document.getElementById('upload-progress').classList.add('active');
            },
            onSuccess: (contentRecord) => {
                processingState.classList.remove('active');
                successState.classList.add('active');
                triggerConfetti();
                window._lastContentId = contentRecord.id;
                localStorage.removeItem(`draft_${currentUserId}`);
                document.getElementById('upload-progress').classList.remove('active');
            },
            onError: (errorMessage) => {
                processingState.classList.remove('active');
                uploadFormState.style.display = 'block';
                showToast(`Upload failed: ${errorMessage}`, 'error');
                document.getElementById('upload-progress').classList.remove('active');
                isUploading = false;
                updateButtonsState();
            }
        };

        // Execute the upload engine
        await BANTU_UPLOAD_ENGINE.processCreatorPublish(
            formData,
            selectedMediaFile,
            selectedThumbnailFile,
            uiCallbacks
        );

    } catch (error) {
        console.error('Upload error:', error);
        processingState.classList.remove('active');
        uploadFormState.style.display = 'block';
        showToast(`Upload failed: ${error.message}`, 'error');
        document.getElementById('upload-progress').classList.remove('active');
        isUploading = false;
        updateButtonsState();
    } finally {
        isUploading = false;
        updateButtonsState();
    }
}
