import { chromium, firefox, webkit } from 'playwright';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';

class BrowserAutomation {
    constructor(config = {}) {
        this.config = {
            headless: true,
            visible: false,
            devtools: false,
            timeout: 30000,
            navigationTimeout: 30000,
            slowMo: 0,
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            // Enhanced upload automation settings
            uploadTimeout: 60000,
            analysisProgressCheckInterval: 5000,
            maxUploadRetries: 3,
            enableUploadValidation: true,
            enableMemoryMonitoring: true,
            memoryCheckInterval: 30000,
            ...config
        };
        
        this.browser = null;
        this.context = null;
        this.page = null;
        this.uploadStats = {
            totalUploads: 0,
            successfulUploads: 0,
            failedUploads: 0,
            totalFilesUploaded: 0
        };
        
        // MIR Web App Selectors - Enhanced for Task 2.2
        this.selectors = {
            fileDropArea: '#file-drop-area',
            fileInput: 'input[type="file"][multiple]',
            loader: '#loader',
            loaderText: '.ui.indeterminate.text.loader',
            csvDownloadBtn: '#csv-download-btn',
            csvExportFeedback: '#csv-export-feedback',
            trackList: '#track-list',
            trackListItems: '#track-list li',
            analysedTracksSection: '#analysis-history',
            results: '#results',
            classifiers: '.classifier',
            bpmValue: '#bpm-value',
            keyValue: '#key-value',
            // Additional selectors for enhanced monitoring
            progressBar: '.ui.progress',
            progressText: '.ui.progress .progress',
            errorMessages: '.ui.error.message',
            analyzeButton: '#analyze-btn',
            clearButton: '#clear-btn'
        };
    }
    
    async launch(browserType = 'chromium', serverUrl = 'http://localhost:3000') {
        try {
            // Only log the start, not each step
            console.log(chalk.blue(`🚀 Launching browser automation...`));
            
            const browserEngine = this.getBrowserEngine(browserType);
            
            this.browser = await browserEngine.launch({
                headless: this.config.headless,
                devtools: this.config.devtools,
                slowMo: this.config.slowMo,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    // Enhanced memory management args
                    '--memory-pressure-off',
                    '--disable-background-timer-throttling',
                    '--disable-renderer-backgrounding'
                ]
            });
            
            // Create browser context for isolation
            this.context = await this.browser.newContext({
                userAgent: this.config.userAgent,
                viewport: { width: 1920, height: 1080 },
                acceptDownloads: true,
                // Enhanced context settings for file handling
                extraHTTPHeaders: {
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });
            
            // Create page
            this.page = await this.context.newPage();
            
            // Set timeouts
            this.page.setDefaultTimeout(this.config.timeout);
            this.page.setDefaultNavigationTimeout(this.config.navigationTimeout);
            
            // Navigate to the MIR application (no logging)
            await this.page.goto(serverUrl, { waitUntil: 'networkidle' });
            
            // Wait for key elements to be ready (no logging)
            await this.waitForAppReady();
            
            console.log(chalk.green('✓ Browser automation ready'));
            
            return {
                browser: this.browser,
                context: this.context,
                page: this.page
            };
            
        } catch (error) {
            console.error(chalk.red('Failed to launch browser:'), error.message);
            await this.close();
            throw error;
        }
    }
    
    getBrowserEngine(browserType) {
        switch (browserType.toLowerCase()) {
            case 'chromium':
            case 'chrome':
                return chromium;
            case 'firefox':
                return firefox;
            case 'webkit':
            case 'safari':
                return webkit;
            default:
                console.log(chalk.yellow(`Unknown browser type: ${browserType}, defaulting to chromium`));
                return chromium;
        }
    }
    
    async waitForAppReady() {
        // Reduced logging - no need to announce this step
        
        try {
            // Wait for essential elements to be present
            await this.page.waitForSelector(this.selectors.fileDropArea, { timeout: 10000 });
            await this.page.waitForSelector(this.selectors.csvDownloadBtn, { timeout: 10000 });
            await this.page.waitForSelector(this.selectors.results, { timeout: 10000 });
            
            // Check if scripts have loaded
            await this.page.waitForFunction(() => {
                return window.jQuery && window.Essentia;
            }, { timeout: 15000 });
            
            // App is ready, but no need to log this step
            
        } catch (error) {
            console.error(chalk.red('MIR application failed to load properly:'), error.message);
            throw new Error('MIR application not ready');
        }
    }
    
