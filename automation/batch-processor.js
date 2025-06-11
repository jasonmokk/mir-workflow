#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

// Import our automation modules
import MIRServer from './server.js';
import BrowserAutomation from './browser-automation.js';
import FileManager from './file-manager.js';
import UploadWorkflow from './upload-workflow.js';
import MergeWorkflow from './merge-workflow.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BatchProcessor {
    constructor() {
        this.config = null;
        this.server = null;
        this.browser = null;
        this.fileManager = null;
        this.uploadWorkflow = null;
        this.mergeWorkflow = null;
        this.spinner = null;
        
        // Load configuration
        this.loadConfig();
        
        // Initialize components
        this.server = new MIRServer(this.config.server);
        this.browser = new BrowserAutomation({
            ...this.config.browser,
            ...this.config.uploadAutomation,
            ...this.config.memoryManagement,
            ...this.config.processingMonitoring
        });
        this.fileManager = new FileManager({
            ...this.config.fileDiscovery,
            ...this.config.batchProcessing
        });
        this.uploadWorkflow = new UploadWorkflow(
            this.server, 
            this.browser, 
            this.fileManager,
            {
                ...this.config.batchProcessing,
                ...this.config.uploadAutomation,
                ...this.config.memoryManagement,
                ...this.config.csvExport
            }
        );
        this.mergeWorkflow = new MergeWorkflow({
            csvMerger: this.config.csvMerge || {},
            workflow: this.config.mergeWorkflow || {},
            integration: this.config.mergeIntegration || {}
        });
        
        // Setup graceful shutdown
        this.setupGracefulShutdown();
    }
    
    loadConfig() {
        try {
            const configPath = path.join(__dirname, 'config.json');
            this.config = fs.readJsonSync(configPath);
            console.log(chalk.blue('📋 Configuration loaded'));
        } catch (error) {
            console.error(chalk.red('Failed to load configuration:'), error.message);
            process.exit(1);
        }
    }
    
    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            console.log(chalk.yellow(`\n🛑 Received ${signal}, shutting down gracefully...`));
            
            if (this.spinner) {
                this.spinner.stop();
            }
            
            await this.cleanup();
            process.exit(0);
        };
        
        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGQUIT', gracefulShutdown);
    }
    
    async cleanup() {
        try {
            if (this.browser) {
                await this.browser.close();
            }
            
            if (this.server) {
                await this.server.stop();
            }
            
            console.log(chalk.green('✓ Cleanup completed'));
        } catch (error) {
            console.error(chalk.red('Cleanup error:'), error.message);
        }
    }


    
    // Enhanced upload workflow - New for Task 2.2, Enhanced for Task 2.3
    async executeUploadWorkflow(directoryPath, options = {}) {
        try {
            console.log(chalk.blue.bold('🎵 MIR Upload Automation Framework'));
            console.log(chalk.blue.bold('═'.repeat(40)));
            
            // Execute the complete upload workflow
            const workflowResult = await this.uploadWorkflow.executeFullWorkflow(directoryPath, {
                batchSize: parseInt(options.batchSize) || this.config.batchProcessing.batchSize,
                strict: options.strict || false,
                enableMemoryMonitoring: this.config.memoryManagement.enableMemoryMonitoring,
                enableProgressTracking: this.config.processingMonitoring.enableProgressTracking
            });
            
            console.log(chalk.green.bold('\n🎉 Upload workflow completed successfully!'));
            
            // Save workflow report
            await this.saveWorkflowReport(workflowResult.stats || workflowResult);
            
            // Execute auto-merge if enabled and upload was successful
            let mergeResult = null;
            console.log(chalk.blue(`\n🔍 Merge check: mergeCSVs=${this.config.csvExport?.mergeCSVs}, workflowSuccess=${workflowResult.success}`));
            
            if (this.config.csvExport?.mergeCSVs && workflowResult.success) {
                try {
                    console.log(chalk.blue('\n🔄 Creating final results CSV...'));
                    
                    // Simple merge: find batch files and combine them
                    const batchDir = path.join(process.cwd(), 'csv_exports', 'batch_csvs');
                    const batchFiles = await fs.readdir(batchDir).catch(() => []);
                    const csvFiles = batchFiles.filter(file => file.startsWith('batch_') && file.endsWith('.csv'));
                    
                    console.log(chalk.gray(`   📁 Found ${csvFiles.length} batch CSV files`));
                    
                    if (csvFiles.length > 0) {
                        const resultsDir = path.resolve(__dirname, '..', 'results');
                        await fs.ensureDir(resultsDir);
                        
                        // Find next available result number
                        const existingResults = await fs.readdir(resultsDir).catch(() => []);
                        const resultNumbers = existingResults
                            .filter(file => file.startsWith('music_analysis_results_') && file.endsWith('.csv'))
                            .map(file => parseInt(file.match(/music_analysis_results_(\d+)\.csv/)?.[1] || '0'))
                            .filter(num => !isNaN(num));
                        const nextNumber = resultNumbers.length > 0 ? Math.max(...resultNumbers) + 1 : 1;
                        const outputFilename = `music_analysis_results_${String(nextNumber).padStart(2, '0')}.csv`;
                        const outputPath = path.join(resultsDir, outputFilename);
                        
                        // Simple merge: read first file to get header, then append all data rows
                        let allData = [];
                        let header = '';
                        
                        for (let i = 0; i < csvFiles.length; i++) {
                            const csvPath = path.join(batchDir, csvFiles[i]);
                            const content = await fs.readFile(csvPath, 'utf8');
                            const lines = content.split('\n').filter(line => line.trim());
                            
                            if (i === 0) {
                                header = lines[0]; // Save header from first file
                                allData.push(...lines.slice(1)); // Add data rows
                            } else {
                                allData.push(...lines.slice(1)); // Add only data rows (skip header)
                            }
                        }
                        
                        // Write combined CSV
                        const finalContent = header + '\n' + allData.join('\n') + '\n';
                        await fs.writeFile(outputPath, finalContent, 'utf8');
                        
                        console.log(chalk.green.bold('✅ Final results CSV created successfully!'));
                        console.log(chalk.gray(`   📊 File: ${outputFilename}`));
                        console.log(chalk.gray(`   📍 Location: ${outputPath}`));
                        console.log(chalk.gray(`   📈 Rows: ${allData.length} data rows`));
                        
                        mergeResult = { success: true, outputPath, filename: outputFilename };
                    } else {
                        console.log(chalk.yellow('⚠️ No batch CSV files found to merge'));
                        mergeResult = { success: false, error: 'No batch files found' };
                    }
                } catch (mergeError) {
                    console.error(chalk.red('⚠️ Results CSV creation failed:'), mergeError.message);
                    console.log(chalk.yellow('Upload completed successfully. Check batch files manually.'));
                    mergeResult = { success: false, error: mergeError.message };
                }
            } else if (!this.config.csvExport?.mergeCSVs) {
                console.log(chalk.blue('ℹ️ Auto-merge disabled. Batch CSV files available for manual merge.'));
            } else {
                console.log(chalk.yellow('⚠️ Auto-merge not executed: workflow may not have completed successfully'));
            }
            
            return {
                ...workflowResult,
                mergeResult
            };
            
        } catch (error) {
            console.error(chalk.red.bold('\n❌ Upload workflow failed:'), error.message);
            throw error;
        }
    }
    
    async processDirectory(directoryPath, options = {}) {
        try {
            console.log(chalk.blue.bold('🎵 MIR Batch Processing Framework'));
            console.log(chalk.blue.bold('═'.repeat(50)));
            
            // Step 1: Start the server
            this.spinner = ora('Starting MIR web server...').start();
            const serverInfo = await this.server.start();
            this.spinner.succeed(`Server started at ${serverInfo.url}`);
            
            // Step 2: Discover files
            this.spinner = ora('Discovering audio files...').start();
            const discovery = await this.fileManager.discoverFiles(directoryPath);
            this.spinner.succeed(`Discovered ${discovery.totalFiles} audio files`);
            
            if (discovery.totalFiles === 0) {
                console.log(chalk.yellow('⚠️ No audio files found. Exiting...'));
                return;
            }
            
            // Display discovery statistics
            this.displayDiscoveryStats(discovery);
            
            // Step 3: Create batches
            this.spinner = ora('Creating processing batches...').start();
            const batchInfo = await this.fileManager.createBatches(
                null, 
                options.batchSize || this.config.batchProcessing.batchSize
            );
            this.spinner.succeed(`Created ${batchInfo.totalBatches} batches`);
            
            // Step 4: Launch browser automation
            this.spinner = ora('Launching browser automation...').start();
            await this.browser.launch('chromium', serverInfo.url);
            this.spinner.succeed('Browser automation ready');
            
            // Step 5: Process batches
            await this.processBatches(options);
            
            // Step 6: Generate final report
            this.generateFinalReport();
            
        } catch (error) {
            if (this.spinner) {
                this.spinner.fail('Processing failed');
            }
            console.error(chalk.red('Batch processing failed:'), error.message);
            throw error;
        }
    }
    
    async processBatches(options = {}) {
        console.log(chalk.blue.bold('\n📦 Starting Batch Processing'));
        console.log(chalk.blue('─'.repeat(30)));
        
        let batch;
        let batchCount = 0;
        const startTime = Date.now();
        
        while ((batch = this.fileManager.getNextBatch())) {
            batchCount++;
            
            try {
                console.log(chalk.blue(`\n🔄 Processing Batch ${batch.id}/${this.fileManager.batches.length}`));
                console.log(chalk.gray(`   Files: ${batch.files.length}`));
                console.log(chalk.gray(`   Attempt: ${batch.attempts + 1}/${batch.maxAttempts}`));
                
                // Mark batch as started
                this.fileManager.markBatchStarted(batch.id);
                
                // Upload files to the browser
                this.spinner = ora(`Uploading ${batch.files.length} files...`).start();
                const uploadResult = await this.browser.uploadFiles(
                    batch.files, 
                    `batch-${batch.id}`
                );
                this.spinner.succeed(`Uploaded ${uploadResult.uploadedCount} files`);
                
                if (uploadResult.skippedCount > 0) {
                    console.log(chalk.yellow(`   ⚠️ Skipped ${uploadResult.skippedCount} invalid files`));
                }
                
                // Wait for analysis to complete
                this.spinner = ora('Waiting for analysis to complete...').start();
                await this.browser.waitForAnalysisComplete(this.config.batchProcessing.analysisTimeout);
                this.spinner.succeed('Analysis completed');
                
                // Check how many tracks were analyzed
                const tracksCount = await this.browser.getAnalysedTracksCount();
                console.log(chalk.green(`   ✓ Analyzed ${tracksCount} tracks`));
                
                // Download CSV if ready and configured
                if (this.config.csvExport.enableAutoDownload) {
                    const csvReady = await this.browser.isCSVDownloadReady();
                    if (csvReady) {
                        this.spinner = ora('Downloading CSV...').start();
                        const csvResult = await this.browser.downloadCSV(this.config.csvExport.outputDirectory);
                        this.spinner.succeed(`CSV downloaded: ${csvResult.filename}`);
                    }
                }
                
                // Mark batch as completed
                this.fileManager.markBatchCompleted(batch.id, batch.files);
                
                // Display progress
                this.displayProgress();
                
                // Add delay between batches if configured
                if (this.config.batchProcessing.delayBetweenBatches > 0) {
                    console.log(chalk.gray(`   💤 Waiting ${this.config.batchProcessing.delayBetweenBatches}ms between batches...`));
                    await this.sleep(this.config.batchProcessing.delayBetweenBatches);
                }
                
            } catch (error) {
                if (this.spinner) {
                    this.spinner.fail(`Batch ${batch.id} failed: ${error.message}`);
                }
                
                console.error(chalk.red(`   ✗ Batch ${batch.id} failed: ${error.message}`));
                
                // Mark batch as failed
                this.fileManager.markBatchFailed(batch.id, error, batch.files);
                
                // Check if we should retry
                if (batch.attempts < batch.maxAttempts) {
                    console.log(chalk.yellow(`   🔄 Will retry batch ${batch.id} (attempt ${batch.attempts + 1}/${batch.maxAttempts})`));
                    
                    // Add retry delay
                    if (this.config.batchProcessing.retryDelay > 0) {
                        await this.sleep(this.config.batchProcessing.retryDelay);
                    }
                } else {
                    console.log(chalk.red(`   ❌ Batch ${batch.id} failed permanently after ${batch.maxAttempts} attempts`));
                }
                
                // Continue with next batch unless in strict mode
                if (!options.strict) {
                    continue;
                } else {
                    throw error;
                }
            }
        }
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        console.log(chalk.green.bold(`\n✅ Batch processing completed in ${this.formatDuration(totalTime)}`));
    }
    
    displayDiscoveryStats(discovery) {
        console.log(chalk.blue('\n📊 Discovery Statistics'));
        console.log(chalk.blue('─'.repeat(20)));
        console.log(chalk.white(`Total files: ${discovery.statistics.totalFiles}`));
        console.log(chalk.white(`Total size: ${discovery.statistics.totalSizeFormatted}`));
        
        if (discovery.statistics.formatBreakdown.length > 0) {
            console.log(chalk.white('\nFormat breakdown:'));
            discovery.statistics.formatBreakdown.forEach(format => {
                console.log(chalk.gray(`  ${format.format}: ${format.count} files (${format.percentage}%)`));
            });
        }
    }
    
    displayProgress() {
        const progress = this.fileManager.getProcessingProgress();
        
        console.log(chalk.blue('\n📈 Progress Update'));
        console.log(chalk.blue('─'.repeat(15)));
        console.log(chalk.white(`Files: ${progress.processedCount}/${progress.totalFiles} (${progress.progressPercentage}%)`));
        console.log(chalk.white(`Batches: ${progress.completedBatches}/${progress.totalBatches}`));
        
        if (progress.estimatedRemainingTime) {
            console.log(chalk.gray(`Estimated time remaining: ${this.formatDuration(progress.estimatedRemainingTime)}`));
        }
    }
    
    generateFinalReport() {
        const report = this.fileManager.generateReport();
        
        console.log(chalk.green.bold('\n📋 Final Processing Report'));
        console.log(chalk.green.bold('═'.repeat(25)));
        
        // Summary
        console.log(chalk.white.bold('\nSummary:'));
        console.log(chalk.white(`  Total files: ${report.summary.totalFiles}`));
        console.log(chalk.green(`  Processed: ${report.summary.processedFiles}`));
        console.log(chalk.red(`  Failed: ${report.summary.failedFiles}`));
        console.log(chalk.blue(`  Success rate: ${report.summary.successRate}`));
        
        // Timing
        console.log(chalk.white.bold('\nTiming:'));
        console.log(chalk.white(`  Total time: ${report.timing.elapsedTime}`));
        console.log(chalk.white(`  Avg per file: ${report.timing.averageTimePerFile}`));
        
        // Batches
        console.log(chalk.white.bold('\nBatches:'));
        console.log(chalk.green(`  Completed: ${report.summary.completedBatches}`));
        console.log(chalk.red(`  Failed: ${report.summary.failedBatches}`));
        
        // Failed batches details
        if (report.batches.failed.length > 0) {
            console.log(chalk.red.bold('\nFailed Batches:'));
            report.batches.failed.forEach(batch => {
                console.log(chalk.red(`  Batch ${batch.id}: ${batch.error} (${batch.fileCount} files, ${batch.attempts} attempts)`));
            });
        }
        
        // Save report to file
        this.saveReport(report);
    }
    
    async saveReport(report) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportPath = path.join(this.config.logging.logDirectory || './logs', `batch-report-${timestamp}.json`);
            
            await fs.ensureDir(path.dirname(reportPath));
            await fs.writeJson(reportPath, report, { spaces: 2 });
            
            console.log(chalk.blue(`\n📄 Report saved: ${reportPath}`));
        } catch (error) {
            console.warn(chalk.yellow(`Failed to save report: ${error.message}`));
        }
    }
    
    async saveWorkflowReport(workflowResult) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportPath = path.join(this.config.logging.logDirectory || './logs', `upload-workflow-report-${timestamp}.json`);
            
            await fs.ensureDir(path.dirname(reportPath));
            await fs.writeJson(reportPath, workflowResult, { spaces: 2 });
            
            console.log(chalk.blue(`\n📄 Workflow report saved: ${reportPath}`));
        } catch (error) {
            console.warn(chalk.yellow(`Failed to save workflow report: ${error.message}`));
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
}

