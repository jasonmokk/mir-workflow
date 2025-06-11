import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';

class UploadWorkflow {
    constructor(server, browserAutomation, fileManager, config = {}) {
        this.server = server;
        this.browser = browserAutomation;
        this.fileManager = fileManager;
        this.config = {
            interBatchDelay: 30000,
            processingTimeout: 300000,
            memoryThreshold: 1024 * 1024 * 1024, // 1GB
            maxRetries: 3,
            retryDelay: 5000,
            enableMemoryMonitoring: true,
            enableProgressReporting: true,
            ...config
        };
        
        this.spinner = null;
        this.workflowStats = {
            totalBatches: 0,
            processedBatches: 0,
            failedBatches: 0,
            totalFiles: 0,
            processedFiles: 0,
            failedFiles: 0,
            startTime: null,
            endTime: null,
            csvDownloads: []
        };
    }
    
    async executeFullWorkflow(directoryPath, options = {}) {
        try {
            console.log(chalk.blue.bold('🎵 Starting MIR Upload Workflow'));
            console.log(chalk.blue.bold('═'.repeat(40)));
            
            this.workflowStats.startTime = new Date();
            
            // Step 1: Ensure server is running
            await this.ensureServerRunning();
            
            // Step 2: Initialize browser automation
            await this.initializeBrowserAutomation();
            
            // Step 3: Discover and batch files
            await this.prepareFilesForProcessing(directoryPath, options);
            
            // Step 4: Execute batch processing workflow
            await this.executeBatchProcessing(options);
            
            // Step 5: Generate final report
            this.generateWorkflowReport();
            
            this.workflowStats.endTime = new Date();
            console.log(chalk.green.bold('\n🎉 Upload workflow completed successfully!'));
            
            return {
                success: true,
                stats: this.workflowStats
            };
            
        } catch (error) {
            if (this.spinner) {
                this.spinner.fail('Upload workflow failed');
            }
            console.error(chalk.red.bold('\n❌ Upload workflow failed:'), error.message);
            throw error;
        }
    }
    
    async ensureServerRunning() {
        this.spinner = ora('Ensuring MIR server is running...').start();
        
        try {
            // Check if server is already running
            const serverUrl = this.server.getUrl();
            if (!serverUrl) {
                // Start server if not running
                const serverInfo = await this.server.start();
                this.spinner.succeed(`Server started at ${serverInfo.url}`);
            } else {
                this.spinner.succeed(`Server already running at ${serverUrl}`);
            }
        } catch (error) {
            this.spinner.fail('Failed to start server');
            throw error;
        }
    }
    
    async initializeBrowserAutomation() {
        this.spinner = ora('Initializing browser automation...').start();
        
        try {
            const serverUrl = this.server.getUrl();
            await this.browser.launch('chromium', serverUrl);
            
            // Set up error handling
            await this.browser.handleErrors();
            
            this.spinner.succeed('Browser automation initialized');
        } catch (error) {
            this.spinner.fail('Failed to initialize browser automation');
            throw error;
        }
    }
    
    async prepareFilesForProcessing(directoryPath, options) {
        this.spinner = ora('Discovering and preparing files...').start();
        
        try {
            // Discover files
            const discovery = await this.fileManager.discoverFiles(directoryPath);
            
            if (discovery.totalFiles === 0) {
                this.spinner.warn('No audio files found');
                return;
            }
            
            // Create batches
            const batchInfo = this.fileManager.createBatches(
                null, 
                options.batchSize || this.config.batchSize
            );
            
            this.workflowStats.totalBatches = batchInfo.totalBatches;
            this.workflowStats.totalFiles = batchInfo.totalFiles;
            
            this.spinner.succeed(`Prepared ${batchInfo.totalBatches} batches (${batchInfo.totalFiles} files)`);
            
            // Display preparation summary
            this.displayPreparationSummary(discovery, batchInfo);
            
        } catch (error) {
            this.spinner.fail('File preparation failed');
            throw error;
        }
    }
    