    async uploadFiles(filePaths, batchName = 'batch') {
        let retryCount = 0;
        const maxRetries = this.config.maxUploadRetries;
        
        while (retryCount <= maxRetries) {
            try {
                console.log(chalk.blue(`📁 Uploading ${filePaths.length} files (${batchName})${retryCount > 0 ? ` - Retry ${retryCount}` : ''}...`));
                
                if (!Array.isArray(filePaths) || filePaths.length === 0) {
                    throw new Error('No files provided for upload');
                }
                
                // Validate files exist and are accessible
                const validFiles = await this.validateUploadFiles(filePaths);
                
                if (validFiles.length === 0) {
                    throw new Error('No valid files found for upload');
                }
                
                // Clear any previous upload state
                await this.clearUploadState();
                
                // Perform the file upload
                const uploadResult = await this.performFileUpload(validFiles, batchName);
                
                // Validate upload success
                if (this.config.enableUploadValidation) {
                    await this.validateUploadSuccess(validFiles.length);
                }
                
                // Update statistics
                this.updateUploadStats(uploadResult);
                
                console.log(chalk.green(`✓ Successfully uploaded ${uploadResult.uploadedCount} files`));
                
                if (uploadResult.skippedCount > 0) {
                    console.log(chalk.yellow(`   ⚠️ Skipped ${uploadResult.skippedCount} files`));
                }
                
                return {
                    success: true,
                    uploadedCount: uploadResult.uploadedCount,
                    skippedCount: uploadResult.skippedCount,
                    retryCount
                };
                
            } catch (error) {
                retryCount++;
                console.error(chalk.red(`Upload attempt ${retryCount} failed: ${error.message}`));
                
                if (retryCount <= maxRetries) {
                    console.log(chalk.yellow(`Retrying upload in 1 second... (${retryCount}/${maxRetries})`));
                    await this.sleep(1000);
                } else {
                    this.uploadStats.failedUploads++;
                    throw new Error(`Upload failed after ${maxRetries} retries: ${error.message}`);
                }
            }
        }
    }
    
    async validateUploadFiles(filePaths) {
        const validFiles = [];
        const supportedExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'];
        
        for (const filePath of filePaths) {
            try {
                // Check file exists
                if (!(await fs.pathExists(filePath))) {
                    console.warn(chalk.yellow(`File not found: ${filePath}`));
                    continue;
                }
                
                // Check file extension
                const ext = path.extname(filePath).toLowerCase();
                if (!supportedExtensions.includes(ext)) {
                    console.warn(chalk.yellow(`Unsupported format: ${filePath}`));
                    continue;
                }
                
                // Check file size
                const stats = await fs.stat(filePath);
                if (stats.size === 0) {
                    console.warn(chalk.yellow(`Empty file: ${filePath}`));
                    continue;
                }
                
                if (stats.size > 100 * 1024 * 1024) { // 100MB limit
                    console.warn(chalk.yellow(`File too large: ${filePath}`));
                    continue;
                }
                
                validFiles.push(filePath);
                
            } catch (error) {
                console.warn(chalk.yellow(`File validation error for ${filePath}: ${error.message}`));
            }
        }
        
        return validFiles;
    }
    
    async clearUploadState() {
        try {
            // Clear any previous file selections and analysis state
            await this.page.evaluate(() => {
                // Clear file inputs
                const fileInputs = document.querySelectorAll('input[type="file"]');
                fileInputs.forEach(input => {
                    input.value = '';
                });
                
                // Clear analysis state if accessible
                if (window.analysedTracks) {
                    window.analysedTracks.length = 0;
                }
                
                // Clear any error messages
                const errorMessages = document.querySelectorAll('.ui.error.message');
                errorMessages.forEach(msg => msg.style.display = 'none');
                
                // Clear track list if present
                const trackList = document.querySelector('#track-list');
                if (trackList) {
                    trackList.innerHTML = '';
                }
                
                // Reset any progress indicators
                const progressBars = document.querySelectorAll('.ui.progress');
                progressBars.forEach(bar => {
                    bar.classList.remove('success', 'error', 'active');
                });
                
                // Clear any active loaders
                const loaders = document.querySelectorAll('.ui.loader');
                loaders.forEach(loader => {
                    loader.classList.remove('active');
                });
            });
            
            // Wait a moment for DOM to update
            await this.sleep(1000);
            
        } catch (error) {
            console.warn(chalk.yellow(`Clear upload state warning: ${error.message}`));
        }
    }
    
