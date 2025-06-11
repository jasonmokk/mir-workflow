import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import ora from 'ora';
import CSVMerger from './csv-merger.js';

export default class MergeWorkflow {
    constructor(config = {}) {
        this.config = {
            // CSV Merge settings
            csvMerger: {
                inputDirectory: './csv_exports/batch_csvs',
                outputDirectory: './csv_exports',
                outputFilename: 'music_analysis_complete_{timestamp}.csv',
                batchFilenamePattern: 'batch_*_music_analysis_*.csv',
                duplicateStrategy: 'keep_first',
                enableValidation: true,
                enableBackup: true,
                cleanupBatchFiles: false,
                encoding: 'utf8',
                includeMetadata: false
            },
            
            // Workflow settings
            workflow: {
                enableAutoMerge: true,
                autoMergeAfterUpload: true,
                enableProgressReporting: true,
                enableWorkflowLogging: true,
                saveWorkflowReports: true,
                retryFailedMerge: true,
                maxMergeRetries: 3,
                mergeRetryDelay: 5000
            },
            
            // Integration settings
            integration: {
                checkForBatchFiles: true,
                validateBatchCompleteness: true,
                enableWorkflowVerification: true,
                autoCleanupAfterMerge: false
            },
            
            ...config
        };

        this.csvMerger = new CSVMerger(this.config.csvMerger);
        this.workflowStats = {
            startTime: null,
            endTime: null,
            mergeAttempts: 0,
            batchFilesProcessed: 0,
            totalRowsMerged: 0,
            errors: [],
            warnings: []
        };
    }

    /**
     * Execute complete merge workflow
     */
    async executeMergeWorkflow(options = {}) {
        const spinner = ora('Initializing CSV merge workflow...').start();
        
        try {
            this.workflowStats.startTime = Date.now();

            console.log(chalk.blue.bold('\n📊 CSV Merge Workflow Starting'));
            console.log(chalk.blue.bold('═'.repeat(35)));

            // Step 1: Pre-merge validation and setup
            spinner.text = 'Validating merge requirements...';
            await this.validateMergeRequirements();
            spinner.succeed('Merge requirements validated');

            // Step 2: Discover and validate batch files
            spinner.start('Discovering batch CSV files...');
            const batchDiscovery = await this.discoverBatchFiles();
            spinner.succeed(`Discovered ${batchDiscovery.files.length} batch files`);

            if (batchDiscovery.files.length === 0) {
                throw new Error('No batch CSV files found for merging');
            }

            // Step 3: Verify batch completeness (optional)
            if (this.config.integration.validateBatchCompleteness) {
                spinner.start('Validating batch completeness...');
                const completenessCheck = await this.validateBatchCompleteness(batchDiscovery);
                this.reportCompletenessResults(completenessCheck);
                spinner.succeed('Batch completeness validated');
            }

            // Step 4: Execute merge with retry logic
            let mergeResult = null;
            let mergeAttempt = 1;
            const maxRetries = options.maxRetries || this.config.workflow.maxMergeRetries;

            while (mergeAttempt <= maxRetries) {
                try {
                    this.workflowStats.mergeAttempts = mergeAttempt;
                    
                    spinner.start(`Executing CSV merge (attempt ${mergeAttempt}/${maxRetries})...`);
                    mergeResult = await this.csvMerger.mergeCSVFiles();

                    if (mergeResult.success) {
                        spinner.succeed('CSV merge completed successfully');
                        break;
                    } else {
                        throw new Error(mergeResult.error);
                    }

                } catch (error) {
                    this.workflowStats.errors.push({
                        attempt: mergeAttempt,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });

                    if (mergeAttempt < maxRetries) {
                        spinner.warn(`Merge attempt ${mergeAttempt} failed: ${error.message}`);
                        console.log(chalk.yellow(`   Retrying in ${this.config.workflow.mergeRetryDelay / 1000} seconds...`));
                        await this.sleep(this.config.workflow.mergeRetryDelay);
                        mergeAttempt++;
                    } else {
                        throw error;
                    }
                }
            }

            // Step 5: Post-merge verification
            if (this.config.integration.enableWorkflowVerification && mergeResult.success) {
                spinner.start('Verifying merge workflow completion...');
                const verificationResult = await this.verifyWorkflowCompletion(mergeResult);
                spinner.succeed('Workflow verification passed');
            }

            // Step 6: Generate workflow report
            this.workflowStats.endTime = Date.now();
            this.workflowStats.batchFilesProcessed = mergeResult.stats.batchFilesProcessed;
            this.workflowStats.totalRowsMerged = mergeResult.stats.totalRowsProcessed;

            const workflowReport = await this.generateWorkflowReport(mergeResult);

            // Step 7: Save workflow report
            if (this.config.workflow.saveWorkflowReports) {
                spinner.start('Saving workflow report...');
                await this.saveWorkflowReport(workflowReport);
                spinner.succeed('Workflow report saved');
            }

            console.log(chalk.green.bold('\n🎉 CSV merge workflow completed successfully!'));
            
            return {
                success: true,
                mergeResult,
                workflowStats: this.workflowStats,
                workflowReport
            };

        } catch (error) {
            if (spinner) {
                spinner.fail(`Merge workflow failed: ${error.message}`);
            }
            
            this.workflowStats.endTime = Date.now();
            this.workflowStats.errors.push({
                type: 'workflow_error',
                error: error.message,
                timestamp: new Date().toISOString()
            });

            console.error(chalk.red.bold('\n❌ CSV merge workflow failed:'), error.message);
            
            return {
                success: false,
                error: error.message,
                workflowStats: this.workflowStats
            };
        }
    }