    async executeBatchProcessing(options = {}) {
        console.log(chalk.blue.bold('\n📦 Executing Batch Upload Processing'));
        console.log(chalk.blue('─'.repeat(35)));
        
        let batch;
        let consecutiveFailures = 0;
        const maxConsecutiveFailures = 3;
        
        while ((batch = this.fileManager.getNextBatch())) {
            try {
                console.log(chalk.blue(`\n🔄 Processing Batch ${batch.id}/${this.workflowStats.totalBatches}`));
                
                // Execute single batch workflow
                const batchResult = await this.processSingleBatch(batch, options);
                
                if (batchResult.success) {
                    this.workflowStats.processedBatches++;
                    this.workflowStats.processedFiles += batchResult.processedFiles;
                    consecutiveFailures = 0;
                    
                    // Add CSV download info
                    if (batchResult.csvDownload) {
                        this.workflowStats.csvDownloads.push(batchResult.csvDownload);
                    }
                    
                    // Update progress display immediately after batch completion
                    this.displayBatchProgress();
                } else {
                    this.workflowStats.failedBatches++;
                    this.workflowStats.failedFiles += batch.files.length;
                    consecutiveFailures++;
                    
                    // Update progress display even on failure
                    this.displayBatchProgress();
                }
                
                // Check for too many consecutive failures
                if (consecutiveFailures >= maxConsecutiveFailures) {
                    console.error(chalk.red(`⚠️ Too many consecutive failures (${consecutiveFailures}), stopping workflow`));
                    break;
                }
                
                // Inter-batch cleanup and delay
                await this.performInterBatchMaintenance();
                
            } catch (error) {
                console.error(chalk.red(`Batch ${batch.id} processing error: ${error.message}`));
                consecutiveFailures++;
                
                if (consecutiveFailures >= maxConsecutiveFailures && options.strict) {
                    throw error;
                }
            }
        }
    }
    
    async processSingleBatch(batch, options = {}) {
        const batchResult = {
            batchId: batch.id,
            success: false,
            processedFiles: 0,
            uploadTime: 0,
            analysisTime: 0,
            downloadTime: 0,
            csvDownload: null,
            error: null
        };
        
        try {
            console.log(chalk.gray(`   Files: ${batch.files.length}, Attempt: ${batch.attempts + 1}/${batch.maxAttempts}`));
            
            // Mark batch as started
            this.fileManager.markBatchStarted(batch.id);
            
            // Step 1: Upload files
            const uploadStartTime = Date.now();
            const uploadResult = await this.uploadBatchFiles(batch);
            batchResult.uploadTime = Date.now() - uploadStartTime;
            
            if (!uploadResult.success) {
                throw new Error(`Upload failed: ${uploadResult.error}`);
            }
            
            // Step 2: Monitor analysis processing
            const analysisStartTime = Date.now();
            const analysisResult = await this.monitorBatchAnalysis(batch);
            batchResult.analysisTime = Date.now() - analysisStartTime;
            
            if (!analysisResult.success) {
                throw new Error(`Analysis failed: ${analysisResult.error}`);
            }
            
            batchResult.processedFiles = analysisResult.processedCount;
            
            // Step 3: Download CSV results
            const downloadStartTime = Date.now();
            const csvResult = await this.downloadBatchCSV(batch);
            batchResult.downloadTime = Date.now() - downloadStartTime;
            
            if (csvResult.success) {
                batchResult.csvDownload = csvResult;
            }
            
            // Mark batch as completed
            this.fileManager.markBatchCompleted(batch.id, batch.files);
            
            batchResult.success = true;
            console.log(chalk.green(`   ✓ Batch ${batch.id} completed successfully`));
            
            return batchResult;
            
        } catch (error) {
            batchResult.error = error.message;
            this.fileManager.markBatchFailed(batch.id, error, batch.files);
            
            console.error(chalk.red(`   ✗ Batch ${batch.id} failed: ${error.message}`));
            return batchResult;
        }
    }
    
