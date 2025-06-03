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
            screenshotsEnabled: true,
            screenshotsPath: './screenshots',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            ...config
        };
        
        this.browser = null;
        this.context = null;
        this.page = null;
        this.screenshotCounter = 0;
        
        // MIR Web App Selectors
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
            keyValue: '#key-value'
        };
    }
    
    async launch(browserType = 'chromium', serverUrl = 'http://localhost:3000') {
        try {
            console.log(chalk.blue(`🚀 Launching ${browserType} browser...`));
            
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
                    '--disable-gpu'
                ]
            });
            
            // Create browser context for isolation
            this.context = await this.browser.newContext({
                userAgent: this.config.userAgent,
                viewport: { width: 1920, height: 1080 },
                permissions: ['downloads'],
                acceptDownloads: true
            });
            
            // Create page
            this.page = await this.context.newPage();
            
            // Set timeouts
            this.page.setDefaultTimeout(this.config.timeout);
            this.page.setDefaultNavigationTimeout(this.config.navigationTimeout);
            
            // Navigate to the MIR application
            console.log(chalk.blue(`📖 Navigating to ${serverUrl}...`));
            await this.page.goto(serverUrl, { waitUntil: 'networkidle' });
            
            // Wait for key elements to be ready
            await this.waitForAppReady();
            
            console.log(chalk.green('✓ Browser automation ready'));
            
            if (this.config.screenshotsEnabled) {
                await this.takeScreenshot('browser-launched');
            }
            
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
        console.log(chalk.blue('⏳ Waiting for MIR application to be ready...'));
        
        try {
            // Wait for essential elements to be present
            await this.page.waitForSelector(this.selectors.fileDropArea, { timeout: 10000 });
            await this.page.waitForSelector(this.selectors.csvDownloadBtn, { timeout: 10000 });
            await this.page.waitForSelector(this.selectors.trackList, { timeout: 10000 });
            
            // Check if scripts have loaded
            await this.page.waitForFunction(() => {
                return window.jQuery && window.Essentia;
            }, { timeout: 15000 });
            
            console.log(chalk.green('✓ MIR application is ready'));
            
        } catch (error) {
            console.error(chalk.red('MIR application failed to load properly:'), error.message);
            throw new Error('MIR application not ready');
        }
    }
    
    async uploadFiles(filePaths, batchName = 'batch') {
        try {
            console.log(chalk.blue(`📁 Uploading ${filePaths.length} files (${batchName})...`));
            
            if (!Array.isArray(filePaths) || filePaths.length === 0) {
                throw new Error('No files provided for upload');
            }
            
            // Validate files exist
            const validFiles = [];
            for (const filePath of filePaths) {
                if (await fs.pathExists(filePath)) {
                    validFiles.push(filePath);
                } else {
                    console.warn(chalk.yellow(`File not found: ${filePath}`));
                }
            }
            
            if (validFiles.length === 0) {
                throw new Error('No valid files found');
            }
            
            // Get file input element (it's hidden, so we need to access it directly)
            const fileInput = await this.page.locator('input[type="file"][multiple]').first();
            
            if (!fileInput) {
                throw new Error('File input element not found');
            }
            
            // Upload files to the hidden input
            await fileInput.setInputFiles(validFiles);
            
            console.log(chalk.green(`✓ Uploaded ${validFiles.length} files`));
            
            if (this.config.screenshotsEnabled) {
                await this.takeScreenshot(`files-uploaded-${batchName}`);
            }
            
            return {
                success: true,
                uploadedCount: validFiles.length,
                skippedCount: filePaths.length - validFiles.length
            };
            
        } catch (error) {
            console.error(chalk.red('File upload failed:'), error.message);
            throw error;
        }
    }
    
    async waitForAnalysisComplete(timeout = 300000) {
        try {
            console.log(chalk.blue('⏳ Waiting for analysis to complete...'));
            
            // Wait for loader to appear (indicates analysis started)
            await this.page.waitForSelector(this.selectors.loader + '.ui.active', { timeout: 10000 });
            console.log(chalk.gray('Analysis started...'));
            
            // Wait for loader to disappear (indicates analysis complete)
            await this.page.waitForSelector(this.selectors.loader + '.ui.disabled', { timeout });
            
            // Additional wait to ensure all tracks are processed
            await this.page.waitForFunction(() => {
                const loader = document.querySelector('#loader');
                return loader && loader.classList.contains('ui') && loader.classList.contains('disabled');
            }, { timeout: 5000 });
            
            console.log(chalk.green('✓ Analysis completed'));
            
            if (this.config.screenshotsEnabled) {
                await this.takeScreenshot('analysis-complete');
            }
            
            return true;
            
        } catch (error) {
            console.error(chalk.red('Analysis wait failed:'), error.message);
            
            if (this.config.screenshotsEnabled) {
                await this.takeScreenshot('analysis-failed');
            }
            
            throw error;
        }
    }
    
    async getAnalysedTracksCount() {
        try {
            const trackItems = await this.page.locator(this.selectors.trackListItems);
            const count = await trackItems.count();
            return count;
        } catch (error) {
            console.error(chalk.red('Failed to get analysed tracks count:'), error.message);
            return 0;
        }
    }
    
    async isCSVDownloadReady() {
        try {
            const csvBtn = await this.page.locator(this.selectors.csvDownloadBtn);
            const isDisabled = await csvBtn.getAttribute('class');
            return !isDisabled.includes('disabled');
        } catch (error) {
            console.error(chalk.red('Failed to check CSV download status:'), error.message);
            return false;
        }
    }
    
    async downloadCSV(downloadPath = './downloads') {
        try {
            console.log(chalk.blue('📥 Downloading CSV...'));
            
            // Ensure download directory exists
            await fs.ensureDir(downloadPath);
            
            // Check if CSV download is ready
            if (!(await this.isCSVDownloadReady())) {
                throw new Error('CSV download is not ready');
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
            
            console.log(chalk.green(`✓ CSV downloaded: ${fullPath}`));
            
            if (this.config.screenshotsEnabled) {
                await this.takeScreenshot('csv-downloaded');
            }
            
            return {
                success: true,
                filePath: fullPath,
                filename
            };
            
        } catch (error) {
            console.error(chalk.red('CSV download failed:'), error.message);
            throw error;
        }
    }
    
    async takeScreenshot(name = 'screenshot') {
        if (!this.config.screenshotsEnabled || !this.page) {
            return null;
        }
        
        try {
            await fs.ensureDir(this.config.screenshotsPath);
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${String(this.screenshotCounter).padStart(3, '0')}_${name}_${timestamp}.png`;
            const filePath = path.join(this.config.screenshotsPath, filename);
            
            await this.page.screenshot({ 
                path: filePath,
                fullPage: true 
            });
            
            this.screenshotCounter++;
            console.log(chalk.gray(`📸 Screenshot saved: ${filename}`));
            
            return filePath;
            
        } catch (error) {
            console.warn(chalk.yellow(`Failed to take screenshot: ${error.message}`));
            return null;
        }
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
            
            return {
                title,
                url,
                tracksCount,
                csvReady
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
            
            // Check for request failures
            this.page.on('requestfailed', (request) => {
                console.warn(chalk.yellow('Request failed:'), request.url(), request.failure().errorText);
            });
            
        } catch (error) {
            console.error(chalk.red('Error handler setup failed:'), error.message);
        }
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