// CLI Setup
const program = new Command();

program
    .name('batch-processor')
    .description('MIR Automation Framework - Batch process audio files for music analysis')
    .version('1.0.0');

program
    .command('merge')
    .description('Merge batch CSV files into a single unified CSV')
    .option('--input-dir <directory>', 'Input directory containing batch CSV files', './csv_exports/batch_csvs')
    .option('--output-dir <directory>', 'Output directory for merged CSV', './csv_exports')
    .option('--cleanup', 'Remove batch files after successful merge')
    .option('--verify', 'Enable comprehensive verification of merge results')
    .action(async (options) => {
        const processor = new BatchProcessor();
        
        try {
            console.log(chalk.blue('📊 Starting CSV merge operation...'));
            
            // Configure merge settings
            processor.mergeWorkflow.config.csvMerger.inputDirectory = options.inputDir;
            processor.mergeWorkflow.config.csvMerger.outputDirectory = options.outputDir;
            processor.mergeWorkflow.config.csvMerger.cleanupBatchFiles = options.cleanup || false;
            processor.mergeWorkflow.config.integration.enableWorkflowVerification = options.verify || false;
            
            const mergeResult = await processor.mergeWorkflow.executeStandaloneMerge({
                standalone: true,
                triggeredBy: 'cli_command'
            });
            
            if (mergeResult.success) {
                console.log(chalk.green.bold('\n✅ CSV merge completed successfully!'));
                console.log(chalk.gray(`   Output: ${path.basename(mergeResult.mergeResult.outputPath)}`));
            } else {
                console.error(chalk.red.bold('\n❌ CSV merge failed:'), mergeResult.error);
                process.exit(1);
            }
            
        } catch (error) {
            console.error(chalk.red.bold('\n❌ Merge operation failed:'), error.message);
            process.exit(1);
        }
    });