    async uploadBatchFiles(batch) {
        try {
            this.spinner = ora(`Uploading ${batch.files.length} files...`).start();
            
            // Clear any previous uploads from browser state
            await this.clearBrowserUploadState();
            
            // Perform the file upload
            const uploadResult = await this.browser.uploadFiles(
                batch.files, 
                `batch-${batch.id}`
            );
            
            // Verify upload success
            if (uploadResult.success && uploadResult.uploadedCount > 0) {
                this.spinner.succeed(`Uploaded ${uploadResult.uploadedCount} files`);
                
                if (uploadResult.skippedCount > 0) {
                    console.log(chalk.yellow(`   ⚠️ Skipped ${uploadResult.skippedCount} invalid files`));
                }
                
                return {
                    success: true,
                    uploadedCount: uploadResult.uploadedCount,
                    skippedCount: uploadResult.skippedCount
                };
            } else {
                throw new Error('No files were uploaded successfully');
            }
            
        } catch (error) {
            this.spinner.fail(`Upload failed: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async monitorBatchAnalysis(batch) {
        try {
            this.spinner = ora('Monitoring analysis progress...').start();
            
            // Wait for analysis to complete with enhanced monitoring
            const analysisResult = await this.browser.waitForAnalysisComplete(
                this.config.processingTimeout
            );
            
            if (analysisResult) {
                // Get final track count
                const tracksCount = await this.browser.getAnalysedTracksCount();
                
                this.spinner.succeed(`Analysis completed - ${tracksCount} tracks processed`);
                
                return {
                    success: true,
                    processedCount: tracksCount
                };
            } else {
                throw new Error('Analysis did not complete within timeout');
            }
            
        } catch (error) {
            this.spinner.fail(`Analysis monitoring failed: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async downloadBatchCSV(batch) {
        try {
            // Check if CSV download is ready
            const csvReady = await this.browser.isCSVDownloadReady();
            if (!csvReady) {
                console.log(chalk.yellow(`   ⚠️ CSV download not ready for batch ${batch.id}, skipping`));
                return { success: false, error: 'CSV not ready' };
            }
            
            this.spinner = ora('Downloading CSV results...').start();
            
            // Create batch-specific download directory
            const batchDownloadDir = path.join(
                this.config.csvExport?.outputDirectory || './csv_exports',
                'batch_csvs'
            );
            await fs.ensureDir(batchDownloadDir);
            
            // Download CSV with batch-specific naming
            const csvResult = await this.browser.downloadCSV(batchDownloadDir);
            
            if (csvResult.success) {
                // Rename file to include batch information
                const batchFilename = `batch_${String(batch.id).padStart(3, '0')}_${csvResult.filename}`;
                const batchFilePath = path.join(batchDownloadDir, batchFilename);
                
                await fs.move(csvResult.filePath, batchFilePath);
                
                // Verify CSV integrity
                const isValid = await this.verifyCsvIntegrity(batchFilePath, batch.files.length);
                
                this.spinner.succeed(`CSV downloaded: ${batchFilename}`);
                
                return {
                    success: true,
                    filename: batchFilename,
                    filePath: batchFilePath,
                    originalPath: csvResult.filePath,
                    isValid,
                    batchId: batch.id
                };
            } else {
                throw new Error('CSV download failed');
            }
            
        } catch (error) {
            this.spinner.fail(`CSV download failed: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async verifyCsvIntegrity(csvPath, expectedRows) {
        try {
            const csvContent = await fs.readFile(csvPath, 'utf8');
            const lines = csvContent.split('\n').filter(line => line.trim());
            
            // Check if we have header + data rows (at least header + 1 row)
            if (lines.length < 2) {
                console.warn(chalk.yellow(`   ⚠️ CSV appears empty or invalid: ${lines.length} lines`));
                return false;
            }
            
            // Check if row count is reasonable (header + data rows)
            const dataRows = lines.length - 1;
            const expectedRange = [Math.floor(expectedRows * 0.8), expectedRows * 1.2]; // 80-120% range
            
            if (dataRows < expectedRange[0] || dataRows > expectedRange[1]) {
                console.warn(chalk.yellow(`   ⚠️ CSV row count seems off: ${dataRows} rows, expected ~${expectedRows}`));
            }
            
            console.log(chalk.gray(`   📊 CSV verified: ${dataRows} data rows`));
            return true;
            
        } catch (error) {
            console.warn(chalk.yellow(`   ⚠️ CSV verification failed: ${error.message}`));
            return false;
        }
    }
    
    async clearBrowserUploadState() {
        try {
            // Reset any previous file selections
            await this.browser.page.evaluate(() => {
                // Clear any file inputs
                const fileInputs = document.querySelectorAll('input[type="file"]');
                fileInputs.forEach(input => {
                    input.value = '';
                });
                
                // Clear any global analysis state if accessible
                if (window.analysedTracks) {
                    window.analysedTracks.length = 0;
                }
            });
        } catch (error) {
            // Non-critical error, continue processing
            console.warn(chalk.yellow(`Browser state clear warning: ${error.message}`));
        }
    }
    
    async performInterBatchMaintenance() {
        if (this.config.interBatchDelay <= 0) {
            return;
        }
        
        console.log(chalk.gray(`   💤 Inter-batch maintenance (${this.config.interBatchDelay}ms delay)...`));
        
        try {
            // Monitor memory usage if enabled
            if (this.config.enableMemoryMonitoring) {
                await this.monitorBrowserMemory();
            }
            
            // Take screenshot for debugging if enabled
            if (this.browser.config.screenshotsEnabled) {
                await this.browser.takeScreenshot('inter-batch-state');
            }
            
            // Enhanced page reset for reliable batch processing
            await this.resetPageForNextBatch();
            
            // Wait configured delay
            await this.sleep(this.config.interBatchDelay);
            
        } catch (error) {
            console.warn(chalk.yellow(`Inter-batch maintenance warning: ${error.message}`));
        }
    }
    
    async resetPageForNextBatch() {
        try {
            console.log(chalk.gray(`   🔄 Resetting page for next batch...`));
            
            // Clear browser state first
            await this.clearBrowserUploadState();
            
            // Wait for any ongoing analysis to complete
            await this.sleep(2000);
            
            // Refresh the page to ensure clean state
            await this.browser.page.reload({ waitUntil: 'networkidle' });
            
            // Wait for the MIR app to be ready again
            await this.browser.waitForAppReady();
            
            // Verify file drop area is available
            await this.browser.page.waitForSelector('#file-drop-area', { 
                state: 'visible', 
                timeout: 30000 
            });
            
            console.log(chalk.gray(`   ✓ Page reset complete, ready for next batch`));
            
        } catch (error) {
            console.warn(chalk.yellow(`Page reset warning: ${error.message}`));
            // Try one more time with a simple refresh
            try {
                await this.browser.page.reload({ waitUntil: 'networkidle' });
                await this.sleep(3000);
            } catch (retryError) {
                console.warn(chalk.yellow(`Page reset retry failed: ${retryError.message}`));
            }
        }
    }
    
    async monitorBrowserMemory() {
        try {
            const memoryUsage = await this.browser.page.evaluate(() => {
                return {
                    usedJSHeapSize: performance.memory?.usedJSHeapSize || 0,
                    totalJSHeapSize: performance.memory?.totalJSHeapSize || 0,
                    jsHeapSizeLimit: performance.memory?.jsHeapSizeLimit || 0
                };
            });
            
            if (memoryUsage.usedJSHeapSize > this.config.memoryThreshold) {
                console.warn(chalk.yellow(`   ⚠️ High browser memory usage: ${Math.round(memoryUsage.usedJSHeapSize / 1024 / 1024)}MB`));
                
                // Could implement browser restart logic here if needed
                // await this.restartBrowser();
            }
            
        } catch (error) {
            // Memory monitoring is non-critical
            console.debug(`Memory monitoring failed: ${error.message}`);
        }
    }
    


    displayPreparationSummary(discovery, batchInfo) {
        console.log(chalk.blue('\n📊 Processing Preparation Summary'));
        console.log(chalk.blue('─'.repeat(30)));
        console.log(chalk.white(`Total files: ${discovery.totalFiles}`));
        console.log(chalk.white(`Total batches: ${batchInfo.totalBatches}`));
        console.log(chalk.white(`Batch size: ${batchInfo.batchSize}`));
        console.log(chalk.white(`Total size: ${discovery.statistics.totalSizeFormatted}`));
        
        if (discovery.statistics.formatBreakdown.length > 0) {
            console.log(chalk.white('\nFormat breakdown:'));
            discovery.statistics.formatBreakdown.forEach(format => {
                console.log(chalk.gray(`  ${format.format}: ${format.count} files (${format.percentage}%)`));
            });
        }
    }
    
    displayBatchProgress() {
        const totalFiles = this.workflowStats.totalFiles;
        const processedFiles = this.workflowStats.processedFiles;
        const failedFiles = this.workflowStats.failedFiles;
        const remainingFiles = totalFiles - processedFiles - failedFiles;
        
        const progress = totalFiles > 0 
            ? ((processedFiles / totalFiles) * 100).toFixed(1)
            : '0.0';
            
        const batchProgress = this.workflowStats.totalBatches > 0
            ? `${this.workflowStats.processedBatches}/${this.workflowStats.totalBatches}`
            : '0/0';
        
        // Clear screen and show clean progress
        console.clear();
        
        console.log(chalk.blue.bold('🎵 MIR Batch Processing Status'));
        console.log(chalk.blue('═'.repeat(50)));
        console.log('');
        
        // Main progress bar
        const barLength = 40;
        const filled = Math.floor((processedFiles / totalFiles) * barLength);
        const empty = barLength - filled;
        const progressBar = '█'.repeat(filled) + '░'.repeat(empty);
        
        console.log(chalk.green(`📊 Overall Progress: [${progressBar}] ${progress}%`));
        console.log(chalk.white(`   📁 Files: ${processedFiles}/${totalFiles} songs processed`));
        if (failedFiles > 0) {
            console.log(chalk.red(`   ❌ Failed: ${failedFiles} files`));
        }
        console.log(chalk.blue(`   📦 Batches: ${batchProgress} completed`));
        
        // Time estimation
        if (this.workflowStats.startTime && processedFiles > 0) {
            const elapsedMs = Date.now() - this.workflowStats.startTime.getTime();
            const avgTimePerFile = elapsedMs / processedFiles;
            const estimatedRemainingMs = avgTimePerFile * remainingFiles;
            
            console.log(chalk.gray(`   ⏱️  Elapsed: ${this.formatDuration(elapsedMs)}`));
            if (remainingFiles > 0) {
                console.log(chalk.gray(`   ⏳ Est. remaining: ${this.formatDuration(estimatedRemainingMs)}`));
            }
        }
        
        console.log('');
        
        // Current batch status
        const currentBatch = this.fileManager.processingState.currentBatch;
        if (currentBatch > 0) {
            console.log(chalk.yellow(`🔄 Currently processing: Batch ${currentBatch} (25 songs)`));
        }
        
        console.log('');
        console.log(chalk.gray('💡 Press Ctrl+C to stop processing safely'));
    }
    
    generateWorkflowReport() {
        const totalTime = this.workflowStats.endTime 
            ? this.workflowStats.endTime.getTime() - this.workflowStats.startTime.getTime()
            : Date.now() - this.workflowStats.startTime.getTime();
        
        console.log(chalk.green.bold('\n📋 Upload Workflow Report'));
        console.log(chalk.green.bold('═'.repeat(30)));
        
        console.log(chalk.white.bold('\nBatch Processing:'));
        console.log(chalk.white(`  Total batches: ${this.workflowStats.totalBatches}`));
        console.log(chalk.green(`  Successful: ${this.workflowStats.processedBatches}`));
        console.log(chalk.red(`  Failed: ${this.workflowStats.failedBatches}`));
        
        console.log(chalk.white.bold('\nFile Processing:'));
        console.log(chalk.white(`  Total files: ${this.workflowStats.totalFiles}`));
        console.log(chalk.green(`  Processed: ${this.workflowStats.processedFiles}`));
        console.log(chalk.red(`  Failed: ${this.workflowStats.failedFiles}`));
        
        const successRate = this.workflowStats.totalFiles > 0 
            ? ((this.workflowStats.processedFiles / this.workflowStats.totalFiles) * 100).toFixed(1)
            : '0';
        console.log(chalk.blue(`  Success rate: ${successRate}%`));
        
        console.log(chalk.white.bold('\nCSV Downloads:'));
        console.log(chalk.white(`  Total downloads: ${this.workflowStats.csvDownloads.length}`));
        const validDownloads = this.workflowStats.csvDownloads.filter(d => d.isValid).length;
        console.log(chalk.green(`  Valid CSVs: ${validDownloads}`));
        
        console.log(chalk.white.bold('\nTiming:'));
        console.log(chalk.white(`  Total time: ${this.formatDuration(totalTime)}`));
        
        if (this.workflowStats.processedFiles > 0) {
            const avgTimePerFile = totalTime / this.workflowStats.processedFiles;
            console.log(chalk.white(`  Average per file: ${this.formatDuration(avgTimePerFile)}`));
        }
    }
    
    formatDuration(milliseconds) {
        if (!milliseconds || milliseconds < 0) return '0s';
        
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default UploadWorkflow; 