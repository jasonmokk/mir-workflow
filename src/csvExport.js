/**
 * CSV Export Module for MIR Analysis Results
 * Handles the generation of CSV files from analysedTracks data with proper formatting and error handling
 */

/**
 * CSV column schema definition
 */
const CSV_SCHEMA = [
    'filename',
    'bpm',
    'key',
    'mood_happy',
    'mood_sad',
    'mood_relaxed',
    'mood_aggressive',
    'mood_electronic',
    'mood_acoustic',
    'mood_party',
    'genre_alternative',
    'genre_blues',
    'genre_electronic_genre',
    'genre_folkcountry',
    'genre_funksoulrnb',
    'genre_jazz',
    'genre_pop',
    'genre_raphiphop',
    'genre_rock',
    'danceability'
];

/**
 * Formats a key object from Essentia analysis into readable string format
 * @param {Object} keyData - Key data from Essentia analysis
 * @returns {string} Formatted key string (e.g., "C# minor") or empty string
 */
function formatKey(keyData) {
    if (!keyData || typeof keyData !== 'object') {
        return '';
    }
    
    try {
        const key = keyData.key || '';
        const scale = keyData.scale || '';
        
        if (key && scale) {
            return `${key} ${scale}`;
        } else if (key) {
            return key;
        }
        
        return '';
    } catch (error) {
        console.warn('Error formatting key data:', error);
        return '';
    }
}

/**
 * Formats BPM value to integer or empty string
 * @param {number|string} bpm - BPM value from Essentia analysis
 * @returns {string} Formatted BPM as integer string or empty string
 */
function formatBPM(bpm) {
    if (bpm === null || bpm === undefined || bpm === '') {
        return '';
    }
    
    const numericBPM = parseFloat(bpm);
    if (isNaN(numericBPM)) {
        console.warn('Invalid BPM value:', bpm);
        return '';
    }
    
    return Math.round(numericBPM).toString();
}

/**
 * Formats mood prediction values to 3 decimal places or empty string
 * @param {number|string} value - Mood prediction value (0-1)
 * @returns {string} Formatted mood value or empty string
 */
function formatMoodValue(value) {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) {
        console.warn('Invalid mood value:', value);
        return '';
    }
    
    // Ensure value is between 0 and 1
    if (numericValue < 0 || numericValue > 1) {
        console.warn('Mood value out of range (0-1):', numericValue);
        return numericValue.toFixed(3); // Still include it but warn
    }
    
    return numericValue.toFixed(3);
}

/**
 * Escapes CSV field values according to RFC 4180 standards
 * @param {string} field - Field value to escape
 * @returns {string} Properly escaped CSV field
 */
function escapeCSVField(field) {
    if (field === null || field === undefined) {
        return '""';
    }
    
    const fieldStr = String(field);
    
    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n') || fieldStr.includes('\r')) {
        return '"' + fieldStr.replace(/"/g, '""') + '"';
    }
    
    return fieldStr;
}

/**
 * Extracts relative path from file object for folder upload compatibility
 * @param {File} file - File object
 * @returns {string} Filename or relative path
 */
function extractFilePath(file) {
    if (!file || !file.name) {
        console.warn('Invalid file object:', file);
        return '';
    }
    
    // For now, just return the filename. In future folder upload implementation,
    // this will be enhanced to handle relative paths from webkitRelativePath
    let filename = file.name;
    
    // Handle webkitRelativePath for future folder upload support
    if (file.webkitRelativePath && file.webkitRelativePath !== '') {
        filename = file.webkitRelativePath;
    }
    
    return filename;
}

/**
 * Validates track data completeness and logs issues
 * @param {Object} track - Track object from analysedTracks array
 * @param {number} index - Track index for logging
 * @returns {Object} Validation result with warnings
 */