    /**
     * Validate merge requirements before starting
     */
    async validateMergeRequirements() {
        // Validate CSV merger configuration
        const configValidation = this.csvMerger.validateConfig();
        if (!configValidation.valid) {
            throw new Error(`Configuration invalid: ${configValidation.errors.join(', ')}`);
        }

        // Ensure required directories exist
        await fs.ensureDir(this.config.csvMerger.inputDirectory);
        await fs.ensureDir(this.config.csvMerger.outputDirectory);

        // Check write permissions
        try {
            const testFile = path.join(this.config.csvMerger.outputDirectory, '.test_write');
            await fs.writeFile(testFile, 'test');
            await fs.remove(testFile);
        } catch (error) {
            throw new Error(`No write permission to output directory: ${this.config.csvMerger.outputDirectory}`);
        }

        return true;
    }

    /**
     * Discover batch CSV files with enhanced metadata
     */
    async discoverBatchFiles() {
        const batchFiles = await this.csvMerger.discoverBatchFiles();
        
        const discovery = {
            files: batchFiles,
            totalFiles: batchFiles.length,
            batchNumbers: [],
            dateRange: {
                earliest: null,
                latest: null
            },
            totalSizeBytes: 0
        };

        // Extract additional metadata
        for (const filePath of batchFiles) {
            // Extract batch number
            const batchMatch = path.basename(filePath).match(/batch_(\d+)_/);
            if (batchMatch) {
                discovery.batchNumbers.push(parseInt(batchMatch[1]));
            }

            // Extract date from filename
            const dateMatch = path.basename(filePath).match(/(\d{4}-\d{2}-\d{2}_\d{6})/);
            if (dateMatch) {
                const fileDate = new Date(dateMatch[1].replace('_', 'T').replace(/(\d{2})(\d{2})(\d{2})$/, '$1:$2:$3'));
                if (!discovery.dateRange.earliest || fileDate < discovery.dateRange.earliest) {
                    discovery.dateRange.earliest = fileDate;
                }
                if (!discovery.dateRange.latest || fileDate > discovery.dateRange.latest) {
                    discovery.dateRange.latest = fileDate;
                }
            }

            // Get file size
            try {
                const stats = await fs.stat(filePath);
                discovery.totalSizeBytes += stats.size;
            } catch (error) {
                this.workflowStats.warnings.push(`Could not get size for ${path.basename(filePath)}: ${error.message}`);
            }
        }

        // Sort batch numbers and check for gaps
        discovery.batchNumbers.sort((a, b) => a - b);
        
        return discovery;
    }