program
    .command('merge-status')
    .description('Show CSV merge status and available batch files')
    .action(async () => {
        const processor = new BatchProcessor();
        
        try {
            console.log(chalk.blue('🔍 Checking CSV merge status...'));
            
            const mergeStatus = await processor.mergeWorkflow.getMergeStatus();
            
            console.log(chalk.blue.bold('\n📊 CSV Merge Status'));
            console.log(chalk.blue('═'.repeat(20)));
            
            if (mergeStatus.error) {
                console.log(chalk.red(`Error: ${mergeStatus.error}`));
                return;
            }
            
            console.log(chalk.white(`Batch files available: ${mergeStatus.batchFilesAvailable}`));
            console.log(chalk.white(`Ready for merge: ${mergeStatus.readyForMerge ? 'Yes' : 'No'}`));
            
            if (mergeStatus.batchNumbers && mergeStatus.batchNumbers.length > 0) {
                console.log(chalk.white(`Batch numbers: ${mergeStatus.batchNumbers.join(', ')}`));
            }
            
            if (mergeStatus.dateRange && mergeStatus.dateRange.earliest) {
                console.log(chalk.white(`Date range: ${mergeStatus.dateRange.earliest.toISOString().split('T')[0]} to ${mergeStatus.dateRange.latest.toISOString().split('T')[0]}`));
            }
            
            if (mergeStatus.totalSizeBytes > 0) {
                console.log(chalk.white(`Total size: ${(mergeStatus.totalSizeBytes / 1024).toFixed(2)} KB`));
            }
            
        } catch (error) {
            console.error(chalk.red('Merge status check failed:'), error.message);
            process.exit(1);
        }
    });

