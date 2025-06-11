#!/usr/bin/env node

import chalk from 'chalk';
import BatchProcessor from './automation/batch-processor.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);



async function runAnalysis() {
    console.log(chalk.blue.bold('🎵 MIR Audio Analysis - One-Click Solution'));
    console.log(chalk.blue.bold('═'.repeat(50)));
    console.log(chalk.white('Processing all audio files for music information retrieval...'));
    console.log('');

    const processor = new BatchProcessor();
    
    try {
        // Check for data directory
        const dataDir = path.join(__dirname, 'data');
        
        if (!(await fs.pathExists(dataDir))) {
            console.log(chalk.red.bold('❌ Data directory missing!'));
            console.log(chalk.yellow('The "data" directory should exist in the project root.'));
            console.log(chalk.gray('Please restore the data directory and add your audio files.'));
            console.log(chalk.gray('Supported formats: .mp3, .wav, .flac, .ogg, .m4a, .aac'));
            process.exit(1);
        }
        
        // Count audio files
        const discovery = await processor.fileManager.discoverFiles(dataDir);
        
        if (discovery.totalFiles === 0) {
            console.log(chalk.yellow.bold('⚠️ No audio files found in data directory!'));
            console.log(chalk.gray('Please add audio files to the "data" directory.'));
            console.log(chalk.gray('Supported formats: .mp3, .wav, .flac, .ogg, .m4a, .aac'));
            process.exit(1);
        }
        
        console.log(chalk.green(`✓ Found ${discovery.totalFiles} audio files (${discovery.statistics.totalSizeFormatted})`));
        console.log('');
        
        // Format breakdown
        if (discovery.statistics.formatBreakdown.length > 0) {
            console.log(chalk.blue('📁 File formats:'));
            discovery.statistics.formatBreakdown.forEach(format => {
                console.log(chalk.gray(`   ${format.format}: ${format.count} files (${format.percentage}%)`));
            });
            console.log('');
        }
        
        // Estimate processing time
        const estimatedMinutes = Math.ceil(discovery.totalFiles * 0.5); // ~30 seconds per file
        console.log(chalk.blue(`⏱️ Estimated processing time: ${estimatedMinutes} minutes`));
        console.log('');
        
        console.log(chalk.green.bold('🚀 Starting automated analysis...'));
        console.log('This will:');
        console.log(chalk.gray('  1. Start the MIR web server'));
        console.log(chalk.gray('  2. Launch browser automation'));
        console.log(chalk.gray('  3. Upload and analyze all audio files'));
        console.log(chalk.gray('  4. Download CSV results'));
        console.log(chalk.gray('  5. Merge all results into a single file'));
        console.log('');
        
        // Run the upload workflow with optimized settings
        await processor.executeUploadWorkflow(dataDir, {
            batchSize: 50, // Larger batches for efficiency
            strict: false  // Continue on errors
        });
        
        console.log(chalk.green.bold('\n✅ Analysis Complete!'));
        console.log(chalk.blue('📊 Results available in:'));
        console.log(chalk.gray(`   • Individual batches: ./automation/csv_exports/batch_csvs/`));
        console.log(chalk.gray(`   • Final results: ./results/music_analysis_results_01.csv`));
        console.log('');
        console.log(chalk.blue('💡 The final results file in the "results" directory contains all analysis results for your music collection.'));
        
    } catch (error) {
        console.error(chalk.red.bold('\n❌ Analysis failed:'), error.message);
        console.log(chalk.yellow('\n🔧 Troubleshooting tips:'));
        console.log(chalk.gray('  • Ensure Node.js 16+ is installed'));
        console.log(chalk.gray('  • Check that audio files are not corrupted'));
        console.log(chalk.gray('  • Try running with fewer files first'));
        console.log(chalk.gray('  • Check the logs directory for detailed error info'));
        process.exit(1);
    } finally {
        await processor.cleanup();
    }
}

// Handle interruption gracefully
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n🛑 Stopping analysis...'));
    console.log(chalk.gray('Cleaning up and saving progress...'));
    process.exit(0);
});

// Run the analysis
runAnalysis().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
}); 