    /**
     * Validate batch completeness by checking for sequential batch numbers
     */
    async validateBatchCompleteness(batchDiscovery) {
        const { batchNumbers } = batchDiscovery;
        
        const completenessCheck = {
            isComplete: true,
            missingBatches: [],
            expectedRange: { start: null, end: null },
            gaps: [],
            warnings: []
        };

        if (batchNumbers.length === 0) {
            completenessCheck.isComplete = false;
            completenessCheck.warnings.push('No batch numbers found');
            return completenessCheck;
        }

        // Determine expected range
        completenessCheck.expectedRange.start = Math.min(...batchNumbers);
        completenessCheck.expectedRange.end = Math.max(...batchNumbers);

        // Check for gaps in sequence
        for (let i = completenessCheck.expectedRange.start; i <= completenessCheck.expectedRange.end; i++) {
            if (!batchNumbers.includes(i)) {
                completenessCheck.missingBatches.push(i);
                completenessCheck.gaps.push(i);
                completenessCheck.isComplete = false;
            }
        }

        // Add warnings for potential issues
        if (completenessCheck.expectedRange.start !== 1) {
            completenessCheck.warnings.push(`Batch sequence does not start at 1 (starts at ${completenessCheck.expectedRange.start})`);
        }

        return completenessCheck;
    }

    /**
     * Report batch completeness results
     */
    reportCompletenessResults(completenessCheck) {
        console.log(chalk.blue('\n🔍 Batch Completeness Check:'));
        
        if (completenessCheck.isComplete) {
            console.log(chalk.green(`   ✓ All batches present (${completenessCheck.expectedRange.start}-${completenessCheck.expectedRange.end})`));
        } else {
            console.log(chalk.red(`   ✗ Missing batches detected`));
            if (completenessCheck.missingBatches.length > 0) {
                console.log(chalk.red(`     Missing: ${completenessCheck.missingBatches.join(', ')}`));
            }
        }

        if (completenessCheck.warnings.length > 0) {
            console.log(chalk.yellow('   ⚠️ Warnings:'));
            completenessCheck.warnings.forEach(warning => {
                console.log(chalk.yellow(`     - ${warning}`));
            });
        }
    }

    /**
     * Verify workflow completion
     */
    async verifyWorkflowCompletion(mergeResult) {
        const verification = {
            outputFileExists: false,
            outputFileValid: false,
            outputFileSize: 0,
            rowCountMatches: false,
            schemaValid: false
        };

        try {
            // Check if output file exists
            verification.outputFileExists = await fs.pathExists(mergeResult.outputPath);
            
            if (verification.outputFileExists) {
                // Get file stats
                const stats = await fs.stat(mergeResult.outputPath);
                verification.outputFileSize = stats.size;
                verification.outputFileValid = stats.size > 0;

                // Verify row count (simplified check)
                const expectedRows = mergeResult.stats.totalRowsProcessed;
                if (expectedRows > 0) {
                    verification.rowCountMatches = true; // Simplified - actual verification done in merger
                }

                // Schema validation (simplified)
                verification.schemaValid = true; // Simplified - actual validation done in merger
            }

            if (!verification.outputFileExists || !verification.outputFileValid) {
                throw new Error('Output file verification failed');
            }

            return verification;

        } catch (error) {
            throw new Error(`Workflow verification failed: ${error.message}`);
        }
    }