program
    .command('upload')
    .description('Execute automated upload workflow with enhanced browser automation')
    .argument('<directory>', 'Directory containing audio files to upload and process')
    .option('-b, --batch-size <size>', 'Number of files per batch', '25')
    .option('-s, --strict', 'Stop processing on first batch failure')
    .option('--resume', 'Resume from previous processing state')
    .option('--clear-state', 'Clear previous processing state before starting')
    .option('--headless', 'Run browser in headless mode')
    .option('--visible', 'Run browser in visible mode for debugging')
    .option('--no-merge', 'Disable auto-merge after upload completion')
    .action(async (directory, options) => {
        const processor = new BatchProcessor();
        
        try {
            // Override browser settings based on options
            if (options.headless) {
                processor.browser.config.headless = true;
                processor.browser.config.visible = false;
            }
            if (options.visible) {
                processor.browser.config.headless = false;
                processor.browser.config.visible = true;
            }
            
            // Override merge settings
            if (options.noMerge) {
                processor.config.csvExport.mergeCSVs = false;
                console.log(chalk.yellow('⚠️ Auto-merge disabled by --no-merge flag'));
            }
            
            // Handle state management
            if (options.clearState) {
                await processor.fileManager.clearState();
                console.log(chalk.blue('🗑️ Previous processing state cleared'));
            } else if (options.resume) {
                const loaded = await processor.fileManager.loadState();
                if (loaded) {
                    console.log(chalk.blue('📄 Resumed from previous processing state'));
                } else {
                    console.log(chalk.yellow('⚠️ No previous state found, starting fresh'));
                }
            }
            
            await processor.executeUploadWorkflow(directory, {
                batchSize: parseInt(options.batchSize),
                strict: options.strict
            });
            
        } catch (error) {
            console.error(chalk.red.bold('\n❌ Upload workflow failed:'), error.message);
            process.exit(1);
        } finally {
            await processor.cleanup();
        }
    });

