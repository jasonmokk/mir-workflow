import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { glob } from 'glob';
import csvParser from 'csv-parser';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export default class CSVMerger {
    constructor(config = {}) {
        this.config = {
            inputDirectory: './csv_exports/batch_csvs',
            outputDirectory: './csv_exports',
            outputFilename: 'music_analysis_complete_{timestamp}.csv',
            batchFilenamePattern: 'batch_*_music_analysis_*.csv',
            duplicateStrategy: 'keep_first', // 'keep_first', 'keep_last', 'flag_duplicates'
            enableValidation: true,
            enableBackup: true,
            cleanupBatchFiles: false,
            encoding: 'utf8',
            includeMetadata: false,
            maxMemoryUsage: 536870912, // 512MB
            ...config
        };

        this.expectedSchema = [
            'Filename',
            'BPM',
            'Key', 
            'Happy',
            'Sad',
            'Relaxed',
            'Aggressive',
            'Danceability'
        ];

        this.mergeStats = {
            batchFilesFound: 0,
            batchFilesProcessed: 0,
            totalRowsProcessed: 0,
            duplicatesFound: 0,
            duplicatesResolved: 0,
            validationErrors: 0,
            processingErrors: 0,
            startTime: null,
            endTime: null
        };
    }

    /**
     * Main merge function - orchestrates the entire merge workflow
     */
    async mergeCSVFiles() {
        try {
            console.log(chalk.blue.bold('\n📊 CSV Merge Operation Starting'));
            console.log(chalk.blue.bold('═'.repeat(35)));

            this.mergeStats.startTime = Date.now();

            // Step 1: Discover and validate batch CSV files
            const batchFiles = await this.discoverBatchFiles();
            if (batchFiles.length === 0) {
                throw new Error('No batch CSV files found for merging');
            }

            // Step 2: Validate CSV files
            const validationResults = await this.validateBatchFiles(batchFiles);
            this.reportValidationResults(validationResults);

            // Step 3: Process and merge CSV data
            const mergedData = await this.consolidateCSVData(batchFiles);

            // Step 4: Generate output file
            const outputPath = await this.generateOutputFile(mergedData);

            // Step 5: Verify output
            await this.verifyOutput(outputPath, mergedData);

            // Step 6: Cleanup if requested
            if (this.config.cleanupBatchFiles) {
                await this.cleanupBatchFiles(batchFiles);
            }

            this.mergeStats.endTime = Date.now();

            // Generate final report
            const report = this.generateMergeReport(outputPath);
            console.log(chalk.green.bold('\n✅ CSV merge completed successfully!'));
            
            return {
                success: true,
                outputPath,
                stats: this.mergeStats,
                report
            };

        } catch (error) {
            this.mergeStats.endTime = Date.now();
            this.mergeStats.processingErrors++;
            
            console.error(chalk.red.bold('\n❌ CSV merge failed:'), error.message);
            return {
                success: false,
                error: error.message,
                stats: this.mergeStats
            };
        }
    }

    /**
     * Discover batch CSV files in the configured directory
     */
    async discoverBatchFiles() {
        console.log(chalk.blue('🔍 Discovering batch CSV files...'));

        try {
            // Ensure input directory exists
            await fs.ensureDir(this.config.inputDirectory);

            // Find batch CSV files using glob pattern
            const pattern = path.join(this.config.inputDirectory, this.config.batchFilenamePattern);
            const files = await glob(pattern, { absolute: true });

            // Sort files by batch number for proper sequential processing
            const sortedFiles = files.sort((a, b) => {
                const extractBatchNumber = (filename) => {
                    const match = filename.match(/batch_(\d+)_/);
                    return match ? parseInt(match[1]) : 0;
                };
                return extractBatchNumber(a) - extractBatchNumber(b);
            });

            this.mergeStats.batchFilesFound = sortedFiles.length;

            console.log(chalk.green(`✓ Found ${sortedFiles.length} batch CSV files`));
            
            if (sortedFiles.length > 0) {
                console.log(chalk.gray('Files to merge:'));
                sortedFiles.forEach((file, index) => {
                    console.log(chalk.gray(`   ${index + 1}. ${path.basename(file)}`));
                });
            }

            return sortedFiles;

        } catch (error) {
            throw new Error(`Failed to discover batch files: ${error.message}`);
        }
    }

    /**
     * Validate batch CSV files for integrity and schema consistency
     */
    async validateBatchFiles(batchFiles) {
        console.log(chalk.blue('🔧 Validating batch CSV files...'));

        const validationResults = {
            validFiles: [],
            invalidFiles: [],
            schemaErrors: [],
            corruptedFiles: []
        };

        for (const filePath of batchFiles) {
            try {
                // Check file existence and readability
                const stats = await fs.stat(filePath);
                if (stats.size === 0) {
                    validationResults.invalidFiles.push({
                        file: filePath,
                        error: 'File is empty'
                    });
                    continue;
                }

                // Validate CSV schema by reading header
                const header = await this.readCSVHeader(filePath);
                const schemaValid = this.validateSchema(header);

                if (!schemaValid.valid) {
                    validationResults.schemaErrors.push({
                        file: filePath,
                        error: schemaValid.error,
                        expectedSchema: this.expectedSchema,
                        actualSchema: header
                    });
                    this.mergeStats.validationErrors++;
                    continue;
                }

                // Count rows for validation
                const rowCount = await this.countCSVRows(filePath);
                
                validationResults.validFiles.push({
                    file: filePath,
                    rowCount: rowCount,
                    size: stats.size
                });

            } catch (error) {
                validationResults.corruptedFiles.push({
                    file: filePath,
                    error: error.message
                });
                this.mergeStats.validationErrors++;
            }
        }

        return validationResults;
    }

    /**
     * Read CSV header row
     */
    async readCSVHeader(filePath) {
        return new Promise((resolve, reject) => {
            const headers = [];
            createReadStream(filePath, { encoding: this.config.encoding })
                .pipe(csvParser())
                .on('headers', (headerList) => {
                    resolve(headerList);
                })
                .on('error', reject)
                .on('data', () => {
                    // Stop after first row (header)
                    resolve(headers);
                });
        });
    }

    /**
     * Validate CSV schema against expected format
     */
    validateSchema(actualHeaders) {
        const missingColumns = this.expectedSchema.filter(col => !actualHeaders.includes(col));
        const extraColumns = actualHeaders.filter(col => !this.expectedSchema.includes(col));

        if (missingColumns.length > 0) {
            return {
                valid: false,
                error: `Missing required columns: ${missingColumns.join(', ')}`
            };
        }

        return { valid: true };
    }

    /**
     * Count rows in CSV file
     */
    async countCSVRows(filePath) {
        return new Promise((resolve, reject) => {
            let rowCount = 0;
            createReadStream(filePath, { encoding: this.config.encoding })
                .pipe(csvParser())
                .on('data', (row) => {
                    rowCount++;
                })
                .on('end', () => {
                    resolve(rowCount);
                })
                .on('error', reject);
        });
    }

    /**
     * Report validation results
     */
    reportValidationResults(results) {
        console.log(chalk.blue('\n📋 Validation Results:'));
        console.log(chalk.green(`   ✓ Valid files: ${results.validFiles.length}`));
        
        if (results.invalidFiles.length > 0) {
            console.log(chalk.red(`   ✗ Invalid files: ${results.invalidFiles.length}`));
            results.invalidFiles.forEach(item => {
                console.log(chalk.red(`     - ${path.basename(item.file)}: ${item.error}`));
            });
        }

        if (results.schemaErrors.length > 0) {
            console.log(chalk.red(`   ✗ Schema errors: ${results.schemaErrors.length}`));
            results.schemaErrors.forEach(item => {
                console.log(chalk.red(`     - ${path.basename(item.file)}: ${item.error}`));
            });
        }

        if (results.corruptedFiles.length > 0) {
            console.log(chalk.red(`   ✗ Corrupted files: ${results.corruptedFiles.length}`));
            results.corruptedFiles.forEach(item => {
                console.log(chalk.red(`     - ${path.basename(item.file)}: ${item.error}`));
            });
        }

        // Calculate total expected rows
        const totalRows = results.validFiles.reduce((sum, file) => sum + file.rowCount, 0);
        console.log(chalk.blue(`   📊 Total rows to merge: ${totalRows}`));
    }

    /**
     * Consolidate CSV data from all batch files
     */
    async consolidateCSVData(batchFiles) {
        console.log(chalk.blue('🔄 Consolidating CSV data...'));

        const consolidatedData = [];
        const seenFilenames = new Set();
        let totalRowsProcessed = 0;

        for (const filePath of batchFiles) {
            try {
                console.log(chalk.gray(`   Processing: ${path.basename(filePath)}`));

                const batchData = await this.readCSVData(filePath);
                let batchRowsAdded = 0;

                for (const row of batchData) {
                    totalRowsProcessed++;

                    // Get filename for duplicate detection - handle different column name cases
                    const filename = row.Filename || row.filename || row.file || '';

                    // Handle duplicates based on strategy
                    if (seenFilenames.has(filename)) {
                        this.mergeStats.duplicatesFound++;
                        
                        switch (this.config.duplicateStrategy) {
                            case 'keep_first':
                                // Skip duplicate (keep first occurrence)
                                this.mergeStats.duplicatesResolved++;
                                continue;
                            case 'keep_last':
                                // Remove previous occurrence and add this one
                                const existingIndex = consolidatedData.findIndex(item => 
                                    (item.Filename || item.filename || item.file || '') === filename);
                                if (existingIndex !== -1) {
                                    consolidatedData.splice(existingIndex, 1);
                                }
                                this.mergeStats.duplicatesResolved++;
                                break;
                            case 'flag_duplicates':
                                // Add metadata to flag this as a duplicate
                                row._duplicate = true;
                                row._original_batch = path.basename(filePath);
                                this.mergeStats.duplicatesResolved++;
                                break;
                        }
                    }

                    // Add metadata if requested
                    if (this.config.includeMetadata) {
                        row._batch_source = path.basename(filePath);
                        row._processing_order = totalRowsProcessed;
                    }

                    consolidatedData.push(row);
                    seenFilenames.add(filename);
                    batchRowsAdded++;
                }

                console.log(chalk.green(`     ✓ Added ${batchRowsAdded} rows`));
                this.mergeStats.batchFilesProcessed++;

            } catch (error) {
                console.error(chalk.red(`     ✗ Error processing ${path.basename(filePath)}: ${error.message}`));
                this.mergeStats.processingErrors++;
            }
        }

        // Sort consolidated data by filename for consistency
        consolidatedData.sort((a, b) => {
            const filenameA = a.Filename || a.filename || a.file || '';
            const filenameB = b.Filename || b.filename || b.file || '';
            return filenameA.localeCompare(filenameB);
        });

        this.mergeStats.totalRowsProcessed = consolidatedData.length;

        console.log(chalk.green(`✓ Consolidated ${consolidatedData.length} rows`));
        
        if (this.mergeStats.duplicatesFound > 0) {
            console.log(chalk.yellow(`⚠️ Found and resolved ${this.mergeStats.duplicatesFound} duplicates`));
        }

        return consolidatedData;
    }

    /**
     * Read CSV data from file
     */
    async readCSVData(filePath) {
        return new Promise((resolve, reject) => {
            const data = [];
            createReadStream(filePath, { encoding: this.config.encoding })
                .pipe(csvParser())
                .on('data', (row) => {
                    data.push(row);
                })
                .on('end', () => {
                    resolve(data);
                })
                .on('error', reject);
        });
    }

    /**
     * Generate output CSV file
     */
    async generateOutputFile(consolidatedData) {
        console.log(chalk.blue('📝 Generating unified CSV file...'));

        try {
            // Ensure output directory exists
            await fs.ensureDir(this.config.outputDirectory);

            // Generate output filename with incremental numbering
            let filename;
            let outputPath;
            
            if (this.config.outputFilename.includes('{number')) {
                // Use incremental numbering
                const nextNumber = await this.getNextFileNumber();
                filename = this.config.outputFilename
                    .replace('{number:02d}', String(nextNumber).padStart(2, '0'))
                    .replace('{number}', String(nextNumber));
            } else {
                // Fallback to timestamp-based naming
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
                const dateStr = timestamp[0];
                const timeStr = timestamp[1].split('.')[0].replace(/-/g, '');
                
                filename = this.config.outputFilename
                    .replace('{timestamp}', `${dateStr}_${timeStr}`)
                    .replace('YYYY-MM-DD', dateStr)
                    .replace('HHmmss', timeStr);
            }

            outputPath = path.join(this.config.outputDirectory, filename);

            // Create backup if file exists
            if (this.config.enableBackup && await fs.pathExists(outputPath)) {
                const backupPath = outputPath.replace('.csv', '_backup.csv');
                await fs.copy(outputPath, backupPath);
                console.log(chalk.yellow(`   📋 Created backup: ${path.basename(backupPath)}`));
            }

            // Write CSV data
            await this.writeCSVFile(outputPath, consolidatedData);

            console.log(chalk.green(`✓ Unified CSV created: ${path.basename(outputPath)}`));
            console.log(chalk.gray(`   Location: ${outputPath}`));
            console.log(chalk.gray(`   Rows: ${consolidatedData.length}`));

            return outputPath;

        } catch (error) {
            throw new Error(`Failed to generate output file: ${error.message}`);
        }
    }

    /**
     * Get the next file number for incremental naming
     */
    async getNextFileNumber() {
        try {
            // Ensure output directory exists
            await fs.ensureDir(this.config.outputDirectory);
            
            // Find existing files with the same base pattern
            const basePattern = this.config.outputFilename
                .replace('{number:02d}', '*')
                .replace('{number}', '*');
            
            const pattern = path.join(this.config.outputDirectory, basePattern);
            const existingFiles = await glob(pattern);
            
            if (existingFiles.length === 0) {
                return 1; // Start with 01
            }
            
            // Extract numbers from existing files
            const numbers = existingFiles.map(file => {
                const basename = path.basename(file);
                const match = basename.match(/music_analysis_results_(\d+)\.csv/);
                return match ? parseInt(match[1]) : 0;
            }).filter(num => num > 0);
            
            // Return next number
            const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
            return maxNumber + 1;
            
        } catch (error) {
            console.warn(chalk.yellow(`Warning: Could not determine next file number, using 1: ${error.message}`));
            return 1;
        }
    }

    /**
     * Write CSV data to file
     */
    async writeCSVFile(outputPath, data) {
        return new Promise((resolve, reject) => {
            if (data.length === 0) {
                reject(new Error('No data to write'));
                return;
            }

            const writeStream = createWriteStream(outputPath, { encoding: this.config.encoding });
            
            // Write header
            const headers = Object.keys(data[0]);
            writeStream.write(headers.join(',') + '\n');

            // Write data rows
            for (const row of data) {
                const values = headers.map(header => {
                    const value = row[header] || '';
                    // Escape values containing commas or quotes
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                });
                writeStream.write(values.join(',') + '\n');
            }

            writeStream.end();
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });
    }

    /**
     * Verify output file integrity
     */
    async verifyOutput(outputPath, originalData) {
        console.log(chalk.blue('✅ Verifying output file...'));

        try {
            // Check file exists and is readable
            const stats = await fs.stat(outputPath);
            if (stats.size === 0) {
                throw new Error('Output file is empty');
            }

            // Count rows in output file
            const outputRowCount = await this.countCSVRows(outputPath);
            
            if (outputRowCount !== originalData.length) {
                throw new Error(`Row count mismatch: expected ${originalData.length}, got ${outputRowCount}`);
            }

            // Verify schema
            const outputHeader = await this.readCSVHeader(outputPath);
            const schemaValid = this.validateSchema(outputHeader);
            
            if (!schemaValid.valid) {
                throw new Error(`Output schema invalid: ${schemaValid.error}`);
            }

            console.log(chalk.green('✓ Output file verification passed'));
            console.log(chalk.gray(`   File size: ${(stats.size / 1024).toFixed(2)} KB`));
            console.log(chalk.gray(`   Row count: ${outputRowCount}`));

        } catch (error) {
            throw new Error(`Output verification failed: ${error.message}`);
        }
    }

    /**
     * Cleanup batch files after successful merge
     */
    async cleanupBatchFiles(batchFiles) {
        console.log(chalk.blue('🗑️ Cleaning up batch files...'));

        let cleanedCount = 0;
        for (const filePath of batchFiles) {
            try {
                await fs.remove(filePath);
                cleanedCount++;
            } catch (error) {
                console.error(chalk.red(`   Failed to remove ${path.basename(filePath)}: ${error.message}`));
            }
        }

        console.log(chalk.green(`✓ Cleaned up ${cleanedCount}/${batchFiles.length} batch files`));
    }

    /**
     * Generate comprehensive merge report
     */
    generateMergeReport(outputPath) {
        const duration = this.mergeStats.endTime - this.mergeStats.startTime;
        
        const report = {
            timestamp: new Date().toISOString(),
            outputFile: outputPath,
            processingTime: duration,
            batchFiles: {
                found: this.mergeStats.batchFilesFound,
                processed: this.mergeStats.batchFilesProcessed,
                successRate: this.mergeStats.batchFilesFound > 0 ? 
                    (this.mergeStats.batchFilesProcessed / this.mergeStats.batchFilesFound * 100).toFixed(2) + '%' : '0%'
            },
            dataProcessing: {
                totalRowsProcessed: this.mergeStats.totalRowsProcessed,
                duplicatesFound: this.mergeStats.duplicatesFound,
                duplicatesResolved: this.mergeStats.duplicatesResolved,
                validationErrors: this.mergeStats.validationErrors,
                processingErrors: this.mergeStats.processingErrors
            },
            performance: {
                processingTime: `${(duration / 1000).toFixed(2)}s`,
                rowsPerSecond: duration > 0 ? Math.round(this.mergeStats.totalRowsProcessed / (duration / 1000)) : 0
            }
        };

        // Display report
        console.log(chalk.blue.bold('\n📊 Merge Report'));
        console.log(chalk.blue('─'.repeat(15)));
        console.log(chalk.white(`Output file: ${path.basename(outputPath)}`));
        console.log(chalk.white(`Processing time: ${report.performance.processingTime}`));
        console.log(chalk.white(`Batch files processed: ${report.batchFiles.processed}/${report.batchFiles.found}`));
        console.log(chalk.white(`Total rows merged: ${report.dataProcessing.totalRowsProcessed}`));
        console.log(chalk.white(`Performance: ${report.performance.rowsPerSecond} rows/second`));
        
        if (report.dataProcessing.duplicatesFound > 0) {
            console.log(chalk.yellow(`Duplicates handled: ${report.dataProcessing.duplicatesFound}`));
        }
        
        if (report.dataProcessing.validationErrors > 0 || report.dataProcessing.processingErrors > 0) {
            console.log(chalk.red(`Errors encountered: ${report.dataProcessing.validationErrors + report.dataProcessing.processingErrors}`));
        }

        return report;
    }

    /**
     * Validate merge configuration
     */
    validateConfig() {
        const errors = [];

        if (!this.config.inputDirectory) {
            errors.push('Input directory not specified');
        }

        if (!this.config.outputDirectory) {
            errors.push('Output directory not specified');
        }

        if (!['keep_first', 'keep_last', 'flag_duplicates'].includes(this.config.duplicateStrategy)) {
            errors.push('Invalid duplicate strategy');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
} 