    async performFileUpload(validFiles, batchName) {
        try {
            // Wait for the drop area to be completely ready
            await this.page.waitForSelector('#file-drop-area', { state: 'visible' });
            await this.sleep(1000); // Give the page time to fully load
            
            // Set up file chooser handling and click simultaneously
            const [fileChooser] = await Promise.all([
                this.page.waitForEvent('filechooser', { timeout: 30000 }),
                this.page.click('#file-drop-area')
            ]);
            
            // Upload files using the file chooser
            await fileChooser.setFiles(validFiles);
            
            // Give the upload process time to start properly
            await this.sleep(1000);
            
            // Wait for upload to be processed (look for file count or analysis to start)
            await this.page.waitForFunction((expectedCount) => {
                const trackItems = document.querySelectorAll('#track-list li');
                const dropArea = document.querySelector('#file-drop-area');
                
                // Check if files are being processed (track list has items or drop area shows file count)
                return trackItems.length > 0 || 
                       (dropArea && dropArea.textContent.includes('file')) ||
                       document.querySelector('#loader.active');
            }, validFiles.length, { timeout: 60000 });
            
            return {
                uploadedCount: validFiles.length,
                skippedCount: 0
            };
            
        } catch (error) {
            throw new Error(`File upload failed: ${error.message}`);
        }
    }
    
    async validateUploadSuccess(expectedCount) {
        try {
            // Wait for upload confirmation or file list to update
            await this.page.waitForFunction((expected) => {
                // Check if files appear in track list or file count updates
                const trackItems = document.querySelectorAll('#track-list li');
                return trackItems.length >= expected || 
                       document.querySelector('#file-drop-area')?.textContent.includes('files selected');
            }, expectedCount, { timeout: this.config.uploadTimeout });
            
        } catch (error) {
            console.warn(chalk.yellow(`Upload validation warning: ${error.message}`));
        }
    }
    
    async waitForAnalysisComplete(timeout = 300000) {
        try {
            console.log(chalk.blue('⏳ Monitoring analysis progress...'));
            
            // Wait for analysis to start
            const analysisStarted = await this.waitForAnalysisStart();
            if (!analysisStarted) {
                throw new Error('Analysis did not start within expected time');
            }
            
            // Monitor analysis progress with enhanced detection
            const completed = await this.monitorAnalysisProgress(timeout);
            if (!completed) {
                throw new Error('Analysis did not complete within timeout');
            }
            
            console.log(chalk.green('✓ Analysis completed successfully'));
            
            return true;
            
        } catch (error) {
            console.error(chalk.red('Analysis monitoring failed:'), error.message);
            
            throw error;
        }
    }
    
    async waitForAnalysisStart(timeout = 10000) {
        try {
            // Wait for loader to appear or analysis to begin
            await this.page.waitForFunction(() => {
                const loader = document.querySelector('#loader');
                return loader && (
                    loader.classList.contains('active') ||
                    loader.style.display !== 'none'
                );
            }, { timeout });
            
            return true;
            
        } catch (error) {
            // Analysis might start immediately, check if tracks are already being processed
            const trackCount = await this.getAnalysedTracksCount();
            return trackCount > 0;
        }
    }
    