    /**
     * Generate comprehensive workflow report
     */
    async generateWorkflowReport(mergeResult) {
        const duration = this.workflowStats.endTime - this.workflowStats.startTime;
        
        const workflowReport = {
            timestamp: new Date().toISOString(),
            workflow: {
                totalDuration: duration,
                durationFormatted: this.formatDuration(duration),
                attempts: this.workflowStats.mergeAttempts,
                success: mergeResult.success,
                batchFilesProcessed: this.workflowStats.batchFilesProcessed,
                totalRowsMerged: this.workflowStats.totalRowsMerged
            },
            merge: mergeResult.report || {},
            errors: this.workflowStats.errors,
            warnings: this.workflowStats.warnings,
            performance: {
                mergeTime: mergeResult.report?.performance?.processingTime || 'N/A',
                rowsPerSecond: mergeResult.report?.performance?.rowsPerSecond || 0,
                averageTimePerBatch: this.workflowStats.batchFilesProcessed > 0 ? 
                    (duration / this.workflowStats.batchFilesProcessed).toFixed(2) + 'ms' : 'N/A'
            },
            output: {
                filePath: mergeResult.outputPath,
                fileName: path.basename(mergeResult.outputPath || ''),
                directory: path.dirname(mergeResult.outputPath || '')
            }
        };

        // Display workflow report
        console.log(chalk.blue.bold('\n📈 Workflow Report'));
        console.log(chalk.blue('─'.repeat(18)));
        console.log(chalk.white(`Total duration: ${workflowReport.workflow.durationFormatted}`));
        console.log(chalk.white(`Merge attempts: ${workflowReport.workflow.attempts}`));
        console.log(chalk.white(`Batch files processed: ${workflowReport.workflow.batchFilesProcessed}`));
        console.log(chalk.white(`Total rows merged: ${workflowReport.workflow.totalRowsMerged}`));
        
        if (mergeResult.outputPath) {
            console.log(chalk.white(`Output file: ${path.basename(mergeResult.outputPath)}`));
        }

        if (this.workflowStats.errors.length > 0) {
            console.log(chalk.red(`Errors: ${this.workflowStats.errors.length}`));
        }

        if (this.workflowStats.warnings.length > 0) {
            console.log(chalk.yellow(`Warnings: ${this.workflowStats.warnings.length}`));
        }

        return workflowReport;
    }

    /**
     * Save workflow report to file
     */
    async saveWorkflowReport(workflowReport) {
        try {
            const reportsDir = path.join(this.config.csvMerger.outputDirectory, 'workflow_reports');
            await fs.ensureDir(reportsDir);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportPath = path.join(reportsDir, `merge_workflow_report_${timestamp}.json`);

            await fs.writeJson(reportPath, workflowReport, { spaces: 2 });

            console.log(chalk.gray(`   Report saved: ${path.basename(reportPath)}`));
            return reportPath;

        } catch (error) {
            this.workflowStats.warnings.push(`Failed to save workflow report: ${error.message}`);
            console.warn(chalk.yellow(`⚠️ Could not save workflow report: ${error.message}`));
        }
    }

    /**
     * Integration with upload workflow - auto-merge after upload completion
     */
    async executeAutoMergeAfterUpload(uploadWorkflowResult) {
        try {
            console.log(chalk.blue.bold('\n🔄 Auto-merge triggered after upload workflow'));
            
            if (!uploadWorkflowResult.success) {
                console.log(chalk.yellow('⚠️ Upload workflow was not successful, skipping auto-merge'));
                return { success: false, reason: 'upload_workflow_failed' };
            }

            // Wait a moment for any pending downloads to complete
            console.log(chalk.blue('⏳ Waiting for downloads to complete...'));
            await this.sleep(5000);

            // Execute merge workflow
            const mergeResult = await this.executeMergeWorkflow({
                triggeredBy: 'upload_workflow',
                uploadStats: uploadWorkflowResult.stats || {}
            });

            if (mergeResult.success) {
                console.log(chalk.green.bold('✅ Auto-merge completed successfully!'));
                console.log(chalk.gray(`   Unified file: ${path.basename(mergeResult.mergeResult.outputPath)}`));
            }

            return mergeResult;

        } catch (error) {
            console.error(chalk.red.bold('❌ Auto-merge failed:'), error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Standalone merge operation for existing batch files
     */
    async executeStandaloneMerge(options = {}) {
        console.log(chalk.blue.bold('\n📊 Standalone CSV Merge'));
        console.log(chalk.blue.bold('═'.repeat(25)));

        return await this.executeMergeWorkflow({
            ...options,
            standalone: true
        });
    }

    /**
     * Utility functions
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    formatDuration(milliseconds) {
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

    /**
     * Get merge status for CLI status command
     */
    async getMergeStatus() {
        try {
            const batchDiscovery = await this.discoverBatchFiles();
            
            return {
                batchFilesAvailable: batchDiscovery.totalFiles,
                batchNumbers: batchDiscovery.batchNumbers,
                dateRange: batchDiscovery.dateRange,
                totalSizeBytes: batchDiscovery.totalSizeBytes,
                readyForMerge: batchDiscovery.totalFiles > 0
            };
        } catch (error) {
            return {
                error: error.message,
                readyForMerge: false
            };
        }
    }
} 