program
    .command('process')
    .description('Process a directory of audio files (legacy batch processing)')
    .argument('<directory>', 'Directory containing audio files to process')
    .option('-b, --batch-size <size>', 'Number of files per batch', '25')
    .option('-s, --strict', 'Stop processing on first batch failure')
    .option('--resume', 'Resume from previous processing state')
    .option('--clear-state', 'Clear previous processing state before starting')
    .action(async (directory, options) => {
        const processor = new BatchProcessor();
        
        try {
            // Handle state management
            if (options.clearState) {
                await processor.fileManager.clearState();
                console.log(chalk.blue('🗑️ Previous processing state cleared'));
            } else if (options.resume) {
                const loaded = await processor.fileManager.loadState();
                if (loaded) {
                    console.log(chalk.blue('📄 Resumed from previous processing state'));
                } else {
                    console.log(chalk.yellow('⚠️ No previous state found, starting fresh'));
                }
            }
            
            await processor.processDirectory(directory, {
                batchSize: parseInt(options.batchSize),
                strict: options.strict
            });
            
        } catch (error) {
            console.error(chalk.red.bold('\n❌ Processing failed:'), error.message);
            process.exit(1);
        } finally {
            await processor.cleanup();
        }
    });

program
    .command('server')
    .description('Start the MIR web server only')
    .option('-p, --port <port>', 'Server port', '3000')
    .action(async (options) => {
        const processor = new BatchProcessor();
        
        try {
            console.log(chalk.blue('🚀 Starting MIR server...'));
            
            const serverInfo = await processor.server.start();
            console.log(chalk.green(`✓ Server running at ${serverInfo.url}`));
            console.log(chalk.gray('Press Ctrl+C to stop'));
            
            // Keep server running
            await new Promise(() => {});
            
        } catch (error) {
            console.error(chalk.red('Server failed:'), error.message);
            process.exit(1);
        }
    });