    async monitorAnalysisProgress(timeout) {
        const startTime = Date.now();
        const checkInterval = this.config.analysisProgressCheckInterval;
        let lastTrackCount = 0;
        let stuckCounter = 0;
        const maxStuckIterations = 10; // 50 seconds of no progress
        
        while (Date.now() - startTime < timeout) {
            try {
                // Check if analysis is complete
                const isComplete = await this.page.evaluate(() => {
                    const loader = document.querySelector('#loader');
                    return loader && (
                        loader.classList.contains('disabled') ||
                        loader.style.display === 'none' ||
                        !loader.classList.contains('active')
                    );
                });
                
                if (isComplete) {
                    // Double-check by waiting a moment and checking again
                    await this.sleep(2000);
                    const stillComplete = await this.page.evaluate(() => {
                        const loader = document.querySelector('#loader');
                        return loader && (
                            loader.classList.contains('disabled') ||
                            loader.style.display === 'none' ||
                            !loader.classList.contains('active')
                        );
                    });
                    
                    if (stillComplete) {
                        return true;
                    }
                }
                
                // Monitor progress by track count
                const currentTrackCount = await this.getAnalysedTracksCount();
                
                if (currentTrackCount > lastTrackCount) {
                    lastTrackCount = currentTrackCount;
                    stuckCounter = 0;
                    // Progress logged only at major milestones
                } else {
                    stuckCounter++;
                    
                    if (stuckCounter >= maxStuckIterations) {
                        console.warn(chalk.yellow(`   ⚠️ Analysis appears stuck at ${currentTrackCount} tracks`));
                        break;
                    }
                }
                
                // Check for error states
                const hasErrors = await this.page.evaluate(() => {
                    const errorMessages = document.querySelectorAll('.ui.error.message:not([style*="display: none"])');
                    return errorMessages.length > 0;
                });
                
                if (hasErrors) {
                    throw new Error('Analysis error detected in UI');
                }
                
                await this.sleep(checkInterval);
                
            } catch (error) {
                console.error(chalk.red(`Analysis monitoring error: ${error.message}`));
                break;
            }
        }
        
        // Final check for completion
        const finalTrackCount = await this.getAnalysedTracksCount();
        return finalTrackCount > 0 && stuckCounter < maxStuckIterations;
    }
    
    async getAnalysedTracksCount() {
        try {
            const trackItems = await this.page.locator(this.selectors.trackListItems);
            const count = await trackItems.count();
            return count;
        } catch (error) {
            console.warn(chalk.yellow(`Failed to get track count: ${error.message}`));
            return 0;
        }
    }
    
    async isCSVDownloadReady() {
        try {
            const csvBtn = await this.page.locator(this.selectors.csvDownloadBtn);
            const isVisible = await csvBtn.isVisible();
            const isEnabled = await csvBtn.isEnabled();
            const classes = await csvBtn.getAttribute('class') || '';
            
            return isVisible && isEnabled && !classes.includes('disabled');
        } catch (error) {
            console.warn(chalk.yellow(`Failed to check CSV download status: ${error.message}`));
            return false;
        }
    }
    
    async downloadCSV(downloadPath = './downloads') {
        try {
            console.log(chalk.blue('📥 Downloading CSV results...'));
            
            // Ensure download directory exists
            await fs.ensureDir(downloadPath);
            
            // Verify CSV download is ready
            if (!(await this.isCSVDownloadReady())) {
                throw new Error('CSV download button is not ready or enabled');
            }
            
            // Set up download promise before clicking
            const downloadPromise = this.page.waitForEvent('download');
            
            // Click the CSV download button
            await this.page.locator(this.selectors.csvDownloadBtn).click();
            
            // Wait for download to start
            const download = await downloadPromise;
            
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `music_analysis_${timestamp}.csv`;
            const fullPath = path.join(downloadPath, filename);
            
            // Save the download
            await download.saveAs(fullPath);
            
            // Verify download completed successfully
            const downloadExists = await fs.pathExists(fullPath);
            if (!downloadExists) {
                throw new Error('Downloaded file not found after save');
            }
            
            const stats = await fs.stat(fullPath);
            if (stats.size === 0) {
                throw new Error('Downloaded CSV file is empty');
            }
            
            console.log(chalk.green(`✓ CSV downloaded: ${filename} (${Math.round(stats.size / 1024)}KB)`));
            
            return {
                success: true,
                filePath: fullPath,
                filename,
                size: stats.size
            };
            
        } catch (error) {
            console.error(chalk.red('CSV download failed:'), error.message);
            throw error;
        }
    }
    