function validateTrackData(track, index) {
    const warnings = [];
    
    if (!track) {
        warnings.push(`Track ${index}: Track object is null or undefined`);
        return { isValid: false, warnings };
    }
    
    if (!track.file) {
        warnings.push(`Track ${index}: Missing file object`);
    }
    
    if (!track.predictions) {
        warnings.push(`Track ${index}: Missing predictions data`);
    } else {
        const requiredMoods = ['mood_happy', 'mood_sad', 'mood_relaxed', 'mood_aggressive', 'mood_electronic', 'mood_acoustic', 'mood_party', 'danceability'];
        requiredMoods.forEach(mood => {
            if (!(mood in track.predictions)) {
                warnings.push(`Track ${index}: Missing ${mood} prediction`);
            }
        });
        
        // Check for genre predictions
        if (!track.predictions.genre_dortmund) {
            warnings.push(`Track ${index}: Missing genre_dortmund predictions`);
        } else if (typeof track.predictions.genre_dortmund !== 'object') {
            warnings.push(`Track ${index}: genre_dortmund should be an object with genre probabilities`);
        }
    }
    
    if (!track.essentia) {
        warnings.push(`Track ${index}: Missing Essentia analysis data`);
    } else {
        if (!('bpm' in track.essentia)) {
            warnings.push(`Track ${index}: Missing BPM data`);
        }
        if (!track.essentia.keyData) {
            warnings.push(`Track ${index}: Missing key analysis data`);
        }
    }
    
    return { isValid: true, warnings };
}

/**
 * Processes a single track into CSV row data
 * @param {Object} track - Track object from analysedTracks array
 * @param {number} index - Track index for logging
 * @returns {string} CSV row string
 */
function processTrackToCSVRow(track, index) {
    // Validate track data
    const validation = validateTrackData(track, index);
    if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => console.warn(warning));
    }
    
    if (!validation.isValid) {
        console.error(`Track ${index}: Invalid track data, skipping`);
        return null;
    }
    
    try {
        // Extract filename with path handling
        const filename = extractFilePath(track.file);
        
        // Extract BPM
        const bpm = formatBPM(track.essentia?.bpm);
        
        // Extract and format key
        const key = formatKey(track.essentia?.keyData);
        
        // Extract mood predictions
        const happy = formatMoodValue(track.predictions?.mood_happy);
        const sad = formatMoodValue(track.predictions?.mood_sad);
        const relaxed = formatMoodValue(track.predictions?.mood_relaxed);
        const aggressive = formatMoodValue(track.predictions?.mood_aggressive);
        const electronic = formatMoodValue(track.predictions?.mood_electronic);
        const acoustic = formatMoodValue(track.predictions?.mood_acoustic);
        const party = formatMoodValue(track.predictions?.mood_party);
        const danceability = formatMoodValue(track.predictions?.danceability);
        
        // Extract genre predictions
        const genreData = track.predictions?.genre_dortmund || {};
        const genreAlternative = formatMoodValue(genreData.alternative);
        const genreBlues = formatMoodValue(genreData.blues);
        const genreElectronicGenre = formatMoodValue(genreData.electronic);
        const genreFolkcountry = formatMoodValue(genreData.folkcountry);
        const genreFunksoulrnb = formatMoodValue(genreData.funksoulrnb);
        const genreJazz = formatMoodValue(genreData.jazz);
        const genrePop = formatMoodValue(genreData.pop);
        const genreRaphiphop = formatMoodValue(genreData.raphiphop);
        const genreRock = formatMoodValue(genreData.rock);
        
        // Create CSV row with proper escaping
        const row = [
            escapeCSVField(filename),
            escapeCSVField(bpm),
            escapeCSVField(key),
            escapeCSVField(happy),
            escapeCSVField(sad),
            escapeCSVField(relaxed),
            escapeCSVField(aggressive),
            escapeCSVField(electronic),
            escapeCSVField(acoustic),
            escapeCSVField(party),
            escapeCSVField(genreAlternative),
            escapeCSVField(genreBlues),
            escapeCSVField(genreElectronicGenre),
            escapeCSVField(genreFolkcountry),
            escapeCSVField(genreFunksoulrnb),
            escapeCSVField(genreJazz),
            escapeCSVField(genrePop),
            escapeCSVField(genreRaphiphop),
            escapeCSVField(genreRock),
            escapeCSVField(danceability)
        ].join(',');
        
        return row;
    } catch (error) {
        console.error(`Track ${index}: Error processing track data:`, error);
        return null;
    }
}