program
    .command('discover')
    .description('Discover and analyze audio files in a directory')
    .argument('<directory>', 'Directory to analyze')
    .action(async (directory) => {
        const processor = new BatchProcessor();
        
        try {
            console.log(chalk.blue('🔍 Discovering audio files...'));
            
            const discovery = await processor.fileManager.discoverFiles(directory);
            
            processor.displayDiscoveryStats(discovery);
            
            if (discovery.totalFiles > 0) {
                const batchInfo = processor.fileManager.createBatches();
                console.log(chalk.blue(`\n📦 Would create ${batchInfo.totalBatches} batches for processing`));
            }
            
        } catch (error) {
            console.error(chalk.red('Discovery failed:'), error.message);
            process.exit(1);
        }
    });

program
    .command('status')
    .description('Show current processing status and CSV merge availability')
    .action(async () => {
        const processor = new BatchProcessor();
        
        try {
            // Check processing state
            const loaded = await processor.fileManager.loadState();
            
            console.log(chalk.blue.bold('📊 System Status'));
            console.log(chalk.blue('═'.repeat(15)));
            
            if (loaded) {
                const progress = processor.fileManager.getProcessingProgress();
                
                console.log(chalk.blue.bold('\n📦 Processing Status:'));
                console.log(chalk.white(`Files: ${progress.processedCount}/${progress.totalFiles} (${progress.progressPercentage}%)`));
                console.log(chalk.white(`Batches: ${progress.completedBatches}/${progress.totalBatches}`));
                console.log(chalk.white(`Failed files: ${progress.failedCount}`));
                
                if (progress.elapsedTime > 0) {
                    console.log(chalk.white(`Elapsed time: ${processor.formatDuration(progress.elapsedTime)}`));
                }
                
                if (progress.estimatedRemainingTime) {
                    console.log(chalk.white(`Estimated remaining: ${processor.formatDuration(progress.estimatedRemainingTime)}`));
                }
            } else {
                console.log(chalk.yellow('\n📦 No active processing state found'));
            }
            
            // Check merge status
            try {
                const mergeStatus = await processor.mergeWorkflow.getMergeStatus();
                
                console.log(chalk.blue.bold('\n📊 CSV Merge Status:'));
                
                if (mergeStatus.error) {
                    console.log(chalk.red(`Error: ${mergeStatus.error}`));
                } else {
                    console.log(chalk.white(`Batch files available: ${mergeStatus.batchFilesAvailable}`));
                    console.log(chalk.white(`Ready for merge: ${mergeStatus.readyForMerge ? 'Yes' : 'No'}`));
                    
                    if (mergeStatus.batchNumbers && mergeStatus.batchNumbers.length > 0) {
                        console.log(chalk.white(`Batch numbers: ${mergeStatus.batchNumbers.join(', ')}`));
                    }
                    
                    if (mergeStatus.totalSizeBytes > 0) {
                        console.log(chalk.white(`Total batch size: ${(mergeStatus.totalSizeBytes / 1024).toFixed(2)} KB`));
                    }
                    
                    if (mergeStatus.readyForMerge) {
                        console.log(chalk.green('\n💡 Tip: Run "node batch-processor.js merge" to merge available batch files'));
                    }
                }
            } catch (mergeError) {
                console.log(chalk.red(`\n📊 CSV Merge Status: Error - ${mergeError.message}`));
            }
            
        } catch (error) {
            console.error(chalk.red('Status check failed:'), error.message);
            process.exit(1);
        }
    });

program
    .command('clear')
    .description('Clear processing state and temporary files')
    .action(async () => {
        const processor = new BatchProcessor();
        
        try {
            await processor.fileManager.clearState();
            console.log(chalk.green('✓ Processing state cleared'));
            
        } catch (error) {
            console.error(chalk.red('Clear failed:'), error.message);
            process.exit(1);
        }
    });

// Only run CLI if this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    // Handle no command
    if (process.argv.length < 3) {
        program.help();
    }

    // Parse command line arguments
    program.parse();
}

// Export BatchProcessor class for use in other modules
export default BatchProcessor; 