    async getMemoryUsage() {
        try {
            const memoryInfo = await this.page.evaluate(() => {
                if (performance.memory) {
                    return {
                        usedJSHeapSize: performance.memory.usedJSHeapSize,
                        totalJSHeapSize: performance.memory.totalJSHeapSize,
                        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                    };
                }
                return null;
            });
            
            return memoryInfo;
        } catch (error) {
            return null;
        }
    }
    
    async performMemoryCleanup() {
        try {
            console.log(chalk.blue('🧹 Performing browser memory cleanup...'));
            
            // Clear browser cache and storage
            await this.page.evaluate(() => {
                // Clear any large objects or caches if accessible
                if (window.gc && typeof window.gc === 'function') {
                    window.gc();
                }
                
                // Clear any audio buffers or analysis data
                if (window.analysedTracks) {
                    window.analysedTracks.length = 0;
                }
                
                // Clear any cached audio data
                if (window.audioContext) {
                    window.audioContext.close?.();
                }
            });
            
            console.log(chalk.green('✓ Memory cleanup completed'));
            
        } catch (error) {
            console.warn(chalk.yellow(`Memory cleanup warning: ${error.message}`));
        }
    }
    
    updateUploadStats(uploadResult) {
        this.uploadStats.totalUploads++;
        this.uploadStats.successfulUploads++;
        this.uploadStats.totalFilesUploaded += uploadResult.uploadedCount;
    }
    
    getUploadStats() {
        return { ...this.uploadStats };
    }
    

    
    async waitForElement(selector, options = {}) {
        const defaultOptions = {
            timeout: this.config.timeout,
            state: 'visible'
        };
        
        return await this.page.waitForSelector(selector, { ...defaultOptions, ...options });
    }
    
    async waitForText(text, options = {}) {
        const defaultOptions = {
            timeout: this.config.timeout
        };
        
        return await this.page.waitForFunction(
            (searchText) => document.body.textContent.includes(searchText),
            text,
            { ...defaultOptions, ...options }
        );
    }
    
    async getPageInfo() {
        try {
            const title = await this.page.title();
            const url = this.page.url();
            const tracksCount = await this.getAnalysedTracksCount();
            const csvReady = await this.isCSVDownloadReady();
            const memoryUsage = await this.getMemoryUsage();
            
            return {
                title,
                url,
                tracksCount,
                csvReady,
                memoryUsage,
                uploadStats: this.getUploadStats()
            };
        } catch (error) {
            console.error(chalk.red('Failed to get page info:'), error.message);
            return null;
        }
    }
    
    async handleErrors() {
        try {
            // Check for JavaScript errors
            this.page.on('pageerror', (error) => {
                console.error(chalk.red('Page error:'), error.message);
            });
            
            // Check for console errors
            this.page.on('console', (msg) => {
                if (msg.type() === 'error') {
                    console.error(chalk.red('Console error:'), msg.text());
                }
            });
            
            // Check for request failures - but filter out blob ERR_ABORTED which are just cleanup
            this.page.on('requestfailed', (request) => {
                const url = request.url();
                const errorText = request.failure()?.errorText;
                
                // Skip blob URL ERR_ABORTED errors - these are just cleanup noise
                if (url.startsWith('blob:') && errorText === 'net::ERR_ABORTED') {
                    return;
                }
                
                console.warn(chalk.yellow('Request failed:'), url, errorText);
            });
            
            // Monitor for response errors
            this.page.on('response', (response) => {
                if (response.status() >= 400) {
                    // Skip 404 for favicon and other non-critical requests
                    const url = response.url();
                    if (url.includes('favicon.ico')) {
                        return;
                    }
                    console.warn(chalk.yellow('HTTP error:'), response.status(), url);
                }
            });
            
        } catch (error) {
            console.error(chalk.red('Error handler setup failed:'), error.message);
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async close() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            
            if (this.context) {
                await this.context.close();
                this.context = null;
            }
            
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
            
            console.log(chalk.yellow('Browser automation closed'));
            
        } catch (error) {
            console.error(chalk.red('Error closing browser:'), error.message);
        }
    }
}

export default BrowserAutomation; 