/**
 * Generates CSV content from analysedTracks array
 * @param {Array} analysedTracks - Array of track analysis results
 * @returns {Object} Result object with CSV content and statistics
 */
export function generateCSV(analysedTracks) {
    console.log('Starting CSV generation for', analysedTracks.length, 'tracks');
    
    if (!Array.isArray(analysedTracks)) {
        console.error('Invalid analysedTracks data: not an array');
        return {
            success: false,
            error: 'Invalid input data: analysedTracks must be an array',
            csvContent: '',
            statistics: {}
        };
    }
    
    if (analysedTracks.length === 0) {
        console.warn('No tracks to export');
        const csvHeader = CSV_SCHEMA.map(column => escapeCSVField(column)).join(',');
        return {
            success: true,
            csvContent: csvHeader + '\n',
            statistics: {
                totalTracks: 0,
                processedTracks: 0,
                skippedTracks: 0,
                errors: 0
            }
        };
    }
    
    // Initialize statistics
    const stats = {
        totalTracks: analysedTracks.length,
        processedTracks: 0,
        skippedTracks: 0,
        errors: 0
    };
    
    // Start with header row
    const csvHeader = CSV_SCHEMA.map(column => escapeCSVField(column)).join(',');
    const csvRows = [csvHeader];
    
    // Process each track
    analysedTracks.forEach((track, index) => {
        try {
            const csvRow = processTrackToCSVRow(track, index);
            if (csvRow) {
                csvRows.push(csvRow);
                stats.processedTracks++;
            } else {
                stats.skippedTracks++;
            }
        } catch (error) {
            console.error(`Error processing track ${index}:`, error);
            stats.errors++;
            stats.skippedTracks++;
        }
    });
    
    // Join all rows with newlines
    const csvContent = csvRows.join('\n') + '\n';
    
    // Log generation summary
    console.log('CSV generation completed:', {
        totalTracks: stats.totalTracks,
        processedTracks: stats.processedTracks,
        skippedTracks: stats.skippedTracks,
        errors: stats.errors,
        csvSize: csvContent.length + ' characters'
    });
    
    return {
        success: true,
        csvContent: csvContent,
        statistics: stats
    };
}

/**
 * Creates and triggers download of CSV file
 * @param {string} csvContent - CSV content string
 * @param {string} filename - Desired filename (default: 'mir_analysis_results.csv')
 */
export function downloadCSV(csvContent, filename = 'mir_analysis_results.csv') {
    try {
        // Create blob with UTF-8 encoding
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        
        // Create download link
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up object URL
        URL.revokeObjectURL(url);
        
        console.log('CSV download triggered successfully:', filename);
    } catch (error) {
        console.error('Error triggering CSV download:', error);
        throw error;
    }
}

/**
 * Complete CSV export function that generates and downloads CSV
 * @param {Array} analysedTracks - Array of track analysis results
 * @param {string} filename - Optional filename for download
 * @returns {Object} Export result object
 */
export function exportCSV(analysedTracks, filename) {
    try {
        const result = generateCSV(analysedTracks);
        
        if (!result.success) {
            console.error('CSV generation failed:', result.error);
            return result;
        }
        
        downloadCSV(result.csvContent, filename);
        
        return {
            success: true,
            message: 'CSV export completed successfully',
            statistics: result.statistics
        };
    } catch (error) {
        console.error('CSV export failed:', error);
        return {
            success: false,
            error: error.message,
            statistics: {}
        };
    }
}

// Export schema for external access
export { CSV_SCHEMA }; 